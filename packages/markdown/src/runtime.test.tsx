import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClEditEngine, type EditorEngine, type RendererOptions } from '@editorx/markdown-core'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorRuntime } from './runtime'
import { createEditorStore, type EditorStore } from './store'
import { previewEl, renderEditor, strict } from './test-utils'
import type { ViewMode } from './types'

const probes = vi.hoisted(() => [] as Array<{ refreshes: number; destroyed: boolean }>)

vi.mock('@editorx/markdown-core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@editorx/markdown-core')>()
  return {
    ...mod,
    createScrollSync: (...args: Parameters<typeof mod.createScrollSync>) => {
      const sync = mod.createScrollSync(...args)
      const probe = { refreshes: 0, destroyed: false }
      probes.push(probe)
      return {
        refresh() {
          probe.refreshes++
          sync.refresh()
        },
        destroy() {
          probe.destroyed = true
          sync.destroy()
        },
      }
    },
  }
})

const NO_OPTIONS: RendererOptions = {}

function Harness({ engine, store, initialValue, viewMode = 'edit' }: { engine: EditorEngine; store: EditorStore; initialValue: string; viewMode?: ViewMode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  useEditorRuntime({
    engine,
    store,
    hostRef,
    previewScrollRef,
    previewRef,
    initialValue,
    value: undefined,
    readOnly: false,
    placeholder: undefined,
    ariaLabel: '编辑区',
    viewMode,
    theme: 'light',
    themeReady: true,
    rendererOptions: NO_OPTIONS,
    onChange: undefined,
  })
  return (
    <div>
      <div ref={hostRef} />
      <div ref={previewScrollRef}>
        <div ref={previewRef} className="ex-mde-preview" />
      </div>
    </div>
  )
}

function renderHarness(initialValue: string) {
  const engine = new ClEditEngine()
  const store = createEditorStore()
  render(<Harness engine={engine} store={store} initialValue={initialValue} />, strict)
  return { engine, store }
}

describe('useEditorRuntime', () => {
  it('选区变化经 rAF 把光标与格式写入 store', async () => {
    const { engine, store } = renderHarness('# 标题\n正文 **粗体** 尾')
    expect(store.get().formatsKey).toBe('heading,heading1')
    act(() => engine.setSelection(9, 9))
    await waitFor(() => expect(store.get().cursor).toEqual({ line: 2, column: 4 }))
    expect(store.get().formatsKey).toBe('bold')
    expect([...store.get().formats]).toEqual(['bold'])
    act(() => engine.setSelection(14, 14))
    await waitFor(() => expect(store.get().cursor).toEqual({ line: 2, column: 9 }))
    expect(store.get().formatsKey).toBe('')
  })

  it('光标与格式未变时不通知订阅者', async () => {
    const { engine, store } = renderHarness('ab')
    act(() => engine.setSelection(1, 1))
    await waitFor(() => expect(store.get().cursor.column).toBe(1))
    const listener = vi.fn()
    store.subscribe(listener)
    act(() => engine.setSelection(1, 1))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(listener).not.toHaveBeenCalled()
  })

  it('目录内容不变时保持同一引用，标题变化时才更新', async () => {
    const { engine, store } = renderHarness('# A\n\n正文')
    await waitFor(() => expect(store.get().toc).toHaveLength(1))
    const toc = store.get().toc
    const listener = vi.fn()
    store.subscribe(() => listener(store.get().toc))
    act(() => engine.replace(engine.getValue().length, engine.getValue().length, '更多'))
    await waitFor(() => expect(previewEl()).toHaveTextContent('正文更多'))
    expect(store.get().toc).toBe(toc)
    expect(listener.mock.calls.every(([t]) => t === toc)).toBe(true)
    act(() => engine.replace(3, 3, 'B'))
    await waitFor(() => expect(store.get().toc[0]!.text).toBe('AB'))
    expect(store.get().toc).not.toBe(toc)
  })
})

describe('同步滚动', () => {
  it('只在比对模式存在；ref.setValue 后刷新', async () => {
    probes.length = 0
    const { handle } = renderEditor({ defaultValue: '# 甲' })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    const live = probes.filter((p) => !p.destroyed)
    expect(live).toHaveLength(1)
    const probe = live[0]!
    const before = probe.refreshes
    act(() => handle().setValue('# 乙'))
    await waitFor(() => expect(probe.refreshes).toBeGreaterThan(before))

    await userEvent.click(screen.getByRole('tab', { name: 'Markdown' }))
    expect(probe.destroyed).toBe(true)
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(probes.filter((p) => !p.destroyed)).toHaveLength(0)
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    expect(probes.filter((p) => !p.destroyed)).toHaveLength(1)
  })
})
