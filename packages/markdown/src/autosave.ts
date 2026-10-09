import type { EditorAdapters, EditorDocument } from '@editorx/toolbar'
import type { EditorStore } from './store'

export interface SaveErrorInfo {
  /** 自动保存且上一次保存已失败：状态栏已显示失败，无需再次提示 */
  repeated: boolean
}

export interface DraftSaverDeps {
  store: EditorStore
  /** 当前 Markdown 源码；判断是否有改动只用它，避免每次自动保存都整篇渲染 */
  getMarkdown(): string
  /** 只在确定要保存时调用（会渲染 HTML） */
  getDocument(): EditorDocument
  getAdapter(): EditorAdapters['onSaveDraft']
  onError(error: unknown, info: SaveErrorInfo): void
  now?: () => number
}

export interface DraftSaver {
  /**
   * 有改动（或 force）且配置了 onSaveDraft 时保存；返回是否保存成功。
   * 保存进行中：force 或内容已变则排队一次后续保存（多次请求合并），否则复用进行中的保存。
   */
  save(force?: boolean): Promise<boolean>
  /** 把当前内容记为已保存（挂载、ref.setValue 后调用） */
  markSaved(markdown: string): void
  isDirty(): boolean
}

export function createDraftSaver(deps: DraftSaverDeps): DraftSaver {
  const now = deps.now ?? Date.now
  let saved: string | null = null
  /** markSaved 递增；进行中的保存只在其间没有 markSaved 时写回 saved */
  let generation = 0
  let inFlight: Promise<boolean> | null = null
  let inFlightMarkdown = ''
  let queued: Promise<boolean> | null = null
  let queuedForce = false

  function start(force: boolean): Promise<boolean> {
    const adapter = deps.getAdapter()
    if (!adapter) return Promise.resolve(false)
    if (!force && deps.getMarkdown() === saved) return Promise.resolve(false)
    const doc = deps.getDocument()
    const markdown = doc.markdown ?? ''
    const startedAt = generation
    const { status: prevStatus, savedAt } = deps.store.get().save
    deps.store.set({ save: { status: 'saving', savedAt } })
    let pending: Promise<void>
    try {
      pending = Promise.resolve(adapter(doc))
    } catch (error) {
      pending = Promise.reject(error)
    }
    inFlightMarkdown = markdown
    inFlight = pending
      .then(
        () => {
          if (startedAt === generation) saved = markdown
          deps.store.set({ save: { status: 'saved', savedAt: now() } })
          return true
        },
        (error: unknown) => {
          deps.store.set({ save: { status: 'error', savedAt } })
          deps.onError(error, { repeated: !force && prevStatus === 'error' })
          return false
        },
      )
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }

  function save(force = false): Promise<boolean> {
    if (!inFlight) return start(force)
    if (!queued && !force && deps.getMarkdown() === inFlightMarkdown) return inFlight
    queuedForce ||= force
    queued ??= inFlight.then(() => {
      const nextForce = queuedForce
      queued = null
      queuedForce = false
      return save(nextForce)
    })
    return queued
  }

  return {
    markSaved(markdown) {
      saved = markdown
      generation++
    },
    isDirty: () => deps.getMarkdown() !== saved,
    save,
  }
}
