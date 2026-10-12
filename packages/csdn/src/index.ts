import { RichTextEditor } from '@editorx/rich-text'
import './styles.css'

export { CsdnEditor } from './csdn-editor'
export { DRAFT_STORAGE_KEY } from './draft-backup'
export type { CsdnDraftBackup } from './draft-backup'
export type { CsdnEditorHandle, CsdnEditorProps } from './types'

// 静态引用富文本，产物里不能出现 import()
void RichTextEditor
