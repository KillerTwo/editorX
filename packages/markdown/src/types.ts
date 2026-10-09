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
  /** 替换全部内容（清空撤销历史），不触发 onChange；同时把内容记为已保存（下次编辑前不会自动保存） */
  setValue(markdown: string): void
  /** 当前内容的渲染 HTML（图表为占位块） */
  getHtml(): string
  getDocument(): EditorDocument
  /** markdown-core 命令名或 undo/redo；未知命令返回 false */
  runCommand(name: string, args?: unknown): boolean
  /** 在光标处插入（html 会转为 Markdown） */
  insert(content: InsertContent): void
  /**
   * 立即保存草稿（无改动也保存）；未配置 onSaveDraft 或失败时返回 false。
   * 已有保存进行中时排队一次后续保存，返回的 Promise 以后续保存的结果完成；可能在编辑器卸载后才完成。
   */
  saveDraft(): Promise<boolean>
  getEngine(): EditorEngine
}

export interface MarkdownEditorSlots {
  /** 模式切换右侧（CSDN：「使用富文本编辑器」） */
  headerEnd?: ReactNode
  /** 状态栏中部（CSDN：发文额度提示） */
  statusCenter?: ReactNode
  /** 状态栏右侧（CSDN：保存草稿、发布文章） */
  statusEnd?: ReactNode
}

export interface MarkdownEditorProps {
  /**
   * 受控内容。外部改动视同编辑（会被自动保存）；载入已保存的草稿请用 `ref.setValue`，它会把内容记为已保存。
   */
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
  /**
   * 自动保存间隔（ms），需 adapters.onSaveDraft；0、不设置、非有限值或超过 2147483647 为关闭。
   * 只在内容变化后保存；连续自动保存失败只提示一次（状态栏持续显示失败）。
   */
  autoSaveInterval?: number
  viewMode?: ViewMode
  defaultViewMode?: ViewMode
  onViewModeChange?(mode: ViewMode): void
  /** 初始打开的面板 id（如 'toc'），默认不打开 */
  defaultPanel?: string | null
  /** 是否显示右侧面板图标栏，默认 true */
  showRail?: boolean
  /** 比对模式编辑区所占比例（0.2–0.8），默认 0.5 */
  defaultSplit?: number
  /**
   * 首次渲染时传入 theme 或 defaultTheme（或没有外层 ThemeProvider）则编辑器自建 ThemeProvider，否则复用外层。
   * 该决定在组件实例生命周期内不变；复用外层时 theme/defaultTheme/onThemeChange/themeStorageKey 均被忽略
   * （之后才传入 theme/defaultTheme 时开发环境 console.warn 一次）。
   */
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  /**
   * 覆盖部分文案（叠加在外层 MessagesProvider / zhCN 之上）。请传稳定引用（模块常量或 useMemo）：
   * 内联对象每次渲染都会重新合并，工具栏与所有文案使用方随之重新渲染。
   */
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
