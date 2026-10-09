import type { EditorEngine, SectionOffset } from '@editorx/markdown-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHeadingJumper, REALIGN_WINDOW, scrollToHeading } from './scroll-to-heading'

function trackScrollTop(el: HTMLElement, initial: number) {
  const state = { top: initial }
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => state.top,
    set: (v: number) => {
      state.top = v
    },
  })
  return state
}

const rect = (top: number) => ({ top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20, x: 0, y: top, toJSON() {} }) as DOMRect

function setup() {
  const previewScroller = document.createElement('div')
  const previewEl = document.createElement('div')
  previewEl.innerHTML =
    '<div class="ex-preview-section" data-section-index="0"><h1 id="a">A</h1></div>' +
    '<div class="ex-preview-section" data-section-index="1"><h2 id="b">B</h2></div>'
  previewScroller.append(previewEl)
  const editorHost = document.createElement('div')
  const offsets: SectionOffset[] = [
    { start: 0, end: 3, top: 0, height: 20 },
    { start: 4, end: 8, top: 240, height: 20 },
  ]
  const engine = { getSectionOffsets: () => offsets } as unknown as EditorEngine
  return { previewScroller, previewEl, editorHost, engine }
}

describe('scrollToHeading', () => {
  it('预览可见时按标题位置滚动预览区', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    const preview = trackScrollTop(previewScroller, 50)
    vi.spyOn(previewScroller, 'getBoundingClientRect').mockReturnValue(rect(100))
    vi.spyOn(previewEl.querySelector('#b')!, 'getBoundingClientRect').mockReturnValue(rect(400))
    expect(scrollToHeading({ id: 'b', viewMode: 'split', engine, editorHost, previewEl, previewScroller })).toBe(true)
    expect(preview.top).toBe(350)
  })

  it('Markdown 模式按标题所在段滚动编辑区', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    const editor = trackScrollTop(editorHost, 0)
    expect(scrollToHeading({ id: 'b', viewMode: 'edit', engine, editorHost, previewEl, previewScroller })).toBe(true)
    expect(editor.top).toBe(240)
  })

  it('找不到标题时返回 false', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    expect(scrollToHeading({ id: 'nope', viewMode: 'preview', engine, editorHost, previewEl, previewScroller })).toBe(false)
  })
})

describe('createHeadingJumper', () => {
  const observers: FakeResizeObserver[] = []
  class FakeResizeObserver {
    targets: Element[] = []
    disconnected = false
    constructor(readonly callback: () => void) {
      observers.push(this)
    }
    observe(el: Element) {
      this.targets.push(el)
    }
    disconnect() {
      this.disconnected = true
    }
    fire() {
      if (!this.disconnected) this.callback()
    }
  }
  const win = document.defaultView as unknown as { ResizeObserver?: unknown }
  const original = win.ResizeObserver

  beforeEach(() => {
    observers.length = 0
    win.ResizeObserver = FakeResizeObserver
    vi.useFakeTimers()
  })
  afterEach(() => {
    win.ResizeObserver = original
    vi.useRealTimers()
  })

  /** 预览视图；标题位置可变，模拟图表渲染把它往下推 */
  function previewJumper(viewMode: 'preview' | 'split' = 'preview') {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    const preview = trackScrollTop(previewScroller, 0)
    const heading = { top: 400 }
    vi.spyOn(previewScroller, 'getBoundingClientRect').mockReturnValue(rect(100))
    vi.spyOn(previewEl.querySelector('#b')!, 'getBoundingClientRect').mockImplementation(() => rect(heading.top - preview.top))
    const target = { viewMode: viewMode as 'preview' | 'split' | 'edit', engine, editorHost, previewEl, previewScroller }
    const jumper = createHeadingJumper(() => ({ ...target }))
    return { jumper, preview, heading, target, previewEl }
  }

  it('跳转后内容尺寸变化时重新对齐到标题', () => {
    const { jumper, preview, heading, previewEl } = previewJumper()
    expect(jumper.jump('b')).toBe(true)
    expect(preview.top).toBe(300)
    expect(observers[0]!.targets).toEqual([previewEl])
    heading.top = 900
    observers[0]!.fire()
    expect(preview.top).toBe(800)
  })

  it('用户滚动、点击或按键后停止对齐', () => {
    for (const type of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
      const { jumper, preview, heading } = previewJumper()
      jumper.jump('b')
      document.dispatchEvent(new Event(type))
      heading.top = 900
      observers.at(-1)!.fire()
      expect(preview.top, type).toBe(300)
      expect(observers.at(-1)!.disconnected, type).toBe(true)
    }
  })

  it(`超过 ${REALIGN_WINDOW}ms、再次跳转或切换视图时停止上一次对齐`, () => {
    const timed = previewJumper()
    timed.jumper.jump('b')
    vi.advanceTimersByTime(REALIGN_WINDOW)
    expect(observers[0]!.disconnected).toBe(true)

    const again = previewJumper()
    again.jumper.jump('b')
    again.jumper.jump('a')
    expect(observers[1]!.disconnected).toBe(true)
    expect(observers[2]!.disconnected).toBe(false)
    again.jumper.cancel()
    expect(observers[2]!.disconnected).toBe(true)

    const switched = previewJumper('split')
    switched.jumper.jump('b')
    switched.target.viewMode = 'edit'
    switched.heading.top = 900
    observers[3]!.fire()
    expect(switched.preview.top).toBe(300)
    expect(observers[3]!.disconnected).toBe(true)
  })

  it('目标不存在时不跳转也不观察', () => {
    const { jumper } = previewJumper()
    expect(jumper.jump('nope')).toBe(false)
    expect(observers).toHaveLength(0)
  })

  it('Markdown 模式观察编辑区内容', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    const content = document.createElement('div')
    content.className = 'ex-editor-content'
    editorHost.append(content)
    const jumper = createHeadingJumper(() => ({ viewMode: 'edit', engine, editorHost, previewEl, previewScroller }))
    expect(jumper.jump('b')).toBe(true)
    expect(observers[0]!.targets).toEqual([content])
  })
})
