import type { EditorExtension } from '@editorx/toolbar'
import { BookOpen, ListTree } from 'lucide-react'
import { SyntaxPanel } from '../panels/syntax-panel'
import { TocPanel } from '../panels/toc-panel'

export const tocPanelExtension: EditorExtension = {
  name: 'core:toc-panel',
  editors: ['markdown'],
  panels: [
    {
      id: 'toc',
      title: (m) => m.panels.toc,
      icon: <ListTree size={20} />,
      position: 'right',
      order: 20,
      render: (ctx) => <TocPanel ctx={ctx} />,
    },
  ],
}

export const syntaxPanelExtension: EditorExtension = {
  name: 'core:syntax-panel',
  editors: ['markdown'],
  panels: [
    {
      id: 'syntax',
      title: (m) => m.panels.syntax,
      icon: <BookOpen size={20} />,
      position: 'right',
      order: 30,
      render: () => <SyntaxPanel />,
    },
  ],
}
