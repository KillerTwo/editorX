import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'
import { renderWithTheme } from './test-utils'

describe('ThemeToggle', () => {
  it('明亮模式下显示"切换到暗黑模式"，点击后切换', async () => {
    renderWithTheme(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: '切换到暗黑模式' }))
    expect(document.querySelector('.ex-root')).toHaveAttribute('data-ex-theme', 'dark')
    expect(screen.getByRole('button', { name: '切换到明亮模式' })).toBeInTheDocument()
  })

  it('支持自定义文案', () => {
    renderWithTheme(<ThemeToggle labels={{ toLight: 'Light', toDark: 'Dark' }} />)
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
  })
})
