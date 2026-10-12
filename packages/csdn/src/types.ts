import type { ThemeMode } from '@editorx/theme'
import type { DeepPartial, EditorDocument, EditorType, Messages } from '@editorx/toolbar'
import type { Ref } from 'react'

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
  locale?: DeepPartial<Messages>
  ref?: Ref<CsdnEditorHandle>
}
