import { useMessages } from '@editorx/toolbar'
import { Wand2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { titleCounter } from './title-counter'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function PaperChrome({
  title,
  onTitleChange,
  empty,
  titleActions,
  children,
}: {
  title: string
  onTitleChange(title: string): void
  empty: boolean
  titleActions?: ReactNode
  children?: ReactNode
}) {
  const m = useMessages()
  const length = Array.from(title).length
  const { text, over } = titleCounter(length, m.richText)
  return (
    <>
      <div className={cx('ex-rte-title', length >= 5 && 'is-ready')}>
        <input
          className="ex-rte-title__input"
          aria-label="文章标题"
          placeholder={m.richText.titlePlaceholder}
          maxLength={100}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <div className="ex-rte-title__actions">
          {titleActions ?? (
            <button type="button" className="ex-rte-title__wand" aria-label={m.richText.wand}>
              <Wand2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <span className={cx('ex-rte-title__count', over && 'is-over')}>{text}</span>
      </div>
      <hr className="ex-rte-paper__rule" />
      <div className="ex-rte-stage">
        {empty ? <p className="ex-rte-placeholder">{m.richText.placeholder}</p> : null}
        {children}
      </div>
    </>
  )
}
