import type {
  EditorExtension,
  MissingAdapterPolicy,
  PanelDef,
  ToolbarActionItem,
  ToolbarLayout,
} from './extension'
import type { AdapterName, EditorAdapters, EditorType } from './types'

export interface ResolveOptions {
  editorType: EditorType
  adapters: EditorAdapters
  missingAdapter?: MissingAdapterPolicy
}

export interface ResolvedItem {
  item: ToolbarActionItem
  extension: string
  disabledByAdapter: boolean
  /** 仅 dropdown：按 adapter 过滤并修剪分隔线后的子项 */
  children?: ResolvedChild[]
}
export interface ResolvedSeparator {
  separator: true
  key: string
}
export type ResolvedChild = ResolvedItem | ResolvedSeparator
export type ResolvedGroup = readonly ResolvedItem[]

export interface ResolvedPanel {
  panel: PanelDef
  extension: string
}

export function isSeparator(child: ResolvedChild): child is ResolvedSeparator {
  return 'separator' in child
}

export function activeExtensions(extensions: readonly EditorExtension[], editorType: EditorType): EditorExtension[] {
  const byName = new Map<string, EditorExtension>()
  for (const ext of extensions) {
    if (ext.editors && !ext.editors.includes(editorType)) continue
    byName.set(ext.name, ext)
  }
  return [...byName.values()]
}

export function hasMissingAdapter(requires: readonly AdapterName[] | undefined, adapters: EditorAdapters): boolean {
  return (requires ?? []).some((name) => typeof adapters[name] !== 'function')
}

/** null = 隐藏；true = 禁用；false = 可用 */
export function adapterState(requires: readonly AdapterName[] | undefined, options: ResolveOptions): boolean | null {
  if (!hasMissingAdapter(requires, options.adapters)) return false
  return (options.missingAdapter ?? 'hide') === 'hide' ? null : true
}

function trimSeparators(children: ResolvedChild[]): ResolvedChild[] {
  const out: ResolvedChild[] = []
  for (const child of children) {
    if (isSeparator(child) && (out.length === 0 || isSeparator(out[out.length - 1]!))) continue
    out.push(child)
  }
  while (out.length > 0 && isSeparator(out[out.length - 1]!)) out.pop()
  return out
}

function resolveItem(
  item: ToolbarActionItem,
  extension: string,
  inherited: boolean,
  options: ResolveOptions,
): ResolvedItem | null {
  const state = adapterState(item.requires, options)
  if (state === null) return null
  const disabledByAdapter = inherited || state
  if (item.type !== 'dropdown') return { item, extension, disabledByAdapter }
  const children: ResolvedChild[] = []
  item.items.forEach((child, index) => {
    if (child.type === 'separator') {
      children.push({ separator: true, key: child.id ?? `${item.id}:sep:${index}` })
      return
    }
    const resolved = resolveItem(child, extension, disabledByAdapter, options)
    if (resolved) children.push(resolved)
  })
  const trimmed = trimSeparators(children)
  if (!trimmed.some((child) => !isSeparator(child))) return null
  return { item, extension, disabledByAdapter, children: trimmed }
}

export function collectItems(extensions: readonly EditorExtension[], options: ResolveOptions): Map<string, ResolvedItem> {
  const items = new Map<string, ResolvedItem>()
  for (const ext of activeExtensions(extensions, options.editorType)) {
    const extState = adapterState(ext.requires, options)
    if (extState === null) continue
    for (const item of ext.toolbar ?? []) {
      if (item.type === 'separator') continue
      const resolved = resolveItem(item, ext.name, extState, options)
      if (resolved) items.set(item.id, resolved)
    }
  }
  return items
}

function sortByOrder<T>(list: readonly T[], order: (value: T) => number): T[] {
  return list
    .map((value, index) => ({ value, index }))
    .sort((a, b) => order(a.value) - order(b.value) || a.index - b.index)
    .map(({ value }) => value)
}

function restGroups(items: Map<string, ResolvedItem>, used: Set<string>): ResolvedItem[][] {
  const byGroup = new Map<string, ResolvedItem[]>()
  for (const [id, resolved] of items) {
    if (used.has(id)) continue
    used.add(id)
    const key = resolved.item.group ?? ''
    let list = byGroup.get(key)
    if (!list) {
      list = []
      byGroup.set(key, list)
    }
    list.push(resolved)
  }
  return [...byGroup.values()].map((list) => sortByOrder(list, (r) => r.item.order ?? 0))
}

export function resolveToolbar(
  extensions: readonly EditorExtension[],
  layout: ToolbarLayout | undefined,
  options: ResolveOptions,
): ResolvedGroup[] {
  const items = collectItems(extensions, options)
  const used = new Set<string>()
  const groups: ResolvedItem[][] = []
  for (const entry of layout ?? ['*']) {
    if (entry === '*') {
      groups.push(...restGroups(items, used))
      continue
    }
    const group: ResolvedItem[] = []
    for (const id of typeof entry === 'string' ? [entry] : entry) {
      const resolved = items.get(id)
      if (!resolved || used.has(id)) continue
      used.add(id)
      group.push(resolved)
    }
    if (group.length > 0) groups.push(group)
  }
  return groups
}

export function resolvePanels(extensions: readonly EditorExtension[], options: ResolveOptions): ResolvedPanel[] {
  const panels = new Map<string, ResolvedPanel>()
  for (const ext of activeExtensions(extensions, options.editorType)) {
    if (hasMissingAdapter(ext.requires, options.adapters)) continue
    for (const panel of ext.panels ?? []) panels.set(panel.id, { panel, extension: ext.name })
  }
  return sortByOrder([...panels.values()], (p) => p.panel.order ?? 0)
}

/** 嵌套 dropdown 展平为用分隔线包围的子项 */
export function flattenChildren(children: readonly ResolvedChild[]): ResolvedChild[] {
  const out: ResolvedChild[] = []
  for (const child of children) {
    if (!isSeparator(child) && child.item.type === 'dropdown') {
      out.push({ separator: true, key: `${child.item.id}:start` })
      out.push(...flattenChildren(child.children ?? []))
      out.push({ separator: true, key: `${child.item.id}:end` })
    } else {
      out.push(child)
    }
  }
  return trimSeparators(out)
}

/** 溢出分组合并为一个菜单的子项（组间分隔线） */
export function overflowChildren(groups: readonly ResolvedGroup[]): ResolvedChild[] {
  const out: ResolvedChild[] = []
  groups.forEach((group, index) => {
    if (index > 0) out.push({ separator: true, key: `overflow:${index}` })
    out.push(...group)
  })
  return out
}

/** 能完整显示的分组数；放不下全部时为「更多」按钮预留 dividerWidth + moreWidth */
export function fitGroups(widths: readonly number[], available: number, dividerWidth: number, moreWidth: number): number {
  const total = (count: number) =>
    widths.slice(0, count).reduce((sum, width) => sum + width, 0) + Math.max(0, count - 1) * dividerWidth
  if (total(widths.length) <= available) return widths.length
  let count = widths.length - 1
  while (count > 0 && total(count) + dividerWidth + moreWidth > available) count--
  return count
}
