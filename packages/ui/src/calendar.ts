/** 'YYYY-MM-DD'。日历日运算一律用 UTC 算术，不受本地时区与夏令时影响 */
export type DateKey = string

const pad = (n: number) => String(n).padStart(2, '0')
const fromUtc = (d: Date): DateKey => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return undefined
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number]
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? { year, month, day }
    : undefined
}

function toUtc(key: DateKey): Date {
  const parts = parseDateKey(key)
  if (!parts) throw new RangeError(`无效日期：${key}`)
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = toUtc(key)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

export function addMonths(key: DateKey, months: number): DateKey {
  const d = toUtc(key)
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return fromUtc(target)
}

export function monthGrid(year: number, month: number): DateKey[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const start = Date.UTC(year, month - 1, 1 - first.getUTCDay())
  return Array.from({ length: 42 }, (_, i) => fromUtc(new Date(start + i * 86_400_000)))
}

export function isDateDisabled(key: DateKey, min?: DateKey, max?: DateKey): boolean {
  return (min !== undefined && key < min) || (max !== undefined && key > max)
}

export function clampDateKey(key: DateKey, min?: DateKey, max?: DateKey): DateKey {
  if (min !== undefined && key < min) return min
  if (max !== undefined && key > max) return max
  return key
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now)
}
