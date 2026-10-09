'use client'

import {
  ClEditEngine,
  countHtml,
  countWords,
  createRenderer,
  createScrollSync,
  renderDiagrams,
  type HtmlCount,
  type RenderedSection,
  type RenderResult,
  type WordCount,
} from '@editorx/markdown-core'
import { ThemeProvider, useTheme } from '@editorx/theme'
import { Button, ThemeToggle } from '@editorx/ui'
import { useEffect, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from './sample'

const PREVIEW_DELAY = 200
const STATS_TIMEOUT = 300

function buildSection(doc: Document, html: string, index: number): HTMLElement {
  const el = doc.createElement('div')
  el.className = 'ex-preview-section'
  el.dataset.sectionIndex = String(index)
  el.innerHTML = html
  return el
}

/** Sections stay direct children of the `.ex-preview` container; only sections whose HTML changed are replaced. */
function patchPreview(container: HTMLElement, result: RenderResult, previous: string[]): void {
  const doc = container.ownerDocument
  const items = result.sections.map((s) => s.html)
  items.forEach((html, i) => {
    const current = container.children[i] as HTMLElement | undefined
    if (current && previous[i] === html) return
    const el = buildSection(doc, html, i)
    if (current) container.replaceChild(el, current)
    else container.appendChild(el)
  })
  while (container.children.length > items.length) container.lastElementChild!.remove()
  previous.splice(0, previous.length, ...items)
}

function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}

interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining(): number
}

function whenIdle(cb: (deadline: IdleDeadlineLike) => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(cb, { timeout: STATS_TIMEOUT })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 0)
  return () => clearTimeout(id)
}

interface Stats {
  mdWords: number
  lines: number
  htmlWords: number
  paragraphs: number
}

/**
 * Sums per-section counts, cached by section source/HTML. Equal to counting the whole document: sections split at
 * line starts (no word spans two sections) and each is rendered inside its own block wrapper.
 */
function createStatsCounter() {
  const md = new Map<string, WordCount>()
  const html = new Map<string, HtmlCount>()
  const prune = <T,>(cache: Map<string, T>, used: Set<string>) => {
    for (const key of cache.keys()) if (!used.has(key)) cache.delete(key)
  }
  return {
    /** Returns null when `hasTime()` runs out before every section is counted; finished sections stay cached. */
    count(sections: readonly RenderedSection[], hasTime: () => boolean): Stats | null {
      const usedMd = new Set<string>()
      const usedHtml = new Set<string>()
      const stats: Stats = { mdWords: 0, lines: 1, htmlWords: 0, paragraphs: 0 }
      for (const section of sections) {
        let words = md.get(section.text)
        let markup = html.get(section.html)
        if ((!words || !markup) && !hasTime()) return null
        if (!words) md.set(section.text, (words = countWords(section.text)))
        if (!markup) html.set(section.html, (markup = countHtml(section.html)))
        usedMd.add(section.text)
        usedHtml.add(section.html)
        stats.mdWords += words.words
        stats.lines += words.lines - 1
        stats.htmlWords += markup.words
        stats.paragraphs += markup.paragraphs
      }
      prune(md, usedMd)
      prune(html, usedHtml)
      return stats
    },
  }
}

interface DemoApi {
  engine: ClEditEngine
  renderNow(full: boolean): void
}

