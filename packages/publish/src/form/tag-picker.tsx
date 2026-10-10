import { formatMessage, useMessages, type TagCategory } from '@editorx/toolbar'
import { InlineLayer } from '@editorx/ui'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../cx'
import { CloseIcon } from '../icons'
import { MAX_TAGS } from '../validate'

const RECOMMENDED = '__recommended__'

export interface TagPickerProps {
  selected: readonly string[]
  onAdd(tag: string): void
  onClose(): void
  searchTags?: (keyword: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
  /** getTagCategories 失败时调用一次（StrictMode 下也只一次） */
  onLoadError?(error: unknown): void
}

export function TagPicker({ selected, onAdd, onClose, searchTags, getTagCategories, getTagsByCategory, onLoadError }: TagPickerProps) {
  const p = useMessages().publish
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const onLoadErrorRef = useRef(onLoadError)
  useEffect(() => {
    onLoadErrorRef.current = onLoadError
  })
  const [keyword, setKeyword] = useState('')
  const [categories, setCategories] = useState<TagCategory[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Record<string, string[]>>({})
  const [results, setResults] = useState<{ query: string; list: string[] } | null>(null)
  const recommendedName = p.tags.recommended

  useEffect(() => inputRef.current?.focus(), [])

  useEffect(() => {
    let live = true
    const fallback = (): TagCategory[] => (searchTags ? [{ id: RECOMMENDED, name: recommendedName }] : [])
    const load = getTagCategories
      ? getTagCategories().then(
          (list) => (list.length > 0 ? list : fallback()),
          (error: unknown) => {
            if (live) onLoadErrorRef.current?.(error)
            return fallback()
          },
        )
      : Promise.resolve(fallback())
    void load.then((list) => {
      if (live) setCategories(list)
    })
    return () => {
      live = false
    }
  }, [getTagCategories, searchTags, recommendedName])

  const active = categories?.find((c) => c.id === activeId) ?? categories?.[0]
  const activeTags = active ? (active.tags ?? loaded[active.id]) : undefined

  useEffect(() => {
    if (!active || active.tags || loaded[active.id]) return
    const id = active.id
    const fetchTags = id === RECOMMENDED ? searchTags && (() => searchTags('')) : getTagsByCategory && (() => getTagsByCategory(id))
    let live = true
    void (fetchTags ? fetchTags() : Promise.resolve<string[]>([])).then(
      (list) => {
        if (live) setLoaded((prev) => ({ ...prev, [id]: list }))
      },
      () => {
        if (live) setLoaded((prev) => ({ ...prev, [id]: [] }))
      },
    )
    return () => {
      live = false
    }
  }, [active, loaded, searchTags, getTagsByCategory])

  const query = keyword.trim()
  const searching = query !== '' && !!searchTags
  useEffect(() => {
    if (!searching) return
    let live = true
    const timer = window.setTimeout(() => {
      searchTags!(query).then(
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
  }, [query, searching, searchTags])

  const list = searching ? (results?.query === query ? results.list : undefined) : activeTags

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    onAdd(keyword)
    setKeyword('')
  }

  return (
    <InlineLayer className="ex-popover ex-pub-tag-picker" role="dialog" aria-labelledby={titleId} onDismiss={onClose}>
      <div className="ex-pub-tag-picker__header">
        <span className="ex-pub-tag-picker__title" id={titleId}>
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
      {categories && categories.length > 0 && (
        <div className="ex-pub-tag-picker__body">
          <ul className="ex-pub-tag-picker__categories" aria-label={p.tags.categories}>
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cx('ex-pub-tag-picker__category', c.id === active?.id && 'is-active')}
                  aria-pressed={c.id === active?.id}
                  onClick={() => setActiveId(c.id)}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="ex-pub-tag-picker__main">
            <div className="ex-pub-tag-picker__section">{p.tags.section}</div>
            {list !== undefined &&
              (list.length === 0 ? (
                <div className="ex-pub-tag-picker__empty">{p.tags.empty}</div>
              ) : (
                <ul className="ex-pub-tag-picker__list" aria-label={p.tags.suggestions}>
                  {list.map((tag) => {
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
        </div>
      )}
      <div className="ex-pub-tag-picker__count">{formatMessage(p.tags.count, { count: MAX_TAGS - selected.length })}</div>
    </InlineLayer>
  )
}
