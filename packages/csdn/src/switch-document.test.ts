import { htmlToMarkdown } from '@geekx/markdown-core'
import { describe, expect, it } from 'vitest'
import { switchedDocument } from './switch-document'

describe('switchedDocument', () => {
  it('Markdown 把当前 html 交给富文本，并丢掉 markdown 字段', () => {
    expect(
      switchedDocument({ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '<p>Hello</p>' }),
    ).toEqual({ editorType: 'richtext', title: '足够长的标题', html: '<p>Hello</p>', markdown: undefined })
  })

  it('富文本用 htmlToMarkdown 生成 Markdown，标题保留', () => {
    const html = '<p>Hello</p>'
    expect(switchedDocument({ editorType: 'richtext', title: '足够长的标题', html, markdown: undefined })).toEqual({
      editorType: 'markdown',
      title: '足够长的标题',
      markdown: htmlToMarkdown(html),
      html,
    })
  })
})
