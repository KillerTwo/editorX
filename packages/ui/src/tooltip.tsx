import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useState, type ReactElement, type ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  delay?: number
}

export function Tooltip({ content, children, placement = 'bottom', delay = 300 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const { portalRoot } = useTheme()
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: delay, close: 0 }, move: false }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: 'tooltip' }),
  ])

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps(children.props) })}
      {open && (
        <FloatingPortal root={portalRoot}>
          <div ref={refs.setFloating} style={floatingStyles} className="ex-tooltip" {...getFloatingProps()}>
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
