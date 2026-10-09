import type { ReactNode } from 'react'
import type { Messages } from './messages'
import type { AdapterName, EditorAdapters, EditorDocument, EditorType } from './types'

/** 静态文案或从当前 Messages 取值的函数；在工具栏中求值时还会传入 ctx（随 stateKey 刷新） */
export type MessageText = string | ((messages: Messages, ctx?: ExtensionContext) => string)
export type NotifyType = 'info' | 'success' | 'warning' | 'error'

interface ItemBase {
  id: string
  title: MessageText
  icon?: ReactNode
  /** 按钮上显示的文字（如「列表」）；不设置时只显示图标，title 作为无障碍名称 */
  label?: MessageText
  /** 布局 '*' 展开时用于分组与排序 */
  group?: string
  order?: number
  /** 字符串为 ctx.formats 中的格式键；函数在 render 期间求值 */
  active?: string | ((ctx: ExtensionContext) => boolean)
  disabled?: (ctx: ExtensionContext) => boolean
  /** 只读时仍可用（导出、全屏等） */
  allowReadOnly?: boolean
  requires?: readonly AdapterName[]
}

export interface ToolbarButton extends ItemBase {
  type: 'button'
  /**
   * 如 'Mod-B'、'Mod-Shift-K'；Mod 在 mac 上为 ⌘，其他平台为 Ctrl。
   * 快捷键与布局无关：条目即使不在 toolbarLayout 中（或被溢出到「更多」）也会绑定。
   * 位于 dropdown 内时只检查自身的 disabled / allowReadOnly，不继承父级 dropdown 的 disabled。
   * 其余限制见 EditorExtension.shortcuts。
   */
  shortcut?: string
  run(ctx: ExtensionContext): void
}

export interface ToolbarDropdown extends ItemBase {
  type: 'dropdown'
  items: readonly ToolbarItem[]
}

export interface ToolbarPopover extends ItemBase {
  type: 'popover'
  render(ctx: ExtensionContext, close: () => void): ReactNode
}

export interface ToolbarModal extends ItemBase {
  type: 'modal'
  width?: number | string
  render(ctx: ExtensionContext, close: () => void): ReactNode
}

/** 只在 dropdown 的 items 中生效；EditorExtension.toolbar 顶层的分隔线被忽略（分组之间的分隔由布局决定） */
export interface ToolbarSeparator {
  type: 'separator'
  id?: string
}

export type ToolbarItem = ToolbarButton | ToolbarDropdown | ToolbarPopover | ToolbarModal | ToolbarSeparator
export type ToolbarActionItem = Exclude<ToolbarItem, ToolbarSeparator>

/**
 * 扩展缺少 requires 中的 adapter 时面板总是隐藏（不受 missingAdapter: 'disable' 影响，面板没有禁用态）。
 * 右侧与底部面板共用同一个「当前面板」：同一时刻只打开一个（`ctx.openPanel` 会关闭其他面板）。
 */
export interface PanelDef {
  id: string
  /** 面板标题，同时用作面板区域的无障碍名称与右侧图标栏的文字标签 */
  title: MessageText
  /** 右侧图标栏中的图标 */
  icon?: ReactNode
  /** 只有 right 面板出现在右侧图标栏中；bottom 面板没有图标栏入口，只能经 ctx.openPanel / togglePanel 打开 */
  position: 'right' | 'bottom'
  order?: number
  render(ctx: ExtensionContext): ReactNode
}

/** 与 markdown-core 的 EmbedDef 结构一致（不依赖 markdown-core） */
export interface EmbedDef {
  type: string
  renderHtml(payload: unknown): string
}

export interface CommandRegistry {
  has(name: string): boolean
  /** 未注册返回 false */
  run(name: string, args?: unknown): boolean
  list(): string[]
}

export interface InsertContent {
  markdown?: string
  html?: string
}

/**
 * 编辑器提供给扩展的能力；对象引用稳定，带 get 的属性始终返回最新值。
 * 只读时 insert / insertEmbed / replaceSelection / replaceDocument 为空操作。
 */
