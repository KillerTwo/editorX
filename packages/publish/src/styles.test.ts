import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('publish styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量（组件私有 --ex-pub-* 除外）', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(10)
    for (const name of used) {
      if (name.startsWith('--ex-pub-')) {
        expect(css, name).toContain(`${name}:`)
        continue
      }
      expect(themeCss, name).toContain(`${name}:`)
    }
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('类名以 ex- 开头（状态类 is-* 除外）', () => {
    for (const [, c] of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      expect(c!.startsWith('ex-') || c!.startsWith('is-'), c).toBe(true)
    }
  })

  it('参考几何：内联卡片、操作栏、模态框关键尺寸', () => {
    expect(css).toMatch(/\.ex-pub-card \{[^}]*width: 816px;[^}]*padding: 32px 40px 56px;/)
    expect(css).toMatch(/\.ex-pub \{[^}]*--ex-pub-label-width: 88px;[^}]*--ex-pub-control-width: 648px;[^}]*--ex-pub-row-gap: 32px;/)
    expect(css).toMatch(/\.ex-pub--modal \{[^}]*--ex-pub-label-width: 92px;[^}]*--ex-pub-control-width: 600px;[^}]*--ex-pub-row-gap: 16px;/)
    expect(css).toMatch(/\.ex-pub-bar \{[^}]*position: sticky;[^}]*height: 69px;[^}]*margin-top: 26px;/)
    expect(css).toMatch(/\.ex-pub-bar__inner \{[^}]*width: 1080px;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body \{[^}]*padding: 26px 28px 40px;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__footer \{[^}]*height: 64px;[^}]*padding: 12px 34px 12px 28px;/)
    expect(css).toMatch(/\.ex-pub-mask \{[^}]*background: var\(--ex-color-pub-mask\);/)
  })

  it('必填星号：内联在标签文字之后，模态在标签左侧', () => {
    expect(css).toMatch(/\.ex-pub-item__text \{[^}]*order: 0;/)
    expect(css).toMatch(/\.ex-pub-item__required \{[^}]*order: 1;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__required \{[^}]*position: absolute;[^}]*left: -16px;/)
  })

  it('单选文字：未选/已选颜色按呈现取 token（内联 #606266/#1a1a1a，模态 #555666/#409eff）', () => {
    expect(css).toMatch(/\.ex-pub \{[^}]*--ex-pub-option: var\(--ex-color-pub-label\);[^}]*--ex-pub-option-checked: var\(--ex-color-pub-text\);/)
    expect(css).toMatch(
      /\.ex-pub--modal \{[^}]*--ex-pub-option: var\(--ex-color-pub-option-modal\);[^}]*--ex-pub-option-checked: var\(--ex-color-pub-check-modal\);/,
    )
    expect(css).toMatch(/\.ex-pub \.ex-radio \{[^}]*color: var\(--ex-pub-option\);/)
    expect(css).toMatch(/\.ex-pub \.ex-radio\.is-checked \{[^}]*color: var\(--ex-pub-option-checked\);/)
  })

  it('定时发布弹窗几何（B25–B33）', () => {
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__header \{[^}]*padding: 20px 20px 0;/)
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__body \{[^}]*padding: 0 24px 0 20px;/)
    expect(css).toMatch(/\.ex-pub-schedule__fields \{[^}]*gap: 12px;/)
    expect(css).toMatch(/\.ex-pub-schedule__date,\n\.ex-pub-schedule__time \{[^}]*width: 155px;/)
    expect(css).toMatch(
      /\.ex-pub-schedule \.ex-picker-input\.ex-pub-schedule__date,\n\.ex-pub-schedule \.ex-picker-input\.ex-pub-schedule__time \{ padding-left: 10px; \}/,
    )
    expect(css).toMatch(/\.ex-pub-schedule__cancel \{[^}]*width: 74\.5px;[^}]*height: 32px;/)
    expect(css).toMatch(/\.ex-pub-schedule__confirm \{[^}]*width: 96px;[^}]*height: 32px;/)
    expect(css).toMatch(/\.ex-pub-schedule__hint,\n\.ex-pub-schedule__error \{[^}]*margin: 11px 0 11px;/)
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__close svg \{[^}]*width: 19px;[^}]*stroke-linecap: butt;/)
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__footer \{[^}]*padding: 40px 20px 20px;/)
    expect(css).toMatch(/\.ex-pub-schedule-mask \{[^}]*background: var\(--ex-color-pub-schedule-mask\);/)
  })

  it('定时发布输入框与取消按钮颜色（B29、§3.3）', () => {
    expect(css).toMatch(/\.ex-pub-schedule \.ex-picker-input \{ border-color: var\(--ex-color-pub-border\); \}/)
    expect(css).toMatch(
      /\.ex-pub-schedule \.ex-picker-input:disabled \{ background: var\(--ex-color-pub-disabled-bg\); border-color: var\(--ex-color-pub-disabled-border\); \}/,
    )
    expect(css).toMatch(
      /\.ex-pub-schedule \.ex-picker-input__icon,\n\.ex-pub-schedule \.ex-picker-input\.is-placeholder \.ex-picker-input__value,\n\.ex-pub-schedule \.ex-picker-input\.is-placeholder \.ex-select__value \{ color: var\(--ex-color-pub-placeholder-modal\); \}/,
    )
    expect(css).toMatch(/\.ex-pub-schedule__cancel \{[^}]*color: var\(--ex-color-text-secondary\);/)
    expect(css).not.toMatch(/\.ex-pub-schedule__(date|time)[^{]*\{[^}]*pub-picker-border/)
  })

  it('自建主题根与 .ex-mde-theme 一致，不占布局', () => {
    expect(css).toMatch(/\.ex-pub-theme \{\s*display: contents;\s*\}/)
  })

  it('模态摘要框不可拖拽缩放，内联保留', () => {
    expect(css).toMatch(/\.ex-pub-textarea \{[^}]*resize: vertical;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-textarea \{[^}]*resize: none;/)
  })

  it('组件中用到的每个 ex-pub-* 类名都有样式', () => {
    const dir = import.meta.dirname
    const sources = (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('test-utils'))
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
    const used = new Set([...sources.matchAll(/['"`\s](ex-pub-[\w-]*\w)(?![\w-]*\$)/g)].map((m) => m[1]!))
    const STRUCTURAL = new Set([
      'ex-pub-checkbox',
      'ex-pub-tags',
      'ex-pub-summary',
      'ex-pub-tag-search__section',
      'ex-pub-schedule',
    ])
    expect(used.size).toBeGreaterThan(30)
    for (const name of used) {
      if (STRUCTURAL.has(name)) continue
      expect(css, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`))
    }
  })
})
