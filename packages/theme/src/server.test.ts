import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isThemeMode, resolveTheme } from './server'

describe('@geekx/theme/server 源码入口', () => {
  it('导出可用的 resolveTheme 与 isThemeMode', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('blue')).toBe(false)
  })
})

const distDir = path.join(import.meta.dirname, '..', 'dist')
const hasDist = existsSync(path.join(distDir, 'index.js')) && existsSync(path.join(distDir, 'server.js'))
const firstLine = (file: string) => readFileSync(path.join(distDir, file), 'utf8').split(/\r?\n/, 1)[0]

// 需要先执行 build；turbo 的 test 任务依赖自身 build，直接运行 vitest 且无 dist 时跳过
describe.skipIf(!hasDist)('构建产物 directive（需先 build，dist 不存在时跳过）', () => {
  it("dist/index.js 首行为 'use client';", () => {
    expect(firstLine('index.js')).toBe("'use client';")
  })

  it('dist/server.js 不含 use client', () => {
    expect(readFileSync(path.join(distDir, 'server.js'), 'utf8')).not.toContain('use client')
  })
})
