'use client'

import {
  ClEditEngine,
  countHtml,
  countWords,
  createRenderer,
  createScrollSync,
  renderDiagrams,
  type RenderResult,
} from '@editorx/markdown-core'
import { ThemeProvider, useTheme } from '@editorx/theme'
import { Button, ThemeToggle } from '@editorx/ui'
import { useEffect, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from './sample'

const PREVIEW_DELAY = 200

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

interface DemoApi {
  engine: ClEditEngine
  renderNow(full: boolean): void
}

interface Stats {
  mdWords: number
  lines: number
  htmlWords: number
  paragraphs: number
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
    const previous: string[] = []
    let timer: ReturnType<typeof setTimeout> | undefined

    engine.mount(editorEl, { value: SAMPLE, placeholder: '开始写作…' })
    const sync = createScrollSync(engine, editorEl, scrollEl)
    const onPreviewLoad = () => sync.refresh()
    scrollEl.addEventListener('load', onPreviewLoad, true)

    const renderNow = (full: boolean) => {
      clearTimeout(timer)
      if (full) previous.length = 0
      const value = engine.getValue()
      const result = renderer.render(value)
      patchPreview(previewEl, result, previous)
      const md = countWords(value)
      const html = countHtml(result.html)
      setStats({ mdWords: md.words, lines: md.lines, htmlWords: html.words, paragraphs: html.paragraphs })
      sync.refresh()
      void renderDiagrams(previewEl, { theme: themeRef.current }).then(() => sync.refresh())
    }

    const updateCursor = () => setCursor(engine.getCursorPosition())
    const offChange = engine.on('change', () => {
      setChangeCount((c) => c + 1)
      updateCursor()
      clearTimeout(timer)
      timer = setTimeout(() => renderNow(false), PREVIEW_DELAY)
    })
    const offSelection = engine.on('selectionChange', updateCursor)
    renderNow(true)
    updateCursor()
    apiRef.current = { engine, renderNow }

    return () => {
      clearTimeout(timer)
      offChange()
      offSelection()
      scrollEl.removeEventListener('load', onPreviewLoad, true)
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
