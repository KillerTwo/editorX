import { Dropdown, Modal, Popover, Tooltip, type DropdownItem } from '@editorx/ui'
import { ChevronDown, Ellipsis } from 'lucide-react'
import {
  Fragment,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cx } from './cx'
import { ExtensionErrorBoundary } from './error-boundary'
import { resolveText, type ExtensionContext, type ToolbarModal, type ToolbarPopover } from './extension'
import { isItemActive, isItemDisabled } from './item-state'
import {
  fitGroups,
  flattenChildren,
  isSeparator,
  overflowChildren,
  type ResolvedChild,
  type ResolvedGroup,
  type ResolvedItem,
} from './layout'
import { errorMessage, formatMessage } from './messages'
import { useMessages } from './messages-context'
import { formatShortcut, isMacPlatform } from './shortcuts'

/** 与 styles.css 中分隔线（1px + 左右 8px 外边距）和「更多」按钮（28px + 分隔线 + 余量）保持一致 */
const DIVIDER_WIDTH = 17
const MORE_WIDTH = 49
const MORE_KEY = '__more'
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

export interface ToolbarProps {
  groups: readonly ResolvedGroup[]
  ctx: ExtensionContext
  readOnly?: boolean
  /** 变化时重新求值 active/disabled */
  stateKey?: string
  onError?(extension: string, error: unknown): void
  ariaLabel?: string
  className?: string
}

/** 在错误边界内部调用扩展的 render，使 render 函数本身抛出的异常也能被截获 */
function ExtensionSlot({ render }: { render: () => ReactNode }) {
  return <>{render()}</>
}

