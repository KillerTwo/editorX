import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnVoteExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

describe('csdn:vote', () => {
  it('不足两个有效选项时不调用 createVote', async () => {
    const user = userEvent.setup()
    const createVote = vi.fn(async () => ({ id: 'v1' }))
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '午饭')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '   ')
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    expect(createVote).not.toHaveBeenCalled()
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
  })

  it('createVote 失败时不插入，对话框留着', async () => {
    const user = userEvent.setup()
    const createVote = vi.fn(async () => Promise.reject(new Error('满了')))
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '午饭')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '饭')
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(createVote).toHaveBeenCalledWith({ title: '午饭', options: ['面', '饭'], multiple: false })
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('创建投票失败：满了', 'error')
    expect(screen.getByRole('dialog', { name: '投票' })).toBeInTheDocument()
  })

  it('成功后插入 vote 嵌入，卡片转义标题', async () => {
    const user = userEvent.setup()
    const createVote = vi.fn(async () => ({ id: 'v1' }))
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '<b>')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '饭')
    await user.click(within(dialog).getByRole('checkbox', { name: '多选' }))
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(ctx.insertEmbed).toHaveBeenCalledWith('vote', {
      id: 'v1',
      title: '<b>',
      options: ['面', '饭'],
      multiple: true,
    })
    const html = csdnVoteExtension.embeds?.[0]?.renderHtml({
      id: 'v1',
      title: '<b>',
      options: ['a&b', 'c'],
      multiple: false,
    })
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('a&amp;b')
    expect(html).not.toContain('<b>')
    expect(screen.queryByRole('dialog', { name: '投票' })).toBeNull()
  })

  it('进行中按 Escape 关闭后不插入', async () => {
    const user = userEvent.setup()
    let resolveVote: (value: { id: string }) => void = () => {}
    const createVote = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveVote = resolve
        }),
    )
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '午饭')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '饭')
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    const started = createVote.mock.results[0]?.value as Promise<unknown>
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '投票' })).toBeNull()
    resolveVote({ id: 'v1' })
    await started
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
  })

  it('没有 createVote 时隐藏按钮', () => {
    renderExtension([csdnVoteExtension], extensionCtx(), [['csdn:vote']])
    expect(screen.queryByRole('button', { name: '投票' })).toBeNull()
  })
})
