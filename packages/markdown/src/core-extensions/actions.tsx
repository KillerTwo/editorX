import { exportHtml, exportMarkdown, importFile } from '@editorx/markdown-core'
import { errorMessage, formatMessage, type EditorExtension, type ExtensionContext } from '@editorx/toolbar'
import { BookOpen, Download, FileText, FileUp, Maximize2 } from 'lucide-react'
import { downloadBlob, pickFile } from '../download'
import { getMarkdownInternals } from '../internals'
import { ICON_SIZE } from './format'

const NAME = 'core:more-actions'

const fileName = (ctx: ExtensionContext, title: string, ext: string) => `${title.trim() || ctx.locale.toolbar.untitled}.${ext}`

const reportFailure = (ctx: ExtensionContext, template: string) => (error: unknown) => {
  console.error(error)
  ctx.notify(formatMessage(template, { name: NAME, message: errorMessage(error) }), 'error')
}

async function importInto(ctx: ExtensionContext) {
  const file = await pickFile('.md,.markdown,.txt,.html,.htm')
  if (!file) return
  ctx.replaceDocument({ markdown: await importFile(file) })
}

/** 只取标题与 Markdown，不渲染文档 */
function readSource(ctx: ExtensionContext): { title: string; markdown: string } {
  const internals = getMarkdownInternals(ctx)
  if (internals) return { title: internals.getTitle(), markdown: internals.engine.getValue() }
  const doc = ctx.getDocument()
  return { title: doc.title, markdown: doc.markdown ?? '' }
}

/** 同一编辑器的 HTML 导出进行中（等待图表）时忽略重复点击 */
const exporting = new WeakSet<ExtensionContext>()

/** 预览 HTML 中的图表须已绘制（编辑视图下预览不画图表，由 renderExportHtml 在离屏副本上补画） */
async function exportHtmlFile(ctx: ExtensionContext) {
  if (exporting.has(ctx)) return
  exporting.add(ctx)
  try {
    const internals = getMarkdownInternals(ctx)
    let title: string
    let html: string
    if (internals) {
      title = internals.getTitle()
      html = await internals.renderExportHtml()
    } else {
      const doc = ctx.getDocument()
      title = doc.title
      html = doc.html
    }
    const page = exportHtml({ html, sections: [], toc: [] }, { title: title.trim() || ctx.locale.toolbar.untitled })
    downloadBlob(new Blob([page], { type: 'text/html;charset=utf-8' }), fileName(ctx, title, 'html'))
  } finally {
    exporting.delete(ctx)
  }
}

const isFullscreen = (ctx: ExtensionContext | undefined) => (ctx && getMarkdownInternals(ctx)?.isFullscreen()) ?? false
const hasSyntaxPanel = (ctx: ExtensionContext) => getMarkdownInternals(ctx)?.hasPanel('syntax') ?? true

export const moreActionsExtension: EditorExtension = {
  name: NAME,
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'more-actions',
      title: (m) => m.toolbar.moreActions,
      label: (m) => m.toolbar.moreActions,
      allowReadOnly: true,
      items: [
        {
          type: 'button',
          id: 'importFile',
          title: (m) => m.toolbar.importFile,
          icon: <FileUp size={ICON_SIZE} />,
          run: (ctx) => {
            importInto(ctx).catch(reportFailure(ctx, ctx.locale.errors.import))
          },
        },
        {
          type: 'button',
          id: 'exportMarkdown',
          title: (m) => m.toolbar.exportMarkdown,
          icon: <Download size={ICON_SIZE} />,
          allowReadOnly: true,
          run: (ctx) => {
            const { title, markdown } = readSource(ctx)
            downloadBlob(exportMarkdown(markdown), fileName(ctx, title, 'md'))
          },
        },
        {
          type: 'button',
          id: 'exportHtml',
          title: (m) => m.toolbar.exportHtml,
          icon: <FileText size={ICON_SIZE} />,
          allowReadOnly: true,
          run: (ctx) => {
            exportHtmlFile(ctx).catch(reportFailure(ctx, ctx.locale.errors.export))
          },
        },
        { type: 'separator' },
        {
          type: 'button',
          id: 'syntax',
          title: (m) => m.toolbar.syntax,
          icon: <BookOpen size={ICON_SIZE} />,
          allowReadOnly: true,
          active: (ctx) => hasSyntaxPanel(ctx) && ctx.activePanel === 'syntax',
          disabled: (ctx) => !hasSyntaxPanel(ctx),
          run: (ctx) => {
            if (hasSyntaxPanel(ctx)) ctx.togglePanel('syntax')
          },
        },
        {
          type: 'button',
          id: 'fullscreen',
          title: (m, ctx) => (isFullscreen(ctx) ? m.toolbar.exitFullscreen : m.toolbar.fullscreen),
          icon: <Maximize2 size={ICON_SIZE} />,
          allowReadOnly: true,
          active: (ctx) => isFullscreen(ctx),
          run: (ctx) => getMarkdownInternals(ctx)?.toggleFullscreen(),
        },
      ],
    },
  ],
}
