import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@editorx/theme'
import { ToastProvider } from '@editorx/ui'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorExtension, ExtensionContext, ToolbarButton, ToolbarDropdown } from './extension'
import { resolveToolbar } from './layout'
import { zhCN } from './messages'
import { Toolbar } from './toolbar'

function makeCtx(over: Partial<ExtensionContext> = {}): ExtensionContext {
  return {
    editorType: 'markdown',
    insert: vi.fn(),
    insertEmbed: vi.fn(),
    getSelectionText: () => '',
    replaceSelection: vi.fn(),
    replaceDocument: vi.fn(),
    getDocument: () => ({ editorType: 'markdown', title: '', markdown: '', html: '' }),
    commands: { has: () => true, run: vi.fn(() => true), list: () => [] },
    adapters: {},
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    togglePanel: vi.fn(),
    activePanel: null,
    uploadImages: vi.fn(async () => {}),
    focus: vi.fn(),
    notify: vi.fn(),
    theme: 'light',
    locale: zhCN,
    readOnly: false,
    formats: new Set<string>(),
    ...over,
  }
}

const wrap = (ui: ReactNode) =>
  render(
    <ThemeProvider defaultTheme="light" storageKey={false}>
      <ToastProvider>{ui}</ToastProvider>
    </ThemeProvider>,
  )

const md = { editorType: 'markdown' as const, adapters: {} }

function setup(exts: EditorExtension[], layout?: (string | string[])[], ctx = makeCtx(), readOnly = false) {
  const groups = resolveToolbar(exts, layout, md)
  const utils = wrap(<Toolbar groups={groups} ctx={ctx} readOnly={readOnly} />)
  return { ...utils, ctx, groups }
}

/** 模拟布局：每个分组宽 groupWidth，工具栏可用宽度 toolbarWidth */
function mockWidths(groupWidth: number, toolbarWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('ex-toolbar__group') ? groupWidth : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('ex-toolbar') ? toolbarWidth : 0
  })
}

const bold = vi.fn()
const core: EditorExtension = {
  name: 'core',
  toolbar: [
    { type: 'button', id: 'bold', title: (m) => m.toolbar.bold, icon: <b>B</b>, shortcut: 'Mod-B', active: 'bold', run: bold },
    { type: 'button', id: 'italic', title: '斜体', icon: <i>I</i>, run: vi.fn() },
    {
      type: 'dropdown',
      id: 'list',
      title: '列表',
      label: '列表',
      items: [
        { type: 'button', id: 'ol', title: '有序列表', shortcut: 'Mod-Shift-O', run: vi.fn() },
        { type: 'separator' },
        { type: 'button', id: 'ul', title: '无序列表', run: vi.fn() },
      ],
    },
    { type: 'modal', id: 'table', title: '表格', icon: <span>T</span>, render: (_ctx, close) => <button onClick={close}>插入</button> },
  ],
}

