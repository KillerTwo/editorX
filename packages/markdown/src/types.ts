import type { EditorEngine } from '@editorx/markdown-core'
import type { ThemeMode } from '@editorx/theme'
import type {
  DeepPartial,
  EditorAdapters,
  EditorDocument,
  EditorExtension,
  InsertContent,
  Messages,
  MissingAdapterPolicy,
  ToolbarLayout,
} from '@editorx/toolbar'
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
  /** 在光标处插入（html 会转为 Markdown） */
  insert(content: InsertContent): void
  getEngine(): EditorEngine
}

export interface MarkdownEditorSlots {
  /** 模式切换右侧（CSDN：「使用富文本编辑器」） */
  headerEnd?: ReactNode
}

export interface MarkdownEditorProps {
  value?: string
  defaultValue?: string
  /** 防抖渲染完成后调用，html 为同一次渲染结果；卸载时若有尚未发出的编辑，会同步再调用一次 */
  onChange?(markdown: string, html: string): void
  /** 写入 getDocument().title */
  title?: string
  /** 宿主能力（图片上传、保存草稿等）；缺失项对应功能按 missingAdapter 隐藏/禁用 */
  adapters?: EditorAdapters
  /** 追加的扩展（同名替换内置） */
  extensions?: readonly EditorExtension[]
  /** 替换整套内置扩展，默认 markdownCoreExtensions */
  coreExtensions?: readonly EditorExtension[]
  /** 默认 MARKDOWN_TOOLBAR_LAYOUT */
  toolbarLayout?: ToolbarLayout
  /** 缺失 adapter 的扩展：隐藏（默认）或禁用 */
  missingAdapter?: MissingAdapterPolicy
  viewMode?: ViewMode
  defaultViewMode?: ViewMode
  onViewModeChange?(mode: ViewMode): void
  /**
   * 首次渲染时传入 theme 或 defaultTheme（或没有外层 ThemeProvider）则编辑器自建 ThemeProvider，否则复用外层。
   * 该决定在组件实例生命周期内不变；复用外层时 theme/defaultTheme/onThemeChange/themeStorageKey 均被忽略。
   */
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
  /**
   * 自定义引擎工厂；每个组件实例只采用首次结果（StrictMode 下可能被调用两次）。
   * 在 render 期间调用（服务端渲染时也会调用），必须无副作用且不访问 DOM；挂载在 effect 中进行。
   */
  engine?: () => EditorEngine
  slots?: MarkdownEditorSlots
  className?: string
  ref?: Ref<MarkdownEditorHandle>
}
