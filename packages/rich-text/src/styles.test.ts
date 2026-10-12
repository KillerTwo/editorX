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
