import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'
import { renderWithTheme } from './test-utils'

describe('Button', () => {
  it('默认 type=button，带默认变体与尺寸类名', () => {
    renderWithTheme(<Button>保存草稿</Button>)
    const btn = screen.getByRole('button', { name: '保存草稿' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveClass('ex-btn', 'ex-btn--default', 'ex-btn--md')
  })

  it('应用 variant 与 size', () => {
    renderWithTheme(<Button variant="primary" size="lg">发布文章</Button>)
    expect(screen.getByRole('button')).toHaveClass('ex-btn--primary', 'ex-btn--lg')
  })

  it('点击触发 onClick', async () => {
    const onClick = vi.fn()
    renderWithTheme(<Button onClick={onClick}>点我</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('loading 时禁用并标记 aria-busy', async () => {
    const onClick = vi.fn()
    renderWithTheme(<Button loading onClick={onClick}>发布</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('渲染 icon', () => {
    renderWithTheme(<Button icon={<svg data-testid="icon" />}>上传</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
