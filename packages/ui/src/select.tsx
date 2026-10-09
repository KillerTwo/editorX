import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  offset,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useListNavigation,
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { ChevronDown } from 'lucide-react'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'
import { useModalLayerClass } from './layer'

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
}

export interface SelectProps<V extends string = string> {
  value: V | undefined
  onChange: (value: V) => void
  options: readonly SelectOption<V>[]
  placeholder?: ReactNode
  disabled?: boolean
  /** 无障碍名称（与 labelledBy 二选一） */
  label?: string
  labelledBy?: string
  className?: string
  /** 弹出列表的类名 */
  listClassName?: string
}

function SelectInner<V extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  label,
  labelledBy,
  className,
  listClassName,
}: SelectProps<V>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const { portalRoot } = useTheme()
  const layerClass = useModalLayerClass()
  const nodeId = useFloatingNodeId()
  const listRef = useRef<Array<HTMLElement | null>>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: (next) => {
      if (!disabled || !next) setOpen(next)
    },
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip(),
      size({
        apply({ rects, elements }) {
          elements.floating.style.minWidth = `${rects.reference.width}px`
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })
  const disabledIndices = options.flatMap((option, index) => (option.disabled ? [index] : []))
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context, { bubbles: { escapeKey: false } }),
    useRole(context, { role: 'listbox' }),
    useListNavigation(context, {
      listRef,
      activeIndex,
      selectedIndex: selectedIndex === -1 ? null : selectedIndex,
      onNavigate: setActiveIndex,
      loop: true,
      disabledIndices,
    }),
  ])
  const selected = selectedIndex === -1 ? undefined : options[selectedIndex]

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={cx('ex-select', open && 'is-open', !selected && 'is-placeholder', className)}
        disabled={disabled}
        aria-label={label}
        aria-labelledby={labelledBy}
        {...getReferenceProps()}
      >
        <span className="ex-select__value">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="ex-select__arrow" size={14} aria-hidden="true" />
      </button>
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false}>
              <ul
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-select__list', layerClass, listClassName)}
                aria-label={label}
                {...getFloatingProps()}
              >
                {options.map((option, index) => (
                  <li key={option.value} role="none">
                    <button
                      ref={(node) => {
                        listRef.current[index] = node
                      }}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      className={cx('ex-select__option', index === selectedIndex && 'is-selected')}
                      tabIndex={activeIndex === index ? 0 : -1}
                      disabled={option.disabled}
                      {...getItemProps({
                        onClick: () => {
                          onChange(option.value)
                          setOpen(false)
                        },
                      })}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

export const Select = withFloatingTree(SelectInner, 'Select') as unknown as <V extends string = string>(
  props: SelectProps<V>,
) => ReactElement
