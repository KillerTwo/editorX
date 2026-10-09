import { exportHtml, exportMarkdown, importFile } from '@editorx/markdown-core'
import { errorMessage, formatMessage, type EditorExtension, type ExtensionContext } from '@editorx/toolbar'
import { BookOpen, Download, FileText, FileUp, Maximize2 } from 'lucide-react'
import { downloadBlob, pickFile } from '../download'
import { getMarkdownInternals } from '../internals'
import { ICON_SIZE } from './format'

const fileName = (ctx: ExtensionContext, ext: string) => `${ctx.getDocument().title.trim() || ctx.locale.toolbar.untitled}.${ext}`

const NAME = 'core:more-actions'

const reportFailure = (ctx: ExtensionContext, template: string) => (error: unknown) => {
  console.error(error)
  ctx.notify(formatMessage(template, { name: NAME, message: errorMessage(error) }), 'error')
}

async function importInto(ctx: ExtensionContext) {
  const file = await pickFile('.md,.markdown,.txt,.html,.htm')
  if (!file) return
  ctx.replaceDocument({ markdown: await importFile(file) })
}

/** 预览 HTML 中的图表须已绘制（编辑视图下预览不画图表，由 renderExportHtml 在离屏副本上补画） */
async function exportHtmlFile(ctx: ExtensionContext) {
  const doc = ctx.getDocument()
  const html = (await getMarkdownInternals(ctx)?.renderExportHtml()) || doc.html
  const page = exportHtml({ html, sections: [], toc: [] }, { title: doc.title || ctx.locale.toolbar.untitled })
  downloadBlob(new Blob([page], { type: 'text/html;charset=utf-8' }), fileName(ctx, 'html'))
}

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
          run: (ctx) => downloadBlob(exportMarkdown(ctx.getDocument().markdown ?? ''), fileName(ctx, 'md')),
        },
        {
          type: 'button',
          id: 'exportHtml',
          title: (m) => m.toolbar.exportHtml,
          icon: <FileText size={ICON_SIZE} />,
          allowReadOnly: true,
          run: (ctx) => {
            exportHtmlFile(ctx).catch(reportFailure(ctx, ctx.locale.errors.extension))
          },
        },
        { type: 'separator' },
        {
          type: 'button',
          id: 'syntax',
          title: (m) => m.toolbar.syntax,
          icon: <BookOpen size={ICON_SIZE} />,
          allowReadOnly: true,
          active: (ctx) => ctx.activePanel === 'syntax',
          run: (ctx) => ctx.togglePanel('syntax'),
        },
        {
          type: 'button',
          id: 'fullscreen',
          title: (m) => m.toolbar.fullscreen,
          icon: <Maximize2 size={ICON_SIZE} />,
          allowReadOnly: true,
          active: (ctx) => getMarkdownInternals(ctx)?.isFullscreen() ?? false,
          run: (ctx) => getMarkdownInternals(ctx)?.toggleFullscreen(),
        },
      ],
    },
  ],
}
