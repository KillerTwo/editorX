import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('csdn-extensions styles', () => {
  it('颜色只走变量，不碰外壳的 transform', () => {
    expect(css).toMatch(/\.ex-csdn-ext-dialog \{[^}]*gap: var\(--ex-space-3\)/)
    expect(css).toMatch(/\.ex-csdn-ext-input \{[^}]*color: var\(--ex-color-text\)/)
    expect(css).not.toMatch(/\.ex-csdn \{/)
    expect(css).not.toMatch(/\.ex-csdn__editor/)
    expect(css).not.toMatch(/transform\s*:/)
    expect(css).not.toMatch(/filter\s*:/)
    expect(css).not.toMatch(/will-change\s*:/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })
})
