import type { ThemeMode } from '@editorx/theme'
import type { EditorDocument } from '@editorx/toolbar'
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
  ref?: Ref<CsdnEditorHandle>
}
