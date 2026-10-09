import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\r\n/g, '\n')

const SUPPORTS_FALLBACK = '@supports not (color: light-dark(#000, #fff))'
const fallbackIndex = css.indexOf(SUPPORTS_FALLBACK)
const mainCss = fallbackIndex === -1 ? css : css.slice(0, fallbackIndex)
const fallbackCss = fallbackIndex === -1 ? '' : css.slice(fallbackIndex)

type TokenMap = Map<string, string>

function parseColorTokens(source: string): TokenMap {
  const map: TokenMap = new Map()
  for (const [, name = '', value = ''] of source.matchAll(/(--ex-color-[\w-]+):\s*([^;]+);/g)) {
    map.set(name, value.trim())
  }
  return map
}

function splitLightDark(value: string): [string, string] {
  const inner = value.slice('light-dark('.length, -1)
  let depth = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()]
  }
  throw new Error(`无法解析 light-dark 值：${value}`)
}

/** 取出 selector 开头的规则块（直到匹配的右花括号）的声明文本 */
function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) return ''
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(source.indexOf('{', start) + 1, i)
  }
  return ''
}

const mainTokens = parseColorTokens(mainCss)
const expected = new Map([...mainTokens].map(([name, value]) => [name, splitLightDark(value)]))

describe('styles.css 主块', () => {
  it('颜色 token 只定义一次，不保留独立的暗色块', () => {
    expect(mainCss.match(/--ex-color-text:/g)).toHaveLength(1)
  })

  it('system 模式通过 color-scheme: light dark 跟随系统', () => {
    expect(mainCss).toContain('color-scheme: light dark')
  })

  it('每个 --ex-color-* 定义的值都以 light-dark( 开头', () => {
    expect(mainTokens.size).toBeGreaterThan(0)
    for (const [name, value] of mainTokens) {
      expect(value, name).toMatch(/^light-dark\(/)
    }
  })
})

describe('styles.css @supports 兜底块', () => {
  it('存在不支持 light-dark() 时的兜底块', () => {
    expect(fallbackIndex).toBeGreaterThan(-1)
  })

  const cases: Array<[string, string, 0 | 1]> = [
    ['亮色（默认 .ex-root）', ".ex-root,\n  .ex-root[data-ex-theme='light']", 0],
    ['暗色（data-ex-theme=dark）', ".ex-root[data-ex-theme='dark']", 1],
    ['暗色（system + prefers-color-scheme: dark）', ".ex-root[data-ex-theme='system']", 1],
  ]

  it.each(cases)('%s 覆盖全部颜色 token 且值与主块 light-dark() 一致', (_label, selector, index) => {
    const scope =
      selector.includes('system') ? ruleBody(fallbackCss, '@media (prefers-color-scheme: dark)') : fallbackCss
    const tokens = parseColorTokens(ruleBody(scope, selector))
    expect([...tokens.keys()].sort()).toEqual([...expected.keys()].sort())
    for (const [name, pair] of expected) {
      expect(tokens.get(name), name).toBe(pair[index])
    }
  })
})
