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
import type { PublishHiddenField } from '@editorx/publish'
import type { ReactNode, Ref } from 'react'

export interface CsdnEditorHandle {
  getDocument(): EditorDocument
  getSettings(): PublishSettings
  saveDraft(): Promise<boolean>
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
  autoSaveInterval?: number
  initialUpdatedAt?: number
  draftStorageKey?: string
  slots?: { publishBarStart?: ReactNode; rightCollapsed?: ReactNode }
  ref?: Ref<CsdnEditorHandle>
  hiddenFields?: readonly PublishHiddenField[]
  categorySelection?: 'multiple' | 'single'
}
