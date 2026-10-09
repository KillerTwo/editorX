import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { Dropdown } from './dropdown'
import { MODAL_LAYER_CLASS, useModalLayerClass } from './layer'
import { Modal } from './modal'
import { Popover } from './popover'
import { renderWithTheme } from './test-utils'
import { Tooltip } from './tooltip'

function Probe() {
  return <span data-testid="probe" className={useModalLayerClass()} />
}

function Floating() {
  return (
    <>
      <Popover content={() => <p>弹层内容</p>}>
        <button>弹层</button>
      </Popover>
      <Dropdown items={[{ key: 'a', label: '选项' }]} onSelect={() => {}} label="菜单">
        <button>菜单</button>
      </Dropdown>
      <Tooltip content="提示文字" delay={0}>
        <button>提示</button>
      </Tooltip>
    </>
  )
}

async function openAll() {
  await userEvent.click(screen.getByRole('button', { name: '弹层' }))
  const popover = (await screen.findByText('弹层内容')).closest('.ex-popover')
  await userEvent.click(screen.getByRole('button', { name: '菜单' }))
  const menu = await screen.findByRole('menu', { name: '菜单' })
  await userEvent.hover(screen.getByRole('button', { name: '提示' }))
  const tooltip = await screen.findByRole('tooltip')
  return { popover, menu, tooltip }
}

describe('Modal 浮层层级', () => {
  it('useModalLayerClass 只在 Modal 内返回 is-in-modal', () => {
    expect(MODAL_LAYER_CLASS).toBe('is-in-modal')
    renderWithTheme(
      <StrictMode>
        <Probe />
        <Modal open onClose={() => {}} title="弹窗">
          <Probe />
        </Modal>
      </StrictMode>,
    )
    const [outside, inside] = screen.getAllByTestId('probe')
    expect(outside).not.toHaveClass(MODAL_LAYER_CLASS)
    expect(inside).toHaveClass(MODAL_LAYER_CLASS)
  })

  it('Modal 内打开的 Popover / Dropdown / Tooltip 带 is-in-modal', async () => {
    renderWithTheme(
      <StrictMode>
        <Modal open onClose={() => {}} title="弹窗">
          <Floating />
        </Modal>
      </StrictMode>,
    )
    const { popover, menu, tooltip } = await openAll()
    expect(popover).toHaveClass('ex-popover', MODAL_LAYER_CLASS)
    expect(menu).toHaveClass('ex-popover', MODAL_LAYER_CLASS)
    expect(tooltip).toHaveClass('ex-tooltip', MODAL_LAYER_CLASS)
  })

  it('Modal 外打开的浮层不带 is-in-modal', async () => {
    renderWithTheme(
      <StrictMode>
        <Floating />
      </StrictMode>,
    )
    const { popover, menu, tooltip } = await openAll()
    expect(popover).toHaveClass('ex-popover')
    expect(popover).not.toHaveClass(MODAL_LAYER_CLASS)
    expect(menu).not.toHaveClass(MODAL_LAYER_CLASS)
    expect(tooltip).toHaveClass('ex-tooltip')
    expect(tooltip).not.toHaveClass(MODAL_LAYER_CLASS)
  })
})
