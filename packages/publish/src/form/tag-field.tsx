import { useMessages } from '@editorx/toolbar'
import { Tag } from '@editorx/ui'
import { useEffect, useRef, useState } from 'react'
import { PlusIcon } from '../icons'
import { MAX_TAGS } from '../validate'
import { errorId } from './form-item'
import { hasTag, TagPicker } from './tag-picker'
import { useTagCatalog, type TagSources } from './use-tag-catalog'

export interface TagFieldProps extends TagSources {
  id: string
  tags: readonly string[]
  onChange(tags: string[]): void
  invalid: boolean
}

/** 缺 searchTags 时（无论 hide 还是 disable 策略）推荐分类不出现；两个分类 adapter 也缺时面板只有输入框 */
export function TagField({ id, tags, onChange, invalid, ...sources }: TagFieldProps) {
  const p = useMessages().publish
  const [open, setOpen] = useState(false)
  const catalog = useTagCatalog(sources)
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  /** 提交后要聚焦的标签 × 下标：不存在则退到上一个，再退到添加按钮或标签行 */
  const pendingFocus = useRef<number | null>(null)
  useEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    const closes = rootRef.current?.querySelectorAll<HTMLElement>('.ex-tag__close')
    ;(closes?.[index] ?? closes?.[index - 1] ?? addRef.current ?? rootRef.current)?.focus()
  })
  const close = () => {
    setOpen(false)
    // 焦点在面板外的其他控件时（如弹窗内别的字段按 Esc）不抢走焦点
    const active = rootRef.current?.ownerDocument.activeElement
    if (!active || active === active.ownerDocument.body || rootRef.current?.contains(active)) addRef.current?.focus()
  }
  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || hasTag(tags, tag) || tags.length >= MAX_TAGS) return false
    const next = [...tags, tag]
    onChange(next)
    if (next.length >= MAX_TAGS) {
      // 添加按钮随面板一起卸载，焦点交给最后一个标签的 ×
      setOpen(false)
      pendingFocus.current = next.length - 1
    }
    return true
  }
  const remove = (index: number) => {
    pendingFocus.current = index
    onChange(tags.filter((_, i) => i !== index))
  }
  const canAdd = tags.length < MAX_TAGS
  return (
    <div ref={rootRef} className="ex-pub-line ex-pub-tags" tabIndex={-1}>
      {tags.map((tag, index) => (
        <Tag
          key={tag}
          variant="primary"
          className="ex-pub-tag"
          closable
          closeLabel={p.tags.remove}
          onClose={() => remove(index)}
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
      {open && canAdd && <TagPicker selected={tags} onAdd={add} onClose={close} catalog={catalog} />}
    </div>
  )
}
