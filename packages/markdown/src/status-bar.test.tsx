import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatSavedTime } from './status-bar'
import { renderEditor } from './test-utils'

const statusMd = () => document.querySelector<HTMLElement>('.ex-mde-status__md')
const statusHtml = () => document.querySelector<HTMLElement>('.ex-mde-status__html')
const saveText = () => document.querySelector<HTMLElement>('.ex-mde-status__save')!
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('StatusBar', () => {
  it('formatSavedTime 输出 HH:mm:ss', () => {
    expect(formatSavedTime(new Date(2026, 9, 9, 8, 5, 3).getTime())).toBe('08:05:03')
  })

  it('显示 Markdown/HTML 统计与光标行列；预览模式只显示 HTML 行', async () => {
    const { handle } = renderEditor({ defaultValue: '# 标题\n\n正文 hello' })
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown \d+ 字数 3 行数 当前行 1, 当前列 0$/), {
      timeout: 3000,
    })
    expect(statusHtml()).toHaveTextContent(/^HTML \d+ 字数 \d+ 段落$/)
    act(() => {
      handle().focus()
      handle().getEngine().setSelection(8, 8)
    })
    await waitFor(() => expect(statusMd()).toHaveTextContent('当前行 3, 当前列 2'))
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(statusMd()).toBeNull()
    expect(statusHtml()).not.toBeNull()
  })

  it('statusCenter / statusEnd 插槽', () => {
    renderEditor({ slots: { statusCenter: <span>额度提示</span>, statusEnd: <button type="button">发布文章</button> } })
    const bar = screen.getByRole('group', { name: '状态栏' })
    expect(within(bar).getByText('额度提示')).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: '发布文章' })).toBeInTheDocument()
  })
})

describe('autoSaveInterval', () => {
  it('只在内容变化后调用 onSaveDraft，状态栏显示「文章已保存HH:mm:ss」', async () => {
    const onSaveDraft = vi.fn(async () => {})
    const { handle } = renderEditor({ defaultValue: 'a', title: '标题', autoSaveInterval: 30, adapters: { onSaveDraft } })
    await sleep(100)
    expect(onSaveDraft).not.toHaveBeenCalled()
    act(() => handle().getEngine().replace(1, 1, 'b'))
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ title: '标题', markdown: 'ab' }))
    await waitFor(() => expect(saveText()).toHaveTextContent(/^文章已保存\d{2}:\d{2}:\d{2}$/))
    await sleep(100)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })

  it('保存失败：toast 提示并在状态栏显示「保存失败」', async () => {
    const onSaveDraft = vi.fn(async () => {
      throw new Error('网络')
    })
    // 失败后内容仍未保存，下一次间隔会重试；间隔放长以免断言撞上「保存中」
    const { handle } = renderEditor({ defaultValue: 'a', autoSaveInterval: 200, adapters: { onSaveDraft } })
    act(() => handle().getEngine().replace(1, 1, 'b'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('保存失败：网络'))
    await waitFor(() => expect(saveText()).toHaveTextContent('保存失败'))
  })

  it('ref.saveDraft 无改动也保存；ref.setValue 写入的内容视为已保存', async () => {
    const onSaveDraft = vi.fn(async () => {})
    const { handle } = renderEditor({ defaultValue: 'a', autoSaveInterval: 30, adapters: { onSaveDraft } })
    let saved = false
    await act(async () => {
      saved = await handle().saveDraft()
    })
    expect(saved).toBe(true)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
    act(() => handle().setValue('载入的文档'))
    await sleep(100)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })

  it('卸载后停止自动保存', async () => {
    const onSaveDraft = vi.fn(async () => {})
    const { handle, unmount } = renderEditor({ defaultValue: 'a', autoSaveInterval: 30, adapters: { onSaveDraft } })
    const engine = handle().getEngine()
    unmount()
    engine.setValue('b')
    await sleep(100)
    expect(onSaveDraft).not.toHaveBeenCalled()
  })
})
