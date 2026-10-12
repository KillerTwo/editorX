import type { Resource } from '@editorx/toolbar'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnResourceExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

const good: Resource = { id: 'r1', title: '手册', url: 'https://cdn.example/a', description: '说明' }
const bad: Resource = { id: 'r2', title: '坏链', url: 'javascript:alert(1)' }

describe('csdn:resource', () => {
  it('搜索失败不插入；javascript 结果点了也不插入', async () => {
    const user = userEvent.setup()
    const searchResources = vi.fn(async () => Promise.reject(new Error('超时')))
    const ctx = extensionCtx({ adapters: { searchResources } })
    const first = renderExtension([csdnResourceExtension], ctx, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const dialog = await screen.findByRole('dialog', { name: '资源绑定' })
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '手册')
    await user.click(within(dialog).getByRole('button', { name: '搜索' }))
    expect(searchResources).toHaveBeenCalledWith('手册')
    expect(ctx.notify).toHaveBeenCalledWith('搜索资源失败：超时', 'error')
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    first.unmount()

    const listed = extensionCtx({
      adapters: { searchResources: vi.fn(async () => [bad, good]) },
    })
    renderExtension([csdnResourceExtension], listed, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const next = await screen.findByRole('dialog', { name: '资源绑定' })
    await user.type(within(next).getByRole('textbox', { name: '搜索资源' }), '手册')
    await user.click(within(next).getByRole('button', { name: '搜索' }))
    await user.click(await within(next).findByRole('button', { name: '坏链' }))
    expect(listed.insertEmbed).not.toHaveBeenCalled()
    expect(listed.notify).toHaveBeenCalledWith('资源地址需以 http:// 或 https:// 开头', 'error')
    expect(screen.getByRole('dialog', { name: '资源绑定' })).toBeInTheDocument()
  })

  it('选中 http 资源后插入并关闭', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      adapters: { searchResources: vi.fn(async () => [good]) },
    })
    renderExtension([csdnResourceExtension], ctx, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const dialog = await screen.findByRole('dialog', { name: '资源绑定' })
    expect(within(dialog).getByRole('button', { name: '搜索' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '  ')
    expect(within(dialog).getByRole('button', { name: '搜索' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '手册')
    await user.click(within(dialog).getByRole('button', { name: '搜索' }))
    await user.click(await within(dialog).findByRole('button', { name: '手册' }))
    expect(ctx.insertEmbed).toHaveBeenCalledWith('resource', good)
    expect(screen.queryByRole('dialog', { name: '资源绑定' })).toBeNull()
    const html = csdnResourceExtension.embeds?.[0]?.renderHtml(good)
    expect(html).toContain('href="https://cdn.example/a"')
    expect(html).toContain('手册')
    expect(csdnResourceExtension.embeds?.[0]?.renderHtml(bad)).not.toContain('javascript:')
  })

  it('没有结果时提示，没有 searchResources 时隐藏', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({ adapters: { searchResources: async () => [] } })
    const view = renderExtension([csdnResourceExtension], ctx, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const dialog = await screen.findByRole('dialog', { name: '资源绑定' })
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '无')
    await user.click(within(dialog).getByRole('button', { name: '搜索' }))
    expect(await within(dialog).findByText('没有匹配的资源')).toBeInTheDocument()
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    view.unmount()
    renderExtension([csdnResourceExtension], extensionCtx(), [['csdn:resource']])
    expect(screen.queryByRole('button', { name: '资源绑定' })).toBeNull()
  })
})
