import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderEditor } from './test-utils'

const spies = vi.hoisted(() => ({ syncFrom: [] as string[], paused: [] as boolean[] }))
vi.mock('@editorx/markdown-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@editorx/markdown-core')>()
  return {
    ...actual,
    createScrollSync: (...args: Parameters<typeof actual.createScrollSync>) => {
      const sync = actual.createScrollSync(...args)
      return {
        ...sync,
        syncFrom: (side: 'editor' | 'preview') => {
          spies.syncFrom.push(side)
          sync.syncFrom(side)
        },
        setPaused: (paused: boolean) => {
          spies.paused.push(paused)
          sync.setPaused(paused)
        },
      }
    },
  }
})

beforeEach(() => {
  spies.syncFrom.length = 0
  spies.paused.length = 0
})

describe('比对模式同步按钮（G24）', () => {
  it('只在比对模式渲染；同步滚动默认开启', async () => {
    renderEditor({ defaultViewMode: 'edit' })
    expect(screen.queryByRole('button', { name: '同步滚动' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '定位到编辑位置' })).toBeInTheDocument()
    expect(spies.paused).toEqual([])
  })

  it('DOM：.ex-mde-body 内，定位在上、同步滚动在下', () => {
    renderEditor({ defaultViewMode: 'split' })
    const buttons = document.querySelectorAll('.ex-mde-body > .ex-mde-sync > button')
    expect([...buttons].map((b) => b.className)).toEqual(['ex-mde-sync__locate', 'ex-mde-sync__scroll'])
    expect(buttons[0]).toHaveAttribute('title', '定位到编辑位置')
    expect(buttons[1]).toHaveAttribute('title', '同步滚动')
  })

  it('定位：以编辑区为基准立即对齐', async () => {
    renderEditor({ defaultViewMode: 'split' })
    await userEvent.click(screen.getByRole('button', { name: '定位到编辑位置' }))
    expect(spies.syncFrom).toEqual(['editor'])
  })

  it('同步关闭时定位仍生效，且不恢复同步', async () => {
    renderEditor({ defaultViewMode: 'split' })
    await userEvent.click(screen.getByRole('button', { name: '同步滚动' }))
    await userEvent.click(screen.getByRole('button', { name: '定位到编辑位置' }))
    expect(spies.syncFrom).toEqual(['editor'])
    expect(spies.paused).toEqual([true])
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('关闭同步后切换视图再回到比对仍保持关闭；再次点击恢复', async () => {
    renderEditor({ defaultViewMode: 'split' })
    await userEvent.click(screen.getByRole('button', { name: '同步滚动' }))
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'false')
    expect(spies.paused.at(-1)).toBe(true)
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    spies.paused.length = 0
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'false')
    expect(spies.paused).toContain(true)
    await userEvent.click(screen.getByRole('button', { name: '同步滚动' }))
    expect(spies.paused.at(-1)).toBe(false)
  })
})
