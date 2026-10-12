import type { EditorDocument } from '@editorx/toolbar'
import { useImperativeHandle } from 'react'
import { cx } from './cx'
import type { CsdnEditorProps } from './types'

const EMPTY_DOCUMENT: EditorDocument = { editorType: 'markdown', title: '', html: '', markdown: '' }

export function CsdnEditor({ className, ref }: CsdnEditorProps) {
  useImperativeHandle(ref, () => ({ getDocument: () => EMPTY_DOCUMENT }), [])
  return <div className={cx('ex-csdn', className)} data-editor="markdown" />
}
