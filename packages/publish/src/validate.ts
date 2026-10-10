import { formatMessage, type Messages, type PublishSettings } from '@editorx/toolbar'
import { DEFAULT_SCHEDULE_RANGE, formatOffset, scheduleBounds, type ScheduleRange } from './schedule'
import { COVER_CAPACITY } from './settings'

export const MAX_TAGS = 7
export const SUMMARY_MAX = 256
export const TITLE_MIN = 5
export const TITLE_MAX = 100

export type PublishField = 'title' | 'tags' | 'cover' | 'summary' | 'sourceUrl' | 'scheduledAt'
export const FIELD_ORDER: readonly PublishField[] = ['title', 'tags', 'cover', 'summary', 'sourceUrl', 'scheduledAt']

export interface RuleContext {
  messages: Messages['publish']
  /** 当前时间（ms） */
  now: number
  /** 文章标题；未传文档时为 undefined，标题规则跳过 */
  title?: string
  /** 定时发布允许区间，默认 DEFAULT_SCHEDULE_RANGE */
  scheduleRange?: ScheduleRange
}

export type PublishRule = (settings: PublishSettings, ctx: RuleContext) => string | undefined
/** 函数替换内置规则，false 关闭；未列出的字段沿用内置规则 */
export type PublishRules = Partial<Record<PublishField, PublishRule | false>>
export type PublishErrors = Partial<Record<PublishField, string>>

export const countChars = (text: string): number => Array.from(text).length
export const sliceChars = (text: string, max: number): string => Array.from(text).slice(0, max).join('')

export const builtinRules: Record<PublishField, PublishRule> = {
  title: (_settings, { title, messages }) => {
    if (title === undefined) return undefined
    const n = countChars(title.trim())
    return n < TITLE_MIN || n > TITLE_MAX ? formatMessage(messages.errors.title, { min: TITLE_MIN, max: TITLE_MAX }) : undefined
  },
  tags: ({ tags }, { messages }) => {
    if (tags.length === 0) return messages.errors.tagsRequired
    return tags.length > MAX_TAGS ? formatMessage(messages.errors.tagsMax, { max: MAX_TAGS }) : undefined
  },
  cover: ({ cover }, { messages }) =>
    cover.mode === 'triple' && cover.urls.length !== COVER_CAPACITY.triple ? messages.errors.coverTriple : undefined,
  summary: ({ summary }, { messages }) =>
    countChars(summary) > SUMMARY_MAX ? formatMessage(messages.errors.summaryMax, { max: SUMMARY_MAX }) : undefined,
  sourceUrl: ({ articleType, sourceUrl }, { messages }) => {
    if (articleType === 'original') return undefined
    const url = sourceUrl?.trim() ?? ''
    if (!url) return messages.errors.sourceUrlRequired
    return /^https?:\/\/\S+$/i.test(url) ? undefined : messages.errors.sourceUrlInvalid
  },
  scheduledAt: ({ scheduledAt }, { messages, now, scheduleRange = DEFAULT_SCHEDULE_RANGE }) => {
    if (scheduledAt === undefined) return undefined
    const time = Date.parse(scheduledAt)
    if (Number.isNaN(time)) return messages.errors.scheduledAtInvalid
    if (time <= now) return messages.errors.scheduledAtPast
    const { min, max } = scheduleBounds(now, scheduleRange)
    const vars = {
      min: formatOffset(scheduleRange.minOffsetMs, messages.schedule.units),
      max: formatOffset(scheduleRange.maxOffsetMs, messages.schedule.units),
    }
    if (time < min) return formatMessage(messages.errors.scheduledAtTooSoon, vars)
    if (time > max) return formatMessage(messages.errors.scheduledAtTooLate, vars)
    return undefined
  },
}

export function validatePublish(settings: PublishSettings, ctx: RuleContext, rules?: PublishRules): PublishErrors {
  const errors: PublishErrors = {}
  for (const field of FIELD_ORDER) {
    const override = rules?.[field]
    if (override === false) continue
    const message = (override ?? builtinRules[field])(settings, ctx)
    if (message) errors[field] = message
  }
  return errors
}

export function firstError(errors: PublishErrors): { field: PublishField; message: string } | undefined {
  for (const field of FIELD_ORDER) {
    const message = errors[field]
    if (message) return { field, message }
  }
  return undefined
}
