import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'default' | 'text'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('ex-btn', `ex-btn--${variant}`, `ex-btn--${size}`, loading && 'is-loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="ex-btn__spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="ex-btn__icon" aria-hidden="true">{icon}</span>
      ) : null}
      {children != null && <span className="ex-btn__label">{children}</span>}
    </button>
  )
}
