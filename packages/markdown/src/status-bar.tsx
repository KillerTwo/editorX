import { formatMessage, useMessages } from '@editorx/toolbar'
import type { ReactNode } from 'react'
import { useEditorState, type EditorStore } from './store'
import type { ViewMode } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function formatSavedTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 自行订阅 store：统计、光标、保存状态变化只重渲染状态栏 */
export function StatusBar({
  store,
  viewMode,
  center,
  end,
}: {
  store: EditorStore
  viewMode: ViewMode
  center?: ReactNode
  end?: ReactNode
}) {
  const { status: s } = useMessages()
  const stats = useEditorState(store, (x) => x.stats)
  const cursor = useEditorState(store, (x) => x.cursor)
  const save = useEditorState(store, (x) => x.save)

  const md = `${s.markdown} ${stats?.mdWords ?? 0} ${s.words} ${stats?.lines ?? 1} ${s.lines} ${s.line} ${cursor.line}, ${s.column} ${cursor.column}`
  const html = `${s.html} ${stats?.htmlWords ?? 0} ${s.words} ${stats?.paragraphs ?? 0} ${s.paragraphs}`
  const saveText =
    save.status === 'saving'
      ? s.saving
      : save.status === 'error'
        ? s.saveFailed
        : save.status === 'saved' && save.savedAt !== null
          ? formatMessage(s.saved, { time: formatSavedTime(save.savedAt) })
          : ''

  return (
    <div className="ex-mde-status" role="group" aria-label={s.label}>
      <div className="ex-mde-status__stats">
        {viewMode !== 'preview' && <div className="ex-mde-status__md">{md}</div>}
        <div className="ex-mde-status__html">{html}</div>
      </div>
      {center !== undefined && <div className="ex-mde-status__center">{center}</div>}
      <div className="ex-mde-status__end">
        <span className="ex-mde-status__save" aria-live="polite" aria-busy={save.status === 'saving' || undefined}>
          {saveText}
        </span>
        {end}
      </div>
    </div>
  )
}
