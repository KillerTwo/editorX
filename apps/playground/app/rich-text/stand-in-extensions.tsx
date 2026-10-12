import type { EditorExtension } from '@editorx/toolbar'
import { ArrowLeftRight, FileText, History, Link2, Video } from 'lucide-react'

const ICON = 16

export const csdnHistoryExtension: EditorExtension = {
  name: 'csdn:history',
  editors: ['richtext'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:history',
      title: (m) => m.toolbar.history,
      label: (m) => m.toolbar.history,
      icon: <History size={ICON} />,
      run: (ctx) => ctx.notify('阶段 7 接入', 'info'),
    },
  ],
}

export const csdnResourceExtension: EditorExtension = {
  name: 'csdn:resource',
  editors: ['richtext'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:resource',
      title: (m) => m.toolbar.resource,
      label: (m) => m.toolbar.resource,
      icon: <Link2 size={ICON} />,
      run: (ctx) => ctx.notify('阶段 7 接入', 'info'),
    },
  ],
}

export const csdnVideoExtension: EditorExtension = {
  name: 'csdn:video',
  editors: ['richtext'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:video',
      title: (m) => m.toolbar.video,
      label: (m) => m.toolbar.video,
      icon: <Video size={ICON} />,
      run: (ctx) => ctx.notify('阶段 7 接入', 'info'),
    },
  ],
}

export const csdnTemplateExtension: EditorExtension = {
  name: 'csdn:template',
  editors: ['richtext'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:template',
      title: (m) => m.toolbar.template,
      label: (m) => m.toolbar.template,
      icon: <FileText size={ICON} />,
      run: (ctx) => ctx.notify('阶段 7 接入', 'info'),
    },
  ],
}

export const csdnSwitchEditorExtension: EditorExtension = {
  name: 'csdn:switch-editor',
  editors: ['richtext'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:switch-editor',
      title: (m) => m.toolbar.switchEditor,
      label: (m) => m.toolbar.switchEditor,
      icon: <ArrowLeftRight size={ICON} />,
      run: (ctx) => ctx.notify('阶段 6 接入', 'info'),
    },
  ],
}

export const csdnAiExtension: EditorExtension = {
  name: 'csdn:ai',
  editors: ['richtext'],
  panels: [
    {
      id: 'csdn:ai',
      title: 'AI 助手',
      position: 'right',
      render: () => <p>AI 助手占位</p>,
    },
  ],
}

export const richTextStandInExtensions: readonly EditorExtension[] = [
  csdnHistoryExtension,
  csdnResourceExtension,
  csdnVideoExtension,
  csdnTemplateExtension,
  csdnSwitchEditorExtension,
  csdnAiExtension,
]
