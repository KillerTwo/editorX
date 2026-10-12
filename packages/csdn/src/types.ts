import type { ThemeMode } from '@editorx/theme'
import type {
  DeepPartial,
  EditorAdapters,
  EditorDocument,
  EditorExtension,
  EditorType,
  Messages,
  PublishSettings,
  ToolbarLayout,
} from '@editorx/toolbar'
import type { ReactNode, Ref } from 'react'

export interface CsdnEditorHandle {
  getDocument(): EditorDocument
}

export interface CsdnEditorProps {
  className?: string
  onBack?: () => void
  showThemeToggle?: boolean
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?: (mode: ThemeMode) => void
  initialDocument?: EditorDocument
  defaultEditor?: EditorType
  extensions?: readonly EditorExtension[]
  toolbarLayout?: ToolbarLayout
  defaultRightOpen?: boolean
  defaultTocOpen?: boolean
  onEditorTypeChange?: (editorType: EditorType) => void
  locale?: DeepPartial<Messages>
  adapters?: EditorAdapters
  initialSettings?: Partial<PublishSettings>
  slots?: { publishBarStart?: ReactNode }
  ref?: Ref<CsdnEditorHandle>
}
