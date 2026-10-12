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

  it('代码、行内代码和引用压过 CKEditor 的浅色', () => {
    expect(css).toMatch(
      /\.ex-rte \.ck-content pre \{[^}]*color:\s*var\(--ex-color-rte-body\);[^}]*background:\s*var\(--ex-color-rte-band\);[^}]*border:\s*1px solid var\(--ex-color-rte-separator\)/,
    )
    expect(css).toMatch(
      /\.ex-rte \.ck-content code \{[^}]*color:\s*var\(--ex-color-rte-body\);[^}]*background:\s*var\(--ex-color-rte-band\);[^}]*border:\s*1px solid var\(--ex-color-rte-separator\)/,
    )
    expect(css).toMatch(
      /\.ex-rte \.ck-content blockquote \{[^}]*color:\s*var\(--ex-color-rte-ink\);[^}]*background:\s*var\(--ex-color-rte-band\);[^}]*border-left:\s*5px solid var\(--ex-color-rte-separator\)/,
    )
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('稿纸、标题计数和占位用 token', () => {
    expect(css).toMatch(/\.ex-rte-paper \{[^}]*min-height: 812px/)
    expect(css).toMatch(/\.ex-rte-paper \{[^}]*padding: 32px 64px 64px/)
    expect(css).toMatch(/\.ex-rte-title__input \{[^}]*color: var\(--ex-color-rte-title\)/)
    expect(css).toMatch(/\.ex-rte-title__count\.is-over \{[^}]*color: var\(--ex-color-error\)/)
    expect(css).toMatch(/\.ex-rte-placeholder \{[^}]*line-height: 32px/)
    expect(css).not.toMatch(/\.ex-rte-placeholder[^,{]*ul/)
  })

  it('左侧目录浮在稿纸上，窄屏默认藏起', () => {
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*z-index:\s*4/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*top:\s*84px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*bottom:\s*37px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*left:\s*23px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*width:\s*280px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*background:\s*var\(--ex-color-rte-paper\)/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*box-shadow:\s*0 0 20px var\(--ex-color-rte-toc-shadow\)/)
    expect(css).toMatch(/\.ex-rte-toc__empty\s*\{[^}]*margin:\s*auto/)
    expect(css).toMatch(/\.ex-rte-toc__empty\s*\{[^}]*color:\s*var\(--ex-color-rte-ink\)/)
    expect(css).toMatch(/\.ex-rte-toc__empty\s*\{[^}]*text-align:\s*center/)
    expect(css).toMatch(/\.ex-rte-toc__title\s*\{[^}]*color:\s*var\(--ex-color-rte-toc-title\)/)
    expect(css).toMatch(/\.ex-rte-toc__rule\s*\{[^}]*background:\s*var\(--ex-color-rte-divider\)/)
    const tocMedia = `@media (max-width: 1199px) {
  .ex-rte-toc { visibility: hidden; }
  .ex-rte-toc.is-open { visibility: visible; }
}`
    expect(css).toMatch(new RegExp(tocMedia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(css.indexOf('.ex-rte-toc.is-collapsed')).toBeGreaterThan(css.indexOf(tocMedia))
    expect(css).toMatch(/\.ex-rte\s*\{[^}]*position:\s*relative/)
    const scroll = css.match(/\.ex-rte__scroll\s*\{[^}]*\}/)?.[0] ?? ''
    expect(scroll).toContain('flex: 1 1 auto')
    expect(scroll).toContain('height: auto')
    expect(scroll).not.toContain('height: 100%')
  })

  it('右侧抽屉浮在稿纸上，不推动稿纸', () => {
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*width:\s*390px/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*top:\s*52px/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*bottom:\s*68px/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*right:\s*0/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*z-index:\s*20/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*background:\s*var\(--ex-color-rte-paper\)/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*box-shadow:\s*0 0 20px var\(--ex-color-rte-drawer-shadow\)/)
    expect(css).toMatch(/\.ex-rte-collapsed\s*\{[^}]*top:\s*86px/)
    expect(css).toMatch(/\.ex-rte-collapsed\s*\{[^}]*right:\s*8px/)
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
