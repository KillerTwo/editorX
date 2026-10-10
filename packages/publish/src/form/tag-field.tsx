import { formatMessage, useMessages } from '@editorx/toolbar'
import { Popover, Tag } from '@editorx/ui'
import { Plus } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { cx } from '../cx'
import { MAX_TAGS } from '../validate'
import { errorId } from './form-item'

export interface TagFieldProps {
  id: string
  tags: readonly string[]
  onChange(tags: string[]): void
  /** 缺失时（无论 hide 还是 disable 策略）弹层只有输入框，Enter 添加自定义标签 */
  searchTags?: (keyword: string) => Promise<string[]>
  invalid: boolean
}

export function TagField({ id, tags, onChange, searchTags, invalid }: TagFieldProps) {
  const p = useMessages().publish
  const [open, setOpen] = useState(false)
  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    const next = [...tags, tag]
    onChange(next)
    if (next.length >= MAX_TAGS) setOpen(false)
  }
  return (
    <div className="ex-pub-line ex-pub-tags">
      {tags.map((tag) => (
        <Tag key={tag} className="ex-pub-tag" closable closeLabel={p.tags.remove} onClose={() => onChange(tags.filter((t) => t !== tag))}>
          {tag}
        </Tag>
      ))}
      {tags.length < MAX_TAGS && (
        <Popover
          open={open}
          onOpenChange={setOpen}
          className="ex-pub-tag-popover"
          content={() => <TagSearch selected={tags} onAdd={add} searchTags={searchTags} />}
        >
          <button
            type="button"
            className="ex-pub-tag-add"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId(id) : undefined}
          >
            <Plus size={12} aria-hidden="true" />
            {p.tags.add}
          </button>
        </Popover>
      )}
    </div>
  )
}

interface TagSearchProps {
  selected: readonly string[]
  onAdd(tag: string): void
  searchTags?: (keyword: string) => Promise<string[]>
}

function TagSearch({ selected, onAdd, searchTags }: TagSearchProps) {
  const p = useMessages().publish
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<string[] | null>(null)

  useEffect(() => {
    if (!searchTags) return
    let live = true
    const query = keyword.trim()
    const timer = window.setTimeout(
      () => {
        searchTags(query).then(
          (list) => {
            if (live) setResults(list)
          },
          () => {
            if (live) setResults([])
          },
        )
      },
      query ? 300 : 0,
    )
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [keyword, searchTags])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    onAdd(keyword)
    setKeyword('')
  }

  return (
    <div className="ex-pub-tag-search">
      <input
        className="ex-pub-input ex-pub-tag-search__input"
        type="search"
        value={keyword}
        placeholder={p.tags.searchPlaceholder}
        aria-label={p.tags.search}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="ex-pub-tag-search__meta">{formatMessage(p.tags.count, { count: MAX_TAGS - selected.length })}</div>
      {searchTags && (
        <div className="ex-pub-tag-search__section">
          <div className="ex-pub-tag-search__title">{p.tags.suggestions}</div>
          {results !== null &&
            (results.length === 0 ? (
              <div className="ex-pub-tag-search__empty">{p.tags.empty}</div>
            ) : (
              <ul className="ex-pub-tag-search__list" aria-label={p.tags.suggestions}>
                {results.map((tag) => {
                  const on = selected.includes(tag)
                  return (
                    <li key={tag}>
                      <button
                        type="button"
                        className={cx('ex-pub-tag-option', on && 'is-selected')}
                        aria-pressed={on}
                        disabled={on}
                        onClick={() => onAdd(tag)}
                      >
                        {tag}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ))}
        </div>
      )}
    </div>
  )
}
