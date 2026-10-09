import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown } from './dropdown'
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
})
