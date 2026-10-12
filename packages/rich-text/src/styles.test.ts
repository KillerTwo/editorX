import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('rich-text styles', () => {
  it('根是高度 100% 的滚动包含块，不用 window', () => {
    expect(css).toMatch(/\.ex-rte \{[^}]*height: 100%;[^}]*transform: translate\(0\)/)
    expect(css).toMatch(/\.ex-rte__scroll \{[^}]*overflow: auto/)
    expect(css).not.toMatch(/window/)
  })

  it('工具栏带不把滚动区顶出根', () => {
    const root = css.match(/\.ex-rte \{[^}]*\}/)?.[0] ?? ''
    const band = css.match(/\.ex-rte__band \{[^}]*\}/)?.[0] ?? ''
    const scroll = css.match(/\.ex-rte__scroll \{[^}]*\}/)?.[0] ?? ''
    expect(root).toContain('display: flex')
    expect(root).toContain('flex-direction: column')
    expect(root).toContain('overflow: hidden')
    expect(band).toContain('flex: 0 0 52px')
    expect(scroll).toContain('flex: 1 1 auto')
    expect(scroll).toContain('min-height: 0')
    expect(scroll).toContain('height: auto')
    expect(scroll).toContain('overflow: auto')
    expect(scroll).not.toContain('height: 100%')
  })

  it('首尾块下边距和分隔线压过 CKEditor', () => {
    expect(css).toMatch(
      /\.ex-rte \.ck\.ck-editor__editable_inline\.ck-content > :first-child \{[^}]*margin-top:\s*0;[^}]*margin-bottom:\s*24px/,
    )
    expect(css).toMatch(
      /\.ex-rte \.ck\.ck-editor__editable_inline\.ck-content > :last-child \{[^}]*margin-bottom:\s*24px/,
    )
    expect(css).toMatch(
      /\.ex-rte \.ck\.ck-content hr \{[^}]*display:\s*block;[^}]*height:\s*0;[^}]*background:\s*none;[^}]*border-top:\s*1px solid var\(--ex-color-rte-rule\)/,
    )
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('图标在文字上方，且只作用于 .ex-rte', () => {
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item\.has-label \{[^}]*grid-template-areas: 'icon caret' 'label label'/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item:disabled \{[^}]*color: var\(--ex-color-rte-ink\)/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item:disabled \.ex-toolbar__icon \{[^}]*color: var\(--ex-color-rte-icon-disabled\)/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item:hover:not\(:disabled\) \{[^}]*background: var\(--ex-color-rte-hover\)/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item\.is-active \{[^}]*color: var\(--ex-color-primary\)/)
    const markdownCss = readFileSync(path.join(import.meta.dirname, '../../markdown/src/styles.css'), 'utf8')
    expect(markdownCss).not.toContain("grid-template-areas: 'icon caret'")
  })
})
