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

const STEP = 5 * 60 * 1000
const HOUR = 60 * 60 * 1000

export function defaultScheduleTime(now: number): Date {
  return new Date(Math.ceil((now + HOUR) / STEP) * STEP)
}

export function formatScheduleTime(iso: string): string {
  return toLocalInputValue(new Date(iso)).replace('T', ' ')
}
