import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('csdn styles', () => {
  it('外壳占满高度并隐藏溢出，颜色只走变量', () => {
    expect(css).toMatch(/\.ex-csdn \{[^}]*height: 100%/)
    expect(css).toMatch(/\.ex-csdn \{[^}]*overflow: hidden/)
    expect(css).not.toMatch(/transform\s*:/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('顶栏高 56 且无下边框', () => {
    expect(css).toMatch(/\.ex-csdn__bar \{[^}]*height: 56px/)
    expect(css).toMatch(/\.ex-csdn__bar \{[^}]*border-bottom:\s*0/)
  })

  it('超长标题计数使用错误色变量', () => {
    expect(css).toMatch(/\.ex-csdn-title__count\.is-over \{[^}]*color:\s*var\(--ex-color-error\)/)
  })

  it('Markdown 编辑区在顶栏下留 16px，富文本编辑区不留', () => {
    expect(css).toMatch(/\.ex-csdn__editor \{[^}]*overflow: hidden/)
    expect(css).toMatch(/\.ex-csdn\[data-editor='markdown'\] \.ex-csdn__editor \{[^}]*padding: 16px/)
  })
})
