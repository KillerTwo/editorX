import type { EditorEngine } from '@editorx/markdown-core'
import type { ExtensionContext } from '@editorx/toolbar'
import type { EditorStore } from './store'

/** 内置扩展需要、但不属于公开 ExtensionContext 的能力 */
export interface MarkdownInternals {
  engine: EditorEngine
  store: EditorStore
  /** 当前标题（不渲染文档） */
  getTitle(): string
  /** 预览区当前 HTML（图表已绘制时为 SVG；编辑视图下图表未绘制，为占位块） */
  getLiveHtml(): string
  /** 先渲染最新内容，再在离屏副本上补画图表后返回的预览 HTML，用于导出 */
  renderExportHtml(): Promise<string>
  isFullscreen(): boolean
  toggleFullscreen(): void
}

const registry = new WeakMap<ExtensionContext, MarkdownInternals>()

export function registerMarkdownInternals(ctx: ExtensionContext, internals: MarkdownInternals): void {
  registry.set(ctx, internals)
}

export function getMarkdownInternals(ctx: ExtensionContext): MarkdownInternals | undefined {
  return registry.get(ctx)
}
