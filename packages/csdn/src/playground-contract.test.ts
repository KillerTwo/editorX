import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../../../apps/playground/app/csdn/', import.meta.url)

describe('/csdn 页面契约', () => {
  it('挂上 CsdnEditor，页面本身不滚动，也不挂阶段 6 的切换占位', () => {
    const page = readFileSync(new URL('page.tsx', root), 'utf8')
    const playground = readFileSync(new URL('csdn-playground.tsx', root), 'utf8')
    const css = readFileSync(new URL('csdn.css', root), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(page).toContain('CsdnPlayground')
    expect(page).toContain("editorParam === 'richtext'")
    expect(playground).toContain('CsdnEditor')
    expect(playground).toContain('onEditorTypeChange')
    expect(playground).toContain('csdnDemoExtensions')
    expect(playground).toContain('csdnHistoryExtension')
    expect(playground).not.toContain('csdnSwitchEditorExtension')
    expect(playground).not.toContain('阶段 6 接入')
    expect(css).toMatch(/html:has\(\.pg-csdn\)[\s\S]*overflow:\s*hidden/)
    expect(css).toContain('.pg-csdn')
    expect(css).not.toMatch(/overflow-y:\s*scroll/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })
})
