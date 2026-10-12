import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'
import { createRef } from 'react'

describe('只挂载一个编辑器', () => {
  it('默认挂载 Markdown，标题输入写回 getDocument', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor ref={ref} defaultTheme="light" initialDocument={{ editorType: 'markdown', title: '栏内标题', markdown: 'Hello', html: '' }} />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-mde')).not.toBeNull()
    expect(container.querySelector('.ex-rte')).toBeNull()
    expect(container.querySelector('.ex-rte-title__input')).toBeNull()
    const input = screen.getByRole('textbox', { name: '文章标题' })
    expect(input).toHaveValue('栏内标题')
    await user.clear(input)
    await user.type(input, '新的标题')
    await waitFor(() => expect(ref.current?.getDocument().title).toBe('新的标题'))
    expect(ref.current?.getDocument().editorType).toBe('markdown')
    expect(ref.current?.getDocument().markdown).toContain('Hello')
  })

  it('defaultEditor=richtext 只挂载稿纸标题', () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '稿纸标题', html: '<p>Hi</p>' }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-rte')).not.toBeNull()
    expect(container.querySelector('.ex-mde')).toBeNull()
    expect(container.querySelector('.ex-csdn__bar input')).toBeNull()
    const titles = screen.getAllByRole('textbox', { name: '文章标题' })
    expect(titles).toHaveLength(1)
    expect(titles[0]).toHaveValue('稿纸标题')
    expect(titles[0]).toHaveClass('ex-rte-title__input')
  })
})