describe('Toolbar', () => {
  it('渲染 role=toolbar、分组与分隔线，图标按钮以 title 为名称', () => {
    setup([core], [['bold', 'italic'], ['list', 'table']])
    const toolbar = screen.getByRole('toolbar', { name: '编辑工具栏' })
    const groups = within(toolbar).getAllByRole('group')
    expect(groups).toHaveLength(2)
    expect(toolbar.querySelectorAll('.ex-toolbar__divider')).toHaveLength(1)
    expect(within(groups[0]!).getByRole('button', { name: '加粗' })).toHaveClass('ex-toolbar__item')
    expect(within(groups[1]!).getByRole('button', { name: '列表' })).toHaveClass('has-label')
  })

  it('点击按钮执行 run；悬停显示带快捷键的提示', async () => {
    setup([core])
    await userEvent.hover(screen.getByRole('button', { name: '加粗' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('加粗 (Ctrl+B)')
    await userEvent.click(screen.getByRole('button', { name: '加粗' }))
    expect(bold).toHaveBeenCalledTimes(1)
  })

  it('非法快捷键在提示中显示原文', async () => {
    const ext: EditorExtension = {
      name: 'odd',
      toolbar: [{ type: 'button', id: 'odd', title: '怪键', icon: <span>?</span>, shortcut: 'Hyper-K', run: vi.fn() }],
    }
    setup([ext])
    await userEvent.hover(screen.getByRole('button', { name: '怪键' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('怪键 (Hyper-K)')
  })

  it('active 格式键驱动 aria-pressed 与 is-active', () => {
    setup([core], undefined, makeCtx({ formats: new Set(['bold']) }))
    const button = screen.getByRole('button', { name: '加粗' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('is-active')
    expect(screen.getByRole('button', { name: '斜体' })).not.toHaveAttribute('aria-pressed')
  })

  it('只读时禁用非 allowReadOnly 条目', () => {
    const ext: EditorExtension = {
      name: 'ro',
      toolbar: [{ type: 'button', id: 'export', title: '导出', icon: <span>E</span>, allowReadOnly: true, run: vi.fn() }],
    }
    setup([core, ext], undefined, makeCtx(), true)
    expect(screen.getByRole('button', { name: '加粗' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '导出' })).toBeEnabled()
  })

  it('dropdown 展开菜单，显示快捷键，选择后执行子项', async () => {
    const ol = ((core.toolbar![2] as ToolbarDropdown).items[0] as ToolbarButton).run
    setup([core])
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    const menu = await screen.findByRole('menu', { name: '列表' })
    expect(menu.closest('.ex-portal')).not.toBeNull()
    expect(within(menu).getByRole('menuitem', { name: /有序列表/ })).toHaveTextContent('Ctrl+Shift+O')
    expect(within(menu).getByRole('separator')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: /有序列表/ }))
    expect(ol).toHaveBeenCalledTimes(1)
  })

  it('modal 条目在 .ex-portal 中打开对话框，close 关闭', async () => {
    setup([core])
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    expect(dialog.closest('.ex-portal')).not.toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: '插入' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('popover 条目以 Popover 打开', async () => {
    const ext: EditorExtension = {
      name: 'pop',
      toolbar: [{ type: 'popover', id: 'emoji', title: '表情', icon: <span>E</span>, render: () => <p>表情面板</p> }],
    }
    setup([ext])
    await userEvent.click(screen.getByRole('button', { name: '表情' }))
    const panel = await screen.findByText('表情面板')
    expect(panel.closest('.ex-portal')).not.toBeNull()
  })

  it('run 抛错：notify 错误并继续可用', async () => {
    const ctx = makeCtx()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ext: EditorExtension = {
      name: 'demo',
      toolbar: [{ type: 'button', id: 'boom', title: '爆炸', icon: <span>!</span>, run: () => { throw new Error('boom') } }],
    }
    setup([ext], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '爆炸' }))
    expect(ctx.notify).toHaveBeenCalledWith('扩展 demo 出错：boom', 'error')
    await userEvent.click(screen.getByRole('button', { name: '爆炸' }))
    expect(ctx.notify).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })

  it('菜单子项 run 抛错同样被隔离', async () => {
    const ctx = makeCtx()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ext: EditorExtension = {
      name: 'menu-bad',
      toolbar: [
        {
          type: 'dropdown',
          id: 'm',
          title: '菜单',
          label: '菜单',
          items: [{ type: 'button', id: 'x', title: '坏项', run: () => { throw new Error('menu') } }],
        },
      ],
    }
    setup([ext], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '菜单' }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: '坏项' }))
    expect(ctx.notify).toHaveBeenCalledWith('扩展 menu-bad 出错：menu', 'error')
    expect(screen.getByRole('toolbar')).toBeInTheDocument()
  })

  it('render 抛错由错误边界截获并上报', async () => {
    const ctx = makeCtx()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = () => {
      throw new Error('render failed')
    }
    const ext: EditorExtension = {
      name: 'bad',
      toolbar: [{ type: 'modal', id: 'bad', title: '坏弹窗', icon: <span>X</span>, render: () => <Broken /> }],
    }
    setup([ext], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '坏弹窗' }))
    expect(await screen.findByRole('dialog', { name: '坏弹窗' })).toBeInTheDocument()
    expect(ctx.notify).toHaveBeenCalledWith('扩展 bad 出错：render failed', 'error')
    expect(screen.getByRole('toolbar', { hidden: true })).toBeInTheDocument()
  })

  it('render 函数本身抛错也由错误边界截获', async () => {
    const ctx = makeCtx()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ext: EditorExtension = {
      name: 'pop-bad',
      toolbar: [
        { type: 'popover', id: 'p', title: '坏浮层', icon: <span>P</span>, render: () => { throw new Error('direct') } },
      ],
    }
    setup([ext], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '坏浮层' }))
    expect(ctx.notify).toHaveBeenCalledWith('扩展 pop-bad 出错：direct', 'error')
    expect(screen.getByRole('button', { name: '坏浮层' })).toBeInTheDocument()
  })

  it('传入 onError 时由其接管错误上报', async () => {
    const ctx = makeCtx()
    const onError = vi.fn()
    const ext: EditorExtension = {
      name: 'demo',
      toolbar: [{ type: 'button', id: 'boom', title: '爆炸', icon: <span>!</span>, run: () => { throw new Error('boom') } }],
    }
    const groups = resolveToolbar([ext], undefined, md)
    wrap(<Toolbar groups={groups} ctx={ctx} onError={onError} />)
    await userEvent.click(screen.getByRole('button', { name: '爆炸' }))
    expect(onError).toHaveBeenCalledWith('demo', expect.objectContaining({ message: 'boom' }))
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('方向键/Home/End 在条目间移动焦点（roving tabindex）', async () => {
    setup([core], [['bold', 'italic'], ['list']])
    const boldButton = screen.getByRole('button', { name: '加粗' })
    expect(boldButton).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: '斜体' })).toHaveAttribute('tabindex', '-1')
    act(() => boldButton.focus())
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: '斜体' })).toHaveFocus()
    expect(screen.getByRole('button', { name: '斜体' })).toHaveAttribute('tabindex', '0')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('button', { name: '列表' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(boldButton).toHaveFocus()
  })

  it('宽度不足时溢出分组移入「更多」菜单（分组设 inert）', async () => {
    mockWidths(100, 250)
    setup([core], [['bold'], ['italic'], ['list']])
    const groups = screen.getAllByRole('group', { hidden: true })
    expect(groups[0]).not.toHaveClass('is-overflow')
    expect(groups[1]).toHaveClass('is-overflow')
    expect(groups[1]).toHaveAttribute('inert')
    await userEvent.click(screen.getByRole('button', { name: '更多' }))
    const menu = await screen.findByRole('menu', { name: '更多' })
    expect(within(menu).getByRole('menuitem', { name: '斜体' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /有序列表/ })).toBeInTheDocument()
  })

  it('一个分组都放不下时全部进入「更多」，更多按钮仍可用', async () => {
    mockWidths(100, 50)
    setup([core], [['bold'], ['italic']])
    const groups = screen.getAllByRole('group', { hidden: true })
    expect(groups.every((g) => g.classList.contains('is-overflow'))).toBe(true)
    const more = screen.getByRole('button', { name: '更多' })
    expect(more).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('toolbar').querySelectorAll('.ex-toolbar__divider:not(.is-overflow)')).toHaveLength(0)
    await userEvent.click(more)
    const menu = await screen.findByRole('menu', { name: '更多' })
    await userEvent.click(within(menu).getByRole('menuitem', { name: /加粗/ }))
    expect(bold).toHaveBeenCalled()
  })

  it('stateKey 变化时重新求值 active', () => {
    let formats = new Set<string>()
    const ctx = makeCtx()
    Object.defineProperty(ctx, 'formats', { get: () => formats })
    const groups = resolveToolbar([core], undefined, md)
    const { rerender } = wrap(<Toolbar groups={groups} ctx={ctx} stateKey="a" />)
    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'false')
    formats = new Set(['bold'])
    act(() =>
      rerender(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={groups} ctx={ctx} stateKey="b" />
          </ToastProvider>
        </ThemeProvider>,
      ),
    )
    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true')
  })
})
