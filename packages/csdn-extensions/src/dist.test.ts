import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const distDir = path.join(import.meta.dirname, '..', 'dist')
const dist = path.join(distDir, 'index.js')

describe.skipIf(!existsSync(dist))('构建产物（需先 build）', () => {
  it("dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })

  it('带有 styles.css，且不静态依赖 csdn 或 markdown', () => {
    const source = readFileSync(dist, 'utf8')
    expect(source).not.toContain('@geekx/csdn\'')
    expect(source).not.toContain('@geekx/markdown')
    expect(source).not.toContain('@geekx/rich-text')
    expect(source).not.toContain('@geekx/markdown-core')
    expect(existsSync(path.join(distDir, 'styles.css'))).toBe(true)
  })
})
