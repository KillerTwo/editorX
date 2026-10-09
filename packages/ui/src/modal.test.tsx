import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

describe('Modal', () => {
  it('open=false 时不渲染', () => {
    renderWithTheme(<Modal open={false} onClose={() => {}} title="插入投票">内容</Modal>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('以标题作为可访问名称，渲染 body 与 footer', () => {
    renderWithTheme(
      <Modal open onClose={() => {}} title="插入投票" footer={<button>确定</button>}>
        投票内容
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: '插入投票' })
    expect(dialog).toHaveTextContent('投票内容')
    expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument()
    expect(dialog.closest('.ex-portal')).not.toBeNull()
  })

  it('点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题">内容</Modal>)
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('按 Escape 触发 onClose', async () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题">内容</Modal>)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩触发 onClose', () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题">内容</Modal>)
    fireEvent.mouseDown(document.querySelector('.ex-modal-mask') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnMaskClick=false 时点击遮罩不关闭', () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题" closeOnMaskClick={false}>内容</Modal>)
    fireEvent.mouseDown(document.querySelector('.ex-modal-mask') as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
  })
})
