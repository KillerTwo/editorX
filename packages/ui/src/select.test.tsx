import { screen, waitFor, within } from '@testing-library/react'
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

  it('describedBy / invalid 透传到触发器', () => {
    const { rerender } = renderWithTheme(
      <StrictMode>
        <p id="hint">请选择创作声明</p>
        <Select label="创作声明" value={undefined} options={options} onChange={() => {}} describedBy="hint" invalid />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '创作声明' })
    expect(trigger).toHaveAccessibleDescription('请选择创作声明')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    rerender(
      <StrictMode>
        <p id="hint">请选择创作声明</p>
        <Select label="创作声明" value={undefined} options={options} onChange={() => {}} />
      </StrictMode>,
    )
    expect(trigger).not.toHaveAttribute('aria-describedby')
    expect(trigger).not.toHaveAttribute('aria-invalid')
  })

  it('仅传 labelledBy 时列表也以其为无障碍名称', async () => {
    renderWithTheme(
      <StrictMode>
        <span id="decl-label">创作声明</span>
        <Select labelledBy="decl-label" value={undefined} options={options} onChange={() => {}} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    expect(await screen.findByRole('listbox', { name: '创作声明' })).toHaveAttribute('aria-labelledby', 'decl-label')
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

describe('Select 外观选项', () => {
  const plain = { label: '声明', value: undefined, options, onChange: () => {} }

  it('popperArrow + offset：列表带气泡箭头与 data-placement，选项仍是 listbox 的后代', async () => {
    renderWithTheme(
      <StrictMode>
        <Select {...plain} popperArrow offset={12} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '声明' }))
    const list = await screen.findByRole('listbox', { name: '声明' })
    expect(list).toHaveClass('ex-popover', 'ex-select__list', 'has-arrow')
    expect(list).toHaveAttribute('data-placement', 'bottom-start')
    expect(list.querySelector(':scope > .ex-select__caret')).not.toBeNull()
    expect(list.querySelector(':scope > ul.ex-select__options')).toHaveAttribute('role', 'presentation')
    expect(within(list).getAllByRole('option')).toHaveLength(4)
  })

  it('默认无气泡箭头；箭头是 10×6 自绘 chevron', async () => {
    const { container } = renderWithTheme(
      <StrictMode>
        <Select {...plain} />
      </StrictMode>,
    )
    const arrow = container.querySelector('svg.ex-select__arrow')!
    expect(arrow).toHaveAttribute('width', '10')
    expect(arrow).toHaveAttribute('height', '6')
    await userEvent.click(screen.getByRole('combobox', { name: '声明' }))
    const list = await screen.findByRole('listbox')
    expect(list).not.toHaveClass('has-arrow')
    expect(list.querySelector('.ex-select__caret')).toBeNull()
  })

  it('prefix 渲染在值之前；showArrow={false} 不渲染箭头', () => {
    const { container } = renderWithTheme(
      <StrictMode>
        <Select {...plain} prefix={<i data-testid="prefix" />} showArrow={false} />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '声明' })
    expect(trigger.firstElementChild).toHaveClass('ex-select__prefix')
    expect(trigger.firstElementChild).toContainElement(screen.getByTestId('prefix'))
    expect(container.querySelector('.ex-select__arrow')).toBeNull()
  })

  it('键盘导航在新结构下仍可用', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Select {...plain} onChange={onChange} popperArrow />
      </StrictMode>,
    )
    screen.getByRole('combobox', { name: '声明' }).focus()
    await userEvent.keyboard('{Enter}')
    await screen.findByRole('listbox')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
