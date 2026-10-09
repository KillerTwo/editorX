import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClEditEngine, type EditorEngine } from '@editorx/markdown-core'
import { ThemeProvider } from '@editorx/theme'
import { createRef, StrictMode, useState, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from './markdown-editor'
import { editorContent, editorRoot, previewEl, renderEditor, strict } from './test-utils'
import type { MarkdownEditorHandle } from './types'

describe('MarkdownEditor', () => {
  it('非受控：defaultValue 渲染到编辑区与预览区', async () => {
    renderEditor({ defaultValue: '# 标题\n\n正文' })
    expect(editorContent()).toHaveTextContent('# 标题')
    await waitFor(() => expect(previewEl().querySelector('h1')).toHaveTextContent('标题'))
  })

  it('编辑后经防抖以 (markdown, html) 调用 onChange；挂载与 setValue 不触发', async () => {
    const onChange = vi.fn()
    const { handle } = renderEditor({ defaultValue: '# 标题', onChange })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    act(() => handle().getEngine().replace(4, 4, '甲'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('# 标题甲', expect.stringContaining('标题甲')))
    expect(onChange).toHaveBeenCalledTimes(1)
    act(() => handle().setValue('外部'))
    await waitFor(() => expect(previewEl()).toHaveTextContent('外部'))
    expect(handle().getValue()).toBe('外部')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('受控：回显 onChange 的值不重置内容；外部新值替换内容且不触发 onChange', async () => {
    const onChange = vi.fn()
    const ref = createRef<MarkdownEditorHandle>()
    function Controlled({ editorRef }: { editorRef: RefObject<MarkdownEditorHandle | null> }) {
      const [value, setValue] = useState('初始')
      return (
        <>
          <button onClick={() => setValue('外部值')}>外部更新</button>
          <MarkdownEditor
            ref={editorRef}
            defaultTheme="light"
            themeStorageKey={false}
            value={value}
            onChange={(md) => {
              onChange(md)
              setValue(md)
            }}
          />
        </>
      )
    }
    render(<Controlled editorRef={ref} />, strict)
    act(() => ref.current!.getEngine().replace(2, 2, '!'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('初始!'))
    expect(ref.current!.getValue()).toBe('初始!')
    await userEvent.click(screen.getByRole('button', { name: '外部更新' }))
    expect(ref.current!.getValue()).toBe('外部值')
    await waitFor(() => expect(previewEl()).toHaveTextContent('外部值'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('StrictMode：只挂载一个编辑区，保留初始值，撤销正常', async () => {
    const ref = createRef<MarkdownEditorHandle>()
    render(
      <StrictMode>
        <MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} defaultValue="ab" />
      </StrictMode>,
    )
    expect(document.querySelectorAll('.ex-editor-content')).toHaveLength(1)
    expect(ref.current!.getValue()).toBe('ab')
    act(() => ref.current!.getEngine().replace(2, 2, 'c'))
    act(() => ref.current!.getEngine().undo())
    expect(ref.current!.getValue()).toBe('ab')
    await waitFor(() => expect(previewEl()).toHaveTextContent('ab'))
    expect(previewEl().querySelectorAll('.ex-preview-section')).toHaveLength(1)
  })

  it('StrictMode：挂载→卸载→再挂载时沿用引擎内容，卸载后不残留引擎监听', async () => {
    let active = 0
    const engines: EditorEngine[] = []
    const factory = () => {
      const engine = new ClEditEngine()
      const on = engine.on.bind(engine)
      engine.on = ((event, cb) => {
        active++
        const off = on(event, cb)
        let done = false
        return () => {
          if (done) return
          done = true
          active--
          off()
        }
      }) as EditorEngine['on']
      engines.push(engine)
      return engine
    }
    const ref = createRef<MarkdownEditorHandle>()
    const { unmount } = render(
      <StrictMode>
        <MarkdownEditor ref={ref} engine={factory} defaultTheme="light" themeStorageKey={false} defaultValue="初始" />
      </StrictMode>,
    )
    act(() => ref.current!.getEngine().replace(2, 2, '甲'))
    await waitFor(() => expect(previewEl()).toHaveTextContent('初始甲'))
    expect(ref.current!.getValue()).toBe('初始甲')
    expect(active).toBeGreaterThan(0)
    const engine = ref.current!.getEngine()
    unmount()
    expect(active).toBe(0)
    expect(engine.getValue()).toBe('初始甲')
    expect(engines).toContain(engine)
  })

  it('readOnly / placeholder 原地切换，不重建编辑区', () => {
    const { rerender } = render(
      <MarkdownEditor defaultTheme="light" themeStorageKey={false} placeholder="写点什么" />,
      strict,
    )
    const first = editorContent()
    expect(first).toHaveAttribute('data-placeholder', '写点什么')
    rerender(<MarkdownEditor defaultTheme="light" themeStorageKey={false} placeholder="新的提示" readOnly />)
    expect(editorContent()).toBe(first)
    expect(first).toHaveAttribute('data-placeholder', '新的提示')
    expect(first).toHaveAttribute('aria-readonly', 'true')
    expect(first).toHaveAttribute('aria-label', 'Markdown 编辑区')
    expect(editorRoot()).toHaveAttribute('data-readonly')
    rerender(<MarkdownEditor defaultTheme="light" themeStorageKey={false} ariaLabel="正文" />)
    expect(editorContent()).toBe(first)
    expect(first).toHaveAttribute('aria-label', '正文')
  })

  it('视图模式：默认比对；点击切换、隐藏对应面板并回调', async () => {
    const onViewModeChange = vi.fn()
    renderEditor({ onViewModeChange })
    expect(editorRoot()).toHaveAttribute('data-view', 'split')
    expect(screen.getByRole('tab', { name: '比对' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(editorRoot()).toHaveAttribute('data-view', 'preview')
    expect(document.querySelector('.ex-mde-editor')).toHaveAttribute('hidden')
    expect(document.querySelector('.ex-mde-preview-pane')).not.toHaveAttribute('hidden')
    expect(onViewModeChange).toHaveBeenCalledWith('preview')
    await userEvent.keyboard('{ArrowLeft}')
    expect(editorRoot()).toHaveAttribute('data-view', 'split')
  })

  it('受控 viewMode：点击只回调，父组件更新后才切换', async () => {
    const onViewModeChange = vi.fn()
    const { rerender } = renderEditor({ viewMode: 'edit', onViewModeChange })
    expect(document.querySelector('.ex-mde-preview-pane')).toHaveAttribute('hidden')
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(onViewModeChange).toHaveBeenCalledWith('preview')
    expect(editorRoot()).toHaveAttribute('data-view', 'edit')
    rerender(<MarkdownEditor defaultTheme="light" themeStorageKey={false} viewMode="preview" />)
    expect(editorRoot()).toHaveAttribute('data-view', 'preview')
  })

  it('ref：runCommand / getHtml / getDocument / focus', () => {
    const { handle } = renderEditor({ defaultValue: 'hello', title: '标题' })
    act(() => handle().getEngine().setSelection(0, 5))
    act(() => {
      expect(handle().runCommand('bold')).toBe(true)
    })
    expect(handle().getValue()).toBe('**hello**')
    expect(handle().runCommand('nope')).toBe(false)
    expect(handle().getHtml()).toContain('<strong>hello</strong>')
    expect(handle().getDocument()).toEqual({
      editorType: 'markdown',
      title: '标题',
      markdown: '**hello**',
      html: expect.stringContaining('<strong>hello</strong>'),
    })
    act(() => handle().focus())
    expect(editorContent()).toHaveFocus()
  })

  it('外层已有 ThemeProvider 且未传主题时复用外层；否则自建 .ex-mde-theme', () => {
    const { unmount } = render(
      <ThemeProvider defaultTheme="dark" storageKey={false}>
        <MarkdownEditor />
      </ThemeProvider>,
      strict,
    )
    expect(document.querySelectorAll('.ex-root:not(.ex-body-portal)')).toHaveLength(1)
    unmount()
    renderEditor()
    expect(document.querySelector('.ex-root.ex-mde-theme')).toHaveAttribute('data-ex-theme', 'light')
  })

  it('slots.headerEnd 渲染在模式切换右侧；height 写入 --ex-mde-height', () => {
    renderEditor({ slots: { headerEnd: <button>使用富文本编辑器</button> }, height: 600 })
    expect(screen.getByRole('button', { name: '使用富文本编辑器' }).closest('.ex-mde-header__end')).not.toBeNull()
    expect(editorRoot().style.getPropertyValue('--ex-mde-height')).toBe('600px')
  })

  it('卸载时销毁编辑区并清空预览', async () => {
    const { unmount } = renderEditor({ defaultValue: '# x' })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    unmount()
    expect(document.querySelector('.ex-editor-content')).toBeNull()
  })
})
