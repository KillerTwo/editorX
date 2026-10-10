import { safeResolveText, useMessages, type ExtensionContext, type ResolvedPanel } from '@editorx/toolbar'
import { useEffect, useRef } from 'react'
import { cx } from '../cx'
import { PanelToggleIcon } from '../icons'
import { useEditorState, type EditorStore } from '../store'

export function SideRail({
  panels,
  store,
  ctx,
}: {
  panels: readonly ResolvedPanel[]
  store: EditorStore
  ctx: ExtensionContext
}) {
  const m = useMessages()
  const active = useEditorState(store, (s) => s.panel)
  const open = active !== null && panels.some((p) => p.panel.id === active)
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (open) last.current = active
  }, [open, active])

  const toggleAll = () => {
    if (open) {
      store.set({ panel: null })
      return
    }
    const target = panels.find((p) => p.panel.id === last.current) ?? panels[0]
    if (target) store.set({ panel: target.panel.id })
  }

  return (
    <nav className="ex-mde-rail" aria-label={m.panels.rail}>
      <button type="button" className="ex-mde-rail__item ex-mde-rail__toggle" aria-expanded={open} onClick={toggleAll}>
        <span className="ex-mde-rail__icon" aria-hidden="true">
          <PanelToggleIcon />
        </span>
        <span className="ex-mde-rail__label">{open ? m.panels.collapse : m.panels.expand}</span>
      </button>
      <span className="ex-mde-rail__divider" aria-hidden="true" />
      {panels.map(({ panel, extension }) => {
        const pressed = panel.id === active
        return (
          <button
            key={panel.id}
            type="button"
            aria-pressed={pressed}
            data-panel={panel.id}
            className={cx('ex-mde-rail__item', pressed && 'is-active')}
            onClick={() => store.set({ panel: pressed ? null : panel.id })}
          >
            {panel.icon && (
              <span className="ex-mde-rail__icon" aria-hidden="true">
                {panel.icon}
              </span>
            )}
            <span className="ex-mde-rail__label">{safeResolveText(panel.title, m, ctx, extension, panel.id)}</span>
          </button>
        )
      })}
    </nav>
  )
}
