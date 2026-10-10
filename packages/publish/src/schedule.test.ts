process.env.TZ = 'Asia/Shanghai'

import { zhCN } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import {
  combineLocal,
  DEFAULT_SCHEDULE_RANGE,
  formatOffset,
  scheduleBounds,
  scheduleDateLimits,
  scheduleTimeSlots,
} from './schedule'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = new Date(2026, 9, 9, 12, 0).getTime()
const slot = (date: string, value: string, now = NOW) => scheduleTimeSlots(date, now).find((s) => s.value === value)

describe('定时发布区间（B34：now+4h … now+7d，闭区间）', () => {
  it('默认区间与边界', () => {
    expect(DEFAULT_SCHEDULE_RANGE).toEqual({ minOffsetMs: 4 * HOUR, maxOffsetMs: 7 * DAY })
    expect(scheduleBounds(NOW)).toEqual({ min: NOW + 4 * HOUR, max: NOW + 7 * DAY })
  })

  it('combineLocal：本地日期 + HH:mm；格式无效为 undefined', () => {
    expect(combineLocal('2026-10-10', '10:00')).toBe(new Date(2026, 9, 10, 10, 0).getTime())
    expect(combineLocal('2026-10-10', '24:00')).toBeUndefined()
    expect(combineLocal('2026-02-30', '10:00')).toBeUndefined()
    expect(combineLocal('20261010', '10:00')).toBeUndefined()
    expect(combineLocal('2026-10-10', '9:00')).toBeUndefined()
  })

  it('时间档：起止档含边界，越界禁用（30 分钟一档）', () => {
    expect(scheduleTimeSlots('2026-10-09', NOW)).toHaveLength(48)
    expect(slot('2026-10-09', '15:30')).toEqual({ value: '15:30', disabled: true })
    expect(slot('2026-10-09', '16:00')).toEqual({ value: '16:00', disabled: false })
    expect(slot('2026-10-16', '12:00')).toEqual({ value: '12:00', disabled: false })
    expect(slot('2026-10-16', '12:30')).toEqual({ value: '12:30', disabled: true })
    expect(scheduleTimeSlots('2026-10-17', NOW).every((s) => s.disabled)).toBe(true)
  })

  it('可选日期：首末日至少有一个可用时间档', () => {
    expect(scheduleDateLimits(NOW)).toEqual({ min: '2026-10-09', max: '2026-10-16' })
    // 20:10 → 最早 00:10 次日，首档 00:30
    expect(scheduleDateLimits(new Date(2026, 9, 9, 20, 10).getTime())).toEqual({ min: '2026-10-10', max: '2026-10-16' })
    // 19:50 → 最早 23:50 当天，当天已无可用档（23:30 < 23:50）
    expect(scheduleDateLimits(new Date(2026, 9, 9, 19, 50).getTime())?.min).toBe('2026-10-10')
    // 区间内没有任何整档 → undefined
    expect(scheduleDateLimits(NOW + 60_000, { minOffsetMs: 0, maxOffsetMs: 60_000 })).toBeUndefined()
  })

  it('formatOffset：整天用天，整小时用小时，否则分钟', () => {
    const units = zhCN.publish.schedule.units
    expect(formatOffset(4 * HOUR, units)).toBe('4小时')
    expect(formatOffset(7 * DAY, units)).toBe('7天')
    expect(formatOffset(90 * 60_000, units)).toBe('90分钟')
    expect(formatOffset(0, units)).toBe('0分钟')
  })
})
