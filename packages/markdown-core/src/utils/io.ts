import { escapeHtml } from '../renderer/escape'
import type { RenderResult } from '../types'
import { htmlToMarkdown } from './html-to-markdown'

export const KATEX_CSS_HREF = 'https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css'

export interface ExportHtmlOptions {
  title: string
  css?: string
  katexCssHref?: string
}

export function exportMarkdown(md: string): Blob {
  return new Blob([md], { type: 'text/markdown;charset=utf-8' })
}

export function exportHtml(result: RenderResult, opts: ExportHtmlOptions): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(opts.title)}</title>`,
  ]
  if (result.html.includes('class="katex')) {
    head.push(`<link rel="stylesheet" href="${escapeHtml(opts.katexCssHref ?? KATEX_CSS_HREF)}">`)
  }
  if (opts.css) head.push(`<style>${opts.css.replace(/<\/style/gi, '<\\/style')}</style>`)
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    ...head,
    '</head>',
    '<body>',
    '<article class="ex-preview">',
    result.html,
    '</article>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

const HTML_FILE = /\.html?$/i

export async function importFile(file: File): Promise<string> {
  const text = (await file.text()).replace(/^\uFEFF/, '')
  if (!HTML_FILE.test(file.name) && file.type !== 'text/html') return text
  const body = new DOMParser().parseFromString(text, 'text/html').body.innerHTML
  return htmlToMarkdown(body)
}
