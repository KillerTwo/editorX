import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  footer?: ReactNode
  width?: number | string
  closeOnMaskClick?: boolean
  closeLabel?: string
  className?: string
  children: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  footer,
  width = 520,
  closeOnMaskClick = true,
  closeLabel = '关闭',
  className,
  children,
}: ModalProps) {
  const { portalRoot } = useTheme()
  const titleId = useId()
  const { refs, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: closeOnMaskClick, outsidePressEvent: 'mousedown' }),
    useRole(context, { role: 'dialog' }),
  ])

  if (!open) return null

  return (
    <FloatingPortal root={portalRoot}>
      <FloatingOverlay className="ex-modal-mask" lockScroll>
        <FloatingFocusManager context={context}>
          <div
            ref={refs.setFloating}
            className={cx('ex-modal', className)}
            style={{ width }}
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            {...getFloatingProps()}
          >
            <div className="ex-modal__header">
              {title && <h2 id={titleId} className="ex-modal__title">{title}</h2>}
              <button type="button" className="ex-modal__close" aria-label={closeLabel} onClick={onClose}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="ex-modal__body">{children}</div>
            {footer && <div className="ex-modal__footer">{footer}</div>}
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  )
}
