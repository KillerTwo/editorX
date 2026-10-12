import { Button, ThemeToggle } from '@editorx/ui'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'

export interface TopBarProps {
  onBack?: () => void
  onSaveDraft: () => void
  onSwitch: () => void
  onPublish: () => void
  showThemeToggle: boolean
}

export function TopBar({ onBack, onSaveDraft, onSwitch, onPublish, showThemeToggle }: TopBarProps) {
  return (
    <header className="ex-csdn__bar">
      <Button type="button" variant="text" className="ex-csdn__back" onClick={() => onBack?.()}>
        <ArrowLeft size={16} aria-hidden="true" />
        返回
      </Button>
      <div className="ex-csdn__spacer" />
      <div className="ex-csdn__actions">
        <Button type="button" className="ex-csdn__draft" onClick={onSaveDraft}>
          保存草稿
        </Button>
        {showThemeToggle ? <ThemeToggle /> : null}
        <Button type="button" variant="text" className="ex-csdn__switch" onClick={onSwitch}>
          <ArrowLeftRight size={16} aria-hidden="true" />
          切换编辑器
        </Button>
        <Button type="button" variant="primary" className="ex-csdn__publish" onClick={onPublish}>
          发布
        </Button>
      </div>
    </header>
  )
}
