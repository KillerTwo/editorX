import { MarkdownEditor, type MarkdownEditorHandle } from '@editorx/markdown'
import { createSettings, PublishPanel } from '@editorx/publish'
import { RichTextEditor, type RichTextEditorHandle } from '@editorx/rich-text'
import { ThemeProvider } from '@editorx/theme'
import {
  formatMessage,
  MessagesProvider,
  useMessages,
  type EditorAdapters,
  type EditorDocument,
  type EditorExtension,
  type EditorType,
} from '@editorx/toolbar'
import { ToastProvider, useToast } from '@editorx/ui'
import { useCallback, useImperativeHandle, useRef, useState } from 'react'
import { cx } from './cx'
import { submitPublish } from './submit-publish'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

const NO_EXTENSIONS: readonly EditorExtension[] = []
const EMPTY_ADAPTERS: EditorAdapters = {}

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
  adapters: adaptersProp,
  initialSettings,
  slots,
  ref,
}: CsdnEditorProps) {
  const editorType: EditorType = defaultEditor ?? initialDocument?.editorType ?? 'markdown'
  const [title, setTitle] = useState(initialDocument?.title ?? '')
  const [markdown, setMarkdown] = useState(initialDocument?.markdown ?? '')
  const [html, setHtml] = useState(initialDocument?.html ?? '')
  const markdownRef = useRef<MarkdownEditorHandle>(null)
  const richRef = useRef<RichTextEditorHandle>(null)
  const messages = useMessages()
  const { notify } = useToast()
  const adapters = adaptersProp ?? EMPTY_ADAPTERS
  const [settings, setSettings] = useState(() => createSettings(initialSettings))
  const [words, setWords] = useState(0)
  const publishing = useRef(false)

  const readDocument = useCallback((): EditorDocument => {
    if (editorType === 'markdown') {
      const live = markdownRef.current?.getDocument()
      if (live) return { ...live, title }
      return { editorType: 'markdown', title, markdown, html }
    }
    return { editorType: 'richtext', title, html, markdown: undefined }
  }, [editorType, title, markdown, html])

  useImperativeHandle(ref, () => ({ getDocument: readDocument }), [readDocument])

  const publish = () => {
    if (publishing.current) return
    publishing.current = true
    void submitPublish({
      document: readDocument(),
      settings,
      adapters,
      notify,
      messages: messages.publish,
    }).finally(() => {
      publishing.current = false
    })
  }

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
        onPublish={publish}
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
            onWordCount={setWords}
            slots={{
              afterPaper: (
                <PublishPanel
                  value={settings}
                  onChange={setSettings}
                  document={readDocument()}
                  adapters={adapters}
                  barPosition="fixed"
                  slots={{
                    barStart: (
                      <>
                        <span className="ex-csdn-words">{formatMessage(messages.richText.words, { n: words })}</span>
                        {slots?.publishBarStart}
                      </>
                    ),
                  }}
                />
              ),
            }}
          />
        )}
      </div>
    </div>
  )
}
