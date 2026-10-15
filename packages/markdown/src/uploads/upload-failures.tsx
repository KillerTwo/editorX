import { formatMessage, useMessages } from '@geekx/toolbar'
import { CircleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useEditorState, type EditorStore } from '../store'
import { useLatest } from '../use-latest'

type Action = 'retry' | 'remove'

export function UploadFailures({
  store,
  readOnly = false,
  onRetry,
  onRemove,
  onEmptied,
}: {
  store: EditorStore
  readOnly?: boolean
  onRetry(id: string): void
  onRemove(id: string): void
  /** 操作移除了最后一行时调用，用于把焦点还给编辑区 */
  onEmptied?(): void
}) {
  const m = useMessages()
  const uploads = useEditorState(store, (s) => s.uploads)
  const listRef = useRef<HTMLUListElement>(null)
  const pendingFocus = useRef<{ id: string; index: number; action: Action } | null>(null)
  const onEmptiedRef = useLatest(onEmptied)

  useEffect(() => {
    const pending = pendingFocus.current
    pendingFocus.current = null
    if (!pending || uploads.some((u) => u.id === pending.id)) return
    if (uploads.length === 0) {
      onEmptiedRef.current?.()
      return
    }
    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(`[data-action="${pending.action}"]`)
    rows?.[Math.min(pending.index, rows.length - 1)]?.focus()
  }, [uploads, onEmptiedRef])

  if (uploads.length === 0) return null
  const act = (action: Action, id: string, index: number) => {
    pendingFocus.current = { id, index, action }
    if (action === 'retry') onRetry(id)
    else onRemove(id)
  }
  return (
    <ul ref={listRef} className="ex-mde-uploads" aria-label={m.upload.failedList}>
      {uploads.map((upload, index) => (
        <li key={upload.id} className="ex-mde-uploads__item">
          <CircleAlert size={14} aria-hidden="true" />
          <span className="ex-mde-uploads__name">{formatMessage(m.upload.failedItem, { name: upload.name })}</span>
          <button
            type="button"
            className="ex-mde-uploads__action"
            data-action="retry"
            aria-label={formatMessage(m.upload.retryItem, { name: upload.name })}
            disabled={readOnly}
            onClick={() => act('retry', upload.id, index)}
          >
            {m.upload.retry}
          </button>
          <button
            type="button"
            className="ex-mde-uploads__action"
            data-action="remove"
            aria-label={formatMessage(m.upload.removeItem, { name: upload.name })}
            disabled={readOnly}
            onClick={() => act('remove', upload.id, index)}
          >
            {m.upload.remove}
          </button>
        </li>
      ))}
    </ul>
  )
}
