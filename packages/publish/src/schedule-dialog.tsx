import { formatMessage, useMessages } from '@geekx/toolbar'
import { Button, DatePicker, Modal, TimePicker } from '@geekx/ui'
import { useId, useState } from 'react'
import {
  combineLocal,
  formatOffset,
  normalizeScheduleRange,
  scheduleBounds,
  scheduleDateLimits,
  scheduleTimeSlots,
  type ScheduleRange,
} from './schedule'

export interface ScheduleDialogProps {
  /** 默认 DEFAULT_SCHEDULE_RANGE；无效区间同样回退为默认值 */
  range?: ScheduleRange
  /** 发布时间校验失败的文案；有值时替换提示行并 role="alert" */
  error?: string
  /** 每次新的校验失败时变化，使相同文案的错误重新播报 */
  errorKey?: number
  busy?: boolean
  /** 用户改选日期或时间时调用（宿主据此清除旧的校验错误） */
  onChange?(): void
  onCancel(): void
  onConfirm(iso: string): void
}

type DateLimits = ReturnType<typeof scheduleDateLimits>

const withinLimits = (date: string | undefined, limits: DateLimits) =>
  date !== undefined && limits !== undefined && date >= limits.min && date <= limits.max ? date : undefined

/** 只在打开时挂载：可选区间按挂载时（客户端）的当前时间计算，确认失败时刷新 */
export function ScheduleDialog({
  range: rangeProp,
  error,
  errorKey = 0,
  busy = false,
  onChange,
  onCancel,
  onConfirm,
}: ScheduleDialogProps) {
  const m = useMessages()
  const s = m.publish.schedule
  const messageId = useId()
  const range = normalizeScheduleRange(rangeProp)
  const [now, setNow] = useState(() => Date.now())
  const [date, setDate] = useState<string>()
  const [time, setTime] = useState<string>()
  const [invalid, setInvalid] = useState(false)
  const [failures, setFailures] = useState(0)
  const usableTime = (day: string, value: string | undefined, at: number) =>
    value !== undefined && scheduleTimeSlots(day, at, range).some((slot) => slot.value === value && !slot.disabled)
  const limits = scheduleDateLimits(now, range)
  // 选择变化与确认失败时已清空不可用的日期 / 时间；这里的派生值只作兜底
  const validDate = withinLimits(date, limits)
  const slots = validDate ? scheduleTimeSlots(validDate, now, range) : []
  const validTime = slots.some((slot) => slot.value === time && !slot.disabled) ? time : undefined
  const at = validDate && validTime ? combineLocal(validDate, validTime) : undefined
  const hint = formatMessage(s.hint, {
    min: formatOffset(range.minOffsetMs, s.units),
    max: formatOffset(range.maxOffsetMs, s.units),
  })
  const message = invalid ? hint : error
  const changed = () => {
    setInvalid(false)
    onChange?.()
  }
  const confirm = () => {
    // 区间按点击时的当前时间判断：弹窗开着时时间仍在流逝
    const clicked = Date.now()
    const { min, max } = scheduleBounds(clicked, range)
    if (at === undefined || at < min || at > max) {
      const keptDate = withinLimits(validDate, scheduleDateLimits(clicked, range))
      setNow(clicked)
      setDate(keptDate)
      if (!keptDate || !usableTime(keptDate, validTime, clicked)) setTime(undefined)
      setInvalid(true)
      setFailures((n) => n + 1)
      return
    }
    onConfirm(new Date(at).toISOString())
  }
  return (
    <Modal
      open
      onClose={onCancel}
      title={s.title}
      width={366}
      className="ex-pub-schedule"
      maskClassName="ex-pub-schedule-mask"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button className="ex-pub-schedule__cancel" onClick={onCancel}>
            {s.cancel}
          </Button>
          <Button className="ex-pub-schedule__confirm" variant="primary" loading={busy} onClick={confirm}>
            {s.confirm}
          </Button>
        </>
      }
    >
      {message ? (
        // key 随失败次数变化：重新挂载 role="alert" 节点，相同文案也会再次播报
        <p key={`${failures}-${errorKey}`} id={messageId} className="ex-pub-schedule__error" role="alert">
          {message}
        </p>
      ) : (
        <p id={messageId} className="ex-pub-schedule__hint">
          {hint}
        </p>
      )}
      <div className="ex-pub-schedule__fields">
        <DatePicker
          className="ex-pub-schedule__date"
          label={s.dateLabel}
          placeholder={s.datePlaceholder}
          value={validDate}
          onChange={(next) => {
            setDate(next)
            if (!usableTime(next, time, now)) setTime(undefined)
            changed()
          }}
          min={limits?.min}
          max={limits?.max}
          disabled={!limits}
          labels={s.calendar}
          describedBy={messageId}
          invalid={Boolean(message) && !validDate}
        />
        <TimePicker
          className="ex-pub-schedule__time"
          listClassName="ex-pub-select-list"
          label={s.label}
          placeholder={s.timePlaceholder}
          value={validTime}
          onChange={(next) => {
            setTime(next)
            changed()
          }}
          options={slots}
          disabled={!validDate}
          describedBy={messageId}
          invalid={Boolean(message) && Boolean(validDate)}
        />
      </div>
    </Modal>
  )
}
