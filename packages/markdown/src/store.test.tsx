import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEditorStore, useEditorState } from './store'

describe('createEditorStore', () => {
  it('set 合并补丁并通知；值未变化时不通知', () => {
    const store = createEditorStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ panel: 'toc' })
    expect(store.get().panel).toBe('toc')
    store.set({ panel: 'toc' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('useEditorState 只在所选字段变化时重渲染', () => {
    const store = createEditorStore({ panel: 'toc' })
    let renders = 0
    function Probe() {
      renders++
      return <span data-testid="panel">{useEditorState(store, (s) => s.panel)}</span>
    }
    render(<Probe />)
    act(() => store.set({ fullscreen: true }))
    expect(renders).toBe(1)
    act(() => store.set({ panel: 'syntax' }))
    expect(screen.getByTestId('panel')).toHaveTextContent('syntax')
    expect(renders).toBe(2)
  })
})
