import type { EditorDocument } from '@editorx/toolbar'
import { CSDN_TITLE } from '../markdown/csdn-sample'

export const PARAGRAPHS = [
  '这是一份 Markdown 编辑器使用说明，介绍如何使用标题、列表、代码块、表格、公式和流程图等常用语法。',
  '编辑器支持实时预览与同步滚动，左侧书写、右侧即时渲染，并可通过工具栏快速插入图片、链接和代码片。',
  '文章写完后，在发布设置中补充标签、封面与摘要，选择文章类型和可见范围，即可一键发布或设置定时发布。',
  '摘要会在推荐和列表等场景外露，帮助读者快速了解内容；如果不填写，将默认提取正文前 256 个字作为摘要。',
] as const

const markdown = PARAGRAPHS.join('\n\n')
const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('')

/** 内联模式：富文本文档且正文无图片（参考截图 12-36-05 出自 CSDN 富文本编辑器，显示「暂无内容图片」） */
export const INLINE_DOC: EditorDocument = { editorType: 'richtext', title: CSDN_TITLE, html }

/** 模态模式：正文两张图片（参考截图 12-36-37 封面行右侧有缩略图） */
export const MODAL_DOC: EditorDocument = {
  editorType: 'markdown',
  title: CSDN_TITLE,
  markdown: `${markdown}\n\n![封面一](/publish/cover-a.svg)\n\n![封面二](/publish/cover-b.svg)`,
  html: `${html}<p><img src="/publish/cover-a.svg" alt="封面一"></p><p><img src="/publish/cover-b.svg" alt="封面二"></p>`,
}

export const WORD_COUNT = PARAGRAPHS.join('').length
