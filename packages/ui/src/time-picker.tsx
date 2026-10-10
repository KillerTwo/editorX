import type { ReactElement } from 'react'
import { cx } from './cx'
import { Select } from './select'

export interface TimeOption {
  /** 'HH:mm' */
  value: string
  disabled?: boolean
}

export interface TimePickerProps {
  value: string | undefined
  onChange(value: string): void
  options: readonly TimeOption[]
  placeholder?: string
  disabled?: boolean
  label: string
  className?: string
  listClassName?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function timeSlots(stepMinutes = 30): string[] {
  const slots: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  return slots
}

export function TimePicker({ options, className, ...rest }: TimePickerProps): ReactElement {
  return (
    <Select
      {...rest}
      options={options.map((option) => ({ value: option.value, label: option.value, disabled: option.disabled }))}
      className={cx('ex-picker-input ex-time-picker', className)}
      prefix={<ClockIcon />}
      showArrow={false}
      offset={12}
    />
  )
}

function ClockIcon() {
  return (
    <svg className="ex-picker-input__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" />
      <path d="M6 3v3l2 1.5" />
    </svg>
  )
}
