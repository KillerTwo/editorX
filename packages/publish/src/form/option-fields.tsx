import { useMessages, type ArticleType, type PublishOption } from '@geekx/toolbar'
import { Checkbox, RadioGroup, Select } from '@geekx/ui'
import type { AdapterState } from '../adapter-state'
import { VerifiedIcon } from '../icons'
import type { AgreementLinks } from '../types'
import { errorId, labelId } from './form-item'

export interface ArticleTypeFieldProps {
  id: string
  value: ArticleType
  sourceUrl: string | undefined
  onType(type: ArticleType): void
  onSourceUrl(url: string): void
  sourceUrlInvalid: boolean
}

export function ArticleTypeField({ id, value, sourceUrl, onType, onSourceUrl, sourceUrlInvalid }: ArticleTypeFieldProps) {
  const p = useMessages().publish
  return (
    <>
      <RadioGroup<ArticleType>
        className="ex-pub-line"
        labelledBy={labelId(id)}
        value={value}
        onChange={onType}
        options={[
          {
            value: 'original',
            label: (
              <>
                {p.articleType.original}
                <VerifiedIcon className="ex-pub-verified" />
              </>
            ),
          },
          { value: 'reprint', label: p.articleType.reprint },
          { value: 'translated', label: p.articleType.translated },
        ]}
      />
      {value !== 'original' && (
        <input
          type="url"
          className="ex-pub-input ex-pub-source-url"
          value={sourceUrl ?? ''}
          placeholder={p.articleType.sourceUrlPlaceholder}
          aria-label={p.fields.sourceUrl}
          aria-invalid={sourceUrlInvalid || undefined}
          aria-describedby={sourceUrlInvalid ? errorId(id) : undefined}
          onChange={(e) => onSourceUrl(e.target.value)}
        />
      )}
    </>
  )
}

export interface BackupFieldProps {
  checked: boolean
  onChange(checked: boolean): void
  links?: AgreementLinks
}

export function BackupField({ checked, onChange, links }: BackupFieldProps) {
  const b = useMessages().publish.backup
  const link = (href: string | undefined, text: string) =>
    href ? (
      <a className="ex-pub-link" href={href} target="_blank" rel="noreferrer">
        {text}
      </a>
    ) : (
      <span className="ex-pub-link">{text}</span>
    )
  return (
    <>
      <div className="ex-pub-line">
        <Checkbox className="ex-pub-checkbox" checked={checked} onChange={onChange}>
          {b.label}
        </Checkbox>
      </div>
      <p className="ex-pub-agreement">
        {b.agreementPrefix}
        {link(links?.terms, b.terms)}
        {b.and}
        {link(links?.privacy, b.privacy)}
        {b.agreementSuffix}
      </p>
    </>
  )
}

export interface ActivityFieldProps {
  id: string
  activityId: string | undefined
  topicId: string | undefined
  onActivity(id: string): void
  onTopic(id: string): void
  activities: PublishOption[] | null
  topics: PublishOption[] | null
  activityState: AdapterState
  topicState: AdapterState
}

const toOptions = (list: PublishOption[] | null) =>
  (list ?? []).map((option) => ({ value: option.id, label: option.name, disabled: option.disabled }))

/** 两个子行都隐藏时返回 null；整行（FormItem）是否渲染由 PublishForm 决定 */
export function ActivityField(props: ActivityFieldProps) {
  const { id, activityId, topicId, onActivity, onTopic, activities, topics, activityState, topicState } = props
  const p = useMessages().publish
  if (activityState === 'hidden' && topicState === 'hidden') return null
  return (
    <div className="ex-pub-activity">
      {activityState !== 'hidden' && (
        <div className="ex-pub-activity__row">
          <span className="ex-pub-activity__sub" id={`${id}-activity`}>
            {p.fields.activitySub}
          </span>
          <Select
            className="ex-pub-select ex-pub-select--wide"
            offset={12}
            popperArrow
            listClassName="ex-pub-select-list"
            labelledBy={`${id}-activity`}
            value={activityId}
            placeholder={p.activity.placeholder}
            options={toOptions(activities)}
            disabled={activityState === 'disabled'}
            onChange={onActivity}
          />
        </div>
      )}
      {topicState !== 'hidden' && (
        <div className="ex-pub-activity__row">
          <span className="ex-pub-activity__sub" id={`${id}-topic`}>
            {p.fields.topicSub}
          </span>
          <Select
            className="ex-pub-select ex-pub-select--wide"
            offset={12}
            popperArrow
            listClassName="ex-pub-select-list"
            labelledBy={`${id}-topic`}
            value={topicId}
            placeholder={p.activity.topicPlaceholder}
            options={toOptions(topics)}
            disabled={topicState === 'disabled'}
            onChange={onTopic}
          />
        </div>
      )}
    </div>
  )
}
