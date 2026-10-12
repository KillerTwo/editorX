const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/gu
const WHITESPACE = /\s/gu

export function countRichTextChars(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove())
  const text = doc.body.textContent ?? ''
  return Array.from(text.replace(INVISIBLE, '').replace(WHITESPACE, '')).length
}
