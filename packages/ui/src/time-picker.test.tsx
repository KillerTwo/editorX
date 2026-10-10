import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from './test-utils'
import { TimePicker, timeSlots } from './time-picker'

describe('TimePicker', () => {
  it('timeSlots：默认 30 分钟一档，共 48 个', () => {
    const slots = timeSlots()
    expect(slots).toHaveLength(48)
    expect(slots[0]).toBe('00:00')
    expect(slots[1]).toBe('00:30')
    expect(slots.at(-1)).toBe('23:30')
    expect(timeSlots(60)).toHaveLength(24)
  })

  it('timeSlots：步长必须是有限正数', () => {
    for (const step of [0, -30, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => timeSlots(step), String(step)).toThrow(RangeError)
    }
  })

  it('时钟前缀、无下拉箭头；禁用选项不可选；选择后回调', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <TimePicker
          label="发布时间"
          placeholder="选择时间"
          value={undefined}
          onChange={onChange}
          options={[{ value: '15:30', disabled: true }, { value: '16:00' }]}
        />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '发布时间' })
    expect(trigger).toHaveClass('ex-select', 'ex-picker-input', 'ex-time-picker')
    expect(trigger.querySelector('.ex-select__prefix svg')).not.toBeNull()
    expect(trigger.querySelector('.ex-select__arrow')).toBeNull()
    expect(trigger).toHaveTextContent('选择时间')
    await userEvent.click(trigger)
    expect(screen.getByRole('option', { name: '15:30' })).toBeDisabled()
    await userEvent.click(screen.getByRole('option', { name: '16:00' }))
    expect(onChange).toHaveBeenCalledWith('16:00')
  })

  it('disabled：不可打开', async () => {
    renderWithTheme(
      <StrictMode>
        <TimePicker label="发布时间" value={undefined} onChange={() => {}} options={[{ value: '16:00' }]} disabled />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '发布时间' })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
