import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorEngine, SectionOffset } from '../types'
import { createScrollSync } from './scroll-sync'

function scroller(scrollHeight: number, clientHeight: number): HTMLElement {
  const el = document.createElement('div')
  let top = 0
  Object.defineProperties(el, {
    scrollTop: { get: () => top, set: (v: number) => (top = v), configurable: true },
    scrollHeight: { value: scrollHeight, configurable: true },
    clientHeight: { value: clientHeight, configurable: true },
  })
  document.body.appendChild(el)
  return el
}

function setupPreview(el: HTMLElement, sections: Array<[number, number]>) {
  el.getBoundingClientRect = () => ({ top: 0, height: el.clientHeight }) as DOMRect
  sections.forEach(([top, height], i) => {
    const s = document.createElement('div')
    s.className = 'ex-preview-section'
    s.dataset.sectionIndex = String(i)
    s.getBoundingClientRect = () => ({ top: top - el.scrollTop, height }) as DOMRect
    el.appendChild(s)
  })
}

function fakeEngine(offsets: SectionOffset[]) {
  const handlers = new Map<string, (p: unknown) => void>()
  const off = vi.fn()
  const engine = {
    getSectionOffsets: vi.fn(() => offsets),
    on: vi.fn((event: string, cb: (p: unknown) => void) => {
      handlers.set(event, cb)
      return off
    }),
  } as unknown as EditorEngine
  return { engine, handlers, off }
}

const OFFSETS: SectionOffset[] = [
  { start: 0, end: 10, top: 0, height: 100 },
  { start: 10, end: 20, top: 100, height: 200 },
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setup() {
  const editor = scroller(1000, 100)
  const preview = scroller(400, 100)
  setupPreview(preview, [
    [0, 300],
    [300, 100],
  ])
  const { engine, handlers, off } = fakeEngine(OFFSETS)
  const sync = createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
  return { editor, preview, engine, handlers, off, sync }
}

const scrollTo = (el: HTMLElement, top: number) => {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
}

describe('createScrollSync', () => {
  it('编辑区滚动经防抖后同步预览', () => {
    const { editor, preview } = setup()
    scrollTo(editor, 50)
    expect(preview.scrollTop).toBe(0)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(150)
  })

  it('预览滚动同步编辑区；结果夹到可滚动范围', () => {
    const { editor, preview } = setup()
    scrollTo(preview, 350)
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(200)
    vi.advanceTimersByTime(50)
    scrollTo(editor, 1000)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(300)
  })

  it('来源锁：被动滚动的一侧在锁期内不会反向同步', () => {
    const { editor, preview } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(150)
    preview.dispatchEvent(new Event('scroll'))
    editor.scrollTop = 0
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(0)
    vi.advanceTimersByTime(50)
    scrollTo(preview, 150)
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(50)
  })

  it('来源锁在对侧从未触发 scroll 事件时也会按时过期', () => {
    const { editor, preview } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(150)
    vi.advanceTimersByTime(50)
    scrollTo(preview, 350)
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(200)
  })

  it('refresh 立即重新测量并按最近的源同步', () => {
    const { editor, preview, engine, sync } = setup()
    editor.scrollTop = 200
    const calls = vi.mocked(engine.getSectionOffsets).mock.calls.length
    sync.refresh()
    expect(vi.mocked(engine.getSectionOffsets).mock.calls.length).toBe(calls + 1)
    expect(preview.scrollTop).toBe(300)
  })

  it('预览重新渲染后 refresh 使用新的预览段尺寸', () => {
    const { editor, preview, sync } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(60)
    expect(preview.scrollTop).toBe(150)
    preview.replaceChildren()
    setupPreview(preview, [
      [0, 100],
      [100, 300],
    ])
    sync.refresh()
    expect(preview.scrollTop).toBe(50)
  })

  it('change 后尺寸缓存失效并重新测量', () => {
    const { editor, engine, handlers } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    const before = vi.mocked(engine.getSectionOffsets).mock.calls.length
    handlers.get('change')!('new text')
    vi.advanceTimersByTime(60)
    scrollTo(editor, 60)
    vi.advanceTimersByTime(10)
    expect(vi.mocked(engine.getSectionOffsets).mock.calls.length).toBe(before + 1)
  })

  it('ResizeObserver 触发后重新测量，destroy 时断开', () => {
    const observers: Array<{ cb: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
        unobserve = vi.fn()
        constructor(public cb: () => void) {
          observers.push(this)
        }
      },
    )
    const { editor, engine, sync } = setup()
    expect(observers).toHaveLength(1)
    expect(observers[0]!.observe).toHaveBeenCalledTimes(2)
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    const before = vi.mocked(engine.getSectionOffsets).mock.calls.length
    observers[0]!.cb()
    vi.advanceTimersByTime(60)
    scrollTo(editor, 60)
    vi.advanceTimersByTime(10)
    expect(vi.mocked(engine.getSectionOffsets).mock.calls.length).toBe(before + 1)
    sync.destroy()
    expect(observers[0]!.disconnect).toHaveBeenCalled()
  })

  it('2a 脚注位于最后一段内部：编辑区滚到底时预览也到底', () => {
    const editor = scroller(400, 100)
    const preview = scroller(600, 100)
    setupPreview(preview, [
      [0, 300],
      [300, 300],
    ])
    const footnotes = document.createElement('div')
    footnotes.className = 'ex-footnotes'
    footnotes.getBoundingClientRect = () => ({ top: 400 - preview.scrollTop, height: 200 }) as DOMRect
    preview.lastElementChild!.appendChild(footnotes)
    const { engine } = fakeEngine(OFFSETS)
    createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
    scrollTo(editor, 300)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(500)
  })

  it('下标超出源段数的预览段并入最后一段：编辑区滚到底时预览也到底', () => {
    const editor = scroller(400, 100)
    const preview = scroller(600, 100)
    setupPreview(preview, [
      [0, 300],
      [300, 100],
      [400, 200],
    ])
    const { engine } = fakeEngine(OFFSETS)
    createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
    scrollTo(editor, 300)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(500)
  })

  it('无段时不同步', () => {
    const editor = scroller(1000, 100)
    const preview = scroller(400, 100)
    setupPreview(preview, [])
    const { engine } = fakeEngine([])
    const sync = createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(0)
    sync.refresh()
    expect(preview.scrollTop).toBe(0)
  })

  it('对侧不可滚动时保持 0 且不加锁', () => {
    const editor = scroller(1000, 100)
    const preview = scroller(100, 100)
    setupPreview(preview, [
      [0, 50],
      [50, 50],
    ])
    const { engine } = fakeEngine(OFFSETS)
    createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
    scrollTo(editor, 200)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('destroy 取消订阅、监听与定时器并停止同步', () => {
    const { editor, preview, off, sync } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    scrollTo(editor, 60)
    sync.destroy()
    expect(off).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    preview.scrollTop = 0
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(0)
  })
})
