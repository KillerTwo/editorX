import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'

export interface TabItem {
  key: string
  label: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ items, activeKey, onChange, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const move = (from: number, step: 1 | -1) => {
    const enabled = items.filter((item) => !item.disabled)
    if (enabled.length === 0) return
    const current = items[from]
    const pos = enabled.findIndex((item) => item.key === current?.key)
    const next = enabled[(pos + step + enabled.length) % enabled.length]
    if (!next) return
    onChange(next.key)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${next.key}"]`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      move(index, 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      move(index, -1)
    }
  }

  return (
    <div ref={listRef} role="tablist" className={cx('ex-tabs', className)}>
      {items.map((item, index) => {
        const selected = item.key === activeKey
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            data-key={item.key}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={cx('ex-tabs__tab', selected && 'is-active')}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
