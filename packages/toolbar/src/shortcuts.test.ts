import { describe, expect, it, vi } from 'vitest'
import type { EditorExtension, ExtensionContext } from './extension'
import {
  collectShortcuts,
  formatShortcut,
  handleShortcut,
  isMacPlatform,
  matchShortcut,
  normalizeShortcut,
  parseShortcut,
} from './shortcuts'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { cancelable: true, ...init })
const ctx = (readOnly = false) => ({ readOnly }) as ExtensionContext
const md = { editorType: 'markdown' as const, adapters: {} }

describe('parse / normalize / format', () => {
  it('解析修饰键，大小写不敏感，未知修饰键抛错', () => {
    expect(parseShortcut('Mod-Shift-K')).toEqual({ mod: true, ctrl: false, meta: false, alt: false, shift: true, key: 'k' })
    expect(normalizeShortcut(parseShortcut('shift-mod-k'))).toBe('mod-shift-k')
    expect(() => parseShortcut('Hyper-K')).toThrow('Hyper')
  })

  it('Windows 显示 Ctrl+Shift+K，mac 显示 ⇧⌘K', () => {
    expect(formatShortcut('Mod-Shift-K', false)).toBe('Ctrl+Shift+K')
    expect(formatShortcut('Mod-Shift-K', true)).toBe('⇧⌘K')
    expect(formatShortcut('Alt-Enter', false)).toBe('Alt+Enter')
  })

  it('isMacPlatform 读取 navigator.platform', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    expect(isMacPlatform()).toBe(true)
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    expect(isMacPlatform()).toBe(false)
  })
})

describe('matchShortcut', () => {
  it('Mod 在 mac 上是 Meta、其他平台是 Ctrl；修饰键需完全一致', () => {
    const p = parseShortcut('Mod-B')
    expect(matchShortcut(p, key({ key: 'b', ctrlKey: true }), false)).toBe(true)
    expect(matchShortcut(p, key({ key: 'b', metaKey: true }), true)).toBe(true)
    expect(matchShortcut(p, key({ key: 'b', metaKey: true }), false)).toBe(false)
    expect(matchShortcut(p, key({ key: 'b', ctrlKey: true, shiftKey: true }), false)).toBe(false)
  })

  it('Shift 产生大写或符号时按 key / code 回退匹配', () => {
    expect(matchShortcut(parseShortcut('Mod-Shift-K'), key({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }), false)).toBe(true)
    expect(matchShortcut(parseShortcut('Mod-Shift-1'), key({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true }), false)).toBe(true)
  })
})

describe('collectShortcuts / handleShortcut', () => {
  const run = vi.fn()
  const exts: EditorExtension[] = [
    {
      name: 'core',
      toolbar: [
        { type: 'button', id: 'bold', title: '加粗', shortcut: 'Mod-B', run },
        {
          type: 'dropdown',
          id: 'list',
          title: '列表',
          items: [{ type: 'button', id: 'ol', title: '有序', shortcut: 'Mod-Shift-O', run }],
        },
        { type: 'button', id: 'view', title: '查看', shortcut: 'Mod-Shift-V', allowReadOnly: true, run },
        { type: 'button', id: 'off', title: '禁用', shortcut: 'Mod-Shift-D', disabled: () => true, run },
      ],
      shortcuts: { 'Mod-Shift-H': run },
    },
  ]

  it('收集按钮（含 dropdown 子项）与 shortcuts 映射，后注册覆盖先注册', () => {
    const later: EditorExtension = { name: 'mine', shortcuts: { 'mod-b': vi.fn() } }
    const bindings = collectShortcuts([...exts, later], md)
    expect(bindings.map((b) => normalizeShortcut(b.parsed)).sort()).toEqual(
      ['mod-b', 'mod-shift-d', 'mod-shift-h', 'mod-shift-o', 'mod-shift-v'].sort(),
    )
    expect(bindings.find((b) => b.key === 'mod-b')!.extension).toBe('mine')
  })

  it('命中则 preventDefault 并执行；已被处理、输入法组合中、未命中都不处理', () => {
    run.mockClear()
    const bindings = collectShortcuts(exts, md)
    const onError = vi.fn()
    const hit = key({ key: 'o', ctrlKey: true, shiftKey: true })
    expect(handleShortcut(hit, bindings, ctx(), false, onError)).toBe(true)
    expect(hit.defaultPrevented).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    const handled = key({ key: 'b', ctrlKey: true })
    handled.preventDefault()
    expect(handleShortcut(handled, bindings, ctx(), false, onError)).toBe(false)
    expect(handleShortcut(key({ key: 'b', ctrlKey: true, isComposing: true }), bindings, ctx(), false, onError)).toBe(false)
    expect(handleShortcut(key({ key: 'q', ctrlKey: true }), bindings, ctx(), false, onError)).toBe(false)
  })

  it('只读时只执行 allowReadOnly 项；disabled() 为真时不执行；仍 preventDefault', () => {
    run.mockClear()
    const bindings = collectShortcuts(exts, md)
    const blocked = key({ key: 'b', ctrlKey: true })
    expect(handleShortcut(blocked, bindings, ctx(true), false, vi.fn())).toBe(true)
    expect(blocked.defaultPrevented).toBe(true)
    expect(run).not.toHaveBeenCalled()
    handleShortcut(key({ key: 'v', ctrlKey: true, shiftKey: true }), bindings, ctx(true), false, vi.fn())
    expect(run).toHaveBeenCalledTimes(1)
    handleShortcut(key({ key: 'd', ctrlKey: true, shiftKey: true }), bindings, ctx(), false, vi.fn())
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('run 抛错交给 onError，不向外抛', () => {
    const boom: EditorExtension = { name: 'boom', shortcuts: { 'Mod-K': () => { throw new Error('x') } } }
    const onError = vi.fn()
    expect(() => handleShortcut(key({ key: 'k', ctrlKey: true }), collectShortcuts([boom], md), ctx(), false, onError)).not.toThrow()
    expect(onError).toHaveBeenCalledWith('boom', expect.any(Error))
  })

  it('缺 adapter：默认不收集；disable 策略下收集但不执行', () => {
    run.mockClear()
    const needs: EditorExtension = { name: 'up', requires: ['uploadImage'], shortcuts: { 'Mod-U': run } }
    expect(collectShortcuts([needs], md)).toEqual([])
    const bindings = collectShortcuts([needs], { ...md, missingAdapter: 'disable' })
    expect(handleShortcut(key({ key: 'u', ctrlKey: true }), bindings, ctx(), false, vi.fn())).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })
})
