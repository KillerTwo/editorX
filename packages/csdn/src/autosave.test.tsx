import { createSettings } from '@geekx/publish'
import type { EditorDocument, PublishSettings } from '@geekx/toolbar'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
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

  it('服务端 HTML 不含恢复对话框，客户端再询问较新备份', async () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '<p>Local</p>' },
        settings: createSettings(),
        updatedAt: 50,
      }),
    )
    const props = {
      defaultTheme: 'light' as const,
      initialUpdatedAt: 10,
      initialDocument: { editorType: 'markdown' as const, title: '足够长的标题', markdown: 'Hello', html: '' },
    }
    const html = renderToString(<CsdnEditor {...props} />)
    expect(html).not.toContain('恢复本地草稿')
    for (const className of ['ex-csdn__draft', 'ex-csdn__switch', 'ex-csdn__publish']) {
      const tag = html.match(new RegExp(`<button[^>]*${className}[^>]*>`))?.[0]
      expect(tag).toBeTruthy()
      expect(tag).not.toContain('disabled')
    }
    render(
      <StrictMode>
        <CsdnEditor {...props} />
      </StrictMode>,
    )
    expect(await screen.findByRole('dialog', { name: '恢复本地草稿' })).toBeInTheDocument()
  })

  it('进行中的保存不写较新的备份，结束后再保存一次最新正文', async () => {
    const user = userEvent.setup()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const onSaveDraft = vi.fn<(doc: EditorDocument, settings?: PublishSettings) => Promise<void>>(async () => {
      if (onSaveDraft.mock.calls.length === 1) await gate
    })
    const ref = createRef<CsdnEditorHandle>()
    render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          autoSaveInterval={0}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    await user.type(input, '甲')
    const first = ref.current!.saveDraft()
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    await user.type(input, '乙')
    const second = ref.current!.saveDraft()
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).not.toContain('乙')
    release()
    await first
    await second
    expect(onSaveDraft).toHaveBeenCalledTimes(2)
    expect(onSaveDraft.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ title: '足够长的标题甲乙' }))
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('足够长的标题甲乙')
  })

  it('富文本底栏保存失败仍留下备份，并保持未保存', async () => {
    const user = userEvent.setup()
    let fail = true
    const onSaveDraft = vi.fn(async () => {
      if (fail) throw new Error('offline')
    })
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          autoSaveInterval={0}
          initialDocument={{ editorType: 'richtext', title: '足够长的标题', html: '<p>Hello</p>' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await user.type(screen.getByRole('textbox', { name: '文章标题' }), '呀')
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-dirty', 'true')
    const draft = await waitFor(() => {
      const button = container.querySelector('.ex-pub-bar [data-action="draft"]')
      expect(button).toBeInstanceOf(HTMLButtonElement)
      return button as HTMLButtonElement
    })
    await user.click(draft)
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('保存草稿失败：offline')).toBeInTheDocument()
    expect(screen.getAllByText('保存草稿失败：offline')).toHaveLength(1)
    expect(screen.queryByText(/draft save failed/)).toBeNull()
    expect(screen.queryByText('草稿已保存')).toBeNull()
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-dirty', 'true')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('足够长的标题呀')
    expect(onSaveDraft.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ editorType: 'richtext', title: '足够长的标题呀' }),
    )
    fail = false
    await user.click(draft)
    await waitFor(() => expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-dirty', 'false'))
    expect(onSaveDraft).toHaveBeenCalledTimes(2)
    expect(screen.getAllByText('草稿已保存')).toHaveLength(1)
  })

  it('localStorage 写入失败仍调用 onSaveDraft，保持未保存，并且不拒绝保存', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn<(doc: EditorDocument, settings?: PublishSettings) => Promise<void>>(async () => undefined)
    const previous = '{"keep":"previous"}'
    window.localStorage.setItem(DRAFT_STORAGE_KEY, previous)
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === DRAFT_STORAGE_KEY) throw new Error('quota')
      return original.call(this, key, value)
    })
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          autoSaveInterval={0}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await user.type(screen.getByRole('textbox', { name: '文章标题' }), '呀')
    await expect(ref.current!.saveDraft()).resolves.toBe(false)
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: '足够长的标题呀' }),
      expect.anything(),
    )
    expect(await screen.findByText('保存草稿失败：quota')).toBeInTheDocument()
    expect(screen.getAllByText('保存草稿失败：quota')).toHaveLength(1)
    expect(screen.queryByText('草稿已保存')).toBeNull()
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-dirty', 'true')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(previous)
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
