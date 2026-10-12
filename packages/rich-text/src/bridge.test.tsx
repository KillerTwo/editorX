import { act, render, waitFor } from '@testing-library/react'
import { StrictMode, createRef, useEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountEditor } from './mount-editor'
import { RichTextEditor } from './rich-text-editor'
import type { RichTextEditorHandle } from './types'

vi.mock('./mount-editor', () => ({
  mountEditor: vi.fn(),
}))

function createMounted(initial = '<p></p>') {
  let data = initial
  let destroyed = false
  const listeners = new Set<() => void>()
  const emit = () => {
    if (destroyed) return
    for (const listener of listeners) listener()
  }
  return {
    getData: () => data,
    setData(html: string) {
      data = html
      emit()
    },
    setReadOnly: vi.fn(),
    insertHtml(html: string) {
      data += html
      emit()
    },
    execute: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(async () => {
      destroyed = true
    }),
    onChange(cb: () => void) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}

beforeEach(() => {
  vi.mocked(mountEditor).mockReset()
  vi.mocked(mountEditor).mockImplementation(async () => createMounted())
})

describe('RichTextEditor CKEditor 桥', () => {
  it('客户端挂载后 onChange 给出 HTML，ref 能读能写', async () => {
    const onChange = vi.fn()
    const ref = createRef<RichTextEditorHandle>()
    render(<StrictMode><RichTextEditor ref={ref} defaultValue="<p>a</p>" onChange={onChange} /></StrictMode>)
    await waitFor(() => expect(mountEditor).toHaveBeenCalled())
    expect(mountEditor).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ licenseKey: 'GPL' }), '<p>a</p>')
    act(() => ref.current!.insert({ html: '<p>b</p>' }))
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('<p>b</p>'))
    act(() => ref.current!.setValue('<p>c</p>'))
    expect(onChange).not.toHaveBeenCalledWith('<p>c</p>')
    expect(ref.current!.getValue()).toBe('<p>c</p>')
    expect(ref.current!.getDocument()).toEqual({ editorType: 'richtext', title: '', html: '<p>c</p>', markdown: undefined })
  })

  it('服务端渲染不调用 mountEditor', () => {
    renderToString(<RichTextEditor />)
    expect(mountEditor).not.toHaveBeenCalled()
  })

  it('创建完成前的 setValue 成为编辑器内容且不触发 onChange', async () => {
    const pending: Array<() => void> = []
    vi.mocked(mountEditor).mockImplementation(
      (_element, _config, initialHtml: string) =>
        new Promise((resolve) => {
          pending.push(() => resolve(createMounted(initialHtml)))
        }),
    )
    const onChange = vi.fn()
    const ref = createRef<RichTextEditorHandle>()
    function Parent() {
      useEffect(() => {
        ref.current!.setValue('<p>late</p>')
      }, [])
      return <RichTextEditor ref={ref} defaultValue="<p>a</p>" onChange={onChange} />
    }
    render(<Parent />)
    expect(pending.length).toBeGreaterThan(0)
    await act(async () => {
      for (const finish of pending) finish()
    })
    expect(ref.current!.getValue()).toBe('<p>late</p>')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('readOnly 锁定编辑面，切换后更新', async () => {
    const editors: Array<ReturnType<typeof createMounted>> = []
    vi.mocked(mountEditor).mockImplementation(async () => {
      const editor = createMounted()
      editors.push(editor)
      return editor
    })
    const { rerender } = render(
      <StrictMode>
        <RichTextEditor readOnly defaultValue="<p>a</p>" />
      </StrictMode>,
    )
    await waitFor(() => expect(editors.some((editor) => editor.setReadOnly.mock.calls.some((call) => call[0] === true))).toBe(true))
    rerender(
      <StrictMode>
        <RichTextEditor readOnly={false} defaultValue="<p>a</p>" />
      </StrictMode>,
    )
    await waitFor(() => expect(editors.some((editor) => editor.setReadOnly.mock.calls.some((call) => call[0] === false))).toBe(true))
  })
})
