import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown } from './dropdown'
import { Modal } from './modal'
import { Popover } from './popover'
import { renderWithTheme } from './test-utils'
import { Tooltip } from './tooltip'

const items = [
  { key: 'h1', label: '一级标题' },
  { key: 'h2', label: '二级标题' },
  { key: 'h7', label: '不可用', disabled: true },
]

describe('Dropdown', () => {
  it('点击触发器展开菜单项', async () => {
    renderWithTheme(
      <Dropdown items={items} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(await screen.findAllByRole('menuitem')).toHaveLength(3)
  })

  it('选择后回调 key 并关闭', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Dropdown items={items} onSelect={onSelect}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '二级标题' }))
    expect(onSelect).toHaveBeenCalledWith('h2')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('触发器外包 Tooltip 时仍可展开选择，且悬停显示提示', async () => {
    const onSelect = vi.fn()
    const onTriggerClick = vi.fn()
    renderWithTheme(
      <Dropdown items={items} onSelect={onSelect}>
        <Tooltip content="标题提示" delay={0}>
          <button onClick={onTriggerClick}>标题</button>
        </Tooltip>
      </Dropdown>,
    )
    const trigger = screen.getByRole('button', { name: '标题' })
    await userEvent.hover(trigger)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('标题提示')
    await userEvent.click(trigger)
    expect(onTriggerClick).toHaveBeenCalledTimes(1)
    await userEvent.click(await screen.findByRole('menuitem', { name: '二级标题' }))
    expect(onSelect).toHaveBeenCalledWith('h2')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('禁用项不可选择', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Dropdown items={items} onSelect={onSelect}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    const disabled = await screen.findByRole('menuitem', { name: '不可用' })
    expect(disabled).toBeDisabled()
    await userEvent.click(disabled)
    expect(onSelect).not.toHaveBeenCalled()
  })

  const navItems = [
    { key: 'a', label: '甲', extra: 'Ctrl+A' },
    { key: 'sep', label: '', separator: true },
    { key: 'b', label: '乙' },
    { key: 'c', label: '丙', disabled: true },
  ]

  it('菜单有无障碍名称，分隔线渲染为 separator，extra 显示在项内', async () => {
    renderWithTheme(
      <Dropdown label="标题菜单" items={navItems} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    const menu = await screen.findByRole('menu', { name: '标题菜单' })
    expect(menu).toHaveClass('ex-popover', 'ex-dropdown')
    expect(menu.closest('.ex-portal')).not.toBeNull()
    expect(screen.getByRole('separator')).toHaveClass('ex-dropdown__sep')
    expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveTextContent('Ctrl+A')
  })

  it('ArrowDown 打开并聚焦首项，方向键循环且跳过分隔线与禁用项，Enter 选择', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Dropdown label="标题菜单" items={navItems} onSelect={onSelect}>
        <button>标题</button>
      </Dropdown>,
    )
    screen.getByRole('button', { name: '标题' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: '乙' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: '乙' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Modal 内的 Dropdown：点菜单项不关 Modal；Esc 先关菜单，再关 Modal', async () => {
    const onClose = vi.fn()
    const onSelect = vi.fn()
    renderWithTheme(
      <Modal open onClose={onClose} title="设置">
        <Dropdown items={navItems} onSelect={onSelect}>
          <button>标题</button>
        </Dropdown>
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '乙' }))
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc 关闭后焦点回到触发器', async () => {
    renderWithTheme(
      <Dropdown items={navItems} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    const trigger = screen.getByRole('button', { name: '标题' })
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('Enter 选择后焦点回到触发器', async () => {
    renderWithTheme(
      <Dropdown items={navItems} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    const trigger = screen.getByRole('button', { name: '标题' })
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('Home/End 跳到首个/末个可用项', async () => {
    const items = [
      { key: 'x', label: '首项禁用', disabled: true },
      { key: 'a', label: '甲' },
      { key: 'b', label: '乙' },
      { key: 'c', label: '丙' },
      { key: 'y', label: '末项禁用', disabled: true },
    ]
    renderWithTheme(
      <Dropdown items={items} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    screen.getByRole('button', { name: '标题' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '甲' })).toHaveFocus())
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: '丙' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: '甲' })).toHaveFocus()
  })

  it('Popover 内的 Dropdown：点菜单项不关 Popover；Esc 先关菜单，再关 Popover', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Popover
        content={() => (
          <Dropdown items={navItems} onSelect={onSelect}>
            <button>标题</button>
          </Dropdown>
        )}
      >
        <button>设置</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '设置' }))
    await userEvent.click(await screen.findByRole('button', { name: '标题' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '乙' }))
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: '标题' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: '标题' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: '标题' })).toBeNull()
  })

  it('Modal 内用键盘打开 Dropdown 后，焦点在菜单项上按 Esc 只关菜单', async () => {
    const onClose = vi.fn()
    renderWithTheme(
      <Modal open onClose={onClose} title="设置">
        <Dropdown items={navItems} onSelect={() => {}}>
          <button>标题</button>
        </Dropdown>
      </Modal>,
    )
    screen.getByRole('button', { name: '标题' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
