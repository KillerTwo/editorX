// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type { TextState } from '../types'

export interface LineEdit {
  remove: number
  insert: string
}

export function lineRange(text: string, start: number, end: number): { start: number; end: number } {
  const from = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end
  const newline = text.indexOf('\n', last)
  return { start: from, end: newline === -1 ? text.length : newline }
}

export function editLinePrefixes(state: TextState, plan: (lines: string[]) => LineEdit[]): TextState {
  const { text, selection } = state
  const range = lineRange(text, selection.start, selection.end)
  const lines = text.slice(range.start, range.end).split('\n')
  const edits = plan(lines)
  const block = lines.map((line, i) => edits[i]!.insert + line.slice(edits[i]!.remove)).join('\n')
  const nextText = text.slice(0, range.start) + block + text.slice(range.end)
  if (selection.start === selection.end) {
    const edit = edits[0]!
    const column = selection.start - range.start
    const caret = range.start + Math.max(edit.insert.length, column - edit.remove + edit.insert.length)
    return { text: nextText, selection: { start: caret, end: caret } }
  }
  return { text: nextText, selection: { start: range.start, end: range.start + block.length } }
}

function runLength(text: string, from: number, step: 1 | -1, ch: string): number {
  let count = 0
  for (let i = step === 1 ? from : from - 1; i >= 0 && i < text.length && text[i] === ch; i += step) count++
  return count
}

export function toggleWrap(state: TextState, marker: string, placeholder: string): TextState {
  const { text } = state
  const { start, end } = state.selection
  const m = marker.length
  const selected = text.slice(start, end)
  const single = m === 1

  const outside =
    start >= m &&
    text.slice(start - m, start) === marker &&
    text.slice(end, end + m) === marker &&
    (!single || (runLength(text, start, -1, marker) % 2 === 1 && runLength(text, end, 1, marker) % 2 === 1))
  if (outside) {
    return {
      text: text.slice(0, start - m) + selected + text.slice(end + m),
      selection: { start: start - m, end: end - m },
    }
  }

  const inside =
    selected.length >= 2 * m &&
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    (!single ||
      (runLength(selected, 0, 1, marker) % 2 === 1 && runLength(selected, selected.length, -1, marker) % 2 === 1))
  if (inside) {
    const inner = selected.slice(m, -m)
    return { text: text.slice(0, start) + inner + text.slice(end), selection: { start, end: start + inner.length } }
  }

  const content = selected || placeholder
  return {
    text: text.slice(0, start) + marker + content + marker + text.slice(end),
    selection: { start: start + m, end: start + m + content.length },
  }
}

export function insertBlock(state: TextState, block: string, select: [number, number]): TextState {
  const { text } = state
  const before = text.slice(0, state.selection.start)
  const after = text.slice(state.selection.end)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const blockStart = before.length + lead.length
  return {
    text: before + lead + block + trail + after,
    selection: { start: blockStart + select[0], end: blockStart + select[1] },
  }
}
