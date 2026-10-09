import {
  createRenderer,
  createScrollSync,
  type EditorEngine,
  type Renderer,
  type RendererOptions,
  type RenderResult,
  type ScrollSync,
} from '@editorx/markdown-core'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { detectFormats, formatsKey } from './formats'
import { createPreviewPipeline, type PreviewPipeline } from './pipeline/preview-pipeline'
import type { EditorStore } from './store'
import { extractTocTitle } from './toc'
import type { ViewMode } from './types'
import { useLatest } from './use-latest'

export interface RuntimeOptions {
  engine: EditorEngine
  store: EditorStore
  hostRef: RefObject<HTMLDivElement | null>
  previewScrollRef: RefObject<HTMLDivElement | null>
  previewRef: RefObject<HTMLDivElement | null>
  initialValue: string
  value: string | undefined
  readOnly: boolean
  placeholder: string | undefined
  ariaLabel: string
  viewMode: ViewMode
  theme: 'light' | 'dark'
  themeReady: boolean
  rendererOptions: RendererOptions
  onChange: ((markdown: string, html: string) => void) | undefined
}

export interface EditorRuntime {
  getRenderer(): Renderer
  getRenderResult(): RenderResult | null
  /** 写入引擎（不触发 onChange）并立即渲染预览 */
  setValue(markdown: string): void
  flush(): void
}

/** 光标/格式只在变化时写入 store，按键路径不触发无关订阅者 */
export function readUi(engine: EditorEngine, store: EditorStore): void {
  const prev = store.get()
  const cursor = engine.getCursorPosition()
  const formats = detectFormats(engine.getValue(), engine.getSelection())
  const key = formatsKey(formats)
  store.set({
    cursor: cursor.line === prev.cursor.line && cursor.column === prev.cursor.column ? prev.cursor : cursor,
    ...(key === prev.formatsKey ? {} : { formats, formatsKey: key }),
  })
}

export function useEditorRuntime(options: RuntimeOptions): EditorRuntime {
  const { engine, store, hostRef, previewScrollRef, previewRef } = options
  const { value, readOnly, placeholder, ariaLabel, viewMode, theme, themeReady, rendererOptions } = options
  const live = useLatest(options)
  const rendererRef = useRef<Renderer | null>(null)
  const pipelineRef = useRef<PreviewPipeline | null>(null)
  const syncRef = useRef<ScrollSync | null>(null)
  const mounted = useRef(false)
  /** 最后一次发出（onChange）或写入（setValue/受控 value）的值 */
  const lastEmitted = useRef<string | null>(null)
  const rendererOptionsRef = useRef(rendererOptions)

  const runtime = useMemo<EditorRuntime>(
    () => ({
      getRenderer() {
        rendererRef.current ??= createRenderer(live.current.rendererOptions)
        return rendererRef.current
      },
      getRenderResult: () => pipelineRef.current?.getResult() ?? null,
      setValue(markdown) {
        engine.setValue(markdown)
        lastEmitted.current = engine.getValue()
        void pipelineRef.current?.flush()
        readUi(engine, store)
      },
      flush() {
        void pipelineRef.current?.flush()
      },
    }),
    [engine, store, live],
  )

  // 引擎挂载与预览流水线：只依赖稳定引用，StrictMode 的二次挂载沿用引擎内的值与撤销历史
  useEffect(() => {
    const host = hostRef.current
    const previewEl = previewRef.current
    if (!host || !previewEl) return
    const opts = live.current
    const initial = mounted.current ? engine.getValue() : (opts.value ?? opts.initialValue)
    mounted.current = true
    engine.mount(host, { value: initial, readOnly: opts.readOnly, placeholder: opts.placeholder, ariaLabel: opts.ariaLabel })
    lastEmitted.current ??= engine.getValue()

    let frame = 0
    const scheduleUi = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        readUi(engine, store)
      })
    }
    const pipeline = createPreviewPipeline({
      engine,
      previewEl,
      getRenderer: () => runtime.getRenderer(),
      getTheme: () => live.current.theme,
      canDrawDiagrams: () => live.current.themeReady && live.current.viewMode !== 'edit',
      onRendered: (result, markdown) => {
        store.set({ toc: result.toc, tocTitle: extractTocTitle(markdown) })
        if (markdown === lastEmitted.current) return
        lastEmitted.current = markdown
        live.current.onChange?.(markdown, result.html)
      },
      onStats: (stats) => store.set({ stats }),
      onLayout: () => syncRef.current?.refresh(),
    })
    pipelineRef.current = pipeline
    const offChange = engine.on('change', scheduleUi)
    const offSelection = engine.on('selectionChange', scheduleUi)
    void pipeline.flush()
    readUi(engine, store)

    // 监听在 destroy 之前退订：destroy 可能同步发出最后一次 change
    return () => {
      cancelAnimationFrame(frame)
      offChange()
      offSelection()
      pipeline.destroy()
      pipelineRef.current = null
      engine.destroy()
    }
  }, [engine, store, runtime, live, hostRef, previewRef])

  useEffect(() => {
    if (value === undefined || !mounted.current || value === lastEmitted.current) return
    runtime.setValue(value)
  }, [value, runtime])

  useEffect(() => {
    engine.setReadOnly(readOnly)
  }, [engine, readOnly])

  useEffect(() => {
    engine.setPlaceholder(placeholder)
  }, [engine, placeholder])

  useEffect(() => {
    ;(engine as Partial<{ setAriaLabel(label: string | undefined): void }>).setAriaLabel?.(ariaLabel)
  }, [engine, ariaLabel])

  useEffect(() => {
    if (rendererOptionsRef.current === rendererOptions) return
    rendererOptionsRef.current = rendererOptions
    rendererRef.current = null
    runtime.flush()
  }, [rendererOptions, runtime])

  // 主题、就绪或视图变化时补画/重画图表（预览隐藏时不画）
  useEffect(() => {
    if (themeReady && viewMode !== 'edit') pipelineRef.current?.redrawDiagrams()
  }, [theme, themeReady, viewMode])

  // 同步滚动只在比对模式存在；声明在挂载 effect 之后，保证引擎已挂载
  useEffect(() => {
    if (viewMode !== 'split') return
    const host = hostRef.current
    const scroller = previewScrollRef.current
    if (!host || !scroller) return
    const sync = createScrollSync(engine, host, scroller)
    syncRef.current = sync
    sync.refresh()
    return () => {
      sync.destroy()
      if (syncRef.current === sync) syncRef.current = null
    }
  }, [engine, viewMode, hostRef, previewScrollRef])

  return runtime
}
