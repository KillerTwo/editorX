import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { InlineLayer } from './inline-layer'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

function Harness({ onModalClose }: { onModalClose(): void }) {
  const [open, setOpen] = useState(true)
  return (
    <Modal open onClose={onModalClose} title="外层">
      <button type="button">外部</button>
      {open && (
        <InlineLayer role="dialog" aria-label="内层" className="probe" onDismiss={() => setOpen(false)}>
          <input aria-label="输入" />
        </InlineLayer>
      )}
    </Modal>
  )
}

describe('InlineLayer', () => {
  it('Modal 内：正常流渲染；点击外部不关闭；Esc 只关内层，内层关闭后 Esc 才关 Modal', async () => {
    const onModalClose = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness onModalClose={onModalClose} />
      </StrictMode>,
    )
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
