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

  it('键名别名：space/esc/方向键/minus，格式化为可读标签', () => {
    expect(parseShortcut('Mod-Space').key).toBe(' ')
    expect(parseShortcut('Esc').key).toBe('escape')
    expect(['Up', 'Down', 'Left', 'Right'].map((k) => parseShortcut(`Alt-${k}`).key)).toEqual([
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ])
    expect(parseShortcut('Mod-Minus').key).toBe('-')
    expect(formatShortcut('Mod-Space', false)).toBe('Ctrl+Space')
    expect(formatShortcut('Esc', false)).toBe('Esc')
    expect(formatShortcut('Alt-Up', false)).toBe('Alt+↑')
    expect(formatShortcut('Mod-Minus', false)).toBe('Ctrl+-')
    expect(formatShortcut('Mod-Minus', true)).toBe('⌘-')
  })

  it('formatShortcut 遇到非法组合键时返回原文，不抛错', () => {
    expect(formatShortcut('Hyper-K', false)).toBe('Hyper-K')
    expect(formatShortcut('Mod--', true)).toBe('Mod--')
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

  it('别名键可匹配：Mod-Minus、Mod-Space、Esc', () => {
    expect(matchShortcut(parseShortcut('Mod-Minus'), key({ key: '-', code: 'Minus', ctrlKey: true }), false)).toBe(true)
    expect(matchShortcut(parseShortcut('Mod-Space'), key({ key: ' ', code: 'Space', ctrlKey: true }), false)).toBe(true)
    expect(matchShortcut(parseShortcut('Esc'), key({ key: 'Escape', code: 'Escape' }), false)).toBe(true)
  })

  it('AltGr 按下时不匹配（Windows 上 AltGr 表现为 Ctrl+Alt）', () => {
    const e = key({ key: 'q', code: 'KeyQ', ctrlKey: true, altKey: true })
    vi.spyOn(e, 'getModifierState').mockImplementation((k) => k === 'AltGraph')
    expect(matchShortcut(parseShortcut('Ctrl-Alt-Q'), e, false)).toBe(false)
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
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const later: EditorExtension = { name: 'mine', shortcuts: { 'mod-b': vi.fn() } }
    const bindings = collectShortcuts([...exts, later], md)
    expect(bindings.map((b) => normalizeShortcut(b.parsed)).sort()).toEqual(
      ['mod-b', 'mod-shift-d', 'mod-shift-h', 'mod-shift-o', 'mod-shift-v'].sort(),
    )
    expect(bindings.find((b) => b.key === 'mod-b')!.extension).toBe('mine')
  })

  it('非法组合键被跳过并 console.error（含扩展名），其他绑定照常收集', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad: EditorExtension = {
      name: 'bad',
      toolbar: [{ type: 'button', id: 'x', title: 'x', shortcut: 'Mod--', run }],
      shortcuts: { 'Hyper-K': run, 'Mod-J': run },
    }
    const bindings = collectShortcuts([...exts, bad], md)
    expect(bindings.map((b) => b.key).sort()).toEqual(
      ['mod-b', 'mod-j', 'mod-shift-d', 'mod-shift-h', 'mod-shift-o', 'mod-shift-v'].sort(),
    )
    expect(error).toHaveBeenCalledTimes(2)
    expect(String(error.mock.calls[0]![0])).toContain('bad')
  })

  it('等价写法（Windows 上 mod-b 与 ctrl-b）由后注册者生效', () => {
    const first = vi.fn()
    const second = vi.fn()
    const third = vi.fn()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a: EditorExtension = { name: 'a', shortcuts: { 'Mod-B': first } }
    const b: EditorExtension = { name: 'b', shortcuts: { 'Ctrl-B': second } }
    handleShortcut(key({ key: 'b', ctrlKey: true }), collectShortcuts([a, b], md), ctx(), false, vi.fn())
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    const c: EditorExtension = { name: 'c', shortcuts: { 'Mod-B': third } }
    handleShortcut(key({ key: 'b', ctrlKey: true }), collectShortcuts([a, b, c], md), ctx(), false, vi.fn())
    expect(third).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('不同扩展绑定同一组合键时开发环境 console.warn；同一扩展内不警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    collectShortcuts([{ name: 'a', shortcuts: { 'Mod-B': run } }, { name: 'b', shortcuts: { 'mod-b': run } }], md)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toMatch(/mod-b/)
    warn.mockClear()
    collectShortcuts([{ name: 'a', toolbar: [{ type: 'button', id: 'x', title: 'x', shortcut: 'Mod-B', run }], shortcuts: { 'Mod-B': run } }], md)
    expect(warn).not.toHaveBeenCalled()
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
