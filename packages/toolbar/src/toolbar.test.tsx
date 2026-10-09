import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@editorx/theme'
import { ToastProvider } from '@editorx/ui'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('从下拉菜单打开的对话框：初始焦点在对话框内，关闭后焦点回到下拉触发按钮', async () => {
    const ext: EditorExtension = {
      name: 'menu',
      toolbar: [
        {
          type: 'dropdown',
          id: 'insert',
          title: '插入',
          label: '插入',
          items: [
            {
              type: 'modal',
              id: 'tbl',
              title: '表格',
              render: (_ctx, close) => (
                <>
                  <input aria-label="行数" autoFocus />
                  <button onClick={close}>取消</button>
                </>
              ),
            },
          ],
        },
      ],
    }
    const { ctx } = setup([ext])
    await userEvent.click(screen.getByRole('button', { name: '插入' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    await vi.waitFor(() => expect(within(dialog).getByLabelText('行数')).toHaveFocus())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(within(dialog).getByLabelText('行数')).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await vi.waitFor(() => expect(screen.getByRole('button', { name: '插入' })).toHaveFocus())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(ctx.focus).not.toHaveBeenCalled()
  })

  it('直接从工具栏按钮打开的对话框关闭后不调用 ctx.focus（焦点回到按钮）', async () => {
    const { ctx } = setup([core])
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    await userEvent.click(within(dialog).getByRole('button', { name: '插入' }))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: '表格' })).toHaveFocus())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(ctx.focus).not.toHaveBeenCalled()
  })

  it('title / label 函数可读取 ctx（随 stateKey 刷新）', () => {
    const ext: EditorExtension = {
      name: 'state',
      toolbar: [
        { type: 'button', id: 'fs', title: (m, c) => (c?.activePanel === 'x' ? '退出' : m.toolbar.fullscreen), run: vi.fn() },
      ],
    }
    setup([ext], undefined, makeCtx({ activePanel: 'x' }))
    expect(screen.getByRole('button', { name: '退出' })).toBeInTheDocument()
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
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: /加粗/ }))
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

  it('active/disabled 抛错按 false 处理，不崩溃', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ext: EditorExtension = {
      name: 'flaky',
      toolbar: [
        {
          type: 'button',
          id: 'flaky',
          title: '不稳定',
          icon: <span>F</span>,
          active: () => { throw new Error('active') },
          disabled: () => { throw new Error('disabled') },
          run: vi.fn(),
        },
      ],
    }
    setup([ext])
    const button = screen.getByRole('button', { name: '不稳定' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toBeEnabled()
  })

  it('只读时 dropdown 触发器与菜单项（非 allowReadOnly）均禁用', async () => {
    const ext: EditorExtension = {
      name: 'ro-menu',
      toolbar: [
        { type: 'dropdown', id: 'list', title: '列表', label: '列表', items: [{ type: 'button', id: 'ol', title: '有序', run: vi.fn() }] },
        {
          type: 'dropdown',
          id: 'export',
          title: '导出',
          label: '导出',
          allowReadOnly: true,
          items: [
            { type: 'button', id: 'pdf', title: 'PDF', allowReadOnly: true, run: vi.fn() },
            { type: 'button', id: 'edit', title: '编辑', run: vi.fn() },
          ],
        },
      ],
    }
    setup([ext], undefined, makeCtx(), true)
    expect(screen.getByRole('button', { name: '列表' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '导出' }))
    const menu = await screen.findByRole('menu', { name: '导出' })
    expect(within(menu).getByRole('menuitem', { name: 'PDF' })).toBeEnabled()
    expect(within(menu).getByRole('menuitem', { name: '编辑' })).toBeDisabled()
  })

  it('溢出到「更多」的 dropdown 子项继承父级 disabled 与只读规则', async () => {
    mockWidths(100, 150)
    const ext: EditorExtension = {
      name: 'nested',
      toolbar: [
        { type: 'button', id: 'first', title: '第一', icon: <span>1</span>, allowReadOnly: true, run: vi.fn() },
        {
          type: 'dropdown',
          id: 'off',
          title: '关闭的菜单',
          disabled: () => true,
          items: [{ type: 'button', id: 'child', title: '子项', run: vi.fn() }],
        },
        {
          type: 'dropdown',
          id: 'ro',
          title: '只读菜单',
          items: [{ type: 'button', id: 'roChild', title: '只读子项', allowReadOnly: true, run: vi.fn() }],
        },
      ],
    }
    setup([ext], [['first'], ['off'], ['ro']], makeCtx(), true)
    await userEvent.click(screen.getByRole('button', { name: '更多' }))
    const menu = await screen.findByRole('menu', { name: '更多' })
    expect(within(menu).getByRole('menuitem', { name: '子项' })).toBeDisabled()
    expect(within(menu).getByRole('menuitem', { name: '只读子项' })).toBeDisabled()
  })

  it('打开的对话框对应条目从 groups 消失时关闭', async () => {
    const groups = resolveToolbar([core], undefined, md)
    const ctx = makeCtx()
    const { rerender } = wrap(<Toolbar groups={groups} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    expect(await screen.findByRole('dialog', { name: '表格' })).toBeInTheDocument()
    const without = resolveToolbar(
      [{ ...core, toolbar: core.toolbar!.filter((item) => item.type !== 'modal') }],
      undefined,
      md,
    )
    act(() =>
      rerender(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={without} ctx={ctx} />
          </ToastProvider>
        </ThemeProvider>,
      ),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() =>
      rerender(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={groups} ctx={ctx} />
          </ToastProvider>
        </ThemeProvider>,
      ),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('打开的 popover 对应条目消失时一并关闭', async () => {
    const pop: EditorExtension = {
      name: 'pop',
      toolbar: [{ type: 'popover', id: 'emoji', title: '表情', icon: <span>E</span>, render: () => <p>表情面板</p> }],
    }
    const ctx = makeCtx()
    const { rerender } = wrap(<Toolbar groups={resolveToolbar([core, pop], undefined, md)} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: '表情' }))
    expect(await screen.findByText('表情面板')).toBeInTheDocument()
    act(() =>
      rerender(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={resolveToolbar([core], undefined, md)} ctx={ctx} />
          </ToastProvider>
        </ThemeProvider>,
      ),
    )
    expect(screen.queryByText('表情面板')).toBeNull()
  })

  describe('扩展文案求值出错', () => {
    const boom = (): string => {
      throw new TypeError('bad title')
    }

    it('title / label 抛错：回退为条目 id，其余条目照常渲染，console.error 带扩展名', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const ext: EditorExtension = {
        name: 'third-party',
        toolbar: [
          { type: 'button', id: 'save', title: boom, icon: <span>S</span>, run: vi.fn() },
          { type: 'button', id: 'labelled', title: '有标签', label: boom, run: vi.fn() },
        ],
      }
      setup([core, ext])
      expect(screen.getByRole('button', { name: 'save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'labelled' })).toHaveTextContent('labelled')
      expect(screen.getByRole('button', { name: '加粗' })).toBeInTheDocument()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('third-party'), expect.any(TypeError))
    })

    it('菜单子项与对话框标题抛错同样回退为 id', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const ext: EditorExtension = {
        name: 'menu-text',
        toolbar: [
          {
            type: 'dropdown',
            id: 'menu',
            title: '菜单',
            label: '菜单',
            items: [{ type: 'button', id: 'child', title: boom, run: vi.fn() }],
          },
          { type: 'modal', id: 'dlg', title: boom, icon: <span>D</span>, render: () => <p>内容</p> },
        ],
      }
      setup([ext])
      await userEvent.click(screen.getByRole('button', { name: '菜单' }))
      expect(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'child' })).toBeInTheDocument()
      await userEvent.keyboard('{Escape}')
      await userEvent.click(screen.getByRole('button', { name: 'dlg' }))
      expect(await screen.findByRole('dialog', { name: 'dlg' })).toHaveTextContent('内容')
    })
  })

  it('打开的对话框条目以同 id 重新解析为 button 时关闭，不渲染空对话框', async () => {
    const ctx = makeCtx()
    const groups = resolveToolbar([core], undefined, md)
    const { rerender } = wrap(<Toolbar groups={groups} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    expect(await screen.findByRole('dialog', { name: '表格' })).toBeInTheDocument()
    const asButton = resolveToolbar(
      [
        {
          ...core,
          toolbar: core.toolbar!.map((item) =>
            item.type === 'modal' ? { type: 'button' as const, id: 'table', title: '表格', icon: <span>T</span>, run: vi.fn() } : item,
          ),
        },
      ],
      undefined,
      md,
    )
    act(() =>
      rerender(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={asButton} ctx={ctx} />
          </ToastProvider>
        </ThemeProvider>,
      ),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('卸载后不再执行关闭对话框的延迟焦点归还', async () => {
    const ctx = makeCtx()
    const { unmount } = setup([core], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    fireEvent.click(within(dialog).getByRole('button', { name: '插入' }))
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(ctx.focus).not.toHaveBeenCalled()
  })

  it('溢出菜单中嵌套 id 与其他扩展的顶层 id 相同时，按扩展区分选择', async () => {
    mockWidths(100, 150)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const topRun = vi.fn()
    const nestedRun = vi.fn()
    const a: EditorExtension = {
      name: 'a',
      toolbar: [
        { type: 'button', id: 'first', title: '第一', icon: <span>1</span>, run: vi.fn() },
        { type: 'button', id: 'same', title: '顶层同名', icon: <span>S</span>, run: topRun },
      ],
    }
    const b: EditorExtension = {
      name: 'b',
      toolbar: [{ type: 'dropdown', id: 'group-b', title: 'B 菜单', items: [{ type: 'button', id: 'same', title: '嵌套同名', run: nestedRun }] }],
    }
    setup([a, b], [['first'], ['same'], ['group-b']])
    await userEvent.click(screen.getByRole('button', { name: '更多' }))
    const menu = await screen.findByRole('menu', { name: '更多' })
    await userEvent.click(within(menu).getByRole('menuitem', { name: '嵌套同名' }))
    expect(nestedRun).toHaveBeenCalledTimes(1)
    expect(topRun).not.toHaveBeenCalled()
    expect(error.mock.calls.some((args) => String(args[0]).includes('same key'))).toBe(false)
  })

  it('菜单子项带 active 时渲染为 menuitemcheckbox 并反映状态', async () => {
    const ext: EditorExtension = {
      name: 'heading',
      toolbar: [
        {
          type: 'dropdown',
          id: 'heading',
          title: '标题',
          label: '标题',
          items: [
            { type: 'button', id: 'h1', title: '一级标题', active: 'heading1', run: vi.fn() },
            { type: 'button', id: 'h2', title: '二级标题', active: (c) => c.formats.has('heading2'), run: vi.fn() },
            { type: 'button', id: 'plain', title: '正文', run: vi.fn() },
          ],
        },
      ],
    }
    setup([ext], undefined, makeCtx({ formats: new Set(['heading1']) }))
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    const menu = await screen.findByRole('menu', { name: '标题' })
    expect(within(menu).getByRole('menuitemcheckbox', { name: '一级标题' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByRole('menuitemcheckbox', { name: '二级标题' })).toHaveAttribute('aria-checked', 'false')
    expect(within(menu).getByRole('menuitem', { name: '正文' })).not.toHaveAttribute('aria-checked')
  })

  describe('ResizeObserver', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('回调触发重新测量，卸载时 disconnect', () => {
      const size = { group: 100, toolbar: 400 }
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('ex-toolbar__group') ? size.group : 0
      })
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
        return this.classList.contains('ex-toolbar') ? size.toolbar : 0
      })
      let callback: (() => void) | undefined
      const disconnect = vi.fn()
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: () => void) {
            callback = cb
          }
          observe() {}
          unobserve() {}
          disconnect = disconnect
        },
      )
      const { unmount } = setup([core], [['bold'], ['italic'], ['list']])
      expect(screen.getAllByRole('group', { hidden: true }).some((g) => g.classList.contains('is-overflow'))).toBe(false)
      size.toolbar = 250
      act(() => callback!())
      expect(screen.getAllByRole('group', { hidden: true })[1]).toHaveClass('is-overflow')
      expect(screen.getByRole('button', { name: '更多' })).toBeInTheDocument()
      unmount()
      expect(disconnect).toHaveBeenCalled()
    })

    it('环境不支持 ResizeObserver 时只测量一次且不崩溃', () => {
      mockWidths(100, 250)
      vi.stubGlobal('ResizeObserver', undefined)
      setup([core], [['bold'], ['italic'], ['list']])
      expect(screen.getAllByRole('group', { hidden: true })[1]).toHaveClass('is-overflow')
    })
  })
})
