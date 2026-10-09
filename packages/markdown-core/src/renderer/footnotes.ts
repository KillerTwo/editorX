import type { MarkdownIt } from 'markdown-it'
import footnote from 'markdown-it-footnote'
import type { RenderEnv } from './md-types'

export interface FootnoteEntry {
  label: string
  n: number
  count: number
}

interface FootnoteParseEnv extends RenderEnv {
  footnotes?: { list?: Array<{ label?: string }> }
}

const FOOTNOTE_REF_PLACEHOLDER = /ex-fn-ref-(\d+)-(href|id|num)/g

export function footnotesPlugin(md: MarkdownIt): void {
  md.use(footnote)
  md.inline.ruler.disable(['footnote_inline'])

  md.core.ruler.after('footnote_tail', 'ex_footnote_strip', (state) => {
    const start = state.tokens.findIndex((token) => token.type === 'footnote_block_open')
    if (start === -1) return
    const end = state.tokens.findIndex((token) => token.type === 'footnote_block_close')
    state.tokens.splice(start, end - start + 1)
  })

  md.renderer.rules.footnote_ref = (tokens, idx, _options, env: FootnoteParseEnv = {}) => {
    const id = (tokens[idx]!.meta as { id: number }).id
    const label = env.footnotes?.list?.[id]?.label ?? `#${id}`
    const refs = (env.exFootnoteRefs ??= [])
    const k = refs.push(label) - 1
    return `<sup class="footnote-ref"><a href="#ex-fn-ref-${k}-href" id="ex-fn-ref-${k}-id">[ex-fn-ref-${k}-num]</a></sup>`
  }
}

export function assignFootnotes(htmls: string[], refs: string[][]): { htmls: string[]; footnotes: FootnoteEntry[] } {
  const entries = new Map<string, FootnoteEntry>()
  const out = htmls.map((html, sectionIndex) => {
    const resolved = (refs[sectionIndex] ?? []).map((label) => {
      let entry = entries.get(label)
      if (!entry) {
        entry = { label, n: entries.size + 1, count: 0 }
        entries.set(label, entry)
      }
      return { n: entry.n, sub: entry.count++ }
    })
    return html.replace(FOOTNOTE_REF_PLACEHOLDER, (match, k: string, part: string) => {
      const ref = resolved[Number(k)]
      if (!ref) return match
      if (part === 'href') return `fn${ref.n}`
      if (part === 'id') return ref.sub ? `fnref${ref.n}:${ref.sub}` : `fnref${ref.n}`
      return String(ref.n)
    })
  })
  return { htmls: out, footnotes: [...entries.values()] }
}

export function renderFootnotesHtml(
  footnotes: FootnoteEntry[],
  defs: Map<string, string>,
  renderBody: (md: string) => string,
): string {
  if (footnotes.length === 0) return ''
  const items = footnotes.map(({ label, n, count }) => {
    const backrefs = Array.from(
      { length: count },
      (_, sub) => `<a href="#fnref${n}${sub ? `:${sub}` : ''}" class="footnote-backref">↩︎</a>`,
    ).join(' ')
    const body = renderBody(defs.get(label) ?? '')
    const content = body.endsWith('</p>\n') ? `${body.slice(0, -5)} ${backrefs}</p>\n` : `${body}${backrefs}`
    return `<li id="fn${n}" class="footnote-item">${content}</li>`
  })
  return `<div class="ex-footnotes"><hr class="footnotes-sep"><section class="footnotes"><ol class="footnotes-list">${items.join('')}</ol></section></div>`
}
