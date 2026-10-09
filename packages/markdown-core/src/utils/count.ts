export interface WordCount {
  words: number
  chars: number
  lines: number
}

const CJK_CHAR =
  '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}' +
  '\\u3001-\\u303F\\uFF01-\\uFF0F\\uFF1A-\\uFF20\\uFF3B-\\uFF40\\uFF5B-\\uFF65' +
  '\\u2018\\u2019\\u201C\\u201D\\u2026\\u2014'
const LATIN_OR_DIGIT = '\\p{Script=Latin}0-9\\uFF10-\\uFF19'
const WORD = new RegExp(`[${CJK_CHAR}]|[${LATIN_OR_DIGIT}]+`, 'gu')
const WHITESPACE = /\s/gu

export function countWords(md: string): WordCount {
  return {
    words: md.match(WORD)?.length ?? 0,
    chars: Array.from(md.replace(WHITESPACE, '')).length,
    lines: md.split('\n').length,
  }
}

export interface HtmlCount {
  words: number
  paragraphs: number
}

const IGNORED = 'script, style, .katex-mathml'
const PARAGRAPHS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr'

export function countHtml(html: string): HtmlCount {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll(IGNORED).forEach((node) => node.remove())

  const texts: string[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node.textContent ?? '')

  const paragraphs = Array.from(doc.body.querySelectorAll(PARAGRAPHS)).filter(
    (el) => (el.textContent ?? '').trim() !== '',
  ).length
  return { words: texts.join(' ').match(WORD)?.length ?? 0, paragraphs }
}
