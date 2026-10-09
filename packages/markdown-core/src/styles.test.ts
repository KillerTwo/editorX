import { readFileSync } from 'node:fs'
import path from 'node:path'
import type Prism from 'prismjs'
import { describe, expect, it } from 'vitest'
import { markdownGrammar } from './engine/cledit/grammar'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

const ruleBody = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|[},]\\s*)${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(css)
  return match?.[1] ?? ''
}

// Container tokens whose own span carries no style; only their inner tokens are coloured
const UNSTYLED_GRAMMAR_TOKENS = new Set(['table'])

function grammarClasses(grammar: Prism.Grammar, out = new Set<string>()): Set<string> {
  for (const [key, value] of Object.entries(grammar)) {
    out.add(/^(?:h[1-6]|setext-h[12])$/.test(key) ? 'heading' : key === 'link-def' ? 'link' : key)
    for (const def of Array.isArray(value) ? value : [value]) {
      if (def && typeof def === 'object' && !(def instanceof RegExp) && def.inside) grammarClasses(def.inside, out)
    }
  }
  return out
}

const THIRD_PARTY = new Set([
  'katex-display',
  'katex-error',
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
    const tokens = grammarClasses(markdownGrammar)
    expect(tokens.has('heading') && tokens.has('marker') && tokens.has('task')).toBe(true)
    for (const t of tokens) {
      if (UNSTYLED_GRAMMAR_TOKENS.has(t)) continue
      expect(css, t).toMatch(new RegExp(`\\.ex-md-${t}(?![\\w-])`))
    }
  })

  it('覆盖编辑区容器与占位符', () => {
    for (const selector of ['.ex-editor', '.ex-editor-content', '.ex-editor-content[data-empty]::before']) {
      expect(css, selector).toContain(selector)
    }
    expect(ruleBody('.ex-editor-content[data-empty]::before')).toContain('content: attr(data-placeholder)')
  })

  it('编辑区段只跳过屏外渲染，不改变排版（DOM 文本不变式依赖它）', () => {
    const body = ruleBody('.ex-editor-section')
    expect(body).toContain('content-visibility: auto')
    const props = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])
    for (const p of props) expect(['content-visibility', 'contain-intrinsic-size'], p).toContain(p)
  })

  it('任务列表使用渲染器类名且不影响混合列表', () => {
    expect(ruleBody('.ex-preview .ex-task-list-item')).toContain('list-style: none')
    expect(ruleBody('.ex-preview .ex-task-list-item-checkbox')).toContain('margin')
    expect(css).not.toMatch(/:has\(/)
    expect(css).not.toMatch(/input\[type='checkbox'\]/)
  })

  it('预览首个元素无上外边距', () => {
    expect(ruleBody('.ex-preview > .ex-preview-section:first-child > :first-child')).toContain('margin-top: 0')
  })

  it('多行代码块高亮不铺背景', () => {
    const fence = ruleBody('.ex-md-fence')
    expect(fence).toContain('color:')
    expect(fence).not.toMatch(/background|border-radius/)
    expect(ruleBody('.ex-md-code')).toContain('background:')
  })

  it('覆盖目录、flowchart.js、脚注与 Mermaid 容器', () => {
    for (const selector of ['.ex-toc', '.ex-toc-title', '.ex-flowchart', '.ex-footnotes', '.ex-mermaid']) {
      expect(css, selector).toContain(selector)
    }
  })

  it('块级包装与错误态', () => {
    for (const selector of ['.ex-preview .ex-math-block', '.ex-preview .ex-embed']) {
      expect(ruleBody(selector), selector).toContain('overflow-x: auto')
    }
    for (const selector of ['.ex-preview .katex-error', '.ex-preview .ex-mermaid-error', '.ex-preview .ex-flowchart-error']) {
      expect(ruleBody(selector), selector).toContain('color: var(--ex-color-error)')
    }
  })
})
