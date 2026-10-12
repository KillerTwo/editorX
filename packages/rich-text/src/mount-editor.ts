import type { createEditorConfig } from './ck-config'

export interface MountedEditor {
  getData(): string
  setData(html: string): void
  insertHtml(html: string): void
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
    insertContent(content: never): void
    document: {
      on(event: 'change:data', listener: () => void): void
      off(event: 'change:data', listener: () => void): void
    }
  }
}

const READ_ONLY_LOCK = 'ex-rte'

/** 只在客户端调用。初始 HTML 走 initialData，避免首次 setData 触发 onChange。 */
export async function mountEditor(
  element: HTMLElement,
  config: ReturnType<typeof createEditorConfig>,
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
        const viewFragment = editor.data.processor.toView(html)
        const modelFragment = editor.data.toModel(viewFragment)
        editor.model.insertContent(modelFragment)
      })
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

function isHeadingArgs(args: unknown): args is { heading: string } {
  return typeof args === 'object' && args !== null && 'heading' in args && typeof args.heading === 'string'
}
