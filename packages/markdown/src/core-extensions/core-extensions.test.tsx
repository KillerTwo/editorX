import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderDiagrams } from '@editorx/markdown-core'
import type { EditorExtension } from '@editorx/toolbar'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { editorContent, editorRoot, previewEl, renderEditor } from '../test-utils'

vi.mock('@editorx/markdown-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@editorx/markdown-core')>()),
  renderDiagrams: vi.fn(async (container: HTMLElement, { theme }: { theme: string }) => {
    for (const block of container.querySelectorAll<HTMLElement>('[data-ex-diagram]')) {
      if (block.dataset.exRenderedTheme === theme) continue
      block.innerHTML = '<svg data-test="diagram"></svg>'
      block.dataset.exRenderedTheme = theme
    }
  }),
}))

const groupNames = () =>
  within(screen.getByRole('toolbar', { name: '编辑工具栏' }))
    .getAllByRole('group')
    .map((g) => within(g).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent))

/** jsdom 没有 createObjectURL：用子类替换全局 URL，不改动原对象 */
function stubObjectUrls() {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:x')
  const revokeObjectURL = vi.fn<(url: string) => void>()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    },
  )
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return { createObjectURL, revokeObjectURL, click }
}

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

const openMenuItem = async (menu: string, item: string | RegExp, role: 'menuitem' | 'menuitemcheckbox' = 'menuitem') => {
  await userEvent.click(screen.getByRole('button', { name: menu }))
  await userEvent.click(await screen.findByRole(role, { name: item }))
}

const enterFullscreen = async () => {
  await openMenuItem('更多操作', '全屏', 'menuitemcheckbox')
  expect(editorRoot()).toHaveAttribute('data-fullscreen')
}

