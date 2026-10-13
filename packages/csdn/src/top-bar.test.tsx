import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'

describe('顶栏', () => {
  it('高 56 且没有下边框，返回会调用 onBack', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const { container } = render(
      <StrictMode>
        <CsdnEditor defaultTheme="light" onBack={onBack} />
      </StrictMode>,
    )
    const bar = container.querySelector('.ex-csdn__bar')
    expect(bar).not.toBeNull()
    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '保存草稿' })).toHaveClass('ex-csdn__draft')
    expect(screen.getByRole('button', { name: '切换编辑器' })).toHaveClass('ex-csdn__switch')
    expect(screen.getByRole('button', { name: '发布' })).toHaveClass('ex-csdn__publish')
    expect(screen.getByRole('button', { name: '切换到暗黑模式' })).toBeInTheDocument()
  })

  it('showThemeToggle 为 false 时不渲染主题按钮', () => {
    render(
      <StrictMode>
        <CsdnEditor defaultTheme="light" showThemeToggle={false} />
      </StrictMode>,
    )
    expect(screen.queryByRole('button', { name: '切换到暗黑模式' })).toBeNull()
  })

  it('Markdown 顶栏按码点计数，超长使用 is-over', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <StrictMode>
        <CsdnEditor defaultTheme="light" initialDocument={{ editorType: 'markdown', title: '', html: '' }} />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('还需输入5个字')
    await user.type(input, 'abcd')
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('还需输入1个字')
    await user.type(input, 'e')
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('5 / 100')
    await user.clear(input)
    await user.type(input, '     ')
    const spaces = container.querySelector('.ex-csdn-title__count')
    expect(spaces).toHaveTextContent('5 / 100')
    expect(spaces).not.toHaveClass('is-over')
    await user.clear(input)
    await user.type(input, 'a'.repeat(101))
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('101/100')
    expect(container.querySelector('.ex-csdn-title__count')).toHaveClass('is-over')
  })

  it('富文本模式的顶栏不放标题输入', () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '稿纸标题', html: '' }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-editor', 'richtext')
    expect(container.querySelector('.ex-csdn__bar input')).toBeNull()
    expect(container.querySelector('.ex-csdn-title__count')).toBeNull()
    expect(container.querySelector('.ex-csdn__publish')).toBeNull()
    expect(container.querySelector('.ex-pub-bar')).not.toBeNull()
  })
})
