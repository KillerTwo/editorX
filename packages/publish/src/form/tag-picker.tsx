import { formatMessage, useMessages, type TagCategory } from '@editorx/toolbar'
import { InlineLayer } from '@editorx/ui'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../cx'
import { CloseIcon } from '../icons'
import { MAX_TAGS } from '../validate'
import type { TagCatalog } from './use-tag-catalog'

/** 标签去重忽略大小写与首尾空白 */
export const hasTag = (tags: readonly string[], tag: string): boolean => {
  const key = tag.trim().toLowerCase()
  return tags.some((t) => t.trim().toLowerCase() === key)
}

export interface TagPickerProps {
  selected: readonly string[]
  /** 返回是否真的添加了（空白、重复或已满时为 false） */
  onAdd(tag: string): boolean
  onClose(): void
  catalog: TagCatalog
}

export function TagPicker({ selected, onAdd, onClose, catalog }: TagPickerProps) {
  const p = useMessages().publish
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const tabId = (index: number) => `${baseId}-tab-${index}`
  const inputRef = useRef<HTMLInputElement>(null)
  const [keyword, setKeyword] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [results, setResults] = useState<{ query: string; list: string[] } | null>(null)
  const { categories, canSearch, loadCategories, loadTags, search } = catalog
  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    loadCategories()
  }, [loadCategories])
  const activeIndex = categories ? Math.max(0, categories.findIndex((c) => c.id === activeId)) : -1
  const active: TagCategory | undefined = categories?.[activeIndex]
  useEffect(() => {
    if (active) loadTags(active)
  }, [active, loadTags])
  const query = keyword.trim()
  const searching = query !== '' && canSearch
  useEffect(() => {
    if (!searching) return
    let live = true
    const timer = window.setTimeout(() => {
      search(query).then(
        (list) => {
          if (live) setResults({ query, list })
        },
        () => {
          if (live) setResults({ query, list: [] })
        },
      )
    }, 300)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [query, searching, search])
  const list = searching ? (results?.query === query ? results.list : undefined) : active && catalog.tagsOf(active)
  const select = (category: TagCategory) => {
    setActiveId(category.id)
    loadTags(category)
  }
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!categories) return
    const count = categories.length
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = (index + step + count) % count
    select(categories[next]!)
    ;(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
  }
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    if (onAdd(keyword)) setKeyword('')
  }
  const showBody = catalog.hasSource && (categories === null || categories.length > 0)
  return (
    <InlineLayer className="ex-popover ex-pub-tag-picker" role="dialog" aria-labelledby={`${baseId}-title`} onDismiss={onClose}>
      <div className="ex-pub-tag-picker__header">
        <span className="ex-pub-tag-picker__title" id={`${baseId}-title`}>
          {p.tags.title}
        </span>
        <button type="button" className="ex-pub-tag-picker__close" aria-label={p.tags.close} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <input
        ref={inputRef}
        className="ex-pub-input ex-pub-tag-picker__search"
        type="search"
        value={keyword}
        placeholder={p.tags.searchPlaceholder}
        aria-label={p.tags.search}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={onInputKeyDown}
      />
      {showBody && (
        <div className="ex-pub-tag-picker__body">
          <div className="ex-pub-tag-picker__categories" role="tablist" aria-orientation="vertical" aria-label={p.tags.categories}>
            {categories?.map((c, index) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                id={tabId(index)}
                className={cx('ex-pub-tag-picker__category', index === activeIndex && 'is-active')}
                aria-selected={index === activeIndex}
                aria-controls={panelId}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => select(c)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="ex-pub-tag-picker__main" role="tabpanel" id={panelId} aria-labelledby={active ? tabId(activeIndex) : undefined}>
            <div className="ex-pub-tag-picker__section">{p.tags.section}</div>
            {list !== undefined &&
              (list.length === 0 ? (
                <div className="ex-pub-tag-picker__empty">{p.tags.empty}</div>
              ) : (
                <ul className="ex-pub-tag-picker__list" aria-label={p.tags.suggestions}>
                  {list.map((tag) => {
                    const on = hasTag(selected, tag)
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
        </div>
      )}
      <div className="ex-pub-tag-picker__count" aria-live="polite">
        {formatMessage(p.tags.count, { count: MAX_TAGS - selected.length })}
      </div>
    </InlineLayer>
  )
}
