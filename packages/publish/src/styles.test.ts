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
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body \{[^}]*padding: 26px 20px 40px 28px;[^}]*scrollbar-gutter: stable;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__footer \{[^}]*height: 64px;[^}]*padding: 12px 34px 12px 28px;/)
    expect(css).toMatch(/\.ex-pub-mask \{[^}]*background: var\(--ex-color-pub-mask\);/)
  })

  it('必填星号：内联在标签文字之后，模态在标签左侧', () => {
    expect(css).toMatch(/\.ex-pub-item__text \{[^}]*order: 0;/)
    expect(css).toMatch(/\.ex-pub-item__required \{[^}]*order: 1;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__required \{[^}]*position: absolute;[^}]*top: -3\.5px;[^}]*left: -16px;/)
  })

  it('mac 参考图修正（B01–B08、B12、B13、B35、B36）', () => {
    expect(css).toMatch(/\.ex-pub \{[^}]*font-family: var\(--ex-font-family-helvetica\);/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body::-webkit-scrollbar \{ width: 11px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__control \{[^}]*flex: 1;[^}]*width: auto;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-select--wide \{[^}]*flex: 1;[^}]*width: auto;[^}]*margin-right: 32px;/)
    expect(css).toMatch(/\.ex-pub--modal \{[^}]*--ex-pub-summary-height: 57px;/)
    expect(css).not.toMatch(/\.ex-pub--modal \.ex-pub-summary__extract \{ margin-bottom: 1px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \[data-field='multiPlatform'\] \{ min-height: 32px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-textarea \{[^}]*padding: 7px 8px;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__label \{ letter-spacing: 0\.5px; \}/)
    expect(css).toMatch(/\.ex-pub-item__required \{[^}]*color: var\(--ex-color-primary\);/)
    expect(css).toMatch(/\.ex-pub-item__help \{[^}]*color: var\(--ex-color-pub-label\);/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-select--declaration \{ border-color: var\(--ex-color-pub-select-border-modal\); \}/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__footer \{[^}]*box-shadow: 0 -3px 3px var\(--ex-color-pub-footer-shadow\);/)
    expect(css).toMatch(/\.ex-pub-card \.ex-radio \{ gap: 8px; \}/)
    expect(css).toMatch(/\.ex-pub-bar__start \{[^}]*color: var\(--ex-color-pub-text\);/)
  })

  it('打开的标签面板盖住摘要计数：计数右缘在面板右缘内侧', () => {
    expect(css).toMatch(/\.ex-pub-tag-picker \{[^}]*position: absolute;[^}]*z-index: 10;[^}]*left: 0;[^}]*width: 580px;/)
    expect(css).toMatch(/\.ex-pub-summary__count \{[^}]*position: absolute;[^}]*right: 10px;/)
    expect(css).toMatch(/\.ex-pub--modal \{[^}]*--ex-pub-label-width: 92px;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body \{[^}]*padding: 26px 20px 40px 28px;[^}]*scrollbar-gutter: stable;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body::-webkit-scrollbar \{ width: 11px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__control \{[^}]*flex: 1;[^}]*width: auto;/)
    // 740 − 左 28 − 右 20 − 滚动条 11 − 标签 92 = 589；计数 right 10 → 右缘 579，面板宽 580
    const MODAL_WIDTH = 740
    const pad = css.match(/\.ex-pub-modal \.ex-modal__body \{[^}]*padding: 26px (\d+)px 40px (\d+)px/)
    const bar = css.match(/\.ex-pub-modal \.ex-modal__body::-webkit-scrollbar \{ width: (\d+)px; \}/)
    const label = css.match(/\.ex-pub--modal \{[^}]*--ex-pub-label-width: (\d+)px;/)
    const picker = css.match(/\.ex-pub-tag-picker \{[^}]*left: (\d+);[^}]*width: (\d+)px;/)
    const counter = css.match(/\.ex-pub-summary__count \{[^}]*right: (\d+)px;/)
    expect(pad && bar && label && picker && counter).toBeTruthy()
    const control = MODAL_WIDTH - Number(pad![2]) - Number(pad![1]) - Number(bar![1]) - Number(label![1])
    expect(control).toBe(589)
    const counterRight = control - Number(counter![1])
    const pickerRight = Number(picker![1]) + Number(picker![2])
    expect(counterRight).toBeLessThan(pickerRight)
  })

  it('定时发布弹窗按 Element 顶部偏移定位（R-0901：932 高视口中框顶 250），矮视口不出屏', () => {
    expect(css).toMatch(/\.ex-pub-schedule-mask \{[^}]*flex-direction: column;[^}]*justify-content: flex-start;/)
    expect(css).toMatch(/\.ex-pub-schedule-mask::before \{[^}]*flex: 0 1 26\.8vh;[^}]*min-height: 16px;/)
    expect(css).toMatch(/\.ex-pub-schedule\.ex-modal \{[^}]*flex: none;[^}]*margin-bottom: 16px;/)
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

  it('标签面板与 chip 几何（B09–B11、B20–B24）', () => {
    expect(css).toMatch(/\.ex-pub-tag-picker \{[^}]*top: calc\(100% \+ 5px\);[^}]*width: 580px;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__search \{[^}]*width: 548px;[^}]*height: 36px;[^}]*margin-left: 15px;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__categories \{[^}]*width: 164px;/)
    expect(css).toMatch(/\.ex-pub-tag \{[^}]*height: 28px;[^}]*padding: 0 7\.5px 0 8px;/)
    expect(css).toMatch(/\.ex-pub-tag \{[^}]*font-family: Helvetica, Arial, var\(--ex-font-family-helvetica\);/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-tag,\n\.ex-pub--modal \.ex-pub-tag-add \{[^}]*top: 1px;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-tag-picker \{ top: calc\(100% \+ 6px\); \}/)
    expect(css).toMatch(/\.ex-pub-tag-option \{[^}]*height: 24px;[^}]*padding: 0 8px;/)
    expect(css).not.toContain('.ex-pub-tag-popover')
  })

  it('标签面板外框总高 333.5 与颜色（B20–B24、§3.2，R-0901 实测）', () => {
    expect(css).toMatch(/\.ex-pub-tag-picker \{[^}]*padding: 0 0 31\.5px;[^}]*border-color: var\(--ex-color-pub-picker-border\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__header \{[^}]*height: 42px;[^}]*padding: 14px 0 0;[^}]*text-align: center;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__body \{[^}]*height: 222px;[^}]*margin-top: 0;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__close \{[^}]*color: var\(--ex-color-pub-close\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__category \{[^}]*color: var\(--ex-color-pub-picker-category\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__category\.is-active \{ color: var\(--ex-color-pub-picker-active\); \}/)
    expect(css).toMatch(/\.ex-pub-tag-option \{[^}]*background: var\(--ex-color-pub-picker-option-bg\);[^}]*color: var\(--ex-color-pub-picker-active\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__section \{[^}]*color: var\(--ex-color-pub-dialog-text\);[^}]*font-weight: 700;/)
    expect(css).not.toMatch(/\.ex-pub-tag-picker__categories \{[^}]*border-right/)
    expect(css).not.toContain('.ex-pub-tag-option:hover')
    expect(css).toMatch(/\.ex-pub-tag-option\.is-selected \{ opacity: 0\.5; cursor: default; \}/)
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
      'ex-pub-schedule',
    ])
    expect(used.size).toBeGreaterThan(30)
    for (const name of used) {
      if (STRUCTURAL.has(name)) continue
      expect(css, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`))
    }
  })
})
