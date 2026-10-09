import { ClEditEngine, type EditorEngine, type RendererOptions } from '@editorx/markdown-core'
import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import { MessagesProvider, useMessages, type EditorAdapters, type EditorDocument } from '@editorx/toolbar'
import { ToastProvider, useToast } from '@editorx/ui'
import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createCommandRegistry } from './commands'
import { cx } from './cx'
import { ModeTabs } from './mode-tabs'
import { useEditorRuntime } from './runtime'
import { createEditorStore } from './store'
import type { MarkdownEditorProps } from './types'
import { observeFailedPlaceholders } from './uploads/failed-marker'
import { UploadFailures } from './uploads/upload-failures'
import { createUploader, imageFiles } from './uploads/uploader'
import { useControllableState } from './use-controllable'
import { useLatest } from './use-latest'

const createDefaultEngine = (): EditorEngine => new ClEditEngine()
const NO_RENDERER_OPTIONS: RendererOptions = {}
const NO_ADAPTERS: EditorAdapters = {}

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
  // 只在首次渲染决定是否自建主题：树形状切换会重建 EditorShell（新引擎，内容与撤销丢失）
  const [ownTheme] = useState(() => !outer || theme !== undefined || defaultTheme !== undefined)
  const content = (
    <MessagesProvider messages={locale}>
      <LocalizedToasts>
        <EditorShell {...props} />
      </LocalizedToasts>
    </MessagesProvider>
  )
  if (!ownTheme) return content
  return (
    <ThemeProvider
      theme={theme}
      defaultTheme={defaultTheme}
      onThemeChange={onThemeChange}
      storageKey={themeStorageKey}
      className="ex-mde-theme"
    >
      {content}
    </ThemeProvider>
  )
}

function EditorShell({
  value,
  defaultValue = '',
  onChange,
  title = '',
  adapters = NO_ADAPTERS,
  viewMode: viewModeProp,
  defaultViewMode = 'split',
  onViewModeChange,
  readOnly = false,
  placeholder,
  ariaLabel,
  height = '100%',
  engine: engineFactory,
  slots,
  className,
  ref,
}: MarkdownEditorProps) {
  const messages = useMessages()
  const { resolved, ready } = useTheme()
  const [engine] = useState(() => (engineFactory ?? createDefaultEngine)())
  const [store] = useState(() => createEditorStore())
  const [commands] = useState(() => createCommandRegistry(engine))
  const [viewMode, setViewMode] = useControllableState(viewModeProp, defaultViewMode, onViewModeChange)
  const hostRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const titleRef = useLatest(title)
  const { notify } = useToast()
  const live = useLatest({ adapters, messages, notify, readOnly })
  const [uploader] = useState(() =>
    createUploader({
      engine,
      store,
      getAdapters: () => live.current.adapters,
      getMessages: () => live.current.messages,
      notify: (message, type) => live.current.notify(message, type),
      isReadOnly: () => live.current.readOnly,
    }),
  )

  const runtime = useEditorRuntime({
    engine,
    store,
    hostRef,
    previewScrollRef,
    previewRef,
    initialValue: defaultValue,
    value,
    readOnly,
    placeholder,
    ariaLabel: ariaLabel ?? messages.editor.ariaLabel,
    viewMode,
    theme: resolved,
    themeReady: ready,
    rendererOptions: NO_RENDERER_OPTIONS,
    onChange,
  })

  useEffect(() => {
    const detach = uploader.attach(hostRef.current)
    const unmark = previewRef.current
      ? observeFailedPlaceholders(previewRef.current, () => live.current.messages.upload.failed)
      : () => {}
    const take = (files: FileList | null | undefined, e: Event) => {
      const images = imageFiles(files)
      if (images.length === 0 || !live.current.adapters.uploadImage) return
      e.preventDefault()
      void uploader.upload(images)
    }
    const offPaste = engine.on('paste', (e) => {
      // Office 复制会在文本之外附带整块截图：有文本时按文本粘贴
      if ((e.clipboardData?.getData('text/plain') ?? '').trim() !== '') return
      take(e.clipboardData?.files, e)
    })
    const offDrop = engine.on('drop', (e) => take(e.dataTransfer?.files, e))
    return () => {
      offPaste()
      offDrop()
      unmark()
      detach()
    }
  }, [engine, uploader, live])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => engine.focus(),
      getValue: () => engine.getValue(),
      setValue: (markdown) => runtime.setValue(markdown),
      getHtml: () => runtime.getRenderer().render(engine.getValue()).html,
      getDocument: (): EditorDocument => {
        const markdown = engine.getValue()
        return { editorType: 'markdown', title: titleRef.current, markdown, html: runtime.getRenderer().render(markdown).html }
      },
      runCommand: (name, args) => commands.run(name, args),
      getEngine: () => engine,
    }),
    [engine, runtime, commands, titleRef],
  )

  const style = { '--ex-mde-height': typeof height === 'number' ? `${height}px` : height } as CSSProperties

  return (
    <div className={cx('ex-mde', className)} data-view={viewMode} data-readonly={readOnly || undefined} style={style}>
      <div className="ex-mde-main">
        <div className="ex-mde-header">
          <ModeTabs value={viewMode} onChange={setViewMode} />
          {slots?.headerEnd && <div className="ex-mde-header__end">{slots.headerEnd}</div>}
        </div>
        <div className="ex-mde-body">
          <div ref={hostRef} className="ex-mde-editor" hidden={viewMode === 'preview'} />
          <div ref={previewScrollRef} className="ex-mde-preview-pane" hidden={viewMode === 'edit'}>
            <div ref={previewRef} className="ex-preview ex-mde-preview" aria-label={messages.editor.previewLabel} />
          </div>
        </div>
        <UploadFailures
          store={store}
          readOnly={readOnly}
          onRetry={(id) => void uploader.retry(id)}
          onRemove={uploader.remove}
          onEmptied={() => engine.focus()}
        />
      </div>
    </div>
  )
}
