import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MODAL_LAYER_CLASS } from './layer'
import { Modal } from './modal'
import { Select, type SelectOption } from './select'
import { renderWithTheme } from './test-utils'

const options: SelectOption[] = [
  { value: 'none', label: '无声明' },
  { value: 'ai', label: 'AI 辅助' },
  { value: 'off', label: '已下线', disabled: true },
  { value: 'net', label: '网络整合' },
]

function Controlled({ onChange, initial }: { onChange?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial)
  return (
    <Select
      label="创作声明"
      value={value}
      options={options}
      placeholder="请选择"
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
    />
  )
}

describe('Select', () => {
  it('无值显示占位；点击打开 listbox，点选项回调并关闭', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Controlled onChange={onChange} />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '创作声明' })
    expect(trigger).toHaveClass('ex-select', 'is-placeholder')
    expect(trigger).toHaveTextContent('请选择')
    await userEvent.click(trigger)
    const list = await screen.findByRole('listbox')
    expect(list).toHaveClass('ex-popover', 'ex-select__list')
    expect(list.closest('.ex-portal')).not.toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('option', { name: 'AI 辅助' }))
    expect(onChange).toHaveBeenCalledWith('ai')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveTextContent('AI 辅助')
    expect(trigger).not.toHaveClass('is-placeholder')
  })

  it('已选项 aria-selected，禁用项不可点', async () => {
    renderWithTheme(
      <StrictMode>
        <Controlled initial="net" />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    expect(await screen.findByRole('option', { name: '网络整合' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '无声明' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('option', { name: '已下线' })).toBeDisabled()
  })

  it('键盘：ArrowDown 打开并聚焦首项，跳过禁用项，Enter 选择', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Controlled onChange={onChange} />
      </StrictMode>,
    )
    screen.getByRole('combobox', { name: '创作声明' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('option', { name: '无声明' })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'AI 辅助' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: '网络整合' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('net')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('disabled 时不可打开', async () => {
    renderWithTheme(
      <StrictMode>
        <Select label="活动" value={undefined} options={options} onChange={() => {}} disabled />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '活动' })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('Modal 内：Esc 先关列表，再关 Modal', async () => {
    const onClose = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Modal open onClose={onClose} title="发布文章">
          <Controlled />
        </Modal>
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('列表只在 Modal 内带 is-in-modal 层级类', async () => {
    renderWithTheme(
      <StrictMode>
        <Controlled />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    const outside = await screen.findByRole('listbox')
    expect(outside).toHaveClass('ex-popover')
    expect(outside).not.toHaveClass(MODAL_LAYER_CLASS)
  })

  it('Modal 内打开的列表带 is-in-modal 层级类', async () => {
    renderWithTheme(
      <StrictMode>
        <Modal open onClose={() => {}} title="发布文章">
          <Controlled />
        </Modal>
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    expect(await screen.findByRole('listbox')).toHaveClass('ex-popover', 'ex-select__list', MODAL_LAYER_CLASS)
  })
})
