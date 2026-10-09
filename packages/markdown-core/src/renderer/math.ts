// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import katex from 'katex'
import type { MarkdownIt } from 'markdown-it'
import { escapeHtml } from './escape'
import type { StateBlock, StateInline } from './md-types'

const DOLLAR = 0x24
const BACKSLASH = 0x5c
const MAX_CACHE = 500
const FENCE_LINE = /^(?:`{3,}|~{3,})/
const texCache = new Map<string, string>()

export function renderTex(tex: string, displayMode: boolean): string {
  const key = `${displayMode ? 'D' : 'I'}:${tex}`
  const hit = texCache.get(key)
  if (hit !== undefined) return hit
  let html: string
  try {
    html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: 'ignore',
      trust: false,
    })
  } catch {
    html = `<span class="katex-error">${escapeHtml(tex)}</span>`
  }
  if (texCache.size >= MAX_CACHE) texCache.clear()
  texCache.set(key, html)
  return html
}

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a
}

function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src
  const start = state.pos
  if (src.charCodeAt(start) !== DOLLAR) return false

  if (src.charCodeAt(start + 1) === DOLLAR) {
    const lineEnd = src.indexOf('\n', start + 2)
    const close = src.indexOf('$$', start + 2)
    if (close <= start + 2 || (lineEnd !== -1 && close > lineEnd)) {
      if (close === start + 2) return false
      // an unclosed `$$` is literal text; consuming it keeps the single-`$` rule from pairing across lines
      if (!silent) state.pending += '$$'
      state.pos = start + 2
      return true
    }
    if (!silent) {
      const token = state.push('math_inline_display', 'math', 0)
      token.content = src.slice(start + 2, close)
      token.markup = '$$'
    }
    state.pos = close + 2
    return true
  }

  const first = src.charCodeAt(start + 1)
  if (Number.isNaN(first) || isSpace(first)) return false
  let close = start + 1
  while ((close = src.indexOf('$', close)) !== -1 && src.charCodeAt(close - 1) === BACKSLASH) close++
  if (close === -1 || isSpace(src.charCodeAt(close - 1))) return false
  const after = src.charCodeAt(close + 1)
  if (after >= 0x30 && after <= 0x39) return false

  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = src.slice(start + 1, close)
    token.markup = '$'
  }
  state.pos = close + 1
  return true
}

function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false
  const pos = state.bMarks[startLine]! + state.tShift[startLine]!
  const max = state.eMarks[startLine]!
  if (state.src.slice(pos, pos + 2) !== '$$') return false

  const firstRest = state.src.slice(pos + 2, max).trimEnd()
  const firstClose = firstRest.indexOf('$$')
  let next = startLine
  let content: string
  if (firstClose !== -1) {
    // `$$a$$ text` is inline display math inside a paragraph, not a block
    if (firstClose !== firstRest.length - 2) return false
    content = firstRest.slice(0, -2)
  } else {
    const lines = [firstRest]
    let closed = false
    while (++next < endLine) {
      const lineStart = state.bMarks[next]! + state.tShift[next]!
      const lineEnd = state.eMarks[next]!
      if (lineStart < lineEnd && state.sCount[next]! < state.blkIndent) break
      const line = state.src.slice(lineStart, lineEnd).trimEnd()
      if (FENCE_LINE.test(line)) return false
      if (line.endsWith('$$')) {
        lines.push(line.slice(0, -2))
        closed = true
        break
      }
      lines.push(line)
    }
    if (!closed) return false
    content = lines.join('\n')
  }
  if (silent) return true

  state.line = next + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content.trim()
  token.markup = '$$'
  token.map = [startLine, state.line]
  return true
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline)
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  md.renderer.rules.math_inline = (tokens, idx) => renderTex(tokens[idx]!.content, false)
  md.renderer.rules.math_inline_display = (tokens, idx) => renderTex(tokens[idx]!.content, true)
  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="ex-math-block">${renderTex(tokens[idx]!.content, true)}</div>\n`
}
