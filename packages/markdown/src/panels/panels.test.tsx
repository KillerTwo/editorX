import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resolvePanels, type EditorExtension } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { markdownCoreExtensions } from '../core-extensions'
import { renderEditor } from '../test-utils'

const rail = () => screen.getByRole('navigation', { name: '侧边栏' })
const railButtons = () => within(rail()).getAllByRole('button').map((b) => b.textContent)

describe('面板', () => {
  it('内置扩展提供目录（order 20）与语法（order 30）面板', () => {
    const panels = resolvePanels(markdownCoreExtensions, { editorType: 'markdown', adapters: {} })
    expect(panels.map((p) => p.panel.id)).toEqual(['toc', 'syntax'])
  })

  it('侧栏：点击打开/再次点击关闭；收起后展开恢复上一个面板', async () => {
    renderEditor({ defaultValue: '# 一\n\n## 二\n\n### 三' })
    expect(railButtons()).toEqual(['展开', '目录', '语法'])
    await userEvent.click(within(rail()).getByRole('button', { name: '目录' }))
    expect(within(rail()).getByRole('button', { name: '目录' })).toHaveAttribute('aria-pressed', 'true')
    const panel = screen.getByRole('complementary', { name: '目录' })
    await waitFor(() => expect(within(panel).getAllByRole('button').map((b) => b.textContent)).toEqual(['一', '二', '三']))
    expect(
      within(panel)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('data-depth')),
    ).toEqual(['0', '1', '2'])

    await userEvent.click(within(rail()).getByRole('button', { name: '收起' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    await userEvent.click(within(rail()).getByRole('button', { name: '展开' }))
    expect(screen.getByRole('complementary', { name: '目录' })).toBeInTheDocument()
    await userEvent.click(within(rail()).getByRole('button', { name: '目录' }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('目录：显示 @[TOC] 自定义标题；无标题时显示空态（无标题条，「添加」插入目录标记）', async () => {
    const { handle } = renderEditor({ defaultValue: '@[TOC](自定义目录)\n\n# 一', defaultPanel: 'toc' })
    const panel = screen.getByRole('complementary', { name: '目录' })
    await waitFor(() => expect(within(panel).getByText('自定义目录')).toBeInTheDocument())
    act(() => handle().setValue('只有正文'))
    await waitFor(() => expect(within(panel).getByText('暂无目录')).toBeInTheDocument())
    expect(within(panel).queryByRole('heading')).toBeNull()
    expect(panel.querySelector('.ex-mde-toc__empty')).toHaveTextContent('文章内添加@[TOC]自动根据文章标题生成目录')
    await userEvent.click(within(panel).getByRole('button', { name: '添加' }))
    expect(handle().getValue()).toContain('@[TOC]')
  })

  it('目录空态：只读时「添加」禁用', () => {
    renderEditor({ defaultValue: '正文', defaultPanel: 'toc', readOnly: true })
    const panel = screen.getByRole('complementary', { name: '目录' })
    expect(within(panel).getByRole('button', { name: '添加' })).toBeDisabled()
  })

  it('图标栏：第一个按钮为收起/展开开关；激活项 is-active', async () => {
    renderEditor({ defaultValue: '# 一' })
    const toggle = within(rail()).getByRole('button', { name: '展开' })
    expect(toggle).toHaveClass('ex-mde-rail__item', 'ex-mde-rail__toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.querySelector('svg')).not.toHaveClass('lucide')
    await userEvent.click(within(rail()).getByRole('button', { name: '目录' }))
    expect(within(rail()).getByRole('button', { name: '收起' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(rail()).getByRole('button', { name: '目录' })).toHaveClass('is-active')
    expect(within(rail()).getByRole('button', { name: '目录' }).querySelector('svg')).not.toHaveClass('lucide')
    expect(within(rail()).getByRole('button', { name: '目录' })).toHaveAttribute('data-panel', 'toc')
    expect(toggle).not.toHaveAttribute('data-panel')
  })

  it('目录项点击不抛错（跳转逻辑见 scroll-to-heading.test）', async () => {
    renderEditor({ defaultValue: '# 一\n\n## 二', defaultPanel: 'toc', defaultViewMode: 'preview' })
    const panel = screen.getByRole('complementary', { name: '目录' })
    await userEvent.click(await within(panel).findByRole('button', { name: '二' }))
    expect(panel).toBeInTheDocument()
  })

  it('语法面板：defaultPanel 打开；「更多操作 → 语法说明」切换', async () => {
    renderEditor({ defaultPanel: 'syntax' })
    const panel = screen.getByRole('complementary', { name: '语法' })
    expect(within(panel).getByText('@[TOC](目录标题)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '语法说明' }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('showRail=false 隐藏图标栏，面板仍可由工具栏打开', async () => {
    renderEditor({ showRail: false })
    expect(screen.queryByRole('navigation', { name: '侧边栏' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '语法说明' }))
    expect(screen.getByRole('complementary', { name: '语法' })).toBeInTheDocument()
  })

  it('宿主面板按 order 排序；render 抛错被隔离并提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const demo: EditorExtension = {
      name: 'demo:panel',
      panels: [{ id: 'demo', title: '演示', position: 'right', order: 5, render: () => <p>演示内容</p> }],
    }
    const boom: EditorExtension = {
      name: 'demo:boom',
      panels: [
        {
          id: 'boom',
          title: '炸',
          position: 'right',
          order: 50,
          render: () => {
            throw new Error('boom')
          },
        },
      ],
    }
    renderEditor({ extensions: [demo, boom], defaultPanel: 'boom' })
    expect(railButtons()).toEqual(['收起', '演示', '目录', '语法', '炸'])
    expect(await screen.findByRole('alert')).toHaveTextContent('扩展 demo:boom 出错：boom')
    await userEvent.click(within(rail()).getByRole('button', { name: '演示' }))
    expect(screen.getByRole('complementary', { name: '演示' })).toHaveTextContent('演示内容')
  })
})
