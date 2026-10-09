import { ClEditEngine, createRenderer } from '@editorx/markdown-core'
import { zhCN } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { createMarkdownContext } from './context'
import { getMarkdownInternals } from './internals'
import { createEditorStore } from './store'

function setup(value: string, readOnly = false) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const engine = new ClEditEngine()
  engine.mount(host, { value })
  const store = createEditorStore()
  const renderer = createRenderer()
  const notify = vi.fn()
  const uploadImages = vi.fn(async () => {})
  const ctx = createMarkdownContext({
    engine,
    store,
    getRenderer: () => renderer,
    getAdapters: () => ({}),
    getTitle: () => '文章',
    getTheme: () => 'dark',
    getMessages: () => zhCN,
    isReadOnly: () => readOnly,
    notify,
    uploadImages,
    getLiveHtml: () => '<p>live</p>',
    renderExportHtml: async () => '<p>export</p>',
  })
  return { engine, store, ctx, notify, uploadImages }
}

describe('createMarkdownContext', () => {
  it('insert 在选区末尾插入；replaceSelection 替换选区；html 内容转为 Markdown', () => {
    const { engine, ctx } = setup('hello world')
    engine.setSelection(0, 5)
    ctx.insert({ markdown: '!' })
    expect(engine.getValue()).toBe('hello! world')
    engine.setSelection(7, 12)
    ctx.replaceSelection({ html: '<strong>there</strong>' })
    expect(engine.getValue()).toBe('hello! **there**')
  })

  it('getSelectionText / getDocument / replaceDocument', () => {
    const { engine, ctx } = setup('# 标题')
    engine.setSelection(2, 4)
    expect(ctx.getSelectionText()).toBe('标题')
    expect(ctx.getDocument()).toEqual({ editorType: 'markdown', title: '文章', markdown: '# 标题', html: expect.stringContaining('<h1') })
    ctx.replaceDocument({ markdown: '新文档' })
    expect(engine.getValue()).toBe('新文档')
    engine.undo()
    expect(engine.getValue()).toBe('# 标题')
  })

  it('insertEmbed 作为独立块插入 ex-embed 围栏', () => {
    const { engine, ctx } = setup('前文')
    engine.setSelection(2, 2)
    ctx.insertEmbed('vote', { id: 'v1' })
    expect(engine.getValue()).toBe('前文\n\n```ex-embed:vote\n{\n  "id": "v1"\n}\n```\n')
  })

  it('commands 路由到 markdown-core，未知命令返回 false', () => {
    const { engine, ctx } = setup('x')
    engine.setSelection(0, 1)
    expect(ctx.commands.has('bold')).toBe(true)
    expect(ctx.commands.run('bold')).toBe(true)
    expect(engine.getValue()).toBe('**x**')
    expect(ctx.commands.run('nope')).toBe(false)
    expect(ctx.commands.list()).toContain('mark')
  })

  it('面板开关与 live getter', () => {
    const { store, ctx } = setup('')
    ctx.openPanel('toc')
    expect(ctx.activePanel).toBe('toc')
    ctx.togglePanel('toc')
    expect(ctx.activePanel).toBeNull()
    ctx.openPanel('syntax')
    ctx.closePanel('toc')
    expect(ctx.activePanel).toBe('syntax')
    store.set({ formats: new Set(['bold']) })
    expect(ctx.formats.has('bold')).toBe(true)
    expect(ctx.theme).toBe('dark')
    expect(ctx.locale.toolbar.bold).toBe('加粗')
  })

  it('只读时 insert / replaceSelection / replaceDocument / insertEmbed 不修改文档', () => {
    const { engine, ctx } = setup('abc', true)
    engine.setSelection(0, 3)
    ctx.insert({ markdown: 'X' })
    ctx.replaceSelection({ markdown: 'Y' })
    ctx.replaceDocument({ markdown: 'Z' })
    ctx.insertEmbed('vote', { id: 1 })
    expect(engine.getValue()).toBe('abc')
    expect(ctx.getSelectionText()).toBe('abc')
  })

  it('internals：全屏开关、live HTML 与导出 HTML', async () => {
    const { store, ctx } = setup('')
    const internals = getMarkdownInternals(ctx)!
    internals.toggleFullscreen()
    expect(store.get().fullscreen).toBe(true)
    expect(internals.isFullscreen()).toBe(true)
    expect(internals.getLiveHtml()).toBe('<p>live</p>')
    expect(internals.getTitle()).toBe('文章')
    await expect(internals.renderExportHtml()).resolves.toBe('<p>export</p>')
  })
})
