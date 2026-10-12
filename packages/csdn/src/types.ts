import type { EditorDocument } from '@editorx/toolbar'
import type { Ref } from 'react'

export interface CsdnEditorHandle {
  getDocument(): EditorDocument
}

export interface CsdnEditorProps {
  className?: string
  ref?: Ref<CsdnEditorHandle>
}
