import type { Env, MarkdownIt } from 'markdown-it'

export type Token = ReturnType<MarkdownIt['parse']>[number]
export type CoreRule = Parameters<MarkdownIt['core']['ruler']['push']>[1]
export type StateCore = Parameters<CoreRule>[0]
export type InlineRule = Parameters<MarkdownIt['inline']['ruler']['push']>[1]
export type StateInline = Parameters<InlineRule>[0]
export type BlockRule = Parameters<MarkdownIt['block']['ruler']['push']>[1]
export type StateBlock = Parameters<BlockRule>[0]

export interface HeadingInfo {
  level: number
  text: string
}

/** Per-render env shared by the ex-* markdown-it plugins; read back by renderer.ts. */
export interface RenderEnv extends Env {
  exHeadings?: HeadingInfo[]
  exTocTitles?: string[]
  exFootnoteRefs?: string[]
}
