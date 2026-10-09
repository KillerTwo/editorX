import {
  errorMessage,
  formatMessage,
  type EditorAdapters,
  type EditorDocument,
  type Messages,
  type PublishPayload,
  type PublishSettings,
} from '@editorx/toolbar'
import type { ToastType } from '@editorx/ui'
import { useCallback, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { formatScheduleTime } from './schedule'
import { createSettings, toPayload } from './settings'
import { useLatest } from './use-latest'
import { firstError, validatePublish, type PublishErrors, type PublishField, type PublishRules } from './validate'

export type PublishBusy = 'publish' | 'draft' | null

export interface PublishControllerOptions {
  value?: PublishSettings
  defaultValue?: Partial<PublishSettings>
  onChange?: (settings: PublishSettings) => void
  document?: EditorDocument
  adapters: EditorAdapters
  rules?: PublishRules
  messages: Messages['publish']
  notify: (message: string, type?: ToastType) => void
  onPublished?: (payload: PublishPayload) => void
  /** 当前时间（ms），便于测试注入 */
  now?: () => number
}

export interface PublishController {
  settings: PublishSettings
  errors: PublishErrors
  busy: PublishBusy
  /** 每次校验失败 +1，表单据此把焦点移到第一个错误字段 */
  failedAttempts: number
  update<K extends keyof PublishSettings>(key: K, value: PublishSettings[K]): void
  publish(scheduledAt?: string): Promise<boolean>
  saveDraft(): Promise<boolean>
}

const EMPTY_DOC: EditorDocument = { editorType: 'markdown', title: '', html: '' }

const ERROR_FIELD: Partial<Record<keyof PublishSettings, PublishField>> = {
  tags: 'tags',
  cover: 'cover',
  summary: 'summary',
  sourceUrl: 'sourceUrl',
  articleType: 'sourceUrl',
  scheduledAt: 'scheduledAt',
}

export function usePublishController(options: PublishControllerOptions): PublishController {
  const { value, defaultValue } = options
  const [inner, setInner] = useState(() => createSettings(defaultValue))
  const controlled = value !== undefined
  const settings = controlled ? value : inner
  const [errors, setErrors] = useState<PublishErrors>({})
  const [busy, setBusy] = useState<PublishBusy>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const busyRef = useRef(false)
  const latest = useLatest({ ...options, controlled })
  // 本次提交后尚未渲染的设置：同一事件内的下一次 update 基于它，每次提交后回到 props/内部状态
  const pending = useRef(settings)
  useLayoutEffect(() => {
    pending.current = settings
  })

  const update = useCallback(
    <K extends keyof PublishSettings>(key: K, next: PublishSettings[K]) => {
      const patched: PublishSettings = { ...pending.current, [key]: next }
      if (key === 'articleType' && next === 'original') delete patched.sourceUrl
      pending.current = patched
      const { controlled: isControlled, onChange } = latest.current
      // 受控父组件可能忽略 onChange 而不重渲染；强制提交一次，让 pending 回到父组件的值
      if (isControlled) rerender()
      else setInner(patched)
      onChange?.(patched)
      const field = ERROR_FIELD[key]
      if (field) {
        setErrors((prev) => {
          if (!prev[field]) return prev
          const rest = { ...prev }
          delete rest[field]
          return rest
        })
      }
    },
    [latest],
  )

  const publish = useCallback(
    async (scheduledAt?: string) => {
      const { adapters, document: doc, rules, messages, notify, now = Date.now } = latest.current
      if (busyRef.current || !adapters.onPublish) return false
      const target: PublishSettings = { ...pending.current }
      if (scheduledAt === undefined) delete target.scheduledAt
      else target.scheduledAt = scheduledAt
      const found = validatePublish(target, { messages, now: now(), title: doc?.title }, rules)
      const first = firstError(found)
      if (first) {
        setErrors(found)
        setFailedAttempts((n) => n + 1)
        notify(first.message, 'error')
        return false
      }
      setErrors({})
      busyRef.current = true
      setBusy('publish')
      const payload = toPayload(doc ?? EMPTY_DOC, target)
      try {
        await adapters.onPublish(payload)
      } catch (error) {
        notify(formatMessage(messages.errors.publish, { message: errorMessage(error) }), 'error')
        return false
      } finally {
        busyRef.current = false
        setBusy(null)
      }
      notify(
        scheduledAt
          ? formatMessage(messages.status.scheduled, { time: formatScheduleTime(scheduledAt) })
          : messages.status.published,
        'success',
      )
      // 文章已发布：onPublished 的异常原样抛给调用方，不当作发布失败
      latest.current.onPublished?.(payload)
      return true
    },
    [latest],
  )

  const saveDraft = useCallback(async () => {
    const { adapters, document: doc, messages, notify } = latest.current
    if (busyRef.current || !adapters.onSaveDraft) return false
    busyRef.current = true
    setBusy('draft')
    try {
      await adapters.onSaveDraft(doc ?? EMPTY_DOC, pending.current)
    } catch (error) {
      notify(formatMessage(messages.errors.saveDraft, { message: errorMessage(error) }), 'error')
      return false
    } finally {
      busyRef.current = false
      setBusy(null)
    }
    notify(messages.status.draftSaved, 'success')
    return true
  }, [latest])

  return { settings, errors, busy, failedAttempts, update, publish, saveDraft }
}
