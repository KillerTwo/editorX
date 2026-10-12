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
import { Button, Modal, ToastProvider, useToast } from '@editorx/ui'
import { useCallback, useImperativeHandle, useRef, useState } from 'react'
import { cx } from './cx'
import { submitPublish } from './submit-publish'
import { switchedDocument } from './switch-document'
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
  onEditorTypeChange,
  adapters: adaptersProp,
  initialSettings,
  slots,
  ref,
}: CsdnEditorProps) {
  const [editorType, setEditorType] = useState<EditorType>(defaultEditor ?? initialDocument?.editorType ?? 'markdown')
  const [mountKey, setMountKey] = useState(0)
  const [switchOpen, setSwitchOpen] = useState(false)
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

  const confirmSwitch = () => {
    const next = switchedDocument(readDocument())
    setTitle(next.title)
    setMarkdown(next.markdown ?? '')
    setHtml(next.html)
    setEditorType(next.editorType)
    setMountKey((key) => key + 1)
    setSwitchOpen(false)
    onEditorTypeChange?.(next.editorType)
  }

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
        onSwitch={() => setSwitchOpen(true)}
        onPublish={publish}
      />
      <div className="ex-csdn__editor">
        {editorType === 'markdown' ? (
          <MarkdownEditor
            key={`${editorType}:${mountKey}`}
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
            key={`${editorType}:${mountKey}`}
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
      <Modal
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        title="切换编辑器"
        footer={
          <>
            <Button type="button" onClick={() => setSwitchOpen(false)}>
              {messages.dialog.cancel}
            </Button>
            <Button type="button" variant="primary" onClick={confirmSwitch}>
              {messages.dialog.confirm}
            </Button>
          </>
        }
      >
        {editorType === 'markdown'
          ? '切换后将用当前 HTML 打开富文本编辑器。'
          : '切换后将把 HTML 转成 Markdown，部分格式会丢失。'}
      </Modal>
    </div>
  )
}
