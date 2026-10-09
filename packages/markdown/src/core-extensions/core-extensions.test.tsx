import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('列表下拉选择有序列表；更多格式插入高亮', async () => {
    const { handle } = renderEditor({ defaultValue: 'a' })
    act(() => handle().getEngine().setSelection(0, 1))
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /有序列表/ }))
    expect(handle().getValue()).toBe('1. a')
    act(() => handle().getEngine().setSelection(3, 4))
    await userEvent.click(screen.getByRole('button', { name: '更多格式' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '高亮' }))
    expect(handle().getValue()).toBe('1. ==a==')
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
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '全屏' }))
    expect(editorRoot()).toHaveAttribute('data-fullscreen')
    fireEvent.keyDown(editorContent(), { key: 'Escape' })
    expect(editorRoot()).not.toHaveAttribute('data-fullscreen')
  })

  it('导出 Markdown 触发下载并回收对象 URL', async () => {
    const { createObjectURL, revokeObjectURL, click } = stubObjectUrls()
    renderEditor({ defaultValue: '# x', title: '我的文章' })
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '导出为 Markdown' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('我的文章.md')
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:x'))
  })

  it('编辑视图导出 HTML：图表已绘制（不是占位块），预览 DOM 不受影响', async () => {
    const { createObjectURL, revokeObjectURL, click } = stubObjectUrls()
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
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:x'))
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
})
