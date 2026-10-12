import { createSettings } from '@editorx/publish'
import type { EditorDocument, PublishSettings } from '@editorx/toolbar'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'
import { DRAFT_STORAGE_KEY } from './draft-backup'
import type { CsdnEditorHandle } from './types'

describe('自动保存与本地备份', () => {
  it('失败时提示、保持未保存，并且不删本地备份', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn(async () => {
      throw new Error('offline')
    })
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          autoSaveInterval={30}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await user.type(screen.getByRole('textbox', { name: '文章标题' }), '呀')
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalled())
    expect(await screen.findByText('保存草稿失败：offline')).toBeInTheDocument()
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-dirty', 'true')
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    expect(stored).toContain('足够长的标题呀')
    const calls = onSaveDraft.mock.calls.length
    await waitFor(() => expect(onSaveDraft.mock.calls.length).toBeGreaterThan(calls))
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('足够长的标题呀')
    expect(screen.getAllByText('保存草稿失败：offline')).toHaveLength(1)
  })

  it('较新的备份先询问，取消后仍显示初始标题且备份还在', async () => {
    const user = userEvent.setup()
    const settings = createSettings()
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '<p>Local</p>' },
        settings,
        updatedAt: 50,
      }),
    )
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialUpdatedAt={10}
          autoSaveInterval={30}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    const dialog = await screen.findByRole('dialog', { name: '恢复本地草稿' })
    expect(screen.getByRole('button', { name: '保存草稿', hidden: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发布', hidden: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: '切换编辑器', hidden: true })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('足够长的标题')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('本地更新的标题啊')
  })

  it('恢复会换上备份里的标题', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '<p>Local</p>' },
        settings: createSettings({ tags: ['jvm'] }),
        updatedAt: 50,
      }),
    )
    const ref = createRef<CsdnEditorHandle>()
    render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          initialUpdatedAt={10}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    const dialog = await screen.findByRole('dialog', { name: '恢复本地草稿' })
    await user.click(within(dialog).getByRole('button', { name: '恢复' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('本地更新的标题啊'))
    expect(ref.current?.getSettings().tags).toEqual(['jvm'])
  })

  it('更旧的备份不弹窗', () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '' },
        settings: createSettings(),
        updatedAt: 5,
      }),
    )
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialUpdatedAt={10}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    expect(screen.queryByRole('dialog', { name: '恢复本地草稿' })).toBeNull()
    expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('足够长的标题')
  })

  it('手动保存成功会提示草稿已保存，间隔为 0 或过大时不自动调用', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn<(doc: EditorDocument, settings?: PublishSettings) => Promise<void>>(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          autoSaveInterval={0}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await user.click(container.querySelector('.ex-csdn__draft')!)
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('草稿已保存')).toBeInTheDocument()
    expect(onSaveDraft.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ title: '足够长的标题' }))
    expect(onSaveDraft.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ tags: [] }))
  })

  it.each([Infinity, 2 ** 31])('超出范围的间隔（%s）不调用 onSaveDraft', async (autoSaveInterval) => {
    const onSaveDraft = vi.fn(async () => undefined)
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          autoSaveInterval={autoSaveInterval}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(onSaveDraft).not.toHaveBeenCalled()
  })
})
