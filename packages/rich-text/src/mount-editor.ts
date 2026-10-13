import type { createEditorConfig } from './ck-config'

export interface MountedEditor {
  getData(): string
  setData(html: string): void
  /** 插在选区末尾，不删除选中文本 */
  insertHtml(html: string): void
  /** 删掉当前选区后再插入 */
  replaceHtml(html: string): void
  getSelectionText(): string
  execute(name: string, args?: unknown): void
  focus(): void
  destroy(): Promise<void>
  onChange(cb: () => void): () => void
  setReadOnly(readOnly: boolean): void
}

type EditorLike = {
  getData(): string
  setData(html: string): void
  focus(): void
  destroy(): Promise<unknown>
  execute(name: string, ...params: unknown[]): void
  enableReadOnlyMode(lockId: string): void
  disableReadOnlyMode(lockId: string): void
  data: {
    processor: { toView(html: string): never }
    toModel(view: never): never
  }
  model: {
    change(callback: () => void): void
    insertContent(content: never, selectable?: unknown): void
    deleteContent(selection: ModelSelectionLike): void
    document: {
      selection: ModelSelectionLike
      on(event: 'change:data', listener: () => void): void
      off(event: 'change:data', listener: () => void): void
    }
  }
}

type ModelItemLike = {
  is(type: string): boolean
  data?: string
}

type ModelSelectionLike = {
  isCollapsed: boolean
  getRanges(): Iterable<{ getItems(): Iterable<ModelItemLike> }>
  getLastPosition(): unknown
}

const READ_ONLY_LOCK = 'ex-rte'

/** 只在客户端调用。初始 HTML 走 initialData，避免首次 setData 触发 onChange。 */
export async function mountEditor(
  element: HTMLElement,
  config: Awaited<ReturnType<typeof createEditorConfig>>,
  initialHtml: string,
): Promise<MountedEditor> {
  const { DecoupledEditor } = await import('ckeditor5')
  await loadEditorCss()
  const editor = (await DecoupledEditor.create(element, {
    ...config,
    initialData: initialHtml,
  } as never)) as unknown as EditorLike

  return {
    getData: () => editor.getData(),
    setData(html) {
      editor.setData(html)
    },
    insertHtml(html) {
      editor.model.change(() => {
        const fragment = toModelFragment(editor, html)
        const position = editor.model.document.selection.getLastPosition()
        if (position) editor.model.insertContent(fragment, position)
        else editor.model.insertContent(fragment)
      })
    },
    replaceHtml(html) {
      editor.model.change(() => {
        editor.model.deleteContent(editor.model.document.selection)
        editor.model.insertContent(toModelFragment(editor, html))
      })
    },
    getSelectionText() {
      const selection = editor.model.document.selection
      if (selection.isCollapsed) return ''
      let text = ''
      for (const range of selection.getRanges()) {
        for (const item of range.getItems()) {
          if (item.is('$textProxy') || item.is('$text')) text += item.data ?? ''
        }
      }
      return text
    },
    execute(name, args) {
      if (name === 'heading' && isHeadingArgs(args)) {
        editor.execute('heading', { value: args.heading })
        return
      }
      if (args === undefined) editor.execute(name)
      else editor.execute(name, args)
    },
    focus() {
      editor.focus()
    },
    setReadOnly(readOnly) {
      if (readOnly) editor.enableReadOnlyMode(READ_ONLY_LOCK)
      else editor.disableReadOnlyMode(READ_ONLY_LOCK)
    },
    destroy: () => editor.destroy().then(() => undefined),
    onChange(cb) {
      const listener = () => cb()
      editor.model.document.on('change:data', listener)
      return () => editor.model.document.off('change:data', listener)
    },
  }
}

function loadEditorCss(): Promise<unknown> {
  // @ts-expect-error ckeditor5 的样式入口没有类型声明
  return import('ckeditor5/ckeditor5.css')
}

function toModelFragment(editor: EditorLike, html: string) {
  return editor.data.toModel(editor.data.processor.toView(html))
}

function isHeadingArgs(args: unknown): args is { heading: string } {
  return typeof args === 'object' && args !== null && 'heading' in args && typeof args.heading === 'string'
}
