import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './tooltip'
import { renderWithTheme } from './test-utils'

describe('Tooltip', () => {
  it('悬停显示提示，移出后隐藏', async () => {
    renderWithTheme(
      <Tooltip content="加粗 Ctrl+B" delay={0}>
        <button>B</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.hover(screen.getByRole('button', { name: 'B' }))
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('加粗 Ctrl+B')
    expect(tip.closest('.ex-portal')).not.toBeNull()
    await userEvent.unhover(screen.getByRole('button', { name: 'B' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('触发器自带 ref 时 ref 指向触发元素且悬停仍显示', async () => {
    const r = createRef<HTMLButtonElement>()
    renderWithTheme(
      <Tooltip content="下划线" delay={0}>
        <button ref={r}>U</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'U' })
    expect(r.current).toBe(trigger)
    await userEvent.hover(trigger)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('下划线')
    expect(trigger).toHaveAttribute('aria-describedby')
  })

  it('键盘聚焦也会显示', async () => {
    renderWithTheme(
      <Tooltip content="斜体" delay={0}>
        <button>I</button>
      </Tooltip>,
    )
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('斜体')
  })
})
