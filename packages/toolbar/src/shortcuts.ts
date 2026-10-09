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

const KEY_ALIASES: Record<string, string> = {
  space: ' ',
  esc: 'escape',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  minus: '-',
}

export function parseShortcut(spec: string): ParsedShortcut {
  const parts = spec.split('-')
  const last = parts.pop()!.toLowerCase()
  if (last === '') throw new Error(`快捷键缺少按键：${spec}`)
  const key = KEY_ALIASES[last] ?? last
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
  if (e.getModifierState?.('AltGraph')) return false
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

/** 非法组合键返回原文 */
export function formatShortcut(spec: string, mac: boolean): string {
  let p: ParsedShortcut
  try {
    p = parseShortcut(spec)
  } catch {
    return spec
  }
  const key = KEY_LABELS[p.key] ?? p.key.toUpperCase()
  if (mac) {
    return [p.ctrl && '⌃', p.alt && '⌥', p.shift && '⇧', (p.mod || p.meta) && '⌘', key].filter(Boolean).join('')
  }
  return [(p.mod || p.ctrl) && 'Ctrl', p.meta && 'Win', p.alt && 'Alt', p.shift && 'Shift', key].filter(Boolean).join('+')
}

/** 字面量 process.env.NODE_ENV 供打包器替换；无打包器时 process 不存在，按生产环境处理 */
function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

export function collectShortcuts(extensions: readonly EditorExtension[], options: ResolveOptions): ShortcutBinding[] {
  const bindings = new Map<string, ShortcutBinding>()
  const add = (spec: string, binding: Omit<ShortcutBinding, 'key' | 'parsed'>) => {
    let parsed: ParsedShortcut
    try {
      parsed = parseShortcut(spec)
    } catch (error) {
      console.error(`[editorx] 扩展 ${binding.extension} 的快捷键 "${spec}" 无效，已忽略`, error)
      return
    }
    const key = normalizeShortcut(parsed)
    const previous = bindings.get(key)
    if (previous && previous.extension !== binding.extension && isDev()) {
      console.warn(`[editorx] 快捷键 ${key} 被扩展 ${binding.extension} 覆盖（原为 ${previous.extension}）`)
    }
    // 删除后重新插入：等价写法（如 Windows 上的 mod-b 与 ctrl-b）按插入顺序倒序匹配时后注册者优先
    bindings.delete(key)
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

/** 命中返回 true（已 preventDefault）；多个绑定命中时取数组中最后一个；扩展异常交给 onError */
export function handleShortcut(
  e: KeyboardEvent,
  bindings: readonly ShortcutBinding[],
  ctx: ExtensionContext,
  mac: boolean,
  onError: (extension: string, error: unknown) => void,
): boolean {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return false
  let binding: ShortcutBinding | undefined
  for (let i = bindings.length - 1; i >= 0 && !binding; i--) {
    if (matchShortcut(bindings[i]!.parsed, e, mac)) binding = bindings[i]
  }
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
