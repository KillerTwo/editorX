import type { EditorEngine } from '@editorx/markdown-core'
import type { ExtensionContext, ToolbarDialogResult } from '@editorx/toolbar'
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
  /** 目录跳转；找不到标题返回 false */
  scrollToHeading(id: string): boolean
  /** 面板 id 是否已解析（宿主可能移除内置面板） */
  hasPanel(id: string): boolean
  /**
   * 打开工具栏中 id（及扩展名 extension）对应的 modal 条目；结果同 `ToolbarHandle.openDialog`：
   * 已打开 / 已禁用 / 工具栏中没有该条目
   */
  openToolbarDialog(id: string, extension?: string): ToolbarDialogResult
  /** 编辑器组件仍挂载；延迟执行的回调（如对话框关闭后的命令）据此跳过已卸载的编辑器 */
  isMounted(): boolean
}

const registry = new WeakMap<ExtensionContext, MarkdownInternals>()

export function registerMarkdownInternals(ctx: ExtensionContext, internals: MarkdownInternals): void {
  registry.set(ctx, internals)
}

export function getMarkdownInternals(ctx: ExtensionContext): MarkdownInternals | undefined {
  return registry.get(ctx)
}
