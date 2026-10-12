import { ThemeProvider } from '@editorx/theme'
import type { EditorDocument } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useImperativeHandle } from 'react'
import { cx } from './cx'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

const EMPTY_DOCUMENT: EditorDocument = { editorType: 'markdown', title: '', html: '', markdown: '' }

export function CsdnEditor(props: CsdnEditorProps) {
  return (
    <ThemeProvider
      theme={props.theme}
      defaultTheme={props.defaultTheme}
      onThemeChange={props.onThemeChange}
      storageKey="editorx-csdn-theme"
      className="ex-csdn-theme"
    >
      <ToastProvider>
        <CsdnEditorShell {...props} />
      </ToastProvider>
    </ThemeProvider>
  )
}

function CsdnEditorShell({ className, onBack, showThemeToggle = true, ref }: CsdnEditorProps) {
  useImperativeHandle(ref, () => ({ getDocument: () => EMPTY_DOCUMENT }), [])
  return (
    <div className={cx('ex-csdn', className)} data-editor="markdown">
      <TopBar
        onBack={onBack}
        showThemeToggle={showThemeToggle}
        onSaveDraft={() => undefined}
        onSwitch={() => undefined}
        onPublish={() => undefined}
      />
    </div>
  )
}
