import { createRenderer, renderDiagrams, type EditorEngine } from '@editorx/markdown-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreviewPipeline, type PreviewPipelineOptions } from './preview-pipeline'

vi.mock('@editorx/markdown-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@editorx/markdown-core')>()),
  renderDiagrams: vi.fn(() => Promise.resolve()),
}))

function fakeEngine(initial: string) {
  let value = initial
  const listeners = new Set<(v: string) => void>()
  const engine = {
    getValue: () => value,
    on: (event: string, cb: (v: string) => void) => {
      if (event === 'change') listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
  return {
    engine: engine as unknown as EditorEngine,
    type(next: string) {
      value = next
      listeners.forEach((cb) => cb(next))
    },
    listeners: () => listeners.size,
  }
}

function setup(initial: string, over: Partial<PreviewPipelineOptions> = {}) {
  const fake = fakeEngine(initial)
  const previewEl = document.createElement('div')
  const renderer = createRenderer()
  const opts = {
    engine: fake.engine,
    previewEl,
    getRenderer: () => renderer,
    getTheme: () => 'light' as const,
    canDrawDiagrams: () => true,
    onRendered: vi.fn(),
    onStats: vi.fn(),
    onLayout: vi.fn(),
    ...over,
  }
  return { ...fake, previewEl, opts, pipeline: createPreviewPipeline(opts) }
}

describe('createPreviewPipeline', () => {
  afterEach(() => vi.useRealTimers())

  it('flush 渲染到预览并回调 onRendered(result, markdown)、绘制图表', async () => {
    const { pipeline, previewEl, opts } = setup('# 标题\n\n正文')
    await pipeline.flush()
    expect(previewEl.querySelector('h1')).toHaveTextContent('标题')
    expect(opts.onRendered).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('<h1') }), '# 标题\n\n正文')
    expect(renderDiagrams).toHaveBeenCalledWith(previewEl, { theme: 'light' })
    expect(pipeline.getResult()?.toc[0]?.text).toBe('标题')
  })

  it('change 经 200ms 防抖合并为一次渲染', async () => {
    vi.useFakeTimers()
    const { pipeline, type, opts } = setup('a')
    type('ab')
    type('abc')
    await vi.advanceTimersByTimeAsync(199)
    expect(opts.onRendered).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10)
    expect(opts.onRendered).toHaveBeenCalledTimes(1)
    expect(opts.onRendered).toHaveBeenCalledWith(expect.anything(), 'abc')
    pipeline.destroy()
  })

  it('渲染期间又有输入：旧结果被丢弃', async () => {
    const { pipeline, type, opts } = setup('旧')
    const first = pipeline.flush()
    type('新')
    await first
    expect(opts.onRendered).not.toHaveBeenCalled()
    await pipeline.flush()
    expect(opts.onRendered).toHaveBeenCalledWith(expect.anything(), '新')
  })

  it('canDrawDiagrams 为假时不绘制图表', async () => {
    vi.mocked(renderDiagrams).mockClear()
    const { pipeline } = setup('```mermaid\ngraph TD\nA-->B\n```', { canDrawDiagrams: () => false })
    await pipeline.flush()
    expect(renderDiagrams).not.toHaveBeenCalled()
  })

  it('空闲时统计并回调 onStats', async () => {
    const { pipeline, opts } = setup('# 标题\n\n正文')
    await pipeline.flush()
    await vi.waitFor(() => expect(opts.onStats).toHaveBeenCalledWith(expect.objectContaining({ lines: 3 })))
  })

  it('预览内资源 load/error 触发 onLayout（rAF 合批）', async () => {
    const { pipeline, previewEl, opts } = setup('x')
    await pipeline.flush()
    vi.mocked(opts.onLayout).mockClear()
    previewEl.firstElementChild!.dispatchEvent(new Event('load'))
    previewEl.firstElementChild!.dispatchEvent(new Event('error'))
    await vi.waitFor(() => expect(opts.onLayout).toHaveBeenCalledTimes(1))
  })

  it('destroy：退订、取消挂起渲染、清空预览', async () => {
    const { pipeline, type, previewEl, opts, listeners } = setup('a')
    await pipeline.flush()
    vi.useFakeTimers()
    vi.mocked(opts.onRendered).mockClear()
    type('ab')
    pipeline.destroy()
    expect(listeners()).toBe(0)
    expect(previewEl.childElementCount).toBe(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(opts.onRendered).not.toHaveBeenCalled()
  })
})
