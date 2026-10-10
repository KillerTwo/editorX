import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { combineLocal, scheduleTimeSlots } from './schedule'
import { setTimeZone } from './test-utils'

afterAll(setTimeZone('America/New_York'))

const slot = (date: string, value: string, now: number) => scheduleTimeSlots(date, now).find((s) => s.value === value)

describe('定时发布 × 夏令时（America/New_York）', () => {
  it('春令时：2026-03-08 02:00–02:59 不存在，对应时间档禁用，combineLocal 为 undefined', () => {
    const now = new Date(2026, 2, 7, 12, 0).getTime()
    expect(combineLocal('2026-03-08', '02:30')).toBeUndefined()
    expect(slot('2026-03-08', '02:00', now)?.disabled).toBe(true)
    expect(slot('2026-03-08', '02:30', now)?.disabled).toBe(true)
    expect(slot('2026-03-08', '03:00', now)?.disabled).toBe(false)
  })

  it('最大值按绝对毫秒：now + 7×24h 跨春令时后本地时刻晚 1 小时', () => {
    const now = new Date(2026, 2, 7, 12, 0).getTime()
    expect(slot('2026-03-14', '13:00', now)?.disabled).toBe(false)
    expect(slot('2026-03-14', '13:30', now)?.disabled).toBe(true)
  })

  it('最小值跨春令时：23:00 EST + 4h = 04:00 EDT', () => {
    const now = new Date(2026, 2, 7, 23, 0).getTime()
    expect(slot('2026-03-08', '03:30', now)?.disabled).toBe(true)
    expect(slot('2026-03-08', '04:00', now)?.disabled).toBe(false)
  })

  it('秋令时：2026-11-01 01:30 出现两次，取第一次（EDT），仍可选', () => {
    const now = new Date(2026, 9, 30, 12, 0).getTime()
    expect(combineLocal('2026-11-01', '01:30')).toBe(new Date(2026, 10, 1, 1, 30).getTime())
    expect(combineLocal('2026-11-01', '01:30')).toBe(Date.UTC(2026, 10, 1, 5, 30))
    expect(slot('2026-11-01', '01:30', now)?.disabled).toBe(false)
  })
})

describe('定时发布 × 半小时夏令时（Australia/Lord_Howe）', () => {
  let restore: () => void
  beforeAll(() => {
    restore = setTimeZone('Australia/Lord_Howe')
  })
  afterAll(() => restore())

  it('2026-10-04 02:00 → 02:30：02:00 不存在且禁用，02:30 可选', () => {
    const now = new Date(2026, 9, 3, 12, 0).getTime()
    expect(combineLocal('2026-10-04', '02:00')).toBeUndefined()
    expect(slot('2026-10-04', '02:00', now)?.disabled).toBe(true)
    expect(slot('2026-10-04', '02:30', now)?.disabled).toBe(false)
  })
})
