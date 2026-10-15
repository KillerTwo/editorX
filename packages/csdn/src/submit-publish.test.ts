import { createSettings } from '@geekx/publish'
import { zhCN, type EditorAdapters, type EditorDocument } from '@geekx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { submitPublish } from './submit-publish'

const messages = zhCN.publish
const ready: EditorDocument = {
  editorType: 'markdown',
  title: '足够长的标题',
  markdown: 'Hello',
  html: '<p>Hello</p>',
}

function setup(document: EditorDocument = ready, settings = createSettings({ tags: ['jvm'] })) {
  const onPublish = vi.fn(async () => undefined)
  const notify = vi.fn()
  return { onPublish, notify, settings, document }
}

describe('submitPublish', () => {
  it('五个空格不算可发布标题，四字标题同样不调用 onPublish', async () => {
    const spaces = setup({ ...ready, title: '     ' })
    await submitPublish({
      document: spaces.document,
      settings: spaces.settings,
      adapters: { onPublish: spaces.onPublish },
      notify: spaces.notify,
      messages,
    })
    expect(spaces.onPublish).not.toHaveBeenCalled()
    expect(spaces.notify).toHaveBeenCalledWith('文章标题需为 5～100 个字', 'error')

    const short = setup({ ...ready, title: 'abcd' })
    await submitPublish({
      document: short.document,
      settings: short.settings,
      adapters: { onPublish: short.onPublish },
      notify: short.notify,
      messages,
    })
    expect(short.onPublish).not.toHaveBeenCalled()
    expect(short.notify).toHaveBeenCalledWith('文章标题需为 5～100 个字', 'error')
  })

  it('空白正文不调用 onPublish', async () => {
    for (const html of ['<p> </p>', '<p>&nbsp;</p>', '']) {
      const ctx = setup({ ...ready, html })
      await submitPublish({
        document: ctx.document,
        settings: ctx.settings,
        adapters: { onPublish: ctx.onPublish },
        notify: ctx.notify,
        messages,
      })
      expect(ctx.onPublish).not.toHaveBeenCalled()
      expect(ctx.notify).toHaveBeenCalledWith('正文不能为空', 'error')
    }
  })

  it('标题和正文以及设置都通过时，onPublish 收到文档加设置', async () => {
    const ctx = setup(ready, createSettings({ tags: ['jvm'], template: 'moyan' }))
    const ok = await submitPublish({
      document: ctx.document,
      settings: ctx.settings,
      adapters: { onPublish: ctx.onPublish },
      notify: ctx.notify,
      messages,
    })
    expect(ok).toBe(true)
    expect(ctx.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        editorType: 'markdown',
        title: '足够长的标题',
        markdown: 'Hello',
        html: '<p>Hello</p>',
        tags: ['jvm'],
        template: 'moyan',
      }),
    )
    expect(ctx.notify).toHaveBeenCalledWith('发布成功', 'success')
  })

  it('富文本下墨衍模板会回到 default', async () => {
    const ctx = setup(
      { editorType: 'richtext', title: '足够长的标题', html: '<p>Hello</p>', markdown: undefined },
      createSettings({ tags: ['jvm'], template: 'moyan' }),
    )
    await submitPublish({
      document: ctx.document,
      settings: ctx.settings,
      adapters: { onPublish: ctx.onPublish },
      notify: ctx.notify,
      messages,
    })
    expect(ctx.onPublish).toHaveBeenCalledWith(expect.objectContaining({ template: 'default', markdown: undefined }))
  })

  it('设置里带 scheduledAt 时，立即发布的 payload 不含该字段', async () => {
    const settings = createSettings({ tags: ['jvm'], scheduledAt: '2099-01-01T00:00:00.000Z' })
    const onPublish = vi.fn<NonNullable<EditorAdapters['onPublish']>>(async () => undefined)
    const notify = vi.fn()
    const ok = await submitPublish({
      document: ready,
      settings,
      adapters: { onPublish },
      notify,
      messages,
    })
    expect(ok).toBe(true)
    expect(onPublish).toHaveBeenCalledTimes(1)
    expect(onPublish.mock.calls[0]?.[0]).not.toHaveProperty('scheduledAt')
    expect(onPublish.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ tags: ['jvm'], title: '足够长的标题' }))
    expect(settings.scheduledAt).toBe('2099-01-01T00:00:00.000Z')
    expect(notify).toHaveBeenCalledWith('发布成功', 'success')
  })

  it('没有 onPublish 时直接返回 false，不提示', async () => {
    const notify = vi.fn()
    const ok = await submitPublish({
      document: { ...ready, title: '' },
      settings: createSettings(),
      adapters: {},
      notify,
      messages,
    })
    expect(ok).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })
})
