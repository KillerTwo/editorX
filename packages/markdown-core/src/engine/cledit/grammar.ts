// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/markdownGrammarSvc.js
import '../../renderer/prism-manual'
import Prism from 'prismjs'

const inline: Prism.Grammar = {
  comment: /<!--[\s\S]*?-->/,
  code: { pattern: /(`+)[^`\n]+?\1/, inside: { marker: /^`+|`+$/ } },
  math: { pattern: /\$[^\s$](?:[^$\n]*[^\s$])?\$/, inside: { marker: /^\$|\$$/ } },
  image: { pattern: /!\[[^\]\n]*\]\([^)\n]*\)/, inside: { marker: /^!\[|\]\(|\)$/ } },
  link: { pattern: /\[[^\]\n]*\]\([^)\n]*\)/, inside: { marker: /^\[|\]\(|\)$/ } },
  url: /<https?:\/\/[^>\s]+>|\bhttps?:\/\/[^\s<>()]+/,
  tag: {
    pattern: /<\/?[a-zA-Z][\w:-]*(?:\s[^<>\n]*)?\/?>/,
    inside: { 'tag-name': { pattern: /(^<\/?)[a-zA-Z][\w:-]*/, lookbehind: true } },
  },
  strong: { pattern: /(\*\*|__)(?=\S)[^\n]*?\S\1/, inside: { marker: /^(?:\*\*|__)|(?:\*\*|__)$/ } },
  strike: { pattern: /~~(?=\S)[^\n]*?\S~~/, inside: { marker: /^~~|~~$/ } },
  mark: { pattern: /==(?=\S)[^\n]*?\S==/, inside: { marker: /^==|==$/ } },
  em: { pattern: /([*_])(?=[^\s*_])[^\n]*?[^\s*_]\1|([*_])[^\s*_]\2/, inside: { marker: /^[*_]|[*_]$/ } },
}

function atxHeading(level: number): Prism.GrammarValue {
  return {
    pattern: new RegExp(`^#{${level}}(?=[ \\t]|$).*$`, 'm'),
    alias: 'heading',
    inside: { marker: /^#+/, ...inline },
  }
}

// RegExps stay unfrozen: Prism writes their `lastIndex` while tokenizing.
function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !(child instanceof RegExp) && !Object.isFrozen(child)) deepFreeze(child)
  }
  return Object.freeze(value)
}

/** Read-only: frozen down to (but excluding) its RegExps. Extend a copy instead of mutating it. */
export const markdownGrammar: Readonly<Prism.Grammar> = deepFreeze<Prism.Grammar>({
  fence: {
    pattern: /^(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?\n\1[ \t]*$|[\s\S]*)/m,
    inside: { marker: /^(?:`{3,}|~{3,}).*$/m },
  },
  'math-block': [
    { pattern: /^\$\$[ \t]*\n[\s\S]*?\n\$\$[ \t]*$/m, inside: { marker: /^\$\$|\$\$$/ } },
    { pattern: /^\$\$.*\$\$[ \t]*$/m, inside: { marker: /^\$\$|\$\$$/ } },
  ],
  // Same marker forms as the renderer's TOC_MARKER (a paragraph that is only `@[TOC](title)` or `[TOC]`)
  toc: { pattern: /^[ \t]{0,3}(?:@\[toc\](?:\([^)\n]*\))?|\[toc\])[ \t]*$/im, inside: inline },
  h1: atxHeading(1),
  h2: atxHeading(2),
  h3: atxHeading(3),
  h4: atxHeading(4),
  h5: atxHeading(5),
  h6: atxHeading(6),
  'setext-h1': { pattern: /^[^\n]+\n=+[ \t]*$/m, alias: 'heading', inside: { marker: /^=+[ \t]*$/m, ...inline } },
  'setext-h2': { pattern: /^[^\n]*\S[^\n]*\n-{2,}[ \t]*$/m, alias: 'heading', inside: { marker: /^-+[ \t]*$/m, ...inline } },
  hr: /^ {0,3}([*_-])(?:[ \t]*\1){2,}[ \t]*$/m,
  blockquote: { pattern: /^ {0,3}>.*$/m, inside: { marker: /^ {0,3}>(?:[ \t]*>)*/, ...inline } },
  list: {
    pattern: /^[ \t]*(?:[*+-]|\d+[.)])[ \t].*$/m,
    inside: {
      task: { pattern: /(^[ \t]*(?:[*+-]|\d+[.)])[ \t]+)\[[ xX]\]/, lookbehind: true },
      marker: /^[ \t]*(?:[*+-]|\d+[.)])/,
      ...inline,
    },
  },
  table: { pattern: /^[ \t]*\|.*$/m, inside: { marker: /\|/, ...inline } },
  'link-def': { pattern: /^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/m, alias: 'link' },
  ...inline,
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serialize(stream: Prism.TokenStream): string {
  if (typeof stream === 'string') return escapeHtml(stream)
  if (Array.isArray(stream)) return stream.map(serialize).join('')
  const aliases = stream.alias ? (Array.isArray(stream.alias) ? stream.alias : [stream.alias]) : []
  const classes = [stream.type, ...aliases].map((c) => `ex-md-${c}`).join(' ')
  return `<span class="${classes}">${serialize(stream.content)}</span>`
}

export function highlightMarkdown(text: string): string {
  return serialize(Prism.tokenize(text, markdownGrammar))
}
