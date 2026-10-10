import type { EditorExtension } from '@editorx/toolbar'
import { SyntaxIcon, TocIcon } from '../icons'
import { SyntaxPanel } from '../panels/syntax-panel'
import { TocPanel } from '../panels/toc-panel'

export const tocPanelExtension: EditorExtension = {
  name: 'core:toc-panel',
  editors: ['markdown'],
  panels: [
    {
      id: 'toc',
      title: (m) => m.panels.toc,
      icon: <TocIcon />,
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
      icon: <SyntaxIcon />,
      position: 'right',
      order: 30,
      render: () => <SyntaxPanel />,
    },
  ],
}
