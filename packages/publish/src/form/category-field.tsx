import { useMessages, type Category } from '@editorx/toolbar'
import { Checkbox } from '@editorx/ui'
import type { AdapterState } from '../adapter-state'
import type { PublishVariant } from '../types'
import { labelId } from './form-item'

export interface CategoryFieldProps {
  id: string
  value: readonly string[]
  onChange(ids: string[]): void
  /** null 为加载中 */
  categories: Category[] | null
  state: AdapterState
  variant: PublishVariant
  selection?: 'multiple' | 'single'
}

export function CategoryField({
  id,
  value,
  onChange,
  categories,
  state,
  variant,
  selection = 'multiple',
}: CategoryFieldProps) {
  const p = useMessages().publish
  if (categories === null) return <span className="ex-pub-hint">{p.categories.loading}</span>
  if (state !== 'enabled' || categories.length === 0) {
    return <span className="ex-pub-hint">{variant === 'modal' ? p.categories.emptyModal : p.categories.emptyInline}</span>
  }
  return (
    <div className="ex-pub-line ex-pub-categories" role="group" aria-labelledby={labelId(id)}>
      {categories.map((category) => (
        <Checkbox
          key={category.id}
          checked={value.includes(category.id)}
          onChange={(on) => {
            if (selection === 'single') {
              onChange(on ? [category.id] : [])
              return
            }
            onChange(on ? [...value, category.id] : value.filter((v) => v !== category.id))
          }}
        >
          {category.name}
        </Checkbox>
      ))}
    </div>
  )
}
