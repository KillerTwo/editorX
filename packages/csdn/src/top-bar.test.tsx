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
})
