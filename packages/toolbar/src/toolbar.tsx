import { Dropdown, Modal, Popover, Tooltip, type DropdownItem } from '@editorx/ui'
import { ChevronDown, Ellipsis } from 'lucide-react'
import {
  Fragment,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type Ref,
} from 'react'
import { cx } from './cx'
import { ExtensionErrorBoundary } from './error-boundary'
import { safeResolveText, type ExtensionContext, type ToolbarModal, type ToolbarPopover } from './extension'
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
import { formatShortcut } from './shortcuts'
import { useIsMacPlatform } from './use-mac-platform'

/** 与 styles.css 中分隔线（1px + 左右 8px 外边距）和「更多」按钮（28px + 分隔线 + 余量）保持一致；分隔线已渲染时以实测为准 */
const DIVIDER_WIDTH = 17
const MORE_WIDTH = 49
const MORE_KEY = '__more'
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

/** `openDialog` 的结果：已打开 / 条目存在但已禁用（含所在下拉禁用）/ 布局中没有该 modal 条目 */
export type ToolbarDialogResult = 'opened' | 'disabled' | 'missing'

export interface ToolbarHandle {
  /**
   * 打开 id 对应的 modal 条目（含下拉中的嵌套条目）。只匹配 `type: 'modal'` 的条目；
   * 给出 `extension` 时还需扩展名一致（避免同 id 的其他扩展条目抢先匹配）。
   */
  openDialog(id: string, extension?: string): ToolbarDialogResult
}

export interface ToolbarProps {
  groups: readonly ResolvedGroup[]
  ctx: ExtensionContext
  readOnly?: boolean
  /** 变化时重新求值 active/disabled */
  stateKey?: string
  onError?(extension: string, error: unknown): void
  ariaLabel?: string
  className?: string
  ref?: Ref<ToolbarHandle>
}

interface ItemMatch {
  item: ResolvedItem
  /** 所在下拉（任一层）已禁用 */
  parentDisabled: boolean
}

/** 宿主样式可能改动分隔线外边距（如 CSDN 的 16px） */
function dividerWidth(root: HTMLElement): number {
  const divider = root.querySelector<HTMLElement>(':scope > .ex-toolbar__divider')
  if (!divider || divider.offsetWidth === 0) return DIVIDER_WIDTH
  const style = getComputedStyle(divider)
  return divider.offsetWidth + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0)
}

/** 深度优先查找首个匹配条目 */
function searchGroups(
  groups: readonly ResolvedGroup[],
  match: (item: ResolvedItem) => boolean,
  isDisabled: (item: ResolvedItem) => boolean = () => false,
): ItemMatch | undefined {
  const search = (children: readonly ResolvedChild[], parentDisabled: boolean): ItemMatch | undefined => {
    for (const child of children) {
      if (isSeparator(child)) continue
      if (match(child)) return { item: child, parentDisabled }
      if (!child.children) continue
      const found = search(child.children, parentDisabled || isDisabled(child))
      if (found) return found
    }
    return undefined
  }
  for (const group of groups) {
    const found = search(group, false)
    if (found) return found
  }
  return undefined
}

const findItem = (groups: readonly ResolvedGroup[], extension: string, id: string) =>
  searchGroups(groups, (r) => r.extension === extension && r.item.id === id)?.item

/** 菜单项 key：不同扩展的嵌套条目 id 可能相同 */
const menuKey = (resolved: ResolvedItem) => `${resolved.extension}:${resolved.item.id}`

