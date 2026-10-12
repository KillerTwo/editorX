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
})
