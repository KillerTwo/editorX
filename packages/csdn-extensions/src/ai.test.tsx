import { resolvePanels } from '@geekx/toolbar'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnAiExtension } from './index'
import { extensionCtx, renderStrict } from './test-harness'

describe('csdn:ai', () => {
  it('缺少 aiAssist 时两种编辑器和两种策略都没有面板', () => {
    for (const editorType of ['markdown', 'richtext'] as const) {
      for (const missingAdapter of ['hide', 'disable'] as const) {
        expect(resolvePanels([csdnAiExtension], { editorType, adapters: {}, missingAdapter })).toEqual([])
      }
    }
  })

  it('流在第一段之后抛错时保留已生成，并且不调用 fetch', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    async function* stream() {
      yield '已生成'
      throw new Error('断开')
    }
    const aiAssist = vi.fn(() => stream())
    const ctx = extensionCtx({
      getSelectionText: () => '选中',
      getDocument: () => ({ editorType: 'markdown', title: '题', markdown: '正文', html: '<p>正文</p>' }),
      adapters: { aiAssist },
    })
    const panel = csdnAiExtension.panels?.[0]
    expect(panel?.id).toBe('csdn:ai')
    renderStrict(<>{panel?.render(ctx)}</>)
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }), '你好')
    await user.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByText('已生成')).toBeInTheDocument()
    expect(ctx.notify).toHaveBeenCalledWith('生成中断：断开', 'error')
    expect(screen.getByText('已生成')).toBeInTheDocument()
    expect(aiAssist).toHaveBeenCalledWith('你好', {
      selection: '选中',
      document: { editorType: 'markdown', title: '题', markdown: '正文', html: '<p>正文</p>' },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('按顺序拼接多段，空白提示不能发送', async () => {
    const user = userEvent.setup()
    async function* stream() {
      yield '甲'
      yield '乙'
    }
    const ctx = extensionCtx({ adapters: { aiAssist: vi.fn(() => stream()) } })
    const panel = csdnAiExtension.panels?.[0]
    renderStrict(<>{panel?.render(ctx)}</>)
    await user.type(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }), '   ')
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
    await user.clear(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }))
    await user.type(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }), '写一段')
    await user.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByText('甲乙')).toBeInTheDocument()
    expect(ctx.notify).not.toHaveBeenCalled()
  })
})
