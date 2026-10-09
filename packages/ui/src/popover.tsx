import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type OpenChangeReason,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'

export interface PopoverProps {
  content: (close: () => void) => ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
  className?: string
}

export function Popover({
  content,
  children,
  placement = 'bottom-start',
  open: openProp,
  onOpenChange,
  className,
}: PopoverProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const { portalRoot } = useTheme()

  const setOpen = (next: boolean, event?: Event, reason?: OpenChangeReason) => {
    if (openProp === undefined) setInnerOpen(next)
    onOpenChange?.(next, event, reason)
  }

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps(children.props) })}
      {open && (
        <FloatingPortal root={portalRoot}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className={cx('ex-popover', className)}
              {...getFloatingProps()}
            >
              {content(() => setOpen(false))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
