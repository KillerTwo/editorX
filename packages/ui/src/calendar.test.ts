process.env.TZ = 'America/New_York'

import { describe, expect, it } from 'vitest'
import { addDays, addMonths, clampDateKey, isDateDisabled, monthGrid, parseDateKey, toDateKey, todayKey } from './calendar'

describe('calendar', () => {
  it('toDateKey 取本地日期；parseDateKey 拒绝不存在的日期', () => {
    expect(toDateKey(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
    expect(parseDateKey('2026-02-29')).toBeUndefined()
    expect(parseDateKey('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseDateKey('2026-1-1')).toBeUndefined()
  })

  it('addDays 跨 DST 与跨年仍按日历日', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-09', -7)).toBe('2026-10-02')
  })

  it('addMonths 夹到目标月最后一天', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-10-09', -12)).toBe('2025-10-09')
  })

  it('monthGrid：42 天，周日开头', () => {
    const grid = monthGrid(2026, 10)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-27')
    expect(grid[4]).toBe('2026-10-01')
    expect(grid[41]).toBe('2026-11-07')
  })

  it('isDateDisabled / clampDateKey 为闭区间', () => {
    expect(isDateDisabled('2026-10-09', '2026-10-09', '2026-10-16')).toBe(false)
    expect(isDateDisabled('2026-10-16', '2026-10-09', '2026-10-16')).toBe(false)
    expect(isDateDisabled('2026-10-08', '2026-10-09', '2026-10-16')).toBe(true)
    expect(isDateDisabled('2026-10-17', '2026-10-09', '2026-10-16')).toBe(true)
    expect(clampDateKey('2026-10-01', '2026-10-09', '2026-10-16')).toBe('2026-10-09')
    expect(clampDateKey('2026-11-01', '2026-10-09', '2026-10-16')).toBe('2026-10-16')
    expect(clampDateKey('2026-10-12')).toBe('2026-10-12')
  })

  it('todayKey 默认取当前本地日期', () => {
    expect(todayKey(new Date(2026, 9, 10, 0, 0))).toBe('2026-10-10')
  })
})
