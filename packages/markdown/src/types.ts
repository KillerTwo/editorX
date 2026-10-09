import type { EditorEngine } from '@editorx/markdown-core'
import type { ThemeMode } from '@editorx/theme'
import type { DeepPartial, EditorDocument, Messages } from '@editorx/toolbar'
import type { ReactNode, Ref } from 'react'

export type ViewMode = 'edit' | 'split' | 'preview'

export interface MarkdownEditorHandle {
  focus(): void
  getValue(): string
  /** 替换全部内容（清空撤销历史），不触发 onChange */
  setValue(markdown: string): void
  /** 当前内容的渲染 HTML（图表为占位块） */
  getHtml(): string
  getDocument(): EditorDocument
  /** markdown-core 命令名或 undo/redo；未知命令返回 false */
  runCommand(name: string, args?: unknown): boolean
  getEngine(): EditorEngine
}

export interface MarkdownEditorSlots {
  /** 模式切换右侧（CSDN：「使用富文本编辑器」） */
  headerEnd?: ReactNode
}

export interface MarkdownEditorProps {
  value?: string
  defaultValue?: string
  /** 防抖渲染完成后调用，html 为同一次渲染结果 */
  onChange?(markdown: string, html: string): void
  /** 写入 getDocument().title */
  title?: string
  viewMode?: ViewMode
  defaultViewMode?: ViewMode
  onViewModeChange?(mode: ViewMode): void
  /** 传入 theme 或 defaultTheme 时编辑器自建 ThemeProvider，否则复用外层 */
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  locale?: DeepPartial<Messages>
  readOnly?: boolean
  placeholder?: string
  /** 编辑区 aria-label，默认 messages.editor.ariaLabel */
  ariaLabel?: string
  /** 编辑器总高度，默认 100% */
  height?: number | string
  /** 自定义引擎工厂；每个组件实例只采用首次结果（StrictMode 下可能被调用两次） */
  engine?: () => EditorEngine
  slots?: MarkdownEditorSlots
  className?: string
  ref?: Ref<MarkdownEditorHandle>
}
