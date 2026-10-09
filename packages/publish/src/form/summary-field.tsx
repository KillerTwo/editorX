import { formatMessage, useMessages } from '@editorx/toolbar'
import { cx } from '../cx'
import type { PublishVariant } from '../types'
import { countChars, SUMMARY_MAX } from '../validate'
import { errorId, labelId } from './form-item'

export interface SummaryFieldProps {
  id: string
  value: string
  onChange(value: string): void
  /** 「AI提取摘要」填入的内容：正文前 256 字 */
  source: string
  variant: PublishVariant
  invalid: boolean
}

export function SummaryField({ id, value, onChange, source, variant, invalid }: SummaryFieldProps) {
  const p = useMessages().publish
  const count = countChars(value)
  const modal = variant === 'modal'
  return (
    <div className="ex-pub-summary">
      <div className={cx('ex-pub-summary__box', count > SUMMARY_MAX && 'is-over')}>
        <textarea
          className="ex-pub-textarea"
          value={value}
          placeholder={modal ? p.summary.placeholderModal : p.summary.placeholderInline}
          aria-labelledby={labelId(id)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId(id) : `${id}-count`}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="ex-pub-summary__count" id={`${id}-count`}>
          {formatMessage(modal ? p.summary.counterModal : p.summary.counterInline, { count, max: SUMMARY_MAX })}
        </span>
      </div>
      <button type="button" className="ex-pub-summary__extract" disabled={!source} onClick={() => onChange(source)}>
        {p.summary.extract}
      </button>
    </div>
  )
}
