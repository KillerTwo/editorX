import { useMessages } from '@editorx/toolbar'

export function SyntaxPanel() {
  const m = useMessages()
  return (
    <div className="ex-mde-syntax">
      <div className="ex-mde-panel__title" role="heading" aria-level={2}>{m.panels.syntax}</div>
      <dl className="ex-mde-syntax__list">
        {m.syntax.items.map(([title, example]) => (
          <div key={title} className="ex-mde-syntax__item">
            <dt>{title}</dt>
            <dd>
              <pre>{example}</pre>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
