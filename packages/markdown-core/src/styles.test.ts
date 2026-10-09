import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

const THIRD_PARTY = new Set([
  'katex-display',
  'token',
  'comment',
  'prolog',
  'doctype',
  'cdata',
  'keyword',
  'boolean',
  'important',
  'atrule',
  'deleted',
  'string',
  'char',
  'attr-value',
  'regex',
  'url',
  'number',
  'constant',
  'symbol',
  'property',
  'function',
  'class-name',
  'tag',
  'selector',
  'attr-name',
  'builtin',
  'inserted',
  'operator',
  'punctuation',
  'footnotes-sep',
  'footnotes-list',
  'footnote-ref',
  'footnote-backref',
])

describe('markdown-core styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) {
      expect(name.startsWith('--ex-'), name).toBe(true)
      expect(themeCss, name).toContain(`${name}:`)
    }
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('自有类名以 ex- 开头，第三方类名在白名单内', () => {
    const classes = [...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]!)
    for (const c of classes) expect(c.startsWith('ex-') || THIRD_PARTY.has(c), c).toBe(true)
  })

  it('覆盖 grammar 产生的全部 token 类型', () => {
    for (const t of ['heading', 'marker', 'strong', 'em', 'strike', 'mark', 'code', 'fence', 'math', 'math-block', 'link', 'image', 'url', 'blockquote', 'task', 'hr', 'tag', 'comment']) {
      expect(css, t).toContain(`.ex-md-${t}`)
    }
  })

  it('覆盖目录、flowchart.js、脚注与 Mermaid 容器', () => {
    for (const selector of ['.ex-toc', '.ex-toc-title', '.ex-flowchart', '.ex-footnotes', '.ex-mermaid']) {
      expect(css, selector).toContain(selector)
    }
  })
})
