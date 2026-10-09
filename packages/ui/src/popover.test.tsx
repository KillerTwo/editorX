import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Popover } from './popover'
import { renderWithTheme } from './test-utils'

describe('Popover', () => {
  it('点击触发器打开，内容渲染在 .ex-portal 内', async () => {
    renderWithTheme(
      <Popover content={() => <p>表格选择器</p>}>
        <button>表格</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('表格选择器')
    expect(dialog.closest('.ex-portal')).not.toBeNull()
  })

  it('content 收到的 close 可关闭浮层', async () => {
    renderWithTheme(
      <Popover content={(close) => <button onClick={close}>完成</button>}>
        <button>打开</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await userEvent.click(await screen.findByRole('button', { name: '完成' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('按 Escape 关闭', async () => {
    renderWithTheme(
      <Popover content={() => <p>内容</p>}>
        <button>打开</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('受控模式：由 open 决定显示，交互触发 onOpenChange', async () => {
    const onOpenChange = vi.fn()
    renderWithTheme(
      <Popover open={false} onOpenChange={onOpenChange} content={() => <p>内容</p>}>
        <button>打开</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything(), expect.anything())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
