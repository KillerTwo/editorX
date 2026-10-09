import type { TextState } from '../types'
import { toggleWrap } from './helpers'

export interface PlaceholderArgs {
  placeholder?: string
}

export interface LinkArgs {
  url?: string
  text?: string
}

export const bold = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '**', args?.placeholder ?? '加粗文本')

export const italic = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '*', args?.placeholder ?? '斜体文本')

export const strikethrough = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '~~', args?.placeholder ?? '删除线文本')

export const inlineCode = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '`', args?.placeholder ?? '行内代码')

function linkLike(state: TextState, bang: '' | '!', args: LinkArgs, placeholder: string): TextState {
  const { text } = state
  const { start, end } = state.selection
  const label = args.text ?? (text.slice(start, end) || placeholder)
  const url = args.url ?? 'https://'
  const labelStart = start + bang.length + 1
  const urlStart = labelStart + label.length + 2
  return {
    text: `${text.slice(0, start)}${bang}[${label}](${url})${text.slice(end)}`,
    selection:
      args.url === undefined
        ? { start: urlStart, end: urlStart + url.length }
        : { start: labelStart, end: labelStart + label.length },
  }
}

export const link = (state: TextState, args?: LinkArgs): TextState => linkLike(state, '', args ?? {}, '链接描述')

export const image = (state: TextState, args?: LinkArgs): TextState => linkLike(state, '!', args ?? {}, '图片描述')
