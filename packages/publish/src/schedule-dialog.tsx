import { useMessages } from '@editorx/toolbar'
import { Button, Modal } from '@editorx/ui'
import { useId, useState } from 'react'
import { defaultScheduleTime, fromLocalInputValue, toLocalInputValue } from './schedule'

export interface ScheduleDialogProps {
  error?: string
  /** 定时发布请求进行中 */
  busy?: boolean
  onCancel(): void
  onConfirm(iso: string): void
}

/** 只在打开时挂载：初始时间在挂载时（客户端）计算 */
export function ScheduleDialog({ error, busy = false, onCancel, onConfirm }: ScheduleDialogProps) {
  const m = useMessages()
  const s = m.publish.schedule
  const inputId = useId()
  const [value, setValue] = useState(() => toLocalInputValue(defaultScheduleTime(Date.now())))
  const [min] = useState(() => toLocalInputValue(new Date()))
  const iso = fromLocalInputValue(value)
  return (
    <Modal
      open
      onClose={onCancel}
      title={s.title}
      width={400}
      className="ex-pub-schedule"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button onClick={onCancel}>{m.publish.actions.cancel}</Button>
          <Button variant="primary" disabled={!iso} loading={busy} onClick={() => iso && onConfirm(iso)}>
            {s.confirm}
          </Button>
        </>
      }
    >
      <label className="ex-pub-schedule__label" htmlFor={inputId}>
        {s.label}
      </label>
      <input
        id={inputId}
        className="ex-pub-input ex-pub-schedule__input"
        type="datetime-local"
        value={value}
        min={min}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${inputId}-hint`}
        onChange={(e) => setValue(e.target.value)}
      />
      <p id={`${inputId}-hint`} className={error ? 'ex-pub-schedule__error' : 'ex-pub-schedule__hint'}>
        {error ?? s.hint}
      </p>
    </Modal>
  )
}
