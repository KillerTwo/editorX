import type { EditorExtension, ToolbarLayout } from '@editorx/toolbar'
import { moreActionsExtension } from './actions'
import { codeExtension, listExtension, moreFormatExtension } from './blocks'
import { formatExtension } from './format'
import { imageExtension, linkExtension, moreInsertExtension } from './insert'
import { syntaxPanelExtension, tocPanelExtension } from './panels'

export const markdownCoreExtensions: readonly EditorExtension[] = [
  formatExtension,
  listExtension,
  codeExtension,
  moreFormatExtension,
  imageExtension,
  linkExtension,
  moreInsertExtension,
  moreActionsExtension,
  tocPanelExtension,
  syntaxPanelExtension,
]

/** CSDN Markdown 编辑器工具栏；csdn:* 由宿主扩展提供，缺失时跳过 */
export const MARKDOWN_TOOLBAR_LAYOUT: ToolbarLayout = [
  ['bold', 'italic', 'heading', 'strikethrough'],
  ['list', 'code', 'more-format'],
  ['image', 'link', 'more-insert'],
  ['csdn:template', 'csdn:history', 'more-actions'],
  '*',
]

export {
  codeExtension,
  formatExtension,
  imageExtension,
  linkExtension,
  listExtension,
  moreActionsExtension,
  moreFormatExtension,
  moreInsertExtension,
  syntaxPanelExtension,
  tocPanelExtension,
}
