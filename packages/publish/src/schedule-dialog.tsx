import { formatMessage, useMessages } from '@editorx/toolbar'
import { Button, DatePicker, Modal, TimePicker } from '@editorx/ui'
import { useState } from 'react'
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
  busy?: boolean
  onCancel(): void
  onConfirm(iso: string): void
}

/** 只在打开时挂载：可选区间按挂载时（客户端）的当前时间计算，确认失败时刷新 */
export function ScheduleDialog({ range: rangeProp, error, busy = false, onCancel, onConfirm }: ScheduleDialogProps) {
  const m = useMessages()
  const s = m.publish.schedule
  const range = normalizeScheduleRange(rangeProp)
  const [now, setNow] = useState(() => Date.now())
  const [date, setDate] = useState<string>()
  const [time, setTime] = useState<string>()
  const [invalid, setInvalid] = useState(false)
  const limits = scheduleDateLimits(now, range)
  const slots = date ? scheduleTimeSlots(date, now, range) : []
  // 改选日期或刷新当前时间后原时间不可用则视为未选（派生，不在 effect 里清空）
  const validTime = slots.some((slot) => slot.value === time && !slot.disabled) ? time : undefined
  const at = date && validTime ? combineLocal(date, validTime) : undefined
  const hint = formatMessage(s.hint, {
    min: formatOffset(range.minOffsetMs, s.units),
    max: formatOffset(range.maxOffsetMs, s.units),
  })
  const message = error ?? (invalid ? hint : undefined)
  const confirm = () => {
    // 区间按点击时的当前时间判断：弹窗开着时时间仍在流逝
    const clicked = Date.now()
    const { min, max } = scheduleBounds(clicked, range)
    if (at === undefined || at < min || at > max) {
      setNow(clicked)
      setInvalid(true)
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
        <p className="ex-pub-schedule__error" role="alert">
          {message}
        </p>
      ) : (
        <p className="ex-pub-schedule__hint">{hint}</p>
      )}
      <div className="ex-pub-schedule__fields">
        <DatePicker
          className="ex-pub-schedule__date"
          label={s.dateLabel}
          placeholder={s.datePlaceholder}
          value={date}
          onChange={(next) => {
            setDate(next)
            setInvalid(false)
          }}
          min={limits?.min}
          max={limits?.max}
          disabled={!limits}
          labels={s.calendar}
        />
        <TimePicker
          className="ex-pub-schedule__time"
          listClassName="ex-pub-select-list"
          label={s.label}
          placeholder={s.timePlaceholder}
          value={validTime}
          onChange={(next) => {
            setTime(next)
            setInvalid(false)
          }}
          options={slots}
          disabled={!date}
        />
      </div>
    </Modal>
  )
}
