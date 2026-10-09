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
  /** 如 'Mod-B'、'Mod-Shift-K'；Mod 在 mac 上为 ⌘，其他平台为 Ctrl */
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

export interface ToolbarSeparator {
  type: 'separator'
  id?: string
}

export type ToolbarItem = ToolbarButton | ToolbarDropdown | ToolbarPopover | ToolbarModal | ToolbarSeparator
export type ToolbarActionItem = Exclude<ToolbarItem, ToolbarSeparator>

export interface PanelDef {
  id: string
  title: MessageText
  icon?: ReactNode
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
  toolbar?: readonly ToolbarItem[]
  shortcuts?: Readonly<Record<string, ExtensionShortcut>>
  panels?: readonly PanelDef[]
  embeds?: readonly EmbedDef[]
  setup?(ctx: ExtensionContext): void | (() => void)
}

/** 分组的 id 列表；字符串为单项一组，'*' 为其余全部条目 */
export type ToolbarLayout = ReadonlyArray<string | readonly string[]>
export type MissingAdapterPolicy = 'hide' | 'disable'

export function resolveText(text: MessageText, messages: Messages, ctx?: ExtensionContext): string {
  return typeof text === 'function' ? text(messages, ctx) : text
}
