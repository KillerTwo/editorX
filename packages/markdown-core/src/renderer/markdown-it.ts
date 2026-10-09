import MarkdownIt from 'markdown-it'
import type { MarkdownIt as MarkdownItInstance } from 'markdown-it'
import abbr from 'markdown-it-abbr'
import { full as emojiPlugin } from 'markdown-it-emoji'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import type { EmbedDef, RendererOptions } from '../types'
import {
  EMBED_FENCE_PREFIX,
  isFlowchartJs,
  renderEmbedFence,
  renderFlowchartPlaceholder,
  renderMermaidPlaceholder,
} from './fences'
import { footnotesPlugin } from './footnotes'
import { headingsPlugin } from './headings'
import { mathPlugin } from './math'
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
  if (options.math) md.use(mathPlugin)
  if (options.emoji) md.use(emojiPlugin)

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!
    const lang = token.info.trim().split(/\s+/)[0] ?? ''
    if (options.diagrams && (lang === 'flow' || lang === 'flowchart')) {
      return renderFlowchartPlaceholder(token.content)
    }
    if (options.diagrams && lang === 'mermaid') {
      return isFlowchartJs(token.content)
        ? renderFlowchartPlaceholder(token.content)
        : renderMermaidPlaceholder(token.content)
    }
    if (lang.startsWith(EMBED_FENCE_PREFIX)) {
      return renderEmbedFence(lang.slice(EMBED_FENCE_PREFIX.length), token.content, options.embeds)
    }
    return highlightCode(token.content, lang)
  }
  return md
}
