import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  children?: ReactNode
  /** 无 children 时的无障碍名称 */
  label?: string
  describedBy?: string
  className?: string
}

export function Checkbox({ checked, onChange, disabled = false, children, label, describedBy, className }: CheckboxProps) {
  return (
    <label className={cx('ex-checkbox', checked && 'is-checked', disabled && 'is-disabled', className)}>
      <input
        type="checkbox"
        className="ex-checkbox__input"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ex-checkbox__box" aria-hidden="true">
        <Check size={10} strokeWidth={3} />
      </span>
      {children != null && <span className="ex-checkbox__label">{children}</span>}
    </label>
  )
}
