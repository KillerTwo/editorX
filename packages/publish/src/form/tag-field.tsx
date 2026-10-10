import { useMessages, type TagCategory } from '@editorx/toolbar'
import { Tag } from '@editorx/ui'
import { useRef, useState } from 'react'
import { PlusIcon } from '../icons'
import { MAX_TAGS } from '../validate'
import { errorId } from './form-item'
import { TagPicker } from './tag-picker'

export interface TagFieldProps {
  id: string
  tags: readonly string[]
  onChange(tags: string[]): void
  /** 缺失时（无论 hide 还是 disable 策略）推荐分类不出现；两个分类 adapter 也缺时面板只有输入框 */
  searchTags?: (keyword: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
  onLoadError?(error: unknown): void
  invalid: boolean
}

export function TagField({ id, tags, onChange, searchTags, getTagCategories, getTagsByCategory, onLoadError, invalid }: TagFieldProps) {
  const p = useMessages().publish
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    // 焦点在面板外的其他控件时（如弹窗内别的字段按 Esc）不抢走焦点
    const active = rootRef.current?.ownerDocument.activeElement
    if (!active || active === active.ownerDocument.body || rootRef.current?.contains(active)) addRef.current?.focus()
  }
  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    const next = [...tags, tag]
    onChange(next)
    if (next.length >= MAX_TAGS) setOpen(false)
  }
  const canAdd = tags.length < MAX_TAGS
  return (
    <div ref={rootRef} className="ex-pub-line ex-pub-tags">
      {tags.map((tag) => (
        <Tag
          key={tag}
          variant="primary"
          className="ex-pub-tag"
          closable
          closeLabel={p.tags.remove}
          onClose={() => onChange(tags.filter((t) => t !== tag))}
        >
          {tag}
        </Tag>
      ))}
      {canAdd && (
        <button
          ref={addRef}
          type="button"
          className="ex-pub-tag-add"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId(id) : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <PlusIcon size={10} className="ex-pub-tag-add__plus" />
          {p.tags.add}
        </button>
      )}
      {open && canAdd && (
        <TagPicker
          selected={tags}
          onAdd={add}
          onClose={close}
          searchTags={searchTags}
          getTagCategories={getTagCategories}
          getTagsByCategory={getTagsByCategory}
          onLoadError={onLoadError}
        />
      )}
    </div>
  )
}
