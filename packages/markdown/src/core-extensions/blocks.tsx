import type { EditorExtension } from '@editorx/toolbar'
import {
  Code,
  CodeXml,
  Highlighter,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  SquareCode,
  Subscript,
  Superscript,
} from 'lucide-react'
import { ICON_SIZE, run } from './format'

export const listExtension: EditorExtension = {
  name: 'core:list',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'list',
      title: (m) => m.toolbar.list,
      label: (m) => m.toolbar.list,
      icon: <List size={ICON_SIZE} />,
      items: [
        { type: 'button', id: 'unorderedList', title: (m) => m.toolbar.unorderedList, icon: <List size={ICON_SIZE} />, shortcut: 'Mod-Shift-U', active: 'unorderedList', run: run('unorderedList') },
        { type: 'button', id: 'orderedList', title: (m) => m.toolbar.orderedList, icon: <ListOrdered size={ICON_SIZE} />, shortcut: 'Mod-Shift-O', active: 'orderedList', run: run('orderedList') },
        { type: 'button', id: 'taskList', title: (m) => m.toolbar.taskList, icon: <ListTodo size={ICON_SIZE} />, shortcut: 'Mod-Shift-C', active: 'taskList', run: run('taskList') },
      ],
    },
  ],
}

export const codeExtension: EditorExtension = {
  name: 'core:code',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'code',
      title: (m) => m.toolbar.code,
      label: (m) => m.toolbar.code,
      icon: <CodeXml size={ICON_SIZE} />,
      items: [
        { type: 'button', id: 'codeBlock', title: (m) => m.toolbar.codeBlock, icon: <SquareCode size={ICON_SIZE} />, shortcut: 'Mod-Shift-K', run: run('codeBlock') },
        { type: 'button', id: 'inlineCode', title: (m) => m.toolbar.inlineCode, icon: <Code size={ICON_SIZE} />, active: 'inlineCode', run: run('inlineCode') },
      ],
    },
  ],
}

export const moreFormatExtension: EditorExtension = {
  name: 'core:more-format',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'more-format',
      title: (m) => m.toolbar.moreFormat,
      label: (m) => m.toolbar.moreFormat,
      items: [
        { type: 'button', id: 'quote', title: (m) => m.toolbar.quote, icon: <Quote size={ICON_SIZE} />, active: 'quote', run: run('quote') },
        { type: 'button', id: 'hr', title: (m) => m.toolbar.hr, icon: <Minus size={ICON_SIZE} />, run: run('hr') },
        { type: 'separator' },
        { type: 'button', id: 'mark', title: (m) => m.toolbar.mark, icon: <Highlighter size={ICON_SIZE} />, active: 'mark', run: run('mark') },
        { type: 'button', id: 'superscript', title: (m) => m.toolbar.superscript, icon: <Superscript size={ICON_SIZE} />, active: 'superscript', run: run('superscript') },
        { type: 'button', id: 'subscript', title: (m) => m.toolbar.subscript, icon: <Subscript size={ICON_SIZE} />, active: 'subscript', run: run('subscript') },
      ],
    },
  ],
}
