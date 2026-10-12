import { htmlToMarkdown } from '@editorx/markdown-core'
import type { EditorDocument } from '@editorx/toolbar'

export function switchedDocument(doc: EditorDocument): EditorDocument {
  if (doc.editorType === 'markdown') {
    return { editorType: 'richtext', title: doc.title, html: doc.html, markdown: undefined }
  }
  return {
    editorType: 'markdown',
    title: doc.title,
    markdown: htmlToMarkdown(doc.html),
    html: doc.html,
  }
}
