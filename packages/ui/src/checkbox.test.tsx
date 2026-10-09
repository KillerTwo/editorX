import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './checkbox'
import { renderWithTheme } from './test-utils'

describe('Checkbox', () => {
  it('点击文字切换，回调新值', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Checkbox checked={false} onChange={onChange}>
          同时备份到GitCode
        </Checkbox>
      </StrictMode>,
    )
    const box = screen.getByRole('checkbox', { name: '同时备份到GitCode' })
    expect(box).not.toBeChecked()
    expect(box.closest('label')).toHaveClass('ex-checkbox')
    await userEvent.click(screen.getByText('同时备份到GitCode'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('选中态 is-checked；禁用时不回调；无 children 用 label 作名称', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Checkbox checked onChange={onChange} disabled label="专栏 A" />
      </StrictMode>,
    )
    const box = screen.getByRole('checkbox', { name: '专栏 A' })
    expect(box).toBeChecked()
    expect(box).toBeDisabled()
    expect(box.closest('label')).toHaveClass('is-checked', 'is-disabled')
    await userEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
  })
})
