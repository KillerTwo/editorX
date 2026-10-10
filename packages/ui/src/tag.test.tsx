import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tag } from './tag'
import { renderWithTheme } from './test-utils'

describe('Tag', () => {
  it('渲染文本，默认不可关闭', () => {
    renderWithTheme(<Tag>React</Tag>)
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('closable 时点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn()
    renderWithTheme(<Tag closable onClose={onClose}>Next.js</Tag>)
    await userEvent.click(screen.getByRole('button', { name: '删除标签 Next.js' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('支持自定义关闭文案', () => {
    renderWithTheme(<Tag closable closeLabel="Remove">Vue</Tag>)
    expect(screen.getByRole('button', { name: 'Remove Vue' })).toBeInTheDocument()
  })

  it('variant="primary" 加 ex-tag--primary；默认无该类', () => {
    const { container } = renderWithTheme(
      <StrictMode>
        <Tag variant="primary" closable>jvm</Tag>
        <Tag>React</Tag>
      </StrictMode>,
    )
    const [primary, plain] = container.querySelectorAll('.ex-tag')
    expect(primary).toHaveClass('ex-tag--primary')
    expect(plain).not.toHaveClass('ex-tag--primary')
    expect(screen.getByRole('button', { name: '删除标签 jvm' })).toBeInTheDocument()
  })
})
