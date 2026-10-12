import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { RichTextEditor } from './rich-text-editor'

describe('稿纸标题', () => {
  it('空标题显示还需输入 5 个字，占位不是列表', () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    expect(input).toHaveAttribute('maxLength', '100')
    expect(input).toHaveAttribute('placeholder', '请输入文章标题（5～100个字）')
    expect(screen.getByText('还需输入5个字')).not.toHaveClass('is-over')
    const placeholder = container.querySelector('.ex-rte-placeholder')
    expect(placeholder?.tagName).toBe('P')
    expect(placeholder).toHaveTextContent('#创作灵感#')
    expect(container.querySelector('.ex-rte-placeholder ul')).toBeNull()
    expect(container.querySelector('.ex-rte-paper')).toBeInTheDocument()
  })

  it('键入停在 100，计数不带错误色', async () => {
    render(
      <StrictMode>
        <RichTextEditor />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    await userEvent.type(input, '1'.repeat(101))
    expect(input).toHaveValue('1'.repeat(100))
    expect(screen.getByText('100 / 100')).not.toHaveClass('is-over')
    expect(screen.queryByText('101/100')).toBeNull()
  })

  function Harness({ title }: { title: string }) {
    return (
      <StrictMode>
        <RichTextEditor title={title} />
      </StrictMode>
    )
  }

  it('受控超长标题显示错误色的 n/100', () => {
    const { rerender } = render(<Harness title={'字'.repeat(101)} />)
    expect(screen.getByText('101/100')).toHaveClass('is-over')
    rerender(<Harness title={'字'.repeat(100)} />)
    expect(screen.getByText('100 / 100')).not.toHaveClass('is-over')
  })
})
