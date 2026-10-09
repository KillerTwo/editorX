import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export interface RadioOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps<V extends string = string> {
  value: V | undefined
  onChange: (value: V) => void
  options: readonly RadioOption<V>[]
  /** 原生 radio 的 name，默认自动生成 */
  name?: string
  disabled?: boolean
  /** 组的无障碍名称（与 labelledBy 二选一） */
  label?: string
  labelledBy?: string
  describedBy?: string
  invalid?: boolean
  className?: string
}

export function RadioGroup<V extends string = string>({
  value,
  onChange,
  options,
  name,
  disabled = false,
  label,
  labelledBy,
  describedBy,
  invalid = false,
  className,
}: RadioGroupProps<V>) {
  const autoName = useId()
  return (
    <div
      role="radiogroup"
      className={cx('ex-radio-group', className)}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-disabled={disabled || undefined}
    >
      {options.map((option) => {
        const checked = option.value === value
        const off = disabled || option.disabled === true
        return (
          <label key={option.value} className={cx('ex-radio', checked && 'is-checked', off && 'is-disabled')}>
            <input
              type="radio"
              className="ex-radio__input"
              name={name ?? autoName}
              value={option.value}
              checked={checked}
              disabled={off}
              onChange={() => onChange(option.value)}
            />
            <span className="ex-radio__dot" aria-hidden="true" />
            <span className="ex-radio__label">{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}
