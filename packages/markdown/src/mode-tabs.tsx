import { useMessages } from '@editorx/toolbar'
import { Columns2, Monitor, SquareCode, type LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { cx } from './cx'
import type { ViewMode } from './types'

const MODES: ReadonlyArray<{ mode: ViewMode; Icon: LucideIcon }> = [
  { mode: 'edit', Icon: SquareCode },
  { mode: 'split', Icon: Columns2 },
  { mode: 'preview', Icon: Monitor },
]

export function ModeTabs({ value, onChange }: { value: ViewMode; onChange(mode: ViewMode): void }) {
  const m = useMessages()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const index = MODES.findIndex((x) => x.mode === value)
    const next = (index + delta + MODES.length) % MODES.length
    onChange(MODES[next]!.mode)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={m.modes.label} className="ex-mde-modes" onKeyDown={onKeyDown}>
      {MODES.map(({ mode, Icon }, index) => (
        <button
          key={mode}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="button"
          role="tab"
          aria-selected={mode === value}
          tabIndex={mode === value ? 0 : -1}
          className={cx('ex-mde-mode', mode === value && 'is-active')}
          onClick={() => onChange(mode)}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{m.modes[mode]}</span>
        </button>
      ))}
    </div>
  )
}
