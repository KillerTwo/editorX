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
  useListNavigation,
  useMergeRefs,
  useRole,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'
import { useModalLayerClass } from './layer'

export interface DropdownItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  /** 右侧附加信息，如快捷键 */
  extra?: ReactNode
  disabled?: boolean
  /** 设置后渲染为 menuitemcheckbox（aria-checked），为 true 时加 is-active；不设置为普通 menuitem */
  checked?: boolean
  /** 为 true 时渲染分隔线，其余字段忽略 */
  separator?: boolean
}

export interface DropdownProps {
  items: DropdownItem[]
  onSelect: (key: string) => void
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  /** 菜单的无障碍名称 */
  label?: string
  className?: string
}

function DropdownInner({ items, onSelect, children, placement = 'bottom-start', label, className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const { portalRoot } = useTheme()
  const layerClass = useModalLayerClass()
  const nodeId = useFloatingNodeId()
  const listRef = useRef<Array<HTMLElement | null>>([])
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const disabledIndices = items.flatMap((item, index) => (item.disabled || item.separator ? [index] : []))
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context, { bubbles: { escapeKey: false } }),
    useRole(context, { role: 'menu' }),
    useListNavigation(context, { listRef, activeIndex, onNavigate: setActiveIndex, loop: true, disabledIndices }),
  ])
  const childRef = (children.props as { ref?: Ref<Element> }).ref
  const ref = useMergeRefs([refs.setReference, childRef])
  const floatingProps = getFloatingProps()

  return (
    <>
      {/* 嵌套在其他浮层里时 useRole 会把触发器标成 menuitem（子菜单语义），这里保留触发器自身的 role */}
      {cloneElement(children, { ...getReferenceProps({ ...children.props, ref }), role: children.props.role })}
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false}>
              <ul
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-dropdown', layerClass, className)}
                {...floatingProps}
                aria-label={label}
                aria-labelledby={label ? undefined : (floatingProps['aria-labelledby'] as string | undefined)}
              >
                {items.map((item, index) =>
                  item.separator ? (
                    <li key={item.key} role="separator" className="ex-dropdown__sep" />
                  ) : (
                    <li key={item.key} role="none">
                      <button
                        ref={(node) => {
                          listRef.current[index] = node
                        }}
                        type="button"
                        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                        aria-checked={item.checked}
                        className={cx('ex-dropdown__item', item.checked && 'is-active')}
                        tabIndex={activeIndex === index ? 0 : -1}
                        disabled={item.disabled}
                        {...getItemProps({
                          onClick: () => {
                            onSelect(item.key)
                            setOpen(false)
                          },
                        })}
                      >
                        {item.icon && <span className="ex-dropdown__icon" aria-hidden="true">{item.icon}</span>}
                        <span className="ex-dropdown__label">{item.label}</span>
                        {item.extra && <span className="ex-dropdown__extra">{item.extra}</span>}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

export const Dropdown = withFloatingTree(DropdownInner, 'Dropdown')
