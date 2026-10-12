import { htmlToMarkdown } from '@editorx/markdown-core'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'

async function confirm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: '切换编辑器' })
  await user.click(within(dialog).getByRole('button', { name: '确定' }))
}

describe('切换编辑器', () => {
  it('脏文档仍要确认，取消后留在 Markdown 且不转换', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const onEditorTypeChange = vi.fn()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          onEditorTypeChange={onEditorTypeChange}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '<p>Hello</p>' }}
        />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    await user.type(input, '呀')
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    const dialog = await screen.findByRole('dialog', { name: '切换编辑器' })
    await user.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '切换编辑器' })).toBeNull()
    expect(container.querySelector('.ex-mde')).not.toBeNull()
    expect(container.querySelector('.ex-rte')).toBeNull()
    expect(ref.current?.getDocument().editorType).toBe('markdown')
    expect(ref.current?.getDocument().title).toBe('足够长的标题呀')
    expect(ref.current?.getDocument().markdown).toContain('Hello')
    expect(onEditorTypeChange).not.toHaveBeenCalled()
  })

  it('确认后把 Markdown 的 html 交给富文本，标题仍是同一个', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const onEditorTypeChange = vi.fn()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          onEditorTypeChange={onEditorTypeChange}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    await waitFor(() => expect(ref.current!.getDocument().html).not.toBe(''))
    const before = ref.current!.getDocument()
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    await confirm(user)
    await waitFor(() => expect(container.querySelector('.ex-rte')).not.toBeNull())
    expect(container.querySelector('.ex-mde')).toBeNull()
    expect(container.querySelector('.ex-csdn__bar input')).toBeNull()
    expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('足够长的标题')
    expect(ref.current?.getDocument()).toMatchObject({
      editorType: 'richtext',
      title: before.title,
      html: before.html,
      markdown: undefined,
    })
    expect(onEditorTypeChange).toHaveBeenCalledWith('richtext')
  })

  it('确认后富文本经 htmlToMarkdown 进入 Markdown', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const html = '<p>Hello</p>'
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '足够长的标题', html }}
        />
      </StrictMode>,
    )
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    await confirm(user)
    await waitFor(() => expect(container.querySelector('.ex-mde')).not.toBeNull())
    expect(container.querySelector('.ex-rte')).toBeNull()
    expect(ref.current?.getDocument().editorType).toBe('markdown')
    expect(ref.current?.getDocument().title).toBe('足够长的标题')
    expect(ref.current?.getDocument().markdown).toBe(htmlToMarkdown(html))
  })
})
