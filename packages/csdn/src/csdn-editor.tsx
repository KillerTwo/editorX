import { MarkdownEditor, type MarkdownEditorHandle } from '@editorx/markdown'
import { RichTextEditor, type RichTextEditorHandle } from '@editorx/rich-text'
import { ThemeProvider } from '@editorx/theme'
import { MessagesProvider, type EditorDocument, type EditorExtension, type EditorType } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useCallback, useImperativeHandle, useRef, useState } from 'react'
import { cx } from './cx'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

const NO_EXTENSIONS: readonly EditorExtension[] = []

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
  extensions = NO_EXTENSIONS,
  toolbarLayout,
  defaultRightOpen,
  defaultTocOpen,
  ref,
}: CsdnEditorProps) {
  const editorType: EditorType = defaultEditor ?? initialDocument?.editorType ?? 'markdown'
  const [title, setTitle] = useState(initialDocument?.title ?? '')
  const [markdown, setMarkdown] = useState(initialDocument?.markdown ?? '')
  const [html, setHtml] = useState(initialDocument?.html ?? '')
  const markdownRef = useRef<MarkdownEditorHandle>(null)
  const richRef = useRef<RichTextEditorHandle>(null)

  const readDocument = useCallback((): EditorDocument => {
    if (editorType === 'markdown') {
      const live = markdownRef.current?.getDocument()
      if (live) return { ...live, title }
      return { editorType: 'markdown', title, markdown, html }
    }
    return { editorType: 'richtext', title, html, markdown: undefined }
  }, [editorType, title, markdown, html])

  useImperativeHandle(ref, () => ({ getDocument: readDocument }), [readDocument])

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
      <div className="ex-csdn__editor">
        {editorType === 'markdown' ? (
          <MarkdownEditor
            ref={markdownRef}
            defaultValue={markdown}
            title={title}
            extensions={extensions}
            toolbarLayout={toolbarLayout}
            height="100%"
            onChange={(nextMarkdown, nextHtml) => {
              setMarkdown(nextMarkdown)
              setHtml(nextHtml)
            }}
          />
        ) : (
          <RichTextEditor
            ref={richRef}
            defaultValue={html}
            title={title}
            onTitleChange={setTitle}
            extensions={extensions}
            toolbarLayout={toolbarLayout}
            defaultRightOpen={defaultRightOpen}
            defaultTocOpen={defaultTocOpen}
            height="100%"
            onChange={setHtml}
          />
        )}
      </div>
    </div>
  )
}
