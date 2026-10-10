export interface WordCount {
  words: number
  chars: number
  lines: number
}

const CJK_CHAR =
  '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\u30FB\\u30FC' +
  '\\u3001-\\u303F\\uFF01-\\uFF0F\\uFF1A-\\uFF20\\uFF3B-\\uFF40\\uFF5B-\\uFF65' +
  '\\u2018\\u2019\\u201C\\u201D\\u2026\\u2014'
const LATIN_OR_DIGIT = '\\p{Script=Latin}0-9\\uFF10-\\uFF19'
const WORD = new RegExp(`[${CJK_CHAR}]|[${LATIN_OR_DIGIT}]+`, 'gu')
const WHITESPACE = /\s/gu
// KaTeX emits U+200B after fractions and subscripts (`.vlist-s`).
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/gu

export function countWords(md: string): WordCount {
  return {
    words: md.match(WORD)?.length ?? 0,
    chars: Array.from(md.replace(WHITESPACE, '')).length,
    lines: md.split('\n').length,
  }
}

export interface HtmlCount {
  words: number
  /** 渲染文本中的非空白字符数（码点） */
  chars: number
  paragraphs: number
}

const IGNORED = 'script, style, noscript, .katex-mathml, .ex-toc, .footnote-backref, sup.footnote-ref'
const PARAGRAPHS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr'
const WORD_BOUNDARIES =
  'address, article, aside, blockquote, br, caption, dd, details, div, dl, dt, figcaption, figure, footer, ' +
  'h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, summary, table, tbody, td, tfoot, ' +
  'th, thead, tr, ul'

export function countHtml(html: string): HtmlCount {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll(IGNORED).forEach((node) => node.remove())

  const paragraphs = Array.from(doc.body.querySelectorAll(PARAGRAPHS)).filter(
    (el) => (el.textContent ?? '').trim() !== '',
  ).length

  doc.body.querySelectorAll(WORD_BOUNDARIES).forEach((el) => {
    el.before(' ')
    el.after(' ')
  })
  const text = doc.body.textContent.replace(INVISIBLE, '')
  return {
    words: text.match(WORD)?.length ?? 0,
    chars: Array.from(text.replace(WHITESPACE, '')).length,
    paragraphs,
  }
}