function Workbench() {
  const { resolved } = useTheme()
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<DemoApi | null>(null)
  const themeRef = useRef(resolved)
  const [changeCount, setChangeCount] = useState(0)
  const [stats, setStats] = useState<Stats>({ mdWords: 0, lines: 0, htmlWords: 0, paragraphs: 0 })
  const [cursor, setCursor] = useState({ line: 1, column: 0 })

  useEffect(() => {
    const editorEl = editorRef.current!
    const scrollEl = scrollRef.current!
    const previewEl = previewRef.current!
    const renderer = createRenderer()
    const engine = new ClEditEngine()
    const counter = createStatsCounter()
    const previous: string[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    let generation = 0
    let disposed = false
    let cancelStats = () => {}
    let refreshFrame = 0

    engine.mount(editorEl, { value: SAMPLE, placeholder: '开始写作…' })
    const sync = createScrollSync(engine, editorEl, scrollEl)
    const refreshSoon = () => {
      cancelAnimationFrame(refreshFrame)
      refreshFrame = requestAnimationFrame(() => sync.refresh())
    }
    scrollEl.addEventListener('load', refreshSoon, true)
    scrollEl.addEventListener('error', refreshSoon, true)

    const countStats = (sections: readonly RenderedSection[], current: number) => {
      cancelStats()
      cancelStats = whenIdle((deadline) => {
        if (current !== generation) return
        const next = counter.count(sections, () => deadline.didTimeout || deadline.timeRemaining() > 2)
        if (next) setStats(next)
        else countStats(sections, current)
      })
    }

    // Each step runs in its own task so a pending keystroke is never blocked behind the whole preview update.
    const renderNow = async (full: boolean) => {
      clearTimeout(timer)
      const current = ++generation
      const stale = () => disposed || current !== generation
      const result = renderer.render(engine.getValue())
      await yieldToMain()
      if (stale()) return
      if (full) previous.length = 0
      patchPreview(previewEl, result, previous)
      refreshSoon()
      void renderDiagrams(previewEl, { theme: themeRef.current }).then(refreshSoon)
      countStats(result.sections, current)
    }

    const updateCursor = () => setCursor(engine.getCursorPosition())
    const offChange = engine.on('change', () => {
      generation++
      setChangeCount((c) => c + 1)
      updateCursor()
      clearTimeout(timer)
      timer = setTimeout(() => void renderNow(false), PREVIEW_DELAY)
    })
    const offSelection = engine.on('selectionChange', updateCursor)
    void renderNow(true)
    updateCursor()
    apiRef.current = { engine, renderNow: (full) => void renderNow(full) }

    return () => {
      disposed = true
      clearTimeout(timer)
      cancelStats()
      cancelAnimationFrame(refreshFrame)
      offChange()
      offSelection()
      scrollEl.removeEventListener('load', refreshSoon, true)
      scrollEl.removeEventListener('error', refreshSoon, true)
      sync.destroy()
      engine.destroy()
      previewEl.innerHTML = ''
      apiRef.current = null
    }
  }, [])

  useEffect(() => {
    if (themeRef.current === resolved) return
    themeRef.current = resolved
    apiRef.current?.renderNow(true)
  }, [resolved])

  const loadLargeDoc = () => {
    const api = apiRef.current
    if (!api) return
    api.engine.setValue(generateLargeDoc(10000))
    api.renderNow(true)
    setCursor(api.engine.getCursorPosition())
  }

  return (
    <main className="pg-mdc">
      <header className="pg-mdc-header">
        <h1>markdown-core 编辑引擎</h1>
        <div className="pg-mdc-actions">
          <span data-testid="change-count">变更 {changeCount}</span>
          <Button size="sm" onClick={loadLargeDoc}>
            加载 10k 行文档
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="pg-mdc-panes">
        <div ref={editorRef} className="pg-mdc-pane" data-testid="editor" />
        <div ref={scrollRef} className="pg-mdc-pane pg-mdc-preview" data-testid="preview">
          <div ref={previewRef} className="ex-preview" />
        </div>
      </div>
      <footer className="pg-mdc-status">
        <span data-testid="status-md">
          {`Markdown ${stats.mdWords} 字数 ${stats.lines} 行数 当前行 ${cursor.line}, 当前列 ${cursor.column}`}
        </span>
        <span data-testid="status-html">{`HTML ${stats.htmlWords} 字数 ${stats.paragraphs} 段落`}</span>
      </footer>
    </main>
  )
}

export function MarkdownCoreDemo() {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <Workbench />
    </ThemeProvider>
  )
}
