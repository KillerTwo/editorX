import type { EditorEngine } from '@geekx/markdown-core'
import { errorMessage, formatMessage, type EditorAdapters, type Messages, type NotifyType } from '@geekx/toolbar'
import type { EditorStore } from '../store'
import { failedMarkdown, findPlaceholder, imageMarkdown, uploadingMarkdown } from './placeholders'

export interface UploaderOptions {
  engine: EditorEngine
  store: EditorStore
  getAdapters(): EditorAdapters
  getMessages(): Messages
  notify(message: string, type?: NotifyType): void
  /** 只读时 upload/retry/remove 不改文档；进行中的上传仍会替换自己的占位 */
  isReadOnly?(): boolean
  createId?(): string
}

export interface Uploader {
  upload(files: readonly File[]): Promise<void>
  retry(id: string): Promise<void>
  remove(id: string): void
  /**
   * 组件挂载期间保持连接；断开后到达的上传结果被丢弃，不再写入引擎、store 或提示。
   * 传入编辑器 host 时监听其输入法组合事件，组合期间到达的替换排队到 compositionend（或焦点离开 host）之后。
   */
  attach(host?: HTMLElement | null): () => void
}

export function imageFiles(list: FileList | readonly File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

let sequence = 0
const defaultId = () => `${Date.now().toString(36)}${(sequence++).toString(36)}`

export function createUploader(opts: UploaderOptions): Uploader {
  const { engine, store } = opts
  const createId = opts.createId ?? defaultId
  const files = new Map<string, File>()
  const inFlight = new Set<string>()
  let attached = true
  let composing = false
  let idleWaiters: Array<() => void> = []
  const releaseWaiters = () => {
    const waiters = idleWaiters
    idleWaiters = []
    for (const resolve of waiters) resolve()
  }
  const readOnly = () => opts.isReadOnly?.() ?? false

  const dropFailure = (id: string) => {
    store.set({ uploads: store.get().uploads.filter((u) => u.id !== id) })
  }

  /** 按 id 替换占位，并把用户选区按长度差平移；占位不存在返回 false */
  const replacePlaceholder = (id: string, text: string): boolean => {
    const range = findPlaceholder(engine.getValue(), id)
    if (!range) return false
    const before = engine.getSelection()
    engine.replace(range.start, range.end, text)
    const delta = text.length - (range.end - range.start)
    const shift = (pos: number) => (pos >= range.end ? pos + delta : Math.min(pos, range.start + text.length))
    engine.setSelection(shift(before.start), shift(before.end))
    return true
  }

  const run = async (id: string, file: File) => {
    const upload = opts.getAdapters().uploadImage
    if (!upload) return
    inFlight.add(id)
    let result: { ok: true; url: string } | { ok: false; error: unknown }
    try {
      const response: { url?: unknown } | null | undefined = await upload(file)
      const url = response?.url
      if (typeof url !== 'string' || url === '') throw new TypeError('uploadImage must resolve to { url: string }')
      result = { ok: true, url }
    } catch (error) {
      result = { ok: false, error }
    }
    // 组合输入期间改动文档会打断输入法：等 compositionend 后再按完成顺序替换
    while (composing && attached) await new Promise<void>((resolve) => idleWaiters.push(resolve))
    inFlight.delete(id)
    if (!attached) return
    if (result.ok) {
      replacePlaceholder(id, imageMarkdown(file.name, result.url))
      files.delete(id)
      return
    }
    const m = opts.getMessages()
    if (!replacePlaceholder(id, failedMarkdown(id, m.upload.failed))) {
      files.delete(id)
      return
    }
    store.set({ uploads: [...store.get().uploads.filter((u) => u.id !== id), { id, name: file.name }] })
    opts.notify(formatMessage(m.upload.error, { name: file.name, message: errorMessage(result.error) }), 'error')
  }

  return {
    async upload(list) {
      if (!attached || readOnly()) return
      const m = opts.getMessages()
      if (!opts.getAdapters().uploadImage) {
        opts.notify(m.upload.noAdapter, 'warning')
        return
      }
      const images = imageFiles(list)
      if (images.length < list.length) opts.notify(m.upload.notImage, 'warning')
      if (images.length === 0) return
      const entries = images.map((file) => ({ id: createId(), file }))
      const { start, end } = engine.getSelection()
      engine.replace(start, end, entries.map(({ id }) => uploadingMarkdown(id, m.upload.uploading)).join('\n'))
      for (const { id, file } of entries) files.set(id, file)
      await Promise.all(entries.map(({ id, file }) => run(id, file)))
    },

    async retry(id) {
      const file = files.get(id)
      if (!attached || readOnly() || !file || inFlight.has(id)) return
      if (!opts.getAdapters().uploadImage) {
        opts.notify(opts.getMessages().upload.noAdapter, 'warning')
        return
      }
      dropFailure(id)
      if (!replacePlaceholder(id, uploadingMarkdown(id, opts.getMessages().upload.uploading))) {
        files.delete(id)
        return
      }
      await run(id, file)
    },

    remove(id) {
      if (!attached || readOnly()) return
      files.delete(id)
      dropFailure(id)
      const range = findPlaceholder(engine.getValue(), id)
      if (range) engine.replace(range.start, range.end, '')
    },

    attach(host) {
      attached = true
      const onStart = () => {
        composing = true
      }
      // 宿主捕获阶段先于引擎自己的 compositionend 处理：推迟到微任务，等引擎同步完组合结果
      const onEnd = () => {
        composing = false
        queueMicrotask(releaseWaiters)
      }
      // 部分输入法/浏览器在组合中失焦时不派发 compositionend：焦点离开 host 也视为组合结束
      const onFocusOut = (e: FocusEvent) => {
        if (!composing) return
        const next = e.relatedTarget
        if (next instanceof Node && host?.contains(next)) return
        onEnd()
      }
      host?.addEventListener('compositionstart', onStart, true)
      host?.addEventListener('compositionend', onEnd, true)
      host?.addEventListener('focusout', onFocusOut, true)
      return () => {
        host?.removeEventListener('compositionstart', onStart, true)
        host?.removeEventListener('compositionend', onEnd, true)
        host?.removeEventListener('focusout', onFocusOut, true)
        attached = false
        composing = false
        releaseWaiters()
      }
    },
  }
}
