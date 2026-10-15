import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const distDir = path.join(import.meta.dirname, '..', 'dist')
const dist = path.join(distDir, 'index.js')

describe.skipIf(!existsSync(dist))('构建产物（需先 build）', () => {
  it("dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })

  it('不依赖 @geekx/markdown', () => {
    expect(readFileSync(dist, 'utf8')).not.toMatch(/@geekx\/markdown/)
  })

  it('样式表随包输出到 dist/styles.css', () => {
    expect(existsSync(path.join(distDir, 'styles.css'))).toBe(true)
  })
})
