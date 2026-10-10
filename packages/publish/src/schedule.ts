import { formatMessage, type Messages } from '@editorx/toolbar'
import { addDays, timeSlots, toDateKey, type DateKey, type TimeOption } from '@editorx/ui'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const SCHEDULE_MIN_OFFSET_MS = 4 * HOUR
export const SCHEDULE_MAX_OFFSET_MS = 7 * DAY

/** 两端均为整分钟且 0 ≤ minOffsetMs ≤ maxOffsetMs；不满足时（含 NaN / Infinity）按 DEFAULT_SCHEDULE_RANGE 处理 */
export interface ScheduleRange {
  /** 距当前时间的最小提前量（ms），闭区间 */
  minOffsetMs: number
  /** 最大提前量（ms），闭区间；按绝对毫秒计，跨夏令时本地时刻可能偏 1 小时 */
  maxOffsetMs: number
}

export const DEFAULT_SCHEDULE_RANGE: ScheduleRange = {
  minOffsetMs: SCHEDULE_MIN_OFFSET_MS,
  maxOffsetMs: SCHEDULE_MAX_OFFSET_MS,
}

// NaN 与 -Infinity 不满足 >= 0；Infinity 与小数取模不为 0
const wholeMinutes = (ms: number) => ms >= 0 && ms % MINUTE === 0

export function normalizeScheduleRange(range?: ScheduleRange): ScheduleRange {
  return range && wholeMinutes(range.minOffsetMs) && wholeMinutes(range.maxOffsetMs) && range.minOffsetMs <= range.maxOffsetMs
    ? range
    : DEFAULT_SCHEDULE_RANGE
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInputValue(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number]
  const date = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function formatScheduleTime(iso: string): string {
  return toLocalInputValue(new Date(iso)).replace('T', ' ')
}

export function scheduleBounds(now: number, range?: ScheduleRange) {
  const { minOffsetMs, maxOffsetMs } = normalizeScheduleRange(range)
  return { min: now + minOffsetMs, max: now + maxOffsetMs }
}

/** 本地日期 + 'HH:mm' → 时间戳；格式无效或该本地时刻不存在（夏令时跳过的时段）时为 undefined */
export function combineLocal(date: string, time: string): number | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return undefined
  const [year, month, day] = [Number(d[1]), Number(d[2]) - 1, Number(d[3])]
  const [hours, minutes] = [Number(t[1]), Number(t[2])]
  const value = new Date(year, month, day, hours, minutes)
  const same =
    value.getFullYear() === year &&
    value.getMonth() === month &&
    value.getDate() === day &&
    value.getHours() === hours &&
    value.getMinutes() === minutes
  return same ? value.getTime() : undefined
}

/** 某本地日期的全部时间档；不存在的时刻与区间外的时刻禁用 */
export function scheduleTimeSlots(
  date: string,
  now: number,
  range: ScheduleRange = DEFAULT_SCHEDULE_RANGE,
  stepMinutes = 30,
): TimeOption[] {
  const { min, max } = scheduleBounds(now, range)
  return timeSlots(stepMinutes).map((value) => {
    const at = combineLocal(date, value)
    return { value, disabled: at === undefined || at < min || at > max }
  })
}

/** 可选日期区间：首末日都至少有一个可用时间档；区间内没有整档时为 undefined */
export function scheduleDateLimits(
  now: number,
  range: ScheduleRange = DEFAULT_SCHEDULE_RANGE,
  stepMinutes = 30,
): { min: DateKey; max: DateKey } | undefined {
  const { min, max } = scheduleBounds(now, range)
  const usable = (date: DateKey) => scheduleTimeSlots(date, now, range, stepMinutes).some((s) => !s.disabled)
  let first = toDateKey(new Date(min))
  let last = toDateKey(new Date(max))
  if (!usable(first)) first = addDays(first, 1)
  if (!usable(last)) last = addDays(last, -1)
  // 后移一天后首日仍无可用档只在连续两天 00:00 都不存在时可能出现，按无可选日期处理
  return first <= last && usable(first) ? { min: first, max: last } : undefined
}

export function formatOffset(ms: number, units: Messages['publish']['schedule']['units']): string {
  if (ms > 0 && ms % DAY === 0) return formatMessage(units.days, { count: ms / DAY })
  if (ms > 0 && ms % HOUR === 0) return formatMessage(units.hours, { count: ms / HOUR })
  return formatMessage(units.minutes, { count: Math.round(ms / MINUTE) })
}
