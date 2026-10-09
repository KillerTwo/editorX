import { htmlToMarkdown, type EditorEngine, type Renderer } from '@editorx/markdown-core'
import type { EditorAdapters, ExtensionContext, InsertContent, Messages, NotifyType } from '@editorx/toolbar'
import { createCommandRegistry } from './commands'
import { registerMarkdownInternals } from './internals'
import type { EditorStore } from './store'

export interface MarkdownContextDeps {
  engine: EditorEngine
  store: EditorStore
  getRenderer(): Renderer
  getAdapters(): EditorAdapters
  getTitle(): string
  getTheme(): 'light' | 'dark'
  getMessages(): Messages
  isReadOnly(): boolean
  notify(message: string, type?: NotifyType): void
  uploadImages(files: readonly File[]): Promise<void>
  getLiveHtml(): string
  renderExportHtml(): Promise<string>
}

function toMarkdown(content: InsertContent): string {
  if (content.markdown !== undefined) return content.markdown
  return content.html ? htmlToMarkdown(content.html) : ''
}

/** 在 pos 处以独立块插入（前后补足空行） */
function asBlock(value: string, pos: number, block: string): string {
  const before = value.slice(0, pos)
  const after = value.slice(pos)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  return `${lead}${block}${trail}`
}

export function createMarkdownContext(deps: MarkdownContextDeps): ExtensionContext {
  const { engine, store } = deps
  const insertAt = (start: number, end: number, text: string) => {
    engine.replace(start, end, text)
    engine.focus()
  }

  const ctx: ExtensionContext = {
    editorType: 'markdown',
    insert(content) {
      const { end } = engine.getSelection()
      insertAt(end, end, toMarkdown(content))
    },
    insertEmbed(type, payload) {
      const { end } = engine.getSelection()
      const fence = `\`\`\`ex-embed:${type}\n${JSON.stringify(payload, null, 2)}\n\`\`\``
      insertAt(end, end, asBlock(engine.getValue(), end, fence))
    },
    getSelectionText() {
      const { start, end } = engine.getSelection()
      return engine.getValue().slice(start, end)
    },
    replaceSelection(content) {
      const { start, end } = engine.getSelection()
      insertAt(start, end, toMarkdown(content))
    },
    replaceDocument(content) {
      engine.replace(0, engine.getValue().length, toMarkdown(content))
      engine.setSelection(0, 0)
      engine.focus()
    },
    getDocument() {
      const markdown = engine.getValue()
      return { editorType: 'markdown', title: deps.getTitle(), markdown, html: deps.getRenderer().render(markdown).html }
    },
    commands: createCommandRegistry(engine),
    get adapters() {
      return deps.getAdapters()
    },
    openPanel(id) {
      store.set({ panel: id })
    },
    closePanel(id) {
      if (store.get().panel === id) store.set({ panel: null })
    },
    togglePanel(id) {
      store.set({ panel: store.get().panel === id ? null : id })
    },
    get activePanel() {
      return store.get().panel
    },
    uploadImages: (files) => deps.uploadImages(files),
    focus: () => engine.focus(),
    notify: (message, type) => deps.notify(message, type),
    get theme() {
      return deps.getTheme()
    },
    get locale() {
      return deps.getMessages()
    },
    get readOnly() {
      return deps.isReadOnly()
    },
    get formats() {
      return store.get().formats
    },
  }

  registerMarkdownInternals(ctx, {
    engine,
    store,
    getLiveHtml: deps.getLiveHtml,
    renderExportHtml: deps.renderExportHtml,
    isFullscreen: () => store.get().fullscreen,
    toggleFullscreen: () => store.set({ fullscreen: !store.get().fullscreen }),
  })
  return ctx
}
