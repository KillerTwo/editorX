import type { TextState } from '../types'
import { editLinePrefixes, insertBlock, type LineEdit, lineRange, toggleWrap } from './helpers'

export interface HeadingArgs {
  level?: 1 | 2 | 3 | 4 | 5 | 6
}
export interface CodeBlockArgs {
  lang?: string
}
export interface TableArgs {
  rows?: number
  cols?: number
}
export interface MathArgs {
  inline?: boolean
}

export const MERMAID_TEMPLATES = {
  flowchart: 'flowchart LR\n  A[开始] --> B{条件}\n  B -->|是| C[结束]\n  B -->|否| A',
  sequence: 'sequenceDiagram\n  Alice->>Bob: 你好\n  Bob-->>Alice: 收到',
  gantt:
    'gantt\n  title 项目计划\n  dateFormat YYYY-MM-DD\n  section 阶段一\n  任务A :a1, 2026-01-01, 7d\n  任务B :after a1, 5d',
  class: 'classDiagram\n  Animal <|-- Dog\n  Animal : +String name\n  Dog : +bark()',
} as const

export interface MermaidArgs {
  type?: keyof typeof MERMAID_TEMPLATES
}

const HEADING = /^#{1,6}(?:[ \t]+|$)/
const QUOTE = /^>[ \t]?/
const TASK = /^[-*+][ \t]+\[[ xX]\][ \t]+/
const UL = /^[-*+][ \t]+/
const OL = /^\d{1,9}[.)][ \t]+/
const ANY_LIST = /^(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/

const NO_EDIT: LineEdit = { remove: 0, insert: '' }

function prefixLength(re: RegExp, line: string): number {
  return re.exec(line)?.[0].length ?? 0
}

function targetLines(lines: string[]): number[] {
  if (lines.length === 1) return [0]
  return lines.flatMap((line, i) => (line.trim() === '' ? [] : [i]))
}

function toggleLines(
  state: TextState,
  isOn: (line: string) => boolean,
  off: RegExp,
  on: (line: string, n: number) => LineEdit,
): TextState {
  return editLinePrefixes(state, (lines) => {
    const targets = targetLines(lines)
    const allOn = targets.every((i) => isOn(lines[i]!))
    let n = 0
    return lines.map((line, i) => {
      if (!targets.includes(i)) return NO_EDIT
      if (allOn) return { remove: prefixLength(off, line), insert: '' }
      return on(line, n++)
    })
  })
}

export function heading(state: TextState, args?: HeadingArgs): TextState {
  const level = args?.level ?? 1
  return toggleLines(
    state,
    (line) => HEADING.exec(line)?.[0].trim().length === level,
    HEADING,
    (line) => ({ remove: prefixLength(HEADING, line), insert: `${'#'.repeat(level)} ` }),
  )
}

export const quote = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => QUOTE.test(line),
    QUOTE,
    (line) => (QUOTE.test(line) ? NO_EDIT : { remove: 0, insert: '> ' }),
  )

export const unorderedList = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => UL.test(line) && !TASK.test(line),
    ANY_LIST,
    (line) => ({ remove: prefixLength(ANY_LIST, line), insert: '- ' }),
  )

export const orderedList = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => OL.test(line),
    ANY_LIST,
    (line, n) => ({ remove: prefixLength(ANY_LIST, line), insert: `${n + 1}. ` }),
  )

export const taskList = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => TASK.test(line),
    ANY_LIST,
    (line) => ({ remove: prefixLength(ANY_LIST, line), insert: '- [ ] ' }),
  )

export function codeBlock(state: TextState, args?: CodeBlockArgs): TextState {
  const { text, selection } = state
  const range = selection.start === selection.end ? selection : lineRange(text, selection.start, selection.end)
  const content = text.slice(range.start, range.end)
  const open = `\`\`\`${args?.lang ?? ''}`
  return insertBlock({ text, selection: range }, `${open}\n${content}\n\`\`\``, [
    open.length + 1,
    open.length + 1 + content.length,
  ])
}

function clampCount(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.floor(value !== undefined && Number.isFinite(value) ? value : fallback))
}

export function table(state: TextState, args?: TableArgs): TextState {
  const rows = clampCount(args?.rows, 2)
  const cols = clampCount(args?.cols, 3)
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`
  const header = row(Array.from({ length: cols }, (_, i) => `列${i + 1}`))
  const lines = [header, row(Array<string>(cols).fill('---')), ...Array<string>(rows).fill(row(Array<string>(cols).fill('')))]
  return insertBlock(state, lines.join('\n'), [2, 2 + '列1'.length])
}

export const hr = (state: TextState): TextState => insertBlock(state, '---', [3, 3])

export function math(state: TextState, args?: MathArgs): TextState {
  if (args?.inline) return toggleWrap(state, '$', 'E=mc^2')
  const content = state.text.slice(state.selection.start, state.selection.end) || 'E=mc^2'
  return insertBlock(state, `$$\n${content}\n$$`, [3, 3 + content.length])
}

export function mermaid(state: TextState, args?: MermaidArgs): TextState {
  const template = MERMAID_TEMPLATES[args?.type ?? 'flowchart']
  const open = '```mermaid\n'
  return insertBlock(state, `${open}${template}\n\`\`\``, [open.length, open.length + template.length])
}

const TOC_TITLE = '这里写目录标题'

export const toc = (state: TextState): TextState =>
  insertBlock(state, `@[TOC](${TOC_TITLE})`, ['@[TOC]('.length, '@[TOC]('.length + TOC_TITLE.length])
