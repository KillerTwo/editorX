import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPairs, mapScrollTop, measurePreviewSections, type SectionPair } from './interpolate'

const PAIRS: SectionPair[] = [
  { editor: { top: 0, height: 100 }, preview: { top: 0, height: 300 } },
  { editor: { top: 100, height: 200 }, preview: { top: 300, height: 100 } },
]

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mapScrollTop', () => {
  it.each([
    [50, 'editor', 150],
    [100, 'editor', 300],
    [200, 'editor', 350],
    [1000, 'editor', 400],
    [150, 'preview', 50],
    [350, 'preview', 200],
    [0, 'preview', 0],
  ] as const)('scrollTop=%d from %s → %d', (top, from, expected) => {
    expect(mapScrollTop(top, PAIRS, from)).toBe(expected)
  })

  it('空 pairs 原样返回', () => {
    expect(mapScrollTop(42, [], 'editor')).toBe(42)
  })

  it('零高度段与首段之前的位置', () => {
    expect(mapScrollTop(0, [{ editor: { top: 0, height: 0 }, preview: { top: 0, height: 50 } }], 'editor')).toBe(0)
    expect(mapScrollTop(0, [{ editor: { top: 20, height: 100 }, preview: { top: 40, height: 100 } }], 'editor')).toBe(40)
  })

  it('非有限输入不产生 NaN', () => {
    expect(mapScrollTop(Number.NaN, PAIRS, 'editor')).toBe(0)
    const bad: SectionPair[] = [{ editor: { top: Number.NaN, height: 100 }, preview: { top: 0, height: 100 } }]
    expect(Number.isFinite(mapScrollTop(50, bad, 'editor'))).toBe(true)
  })
})

describe('buildPairs / measurePreviewSections', () => {
  it('按下标配对，缺失的预览段跳过', () => {
    const editor = [
      { start: 0, end: 5, top: 0, height: 10 },
      { start: 5, end: 9, top: 10, height: 20 },
      { start: 9, end: 12, top: 30, height: 5 },
    ]
    const preview = [{ top: 0, height: 100 }, undefined, { top: 150, height: 50 }] as Array<{ top: number; height: number }>
    expect(buildPairs(editor, preview)).toEqual([
      { editor: { top: 0, height: 10 }, preview: { top: 0, height: 100 } },
      { editor: { top: 30, height: 5 }, preview: { top: 150, height: 50 } },
    ])
  })

  it('下标超出源段数的预览段不配对，并入最后一段的预览高度', () => {
    const editor = [
      { start: 0, end: 5, top: 0, height: 100 },
      { start: 5, end: 9, top: 100, height: 100 },
    ]
    const preview = [
      { top: 0, height: 100 },
      { top: 100, height: 200 },
      { top: 300, height: 150 },
    ]
    const pairs = buildPairs(editor, preview)
    expect(pairs).toEqual([
      { editor: { top: 0, height: 100 }, preview: { top: 0, height: 100 } },
      { editor: { top: 100, height: 100 }, preview: { top: 100, height: 350 } },
    ])
    expect(mapScrollTop(200, pairs, 'editor')).toBe(450)
    expect(mapScrollTop(150, pairs, 'editor')).toBe(275)
    expect(mapScrollTop(450, pairs, 'preview')).toBe(200)
  })

  it('测量预览段相对滚动内容顶部的偏移', () => {
    const preview = document.createElement('div')
    preview.innerHTML =
      '<div class="ex-preview-section" data-section-index="0"></div><div class="ex-preview-section" data-section-index="1"></div>'
    Object.defineProperty(preview, 'scrollTop', { value: 30, configurable: true })
    const rect = (top: number, height: number) => ({ top, height }) as DOMRect
    preview.getBoundingClientRect = () => rect(100, 400)
    const [a, b] = [...preview.children] as HTMLElement[]
    a!.getBoundingClientRect = () => rect(70, 120)
    b!.getBoundingClientRect = () => rect(190, 60)
    expect(measurePreviewSections(preview)).toEqual([
      { top: 0, height: 120 },
      { top: 120, height: 60 },
    ])
  })

  it('2a 脚注位于最后一段内部：最后一段的预览尺寸已包含脚注高度', () => {
    const preview = document.createElement('div')
    preview.innerHTML =
      '<div class="ex-preview-section" data-section-index="0"><p>a</p></div>' +
      '<div class="ex-preview-section" data-section-index="1"><p>b</p><div class="ex-footnotes"></div></div>'
    const rect = (top: number, height: number) => ({ top, height }) as DOMRect
    preview.getBoundingClientRect = () => rect(0, 100)
    const [a, b] = [...preview.children] as HTMLElement[]
    a!.getBoundingClientRect = () => rect(0, 100)
    b!.getBoundingClientRect = () => rect(100, 500)
    b!.querySelector<HTMLElement>('.ex-footnotes')!.getBoundingClientRect = () => rect(200, 400)
    const measured = measurePreviewSections(preview)
    expect(measured).toHaveLength(2)
    const editor = [
      { start: 0, end: 2, top: 0, height: 100 },
      { start: 2, end: 6, top: 100, height: 100 },
    ]
    const pairs = buildPairs(editor, measured)
    expect(pairs[1]!.preview).toEqual({ top: 100, height: 500 })
    expect(mapScrollTop(200, pairs, 'editor')).toBe(600)
  })

  it('忽略非法 data-section-index', () => {
    const preview = document.createElement('div')
    preview.innerHTML =
      '<div class="ex-preview-section" data-section-index="x"></div><div class="ex-preview-section" data-section-index="0"></div>'
    preview.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect
    for (const el of preview.children) (el as HTMLElement).getBoundingClientRect = () => ({ top: 0, height: 10 }) as DOMRect
    const measured = measurePreviewSections(preview)
    expect(Object.keys(measured)).toEqual(['0'])
  })
})
