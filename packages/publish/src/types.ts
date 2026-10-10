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
import type { ScheduleRange } from './schedule'
import type { PublishRules } from './validate'

export type PublishVariant = 'inline' | 'modal'

export interface AgreementLinks {
  terms?: string
  privacy?: string
}

export interface PublishBaseProps {
  value?: PublishSettings
  defaultValue?: Partial<PublishSettings>
  /** 受控时需在回调中同步应用新值（不要放进 transition 或异步更新） */
  onChange?(settings: PublishSettings): void
  /** 当前文章：用于标题校验、摘要提取、正文图片封面与 payload */
  document?: EditorDocument
  adapters?: EditorAdapters
  /** 缺失 adapter 时隐藏还是禁用对应功能，默认 'hide' */
  missingAdapter?: MissingAdapterPolicy
  /**
   * 覆盖内置校验规则：函数替换，false 关闭。
   * 定时发布弹窗按 scheduleRange 限制可选日期与时间，放宽 scheduledAt 规则时应同时传入相应的 scheduleRange。
   */
  rules?: PublishRules
  /**
   * 定时发布允许的提前量区间，默认 4 小时 ～ 7 天（CSDN）；两端为整分钟且 0 ≤ min ≤ max，否则回退默认值。
   * 同时约束内置校验与定时发布弹窗的可选日期 / 时间。
   */
  scheduleRange?: ScheduleRange
  /** 可选封面模式；默认 ['single']（CSDN 截图无模式切换），多于一项时显示单选 */
  coverModes?: readonly CoverMode[]
  /** 文章模板选项；默认 默认模板 / 简洁模板 / 墨衍模板（仅 Markdown 文档可选） */
  templates?: readonly PublishOption[]
  /** GitCode 协议链接；未提供时渲染为纯文本 */
  agreementLinks?: AgreementLinks
  /**
   * 发布成功后调用；抛出的异常不会显示为发布失败。
   * PublishModal：若发起发布后弹窗一直开着，会先调用 onClose 再调用它；请求期间关闭过弹窗则只调用它，不再调用 onClose。
   */
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
