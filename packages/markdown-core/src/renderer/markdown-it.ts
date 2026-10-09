import MarkdownIt from 'markdown-it'
import type { MarkdownIt as MarkdownItInstance } from 'markdown-it'
import abbr from 'markdown-it-abbr'
import { full as emojiPlugin } from 'markdown-it-emoji'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import type { EmbedDef, RendererOptions } from '../types'
import { footnotesPlugin } from './footnotes'
import { headingsPlugin } from './headings'
import { highlightCode } from './prism'
import { taskListsPlugin } from './task-lists'

export interface ResolvedRendererOptions {
  embeds: Map<string, EmbedDef>
  math: boolean
  diagrams: boolean
  emoji: boolean
}

export function resolveRendererOptions(options: RendererOptions = {}): ResolvedRendererOptions {
  return {
    embeds: new Map((options.embeds ?? []).map((def) => [def.type, def])),
    math: options.math ?? true,
    diagrams: options.diagrams ?? true,
    emoji: options.emoji ?? true,
  }
}

export function createMarkdownIt(options: ResolvedRendererOptions): MarkdownItInstance {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
  md.use(footnotesPlugin).use(abbr).use(sub).use(sup).use(mark).use(taskListsPlugin).use(headingsPlugin)
  if (options.emoji) md.use(emojiPlugin)

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!
    const lang = token.info.trim().split(/\s+/)[0] ?? ''
    return highlightCode(token.content, lang)
  }
  return md
}
