import { htmlToText } from '@editorx/publish'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { countRichTextChars } from '@editorx/rich-text'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'

async function openMarkdownPublish(user: ReturnType<typeof userEvent.setup>, publishButton: Element) {
  await user.click(publishButton)
  expect(await screen.findByRole('dialog', { name: '发布文章' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '发布文章' }))
}

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
    await openMarkdownPublish(user, container.querySelector('.ex-csdn__publish')!)
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
    await openMarkdownPublish(user, container.querySelector('.ex-csdn__publish')!)
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
    await openMarkdownPublish(user, container.querySelector('.ex-csdn__publish')!)
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
    await openMarkdownPublish(user, container.querySelector('.ex-csdn__publish')!)
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
    expect(onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ title: '足够长的标题', markdown: 'Hello', tags: ['jvm'], editorType: 'markdown' }),
    )
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(container.querySelector('.ex-pub-card')).toBeNull()
  })

  it('没有标签时先打开发布设置，不直接提示缺少标签', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    await user.click(container.querySelector('.ex-csdn__publish')!)
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    expect(dialog).toHaveTextContent('文章标签')
    expect(screen.queryByText('请至少添加 1 个文章标签')).toBeNull()
    expect(onPublish).not.toHaveBeenCalled()
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

  it('传入封面模式后，无封面可以切到单图并出现上传位', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '', html: '<p></p>' }}
          initialSettings={{ cover: { mode: 'none', urls: [] } }}
          coverModes={['none', 'single', 'triple']}
          adapters={{ uploadImage: async () => ({ url: 'https://example.com/a.png' }) }}
        />
      </StrictMode>,
    )
    expect(screen.queryByLabelText('从本地上传')).toBeNull()
    await user.click(screen.getByRole('radio', { name: '单图' }))
    expect(screen.getByLabelText('从本地上传')).toBeInTheDocument()
  })
})
