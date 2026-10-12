import type { CoverMode, EditorDocument, EditorType, PublishCover, PublishPayload, PublishSettings } from '@editorx/toolbar'

export const FALLBACK_DOC: EditorDocument = { editorType: 'markdown', title: '', html: '' }

export function resolveTemplate(
  current: string,
  editorType: EditorType,
  templates?: readonly { id: string; disabled?: boolean }[],
): string {
  const disabled = (id: string) => {
    if (templates) {
      const found = templates.find((item) => item.id === id)
      return !found || Boolean(found.disabled)
    }
    return id === 'moyan' ? editorType !== 'markdown' : id !== 'default' && id !== 'simple'
  }
  if (!disabled(current)) return current
  return 'default'
}

export const COVER_CAPACITY: Record<CoverMode, number> = { single: 1, triple: 3, none: 0 }

export const DEFAULT_SETTINGS: Readonly<PublishSettings> = {
  tags: [],
  cover: { mode: 'single', urls: [] },
  summary: '',
  categories: [],
  articleType: 'original',
  declaration: 'none',
  backupToGitCode: false,
  visibility: 'public',
  template: 'default',
  multiPlatform: false,
}

export function normalizeCover(cover: PublishCover): PublishCover {
  const urls = [...new Set(cover.urls.filter(Boolean))].slice(0, COVER_CAPACITY[cover.mode])
  return { mode: cover.mode, urls }
}

export function createSettings(partial?: Partial<PublishSettings>): PublishSettings {
  const merged: PublishSettings = { ...DEFAULT_SETTINGS, ...partial }
  return {
    ...merged,
    tags: [...merged.tags],
    categories: [...merged.categories],
    cover: normalizeCover(merged.cover),
  }
}

export function setCoverMode(cover: PublishCover, mode: CoverMode): PublishCover {
  return normalizeCover({ mode, urls: cover.urls })
}

export function pickCover(cover: PublishCover, url: string): PublishCover {
  if (cover.urls.includes(url)) return { ...cover, urls: cover.urls.filter((u) => u !== url) }
  if (cover.mode === 'single') return { ...cover, urls: [url] }
  if (cover.urls.length >= COVER_CAPACITY[cover.mode]) return cover
  return { ...cover, urls: [...cover.urls, url] }
}

export function placeCover(cover: PublishCover, index: number, url: string): PublishCover {
  const urls = [...cover.urls]
  if (index < urls.length) urls[index] = url
  else urls.push(url)
  return normalizeCover({ mode: cover.mode, urls })
}

export function removeCover(cover: PublishCover, index: number): PublishCover {
  return { ...cover, urls: cover.urls.filter((_, i) => i !== index) }
}

export function toPayload(doc: EditorDocument, settings: PublishSettings): PublishPayload {
  const { sourceUrl, ...rest } = settings
  const url = settings.articleType === 'original' ? undefined : sourceUrl?.trim()
  return { ...doc, ...rest, ...(url ? { sourceUrl: url } : {}) }
}