export interface ExtensionContext {
  readonly editorType: EditorType
  /** 在选区末尾插入，不删除选中文本 */
  insert(content: InsertContent): void
  /** 以独立块插入嵌入卡片（Markdown：```ex-embed:<type> 围栏 + JSON） */
  insertEmbed(type: string, payload: unknown): void
  getSelectionText(): string
  replaceSelection(content: InsertContent): void
  /** 整体替换文档（可撤销），用于导入/模板 */
  replaceDocument(content: InsertContent): void
  getDocument(): EditorDocument
  readonly commands: CommandRegistry
  readonly adapters: EditorAdapters
  openPanel(id: string): void
  closePanel(id: string): void
  togglePanel(id: string): void
  readonly activePanel: string | null
  /** 走编辑器的上传流程（占位符、失败重试） */
  uploadImages(files: readonly File[]): Promise<void>
  focus(): void
  notify(message: string, type?: NotifyType): void
  readonly theme: 'light' | 'dark'
  readonly locale: Messages
  readonly readOnly: boolean
  /** 光标处的格式键（bold、heading2、orderedList…） */
  readonly formats: ReadonlySet<string>
}

export type ExtensionShortcut = (ctx: ExtensionContext) => void

export interface EditorExtension {
  /** 唯一；同名的后注册扩展替换先注册的 */
  name: string
  editors?: readonly EditorType[]
  requires?: readonly AdapterName[]
  /** 顶层条目按 id 被布局引用；顶层 separator 被忽略，只在 dropdown 内有效 */
  toolbar?: readonly ToolbarItem[]
  /**
   * 额外快捷键（不在工具栏上显示），写法同 ToolbarButton.shortcut；只读时不触发。
   * - Windows Chromium 上 Ctrl+Alt 可能被报告为 AltGraph（getModifierState('AltGraph') 为 true），
   *   这类按键一律不匹配，以免拦截 AltGr 字符输入；因此 Windows 上不要依赖 Mod-Alt-* 组合。
   * - 浏览器会先占用部分组合：Mod-Shift-C 在 Chromium/Edge 打开开发者工具（元素选择），
   *   Firefox 另占用 Mod-Shift-B（书签栏）、Mod-Shift-P（隐私窗口）、Mod-Shift-M（响应式设计）等，
   *   这些组合在编辑器内可能收不到。
   */
  shortcuts?: Readonly<Record<string, ExtensionShortcut>>
  /** 缺少 requires 中的 adapter 时总是隐藏，见 PanelDef */
  panels?: readonly PanelDef[]
  embeds?: readonly EmbedDef[]
  setup?(ctx: ExtensionContext): void | (() => void)
}

/**
 * 分组的 id 列表；字符串为单项一组，'*' 为其余全部条目（按 group 分组、order 排序）。
 * '*' 只能作为顶层条目，写在分组数组内（如 ['bold', '*']）时被当作普通 id 而匹配不到。
 * 只引用扩展 toolbar 的顶层条目 id；布局不影响快捷键（未列出的条目的快捷键仍然生效）。
 */
export type ToolbarLayout = ReadonlyArray<string | readonly string[]>
export type MissingAdapterPolicy = 'hide' | 'disable'

export function resolveText(text: MessageText, messages: Messages, ctx?: ExtensionContext): string {
  return typeof text === 'function' ? text(messages, ctx) : text
}

/**
 * 在 render 期间求值扩展文案：函数抛错（如读取 Messages 中不存在的键）时 console.error 并返回 fallback（通常为条目 id），
 * 不让一个扩展的文案拖垮整个编辑器。
 */
export function safeResolveText(
  text: MessageText,
  messages: Messages,
  ctx: ExtensionContext | undefined,
  extension: string,
  fallback: string,
): string {
  try {
    return resolveText(text, messages, ctx)
  } catch (error) {
    console.error(`[editorx] 扩展 ${extension} 的文案求值出错`, error)
    return fallback
  }
}
