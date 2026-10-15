import type { ThemeMode } from '@geekx/theme'
import type {
  DeepPartial,
  EditorAdapters,
  EditorDocument,
  EditorExtension,
  InsertContent,
  Messages,
  MissingAdapterPolicy,
  ToolbarLayout,
} from '@geekx/toolbar'
import type { ReactNode, Ref } from 'react'

export interface RichTextEditorSlots {
  /** 标题行魔杖位置。不传时组件自己渲染 32×32 的「AI 标题」按钮（无 aiAssist 行为） */
  titleActions?: ReactNode
  /** 稿纸下方、滚动容器内部。playground 在这里放 PublishPanel */
  afterPaper?: ReactNode
  /** 右侧抽屉收起后的浮层。阶段 7 放 AI 菜单；playground 放 104×159 占位 */
  rightCollapsed?: ReactNode
}

export interface RichTextEditorHandle {
  focus(): void
  getValue(): string
  /** 替换 HTML，不触发 onChange */
  setValue(html: string): void
  getDocument(): EditorDocument
  insert(content: InsertContent): void
}

export interface RichTextEditorProps {
  value?: string
  defaultValue?: string
  onChange?(html: string): void
  title?: string
  defaultTitle?: string
  onTitleChange?(title: string): void
  /** 非空白字数。首次挂载和每次 HTML 变化时调用 */
  onWordCount?(count: number): void
  adapters?: EditorAdapters
  extensions?: readonly EditorExtension[]
  /** 默认 richTextCoreExtensions */
  coreExtensions?: readonly EditorExtension[]
  /** 默认 RICH_TEXT_TOOLBAR_LAYOUT */
  toolbarLayout?: ToolbarLayout
  missingAdapter?: MissingAdapterPolicy
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  locale?: DeepPartial<Messages>
  readOnly?: boolean
  /** 编辑区 aria-label，默认 messages.richText.editable */
  ariaLabel?: string
  /** 根高度，默认 '100%' */
  height?: number | string
  /** 右侧抽屉，默认展开。受控时传 rightOpen + onRightOpenChange */
  defaultRightOpen?: boolean
  rightOpen?: boolean
  onRightOpenChange?(open: boolean): void
  /** 左侧目录，默认展开 */
  defaultTocOpen?: boolean
  slots?: RichTextEditorSlots
  className?: string
  ref?: Ref<RichTextEditorHandle>
}
