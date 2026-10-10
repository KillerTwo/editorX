import { formatMessage, useMessages } from '@editorx/toolbar'
import { Fragment, type ReactNode } from 'react'
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

  const md = [
    s.markdown,
    `${stats?.mdChars ?? 0} ${s.words}`,
    `${stats?.lines ?? 2} ${s.lines}`,
    `${s.line} ${cursor.line}, ${s.column} ${cursor.column}`,
  ]
  const html = [s.html, `${stats?.htmlChars ?? 0} ${s.words}`, `${stats?.paragraphs ?? 0} ${s.paragraphs}`]
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
        {viewMode !== 'preview' && <StatGroups className="ex-mde-status__md" items={md} />}
        <StatGroups className="ex-mde-status__html" items={html} />
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

/** 组间留空格文本节点（textContent 与读屏不变）；flex 容器不渲染纯空白文本，组距由 gap 给出（G09） */
function StatGroups({ className, items }: { className: string; items: readonly string[] }) {
  return (
    <div className={className}>
      {items.map((text, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          <span>{text}</span>
        </Fragment>
      ))}
    </div>
  )
}
