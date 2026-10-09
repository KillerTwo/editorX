import { ClEditEngine, type EditorEngine, type RendererOptions } from '@editorx/markdown-core'
import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import { MessagesProvider, useMessages, type EditorDocument } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createCommandRegistry } from './commands'
import { cx } from './cx'
import { ModeTabs } from './mode-tabs'
import { useEditorRuntime } from './runtime'
import { createEditorStore } from './store'
import type { MarkdownEditorProps } from './types'
import { useControllableState } from './use-controllable'
import { useLatest } from './use-latest'

const createDefaultEngine = (): EditorEngine => new ClEditEngine()
const NO_RENDERER_OPTIONS: RendererOptions = {}

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
  const content = (
    <MessagesProvider messages={locale}>
      <LocalizedToasts>
        <EditorShell {...props} />
      </LocalizedToasts>
    </MessagesProvider>
  )
  if (outer && theme === undefined && defaultTheme === undefined) return content
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
      </div>
    </div>
  )
}
