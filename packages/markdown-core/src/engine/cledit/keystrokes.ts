// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/keystrokes.js
import type { TextState } from '../../types'
import type { UndoMode } from './undo'

export interface KeyInfo {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  isComposing: boolean
}

const LIST_RE = /^([ \t]*)(?:([*+-])|(\d+)([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/
const QUOTE_RE = /^ {0,3}>[ \t]?/

function lineBounds(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', pos - 1) + 1
  const end = text.indexOf('\n', pos)
  return { start, end: end === -1 ? text.length : end }
}

function replaceRange(text: string, start: number, end: number, insert: string, caret: number): TextState {
  return { text: text.slice(0, start) + insert + text.slice(end), selection: { start: caret, end: caret } }
}

function renumberFollowing(text: string, from: number, indent: string, firstNumber: number): string {
  const lines = text.slice(from).split('\n')
  let n = firstNumber
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const m = /^([ \t]*)(\d+)([.)])[ \t]/.exec(line)
    if (m && m[1] === indent) {
      lines[i] = indent + n + m[3] + line.slice(m[1].length + m[2]!.length + 1)
      n++
      continue
    }
    if (line.length > indent.length && line.startsWith(indent) && /^[ \t]/.test(line.slice(indent.length))) continue
    break
  }
  return text.slice(0, from) + lines.join('\n')
}

export function handleEnter(state: TextState): TextState {
  const { text, selection } = state
  const s = Math.min(selection.start, selection.end)
  const e = Math.max(selection.start, selection.end)
  const { start: ls, end: le } = lineBounds(text, s)
  const line = text.slice(ls, le)

  if (s === e) {
    const list = LIST_RE.exec(line)
    if (list && s >= ls + list[0].length) {
      const [marker, indent = '', bullet, num, delim, space = ' ', task] = list
      if (line.slice(marker.length).trim() === '') return replaceRange(text, ls, le, '', ls)
      const nextMarker = bullet ?? `${Number(num) + 1}${delim}`
      const insert = `\n${indent}${nextMarker}${space}${task ? '[ ] ' : ''}`
      const next = replaceRange(text, s, e, insert, s + insert.length)
      if (num !== undefined) {
        const newLineEnd = next.text.indexOf('\n', s + insert.length)
        if (newLineEnd !== -1) next.text = renumberFollowing(next.text, newLineEnd + 1, indent, Number(num) + 2)
      }
      return next
    }
    const quote = QUOTE_RE.exec(line)
    if (quote && s >= ls + quote[0].length) {
      if (line.slice(quote[0].length).trim() === '') return replaceRange(text, ls, le, '', ls)
      const insert = `\n${quote[0]}`
      return replaceRange(text, s, e, insert, s + insert.length)
    }
  }

  const indent = /^[ \t]*/.exec(text.slice(ls, s))![0]
  const insert = `\n${indent}`
  return replaceRange(text, s, e, insert, s + insert.length)
}

export function handleTab(state: TextState, outdent: boolean): TextState {
  const { text, selection } = state
  const s = Math.min(selection.start, selection.end)
  const e = Math.max(selection.start, selection.end)
  const first = lineBounds(text, s)
  const ls = first.start
  const le = lineBounds(text, e).end
  const multi = text.slice(s, e).includes('\n')

  if (!outdent && !multi && !LIST_RE.test(text.slice(first.start, first.end))) {
    return replaceRange(text, s, e, '\t', s + 1)
  }

  let startDelta = 0
  let total = 0
  const out = text
    .slice(ls, le)
    .split('\n')
    .map((line, i) => {
      if (!outdent) {
        if (i === 0) startDelta = 1
        total += 1
        return `\t${line}`
      }
      const n = /^(?:\t| {1,4})/.exec(line)?.[0].length ?? 0
      if (i === 0) startDelta = -Math.min(n, s - ls)
      total -= n
      return line.slice(n)
    })
    .join('\n')

  const start = s + startDelta
  const end = s === e ? start : Math.max(start, e + total)
  return { text: text.slice(0, ls) + out + text.slice(le), selection: { start, end } }
}

export function handleBackspace(state: TextState): TextState | null {
  const { text, selection } = state
  if (selection.start !== selection.end) return null
  const s = selection.start
  const { start: ls, end: le } = lineBounds(text, s)
  const line = text.slice(ls, le)
  const list = LIST_RE.exec(line)
  if (!list || s !== ls + list[0].length || line.length !== list[0].length) return null
  const indent = list[1] ?? ''
  return replaceRange(text, ls, le, indent, ls + indent.length)
}

export function handleKeystroke(key: KeyInfo, state: TextState): { state: TextState; mode: UndoMode } | null {
  if (key.isComposing || key.ctrlKey || key.metaKey || key.altKey) return null
  switch (key.key) {
    case 'Enter': {
      if (key.shiftKey) {
        const s = Math.min(state.selection.start, state.selection.end)
        const e = Math.max(state.selection.start, state.selection.end)
        return { state: replaceRange(state.text, s, e, '\n', s + 1), mode: 'single' }
      }
      return { state: handleEnter(state), mode: 'single' }
    }
    case 'Tab':
      return { state: handleTab(state, key.shiftKey), mode: 'single' }
    case 'Backspace': {
      if (key.shiftKey) return null
      const next = handleBackspace(state)
      return next ? { state: next, mode: 'single' } : null
    }
    default:
      return null
  }
}
