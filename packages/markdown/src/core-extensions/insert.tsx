import type { EditorExtension, ExtensionContext } from '@editorx/toolbar'
import { Image, Link, Sigma, Table, TableOfContents, Workflow } from 'lucide-react'
import { getMarkdownInternals } from '../internals'
import { ImageDialog, LinkDialog, TableDialog } from './dialogs'
import { ICON_SIZE, run } from './format'

/** 与点击工具栏按钮一致打开对话框；按钮不在工具栏中（宿主自定义布局）时直接执行命令，已禁用时什么都不做 */
const openDialogOr =
  (id: string, extension: string, fallback: (ctx: ExtensionContext) => void) => (ctx: ExtensionContext) => {
    if ((getMarkdownInternals(ctx)?.openToolbarDialog(id, extension) ?? 'missing') === 'missing') fallback(ctx)
  }

export const imageExtension: EditorExtension = {
  name: 'core:image',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'modal',
      id: 'image',
      title: (m) => m.toolbar.image,
      icon: <Image size={ICON_SIZE} />,
      width: 440,
      render: (ctx, close) => <ImageDialog ctx={ctx} close={close} />,
    },
  ],
  shortcuts: { 'Mod-Shift-G': openDialogOr('image', 'core:image', run('image')) },
}

export const linkExtension: EditorExtension = {
  name: 'core:link',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'modal',
      id: 'link',
      title: (m) => m.toolbar.link,
      icon: <Link size={ICON_SIZE} />,
      width: 440,
      render: (ctx, close) => <LinkDialog ctx={ctx} close={close} />,
    },
  ],
  shortcuts: { 'Mod-Shift-L': openDialogOr('link', 'core:link', run('link')) },
}

export const moreInsertExtension: EditorExtension = {
  name: 'core:more-insert',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'more-insert',
      title: (m) => m.toolbar.moreInsert,
      label: (m) => m.toolbar.moreInsert,
      items: [
        { type: 'modal', id: 'table', title: (m) => m.toolbar.table, icon: <Table size={ICON_SIZE} />, width: 400, render: (ctx, close) => <TableDialog ctx={ctx} close={close} /> },
        { type: 'button', id: 'mathBlock', title: (m) => m.toolbar.mathBlock, icon: <Sigma size={ICON_SIZE} />, run: run('math') },
        { type: 'button', id: 'mathInline', title: (m) => m.toolbar.mathInline, run: run('math', { inline: true }) },
        { type: 'button', id: 'toc', title: (m) => m.toolbar.toc, icon: <TableOfContents size={ICON_SIZE} />, run: run('toc') },
        { type: 'separator' },
        { type: 'button', id: 'mermaidFlowchart', title: (m) => m.toolbar.mermaidFlowchart, icon: <Workflow size={ICON_SIZE} />, run: run('mermaid', { type: 'flowchart' }) },
        { type: 'button', id: 'mermaidSequence', title: (m) => m.toolbar.mermaidSequence, run: run('mermaid', { type: 'sequence' }) },
        { type: 'button', id: 'mermaidGantt', title: (m) => m.toolbar.mermaidGantt, run: run('mermaid', { type: 'gantt' }) },
        { type: 'button', id: 'mermaidClass', title: (m) => m.toolbar.mermaidClass, run: run('mermaid', { type: 'class' }) },
      ],
    },
  ],
}
