import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('markdown styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量（组件私有 --ex-mde-* 除外）', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) {
      if (name.startsWith('--ex-mde-')) continue
      expect(themeCss, name).toContain(`${name}:`)
    }
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('类名以 ex- 开头（状态类 is-* 与工具栏修饰类 has-* 除外）', () => {
    for (const [, c] of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      expect(c!.startsWith('ex-') || c!.startsWith('is-') || c!.startsWith('has-'), c).toBe(true)
    }
  })

  it('全屏外壳使用 --ex-z-fullscreen，位于弹出层之下', () => {
    const rule = /\.ex-mde\[data-fullscreen\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/z-index:\s*var\(--ex-z-fullscreen\);/)
    const z = (name: string) => Number(new RegExp(`--ex-z-${name}:\\s*(\\d+);`).exec(themeCss)?.[1])
    expect(z('fullscreen')).toBeLessThan(z('popover'))
  })

  it('全屏时两个滚动面板不把滚动链传给页面', () => {
    expect(css).toMatch(
      /\.ex-mde\[data-fullscreen\] \.ex-mde-editor,\s*\.ex-mde\[data-fullscreen\] \.ex-mde-preview-pane\s*\{\s*overscroll-behavior: contain;/,
    )
  })

  it('隐藏面板使用 hidden 属性', () => {
    expect(css).toMatch(/\.ex-mde-editor\[hidden\],\s*\.ex-mde-preview-pane\[hidden\]\s*\{\s*display: none;/)
  })

  it('CSDN 外壳关键尺寸', () => {
    expect(css).toMatch(/\.ex-mde-main \{[^}]*border-radius: var\(--ex-radius-lg\);/)
    expect(css).toMatch(/\.ex-mde-header \{[^}]*padding: 12px 12px 0;/)
    expect(css).toMatch(/\.ex-mde-modes \{[^}]*gap: 12px;/)
    expect(css).toMatch(
      /\.ex-mde-mode \{[^}]*gap: 6px;[^}]*height: 32px;[^}]*padding: 0 11\.5px 0 12px;[^}]*border-radius: var\(--ex-radius-lg\);[^}]*font-family: var\(--ex-mde-font-family\);[^}]*font-weight: 600;[^}]*letter-spacing: 0\.5px;/,
    )
    expect(css).toMatch(/\.ex-mde-toolbar \{[^}]*height: 39px;[^}]*margin-top: 17px;[^}]*padding: 0 10px;/)
    expect(css).toMatch(
      /\.ex-mde-status \{[^}]*gap: 24px;[^}]*box-sizing: border-box;[^}]*min-height: 64px;[^}]*padding: 9px 16px 12px 26\.5px;[^}]*font-size: 12px;[^}]*line-height: 21px;/,
    )
    expect(css).toMatch(/\.ex-mde-status__stats \{ flex: none; white-space: nowrap; \}/)
    expect(css).toMatch(/\.ex-mde-status__md,\n\.ex-mde-status__html \{ display: flex; gap: 9px; \}/)
    expect(css).toMatch(/\.ex-mde\[data-view='preview'\] \.ex-mde-status__stats \{ margin-top: 4px; \}/)
    expect(css).toMatch(/\.ex-mde-status__end \{[^}]*gap: 16px;/)
    expect(css).toMatch(/\.ex-mde-status__center,\n\.ex-mde-status__end \{ margin-top: 2px; \}/)
    expect(css).toMatch(/\.ex-mde-panel \{[^}]*width: 390px;[^}]*padding: 10px 0;/)
    expect(css).toMatch(/\.ex-mde-rail \{[^}]*width: 56px;/)
    expect(css).toContain('calc(var(--ex-mde-split, 0.5) * 100% - 13px)')
    expect(css).toMatch(/\.ex-mde\[data-view='split'\] \.ex-editor-content \{ padding: 16px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-editor-content \{[^}]*padding: 16px 20cqi;[^}]*font-size: 16px;[^}]*line-height: 26px;/)
    expect(css).toMatch(/\.ex-mde-body \{[^}]*container-type: inline-size;/)
    expect(css).toMatch(/\.ex-mde\[data-view='split'\] \.ex-mde-preview \{[^}]*padding: 19px 24px 16px 42px;/)
    expect(css).toMatch(/\.ex-mde-toolbar \.ex-toolbar__divider \{ margin: 0 16px; \}/)
    expect(css).toMatch(/\.ex-mde-toolbar \.ex-toolbar__item\.has-label \{ gap: 6px; padding: 0 10px; \}/)
    expect(css).toMatch(/\.ex-mde-toc__list \{[^}]*padding: 3px 0 8px;/)
    expect(css).toMatch(/::-webkit-scrollbar \{[^}]*width: 8px;/)
  })

  it('编辑区排版按 CSDN 实测：西文 Arial 优先，标题逐级递减且行高统一', () => {
    expect(css).toMatch(/--ex-mde-font-family: -apple-system, 'SF UI Text', Arial,/)
    expect(css).toMatch(/\.ex-mde \.ex-md-setext-h1 \{ font-size: 22px; line-height: 48px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-setext-h2 \{ font-size: 20px; line-height: 46px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-h3 \{ font-size: 18px; line-height: 46px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-h4 \{ font-size: 17px; line-height: 46px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-h6 \{ font-size: 16px; line-height: 46px; \}/)
    expect(css).toMatch(/\.ex-editor-section:has\(> :is\(\.ex-md-h1, \.ex-md-setext-h1\):first-child\) \{ padding-top: 41px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-tag \{ font-size: 13\.5px; line-height: 0; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-toc \{ font-size: 29px; line-height: 37px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-md-toc :is\(\.ex-md-link, \.ex-md-marker\) \{\s*color: var\(--ex-color-mde-body-marker\);/)
  })

  it('预览排版：标题 22/20/18/16px、目录无项目符号、脚注与流程图细线', () => {
    expect(css).toMatch(/\.ex-mde \.ex-preview \{[^}]*font-size: 16px;[^}]*line-height: 26px;/)
    expect(css).toMatch(/\.ex-mde \.ex-preview h1 \{ font-size: 22px; line-height: 32px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-preview h2 \{ font-size: 20px; line-height: 30px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-preview h3 \{ font-size: 18px; line-height: 28px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-preview :is\(h4, h5, h6\) \{ font-size: 16px; line-height: 26px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-preview \.ex-toc ul \{[^}]*list-style: none;/)
    expect(css).toMatch(/\.ex-mde \.ex-preview \.ex-footnotes p \{ margin: 0; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-flowchart svg :is\(rect, path, circle, ellipse\) \{ stroke-width: 1px; \}/)
    expect(css).toMatch(/\.ex-mde \.ex-flowchart svg text \{ fill: var\(--ex-color-mde-heading-text\); \}/)
  })

  it('目录层级字号 18/16/13px', () => {
    expect(css).toMatch(/data-depth='0'\] \.ex-mde-toc__link \{[^}]*font-size: 18px;/)
    expect(css).toMatch(/data-depth='1'\] \.ex-mde-toc__link \{[^}]*font-size: 16px;/)
    expect(css).toMatch(/data-depth='2'\] \.ex-mde-toc__link \{[^}]*font-size: 13px;/)
  })

  it('分隔条：拖动光标、禁用触摸手势、键盘焦点可见', () => {
    expect(css).toMatch(/\.ex-mde-splitter \{[^}]*cursor: col-resize;[^}]*touch-action: none;/)
    expect(css).toMatch(/\.ex-mde-splitter::before \{[^}]*cursor: col-resize;/)
    expect(css).toMatch(/\.ex-mde-splitter:focus-visible::before \{[^}]*background: var\(--ex-color-primary\);/)
  })

  it('预览中上传失败的图片以错误色标出', () => {
    expect(css).toMatch(/\.ex-mde-preview \.ex-mde-upload-failed \{[^}]*color: var\(--ex-color-error\);/)
  })

  it('页签、工具栏与外壳颜色只取 --ex-color-mde-* token', () => {
    expect(css).toMatch(/\.ex-mde-mode\.is-active \{[^}]*background: var\(--ex-color-mde-tab-active-bg\);/)
    expect(css).toMatch(/\.ex-mde\[data-fullscreen\] \{[^}]*background: var\(--ex-color-mde-canvas\);/)
    expect(css).toMatch(/\.ex-mde\[data-view='split'\] \.ex-mde-preview-pane \{[^}]*background: var\(--ex-color-mde-split-preview-bg\);/)
  })

  it('组件中用到的每个 ex-mde-* 类名都有样式（纯结构包裹元素除外）', () => {
    const STRUCTURAL = new Set(['ex-mde-toc', 'ex-mde-syntax'])
    const dir = import.meta.dirname
    const sources = (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('test-utils'))
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
    const used = new Set([...sources.matchAll(/['"`\s](ex-mde-[\w-]*\w)(?![\w-]*\$)/g)].map((m) => m[1]!))
    used.add('ex-mde-panel--bottom')
    expect(used.size).toBeGreaterThan(30)
    for (const name of used) {
      if (STRUCTURAL.has(name)) continue
      expect(css, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`))
    }
  })
})
