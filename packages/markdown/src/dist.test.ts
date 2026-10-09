import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dist = path.join(import.meta.dirname, '..', 'dist', 'index.js')
const coreDist = path.join(import.meta.dirname, '..', '..', 'markdown-core', 'dist', 'index.js')

// 需要先执行 build；turbo 的 test 任务依赖自身 build，直接运行 vitest 且无 dist 时跳过
describe.skipIf(!existsSync(dist) || !existsSync(coreDist))('构建产物 directive（需先 build）', () => {
  it("@editorx/markdown 的 dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })

  it('@editorx/markdown-core 产物不含 use client', () => {
    expect(readFileSync(coreDist, 'utf8')).not.toContain('use client')
  })
})
