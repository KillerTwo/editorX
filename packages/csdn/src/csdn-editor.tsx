import { ThemeProvider } from '@editorx/theme'
import { MessagesProvider, type EditorDocument, type EditorType } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useImperativeHandle, useState } from 'react'
import { cx } from './cx'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

export function CsdnEditor(props: CsdnEditorProps) {
  return (
    <ThemeProvider
      theme={props.theme}
      defaultTheme={props.defaultTheme}
      onThemeChange={props.onThemeChange}
      storageKey="editorx-csdn-theme"
      className="ex-csdn-theme"
    >
      <MessagesProvider messages={props.locale}>
        <ToastProvider>
          <CsdnEditorShell {...props} />
        </ToastProvider>
      </MessagesProvider>
    </ThemeProvider>
  )
}

function CsdnEditorShell({
  className,
  onBack,
  showThemeToggle = true,
  initialDocument,
  defaultEditor,
  ref,
}: CsdnEditorProps) {
  const editorType: EditorType = defaultEditor ?? initialDocument?.editorType ?? 'markdown'
  const [title, setTitle] = useState(initialDocument?.title ?? '')
  const document: EditorDocument = {
    editorType,
    title,
    html: initialDocument?.html ?? '',
    ...(editorType === 'markdown' ? { markdown: initialDocument?.markdown ?? '' } : { markdown: undefined }),
  }
  useImperativeHandle(ref, () => ({ getDocument: () => document }), [document])
  return (
    <div className={cx('ex-csdn', className)} data-editor={editorType}>
      <TopBar
        editorType={editorType}
        title={title}
        onTitleChange={setTitle}
        onBack={onBack}
        showThemeToggle={showThemeToggle}
        onSaveDraft={() => undefined}
        onSwitch={() => undefined}
        onPublish={() => undefined}
      />
    </div>
  )
}
