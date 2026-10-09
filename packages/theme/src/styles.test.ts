import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8')

describe('styles.css', () => {
  it('颜色 token 只定义一次，不保留独立的暗色块', () => {
    expect(css.match(/--ex-color-text:/g)).toHaveLength(1)
  })

  it('system 模式通过 color-scheme: light dark 跟随系统', () => {
    expect(css).toContain('color-scheme: light dark')
  })

  it('每个 --ex-color-* 定义的值都以 light-dark( 开头', () => {
    const definitions = [...css.matchAll(/(--ex-color-[\w-]+):\s*([^;]+);/g)]
    expect(definitions.length).toBeGreaterThan(0)
    for (const [, name, value] of definitions) {
      expect(value, name).toMatch(/^light-dark\(/)
    }
  })
})
