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
  useMergeRefs,
  useRole,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@geekx/theme'
import { cloneElement, useState, type HTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react'
import { cx } from './cx'
import { useModalLayerClass } from './layer'

export interface TooltipProps extends Omit<HTMLAttributes<HTMLElement>, 'content' | 'children'> {
  content: ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  delay?: number
  ref?: Ref<Element>
}

type Handler = (...args: unknown[]) => void

// Outer floating triggers (Popover/Dropdown) inject props through Tooltip; chain shared handlers
// so neither the child's nor the outer trigger's listeners are lost.
function mergeChildProps(own: Record<string, unknown>, injected: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...own, ...injected }
  for (const key of Object.keys(injected)) {
    const a = own[key]
    const b = injected[key]
    if (/^on[A-Z]/.test(key) && typeof a === 'function' && typeof b === 'function') {
      merged[key] = (...args: unknown[]) => {
        ;(a as Handler)(...args)
        ;(b as Handler)(...args)
      }
    }
  }
  return merged
}

export function Tooltip({
  content,
  children,
  placement = 'bottom',
  delay = 300,
  ref: outerRef,
  ...rest
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const { portalRoot } = useTheme()
  const layerClass = useModalLayerClass()
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
  const childRef = (children.props as { ref?: Ref<Element> }).ref
  const ref = useMergeRefs([refs.setReference, childRef, outerRef])

  return (
    <>
      {cloneElement(children, getReferenceProps({ ...mergeChildProps(children.props, rest), ref }))}
      {open && (
        <FloatingPortal root={portalRoot}>
          <div ref={refs.setFloating} style={floatingStyles} className={cx('ex-tooltip', layerClass)} {...getFloatingProps()}>
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
