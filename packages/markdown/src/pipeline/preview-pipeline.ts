import { patchPreview, renderDiagrams, type EditorEngine, type RenderResult, type Renderer } from '@editorx/markdown-core'
import { whenIdle, yieldToMain } from './scheduler'
import { createStatsCounter, type PreviewStats } from './stats-counter'

export const PREVIEW_DELAY = 200

export interface PreviewPipelineOptions {
  engine: EditorEngine
  previewEl: HTMLElement
  getRenderer(): Renderer
  getTheme(): 'light' | 'dark'
  /** 主题就绪且预览可见时为 true */
  canDrawDiagrams(): boolean
  onRendered(result: RenderResult, markdown: string): void
  onStats(stats: PreviewStats): void
  /** 预览布局变化（补丁、图表、图片加载）后在下一帧调用，用于刷新同步滚动 */
  onLayout(): void
  delay?: number
}

export interface PreviewPipeline {
  /** 防抖后渲染（change 时自动调用） */
  schedule(): void
  /** 立即渲染当前值 */
  flush(): Promise<void>
  /** 已绘制的图表跳过，主题不同的重绘 */
  redrawDiagrams(): void
  getResult(): RenderResult | null
  destroy(): void
}

export function createPreviewPipeline(opts: PreviewPipelineOptions): PreviewPipeline {
  const { engine, previewEl } = opts
  const delay = opts.delay ?? PREVIEW_DELAY
  const counter = createStatsCounter()
  const previous: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let disposed = false
  let cancelStats = () => {}
  let layoutFrame = 0
  let result: RenderResult | null = null

  const layoutSoon = () => {
    cancelAnimationFrame(layoutFrame)
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0
      if (!disposed) opts.onLayout()
    })
  }
  previewEl.addEventListener('load', layoutSoon, true)
  previewEl.addEventListener('error', layoutSoon, true)

  const countStats = (sections: RenderResult['sections'], current: number) => {
    cancelStats()
    cancelStats = whenIdle((deadline) => {
      if (disposed || current !== generation) return
      const stats = counter.count(sections, () => deadline.didTimeout || deadline.timeRemaining() > 2)
      if (stats) opts.onStats(stats)
      else countStats(sections, current)
    })
  }

  const redrawDiagrams = () => {
    if (disposed || !opts.canDrawDiagrams()) return
    void renderDiagrams(previewEl, { theme: opts.getTheme() }).then(
      () => {
        if (!disposed) layoutSoon()
      },
      () => {},
    )
  }

  // 每一步在独立任务中执行，挂起的按键不会被整次预览更新阻塞
  const flush = async () => {
    clearTimeout(timer)
    timer = undefined
    const current = ++generation
    const markdown = engine.getValue()
    const next = opts.getRenderer().render(markdown)
    await yieldToMain()
    if (disposed || current !== generation) return
    result = next
    patchPreview(previewEl, next.sections, previous)
    layoutSoon()
    redrawDiagrams()
    countStats(next.sections, current)
    opts.onRendered(next, markdown)
  }

  const schedule = () => {
    generation++
    clearTimeout(timer)
    timer = setTimeout(() => {
      flush().catch((error: unknown) => console.error(error))
    }, delay)
  }

  const offChange = engine.on('change', schedule)

  return {
    schedule,
    flush,
    redrawDiagrams,
    getResult: () => result,
    destroy() {
      disposed = true
      clearTimeout(timer)
      cancelStats()
      cancelAnimationFrame(layoutFrame)
      offChange()
      previewEl.removeEventListener('load', layoutSoon, true)
      previewEl.removeEventListener('error', layoutSoon, true)
      previewEl.replaceChildren()
    },
  }
}
