import { useMessages } from '@geekx/toolbar'
import type { ReactNode } from 'react'

function CollapseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path d="M11.5 2.5v11" stroke="currentColor" strokeWidth="1" />
      <path d="M8.5 8H3.5" stroke="currentColor" strokeWidth="1" />
      <path d="M5.5 5.5 3 8l2.5 2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function RichTextDrawer({
  children,
  onCollapse,
}: {
  children: ReactNode
  onCollapse?: () => void
}) {
  const m = useMessages()
  return (
    <aside className="ex-rte-drawer" aria-label={m.richText.drawer}>
      <div className="ex-rte-drawer__head">
        <button type="button" className="ex-rte-drawer__collapse" aria-label={m.panels.collapse} onClick={onCollapse}>
          <CollapseGlyph />
        </button>
      </div>
      {children}
    </aside>
  )
}
