import type { EditorDocument } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { createDraftSaver } from './autosave'
import { createEditorStore } from './store'

type SaveDraft = (doc: EditorDocument) => Promise<void>

function setup(adapter?: SaveDraft) {
  let value = 'a'
  const store = createEditorStore()
  const onError = vi.fn()
  const getDocument = vi.fn((): EditorDocument => ({ editorType: 'markdown', title: 't', markdown: value, html: '' }))
  const saver = createDraftSaver({
    store,
    getMarkdown: () => value,
    getDocument,
    getAdapter: () => adapter,
    onError,
    now: () => 1000,
  })
  saver.markSaved('a')
  return {
    store,
    saver,
    onError,
    getDocument,
    setValue: (next: string) => {
      value = next
    },
  }
}

describe('createDraftSaver', () => {
  it('未改动不保存；改动后保存并记录时间；force 时无改动也保存', async () => {
    const adapter = vi.fn<SaveDraft>(async () => {})
    const { saver, store, setValue } = setup(adapter)
    expect(saver.isDirty()).toBe(false)
    expect(await saver.save()).toBe(false)
    setValue('b')
    expect(saver.isDirty()).toBe(true)
    const pending = saver.save()
    expect(store.get().save.status).toBe('saving')
    expect(await pending).toBe(true)
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'b', title: 't' }))
    expect(store.get().save).toEqual({ status: 'saved', savedAt: 1000 })
    expect(saver.isDirty()).toBe(false)
    expect(await saver.save()).toBe(false)
    expect(await saver.save(true)).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('未改动时不构建文档（不渲染 HTML）', async () => {
    const adapter = vi.fn<SaveDraft>(async () => {})
    const { saver, getDocument } = setup(adapter)
    expect(saver.isDirty()).toBe(false)
    expect(await saver.save()).toBe(false)
    expect(await saver.save()).toBe(false)
    expect(getDocument).not.toHaveBeenCalled()
    expect(adapter).not.toHaveBeenCalled()
  })

  it('保存进行中再次调用复用同一次保存', async () => {
    let resolve!: () => void
    const adapter = vi.fn<SaveDraft>(() => new Promise<void>((r) => (resolve = r)))
    const { saver, setValue } = setup(adapter)
    setValue('b')
    const first = saver.save()
    const second = saver.save()
    resolve()
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('保存进行中显示「保存中」；期间的编辑在保存后仍为未保存', async () => {
    let resolve!: () => void
    const adapter = vi.fn<SaveDraft>(() => new Promise<void>((r) => (resolve = r)))
    const { saver, store, setValue } = setup(adapter)
    setValue('b')
    const pending = saver.save()
    expect(store.get().save.status).toBe('saving')
    setValue('c')
    resolve()
    expect(await pending).toBe(true)
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'b' }))
    expect(saver.isDirty()).toBe(true)
  })

  it('保存进行中 force 或内容已变：排队一次后续保存，结果取后续保存', async () => {
    const resolvers: Array<() => void> = []
    const adapter = vi.fn<SaveDraft>(() => new Promise<void>((r) => resolvers.push(r)))
    const { saver, setValue } = setup(adapter)
    setValue('b')
    const first = saver.save()
    setValue('c')
    const forced = saver.save(true)
    const again = saver.save()
    expect(again).toBe(forced)
    let settled = false
    void forced.then(() => (settled = true))
    resolvers[0]!()
    expect(await first).toBe(true)
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2))
    expect(adapter).toHaveBeenLastCalledWith(expect.objectContaining({ markdown: 'c' }))
    expect(settled).toBe(false)
    resolvers[1]!()
    expect(await forced).toBe(true)
    expect(saver.isDirty()).toBe(false)
  })

  it('保存进行中 markSaved（载入新文档）不被旧保存结果覆盖', async () => {
    let resolve!: () => void
    const adapter = vi.fn<SaveDraft>(() => new Promise<void>((r) => (resolve = r)))
    const { saver, setValue } = setup(adapter)
    setValue('b')
    const pending = saver.save()
    setValue('载入')
    saver.markSaved('载入')
    resolve()
    expect(await pending).toBe(true)
    expect(saver.isDirty()).toBe(false)
  })

  it('连续自动保存失败只有第一次不是 repeated；手动保存失败总是提示', async () => {
    const adapter = vi.fn<SaveDraft>(async () => {
      throw new Error('网络')
    })
    const { saver, onError, setValue } = setup(adapter)
    setValue('b')
    expect(await saver.save()).toBe(false)
    expect(await saver.save()).toBe(false)
    expect(await saver.save(true)).toBe(false)
    expect(onError.mock.calls.map((call) => call[1])).toEqual([{ repeated: false }, { repeated: true }, { repeated: false }])
  })

  it('失败：状态为 error、上报错误、内容仍视为未保存', async () => {
    const adapter = vi.fn<SaveDraft>().mockRejectedValueOnce(new Error('网络')).mockResolvedValueOnce(undefined)
    const { saver, store, onError, setValue } = setup(adapter)
    setValue('b')
    expect(await saver.save()).toBe(false)
    expect(store.get().save).toEqual({ status: 'error', savedAt: null })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: '网络' }), { repeated: false })
    expect(saver.isDirty()).toBe(true)
    expect(await saver.save()).toBe(true)
  })

  it('没有 onSaveDraft 时什么都不做', async () => {
    const { saver, store, setValue, getDocument } = setup(undefined)
    setValue('b')
    expect(await saver.save(true)).toBe(false)
    expect(store.get().save.status).toBe('idle')
    expect(getDocument).not.toHaveBeenCalled()
  })
})
