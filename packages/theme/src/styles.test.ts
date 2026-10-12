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
  if (value.startsWith('var(')) return [value, value]
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
      expect(value, name).toMatch(/^(?:light-dark\(|var\(--ex-color-)/)
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
  '--ex-color-mde-heading-text',
  '--ex-color-mde-list-text',
  '--ex-color-mde-preview-link',
  '--ex-color-mde-preview-rule',
  '--ex-color-mde-disabled-text',
  '--ex-color-mde-toolbar-divider',
  '--ex-color-mde-rail-label',
  '--ex-color-mde-rail-ai-label',
  '--ex-color-mde-badge',
  '--ex-color-mde-toc-empty',
  '--ex-color-mde-toc-empty-link',
  '--ex-color-mde-grip',
  '--ex-color-mde-sync-locate',
  '--ex-color-mde-sync-scroll',
  '--ex-color-mde-draft-bg',
  '--ex-color-mde-ai-from',
  '--ex-color-mde-ai-to',
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
    expect(expected.get('--ex-color-mde-body-marker')?.[0]).toBe('#c7c0c0')
    expect(expected.get('--ex-color-mde-heading-text')?.[0]).toBe('#4f4f4f')
    expect(expected.get('--ex-color-mde-list-text')?.[0]).toBe('#404040')
    expect(expected.get('--ex-color-mde-preview-link')?.[0]).toBe('#4ea1db')
    expect(expected.get('--ex-color-mde-preview-rule')?.[0]).toBe('#dddddd')
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

const PUB_TOKENS: Array<[name: string, light: string, dark: string]> = [
  ['--ex-color-on-primary', '#ffffff', '#ffffff'],
  ['--ex-color-pub-label', '#606266', '#a3a6ad'],
  ['--ex-color-pub-text', '#1a1a1a', '#e8e8ed'],
  ['--ex-color-pub-border', '#dcdfe6', '#4c4d4f'],
  ['--ex-color-pub-tag-border', '#e8e8ee', '#3a3b41'],
  ['--ex-color-pub-upload-border', '#cccccc', '#4c4d4f'],
  ['--ex-color-pub-upload-border-modal', '#dcddde', '#4c4d4f'],
  ['--ex-color-pub-upload-icon', '#cccccc', '#6c6e72'],
  ['--ex-color-pub-upload-icon-modal', '#a6a7a6', '#8d9095'],
  ['--ex-color-pub-upload-text', '#999999', '#8d9095'],
  ['--ex-color-pub-placeholder', '#a8abb2', '#6c6e72'],
  ['--ex-color-pub-placeholder-modal', '#c0c4cc', '#6c6e72'],
  ['--ex-color-pub-counter', '#909399', '#8d9095'],
  ['--ex-color-pub-hint', '#999999', '#8d9095'],
  ['--ex-color-pub-hint-modal', '#cccccc', '#6c6e72'],
  ['--ex-color-pub-fill', '#f2f2f2', '#2e2f34'],
  ['--ex-color-pub-check', '#006fff', '#3b8eff'],
  ['--ex-color-pub-check-modal', '#409eff', '#409eff'],
  ['--ex-color-pub-option-modal', '#555666', '#b8b9c4'],
  ['--ex-color-pub-link', '#006fff', '#5aa0ff'],
  ['--ex-color-pub-link-modal', '#4ea1db', '#6cb6ea'],
  ['--ex-color-pub-verified', '#73bd88', '#73bd88'],
  ['--ex-color-pub-disabled-bg', '#f5f7fa', '#26272b'],
  ['--ex-color-pub-disabled-border', '#e4e7ed', '#363637'],
  ['--ex-color-pub-select-text-modal', '#808080', '#a3a6ad'],
  ['--ex-color-pub-select-arrow', '#a9abb3', '#6c6e72'],
  ['--ex-color-pub-select-arrow-modal', '#c0c4cc', '#6c6e72'],
  ['--ex-color-pub-sublabel', '#666666', '#a3a6ad'],
  ['--ex-color-pub-bar-border', '#e8e8e8', '#2e2f34'],
  ['--ex-color-pub-button-border', '#e5e5e5', '#3a3b41'],
  ['--ex-color-pub-button-border-modal', '#e8e8ed', '#3a3b41'],
  ['--ex-color-pub-chevron', '#797979', '#8d9095'],
  ['--ex-color-pub-title', '#000000', '#f2f2f5'],
  ['--ex-color-pub-close', '#8c8c8c', '#8d9095'],
  ['--ex-color-pub-thumb-border', '#e5e5e5', '#3a3b41'],
  ['--ex-color-pub-mask', 'rgba(0, 0, 0, 0.19)', 'rgba(0, 0, 0, 0.6)'],
  ['--ex-color-pub-footer-shadow', 'rgba(0, 0, 0, 0.04)', 'rgba(0, 0, 0, 0.4)'],
  ['--ex-color-pub-select-border-modal', '#e0e0e0', '#4c4d4f'],
  ['--ex-color-pub-option-selected', '#409eff', '#409eff'],
  ['--ex-color-pub-dropdown-border', '#e4e7ed', '#363637'],
  ['--ex-color-pub-dropdown-shadow', 'rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.5)'],
  ['--ex-color-pub-scrollbar-thumb', '#cfcfcf', '#4a4b52'],
  ['--ex-color-pub-schedule-mask', 'rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.7)'],
  ['--ex-color-pub-dialog-text', '#222226', '#e8e8ed'],
  ['--ex-color-pub-dialog-close', '#909399', '#8d9095'],
  ['--ex-color-pub-picker-border', '#e2e2e2', '#3a3b41'],
  ['--ex-color-pub-picker-title', '#404040', '#dcdde3'],
  ['--ex-color-pub-picker-category', '#777888', '#a3a6ad'],
  ['--ex-color-pub-picker-active', '#4e7a9a', '#8fb4cf'],
  ['--ex-color-pub-picker-option-bg', '#eaf2f6', '#24303a'],
]

describe('发布面板 token', () => {
  it.each(PUB_TOKENS)('%s 亮色 %s / 暗色 %s（亮色为参考截图实测值）', (name, light, dark) => {
    expect(expected.get(name)).toEqual([light, dark])
  })
})

const MDE_NEW: Array<[name: string, light: string, dark: string]> = [
  ['--ex-color-mde-toolbar-divider', '#d9d9d9', '#3a3b41'],
  ['--ex-color-mde-rail-label', '#999999', '#7d7e8a'],
  ['--ex-color-mde-rail-ai-label', '#9a9a9a', '#7d7e8a'],
  ['--ex-color-mde-badge', '#d9011c', '#e5323f'],
  ['--ex-color-mde-toc-empty', '#616266', '#9a9ba6'],
  ['--ex-color-mde-toc-empty-link', '#277dcc', '#5aa0ff'],
  ['--ex-color-mde-grip', '#cccccc', '#4a4b52'],
  ['--ex-color-mde-sync-locate', '#9f9f9f', '#7d7e8a'],
  ['--ex-color-mde-sync-scroll', '#555666', '#b8b9c4'],
  ['--ex-color-mde-draft-bg', '#f2f2f2', '#2a2b30'],
  ['--ex-color-mde-ai-from', '#6660ff', '#8580ff'],
  ['--ex-color-mde-ai-to', '#bc7bf7', '#c993fa'],
  ['--ex-color-quota-border', '#ffd9ca', '#5c3326'],
  ['--ex-color-quota-bg', '#fff6f0', '#2e211c'],
  ['--ex-color-tag-primary-bg', '#f4f8fc', '#1d2a38'],
  ['--ex-color-tag-primary-border', '#cee0f4', '#2b4058'],
  ['--ex-color-tag-primary-text', '#277dcc', '#6cb6ea'],
  ['--ex-color-tag-primary-close', '#3585cf', '#6cb6ea'],
]

describe('参考图对齐新增 token（mac 参考图实测亮色；暗色为推断值）', () => {
  it.each(MDE_NEW)('%s 亮色 %s / 暗色 %s', (name, light, dark) => {
    expect(expected.get(name)).toEqual([light, dark])
  })

  it('Helvetica 字体栈只定义在主 .ex-root 块', () => {
    expect(mainCss).toContain(
      "--ex-font-family-helvetica: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;",
    )
    expect(fallbackCss).not.toContain('--ex-font-family-helvetica')
  })
})

const RTE_ALIAS: Array<[string, string]> = [
  ['--ex-color-rte-canvas', 'var(--ex-color-bg)'],
  ['--ex-color-rte-paper', 'var(--ex-color-surface)'],
  ['--ex-color-rte-ink', 'var(--ex-color-text-secondary)'],
  ['--ex-color-rte-toc-title', 'var(--ex-color-text)'],
  ['--ex-color-rte-chrome', 'var(--ex-color-mde-chrome-text)'],
  ['--ex-color-rte-body', 'var(--ex-color-mde-body-text)'],
  ['--ex-color-rte-placeholder', 'var(--ex-color-mde-disabled-text)'],
  ['--ex-color-rte-title-placeholder', 'var(--ex-color-pub-placeholder)'],
  ['--ex-color-rte-title', 'var(--ex-color-pub-label)'],
  ['--ex-color-rte-band-border', 'var(--ex-color-pub-bar-border)'],
  ['--ex-color-rte-wand', 'var(--ex-color-mde-divider)'],
  ['--ex-color-rte-heading', 'var(--ex-color-mde-heading-text)'],
  ['--ex-color-rte-list', 'var(--ex-color-mde-list-text)'],
  ['--ex-color-rte-link', 'var(--ex-color-mde-preview-link)'],
  ['--ex-color-rte-rule', 'var(--ex-color-mde-preview-rule)'],
]

describe('富文本 token', () => {
  it.each(RTE_ALIAS)('%s 别名已有颜色', (name, value) => {
    expect(mainTokens.get(name)).toBe(value)
  })

  it('新测到的颜色有亮色字面量，暗色为推断值', () => {
    expect(expected.get('--ex-color-rte-band')?.[0]).toBe('#f5f5f5')
    expect(expected.get('--ex-color-rte-icon-disabled')?.[0]).toBe('#b5b5bc')
    expect(expected.get('--ex-color-rte-caret')?.[0]).toBe('#484848')
    expect(expected.get('--ex-color-rte-separator')?.[0]).toBe('#dbdbdb')
    expect(expected.get('--ex-color-rte-divider')?.[0]).toBe('#e8e7e8')
    expect(expected.get('--ex-color-rte-hover')?.[0]).toBe('rgba(0, 0, 0, 0.04)')
    expect(expected.get('--ex-color-rte-toc-shadow')?.[0]).toBe('rgba(0, 0, 0, 0.05)')
    expect(expected.get('--ex-color-rte-drawer-shadow')?.[0]).toBe('rgba(0, 0, 0, 0.06)')
    expect(expected.get('--ex-color-rte-band')?.[1]).toBe('#1d1e22')
    expect(expected.get('--ex-color-rte-hover')?.[1]).toBe('rgba(255, 255, 255, 0.06)')
  })
})
