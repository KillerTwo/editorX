import { useMessages, type TagCategory } from '@geekx/toolbar'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLatest } from '../use-latest'

export const RECOMMENDED = '__recommended__'

export interface TagSources {
  searchTags?: (keyword: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
  /** 每次 getTagCategories 失败调用一次（StrictMode 下也只一次）；卸载后的失败不调用 */
  onLoadError?(error: unknown): void
}

export interface TagCatalog {
  /** 有分类来源（getTagCategories 或 searchTags）时面板显示双栏 */
  hasSource: boolean
  canSearch: boolean
  /** null：分类加载中 */
  categories: TagCategory[] | null
  /** undefined：加载中；加载失败不缓存，显示为空列表 */
  tagsOf(category: TagCategory): string[] | undefined
  /** 已缓存或加载中时忽略；失败的会重新加载 */
  loadCategories(): void
  loadTags(category: TagCategory): void
  search(keyword: string): Promise<string[]>
}

/** adapter 同步抛错也转成 rejection */
const attempt = <T>(load: () => Promise<T>): Promise<T> => Promise.resolve().then(load)

/** 标签分类与各分类标签的缓存：每次挂载只成功加载一次，失败的下次再试 */
export function useTagCatalog(sources: TagSources): TagCatalog {
  const recommendedName = useMessages().publish.tags.recommended
  const latest = useLatest(sources)
  const hasCategories = !!sources.getTagCategories
  const canSearch = !!sources.searchTags
  const [loadedCategories, setLoadedCategories] = useState<TagCategory[] | null>(null)
  const [categoriesFailed, setCategoriesFailed] = useState(false)
  const [tags, setTags] = useState<Readonly<Record<string, string[]>>>({})
  const [failedTags, setFailedTags] = useState<ReadonlySet<string>>(() => new Set())
  const alive = useRef(false)
  const categoriesStatus = useRef<'idle' | 'pending' | 'done'>('idle')
  const tagsStatus = useRef(new Map<string, 'pending' | 'done'>())
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const loadCategories = useCallback(() => {
    const load = latest.current.getTagCategories
    if (!load || categoriesStatus.current !== 'idle') return
    categoriesStatus.current = 'pending'
    void attempt(load).then(
      (list) => {
        categoriesStatus.current = 'done'
        if (!alive.current) return
        setLoadedCategories(list)
        setCategoriesFailed(false)
      },
      (error: unknown) => {
        categoriesStatus.current = 'idle'
        if (!alive.current) return
        setCategoriesFailed(true)
        latest.current.onLoadError?.(error)
      },
    )
  }, [latest])

  const loadTags = useCallback(
    (category: TagCategory) => {
      const { id } = category
      if (category.tags || tagsStatus.current.has(id)) return
      const { searchTags, getTagsByCategory } = latest.current
      const load = id === RECOMMENDED ? searchTags && (() => searchTags('')) : getTagsByCategory && (() => getTagsByCategory(id))
      tagsStatus.current.set(id, 'pending')
      void (load ? attempt(load) : Promise.resolve<string[]>([])).then(
        (list) => {
          tagsStatus.current.set(id, 'done')
          if (!alive.current) return
          setTags((prev) => ({ ...prev, [id]: list }))
          setFailedTags((prev) => {
            if (!prev.has(id)) return prev
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        () => {
          tagsStatus.current.delete(id)
          if (alive.current) setFailedTags((prev) => new Set(prev).add(id))
        },
      )
    },
    [latest],
  )

  const search = useCallback((keyword: string) => attempt(() => latest.current.searchTags!(keyword)), [latest])

  const fallback = useMemo<TagCategory[]>(() => (canSearch ? [{ id: RECOMMENDED, name: recommendedName }] : []), [canSearch, recommendedName])
  let categories: TagCategory[] | null = fallback
  if (hasCategories) {
    if (loadedCategories) categories = loadedCategories.length > 0 ? loadedCategories : fallback
    else if (!categoriesFailed) categories = null
  }

  return {
    hasSource: hasCategories || canSearch,
    canSearch,
    categories,
    tagsOf: (category) => category.tags ?? tags[category.id] ?? (failedTags.has(category.id) ? [] : undefined),
    loadCategories,
    loadTags,
    search,
  }
}
