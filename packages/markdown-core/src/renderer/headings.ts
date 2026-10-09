import GithubSlugger from 'github-slugger'
import type { MarkdownIt } from 'markdown-it'
import type { TocItem } from '../types'
import { escapeHtml } from './escape'
import type { HeadingInfo, RenderEnv, Token } from './md-types'

export const HEADING_ID_PLACEHOLDER = 'ex-heading-id-placeholder'

const TOC_MARKER = /^(?:@\[toc\](?:\(([^)\n]*)\))?|\[toc\])$/i
const TOC_PLACEHOLDER = /<div class="ex-toc" data-ex-toc="(\d+)"><\/div>/g

function inlineText(token: Token | undefined): string {
  if (!token) return ''
  if (!token.children) return token.content.trim()
  return token.children
    .map((child) => {
      if (child.type === 'text' || child.type === 'code_inline' || child.type === 'emoji') return child.content
      if (child.type === 'softbreak' || child.type === 'hardbreak') return ' '
      return ''
    })
    .join('')
    .trim()
}

export function headingsPlugin(md: MarkdownIt): void {
  md.core.ruler.after('block', 'ex_toc_placeholder', (state) => {
    const env = state.env as RenderEnv
    const tokens = state.tokens
    for (let i = 0; i + 2 < tokens.length; i++) {
      const open = tokens[i]!
      const inline = tokens[i + 1]!
      if (
        open.type !== 'paragraph_open' ||
        open.level !== 0 ||
        inline.type !== 'inline' ||
        tokens[i + 2]!.type !== 'paragraph_close'
      ) {
        continue
      }
      const match = TOC_MARKER.exec(inline.content.trim())
      if (!match) continue
      const titles = (env.exTocTitles ??= [])
      const block = new state.Token('html_block', '', 0)
      block.content = `<div class="ex-toc" data-ex-toc="${titles.length}"></div>\n`
      block.map = open.map
      titles.push((match[1] ?? '').trim())
      tokens.splice(i, 3, block)
    }
  })

  md.core.ruler.push('ex_heading_collect', (state) => {
    const env = state.env as RenderEnv
    const headings = (env.exHeadings ??= [])
    state.tokens.forEach((token, i) => {
      if (token.type === 'heading_open') {
        headings.push({ level: Number(token.tag.slice(1)), text: inlineText(state.tokens[i + 1]) })
      }
    })
  })

  md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
    tokens[idx]!.attrSet('id', HEADING_ID_PLACEHOLDER)
    return self.renderToken(tokens, idx, options)
  }
}

export function assignHeadingIds(
  htmls: string[],
  headings: HeadingInfo[][],
): { htmls: string[]; toc: TocItem[] } {
  const slugger = new GithubSlugger()
  const toc: TocItem[] = []
  const placeholder = `id="${HEADING_ID_PLACEHOLDER}"`
  const out = htmls.map((html, sectionIndex) => {
    const list = headings[sectionIndex] ?? []
    let k = 0
    return html.replaceAll(placeholder, () => {
      const info = list[k++] ?? { level: 1, text: '' }
      const id = slugger.slug(info.text) || `heading-${toc.length + 1}`
      toc.push({ level: info.level, text: info.text, id })
      return `id="${escapeHtml(id)}"`
    })
  })
  return { htmls: out, toc }
}

export function renderTocHtml(toc: TocItem[]): string {
  let html = ''
  const stack: number[] = []
  for (const item of toc) {
    const top = stack[stack.length - 1]
    if (top === undefined || item.level > top) {
      html += '<ul>'
      stack.push(item.level)
    } else {
      html += '</li>'
      while (stack.length > 1 && item.level < stack[stack.length - 1]!) {
        html += '</ul></li>'
        stack.pop()
      }
    }
    html += `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`
  }
  while (stack.length > 0) {
    html += '</li></ul>'
    stack.pop()
  }
  return html
}

export function fillToc(html: string, titles: string[], toc: TocItem[]): string {
  return html.replace(TOC_PLACEHOLDER, (_match, k: string) => {
    const title = titles[Number(k)] ?? ''
    const titleHtml = title ? `<p class="ex-toc-title">${escapeHtml(title)}</p>` : ''
    return `<div class="ex-toc">${titleHtml}${renderTocHtml(toc)}</div>`
  })
}
