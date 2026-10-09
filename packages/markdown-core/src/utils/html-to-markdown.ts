import { gfm } from '@joplin/turndown-plugin-gfm'
import TurndownService from 'turndown'
import { decodeBase64Utf8 } from '../renderer/base64'

function decode(value: string | null): string {
  if (!value) return ''
  try {
    return decodeBase64Utf8(value)
  } catch {
    return value
  }
}

/**
 * Empty placeholders make their section wrapper "blank" to turndown, which would drop the whole
 * section before any rule sees the block, so ex blocks become ordinary fenced code beforehand.
 */
function replaceExBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('div[data-ex-embed], div[data-ex-diagram]').forEach((node) => {
    const [info, source] = node.hasAttribute('data-ex-embed')
      ? [`ex-embed:${node.getAttribute('data-ex-embed') ?? ''}`, decode(node.getAttribute('data-ex-payload'))]
      : [hasClass(node, 'ex-flowchart') ? 'flow' : 'mermaid', decode(node.getAttribute('data-ex-diagram'))]
    const doc = root.ownerDocument
    const pre = doc.createElement('pre')
    const code = doc.createElement('code')
    code.className = `language-${info}`
    code.textContent = source
    pre.appendChild(code)
    node.replaceWith(pre)
  })
}

function hasClass(node: HTMLElement, name: string): boolean {
  return (node.getAttribute('class') ?? '').split(/\s+/).includes(name)
}

function footnoteNumber(href: string | null): string {
  return (href ?? '').replace(/^#fn/, '')
}

function footnotesMarkdown(td: TurndownService, node: HTMLElement): string {
  const lines = Array.from(node.querySelectorAll('li.footnote-item')).map((item) => {
    const clone = item.cloneNode(true) as HTMLElement
    clone.querySelectorAll('a.footnote-backref').forEach((backref) => backref.remove())
    const body = td.turndown(clone.innerHTML).trim().replace(/\n/g, '\n    ')
    return `[^${item.id.replace(/^fn/, '')}]: ${body}`
  })
  return `\n\n${lines.join('\n')}\n\n`
}

function texOf(node: HTMLElement): string {
  const annotation = node.querySelector('annotation[encoding="application/x-tex"]')
  return (annotation?.textContent ?? node.textContent ?? '').trim()
}

let service: TurndownService | null = null

function getService(): TurndownService {
  if (service) return service
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
  })
  td.use(gfm)
  td.remove(['script', 'style', 'noscript'])

  td.addRule('exToc', {
    filter: (node) => node.nodeName === 'DIV' && hasClass(node, 'ex-toc'),
    replacement: (_content, node) => {
      const title = (node as HTMLElement).querySelector('p.ex-toc-title')?.textContent?.trim()
      return title ? `\n\n@[TOC](${title})\n\n` : '\n\n[TOC]\n\n'
    },
  })
  td.addRule('footnoteRef', {
    filter: (node) => node.nodeName === 'SUP' && hasClass(node, 'footnote-ref'),
    replacement: (_content, node) =>
      `[^${footnoteNumber((node as HTMLElement).querySelector('a')?.getAttribute('href') ?? null)}]`,
  })
  td.addRule('exFootnotes', {
    filter: (node) => node.nodeName === 'DIV' && hasClass(node, 'ex-footnotes'),
    replacement: (_content, node) => footnotesMarkdown(td, node as HTMLElement),
  })
  td.addRule('katexDisplay', {
    filter: (node) => node.nodeName === 'SPAN' && hasClass(node, 'katex-display'),
    replacement: (_content, node) => `\n\n$$\n${texOf(node as HTMLElement)}\n$$\n\n`,
  })
  td.addRule('katexInline', {
    filter: (node) => node.nodeName === 'SPAN' && hasClass(node, 'katex'),
    replacement: (_content, node) => `$${texOf(node as HTMLElement)}$`,
  })
  td.addRule('strikethrough', {
    filter: (node) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
    replacement: (content) => `~~${content}~~`,
  })
  td.addRule('taskCheckbox', {
    filter: (node) => node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
    replacement: (_content, node) => ((node as HTMLElement).hasAttribute('checked') ? '[x] ' : '[ ] '),
  })
  td.addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      const parent = node.parentNode as HTMLElement | null
      let prefix = '- '
      if (parent?.nodeName === 'OL') {
        const parsed = Number.parseInt(parent.getAttribute('start') ?? '', 10)
        const start = Number.isNaN(parsed) ? 1 : parsed
        prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `
      }
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/^\[([ x])\] +/, '[$1] ')
        .replace(/\n/gm, `\n${' '.repeat(prefix.length)}`)
      return prefix + body + (node.nextSibling && !body.endsWith('\n') ? '\n' : '')
    },
  })
  service = td
  return td
}

export function htmlToMarkdown(html: string): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  replaceExBlocks(body)
  return getService().turndown(body).trim()
}
