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
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { addDays, addMonths, clampDateKey, isDateDisabled, monthGrid, parseDateKey, todayKey, type DateKey } from './calendar'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'
import { useModalLayerClass } from './layer'

export interface DatePickerLabels {
  prevYear: string
  prevMonth: string
  nextMonth: string
  nextYear: string
  /** '{year}'、'{month}' 占位 */
  monthTitle: string
  /** 7 项，逗号分隔，周日开头 */
  weekdays: string
}

export const DATE_PICKER_LABELS: DatePickerLabels = {
  prevYear: '前一年',
  prevMonth: '上个月',
  nextMonth: '下个月',
  nextYear: '后一年',
  monthTitle: '{year} 年 {month} 月',
  weekdays: '日,一,二,三,四,五,六',
}

export interface DatePickerProps {
  value: DateKey | undefined
  onChange(value: DateKey): void
  min?: DateKey
  max?: DateKey
  placeholder?: string
  disabled?: boolean
  /** 触发按钮与日历对话框的无障碍名称 */
  label: string
  labels?: Partial<DatePickerLabels>
  className?: string
  /** 追加到触发器 aria-describedby 的 id（空格分隔），排在当前值描述之后 */
  describedBy?: string
  invalid?: boolean
}

const monthStart = (key: DateKey) => `${key.slice(0, 7)}-01`

function DatePickerInner({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  label,
  labels: overrides,
  className,
  describedBy,
  invalid = false,
}: DatePickerProps) {
  const labels = { ...DATE_PICKER_LABELS, ...overrides }
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState<DateKey>(() => clampDateKey(value ?? todayKey(), min, max))
  const { portalRoot } = useTheme()
  const layerClass = useModalLayerClass()
  const nodeId = useFloatingNodeId()
  const dayRef = useRef<HTMLButtonElement | null>(null)
  /** 下次渲染后是否把焦点移到网格中的当前日（打开、网格内键盘移动、翻页按钮被禁用时） */
  const focusDayRef = useRef(false)
  const titleId = useId()
  const valueId = useId()
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: (next) => {
      if (next && disabled) return
      if (next) {
        focusDayRef.current = true
        setFocused(clampDateKey(value ?? todayKey(), min, max))
      }
      setOpen(next)
    },
    placement: 'bottom-start',
    middleware: [offset(12), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context, { bubbles: { escapeKey: false } }),
    useRole(context, { role: 'dialog' }),
  ])

  // roving tabindex：只在 focusDayRef 要求时把焦点移进网格；只操作 DOM，不 setState
  useEffect(() => {
    if (!open || !focusDayRef.current) return
    focusDayRef.current = false
    dayRef.current?.focus()
  }, [open, focused])

  const move = (next: DateKey, focusDay: boolean) => {
    const clamped = clampDateKey(next, min, max)
    if (clamped === focused) return
    focusDayRef.current = focusDay
    setFocused(clamped)
  }
  const select = (key: DateKey) => {
    if (isDateDisabled(key, min, max)) return
    onChange(key)
    setOpen(false)
  }
  /** 从 base 所在月翻 months 个月后的整月是否与 [min, max] 有交集 */
  const canPage = (months: number, base: DateKey = focused) => {
    const first = addMonths(monthStart(base), months)
    const last = addDays(addMonths(first, 1), -1)
    return !(min !== undefined && last < min) && !(max !== undefined && first > max)
  }
  const onGridKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const parts = parseDateKey(focused)!
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    const steps: Record<string, () => DateKey> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
    }
    const step = steps[e.key]
    if (!step) return
    e.preventDefault()
    move(step(), true)
  }

  const view = parseDateKey(focused)!
  const grid = monthGrid(view.year, view.month)
  const today = todayKey()
  const title = labels.monthTitle.replace('{year}', String(view.year)).replace('{month}', String(view.month))
  const nav = (months: number, name: string, glyph: string) => (
    <button
      type="button"
      className="ex-date-picker__nav"
      aria-label={name}
      disabled={!canPage(months)}
      onClick={() => {
        // 翻页后焦点留在按钮上（APG 日期选择对话框）；按钮随之禁用则无法保留，改落到网格
        const next = clampDateKey(addMonths(focused, months), min, max)
        move(next, !canPage(months, next))
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={cx('ex-picker-input ex-date-picker', open && 'is-open', !value && 'is-placeholder', className)}
        disabled={disabled}
        aria-label={label}
        aria-describedby={cx(valueId, describedBy)}
        aria-invalid={invalid || undefined}
        {...getReferenceProps()}
      >
        <CalendarIcon />
        <span id={valueId} className="ex-picker-input__value">
          {value ?? placeholder}
        </span>
      </button>
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false} initialFocus={dayRef}>
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-date-picker__panel', layerClass)}
                aria-label={label}
                {...getFloatingProps()}
              >
                <div className="ex-date-picker__header">
                  {nav(-12, labels.prevYear, '«')}
                  {nav(-1, labels.prevMonth, '‹')}
                  <span id={titleId} className="ex-date-picker__title" aria-live="polite">
                    {title}
                  </span>
                  {nav(1, labels.nextMonth, '›')}
                  {nav(12, labels.nextYear, '»')}
                </div>
                <table role="grid" className="ex-date-picker__grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown}>
                  <thead>
                    <tr>
                      {labels.weekdays.split(',').map((name, index) => (
                        <th key={index} scope="col">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, row) => (
                      <tr key={row}>
                        {grid.slice(row * 7, row * 7 + 7).map((key) => (
                          <td key={key} role="gridcell" aria-selected={key === value}>
                            <button
                              ref={key === focused ? dayRef : undefined}
                              type="button"
                              className={cx(
                                'ex-date-picker__day',
                                key.slice(0, 7) !== focused.slice(0, 7) && 'is-outside',
                                key === today && 'is-today',
                                key === value && 'is-selected',
                              )}
                              tabIndex={key === focused ? 0 : -1}
                              disabled={isDateDisabled(key, min, max)}
                              aria-label={key}
                              aria-current={key === today ? 'date' : undefined}
                              onClick={() => select(key)}
                            >
                              {Number(key.slice(8))}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

const CALENDAR_DOTS = [3.875, 6.5, 9.125].flatMap((x) => [6.1875, 8.8125].map((y) => [x, y] as const))

/**
 * 日历图标（参考图 19-09-01 按 10× 描摹）：墨迹 12.25×12.125，越出 12×12 布局盒的部分可见；
 * 布局盒宽保持 12 以免占位文字移动，高 12 使垂直居中落在整像素上
 */
function CalendarIcon() {
  return (
    <svg
      className="ex-picker-input__icon"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      overflow="visible"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.875"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.8125" y="0.9375" width="11.375" height="10.5" />
      <path d="M0.8125 3.5625H12.1875M3.4375 -0.25V2.125M9.5625 -0.25V2.125" />
      {CALENDAR_DOTS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 0.8125} y={y - 0.4375} width="1.625" height="0.875" fill="currentColor" stroke="none" />
      ))}
    </svg>
  )
}

export const DatePicker = withFloatingTree(DatePickerInner, 'DatePicker')
