// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type { SourceSection } from './types'

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t\r]*$/
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t\r]|$)/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t\r]*$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t\r]*$/
const QUOTE_MARKER = /^ {0,3}> ?/
const LIST_MARKER = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?=[ \t\r]|$)/

interface Fence { char: string; length: number }
type Container = { kind: 'list'; indent: number; empty: boolean } | { kind: 'quote' }

const isBlank = (line: string) => line.trim() === ''

function columnsOf(text: string, startColumn = 0): { columns: number; chars: number } {
  let column = startColumn
  let chars = 0
  for (const ch of text) {
    if (ch === ' ') column += 1
    else if (ch === '\t') column += 4 - (column % 4)
    else break
    chars += 1
  }
  return { columns: column - startColumn, chars }
}

function stripColumns(line: string, columns: number): string {
  let column = 0
  let i = 0
  while (i < line.length && column < columns && (line[i] === ' ' || line[i] === '\t')) {
    column += line[i] === '\t' ? 4 - (column % 4) : 1
    i += 1
  }
  return line.slice(i)
}

function openFence(line: string): Fence | null {
  const open = FENCE_OPEN.exec(line)
  if (!open || (open[1]![0] === '`' && open[2]!.includes('`'))) return null
  return { char: open[1]![0]!, length: open[1]!.length }
}

function closesFence(line: string, fence: Fence): boolean {
  const close = FENCE_CLOSE.exec(line)
  return !!close && close[1]![0] === fence.char && close[1]!.length >= fence.length
}

/** Content column and remaining text of a list item line, or null when the line is not one. */
function listItem(line: string): { indent: number; rest: string } | null {
  const marker = LIST_MARKER.exec(line)
  if (!marker || THEMATIC_BREAK.test(line)) return null
  const markerEnd = marker[0].length
  const after = line.slice(markerEnd)
  if (isBlank(after)) return { indent: markerEnd + 1, rest: '' }
  const spacing = columnsOf(after, markerEnd)
  if (spacing.columns > 4) return { indent: markerEnd + 1, rest: after.slice(1) }
  return { indent: markerEnd + spacing.columns, rest: after.slice(spacing.chars) }
}

function startsBlock(line: string): boolean {
  return (
    ATX_HEADING.test(line) ||
    THEMATIC_BREAK.test(line) ||
    openFence(line) !== null ||
    QUOTE_MARKER.test(line) ||
    listItem(line) !== null
  )
}

function stripMarkers(content: string): string {
  for (;;) {
    const quote = QUOTE_MARKER.exec(content)
    if (quote) {
      content = content.slice(quote[0].length)
      continue
    }
    const item = listItem(content)
    if (!item) return content
    content = item.rest
  }
}

/**
 * Sections start at top-level ATX/setext headings only. Lines inside list items and
 * blockquotes (including lazy paragraph continuations) never start a section.
 */
export function splitSections(md: string): SourceSection[] {
  const lines = md.split('\n')
  const lineOffsets: number[] = []
  let offset = 0
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }

  const startLines: number[] = [0]
  const pushStart = (line: number) => {
    if (line > startLines[startLines.length - 1]!) startLines.push(line)
  }

  let fence: Fence | null = null
  let paragraphStart = -1
  let container: Container | null = null
  let innerFence: Fence | null = null
  let innerParagraph = false

  const scanInner = (raw: string) => {
    if (innerFence) {
      if (closesFence(raw.replace(/^[ \t>]*/, ''), innerFence)) innerFence = null
      return
    }
    const content = stripMarkers(raw)
    const open = openFence(content)
    if (isBlank(content)) innerParagraph = false
    else if (open) {
      innerFence = open
      innerParagraph = false
    } else if (ATX_HEADING.test(content) || THEMATIC_BREAK.test(content)) innerParagraph = false
    else if (innerParagraph && SETEXT_UNDERLINE.test(content)) innerParagraph = false
    else if (innerParagraph || columnsOf(content).columns < 4) innerParagraph = true
  }

  const isLazy = (line: string) => innerParagraph && !innerFence && !isBlank(line) && !startsBlock(line)

  const continuesContainer = (line: string, current: Container): boolean => {
    if (current.kind === 'quote') {
      const quote = QUOTE_MARKER.exec(line)
      if (quote) {
        scanInner(line.slice(quote[0].length))
        return true
      }
      return isLazy(line)
    }
    if (isBlank(line)) {
      if (current.empty) return false
      if (!innerFence) innerParagraph = false
      return true
    }
    if (columnsOf(line).columns >= current.indent) {
      current.empty = false
      scanInner(stripColumns(line, current.indent))
      return true
    }
    return isLazy(line)
  }

  const scanTopLevel = (line: string, i: number) => {
    const open = openFence(line)
    if (open) {
      fence = open
      paragraphStart = -1
      return
    }
    if (ATX_HEADING.test(line)) {
      pushStart(i)
      paragraphStart = -1
      return
    }
    if (isBlank(line)) {
      paragraphStart = -1
      return
    }
    if (paragraphStart >= 0 && SETEXT_UNDERLINE.test(line)) {
      pushStart(paragraphStart)
      paragraphStart = -1
      return
    }
    if (paragraphStart < 0 && columnsOf(line).columns >= 4) return
    if (THEMATIC_BREAK.test(line)) {
      paragraphStart = -1
      return
    }
    const quote = QUOTE_MARKER.exec(line)
    const item = quote ? null : listItem(line)
    if (quote || item) {
      container = item ? { kind: 'list', indent: item.indent, empty: isBlank(item.rest) } : { kind: 'quote' }
      paragraphStart = -1
      scanInner(item ? item.rest : line.slice(quote![0].length))
      return
    }
    if (paragraphStart < 0) paragraphStart = i
  }

  lines.forEach((line, i) => {
    if (fence) {
      if (closesFence(line, fence)) fence = null
      return
    }
    if (container && continuesContainer(line, container)) return
    container = null
    innerFence = null
    innerParagraph = false
    scanTopLevel(line, i)
  })

  return startLines.map((line, k) => {
    const start = lineOffsets[line]!
    const nextLine = startLines[k + 1]
    const end = nextLine === undefined ? md.length : lineOffsets[nextLine]!
    return { text: md.slice(start, end), start, end }
  })
}
