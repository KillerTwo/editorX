// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type { SourceSection } from './types'

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t\r]*$/
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t\r]|$)/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t\r]*$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t\r]*$/
const NOT_PARAGRAPH = /^ {0,3}(?:[-*+][ \t]|\d{1,9}[.)][ \t]|>)/

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

  let fence: { char: string; length: number } | null = null
  let paragraphStart = -1
  lines.forEach((line, i) => {
    if (fence) {
      const close = FENCE_CLOSE.exec(line)
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length) fence = null
      return
    }
    const open = FENCE_OPEN.exec(line)
    if (open && !(open[1]![0] === '`' && open[2]!.includes('`'))) {
      fence = { char: open[1]![0]!, length: open[1]!.length }
      paragraphStart = -1
      return
    }
    if (ATX_HEADING.test(line)) {
      pushStart(i)
      paragraphStart = -1
      return
    }
    if (line.trim() === '') {
      paragraphStart = -1
      return
    }
    if (paragraphStart >= 0 && SETEXT_UNDERLINE.test(line)) {
      pushStart(paragraphStart)
      paragraphStart = -1
      return
    }
    if (THEMATIC_BREAK.test(line) || NOT_PARAGRAPH.test(line)) {
      paragraphStart = -1
      return
    }
    if (paragraphStart < 0) paragraphStart = i
  })

  return startLines.map((line, k) => {
    const start = lineOffsets[line]!
    const nextLine = startLines[k + 1]
    const end = nextLine === undefined ? md.length : lineOffsets[nextLine]!
    return { text: md.slice(start, end), start, end }
  })
}
