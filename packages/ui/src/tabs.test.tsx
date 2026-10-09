import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs, type TabItem } from './tabs'
import { renderWithTheme } from './test-utils'

const items: TabItem[] = [
  { key: 'original', label: '原创' },
  { key: 'reprint', label: '转载' },
  { key: 'vip', label: 'VIP', disabled: true },
  { key: 'translated', label: '翻译' },
]

function Controlled({ onChange }: { onChange?: (key: string) => void }) {
  const [active, setActive] = useState('original')
  return (
    <Tabs
      items={items}
      activeKey={active}
      onChange={(key) => {
        setActive(key)
        onChange?.(key)
      }}
    />
  )
}

describe('Tabs', () => {
  it('标记选中项', () => {
    renderWithTheme(<Tabs items={items} activeKey="reprint" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '转载' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '原创' })).toHaveAttribute('aria-selected', 'false')
  })

  it('点击触发 onChange', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Tabs items={items} activeKey="original" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '翻译' }))
    expect(onChange).toHaveBeenCalledWith('translated')
  })

  it('方向键跳过禁用项并循环', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Controlled onChange={onChange} />)
    screen.getByRole('tab', { name: '原创' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('reprint')
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('translated')
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('original')
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('translated')
    expect(screen.getByRole('tab', { name: '翻译' })).toHaveFocus()
  })
})
