import type { Selection } from '@editorx/markdown-core'

const INLINE: ReadonlyArray<readonly [string, RegExp]> = [
  ['bold', /\*\*[^*\n]+?\*\*|__[^_\n]+?__/g],
  ['italic', /(?<![*\w])\*(?!\*)[^*\n]+?\*(?!\*)|(?<![_\w])_(?!_)[^_\n]+?_(?!_)/g],
  ['strikethrough', /~~[^~\n]+?~~/g],
  ['inlineCode', /`[^`\n]+`/g],
  ['mark', /==[^=\n]+?==/g],
  ['superscript', /(?<!\^)\^[^\s^]+\^/g],
  ['subscript', /(?<!~)~[^\s~]+~(?!~)/g],
]

/** 光标所在行的块格式 + 光标所在行内标记（只扫描当前行，按键路径可用） */
export function detectFormats(markdown: string, selection: Selection): Set<string> {
  const formats = new Set<string>()
  const caret = selection.start
  const lineStart = markdown.lastIndexOf('\n', caret - 1) + 1
  const newline = markdown.indexOf('\n', caret)
  const line = markdown.slice(lineStart, newline === -1 ? markdown.length : newline)

  const heading = /^(#{1,6})\s/.exec(line)
  if (heading) {
    formats.add('heading')
    formats.add(`heading${heading[1]!.length}`)
  }
  if (/^\s*>/.test(line)) formats.add('quote')
  const list = /^\s*(?:[-*+]\s+(\[[ xX]\]\s)?|(\d+)[.)]\s)/.exec(line)
  if (list) formats.add(list[2] !== undefined ? 'orderedList' : list[1] ? 'taskList' : 'unorderedList')

  const column = caret - lineStart
  for (const [name, pattern] of INLINE) {
    const re = new RegExp(pattern.source, 'g')
    for (let m = re.exec(line); m; m = re.exec(line)) {
      if (m.index < column && column < m.index + m[0].length) {
        formats.add(name)
        break
      }
    }
  }
  return formats
}

export function formatsKey(formats: ReadonlySet<string>): string {
  return [...formats].sort().join(',')
}
