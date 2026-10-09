import { decodeBase64Utf8 } from './base64'
import { escapeHtml } from './escape'
import { sanitizeMermaidSvg, sanitizeSvg } from './sanitize'

export interface RenderDiagramsOptions {
  theme: 'light' | 'dark'
}

type Theme = RenderDiagramsOptions['theme']
type DiagramKind = 'mermaid' | 'flowchart'
type Mermaid = (typeof import('mermaid'))['default']

interface FlowchartChart {
  drawSVG(container: HTMLElement, options?: Record<string, string>): void
}

interface FlowchartApi {
  parse(code: string): FlowchartChart
}

export const FLOWCHART_THEMES: Record<Theme, Record<string, string>> = {
  light: { 'line-color': '#4d4d4d', 'element-color': '#4d4d4d', 'font-color': '#222226', fill: '#ffffff' },
  dark: { 'line-color': '#c9d1d9', 'element-color': '#c9d1d9', 'font-color': '#e6edf3', fill: '#22272e' },
}

const MAX_CACHE = 200
const svgCache = new Map<string, string>()
let mermaidPromise: Promise<Mermaid> | null = null
let flowchartPromise: Promise<FlowchartApi> | null = null
let queue: Promise<void> = Promise.resolve()
let idCounter = 0

function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid')
    .then((mod) => mod.default)
    .catch((error: unknown) => {
      mermaidPromise = null
      throw error
    })
  return mermaidPromise
}

function loadFlowchart(): Promise<FlowchartApi> {
  flowchartPromise ??= import('flowchart.js')
    .then((mod) => {
      const loaded = mod as unknown as { default?: FlowchartApi } & FlowchartApi
      return loaded.default ?? loaded
    })
    .catch((error: unknown) => {
      flowchartPromise = null
      throw error
    })
  return flowchartPromise
}

function drawFlowchart(api: FlowchartApi, source: string, theme: Theme): string {
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.visibility = 'hidden'
  document.body.appendChild(host)
  try {
    api.parse(source).drawSVG(host, { ...FLOWCHART_THEMES[theme] })
    const svg = host.innerHTML
    if (!svg.includes('<svg')) throw new Error('flowchart.js produced no SVG')
    return svg
  } finally {
    host.remove()
  }
}

async function renderBlock(
  block: HTMLElement,
  kind: DiagramKind,
  theme: Theme,
  draw: (source: string, id: string) => Promise<string>,
): Promise<void> {
  const encoded = block.dataset.exDiagram ?? ''
  const key = `${kind}:${theme}:${encoded}`
  const id = `ex-${kind}-${++idCounter}`
  try {
    let svg = svgCache.get(key)
    if (svg === undefined) {
      const raw = await draw(decodeBase64Utf8(encoded), id)
      svg = kind === 'mermaid' ? sanitizeMermaidSvg(raw) : sanitizeSvg(raw)
      if (svgCache.size >= MAX_CACHE) svgCache.clear()
      svgCache.set(key, svg)
    }
    block.innerHTML = svg
    block.classList.remove(`ex-${kind}--error`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    block.innerHTML = `<pre class="ex-${kind}-error">${escapeHtml(message)}</pre>`
    block.classList.add(`ex-${kind}--error`)
  } finally {
    // mermaid may leave its temporary render container in <body> when parsing fails
    document.getElementById(`d${id}`)?.remove()
    block.dataset.exRenderedTheme = theme
  }
}

function pendingBlocks(container: HTMLElement, selector: string, theme: Theme): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (block) => block.dataset.exRenderedTheme !== theme,
  )
}

async function renderNow(container: HTMLElement, { theme }: RenderDiagramsOptions): Promise<void> {
  const mermaidBlocks = pendingBlocks(container, '.ex-mermaid[data-ex-diagram]', theme)
  if (mermaidBlocks.length > 0) {
    const ready = loadMermaid().then((mermaid) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme === 'dark' ? 'dark' : 'default',
        htmlLabels: false,
      })
      return mermaid
    })
    for (const block of mermaidBlocks) {
      if (!container.contains(block)) continue
      await renderBlock(block, 'mermaid', theme, async (source, id) => (await (await ready).render(id, source)).svg)
    }
  }

  const flowchartBlocks = pendingBlocks(container, '.ex-flowchart[data-ex-diagram]', theme)
  if (flowchartBlocks.length > 0) {
    const ready = loadFlowchart()
    for (const block of flowchartBlocks) {
      if (!container.contains(block)) continue
      await renderBlock(block, 'flowchart', theme, async (source) => drawFlowchart(await ready, source, theme))
    }
  }
}

export function renderDiagrams(container: HTMLElement, opts: RenderDiagramsOptions): Promise<void> {
  const run = queue.then(() => renderNow(container, opts))
  queue = run.catch(() => undefined)
  return run
}