describe('内置扩展', () => {
  it('默认按 CSDN 布局渲染（未提供的 csdn:* 项跳过）', () => {
    renderEditor()
    expect(groupNames()).toEqual([
      ['加粗', '斜体', '标题', '删除线'],
      ['列表', '代码块', '更多格式'],
      ['图片', '链接', '更多插入'],
      ['更多操作'],
    ])
  })

  it('点击加粗包裹选区；光标在加粗内时按钮激活', async () => {
    const { handle } = renderEditor({ defaultValue: 'hello' })
    act(() => handle().getEngine().setSelection(0, 5))
    await userEvent.click(screen.getByRole('button', { name: '加粗' }))
    expect(handle().getValue()).toBe('**hello**')
    await waitFor(() => expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('编辑区内 Ctrl+B / Ctrl+Shift+O 触发命令', () => {
    const { handle } = renderEditor({ defaultValue: 'item' })
    act(() => handle().getEngine().setSelection(0, 4))
    fireEvent.keyDown(editorContent(), { key: 'b', code: 'KeyB', ctrlKey: true })
    expect(handle().getValue()).toBe('**item**')
    fireEvent.keyDown(editorContent(), { key: 'O', code: 'KeyO', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('1. **item**')
  })

  it('编辑区外（工具栏上）的按键不触发快捷键', () => {
    const { handle } = renderEditor({ defaultValue: 'item' })
    act(() => handle().getEngine().setSelection(0, 4))
    fireEvent.keyDown(screen.getByRole('button', { name: '斜体' }), { key: 'b', code: 'KeyB', ctrlKey: true })
    expect(handle().getValue()).toBe('item')
  })

  it('Mod-Shift-H 循环标题级别', () => {
    const { handle } = renderEditor({ defaultValue: 't' })
    act(() => handle().getEngine().setSelection(1, 1))
    fireEvent.keyDown(editorContent(), { key: 'H', code: 'KeyH', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('# t')
    fireEvent.keyDown(editorContent(), { key: 'H', code: 'KeyH', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('## t')
  })

  it('Mod-Shift-H 在 H6 时回到无标题', () => {
    const { handle } = renderEditor({ defaultValue: '###### t' })
    act(() => handle().getEngine().setSelection(8, 8))
    fireEvent.keyDown(editorContent(), { key: 'H', code: 'KeyH', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('t')
  })

  it('只读时快捷键不修改文档', () => {
    const { handle } = renderEditor({ defaultValue: 'x', readOnly: true })
    act(() => handle().getEngine().setSelection(0, 1))
    fireEvent.keyDown(editorContent(), { key: 'b', code: 'KeyB', ctrlKey: true })
    expect(handle().getValue()).toBe('x')
  })

  it('列表下拉选择有序列表；更多格式插入高亮', async () => {
    const { handle } = renderEditor({ defaultValue: 'a' })
    act(() => handle().getEngine().setSelection(0, 1))
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /有序列表/ }))
    expect(handle().getValue()).toBe('1. a')
    act(() => handle().getEngine().setSelection(3, 4))
    await userEvent.click(screen.getByRole('button', { name: '更多格式' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '高亮' }))
    expect(handle().getValue()).toBe('1. ==a==')
  })

  it('下拉菜单项反映光标处格式（aria-checked）', async () => {
    const { handle } = renderEditor({ defaultValue: '1. a' })
    act(() => handle().getEngine().setSelection(4, 4))
    await waitFor(() => expect(screen.getByRole('button', { name: '列表' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    const menu = await screen.findByRole('menu', { name: '列表' })
    await waitFor(() => expect(within(menu).getByRole('menuitemcheckbox', { name: /有序列表/ })).toHaveAttribute('aria-checked', 'true'))
    expect(within(menu).getByRole('menuitemcheckbox', { name: /无序列表/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('链接对话框：以选中文本预填，确定后插入链接', async () => {
    const { handle } = renderEditor({ defaultValue: '文档' })
    act(() => handle().getEngine().setSelection(0, 2))
    await userEvent.click(screen.getByRole('button', { name: '链接' }))
    const dialog = await screen.findByRole('dialog', { name: '链接' })
    expect(within(dialog).getByLabelText('链接文本')).toHaveValue('文档')
    const url = within(dialog).getByLabelText('链接地址')
    await userEvent.clear(url)
    await userEvent.type(url, 'https://e.com')
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    await waitFor(() => expect(handle().getValue()).toBe('[文档](https://e.com)'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('对话框确定后编辑器随即卸载：延迟执行的命令不再改动已销毁的引擎', async () => {
    const { handle, unmount } = renderEditor({ defaultValue: '文档' })
    const engine = handle().getEngine()
    act(() => engine.setSelection(0, 2))
    await userEvent.click(screen.getByRole('button', { name: '链接' }))
    const dialog = await screen.findByRole('dialog', { name: '链接' })
    fireEvent.change(within(dialog).getByLabelText('链接地址'), { target: { value: 'https://e.com' } })
    fireEvent.submit(dialog.querySelector('form')!)
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(engine.getValue()).toBe('文档')
  })

  it('链接对话框：初始焦点在首个输入框；地址为空或仅 https:// 时不能确定', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '链接' }))
    const dialog = await screen.findByRole('dialog', { name: '链接' })
    await waitFor(() => expect(within(dialog).getByLabelText('链接文本')).toHaveFocus())
    const confirm = within(dialog).getByRole('button', { name: '确定' })
    expect(confirm).toBeDisabled()
    const url = within(dialog).getByLabelText('链接地址')
    await userEvent.type(url, 'e.com')
    expect(confirm).toBeEnabled()
    await userEvent.clear(url)
    await userEvent.type(url, '  ')
    expect(confirm).toBeDisabled()
  })

  it('图片对话框：填写地址与描述后插入图片', async () => {
    const { handle } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '图片' }))
    const dialog = await screen.findByRole('dialog', { name: '图片' })
    await waitFor(() => expect(within(dialog).getByLabelText('图片地址')).toHaveFocus())
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: '本地上传' })).toBeNull()
    await userEvent.type(within(dialog).getByLabelText('图片地址'), 'e.com/a.png')
    await userEvent.type(within(dialog).getByLabelText('图片描述'), '图')
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    await waitFor(() => expect(handle().getValue()).toBe('![图](https://e.com/a.png)'))
  })

  it('图片对话框：有 uploadImage 时显示本地上传，选择文件走上传流程', async () => {
    const uploadImage = vi.fn(async () => ({ url: 'https://cdn/a.png' }))
    const { handle } = renderEditor({ adapters: { uploadImage } })
    await userEvent.click(screen.getByRole('button', { name: '图片' }))
    const dialog = await screen.findByRole('dialog', { name: '图片' })
    expect(within(dialog).getByRole('button', { name: '本地上传' })).toBeInTheDocument()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, file)
    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(file))
    await waitFor(() => expect(handle().getValue()).toBe('![a](https://cdn/a.png)'))
  })

  it('从下拉菜单打开的对话框：焦点在行数输入框；取消后焦点回到编辑器内（触发按钮），全屏 Esc 仍可用', async () => {
    renderEditor()
    await enterFullscreen()
    await openMenuItem('更多插入', '表格')
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    await waitFor(() => expect(within(dialog).getByLabelText('行数')).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: '更多插入' })).toHaveFocus())
    // 获得焦点的按钮会显示 tooltip：第一次 Esc 先关闭 tooltip，第二次退出全屏
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Escape}')
    expect(editorRoot()).not.toHaveAttribute('data-fullscreen')
  })

  it('更多插入 → 表格对话框按行列插入', async () => {
    const { handle } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '更多插入' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    const rows = within(dialog).getByLabelText('行数')
    await userEvent.clear(rows)
    await userEvent.type(rows, '1')
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    await waitFor(() => expect(handle().getValue()).toContain('| 列1 | 列2 | 列3 |'))
    expect(handle().getValue().trim().split('\n')).toHaveLength(3)
  })

  it('只读：格式按钮禁用，更多操作可用（导出、全屏）', () => {
    renderEditor({ readOnly: true })
    expect(screen.getByRole('button', { name: '加粗' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '更多操作' })).not.toBeDisabled()
  })

  it('全屏：切换 data-fullscreen，Esc 退出', async () => {
    renderEditor()
    await enterFullscreen()
    fireEvent.keyDown(editorContent(), { key: 'Escape' })
    expect(editorRoot()).not.toHaveAttribute('data-fullscreen')
  })

  it('全屏：输入法组合中的 Esc 不退出', async () => {
    renderEditor()
    await enterFullscreen()
    fireEvent.keyDown(editorContent(), { key: 'Escape', isComposing: true })
    expect(editorRoot()).toHaveAttribute('data-fullscreen')
  })

  it('全屏：菜单项显示「退出全屏」，点击退出', async () => {
    renderEditor()
    await enterFullscreen()
    await openMenuItem('更多操作', '退出全屏', 'menuitemcheckbox')
    expect(editorRoot()).not.toHaveAttribute('data-fullscreen')
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    expect(await screen.findByRole('menuitemcheckbox', { name: '全屏' })).toHaveAttribute('aria-checked', 'false')
  })

  describe('全屏隔离页面', () => {
    const html = document.documentElement
    const extras: HTMLElement[] = []
    const setupPage = () => {
      const outside = document.createElement('button')
      outside.textContent = '页面按钮'
      const already = document.createElement('div')
      already.setAttribute('inert', '')
      document.body.append(outside, already)
      extras.push(outside, already)
      html.style.overflow = 'scroll'
      document.body.style.overflow = 'auto'
      return { outside, already }
    }

    afterEach(() => {
      extras.splice(0).forEach((el) => el.remove())
      html.style.overflow = ''
      document.body.style.overflow = ''
    })

    it('锁定页面滚动（html 与 body）、页面其余部分 inert（浮层容器除外）；退出后还原', async () => {
      const page = setupPage()
      renderEditor()
      await enterFullscreen()
      expect(html.style.overflow).toBe('hidden')
      expect(document.body.style.overflow).toBe('hidden')
      expect(page.outside).toHaveAttribute('inert')
      expect(editorRoot().closest('[inert]')).toBeNull()
      expect(document.querySelector('.ex-portal')!.closest('[inert]')).toBeNull()
      expect(document.querySelector('.ex-body-portal')!.closest('[inert]')).toBeNull()
      fireEvent.keyDown(editorContent(), { key: 'Escape' })
      expect(html.style.overflow).toBe('scroll')
      expect(document.body.style.overflow).toBe('auto')
      expect(page.outside).not.toHaveAttribute('inert')
      expect(page.already).toHaveAttribute('inert')
    })

    it('全屏中卸载时还原', async () => {
      const page = setupPage()
      const { unmount } = renderEditor()
      await enterFullscreen()
      unmount()
      expect(html.style.overflow).toBe('scroll')
      expect(document.body.style.overflow).toBe('auto')
      expect(page.outside).not.toHaveAttribute('inert')
      expect(page.already).toHaveAttribute('inert')
    })
  })

  it('导出 Markdown 触发下载', async () => {
    const { createObjectURL, click } = stubObjectUrls()
    renderEditor({ defaultValue: '# x', title: '我的文章' })
    await openMenuItem('更多操作', '导出为 Markdown')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(await readBlob(createObjectURL.mock.calls[0]![0])).toBe('# x')
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('我的文章.md')
  })

  it('导出 HTML：绘制失败的图表以源码代码块导出', async () => {
    const { createObjectURL } = stubObjectUrls()
    vi.mocked(renderDiagrams).mockImplementationOnce(async (container, { theme }) => {
      const block = container.querySelector<HTMLElement>('.ex-mermaid[data-ex-diagram]')!
      block.innerHTML = '<pre class="ex-mermaid-error">Parse error</pre>'
      block.classList.add('ex-mermaid--error')
      block.dataset.exRenderedTheme = theme
    })
    renderEditor({ defaultValue: '```mermaid\ngraph TD\nA-->B\n```\n', defaultViewMode: 'edit' })
    await waitFor(() => expect(previewEl().querySelector('.ex-mermaid[data-ex-diagram]')).not.toBeNull())
    await openMenuItem('更多操作', '导出为 HTML')
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    const page = await readBlob(createObjectURL.mock.calls[0]![0])
    expect(page).toContain('<pre><code class="language-mermaid">graph TD\nA--&gt;B')
    expect(page).not.toContain('Parse error')
  })

  it('导出 HTML 进行中再次点击被忽略', async () => {
    const { createObjectURL } = stubObjectUrls()
    let release = () => {}
    vi.mocked(renderDiagrams).mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
    renderEditor({ defaultValue: '```mermaid\ngraph TD\n```\n', defaultViewMode: 'edit' })
    await waitFor(() => expect(previewEl().querySelector('.ex-mermaid[data-ex-diagram]')).not.toBeNull())
    await openMenuItem('更多操作', '导出为 HTML')
    await openMenuItem('更多操作', '导出为 HTML')
    expect(renderDiagrams).toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    await openMenuItem('更多操作', '导出为 HTML')
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2))
  })

  it('编辑视图导出 HTML：图表已绘制（不是占位块），预览 DOM 不受影响', async () => {
    const { createObjectURL, click } = stubObjectUrls()
    renderEditor({ defaultValue: '# 图\n\n```mermaid\ngraph TD\nA-->B\n```\n', defaultViewMode: 'edit', title: '图表' })
    await waitFor(() => expect(previewEl().querySelector('.ex-mermaid[data-ex-diagram]')).not.toBeNull())
    expect(previewEl().querySelector('svg')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '导出为 HTML' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    const page = await readBlob(createObjectURL.mock.calls[0]![0])
    expect(page).toContain('<svg data-test="diagram"></svg>')
    expect(page).not.toContain('language-mermaid')
    expect(page).toContain('<title>图表</title>')
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('图表.html')
    expect(previewEl().querySelector('svg')).toBeNull()
  })

  it('自定义扩展：经 * 追加到末尾，setup/cleanup 成对，run 抛错提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const demo: EditorExtension = {
      name: 'demo',
      setup,
      toolbar: [{ type: 'button', id: 'demo:boom', title: '演示', icon: <span>D</span>, run: () => { throw new Error('boom') } }],
    }
    const { unmount } = renderEditor({ extensions: [demo] })
    expect(groupNames().at(-1)).toEqual(['演示'])
    // StrictMode 下 effect 额外执行一轮 setup → cleanup
    expect(setup.mock.calls.length).toBe(cleanup.mock.calls.length + 1)
    await userEvent.click(screen.getByRole('button', { name: '演示' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('扩展 demo 出错：boom')
    unmount()
    expect(cleanup.mock.calls.length).toBe(setup.mock.calls.length)
  })

  it('editors 不含 markdown 的扩展：不调用 setup，不注册 embeds', async () => {
    const setup = vi.fn()
    const richOnly: EditorExtension = {
      name: 'rich-only',
      editors: ['richtext'],
      setup,
      embeds: [{ type: 'rt-card', renderHtml: () => '<b data-test="rt-card">RT</b>' }],
    }
    const mdCard: EditorExtension = {
      name: 'md-card',
      embeds: [{ type: 'md-card', renderHtml: () => '<b data-test="md-card">MD</b>' }],
    }
    renderEditor({
      extensions: [richOnly, mdCard],
      defaultValue: '```ex-embed:rt-card\n{}\n```\n\n```ex-embed:md-card\n{}\n```\n',
    })
    await waitFor(() => expect(previewEl().querySelector('[data-test="md-card"]')).not.toBeNull())
    expect(previewEl().querySelector('[data-test="rt-card"]')).toBeNull()
    expect(setup).not.toHaveBeenCalled()
  })

  it('同名替换的内置扩展：不调用其 setup，不注册其 embeds；替换者生效', async () => {
    const oldSetup = vi.fn()
    const newSetup = vi.fn()
    const original: EditorExtension = {
      name: 'core:card',
      setup: oldSetup,
      embeds: [{ type: 'old-card', renderHtml: () => '<b data-test="old-card">OLD</b>' }],
    }
    const replacement: EditorExtension = {
      name: 'core:card',
      setup: newSetup,
      embeds: [{ type: 'new-card', renderHtml: () => '<b data-test="new-card">NEW</b>' }],
    }
    renderEditor({
      coreExtensions: [original],
      extensions: [replacement],
      defaultValue: '```ex-embed:old-card\n{}\n```\n\n```ex-embed:new-card\n{}\n```\n',
    })
    await waitFor(() => expect(previewEl().querySelector('[data-test="new-card"]')).not.toBeNull())
    expect(previewEl().querySelector('[data-test="old-card"]')).toBeNull()
    expect(oldSetup).not.toHaveBeenCalled()
    expect(newSetup).toHaveBeenCalled()
  })

  it('扩展 title 函数抛错：编辑器与其余工具栏照常渲染，按钮以 id 命名', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad: EditorExtension = {
      name: 'bad-title',
      toolbar: [
        {
          type: 'button',
          id: 'bad:save',
          title: (m) => (m as unknown as { myExt: { save: string } }).myExt.save,
          icon: <span>S</span>,
          run: () => {},
        },
      ],
    }
    renderEditor({ extensions: [bad] })
    expect(screen.getByRole('button', { name: 'bad:save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '加粗' })).toBeInTheDocument()
    expect(editorContent()).toBeInTheDocument()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('bad-title'), expect.any(TypeError))
  })

  it('导出 HTML 失败：提示 errors.export，不显示内部扩展名', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = () => {
          throw new Error('quota')
        }
        static revokeObjectURL = () => {}
      },
    )
    renderEditor({ defaultValue: '# x' })
    await openMenuItem('更多操作', '导出为 HTML')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('导出失败：quota')
    expect(alert).not.toHaveTextContent('core:more-actions')
  })

  it('快捷键处理函数抛错：提示且编辑器继续工作', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad: EditorExtension = {
      name: 'bad',
      shortcuts: {
        'Mod-Shift-J': () => {
          throw new Error('kaboom')
        },
      },
    }
    const { handle } = renderEditor({ defaultValue: 'x', extensions: [bad] })
    act(() => handle().getEngine().setSelection(0, 1))
    fireEvent.keyDown(editorContent(), { key: 'J', code: 'KeyJ', ctrlKey: true, shiftKey: true })
    expect(await screen.findByRole('alert')).toHaveTextContent('扩展 bad 出错：kaboom')
    fireEvent.keyDown(editorContent(), { key: 'b', code: 'KeyB', ctrlKey: true })
    expect(handle().getValue()).toBe('**x**')
  })

  it('toolbarLayout 覆盖默认布局；missingAdapter=disable 显示禁用项', () => {
    const tpl: EditorExtension = {
      name: 'tpl',
      requires: ['getTemplates'],
      toolbar: [{ type: 'button', id: 'csdn:template', title: '模板', icon: <span>T</span>, run: () => {} }],
    }
    renderEditor({ extensions: [tpl], toolbarLayout: [['bold'], ['csdn:template']], missingAdapter: 'disable' })
    expect(groupNames()).toEqual([['加粗'], ['模板']])
    expect(screen.getByRole('button', { name: '模板' })).toBeDisabled()
  })

  it('ref.insert 在光标处插入', () => {
    const { handle } = renderEditor({ defaultValue: 'ab' })
    act(() => handle().getEngine().setSelection(1, 1))
    act(() => handle().insert({ markdown: 'X' }))
    expect(handle().getValue()).toBe('aXb')
  })

  it('只读时 ref.insert 不修改文档', () => {
    const { handle } = renderEditor({ defaultValue: 'ab', readOnly: true })
    act(() => handle().getEngine().setSelection(1, 1))
    act(() => handle().insert({ markdown: 'X' }))
    expect(handle().getValue()).toBe('ab')
  })
})
