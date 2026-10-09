import { useMessages, type ExtensionContext } from '@editorx/toolbar'
import { getMarkdownInternals } from '../internals'
import { createEditorStore, useEditorState } from '../store'

const FALLBACK_STORE = createEditorStore()

export function TocPanel({ ctx }: { ctx: ExtensionContext }) {
  const m = useMessages()
  const internals = getMarkdownInternals(ctx)
  const store = internals?.store ?? FALLBACK_STORE
  const toc = useEditorState(store, (s) => s.toc)
  const title = useEditorState(store, (s) => s.tocTitle)
  const minLevel = toc.reduce((min, item) => Math.min(min, item.level), 6)

  return (
    <div className="ex-mde-toc">
      <div className="ex-mde-panel__title" role="heading" aria-level={2}>{title ?? m.panels.toc}</div>
      {toc.length === 0 ? (
        <p className="ex-mde-toc__empty">{m.panels.tocEmpty}</p>
      ) : (
        <ul className="ex-mde-toc__list">
          {toc.map((item, index) => (
            <li key={`${item.id}:${index}`} className="ex-mde-toc__item" data-depth={Math.min(item.level - minLevel, 2)}>
              <button type="button" className="ex-mde-toc__link" title={item.text} onClick={() => internals?.scrollToHeading(item.id)}>
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
