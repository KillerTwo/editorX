import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatePicker, type DatePickerProps } from './date-picker'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

function Harness({ onChange, value: initial, ...props }: Partial<DatePickerProps>) {
  const [value, setValue] = useState(initial)
  return (
    <DatePicker
      label="发布日期"
      placeholder="选择日期"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const day = (name: string) => within(screen.getByRole('dialog', { name: '发布日期' })).getByRole('button', { name })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
})
afterEach(() => vi.useRealTimers())

describe('DatePicker', () => {
  it('打开：焦点在今天，今天 aria-current，区间外日期禁用', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-10-16" />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    expect(trigger).toHaveTextContent('选择日期')
    expect(trigger).toHaveClass('ex-picker-input', 'ex-date-picker', 'is-placeholder')
    await userEvent.click(trigger)
    await waitFor(() => expect(day('2026-10-09')).toHaveFocus())
    expect(day('2026-10-09')).toHaveAttribute('aria-current', 'date')
    expect(day('2026-10-08')).toBeDisabled()
    expect(day('2026-10-17')).toBeDisabled()
    expect(day('2026-10-16')).toBeEnabled()
    expect(screen.getByText('2026 年 10 月')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['日', '一', '二', '三', '四', '五', '六'])
  })

  it('键盘：方向键 / Home / End / PageDown 移动焦点并夹在 [min, max]；Enter 选中并关闭、焦点回到触发器', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-10-16" onChange={onChange} />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    await userEvent.click(trigger)
    await waitFor(() => expect(day('2026-10-09')).toHaveFocus())
    await userEvent.keyboard('{ArrowRight}')
    expect(day('2026-10-10')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(day('2026-10-16')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(day('2026-10-09')).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(day('2026-10-10')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(day('2026-10-09')).toHaveFocus()
    await userEvent.keyboard('{PageDown}')
    expect(day('2026-10-16')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('2026-10-16')
    expect(screen.queryByRole('dialog', { name: '发布日期' })).toBeNull()
    expect(trigger).toHaveTextContent('2026-10-16')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('点击禁用日期无效；点击可用日期选中', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-10-16" onChange={onChange} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await userEvent.click(day('2026-10-08'))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(day('2026-10-12'))
    expect(onChange).toHaveBeenCalledWith('2026-10-12')
  })

  it('翻页按钮：目标月整体越界时禁用；翻到下月焦点夹到 max', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-11-02" />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    const dialog = await screen.findByRole('dialog', { name: '发布日期' })
    expect(within(dialog).getByRole('button', { name: '上个月' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '前一年' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '后一年' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: '下个月' }))
    expect(within(dialog).getByText('2026 年 11 月')).toBeInTheDocument()
    expect(day('2026-11-02')).toHaveAttribute('tabindex', '0')
    expect(within(dialog).getByRole('button', { name: '下个月' })).toBeDisabled()
    // 翻页后按钮已禁用、无法保留焦点，焦点落到网格中的当前日
    expect(day('2026-11-02')).toHaveFocus()
  })

  it('翻页按钮保留焦点：在「下个月」上按两次 Enter 前进两个月且不选中日期', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness onChange={onChange} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await waitFor(() => expect(day('2026-10-09')).toHaveFocus())
    const dialog = screen.getByRole('dialog', { name: '发布日期' })
    const next = within(dialog).getByRole('button', { name: '下个月' })
    act(() => next.focus())
    await userEvent.keyboard('{Enter}{Enter}')
    expect(within(dialog).getByText('2026 年 12 月')).toBeInTheDocument()
    expect(next).toHaveFocus()
    expect(day('2026-12-09')).toHaveAttribute('tabindex', '0')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '发布日期' })).toBeInTheDocument()
    await userEvent.keyboard('{Tab}')
    expect(within(dialog).getByRole('button', { name: '后一年' })).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    expect(day('2026-12-09')).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(day('2026-12-08')).toHaveFocus()
  })

  it('触发器：名称为 label，所选日期作为描述', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness value="2026-10-12" />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    expect(trigger).toHaveAccessibleName('发布日期')
    expect(trigger).toHaveAccessibleDescription('2026-10-12')
  })

  it('星期标签可重复（如英文单字母）', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithTheme(
      <StrictMode>
        <Harness labels={{ weekdays: 'S,M,T,W,T,F,S' }} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
    expect(error).not.toHaveBeenCalled()
  })

  it('已有值越界时打开焦点夹回区间内', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness value="2026-12-01" min="2026-10-09" max="2026-10-16" />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await waitFor(() => expect(day('2026-10-16')).toHaveFocus())
  })

  it('Esc 只关闭日历，不关闭外层 Modal', async () => {
    const onClose = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Modal open onClose={onClose} title="外层">
          <Harness />
        </Modal>
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await screen.findByRole('dialog', { name: '发布日期' })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '发布日期' })).toBeNull()
    expect(screen.getByRole('dialog', { name: '外层' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disabled：不可打开', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness disabled />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(screen.queryByRole('dialog', { name: '发布日期' })).toBeNull()
  })
})