function ToolbarImpl({ groups, ctx, readOnly = false, onError, ariaLabel, className }: ToolbarProps) {
  const m = useMessages()
  const mac = useMemo(isMacPlatform, [])
  const rootRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Array<HTMLDivElement | null>>([])
  const [fit, setFit] = useState(groups.length)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [dialog, setDialog] = useState<ResolvedItem | null>(null)

  const report =
    onError ??
    ((extension: string, error: unknown) => {
      console.error(error)
      ctx.notify(formatMessage(m.errors.extension, { name: extension, message: errorMessage(error) }), 'error')
    })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const style = getComputedStyle(root)
      const available = root.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      if (!(available > 0)) {
        setFit(groups.length)
        return
      }
      const widths = groups.map((_, i) => groupRefs.current[i]?.offsetWidth ?? 0)
      setFit(fitGroups(widths, available, DIVIDER_WIDTH, MORE_WIDTH))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [groups])

  const visible = Math.min(fit, groups.length)
  const overflow = groups.slice(visible)
  const tabbable = groups
    .slice(0, visible)
    .flat()
    .filter((r) => !isItemDisabled(r, ctx, readOnly))
    .map((r) => r.item.id)
  if (overflow.length > 0) tabbable.push(MORE_KEY)
  const tabStop = focusKey !== null && tabbable.includes(focusKey) ? focusKey : tabbable[0]

  const activate = (resolved: ResolvedItem) => {
    const { item } = resolved
    if (item.type === 'button') {
      try {
        item.run(ctx)
      } catch (error) {
        report(resolved.extension, error)
      }
    } else if (item.type === 'modal' || item.type === 'popover') {
      setDialog(resolved)
    }
  }

  const menuItems = (children: readonly ResolvedChild[]): DropdownItem[] =>
    flattenChildren(children).map((child) =>
      isSeparator(child)
        ? { key: child.key, label: '', separator: true }
        : {
            key: child.item.id,
            label: resolveText(child.item.title, m),
            icon: child.item.icon,
            extra: child.item.type === 'button' && child.item.shortcut ? formatShortcut(child.item.shortcut, mac) : undefined,
            disabled: isItemDisabled(child, ctx, readOnly),
          },
    )

  const selectFrom = (children: readonly ResolvedChild[], key: string) => {
    const found = flattenChildren(children).find((c): c is ResolvedItem => !isSeparator(c) && c.item.id === key)
    if (found) activate(found)
  }

  const renderItem = (resolved: ResolvedItem): ReactElement => {
    const { item } = resolved
    const title = resolveText(item.title, m)
    const label = item.label === undefined ? undefined : resolveText(item.label, m)
    const shortcut = item.type === 'button' && item.shortcut ? formatShortcut(item.shortcut, mac) : undefined
    const active = isItemActive(resolved, ctx)
    const button = (
      <button
        type="button"
        data-item-id={item.id}
        className={cx('ex-toolbar__item', active && 'is-active', label && 'has-label')}
        aria-label={label ? undefined : title}
        aria-pressed={item.type === 'button' && item.active !== undefined ? active : undefined}
        tabIndex={item.id === tabStop ? 0 : -1}
        disabled={isItemDisabled(resolved, ctx, readOnly)}
        onClick={item.type === 'button' || item.type === 'modal' ? () => activate(resolved) : undefined}
      >
        {item.icon && <span className="ex-toolbar__icon" aria-hidden="true">{item.icon}</span>}
        {label && <span className="ex-toolbar__label">{label}</span>}
        {item.type === 'dropdown' && label && <ChevronDown className="ex-toolbar__caret" size={12} aria-hidden="true" />}
      </button>
    )
    const withTip = <Tooltip content={shortcut ? `${title} (${shortcut})` : title}>{button}</Tooltip>
    if (item.type === 'dropdown') {
      const children = resolved.children ?? []
      return (
        <Dropdown key={item.id} label={title} items={menuItems(children)} onSelect={(key) => selectFrom(children, key)}>
          {withTip}
        </Dropdown>
      )
    }
    if (item.type === 'popover') {
      return (
        <Popover
          key={item.id}
          content={(close) => (
            <ExtensionErrorBoundary name={resolved.extension} onError={report}>
              <ExtensionSlot render={() => item.render(ctx, close)} />
            </ExtensionErrorBoundary>
          )}
        >
          {withTip}
        </Popover>
      )
    }
    return <Fragment key={item.id}>{withTip}</Fragment>
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root || !NAV_KEYS.has(e.key) || !root.contains(e.target as Node)) return
    const items = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        '.ex-toolbar__group:not(.is-overflow) .ex-toolbar__item:not(:disabled), .ex-toolbar__more',
      ),
    )
    const index = items.indexOf(e.target as HTMLButtonElement)
    if (index === -1) return
    e.preventDefault()
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).dataset.itemId
    if (id) setFocusKey(id)
  }

  const overflowList = overflowChildren(overflow)
  const dialogItem = dialog?.item as ToolbarModal | ToolbarPopover | undefined

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label={ariaLabel ?? m.toolbar.label}
      aria-orientation="horizontal"
      className={cx('ex-toolbar', className)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {groups.map((group, index) => {
        const hidden = index >= visible
        return (
          <Fragment key={group[0]?.item.id ?? index}>
            {index > 0 && <span className={cx('ex-toolbar__divider', hidden && 'is-overflow')} aria-hidden="true" />}
            <div
              ref={(el) => {
                groupRefs.current[index] = el
              }}
              role="group"
              className={cx('ex-toolbar__group', hidden && 'is-overflow')}
              inert={hidden}
              aria-hidden={hidden || undefined}
            >
              {group.map(renderItem)}
            </div>
          </Fragment>
        )
      })}
      {overflow.length > 0 && (
        <>
          {visible > 0 && <span className="ex-toolbar__divider" aria-hidden="true" />}
          <Dropdown label={m.toolbar.more} items={menuItems(overflowList)} onSelect={(key) => selectFrom(overflowList, key)}>
            <Tooltip content={m.toolbar.more}>
              <button
                type="button"
                data-item-id={MORE_KEY}
                className="ex-toolbar__item ex-toolbar__more"
                aria-label={m.toolbar.more}
                tabIndex={tabStop === MORE_KEY ? 0 : -1}
              >
                <Ellipsis size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          </Dropdown>
        </>
      )}
      {dialog && dialogItem && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title={resolveText(dialogItem.title, m)}
          width={dialogItem.type === 'modal' ? dialogItem.width : undefined}
          closeLabel={m.dialog.close}
        >
          <ExtensionErrorBoundary name={dialog.extension} onError={report}>
            <ExtensionSlot render={() => dialogItem.render(ctx, () => setDialog(null))} />
          </ExtensionErrorBoundary>
        </Modal>
      )}
    </div>
  )
}

export const Toolbar = memo(ToolbarImpl)
