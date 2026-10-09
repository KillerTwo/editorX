import { formatMessage, useMessages } from '@editorx/toolbar'
import { CircleAlert } from 'lucide-react'
import { useEditorState, type EditorStore } from '../store'

export function UploadFailures({
  store,
  onRetry,
  onRemove,
}: {
  store: EditorStore
  onRetry(id: string): void
  onRemove(id: string): void
}) {
  const m = useMessages()
  const uploads = useEditorState(store, (s) => s.uploads)
  if (uploads.length === 0) return null
  return (
    <ul className="ex-mde-uploads" aria-label={m.upload.failedList}>
      {uploads.map((upload) => (
        <li key={upload.id} className="ex-mde-uploads__item">
          <CircleAlert size={14} aria-hidden="true" />
          <span className="ex-mde-uploads__name">{formatMessage(m.upload.failedItem, { name: upload.name })}</span>
          <button type="button" className="ex-mde-uploads__action" onClick={() => onRetry(upload.id)}>
            {m.upload.retry}
          </button>
          <button type="button" className="ex-mde-uploads__action" onClick={() => onRemove(upload.id)}>
            {m.upload.remove}
          </button>
        </li>
      ))}
    </ul>
  )
}
