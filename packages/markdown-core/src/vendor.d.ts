declare module 'markdown-it-footnote' {
  import type { MarkdownIt } from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-abbr' {
  import type { MarkdownIt } from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sub' {
  import type { MarkdownIt } from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sup' {
  import type { MarkdownIt } from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-mark' {
  import type { MarkdownIt } from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-emoji' {
  import type { MarkdownIt } from 'markdown-it'
  export const full: (md: MarkdownIt) => void
}

declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  type Plugin = (service: TurndownService) => void
  export const gfm: Plugin
  export const tables: Plugin
  export const strikethrough: Plugin
  export const taskListItems: Plugin
}
