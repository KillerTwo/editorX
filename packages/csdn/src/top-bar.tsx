import { titleCounter } from '@geekx/rich-text'
import type { EditorType } from '@geekx/toolbar'
import { useMessages } from '@geekx/toolbar'
import { Button, ThemeToggle } from '@geekx/ui'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { cx } from './cx'

export interface TopBarProps {
  editorType: EditorType
  title: string
  onTitleChange: (title: string) => void
  onBack?: () => void
  onSaveDraft: () => void
  onSwitch: () => void
  onPublish: () => void
  showThemeToggle: boolean
  actionsDisabled?: boolean
}

export function TopBar({
  editorType,
  title,
  onTitleChange,
  onBack,
  onSaveDraft,
  onSwitch,
  onPublish,
  showThemeToggle,
  actionsDisabled = false,
}: TopBarProps) {
  const messages = useMessages()
  const length = Array.from(title).length
  const counter = titleCounter(length, messages.richText)
  return (
    <header className="ex-csdn__bar">
      {onBack ? (
        <Button type="button" variant="text" className="ex-csdn__back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          返回
        </Button>
      ) : null}
      {editorType === 'markdown' ? (
        <label className="ex-csdn-title">
          <input
            className="ex-csdn-title__input"
            aria-label="文章标题"
            placeholder={messages.richText.titlePlaceholder}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <span className={cx('ex-csdn-title__count', counter.over && 'is-over')}>{counter.text}</span>
        </label>
      ) : (
        <div className="ex-csdn__spacer" />
      )}
      <div className="ex-csdn__actions">
        {editorType === 'markdown' ? (
          <Button type="button" className="ex-csdn__draft" disabled={actionsDisabled} onClick={onSaveDraft}>
            保存草稿
          </Button>
        ) : null}
        {showThemeToggle ? <ThemeToggle /> : null}
        <Button type="button" variant="text" className="ex-csdn__switch" disabled={actionsDisabled} onClick={onSwitch}>
          <ArrowLeftRight size={16} aria-hidden="true" />
          切换编辑器
        </Button>
        {editorType === 'markdown' ? (
          <Button type="button" variant="primary" className="ex-csdn__publish" disabled={actionsDisabled} onClick={onPublish}>
            发布
          </Button>
        ) : null}
      </div>
    </header>
  )
}
