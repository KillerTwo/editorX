import type { EditorEngine, TextState } from '../types'
import {
  codeBlock,
  heading,
  hr,
  math,
  mermaid,
  orderedList,
  quote,
  table,
  taskList,
  toc,
  unorderedList,
} from './block'
import { bold, image, inlineCode, italic, link, strikethrough } from './inline'

export type CommandTransform<A = unknown> = (state: TextState, args?: A) => TextState

export const commands = {
  bold,
  italic,
  strikethrough,
  inlineCode,
  link,
  image,
  heading,
  heading1: (state: TextState) => heading(state, { level: 1 }),
  heading2: (state: TextState) => heading(state, { level: 2 }),
  heading3: (state: TextState) => heading(state, { level: 3 }),
  heading4: (state: TextState) => heading(state, { level: 4 }),
  heading5: (state: TextState) => heading(state, { level: 5 }),
  heading6: (state: TextState) => heading(state, { level: 6 }),
  quote,
  unorderedList,
  orderedList,
  taskList,
  codeBlock,
  table,
  hr,
  math,
  mermaid,
  toc,
}

export type CommandName = keyof typeof commands | 'undo' | 'redo'

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

export function minimalDiff(a: string, b: string): { start: number; end: number; text: string } | null {
  if (a === b) return null
  const max = Math.min(a.length, b.length)
  let prefix = 0
  while (prefix < max && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++
  if (prefix > 0 && isHighSurrogate(a.charCodeAt(prefix - 1))) prefix--
  let suffix = 0
  while (suffix < max - prefix && a.charCodeAt(a.length - 1 - suffix) === b.charCodeAt(b.length - 1 - suffix)) {
    suffix++
  }
  if (suffix > 0 && isLowSurrogate(a.charCodeAt(a.length - suffix))) suffix--
  return { start: prefix, end: a.length - suffix, text: b.slice(prefix, b.length - suffix) }
}

export function runCommand<A>(engine: EditorEngine, transform: CommandTransform<A>, args?: A): void {
  const next = transform({ text: engine.getValue(), selection: engine.getSelection() }, args)
  const diff = minimalDiff(engine.getValue(), next.text)
  if (diff) engine.replace(diff.start, diff.end, diff.text)
  engine.setSelection(next.selection.start, next.selection.end)
  engine.focus()
}

export function execCommand(engine: EditorEngine, name: CommandName, args?: unknown): void {
  if (name === 'undo') {
    engine.undo()
    return
  }
  if (name === 'redo') {
    engine.redo()
    return
  }
  runCommand(engine, commands[name] as CommandTransform<unknown>, args)
}
