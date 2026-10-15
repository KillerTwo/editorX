import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClEditEngine, type EditorEngine } from '@geekx/markdown-core'
import { ThemeProvider } from '@geekx/theme'
import { createRef, StrictMode, useLayoutEffect, useState, type RefObject } from 'react'
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

  it('卸载时同步发出尚未发出的编辑；无编辑的 StrictMode 挂载/卸载不触发 onChange', async () => {
    const onChange = vi.fn()
    const first = renderEditor({ defaultValue: '# 标题', onChange })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    first.unmount()
    expect(onChange).not.toHaveBeenCalled()

    const second = renderEditor({ defaultValue: '# 标题', onChange })
    act(() => second.handle().getEngine().replace(4, 4, '尾'))
    second.unmount()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('# 标题尾', expect.stringContaining('标题尾'))
  })

  it('卸载时 onChange 抛错只记录错误，编辑区照常销毁', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { handle, unmount } = renderEditor({
      defaultValue: 'a',
      onChange: () => {
        throw new Error('boom')
      },
    })
    act(() => handle().getEngine().replace(1, 1, 'b'))
    expect(() => unmount()).not.toThrow()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[editorx/markdown]'), expect.any(Error))
    expect(document.querySelector('.ex-editor-content')).toBeNull()
  })

  it('外层 ThemeProvider 下切换 theme 有无，不重建引擎', () => {
    const ref = createRef<MarkdownEditorHandle>()
    const ui = (theme?: 'dark') => (
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <MarkdownEditor ref={ref} theme={theme} defaultValue="甲" />
      </ThemeProvider>
    )
    const { rerender } = render(ui(), strict)
    const engine = ref.current!.getEngine()
    const content = editorContent()
    act(() => engine.replace(1, 1, '乙'))
    rerender(ui('dark'))
    expect(ref.current!.getEngine()).toBe(engine)
    expect(editorContent()).toBe(content)
    expect(ref.current!.getValue()).toBe('甲乙')
    rerender(ui())
    expect(ref.current!.getEngine()).toBe(engine)
    expect(ref.current!.getValue()).toBe('甲乙')
  })

  it('复用外层 ThemeProvider 后才传入 theme / defaultTheme：开发环境 console.warn 一次', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ui = (props: { theme?: 'dark'; defaultTheme?: 'dark' } = {}) => (
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <MarkdownEditor {...props} />
      </ThemeProvider>
    )
    const { rerender } = render(ui(), strict)
    expect(warn).not.toHaveBeenCalled()
    rerender(ui({ theme: 'dark' }))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[editorx/markdown]'))
    rerender(ui({ defaultTheme: 'dark' }))
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('自建主题时传入 theme 不警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rerender } = render(<MarkdownEditor themeStorageKey={false} theme="light" />, strict)
    rerender(<MarkdownEditor themeStorageKey={false} theme="dark" />)
    expect(warn).not.toHaveBeenCalled()
  })

  it('无外层 ThemeProvider 时切换 theme / defaultTheme 有无，不重建引擎', () => {
    const ref = createRef<MarkdownEditorHandle>()
    const { rerender } = render(<MarkdownEditor ref={ref} themeStorageKey={false} defaultValue="甲" />, strict)
    const engine = ref.current!.getEngine()
    rerender(<MarkdownEditor ref={ref} themeStorageKey={false} theme="dark" defaultValue="甲" />)
    expect(ref.current!.getEngine()).toBe(engine)
    expect(document.querySelector('.ex-root.ex-mde-theme')).toHaveAttribute('data-ex-theme', 'dark')
    rerender(<MarkdownEditor ref={ref} themeStorageKey={false} defaultTheme="light" defaultValue="甲" />)
    expect(ref.current!.getEngine()).toBe(engine)
  })

  it('挂载前调用 ref.setValue 生效，且不触发 onChange', async () => {
    const onChange = vi.fn()
    const ref = createRef<MarkdownEditorHandle>()
    function Parent() {
      useLayoutEffect(() => {
        ref.current!.setValue('预设')
      }, [])
      return <MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} defaultValue="默认" onChange={onChange} />
    }
    render(<Parent />, strict)
    expect(ref.current!.getValue()).toBe('预设')
    expect(editorContent()).toHaveTextContent('预设')
    await waitFor(() => expect(previewEl()).toHaveTextContent('预设'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('受控 value 以 CRLF 回写时按 LF 比较，不重复写入引擎', async () => {
    const setValueCalls: string[] = []
    const factory = () => {
      const engine = new ClEditEngine()
      const setValue = engine.setValue.bind(engine)
      engine.setValue = (md, opts) => {
        setValueCalls.push(md)
        setValue(md, opts)
      }
      return engine
    }
    const onChange = vi.fn()
    const ref = createRef<MarkdownEditorHandle>()
    function Parent() {
      const [value, setValue] = useState('a\r\nb')
      return (
        <MarkdownEditor
          ref={ref}
          engine={factory}
          defaultTheme="light"
          themeStorageKey={false}
          value={value}
          onChange={(md) => {
            onChange(md)
            setValue(md.replace(/\n/g, '\r\n'))
          }}
        />
      )
    }
    render(<Parent />, strict)
    expect(ref.current!.getValue()).toBe('a\nb')
    act(() => ref.current!.getEngine().replace(3, 3, '!'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('a\nb!'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(setValueCalls).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('受控：父组件在 onChange 中变换值时显示变换结果，不循环、光标在范围内', async () => {
    const onChange = vi.fn()
    const ref = createRef<MarkdownEditorHandle>()
    function Parent() {
      const [value, setValue] = useState('abc')
      return (
        <MarkdownEditor
          ref={ref}
          defaultTheme="light"
          themeStorageKey={false}
          value={value}
          onChange={(md) => {
            onChange(md)
            setValue(md.toUpperCase())
          }}
        />
      )
    }
    render(<Parent />, strict)
    act(() => {
      ref.current!.getEngine().setSelection(3, 3)
      ref.current!.getEngine().replace(3, 3, 'd')
    })
    await waitFor(() => expect(ref.current!.getValue()).toBe('ABCD'))
    await waitFor(() => expect(previewEl()).toHaveTextContent('ABCD'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('abcd')
    expect(ref.current!.getEngine().getSelection()).toEqual({ start: 4, end: 4 })
  })

  it('视图切换保留同一引擎、编辑区节点、内容与撤销历史', async () => {
    const { handle } = renderEditor({ defaultValue: 'ab' })
    const engine = handle().getEngine()
    const content = editorContent()
    act(() => engine.replace(2, 2, 'c'))
    for (const name of ['Markdown', '预览', '比对']) {
      await userEvent.click(screen.getByRole('tab', { name }))
      expect(handle().getEngine()).toBe(engine)
      expect(editorContent()).toBe(content)
      expect(handle().getValue()).toBe('abc')
    }
    act(() => engine.undo())
    expect(handle().getValue()).toBe('ab')
  })

  it('卸载时销毁编辑区并清空预览', async () => {
    const { unmount } = renderEditor({ defaultValue: '# x' })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    unmount()
    expect(document.querySelector('.ex-editor-content')).toBeNull()
  })
})

describe('自绘图标（G27/G29/G30）', () => {
  it('页签图标为自绘 16px SVG，不是 lucide', () => {
    renderEditor()
    for (const name of ['Markdown', '比对', '预览']) {
      const svg = screen.getByRole('tab', { name }).querySelector('svg')!
      expect(svg).not.toHaveClass('lucide')
      expect(svg).toHaveAttribute('width', '16')
      expect(svg).toHaveAttribute('focusable', 'false')
    }
  })

  it('删除线、图片、链接为自绘细线图标', () => {
    renderEditor()
    const toolbar = screen.getByRole('toolbar', { name: '编辑工具栏' })
    for (const name of ['删除线', '图片', '链接']) {
      const svg = within(toolbar).getByRole('button', { name }).querySelector('svg')!
      expect(svg, name).not.toHaveClass('lucide')
      expect(svg, name).toHaveAttribute('focusable', 'false')
      expect(Number(svg.getAttribute('stroke-width')), name).toBeLessThanOrEqual(1.2)
    }
  })
})
