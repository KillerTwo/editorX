import { MarkdownEditor, type MarkdownEditorHandle } from '@editorx/markdown'
import { createSettings, PublishPanel } from '@editorx/publish'
import { RichTextEditor, type RichTextEditorHandle } from '@editorx/rich-text'
import { ThemeProvider } from '@editorx/theme'
import {
  errorMessage,
  formatMessage,
  MessagesProvider,
  useMessages,
  type EditorAdapters,
  type EditorDocument,
  type EditorExtension,
  type EditorType,
  type PublishSettings,
} from '@editorx/toolbar'
import { Button, Modal, ToastProvider, useToast } from '@editorx/ui'
import { useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react'
import { cx } from './cx'
import {
  DRAFT_STORAGE_KEY,
  MAX_TIMER_DELAY,
  draftFingerprint,
  readDraftBackup,
  shouldPromptRestore,
  writeDraftBackup,
  type CsdnDraftBackup,
} from './draft-backup'
import { submitPublish } from './submit-publish'
import { switchedDocument } from './switch-document'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

const NO_EXTENSIONS: readonly EditorExtension[] = []
const EMPTY_ADAPTERS: EditorAdapters = {}

function subscribeDraftStore(): () => void {
  return () => {}
}

function serverDraftSnapshot(): CsdnDraftBackup | null {
  return null
}

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
  autoSaveInterval,
  initialUpdatedAt,
  draftStorageKey,
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
  const draftKey = draftStorageKey ?? DRAFT_STORAGE_KEY
  const seed = useRef<{ doc: EditorDocument; settings: PublishSettings } | null>(null)
  if (seed.current === null) {
    seed.current = {
      doc: {
        editorType: defaultEditor ?? initialDocument?.editorType ?? 'markdown',
        title: initialDocument?.title ?? '',
        html: initialDocument?.html ?? '',
        markdown: initialDocument?.markdown ?? '',
      },
      settings,
    }
  }
  const [restoreClosed, setRestoreClosed] = useState(false)
  const draftKeyRef = useRef(draftKey)
  draftKeyRef.current = draftKey
  const draftCache = useRef<{ key: string; value: CsdnDraftBackup | null } | null>(null)
  const readStoredDraft = useCallback(() => {
    const key = draftKeyRef.current
    if (draftCache.current === null || draftCache.current.key !== key) {
      draftCache.current = { key, value: readDraftBackup(window.localStorage, key) }
    }
    return draftCache.current.value
  }, [])
  const storedDraft = useSyncExternalStore(subscribeDraftStore, readStoredDraft, serverDraftSnapshot)
  const offer =
    restoreClosed || !storedDraft || !seed.current
      ? null
      : shouldPromptRestore(storedDraft, initialUpdatedAt ?? 0, seed.current.doc, seed.current.settings)
        ? storedDraft
        : null
  const savedFingerprint = useRef<string | null>(null)
  if (savedFingerprint.current === null && seed.current) {
    savedFingerprint.current = draftFingerprint(seed.current.doc, seed.current.settings)
  }
  const errorShown = useRef(false)
  const flight = useRef<Promise<boolean> | null>(null)
  const trailing = useRef<Promise<boolean> | null>(null)
  const trailingForce = useRef(false)
  const [saveVersion, setSaveVersion] = useState(0)
  const [words, setWords] = useState(0)
  const publishing = useRef(false)

  const readDocument = useCallback((): EditorDocument => {
    if (editorType === 'markdown') {
      const fromEditor = markdownRef.current?.getDocument()
      if (fromEditor) return { ...fromEditor, title }
      return { editorType: 'markdown', title, markdown, html }
    }
    return { editorType: 'richtext', title, html, markdown: undefined }
  }, [editorType, title, markdown, html])

  const live = useRef({ readDocument, settings, adapters, notify, messages, offer, draftKey })
  live.current = { readDocument, settings, adapters, notify, messages, offer, draftKey }

  const persist = useCallback((force: boolean): Promise<boolean> => {
    if (flight.current) {
      trailingForce.current ||= force
      trailing.current ??= flight.current.then(follow, follow)
      return trailing.current
    }

    let resolve!: (saved: boolean) => void
    let reject!: (reason: unknown) => void
    const job = new Promise<boolean>((res, rej) => {
      resolve = res
      reject = rej
    })
    const settled = job.finally(() => {
      flight.current = null
    })
    flight.current = settled
    void (async () => {
      try {
        resolve(await saveOnce(force))
      } catch (error) {
        reject(error)
      }
    })()
    return settled

    function follow(): Promise<boolean> {
      const nextForce = trailingForce.current
      trailing.current = null
      trailingForce.current = false
      return persist(nextForce)
    }

    async function saveOnce(nextForce: boolean): Promise<boolean> {
      const current = live.current
      if (current.offer) return false
      const doc = current.readDocument()
      const fingerprint = draftFingerprint(doc, current.settings)
      if (!nextForce && fingerprint === savedFingerprint.current) return true
      writeDraftBackup(
        window.localStorage,
        { document: doc, settings: current.settings, updatedAt: Date.now() },
        current.draftKey,
      )
      const adapter = current.adapters.onSaveDraft
      if (!adapter) return false
      try {
        await adapter(doc, current.settings)
      } catch (error) {
        if (nextForce || !errorShown.current) {
          current.notify(formatMessage(current.messages.publish.errors.saveDraft, { message: errorMessage(error) }), 'error')
          errorShown.current = true
        }
        setSaveVersion((version) => version + 1)
        return false
      }
      savedFingerprint.current = fingerprint
      errorShown.current = false
      setSaveVersion((version) => version + 1)
      if (nextForce) current.notify(current.messages.publish.status.draftSaved, 'success')
      return true
    }
  }, [])

  useEffect(() => {
    const interval = autoSaveInterval
    if (!(typeof interval === 'number' && interval > 0 && interval <= MAX_TIMER_DELAY)) return
    const timer = window.setInterval(() => {
      void persist(false)
    }, interval)
    return () => window.clearInterval(timer)
  }, [autoSaveInterval, persist])

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

  useImperativeHandle(
    ref,
    () => ({
      getDocument: readDocument,
      getSettings: () => live.current.settings,
      saveDraft: () => persist(true),
    }),
    [readDocument, persist],
  )

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

  void saveVersion
  const dirty = draftFingerprint(readDocument(), settings) !== savedFingerprint.current

  return (
    <div className={cx('ex-csdn', className)} data-editor={editorType} data-dirty={dirty ? 'true' : 'false'}>
      <TopBar
        editorType={editorType}
        title={title}
        onTitleChange={setTitle}
        onBack={onBack}
        showThemeToggle={showThemeToggle}
        actionsDisabled={offer !== null}
        onSaveDraft={() => {
          void persist(true)
        }}
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
              rightCollapsed: slots?.rightCollapsed,
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
      <Modal
        open={offer !== null}
        onClose={() => setRestoreClosed(true)}
        title="恢复本地草稿"
        closeOnMaskClick={false}
        footer={
          <>
            <Button type="button" onClick={() => setRestoreClosed(true)}>
              {messages.dialog.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (!offer) return
                const next = offer.document
                setTitle(next.title)
                setMarkdown(next.markdown ?? '')
                setHtml(next.html)
                setEditorType(next.editorType)
                setSettings(createSettings(offer.settings))
                setMountKey((key) => key + 1)
                setRestoreClosed(true)
                onEditorTypeChange?.(next.editorType)
              }}
            >
              恢复
            </Button>
          </>
        }
      >
        本地备份比当前文档更新。恢复会替换标题、正文和发布设置。
      </Modal>
    </div>
  )
}
