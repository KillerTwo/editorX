import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'

export interface TagProps {
  children: ReactNode
  closable?: boolean
  onClose?: () => void
  closeLabel?: string
  className?: string
}

export function Tag({ children, closable = false, onClose, closeLabel = '删除标签', className }: TagProps) {
  return (
    <span className={cx('ex-tag', className)}>
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
