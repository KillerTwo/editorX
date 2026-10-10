import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'

export interface TagProps {
  children: ReactNode
  closable?: boolean
  onClose?: () => void
  closeLabel?: string
  className?: string
  /** 'primary'：蓝色描边标签 */
  variant?: 'default' | 'primary'
}

export function Tag({
  children,
  closable = false,
  onClose,
  closeLabel = '删除标签',
  className,
  variant = 'default',
}: TagProps) {
  return (
    <span className={cx('ex-tag', variant === 'primary' && 'ex-tag--primary', className)}>
      <span className="ex-tag__text">{children}</span>
      {closable && (
        <button
          type="button"
          className="ex-tag__close"
          aria-label={typeof children === 'string' ? `${closeLabel} ${children}` : closeLabel}
          onClick={onClose}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
