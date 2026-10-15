import { useMessages } from '@geekx/toolbar'
import { extractHeadings } from './headings'

function CollapseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path d="M11.5 2.5v11" stroke="currentColor" strokeWidth="1" />
      <path d="M8.5 8H3.5" stroke="currentColor" strokeWidth="1" />
      <path d="M5.5 5.5 3 8l2.5 2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function ExpandGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path d="M4.5 2.5v11" stroke="currentColor" strokeWidth="1" />
      <path d="M7.5 8H12.5" stroke="currentColor" strokeWidth="1" />
      <path d="M10.5 5.5 13 8l-2.5 2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function TocPanel({
  html,
  onCollapse,
  onSelect,
}: {
  html: string
  onCollapse?: () => void
  onSelect?: (id: string, index: number) => void
}) {
  const m = useMessages()
  const headings = extractHeadings(html)
  return (
    <>
      <div className="ex-rte-toc__head">
        <h2 className="ex-rte-toc__title">{m.panels.toc}</h2>
        <button type="button" className="ex-rte-toc__collapse" aria-label={m.panels.collapse} onClick={onCollapse}>
          <CollapseGlyph />
        </button>
      </div>
      <div className="ex-rte-toc__rule" />
      {headings.length === 0 ? (
        <p className="ex-rte-toc__empty">{m.panels.tocEmpty}</p>
      ) : (
        <ul className="ex-rte-toc__list">
          {headings.map((heading, index) => (
            <li key={`${heading.id}:${index}`}>
              <button
                type="button"
                className="ex-rte-toc__link"
                data-heading-id={heading.id}
                style={{ paddingLeft: 16 + (heading.level - 1) * 14 }}
                onClick={() => onSelect?.(heading.id, index)}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