function ToolbarImpl({ groups, ctx, readOnly = false, onError, ariaLabel, className, ref }: ToolbarProps) {
  const m = useMessages()
  const mac = useIsMacPlatform()
  const rootRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Array<HTMLDivElement | null>>([])
  const moreRef = useRef<HTMLButtonElement>(null)
  /** 获得焦点的条目所在分组即将溢出（随后设 inert 会丢失焦点）：渲染后把焦点交给「更多」 */
  const focusMoreRef = useRef(false)
  const [fit, setFit] = useState(groups.length)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [dialogKey, setDialogKey] = useState<{ extension: string; id: string } | null>(null)
  const found = dialogKey ? findItem(groups, dialogKey.extension, dialogKey.id) : undefined
  // 同 id 被重新解析为其他类型（如 button）时视同消失
  const dialog = found && (found.item.type === 'modal' || found.item.type === 'popover') ? found : undefined
  const dialogGone = dialogKey !== null && dialog === undefined
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (dialogGone) setDialogKey(null)
  }, [dialogGone])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const id of pending) clearTimeout(id)
      pending.clear()
    }
  }, [])

  /** 卸载时清除，避免在已销毁的编辑器上调用 ctx */
  const later = (fn: () => void) => {
    const id = setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, 0)
    timers.current.add(id)
  }

  // 对话框关闭后焦点无处可还（触发按钮已不在，如被溢出或布局变化移除）时落到 body：交还编辑区
  const closeDialog = () => {
    setDialogKey(null)
    later(() => {
      const active = document.activeElement
      if (!active || active === document.body) ctx.focus()
    })
  }

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
      const divider = dividerWidth(root)
      const next = fitGroups(widths, available, divider, MORE_WIDTH - DIVIDER_WIDTH + divider)
      const active = document.activeElement
      const focusedGroup = active ? groupRefs.current.findIndex((g) => g?.contains(active)) : -1
      focusMoreRef.current = focusedGroup >= next && focusedGroup < groups.length
      setFit(next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // 分组宽度会在语言切换、字体加载后变化而工具栏宽度不变：分组也要观察
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    for (const group of groupRefs.current.slice(0, groups.length)) if (group) observer.observe(group)
    return () => observer.disconnect()
  }, [groups])

  const visible = Math.min(fit, groups.length)

  useLayoutEffect(() => {
    const focusMore = focusMoreRef.current
    focusMoreRef.current = false
    if (focusMore) moreRef.current?.focus()
  }, [visible])

  useImperativeHandle(
    ref,
    () => ({
      openDialog: (id, extension) => {
        const found = searchGroups(
          groups,
          (r) => r.item.id === id && r.item.type === 'modal' && (!extension || r.extension === extension),
          (r) => isItemDisabled(r, ctx, readOnly),
        )
        if (!found) return 'missing'
        if (found.parentDisabled || isItemDisabled(found.item, ctx, readOnly)) return 'disabled'
        setDialogKey({ extension: found.item.extension, id })
        return 'opened'
      },
    }),
    [groups, ctx, readOnly],
  )
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
      setDialogKey({ extension: resolved.extension, id: resolved.item.id })
    }
  }

  /** 展平后的菜单里，禁用的 dropdown（含只读规则）其子项一并禁用 */
  const disabledItems = (children: readonly ResolvedChild[]) => {
    const disabled = new Set<ResolvedItem>()
    const walk = (list: readonly ResolvedChild[], parentDisabled: boolean) => {
      for (const child of list) {
        if (isSeparator(child)) continue
        const off = parentDisabled || isItemDisabled(child, ctx, readOnly)
        if (off) disabled.add(child)
        if (child.children) walk(child.children, off)
      }
    }
    walk(children, false)
    return disabled
  }

  const menuItems = (children: readonly ResolvedChild[]): DropdownItem[] => {
    const disabled = disabledItems(children)
    return flattenChildren(children).map((child) =>
      isSeparator(child)
        ? { key: child.key, label: '', separator: true }
        : {
            key: menuKey(child),
            label: safeResolveText(child.item.title, m, ctx, child.extension, child.item.id),
            icon: child.item.icon,
            extra: child.item.type === 'button' && child.item.shortcut ? formatShortcut(child.item.shortcut, mac) : undefined,
            disabled: disabled.has(child),
            checked: child.item.active === undefined ? undefined : isItemActive(child, ctx),
          },
    )
  }

  const selectFrom = (children: readonly ResolvedChild[], key: string) => {
    const found = flattenChildren(children).find((c): c is ResolvedItem => !isSeparator(c) && menuKey(c) === key)
    if (!found) return
    // 菜单关闭后会在微任务中把焦点还给触发按钮：对话框等它完成再打开，初始焦点与关闭后的归还才落在正确位置
    if (found.item.type === 'modal' || found.item.type === 'popover') later(() => activate(found))
    else activate(found)
  }

  const renderItem = (resolved: ResolvedItem): ReactElement => {
    const { item } = resolved
    const title = safeResolveText(item.title, m, ctx, resolved.extension, item.id)
    const label = item.label === undefined ? undefined : safeResolveText(item.label, m, ctx, resolved.extension, item.id)
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
            <ExtensionErrorBoundary name={resolved.extension} onError={report} render={() => item.render(ctx, close)} />
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
                ref={moreRef}
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
          onClose={closeDialog}
          title={safeResolveText(dialogItem.title, m, ctx, dialog.extension, dialogItem.id)}
          width={dialogItem.type === 'modal' ? dialogItem.width : undefined}
          closeLabel={m.dialog.close}
        >
          <ExtensionErrorBoundary
            name={dialog.extension}
            onError={report}
            render={() => dialogItem.render(ctx, closeDialog)}
          />
        </Modal>
      )}
    </div>
  )
}

export const Toolbar = memo(ToolbarImpl)
