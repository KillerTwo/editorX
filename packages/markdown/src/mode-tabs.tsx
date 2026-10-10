import { useMessages } from '@editorx/toolbar'
import { useRef, type ComponentType, type KeyboardEvent } from 'react'
import { cx } from './cx'
import { MarkdownModeIcon, PreviewModeIcon, SplitModeIcon } from './icons'
import type { ViewMode } from './types'

const MODES: ReadonlyArray<{ mode: ViewMode; Icon: ComponentType }> = [
  { mode: 'edit', Icon: MarkdownModeIcon },
  { mode: 'split', Icon: SplitModeIcon },
  { mode: 'preview', Icon: PreviewModeIcon },
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
          <Icon />
          <span>{m.modes[mode]}</span>
        </button>
      ))}
    </div>
  )
}
