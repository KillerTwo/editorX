import type { EditorEngine, SectionOffset } from '@editorx/markdown-core'
import { describe, expect, it, vi } from 'vitest'
import { scrollToHeading } from './scroll-to-heading'

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
