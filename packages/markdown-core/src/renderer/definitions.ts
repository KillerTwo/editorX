import type { Env, MarkdownIt } from 'markdown-it'
import { closesFence, type Fence, openFence } from '../sections'

export interface DefinitionEnv extends Env {
  abbreviations?: Record<string, string>
  footnotes?: { refs?: Record<string, number> }
}

export interface DefinitionEntry {
  kind: 'link' | 'abbr' | 'footnote'
  /** Link/footnote labels normalized with {@link normalizeLabel}; abbreviation keys unescaped. */
  key: string
  source: string
}

const LINK_OR_ABBR_DEFINITION = /^ {0,3}(\*?)\[(?!\^)([^\]\n]+)\]:/
const FOOTNOTE_DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/
const CONTINUATION_LINE = /^(?: {4}|\t)\S/
const INDENT = /^(?: {4}|\t)/
const HTML_ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/

export const FOOTNOTE_STUB = 'ex-footnote'

function forEachLineOutsideFences(md: string, visit: (line: string, index: number, lines: string[]) => void): void {
  const lines = md.split('\n')
  let fence: Fence | null = null
  lines.forEach((line, index) => {
    if (fence) {
      if (closesFence(line, fence)) fence = null
      return
    }
    fence = openFence(line)
    if (!fence) visit(line, index, lines)
  })
}

/** Case-folded, whitespace-collapsed label, like markdown-it's `normalizeReference`. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase().toUpperCase()
}

/** Definitions separated by blank lines: a link definition cannot interrupt a footnote stub paragraph. */
export function collectDefinitions(md: string): DefinitionEntry[] {
  const out: DefinitionEntry[] = []
  let inDefinition = false
  forEachLineOutsideFences(md, (line) => {
    const footnote = FOOTNOTE_DEFINITION.exec(line)
    const linkOrAbbr = footnote ? null : LINK_OR_ABBR_DEFINITION.exec(line)
    if (footnote) {
      out.push({ kind: 'footnote', key: normalizeLabel(footnote[1]!), source: `[^${footnote[1]}]: ${FOOTNOTE_STUB}` })
      inDefinition = false
    } else if (linkOrAbbr) {
      const abbr = linkOrAbbr[1] === '*'
      const key = abbr ? linkOrAbbr[2]!.replace(/\\(.)/g, '$1') : normalizeLabel(linkOrAbbr[2]!)
      out.push({ kind: abbr ? 'abbr' : 'link', key, source: line })
      inDefinition = true
    } else if (inDefinition && CONTINUATION_LINE.test(line)) {
      out[out.length - 1]!.source += `\n${line}`
    } else {
      inDefinition = false
    }
  })
  return out
}

export function joinDefinitions(entries: DefinitionEntry[]): string {
  return entries.map((entry) => entry.source).join('\n\n')
}

/**
 * Definitions a piece of markdown can consume, used to narrow cache keys. Over-inclusion is
 * harmless; under-inclusion would serve stale html, so abbreviations that entities or
 * backslash escapes could spell are kept.
 */
export function definitionsUsedBy(text: string, entries: DefinitionEntry[]): string {
  if (entries.length === 0) return ''
  let normalized: string | undefined
  // markdown-it reads labels after stripping container markers on continuation lines
  const labels = () => (normalized ??= normalizeLabel(text.replace(/\n[ \t>]*/g, ' ')).replace(/\[ /g, '['))
  const mayHideAbbr = HTML_ENTITY.test(text)
  const hasEscapes = text.includes('\\')
  const used = entries.filter((entry) => {
    if (entry.kind === 'abbr') {
      return text.includes(entry.key) || mayHideAbbr || (hasEscapes && ASCII_PUNCTUATION.test(entry.key))
    }
    return labels().includes(entry.kind === 'footnote' ? `[^${entry.key}` : `[${entry.key}`)
  })
  return joinDefinitions(used)
}

/** Parses the collected definitions once, without rendering them anywhere. */
export function parseDefinitions(md: MarkdownIt, definitions: string): DefinitionEnv {
  const env: DefinitionEnv = {}
  if (definitions) md.parse(definitions, env)
  return env
}

/**
 * Fresh env pre-filled with document-wide definitions (keys as used by markdown-it,
 * markdown-it-abbr and markdown-it-footnote). Copies, because rendering mutates them.
 */
export function seedEnv(defs: DefinitionEnv): DefinitionEnv {
  const env: DefinitionEnv = {}
  if (defs.references) env.references = { ...defs.references }
  if (defs.abbreviations) env.abbreviations = { ...defs.abbreviations }
  if (defs.footnotes?.refs) env.footnotes = { refs: { ...defs.footnotes.refs } }
  return env
}

export function collectFootnoteDefinitions(md: string): Map<string, string> {
  const defs = new Map<string, string>()
  forEachLineOutsideFences(md, (line, index, lines) => {
    const match = FOOTNOTE_DEFINITION.exec(line)
    if (!match || defs.has(match[1]!)) return
    const body = [match[2]!]
    for (let i = index + 1; i < lines.length; i++) {
      const next = lines[i]!
      if (INDENT.test(next)) {
        body.push(next.replace(INDENT, ''))
      } else if (next.trim() === '' && INDENT.test(lines[i + 1] ?? '')) {
        body.push('')
      } else {
        break
      }
    }
    defs.set(match[1]!, body.join('\n'))
  })
  return defs
}
