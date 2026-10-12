import { htmlToText } from '@editorx/publish'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { countRichTextChars } from '@editorx/rich-text'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'

describe('外壳发布', () => {
  it('五个空格在计数里是 5 / 100，发布仍提示标题不合规', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '     ', markdown: 'Hello', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('5 / 100')
    expect(container.querySelector('.ex-csdn-title__count')).not.toHaveClass('is-over')
    await user.click(container.querySelector('.ex-csdn__publish')!)
    expect(await screen.findByText('文章标题需为 5～100 个字')).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('abcd 显示还需输入 1 个字，并且不调用 onPublish', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: 'abcd', markdown: 'Hello', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('还需输入1个字')
    await user.click(container.querySelector('.ex-csdn__publish')!)
    expect(await screen.findByText('文章标题需为 5～100 个字')).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('空正文不调用 onPublish', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: '', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    await waitFor(() => expect(htmlToText(ref.current!.getDocument().html)).toBe(''))
    await user.click(container.querySelector('.ex-csdn__publish')!)
    expect(await screen.findByText('正文不能为空')).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('标题、正文和标签都在时，onPublish 收到文档和设置', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    await waitFor(() => expect(htmlToText(ref.current!.getDocument().html)).not.toBe(''))
    await user.click(container.querySelector('.ex-csdn__publish')!)
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
    expect(onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ title: '足够长的标题', markdown: 'Hello', tags: ['jvm'], editorType: 'markdown' }),
    )
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(container.querySelector('.ex-pub-card')).toBeNull()
  })

  it('富文本把发布卡片放进滚动容器，固定栏挂到 bar host', async () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '', html: '<p>a b</p>' }}
        />
      </StrictMode>,
    )
    expect(countRichTextChars('<p>a b</p>')).toBe(2)
    expect(countRichTextChars('<p>你好 世界</p>')).toBe(4)
    const card = container.querySelector('.ex-pub-card')
    expect(card?.closest('.ex-rte__scroll')).not.toBeNull()
    await waitFor(() => {
      expect(container.querySelector('.ex-pub-bar.is-fixed')?.parentElement).toHaveClass('ex-rte-bar-host')
    })
    expect(container.querySelector('.ex-csdn-words')).toHaveTextContent(/共 \d+ 字/)
  })
})
