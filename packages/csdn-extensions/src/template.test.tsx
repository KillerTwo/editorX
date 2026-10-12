import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnExtensions, csdnTemplateExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

describe('csdn:template', () => {
  it('富文本遇到只有 markdown 的模板时不写入', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      editorType: 'richtext',
      adapters: {
        getTemplates: vi.fn(async () => [{ id: 'weekly', name: '周报', markdown: '# 周报' }]),
      },
    })
    renderExtension([csdnTemplateExtension], ctx, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    const dialog = await screen.findByRole('dialog', { name: '模版' })
    await user.click(await within(dialog).findByRole('button', { name: '替换全文 周报' }))
    expect(ctx.replaceDocument).not.toHaveBeenCalled()
    expect(ctx.insert).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('这个模板没有 HTML，不能写入富文本', 'error')
    expect(screen.getByRole('dialog', { name: '模版' })).toBeInTheDocument()
  })

  it('Markdown 用 html 模板替换全文，也可以只插入', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      adapters: {
        getTemplates: async () => [{ id: 'card', name: '卡片', html: '<p>Hi</p>' }],
      },
    })
    renderExtension([csdnTemplateExtension], ctx, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    const dialog = await screen.findByRole('dialog', { name: '模版' })
    await user.click(await within(dialog).findByRole('button', { name: '替换全文 卡片' }))
    expect(ctx.replaceDocument).toHaveBeenCalledWith({ html: '<p>Hi</p>' })
    await user.click(screen.getByRole('button', { name: '模版' }))
    const again = await screen.findByRole('dialog', { name: '模版' })
    await user.click(await within(again).findByRole('button', { name: '插入 卡片' }))
    expect(ctx.insert).toHaveBeenCalledWith({ html: '<p>Hi</p>' })
  })

  it('没有 getTemplates 时隐藏；disable 时禁用且不调用', async () => {
    const user = userEvent.setup()
    const hidden = extensionCtx()
    const { unmount } = renderExtension([csdnTemplateExtension], hidden, [['csdn:template']])
    expect(screen.queryByRole('button', { name: '模版' })).toBeNull()
    unmount()
    const disabled = extensionCtx()
    renderExtension([csdnTemplateExtension], disabled, [['csdn:template']], 'disable')
    expect(screen.getByRole('button', { name: '模版' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '模版' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('加载失败只提示，空列表不提供写入按钮', async () => {
    const user = userEvent.setup()
    const failing = extensionCtx({
      adapters: { getTemplates: vi.fn(async () => Promise.reject(new Error('超时'))) },
    })
    const { unmount } = renderExtension([csdnTemplateExtension], failing, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    expect(await screen.findByText('模板加载失败：超时')).toBeInTheDocument()
    expect(failing.notify).toHaveBeenCalledWith('模板加载失败：超时', 'error')
    expect(failing.replaceDocument).not.toHaveBeenCalled()
    unmount()
    const empty = extensionCtx({ adapters: { getTemplates: async () => [] } })
    renderExtension([csdnTemplateExtension], empty, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    expect(await screen.findByText('没有模板')).toBeInTheDocument()
    expect(empty.replaceDocument).not.toHaveBeenCalled()
  })

  it('两个字段都空时不替换', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      adapters: { getTemplates: async () => [{ id: 'blank', name: '空', markdown: '   ' }] },
    })
    renderExtension([csdnTemplateExtension], ctx, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    await user.click(await screen.findByRole('button', { name: '替换全文 空' }))
    expect(ctx.replaceDocument).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('这个模板没有内容', 'error')
  })

  it('列表里已经有模板扩展', () => {
    expect(csdnExtensions.map((ext) => ext.name)).toContain('csdn:template')
    expect(csdnTemplateExtension.requires).toEqual(['getTemplates'])
    expect(csdnTemplateExtension.editors).toBeUndefined()
  })
})
