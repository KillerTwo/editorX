import { useMessages } from '@editorx/toolbar'
import { LocateIcon, SyncScrollIcon } from './icons'

export interface SyncControlsProps {
  enabled: boolean
  onLocate(): void
  onToggle(): void
}

/** 比对模式预览区左下的「定位 / 同步滚动」按钮（只有图标，文案用作 aria-label 与 title） */
export function SyncControls({ enabled, onLocate, onToggle }: SyncControlsProps) {
  const m = useMessages()
  return (
    <div className="ex-mde-sync">
      <button type="button" className="ex-mde-sync__locate" aria-label={m.editor.syncLocate} title={m.editor.syncLocate} onClick={onLocate}>
        <LocateIcon />
      </button>
      <button
        type="button"
        className="ex-mde-sync__scroll"
        aria-label={m.editor.syncScroll}
        title={m.editor.syncScroll}
        aria-pressed={enabled}
        onClick={onToggle}
      >
        <SyncScrollIcon />
      </button>
    </div>
  )
}
