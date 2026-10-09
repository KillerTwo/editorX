import type { ThemeMode } from '@editorx/theme'
import type {
  CoverMode,
  DeepPartial,
  EditorAdapters,
  EditorDocument,
  Messages,
  MissingAdapterPolicy,
  PublishOption,
  PublishPayload,
  PublishSettings,
} from '@editorx/toolbar'
import type { ReactNode } from 'react'
import type { PublishRules } from './validate'

export type PublishVariant = 'inline' | 'modal'

export interface AgreementLinks {
  terms?: string
  privacy?: string
}

export interface PublishBaseProps {
  value?: PublishSettings
  defaultValue?: Partial<PublishSettings>
  onChange?(settings: PublishSettings): void
  /** 当前文章：用于标题校验、摘要提取、正文图片封面与 payload */
  document?: EditorDocument
  adapters?: EditorAdapters
  /** 缺失 adapter 时隐藏还是禁用对应功能，默认 'hide' */
  missingAdapter?: MissingAdapterPolicy
  /** 覆盖内置校验规则：函数替换，false 关闭 */
  rules?: PublishRules
  /** 可选封面模式；默认 ['single']（CSDN 截图无模式切换），多于一项时显示单选 */
  coverModes?: readonly CoverMode[]
  /** 文章模板选项；默认 默认模板 / 简洁模板 / 墨衍模板（禁用） */
  templates?: readonly PublishOption[]
  /** GitCode 协议链接；未提供时渲染为纯文本 */
  agreementLinks?: AgreementLinks
  onPublished?(payload: PublishPayload): void
  locale?: DeepPartial<Messages>
  /**
   * 首次渲染时传入 theme 或 defaultTheme（或没有外层 ThemeProvider）则自建 ThemeProvider，否则复用外层。
   */
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  className?: string
}

export interface PublishPanelSlots {
  /** 内联操作栏左侧内容（CSDN：字数、回到顶部等） */
  barStart?: ReactNode
}

export interface PublishPanelProps extends PublishBaseProps {
  slots?: PublishPanelSlots
}

export interface PublishModalProps extends PublishBaseProps {
  open: boolean
  onClose(): void
}
