import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as api from './index'
import { MODAL_LAYER_CLASS, ModalLayer, useModalLayerClass } from './layer'

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full)
  }
}

describe('@editorx/ui 公开入口', () => {
  it('不导出模态层辅助函数，包外也没有引用', () => {
    expect(api).not.toHaveProperty('MODAL_LAYER_CLASS')
    expect(api).not.toHaveProperty('ModalLayer')
    expect(api).not.toHaveProperty('useModalLayerClass')
    expect(MODAL_LAYER_CLASS).toBe('is-in-modal')
    expect(typeof ModalLayer).toBe('function')
    expect(typeof useModalLayerClass).toBe('function')

    const entry = readFileSync(path.join(import.meta.dirname, 'index.ts'), 'utf8')
    expect(entry).toContain('MODAL_LAYER_CLASS、ModalLayer、useModalLayerClass 不从本入口导出。')
    expect(entry).toContain('包外没有文件 import 这三个名字。包内仍从 ./layer 使用。')
    expect(entry).not.toMatch(/export\s*\{[^}]*MODAL_LAYER_CLASS/)

    const repo = path.join(import.meta.dirname, '../../..')
    const files: string[] = []
    walk(path.join(repo, 'packages'), files)
    walk(path.join(repo, 'apps'), files)
    const uiRoot = path.join(repo, 'packages', 'ui') + path.sep
    const outside = files.filter((file) => !file.startsWith(uiRoot))
    const hits = outside.filter((file) => {
      const text = readFileSync(file, 'utf8')
      return text.includes('MODAL_LAYER_CLASS') || text.includes('useModalLayerClass') || /\bModalLayer\b/.test(text)
    })
    expect(hits).toEqual([])

    const dts = readFileSync(path.join(import.meta.dirname, '../dist/index.d.ts'), 'utf8')
    expect(dts).not.toContain('MODAL_LAYER_CLASS')
    expect(dts).not.toContain('useModalLayerClass')
    expect(dts).not.toMatch(/\bModalLayer\b/)
  })
})
