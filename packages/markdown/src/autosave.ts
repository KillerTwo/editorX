import type { EditorAdapters, EditorDocument } from '@editorx/toolbar'
import type { EditorStore } from './store'

export interface DraftSaverDeps {
  store: EditorStore
  /** 当前 Markdown 源码；判断是否有改动只用它，避免每次自动保存都整篇渲染 */
  getMarkdown(): string
  /** 只在确定要保存时调用（会渲染 HTML） */
  getDocument(): EditorDocument
  getAdapter(): EditorAdapters['onSaveDraft']
  onError(error: unknown): void
  now?: () => number
}

export interface DraftSaver {
  /** 有改动（或 force）且配置了 onSaveDraft 时保存；返回是否保存成功 */
  save(force?: boolean): Promise<boolean>
  /** 把当前内容记为已保存（挂载、ref.setValue 后调用） */
  markSaved(markdown: string): void
  isDirty(): boolean
}

export function createDraftSaver(deps: DraftSaverDeps): DraftSaver {
  const now = deps.now ?? Date.now
  let saved: string | null = null
  let inFlight: Promise<boolean> | null = null

  return {
    markSaved(markdown) {
      saved = markdown
    },
    isDirty: () => deps.getMarkdown() !== saved,
    save(force = false) {
      if (inFlight) return inFlight
      const adapter = deps.getAdapter()
      if (!adapter) return Promise.resolve(false)
      if (!force && deps.getMarkdown() === saved) return Promise.resolve(false)
      const doc = deps.getDocument()
      const markdown = doc.markdown ?? ''
      const { savedAt } = deps.store.get().save
      deps.store.set({ save: { status: 'saving', savedAt } })
      let pending: Promise<void>
      try {
        pending = Promise.resolve(adapter(doc))
      } catch (error) {
        pending = Promise.reject(error)
      }
      inFlight = pending
        .then(
          () => {
            saved = markdown
            deps.store.set({ save: { status: 'saved', savedAt: now() } })
            return true
          },
          (error: unknown) => {
            deps.store.set({ save: { status: 'error', savedAt } })
            deps.onError(error)
            return false
          },
        )
        .finally(() => {
          inFlight = null
        })
      return inFlight
    },
  }
}
