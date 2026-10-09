const LINK_OR_ABBR_DEFINITION = /^ {0,3}\*?\[(?!\^)[^\]\n]+\]:/
const FOOTNOTE_DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/
const CONTINUATION_LINE = /^(?: {4}|\t)\S/
const INDENT = /^(?: {4}|\t)/
const FENCE_LINE = /^ {0,3}(?:`{3,}|~{3,})/

export const FOOTNOTE_STUB = 'ex-footnote'

function forEachLineOutsideFences(md: string, visit: (line: string, index: number, lines: string[]) => void): void {
  const lines = md.split('\n')
  let inFence = false
  lines.forEach((line, index) => {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence
      return
    }
    if (!inFence) visit(line, index, lines)
  })
}

export function collectDefinitions(md: string): string {
  const out: string[] = []
  let inDefinition = false
  forEachLineOutsideFences(md, (line) => {
    const footnote = FOOTNOTE_DEFINITION.exec(line)
    if (footnote) {
      out.push(`[^${footnote[1]}]: ${FOOTNOTE_STUB}`)
      inDefinition = false
    } else if (LINK_OR_ABBR_DEFINITION.test(line)) {
      out.push(line)
      inDefinition = true
    } else if (inDefinition && CONTINUATION_LINE.test(line)) {
      out.push(line)
    } else {
      inDefinition = false
    }
  })
  return out.join('\n')
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
