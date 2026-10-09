import type { EditorExtension, ExtensionContext, ExtensionShortcut, ToolbarButton, ToolbarItem } from './extension'
import { activeExtensions, adapterState, type ResolveOptions } from './layout'

export interface ParsedShortcut {
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
  /** 小写的 KeyboardEvent.key（字母/数字）或特殊键名（enter、arrowup…） */
  key: string
}

export interface ShortcutBinding {
  /** 归一化后的组合键，如 'mod-shift-k' */
  key: string
  parsed: ParsedShortcut
  extension: string
  run: ExtensionShortcut
  /** 来自工具栏按钮时用于 allowReadOnly / disabled 判断 */
  item?: ToolbarButton
  disabledByAdapter: boolean
}

export function parseShortcut(spec: string): ParsedShortcut {
  const parts = spec.split('-')
  const key = parts.pop()!.toLowerCase()
  const parsed: ParsedShortcut = { mod: false, ctrl: false, meta: false, alt: false, shift: false, key }
  for (const raw of parts) {
    const part = raw.toLowerCase()
    if (part === 'mod') parsed.mod = true
    else if (part === 'ctrl' || part === 'control') parsed.ctrl = true
    else if (part === 'meta' || part === 'cmd') parsed.meta = true
    else if (part === 'alt' || part === 'option') parsed.alt = true
    else if (part === 'shift') parsed.shift = true
    else throw new Error(`未知的快捷键修饰符：${raw}（${spec}）`)
  }
  return parsed
}

export function normalizeShortcut(p: ParsedShortcut): string {
  return [p.mod && 'mod', p.ctrl && 'ctrl', p.meta && 'meta', p.alt && 'alt', p.shift && 'shift', p.key]
    .filter(Boolean)
    .join('-')
}

function eventKey(e: KeyboardEvent): string {
  if (/^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase()
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase()
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5)
  return e.key.toLowerCase()
}

export function matchShortcut(p: ParsedShortcut, e: KeyboardEvent, mac: boolean): boolean {
  const wantCtrl = p.ctrl || (p.mod && !mac)
  const wantMeta = p.meta || (p.mod && mac)
  return (
    e.ctrlKey === wantCtrl &&
    e.metaKey === wantMeta &&
    e.altKey === p.alt &&
    e.shiftKey === p.shift &&
    eventKey(e) === p.key
  )
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  return /mac|iphone|ipad|ipod/i.test(data?.platform || navigator.platform || '')
}

const KEY_LABELS: Record<string, string> = {
  enter: 'Enter',
  escape: 'Esc',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
}

export function formatShortcut(spec: string, mac: boolean): string {
  const p = parseShortcut(spec)
  const key = KEY_LABELS[p.key] ?? p.key.toUpperCase()
  if (mac) {
    return [p.ctrl && '⌃', p.alt && '⌥', p.shift && '⇧', (p.mod || p.meta) && '⌘', key].filter(Boolean).join('')
  }
  return [(p.mod || p.ctrl) && 'Ctrl', p.meta && 'Win', p.alt && 'Alt', p.shift && 'Shift', key].filter(Boolean).join('+')
}

export function collectShortcuts(extensions: readonly EditorExtension[], options: ResolveOptions): ShortcutBinding[] {
  const bindings = new Map<string, ShortcutBinding>()
  const add = (spec: string, binding: Omit<ShortcutBinding, 'key' | 'parsed'>) => {
    const parsed = parseShortcut(spec)
    const key = normalizeShortcut(parsed)
    bindings.set(key, { ...binding, key, parsed })
  }
  for (const ext of activeExtensions(extensions, options.editorType)) {
    const extState = adapterState(ext.requires, options)
    if (extState === null) continue
    const visit = (item: ToolbarItem, inherited: boolean) => {
      if (item.type === 'separator') return
      const state = adapterState(item.requires, options)
      if (state === null) return
      const disabledByAdapter = inherited || state
      if (item.type === 'dropdown') item.items.forEach((child) => visit(child, disabledByAdapter))
      else if (item.type === 'button' && item.shortcut) {
        add(item.shortcut, { extension: ext.name, run: item.run, item, disabledByAdapter })
      }
    }
    ext.toolbar?.forEach((item) => visit(item, extState))
    for (const [spec, run] of Object.entries(ext.shortcuts ?? {})) {
      add(spec, { extension: ext.name, run, disabledByAdapter: extState })
    }
  }
  return [...bindings.values()]
}

/** 命中返回 true（已 preventDefault）；扩展异常交给 onError */
export function handleShortcut(
  e: KeyboardEvent,
  bindings: readonly ShortcutBinding[],
  ctx: ExtensionContext,
  mac: boolean,
  onError: (extension: string, error: unknown) => void,
): boolean {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return false
  const binding = bindings.find((b) => matchShortcut(b.parsed, e, mac))
  if (!binding) return false
  e.preventDefault()
  if (binding.disabledByAdapter) return true
  if (ctx.readOnly && !binding.item?.allowReadOnly) return true
  try {
    if (binding.item?.disabled?.(ctx)) return true
    binding.run(ctx)
  } catch (error) {
    onError(binding.extension, error)
  }
  return true
}
