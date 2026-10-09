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

describe('styles.css 层级', () => {
  it('全屏外壳 < 弹出层 < 模态框 < 提示', () => {
    const z = (name: string) => Number(new RegExp(`--ex-z-${name}:\\s*(\\d+);`).exec(mainCss)?.[1])
    const order = ['fullscreen', 'popover', 'modal', 'toast'].map(z)
    for (const value of order) expect(Number.isFinite(value)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(new Set(order).size).toBe(order.length)
  })
})

const MDE_TOKENS = [
  '--ex-color-mde-canvas',
  '--ex-color-mde-chrome-text',
  '--ex-color-mde-tab-bg',
  '--ex-color-mde-tab-active-bg',
  '--ex-color-mde-tab-active-text',
  '--ex-color-mde-divider',
  '--ex-color-mde-status-border',
  '--ex-color-mde-status-text',
  '--ex-color-mde-split-preview-bg',
  '--ex-color-mde-scrollbar',
  '--ex-color-mde-panel-title-bg',
  '--ex-color-mde-rail-active-bg',
  '--ex-color-mde-toc-link',
  '--ex-color-mde-body-text',
  '--ex-color-mde-body-marker',
  '--ex-color-mde-disabled-text',
]

describe('CSDN 外壳 token', () => {
  it.each(MDE_TOKENS)('%s 定义在主块（兜底块一致性由上方用例校验）', (name) => {
    expect(mainTokens.has(name)).toBe(true)
  })

  it('亮色值与参考截图实测一致', () => {
    expect(expected.get('--ex-color-mde-canvas')?.[0]).toBe('#f2f2f2')
    expect(expected.get('--ex-color-mde-tab-active-bg')?.[0]).toBe('#1a1a1a')
    expect(expected.get('--ex-color-mde-split-preview-bg')?.[0]).toBe('#f9f9f9')
    expect(expected.get('--ex-color-mde-rail-active-bg')?.[0]).toBe('#e5f1ff')
  })

  it('暗色值单独定义（CSDN 无暗色主题）', () => {
    expect(expected.get('--ex-color-mde-canvas')?.[1]).toBe('#111214')
    expect(expected.get('--ex-color-mde-tab-active-bg')?.[1]).toBe('#e8e8ed')
    expect(expected.get('--ex-color-mde-split-preview-bg')?.[1]).toBe('#1d1e22')
  })
})

describe('styles.css 主题切换', () => {
  it('切换期间禁用 transition', () => {
    expect(css).toContain('.ex-root[data-ex-theme-switching] *')
    expect(css).toMatch(/\[data-ex-theme-switching\][^{]*\{\s*transition: none !important;/)
  })
})
