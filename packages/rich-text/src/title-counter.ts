import { formatMessage, type Messages } from '@editorx/toolbar'

type TitleMessages = Pick<Messages['richText'], 'titleNeed' | 'titleCount' | 'titleOver'>

export function titleCounter(length: number, m: TitleMessages): { text: string; over: boolean } {
  if (length > 100) return { text: formatMessage(m.titleOver, { n: length }), over: true }
  if (length < 5) return { text: formatMessage(m.titleNeed, { n: 5 - length }), over: false }
  return { text: formatMessage(m.titleCount, { n: length }), over: false }
}
