import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useMergeRefs,
  useRole,
  type OpenChangeReason,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'

export interface PopoverProps {
  content: (close: () => void) => ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
  className?: string
}

function PopoverInner({
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
  const nodeId = useFloatingNodeId()

  const setOpen = (next: boolean, event?: Event, reason?: OpenChangeReason) => {
    if (openProp === undefined) setInnerOpen(next)
    onOpenChange?.(next, event, reason)
  }

  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { bubbles: { escapeKey: false } }),
    useRole(context, { role: 'dialog' }),
  ])
  const childRef = (children.props as { ref?: Ref<Element> }).ref
  const ref = useMergeRefs([refs.setReference, childRef])

  return (
    <>
      {cloneElement(children, getReferenceProps({ ...children.props, ref }))}
      <FloatingNode id={nodeId}>
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
      </FloatingNode>
    </>
  )
}

export const Popover = withFloatingTree(PopoverInner, 'Popover')
