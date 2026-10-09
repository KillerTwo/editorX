import { ClEditEngine, type EditorEngine, type RendererOptions } from '@editorx/markdown-core'
import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import {
  activeExtensions,
  collectShortcuts,
  errorMessage,
  formatMessage,
  handleShortcut,
  MessagesProvider,
  resolveToolbar,
  Toolbar,
  useExtensionSetup,
  useIsMacPlatform,
  useMessages,
  useStableArray,
  type EditorAdapters,
  type EditorExtension,
} from '@editorx/toolbar'
import { ToastProvider, useToast } from '@editorx/ui'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createMarkdownContext } from './context'
import { MARKDOWN_TOOLBAR_LAYOUT, markdownCoreExtensions } from './core-extensions'
import { cx } from './cx'
import { drawDiagramsForExport } from './export-html'
import { isolateFullscreen } from './fullscreen'
import { ModeTabs } from './mode-tabs'
import { useEditorRuntime } from './runtime'
import { createEditorStore, useEditorState } from './store'
import type { MarkdownEditorProps } from './types'
import { observeFailedPlaceholders } from './uploads/failed-marker'
import { UploadFailures } from './uploads/upload-failures'
import { createUploader, imageFiles } from './uploads/uploader'
import { useControllableState } from './use-controllable'
import { useLatest } from './use-latest'

const createDefaultEngine = (): EditorEngine => new ClEditEngine()
const NO_ADAPTERS: EditorAdapters = {}
const NO_EXTENSIONS: readonly EditorExtension[] = []

/** 字面量 process.env.NODE_ENV 供打包器替换；无打包器时 process 不存在，按生产环境处理 */
function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
  // 只在首次渲染决定是否自建主题：树形状切换会重建 EditorShell（新引擎，内容与撤销丢失）
  const [ownTheme] = useState(() => !outer || theme !== undefined || defaultTheme !== undefined)
  const themeIgnored = !ownTheme && (theme !== undefined || defaultTheme !== undefined)
  const warnedRef = useRef(false)
  useEffect(() => {
    if (!themeIgnored || warnedRef.current || !isDev()) return
    warnedRef.current = true
    console.warn(
      '[editorx/markdown] 首次渲染时复用了外层 ThemeProvider，之后传入的 theme / defaultTheme 被忽略；' +
        '需要自建主题请在首次渲染时传入，或更换 key 重新挂载编辑器',
    )
  }, [themeIgnored])
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
  extensions = NO_EXTENSIONS,
  coreExtensions = markdownCoreExtensions,
  toolbarLayout = MARKDOWN_TOOLBAR_LAYOUT,
  missingAdapter = 'hide',
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
  const { notify } = useToast()
  const [engine] = useState(() => (engineFactory ?? createDefaultEngine)())
  const [store] = useState(() => createEditorStore())
  const [viewMode, setViewMode] = useControllableState(viewModeProp, defaultViewMode, onViewModeChange)
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const live = useLatest({ adapters, messages, notify, title, readOnly, theme: resolved })

  const allExtensions = useStableArray(useMemo(() => [...coreExtensions, ...extensions], [coreExtensions, extensions]))
  /** 同名替换与 editors 过滤后的扩展；setup、embeds、工具栏、快捷键都只看它 */
  const active = useMemo(() => activeExtensions(allExtensions, 'markdown'), [allExtensions])
  const embeds = useMemo(() => active.flatMap((ext) => ext.embeds ?? []), [active])
  const rendererOptions = useMemo<RendererOptions>(() => ({ embeds }), [embeds])

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
    rendererOptions,
    onChange,
  })

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

  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const [ctx] = useState(() =>
    createMarkdownContext({
      engine,
      store,
      getRenderer: () => runtime.getRenderer(),
      getAdapters: () => live.current.adapters,
      getTitle: () => live.current.title,
      getTheme: () => live.current.theme,
      getMessages: () => live.current.messages,
      isReadOnly: () => live.current.readOnly,
      notify: (message, type) => live.current.notify(message, type),
      uploadImages: (files) => uploader.upload(files),
      getLiveHtml: () => previewRef.current?.innerHTML || runtime.getRenderer().render(engine.getValue()).html,
      // 编辑视图下预览不画图表：在离屏副本上补画，已绘制的块（同主题）直接沿用
      renderExportHtml: async () => {
        await runtime.flush()
        const html = previewRef.current?.innerHTML || runtime.getRenderer().render(engine.getValue()).html
        return drawDiagramsForExport(html, live.current.theme)
      },
      isMounted: () => mountedRef.current,
    }),
  )

  const reportError = useCallback(
    (name: string, error: unknown) => {
      console.error(error)
      const m = live.current.messages
      live.current.notify(formatMessage(m.errors.extension, { name, message: errorMessage(error) }), 'error')
    },
    [live],
  )
  useExtensionSetup(active, ctx, reportError)

  const resolveOptions = useMemo(
    () => ({ editorType: 'markdown' as const, adapters, missingAdapter }),
    [adapters, missingAdapter],
  )
  const groups = useMemo(() => resolveToolbar(active, toolbarLayout, resolveOptions), [active, toolbarLayout, resolveOptions])
  const shortcuts = useMemo(() => collectShortcuts(active, resolveOptions), [active, resolveOptions])
  const mac = useIsMacPlatform()

  const formatsKey = useEditorState(store, (s) => s.formatsKey)
  const panel = useEditorState(store, (s) => s.panel)
  const fullscreen = useEditorState(store, (s) => s.fullscreen)

  useEffect(() => {
    if (!fullscreen || !rootRef.current) return
    return isolateFullscreen(rootRef.current)
  }, [fullscreen])

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
      getDocument: () => ctx.getDocument(),
      runCommand: (name, args) => ctx.commands.run(name, args),
      insert: (content) => ctx.insert(content),
      getEngine: () => engine,
    }),
    [engine, runtime, ctx],
  )

  // React 合成事件会穿过 portal 冒泡；只处理 DOM 上位于编辑器内部的按键
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as Node
    if (!rootRef.current?.contains(target)) return
    if (e.key === 'Escape' && store.get().fullscreen && !e.nativeEvent.isComposing) {
      store.set({ fullscreen: false })
      return
    }
    if (!hostRef.current?.contains(target)) return
    handleShortcut(e.nativeEvent, shortcuts, ctx, mac, reportError)
  }

  const style = { '--ex-mde-height': typeof height === 'number' ? `${height}px` : height } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={cx('ex-mde', className)}
      data-view={viewMode}
      data-readonly={readOnly || undefined}
      data-fullscreen={fullscreen || undefined}
      style={style}
      onKeyDown={onKeyDown}
    >
      <div className="ex-mde-main">
        <div className="ex-mde-header">
          <ModeTabs value={viewMode} onChange={setViewMode} />
          {slots?.headerEnd && <div className="ex-mde-header__end">{slots.headerEnd}</div>}
        </div>
        <Toolbar
          className="ex-mde-toolbar"
          groups={groups}
          ctx={ctx}
          readOnly={readOnly}
          stateKey={`${formatsKey}|${panel ?? ''}|${fullscreen}`}
          onError={reportError}
        />
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
