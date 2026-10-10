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
  /** 触发器的 aria-describedby（空格分隔的 id） */
  describedBy?: string
  invalid?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export function timeSlots(stepMinutes = 30): string[] {
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) throw new RangeError(`stepMinutes 必须是有限正数：${stepMinutes}`)
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

/** 时钟图标（参考图 19-09-01 按 10× 描摹）：墨迹 12.2×12.2，越出 12px 布局盒的部分可见 */
function ClockIcon() {
  return (
    <svg
      className="ex-picker-input__icon"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      overflow="visible"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.875"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6.375" cy="5.75" r="5.625" />
      <path d="M5.9375 2.3125V6.1875H9.8125" />
    </svg>
  )
}
