import { act, render, waitFor } from '@testing-library/react'
import { StrictMode, createRef } from 'react'
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
  vi.mocked(mountEditor).mockImplementation(async (_element, _config, initialHtml: string) => createMounted(initialHtml))
})

describe('RichTextEditor 字数与稿纸后插槽', () => {
  it('挂载和插入都会报告非空白字数', async () => {
    const onWordCount = vi.fn()
    const ref = createRef<RichTextEditorHandle>()
    const { container } = render(
      <StrictMode>
        <RichTextEditor ref={ref} defaultValue="<p>a b</p>" onWordCount={onWordCount} slots={{ afterPaper: <p>发布栏占位</p> }} />
      </StrictMode>,
    )
    await waitFor(() => expect(onWordCount).toHaveBeenCalledWith(2))
    act(() => ref.current!.insert({ html: '<p>cd</p>' }))
    await waitFor(() => expect(onWordCount).toHaveBeenCalledWith(4))
    const after = container.querySelector('.ex-rte__after')
    expect(after).toHaveTextContent('发布栏占位')
    expect(after?.parentElement).toHaveClass('ex-rte__scroll')
  })
})
