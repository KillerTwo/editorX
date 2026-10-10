import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { InlineLayer } from './inline-layer'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

function Harness({ onModalClose, onDismiss, nested = false }: { onModalClose(): void; onDismiss?(): void; nested?: boolean }) {
  const [open, setOpen] = useState(true)
  const [nestedOpen, setNestedOpen] = useState(false)
  return (
    <Modal open onClose={onModalClose} title="外层">
      <button type="button">外部</button>
      {nested && (
        <button type="button" onClick={() => setNestedOpen(true)}>
          打开嵌套
        </button>
      )}
      <textarea aria-label="摘要" />
      {open && (
        <InlineLayer
          role="dialog"
          aria-label="内层"
          className="probe"
          onDismiss={() => {
            onDismiss?.()
            setOpen(false)
          }}
        >
          <input aria-label="输入" />
        </InlineLayer>
      )}
      <Modal open={nestedOpen} onClose={() => setNestedOpen(false)} title="嵌套弹窗">
        <button type="button">嵌套按钮</button>
      </Modal>
    </Modal>
  )
}

/** Modal 的初始聚焦在下一帧执行；先等它落定，避免之后抢走测试里设置的焦点 */
async function renderHarness(props: Parameters<typeof Harness>[0]) {
  renderWithTheme(
    <StrictMode>
      <Harness {...props} />
    </StrictMode>,
  )
  const modal = screen.getByRole('dialog', { name: '外层' })
  await waitFor(() => expect(modal).toContainElement(document.activeElement as HTMLElement | null))
}

describe('InlineLayer', () => {
  it('Modal 内：正常流渲染；点击外部不关闭；Esc 只关内层，内层关闭后 Esc 才关 Modal', async () => {
    const onModalClose = vi.fn()
    await renderHarness({ onModalClose })
    const layer = screen.getByRole('dialog', { name: '内层' })
    expect(layer).toHaveClass('probe')
    expect(layer.closest('.ex-modal')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '外部' }))
    expect(screen.getByRole('dialog', { name: '内层' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('textbox', { name: '输入' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '内层' })).toBeNull()
    expect(onModalClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onModalClose).toHaveBeenCalledTimes(1)
  })

  it('焦点在外层 Modal 的其他控件上：Esc 只关内层，第二次 Esc 关 Modal', async () => {
    const onModalClose = vi.fn()
    const onDismiss = vi.fn()
    await renderHarness({ onModalClose, onDismiss })
    await userEvent.click(screen.getByRole('textbox', { name: '摘要' }))
    expect(screen.getByRole('textbox', { name: '摘要' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '内层' })).toBeNull()
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onModalClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onModalClose).toHaveBeenCalledTimes(1)
  })

  it('焦点在 body 上：Esc 只关内层', async () => {
    const onModalClose = vi.fn()
    const onDismiss = vi.fn()
    await renderHarness({ onModalClose, onDismiss })
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    expect(document.body).toHaveFocus()
    // 浏览器在同一事件的两个 document 监听之间会刷新 React，内层先关后外层 Modal 的监听看不到子节点而一并关闭；
    // jsdom 不在监听之间跑微任务，复现不了，因此断言 Esc 不再传到 document 上的其他监听
    const reachedDocument = vi.fn()
    document.addEventListener('keydown', reachedDocument)
    try {
      await userEvent.keyboard('{Escape}')
    } finally {
      document.removeEventListener('keydown', reachedDocument)
    }
    expect(reachedDocument).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '内层' })).toBeNull()
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onModalClose).not.toHaveBeenCalled()
  })

  it('内层之上再开子 Modal：Esc 只关子 Modal，内层与外层保留', async () => {
    const onModalClose = vi.fn()
    const onDismiss = vi.fn()
    await renderHarness({ onModalClose, onDismiss, nested: true })
    await userEvent.click(screen.getByRole('button', { name: '打开嵌套' }))
    await userEvent.click(await screen.findByRole('button', { name: '嵌套按钮' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '嵌套弹窗' })).toBeNull()
    expect(screen.getByRole('dialog', { name: '内层' })).toBeInTheDocument()
    expect(onDismiss).not.toHaveBeenCalled()
    expect(onModalClose).not.toHaveBeenCalled()
  })

  it('另一棵浮层树中的 Modal 持有焦点时：Esc 只关该 Modal', async () => {
    const onDismiss = vi.fn()
    const onClose = vi.fn()
    renderWithTheme(
      <StrictMode>
        <InlineLayer aria-label="内层" onDismiss={onDismiss}>
          内容
        </InlineLayer>
        <Modal open onClose={onClose} title="定时发布">
          <button type="button">确定</button>
        </Modal>
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('没有外层浮层时：层外输入框自己的 Esc 处理先收到按键，层随后关闭', async () => {
    const onDismiss = vi.fn()
    const onKey = vi.fn()
    renderWithTheme(
      <StrictMode>
        <input
          aria-label="外部输入"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onKey()
          }}
        />
        <InlineLayer aria-label="内层" onDismiss={onDismiss}>
          内容
        </InlineLayer>
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('textbox', { name: '外部输入' }))
    await userEvent.keyboard('{Escape}')
    expect(onKey).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('没有外层浮层时自建浮层树；StrictMode 下 Esc 只调用一次 onDismiss', async () => {
    const onDismiss = vi.fn()
    renderWithTheme(
      <StrictMode>
        <InlineLayer aria-label="内层" onDismiss={onDismiss}>
          内容
        </InlineLayer>
      </StrictMode>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
