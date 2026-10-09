import { zhCN, type EditorAdapters, type EditorDocument, type PublishSettings } from '@editorx/toolbar'
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSettings } from './settings'
import { useAsyncList } from './use-async-list'
import { usePublishController, type PublishControllerOptions } from './use-publish-controller'

const NOW = new Date(2026, 9, 9, 12, 0).getTime()
const doc: EditorDocument = { editorType: 'markdown', title: '一篇测试文章', markdown: '正文', html: '<p>正文</p>' }
const strict = { wrapper: StrictMode }

function setup(options: Partial<PublishControllerOptions> = {}) {
  const notify = vi.fn()
  const onPublish = vi.fn<NonNullable<EditorAdapters['onPublish']>>(async () => {})
  const onSaveDraft = vi.fn<NonNullable<EditorAdapters['onSaveDraft']>>(async () => {})
  const adapters: EditorAdapters = { onPublish, onSaveDraft }
  const hook = renderHook(
    (props: Partial<PublishControllerOptions>) =>
      usePublishController({ adapters, messages: zhCN.publish, notify, document: doc, now: () => NOW, ...options, ...props }),
    strict,
  )
  return { ...hook, notify, onPublish, onSaveDraft }
}

describe('usePublishController', () => {
  it('非受控：defaultValue 合并默认值，update 写入并回调 onChange', () => {
    const onChange = vi.fn()
    const { result } = setup({ defaultValue: { visibility: 'fans' }, onChange })
    expect(result.current.settings).toEqual(createSettings({ visibility: 'fans' }))
    act(() => result.current.update('tags', ['Vue']))
    expect(result.current.settings.tags).toEqual(['Vue'])
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['Vue'], visibility: 'fans' }))
  })

  it('同一事件内连续 update 不丢字段；改回原创时删除 sourceUrl', () => {
    const { result } = setup()
    act(() => {
      result.current.update('articleType', 'reprint')
      result.current.update('sourceUrl', 'https://a.com')
    })
    expect(result.current.settings).toMatchObject({ articleType: 'reprint', sourceUrl: 'https://a.com' })
    act(() => result.current.update('articleType', 'original'))
    expect(result.current.settings).not.toHaveProperty('sourceUrl')
  })

  it('受控：settings 跟随 value，update 只回调 onChange', () => {
    const onChange = vi.fn()
    const value = createSettings({ tags: ['A'] })
    const { result, rerender } = setup({ value, onChange })
    act(() => result.current.update('tags', ['A', 'B']))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tags: ['A', 'B'] }))
    expect(result.current.settings.tags).toEqual(['A'])
    rerender({ value: createSettings({ tags: ['C'] }) })
    expect(result.current.settings.tags).toEqual(['C'])
  })

  it('受控：同一事件内连续 update 累积；父组件忽略后下一次 update 基于父组件的值', () => {
    const onChange = vi.fn()
    const { result } = setup({ value: createSettings({ tags: ['A'] }), onChange })
    act(() => {
      result.current.update('tags', ['B'])
      result.current.update('summary', '摘要')
    })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['B'], summary: '摘要' }))
    act(() => result.current.update('visibility', 'fans'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['A'], summary: '', visibility: 'fans' }))
  })

  it('校验失败：写 errors、计数、toast 首个错误，不调用 onPublish；改动字段清除错误', async () => {
    const { result, notify, onPublish } = setup()
    let ok = true
    await act(async () => {
      ok = await result.current.publish()
    })
    expect(ok).toBe(false)
    expect(result.current.errors.tags).toBe('请至少添加 1 个文章标签')
    expect(result.current.failedAttempts).toBe(1)
    expect(notify).toHaveBeenCalledWith('请至少添加 1 个文章标签', 'error')
    expect(onPublish).not.toHaveBeenCalled()
    act(() => result.current.update('tags', ['React']))
    expect(result.current.errors.tags).toBeUndefined()
  })

  it('立即发布：payload = 文档 + 设置（不含 scheduledAt），toast 成功并回调 onPublished', async () => {
    const onPublished = vi.fn()
    const { result, notify, onPublish } = setup({
      defaultValue: { tags: ['React'], scheduledAt: new Date(NOW + 3_600_000).toISOString() },
      onPublished,
    })
    await act(async () => {
      expect(await result.current.publish()).toBe(true)
    })
    const payload = onPublish.mock.lastCall![0]
    expect(payload).toMatchObject({ ...doc, tags: ['React'], visibility: 'public' })
    expect(payload).not.toHaveProperty('scheduledAt')
    expect(notify).toHaveBeenCalledWith('发布成功', 'success')
    expect(onPublished).toHaveBeenCalledWith(payload)
    expect(result.current.busy).toBeNull()
  })

  it('定时发布：payload 带 scheduledAt；过去时间报错', async () => {
    const { result, notify, onPublish } = setup({ defaultValue: { tags: ['React'] } })
    const future = new Date(2026, 9, 9, 13, 5).toISOString()
    await act(async () => {
      await result.current.publish(future)
    })
    expect(onPublish.mock.lastCall![0].scheduledAt).toBe(future)
    expect(notify).toHaveBeenCalledWith('已设置定时发布：2026-10-09 13:05', 'success')
    await act(async () => {
      await result.current.publish(new Date(NOW - 1).toISOString())
    })
    expect(result.current.errors.scheduledAt).toBe('发布时间需晚于当前时间')
    expect(onPublish).toHaveBeenCalledTimes(1)
  })

  it('onPublish 失败：toast 错误并返回 false；进行中重复调用被忽略', async () => {
    let reject!: (e: Error) => void
    const onPublish = vi.fn(() => new Promise<void>((_, r) => (reject = r)))
    const notify = vi.fn()
    const { result } = renderHook(
      () =>
        usePublishController({
          adapters: { onPublish },
          messages: zhCN.publish,
          notify,
          defaultValue: { tags: ['React'] },
          now: () => NOW,
        }),
      strict,
    )
    let first!: Promise<boolean>
    act(() => {
      first = result.current.publish()
    })
    expect(result.current.busy).toBe('publish')
    await act(async () => {
      expect(await result.current.publish()).toBe(false)
    })
    await act(async () => {
      reject(new Error('boom'))
      expect(await first).toBe(false)
    })
    expect(onPublish).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('发布失败：boom', 'error')
  })

  it('rules 覆盖：关闭标签规则后可无标签发布；标题过短报错', async () => {
    const { result, onPublish } = setup({ rules: { tags: false } })
    await act(async () => {
      await result.current.publish()
    })
    expect(onPublish).toHaveBeenCalledTimes(1)
    const short = setup({ rules: { tags: false }, document: { ...doc, title: '短' } })
    await act(async () => {
      await short.result.current.publish()
    })
    expect(short.result.current.errors.title).toBe('文章标题需为 5～100 个字')
  })

  it('saveDraft：调用 onSaveDraft(doc, settings) 并提示；失败提示错误', async () => {
    const { result, notify, onSaveDraft } = setup({ defaultValue: { tags: ['X'] } })
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(true)
    })
    expect(onSaveDraft).toHaveBeenCalledWith(doc, expect.objectContaining({ tags: ['X'] }))
    expect(notify).toHaveBeenCalledWith('草稿已保存', 'success')
    onSaveDraft.mockRejectedValueOnce(new Error('网络错误'))
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(false)
    })
    expect(notify).toHaveBeenCalledWith('保存草稿失败：网络错误', 'error')
  })

  it('缺少 adapter 时 publish / saveDraft 返回 false', async () => {
    const { result } = renderHook(
      () => usePublishController({ adapters: {}, messages: zhCN.publish, notify: vi.fn(), defaultValue: { tags: ['A'] } }),
      strict,
    )
    await act(async () => {
      expect(await result.current.publish()).toBe(false)
      expect(await result.current.saveDraft()).toBe(false)
    })
  })
})

describe('useAsyncList', () => {
  it('未启用为 []；启用后先 null 再得到结果；失败回调 onError 并置 []', async () => {
    const onError = vi.fn()
    const off = renderHook(() => useAsyncList<string>(undefined, onError), strict)
    expect(off.result.current).toEqual([])
    const ok = renderHook(() => useAsyncList(async () => ['a'], onError), strict)
    expect(ok.result.current).toBeNull()
    await waitFor(() => expect(ok.result.current).toEqual(['a']))
    const bad = renderHook(() => useAsyncList<string>(() => Promise.reject(new Error('x')), onError), strict)
    await waitFor(() => expect(bad.result.current).toEqual([]))
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })
})

const _typeCheck: PublishSettings = createSettings()
void _typeCheck
