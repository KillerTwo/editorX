import { ExtensionErrorBoundary, safeResolveText, useMessages, type ExtensionContext, type ResolvedPanel } from '@editorx/toolbar'
import { cx } from '../cx'
import { useEditorState, type EditorStore } from '../store'

export function PanelHost({
  id,
  position,
  panels,
  ctx,
  store,
  onError,
}: {
  id?: string
  position: 'right' | 'bottom'
  panels: readonly ResolvedPanel[]
  ctx: ExtensionContext
  store: EditorStore
  onError(name: string, error: unknown): void
}) {
  const m = useMessages()
  const active = useEditorState(store, (s) => s.panel)
  const current = panels.find((p) => p.panel.id === active)
  if (!current) return null
  return (
    <aside
      id={id}
      className={cx('ex-mde-panel', `ex-mde-panel--${position}`)}
      aria-label={safeResolveText(current.panel.title, m, ctx, current.extension, current.panel.id)}
      data-panel={current.panel.id}
    >
      <ExtensionErrorBoundary
        key={`${current.extension}:${current.panel.id}`}
        name={current.extension}
        onError={onError}
        render={() => current.panel.render(ctx)}
      />
    </aside>
  )
}
