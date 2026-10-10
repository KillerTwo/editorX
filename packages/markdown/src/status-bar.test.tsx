import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from './markdown-editor'
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
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown \d+ 字数 4 行数 当前行 1, 当前列 0$/), {
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

  it('参考图计数：test → Markdown 4 字数 2 行数 / HTML 4 字数 1 段落；空文档 2 行；CRLF 与 LF 相同', async () => {
    const { handle } = renderEditor({ defaultValue: 'test' })
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown 4 字数 2 行数 当前行 1, 当前列 0$/), { timeout: 3000 })
    expect(statusHtml()).toHaveTextContent(/^HTML 4 字数 1 段落$/)
    act(() => handle().setValue(''))
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown 0 字数 2 行数/))
    expect(statusHtml()).toHaveTextContent(/^HTML 0 字数 0 段落$/)
    act(() => handle().setValue('第一行\r\n第二行\r\n'))
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown 6 字数 3 行数/))
    expect(statusHtml()).toHaveTextContent(/^HTML 6 字数 1 段落$/)
  })

  it('分组：每组一个 span，组间为空格文本节点（G09）', async () => {
    renderEditor({ defaultValue: 'test' })
    await waitFor(() => expect(statusMd()).toHaveTextContent('4 字数 2 行数'), { timeout: 3000 })
    expect([...statusMd()!.children].map((el) => el.textContent)).toEqual(['Markdown', '4 字数', '2 行数', '当前行 1, 当前列 0'])
    expect([...statusHtml()!.children].map((el) => el.textContent)).toEqual(['HTML', '4 字数', '1 段落'])
    expect(statusMd()!.textContent).toBe('Markdown 4 字数 2 行数 当前行 1, 当前列 0')
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

  it('保存状态实时区域在首次保存前已存在且可见；保存中 aria-busy', async () => {
    let resolve!: () => void
    const onSaveDraft = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const { handle } = renderEditor({ defaultValue: 'a', adapters: { onSaveDraft } })
    const live = saveText()
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toBeEmptyDOMElement()
    expect(getComputedStyle(live).display).not.toBe('none')
    expect(live).not.toHaveAttribute('aria-busy')
    act(() => handle().getEngine().replace(1, 1, 'b'))
    let pending!: Promise<boolean>
    act(() => {
      pending = handle().saveDraft()
    })
    expect(saveText()).toBe(live)
    expect(live).toHaveAttribute('aria-busy', 'true')
    expect(live).toHaveTextContent('保存中')
    await act(async () => {
      resolve()
      await pending
    })
    expect(live).not.toHaveAttribute('aria-busy')
    expect(live).toHaveTextContent(/^文章已保存\d{2}:\d{2}:\d{2}$/)
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
    expect(engine.getValue()).toBe('b')
    await sleep(100)
    expect(onSaveDraft).not.toHaveBeenCalled()
  })

  it('连续自动保存失败只提示一次；之后手动保存失败再次提示', async () => {
    const onSaveDraft = vi.fn(async () => {
      throw new Error('网络')
    })
    const { handle } = renderEditor({ defaultValue: 'a', autoSaveInterval: 30, adapters: { onSaveDraft } })
    act(() => handle().getEngine().replace(1, 1, 'b'))
    await waitFor(() => expect(onSaveDraft.mock.calls.length).toBeGreaterThanOrEqual(3))
    expect(screen.getAllByText('保存失败：网络')).toHaveLength(1)
    expect(saveText()).toHaveTextContent('保存失败')
    await act(async () => {
      await handle().saveDraft()
    })
    expect(screen.getAllByText('保存失败：网络')).toHaveLength(2)
  })

  it('autoSaveInterval 变化：旧定时器清除，按新值保存；0 关闭', async () => {
    const onSaveDraft = vi.fn(async () => {})
    const props = { defaultValue: 'a', adapters: { onSaveDraft } }
    const { handle, rerender, ref } = renderEditor({ ...props, autoSaveInterval: 30 })
    const view = (autoSaveInterval: number) => (
      <MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} {...props} autoSaveInterval={autoSaveInterval} />
    )
    rerender(view(0))
    act(() => handle().getEngine().replace(1, 1, 'b'))
    await sleep(100)
    expect(onSaveDraft).not.toHaveBeenCalled()
    rerender(view(20))
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
  })

  it.each([Infinity, 2 ** 31])('超出范围的间隔（%s）关闭自动保存', async (autoSaveInterval) => {
    const onSaveDraft = vi.fn(async () => {})
    const { handle } = renderEditor({ defaultValue: 'a', autoSaveInterval, adapters: { onSaveDraft } })
    act(() => handle().getEngine().replace(1, 1, 'b'))
    await sleep(100)
    expect(onSaveDraft).not.toHaveBeenCalled()
  })
})
