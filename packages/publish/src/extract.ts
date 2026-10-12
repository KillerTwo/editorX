import type { EditorDocument } from '@editorx/toolbar'
import { sliceChars, SUMMARY_MAX } from './validate'

const UPLOADING_PREFIX = 'ex-uploading://'
const BLOCK_END = /<\/(?:p|div|h[1-6]|li|blockquote|pre|tr|td|th|figcaption|section|article)>|<br\s*\/?>/gi
const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' }

export function htmlToText(html: string): string {
  if (!html) return ''
  const spaced = html.replace(BLOCK_END, '$& ')
  let text: string
  if (typeof DOMParser === 'undefined') {
    text = spaced
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(?:nbsp|lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity] ?? entity)
  } else {
    const doc = new DOMParser().parseFromString(spaced, 'text/html')
    doc.querySelectorAll('script, style').forEach((node) => node.remove())
    text = doc.body.textContent ?? ''
  }
  return text.replace(/\s+/g, ' ').trim()
}

export function extractSummary(doc: Pick<EditorDocument, 'html'> | undefined, max = SUMMARY_MAX): string {
  return doc ? sliceChars(htmlToText(doc.html), max) : ''
}

export function extractImages(html: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/<img\b[^>]*?[\s"']src\s*=\s*(["'])(.*?)\1/gi)) {
    const src = (match[2] ?? '').replace(/&amp;/g, '&').trim()
    if (src && !src.startsWith(UPLOADING_PREFIX) && !urls.includes(src)) urls.push(src)
  }
  return urls
}
