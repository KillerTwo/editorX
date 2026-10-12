import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnInscodeExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

async function fill(user: ReturnType<typeof userEvent.setup>, code = 'console.log(1)') {
  await user.click(screen.getByRole('button', { name: 'InsCode' }))
  const dialog = await screen.findByRole('dialog', { name: 'InsCode' })
  await user.clear(within(dialog).getByRole('textbox', { name: '语言' }))
  await user.type(within(dialog).getByRole('textbox', { name: '语言' }), 'javascript')
  await user.type(within(dialog).getByRole('textbox', { name: '代码' }), code)
  return dialog
}

describe('csdn:inscode', () => {
  it('空白代码不能提交；运行失败不插入', async () => {
    const user = userEvent.setup()
    const runCode = vi.fn(async () => Promise.reject(new Error('编译失败')))
    const ctx = extensionCtx({ adapters: { runCode } })
    renderExtension([csdnInscodeExtension], ctx, [['csdn:inscode']])
    await user.click(screen.getByRole('button', { name: 'InsCode' }))
    const dialog = await screen.findByRole('dialog', { name: 'InsCode' })
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '代码' }), '   ')
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    await user.clear(within(dialog).getByRole('textbox', { name: '语言' }))
    await user.type(within(dialog).getByRole('textbox', { name: '语言' }), 'javascript')
    await user.clear(within(dialog).getByRole('textbox', { name: '代码' }))
    await user.type(within(dialog).getByRole('textbox', { name: '代码' }), 'console.log(1)')
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(runCode).toHaveBeenCalledWith('javascript', 'console.log(1)')
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('运行代码失败：编译失败', 'error')
    expect(screen.getByRole('dialog', { name: 'InsCode' })).toBeInTheDocument()
  })

  it('javascript 结果不插入；http 结果插入 inscode 嵌入', async () => {
    const user = userEvent.setup()
    const bad = extensionCtx({
      adapters: { runCode: vi.fn(async () => ({ url: 'javascript:alert(1)' })) },
    })
    const badView = renderExtension([csdnInscodeExtension], bad, [['csdn:inscode']])
    const badDialog = await fill(user)
    await user.click(within(badDialog).getByRole('button', { name: '确定' }))
    expect(bad.insertEmbed).not.toHaveBeenCalled()
    expect(bad.notify).toHaveBeenCalledWith('运行结果地址需以 http:// 或 https:// 开头', 'error')
    badView.unmount()

    const ok = extensionCtx({
      adapters: { runCode: vi.fn(async () => ({ url: 'https://inscode.example/run' })) },
    })
    renderExtension([csdnInscodeExtension], ok, [['csdn:inscode']])
    const dialog = await fill(user)
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(ok.insertEmbed).toHaveBeenCalledWith('inscode', { url: 'https://inscode.example/run', lang: 'javascript' })
    expect(screen.queryByRole('dialog', { name: 'InsCode' })).toBeNull()
    const html = csdnInscodeExtension.embeds?.[0]?.renderHtml({ url: 'https://inscode.example/run', lang: 'javascript' })
    expect(html).toContain('href="https://inscode.example/run"')
    expect(csdnInscodeExtension.embeds?.[0]?.renderHtml({ url: 'javascript:alert(1)', lang: 'javascript' })).not.toContain(
      'javascript:',
    )
  })

  it('进行中按 Escape 关闭后不插入', async () => {
    const user = userEvent.setup()
    let resolveRun: (value: { url: string }) => void = () => {}
    const runCode = vi.fn(
      () =>
        new Promise<{ url: string }>((resolve) => {
          resolveRun = resolve
        }),
    )
    const ctx = extensionCtx({ adapters: { runCode } })
    renderExtension([csdnInscodeExtension], ctx, [['csdn:inscode']])
    const dialog = await fill(user)
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    const started = runCode.mock.results[0]?.value as Promise<unknown>
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'InsCode' })).toBeNull()
    resolveRun({ url: 'https://inscode.example/run' })
    await started
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
  })

  it('没有 runCode 时隐藏', () => {
    renderExtension([csdnInscodeExtension], extensionCtx(), [['csdn:inscode']])
    expect(screen.queryByRole('button', { name: 'InsCode' })).toBeNull()
  })
})
