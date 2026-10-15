import type { EditorExtension, ExtensionContext, Messages } from '@geekx/toolbar'
import { Bold, Heading, Italic } from 'lucide-react'
import { detectFormats } from '../formats'
import { StrikeIcon } from '../icons'
import { getMarkdownInternals } from '../internals'

export const ICON_SIZE = 16

export const run = (name: string, args?: unknown) => (ctx: ExtensionContext) => {
  ctx.commands.run(name, args)
}

type Level = 1 | 2 | 3 | 4 | 5 | 6
const LEVELS: ReadonlyArray<readonly [Level, (m: Messages) => string]> = [
  [1, (m) => m.toolbar.heading1],
  [2, (m) => m.toolbar.heading2],
  [3, (m) => m.toolbar.heading3],
  [4, (m) => m.toolbar.heading4],
  [5, (m) => m.toolbar.heading5],
  [6, (m) => m.toolbar.heading6],
]

/** 无标题 → H1 → H2 … → H6 → 无标题 */
export function cycleHeading(ctx: ExtensionContext): void {
  const engine = getMarkdownInternals(ctx)?.engine
  const formats = engine ? detectFormats(engine.getValue(), engine.getSelection()) : ctx.formats
  const current = LEVELS.find(([level]) => formats.has(`heading${level}`))?.[0]
  if (current === undefined) {
    ctx.commands.run('heading1')
  } else if (current === 6) {
    // headingN 对已是 N 级的行是开关：再执行一次 heading6 即去掉标题
    ctx.commands.run('heading6')
  } else {
    ctx.commands.run(`heading${current + 1}`)
  }
}

export const formatExtension: EditorExtension = {
  name: 'core:format',
  editors: ['markdown'],
  toolbar: [
    { type: 'button', id: 'bold', title: (m) => m.toolbar.bold, icon: <Bold size={ICON_SIZE} />, shortcut: 'Mod-B', active: 'bold', run: run('bold') },
    { type: 'button', id: 'italic', title: (m) => m.toolbar.italic, icon: <Italic size={ICON_SIZE} />, shortcut: 'Mod-I', active: 'italic', run: run('italic') },
    {
      type: 'dropdown',
      id: 'heading',
      title: (m) => m.toolbar.heading,
      icon: <Heading size={ICON_SIZE} />,
      active: 'heading',
      items: LEVELS.map(([level, title]) => ({
        type: 'button' as const,
        id: `heading${level}`,
        title,
        active: `heading${level}`,
        run: run(`heading${level}`),
      })),
    },
    {
      type: 'button',
      id: 'strikethrough',
      title: (m) => m.toolbar.strikethrough,
      icon: <StrikeIcon />,
      active: 'strikethrough',
      run: run('strikethrough'),
    },
  ],
  shortcuts: { 'Mod-Shift-H': cycleHeading },
}
