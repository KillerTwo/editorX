import { render, waitFor } from '@testing-library/react'
import { StrictMode, act, createRef } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountEditor } from './mount-editor'
import { RichTextEditor } from './rich-text-editor'
import type { RichTextEditorHandle } from './types'

vi.mock('./mount-editor', () => ({
  mountEditor: vi.fn(),
}))

function createMounted() {
  let data = '<p></p>'
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
    },
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
})
