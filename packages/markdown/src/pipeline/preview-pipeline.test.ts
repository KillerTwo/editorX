import { createRenderer, renderDiagrams, type EditorEngine } from '@geekx/markdown-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreviewPipeline, type PreviewPipeline, type PreviewPipelineOptions } from './preview-pipeline'

vi.mock('@geekx/markdown-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@geekx/markdown-core')>()),
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

const created: PreviewPipeline[] = []

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
  const pipeline = createPreviewPipeline(opts)
  created.push(pipeline)
  return { ...fake, previewEl, opts, pipeline }
}

describe('createPreviewPipeline', () => {
  afterEach(() => {
    created.splice(0).forEach((pipeline) => pipeline.destroy())
    vi.useRealTimers()
  })

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
    await vi.waitFor(() => expect(opts.onStats).toHaveBeenCalledWith(expect.objectContaining({ mdChars: 5, lines: 4 })))
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

  it('destroy 之后 schedule/flush/redrawDiagrams 均为空操作，不改动 DOM', async () => {
    const { pipeline, previewEl, opts } = setup('# 标题')
    await pipeline.flush()
    pipeline.destroy()
    vi.mocked(opts.onRendered).mockClear()
    vi.mocked(renderDiagrams).mockClear()
    const getRenderer = vi.fn(opts.getRenderer)
    opts.getRenderer = getRenderer
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver((records) => mutations.push(...records))
    observer.observe(previewEl, { childList: true, subtree: true, attributes: true, characterData: true })
    vi.useFakeTimers()
    pipeline.schedule()
    expect(vi.getTimerCount()).toBe(0)
    await pipeline.flush()
    pipeline.redrawDiagrams()
    await vi.advanceTimersByTimeAsync(500)
    mutations.push(...observer.takeRecords())
    observer.disconnect()
    expect(mutations).toHaveLength(0)
    expect(getRenderer).not.toHaveBeenCalled()
    expect(renderDiagrams).not.toHaveBeenCalled()
    expect(opts.onRendered).not.toHaveBeenCalled()
  })

  it('flush 进行中 destroy：不回调、预览保持为空', async () => {
    const { pipeline, previewEl, opts } = setup('# 标题')
    const pending = pipeline.flush()
    pipeline.destroy()
    await pending
    expect(opts.onRendered).not.toHaveBeenCalled()
    expect(previewEl.childElementCount).toBe(0)
  })

  it('只修改一段时只替换该段的预览节点', async () => {
    const { pipeline, previewEl, type } = setup('# 一\n\n段一\n\n## 二\n\n段二\n')
    await pipeline.flush()
    const [first, second] = Array.from(previewEl.children)
    expect(previewEl.childElementCount).toBe(2)
    type('# 一\n\n段一\n\n## 二\n\n段二改\n')
    await pipeline.flush()
    expect(previewEl.children[0]).toBe(first)
    expect(previewEl.children[1]).not.toBe(second)
    expect(previewEl.children[1]).toHaveTextContent('段二改')
  })

  it('渲染抛错：flush 不拒绝，console.error 带前缀', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { pipeline } = setup('x', {
      getRenderer: () => {
        throw new Error('boom')
      },
    })
    await expect(pipeline.flush()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[editorx/markdown]'), expect.any(Error))
  })

  it('onRendered 抛错：防抖路径与 flush 均不产生未处理拒绝', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { pipeline, type } = setup('x', {
      onRendered: () => {
        throw new Error('consumer')
      },
    })
    await expect(pipeline.flush()).resolves.toBeUndefined()
    vi.useFakeTimers()
    type('y')
    await vi.advanceTimersByTimeAsync(250)
    expect(error).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[editorx/markdown]'), expect.any(Error))
  })

  it('图表渲染失败经 console.error 报告，不影响其余渲染', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(renderDiagrams).mockRejectedValueOnce(new Error('chunk'))
    const { pipeline, previewEl, opts } = setup('# 标题')
    await pipeline.flush()
    expect(previewEl.querySelector('h1')).toHaveTextContent('标题')
    expect(opts.onRendered).toHaveBeenCalledTimes(1)
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringContaining('[editorx/markdown]'), expect.any(Error)),
    )
  })
})
