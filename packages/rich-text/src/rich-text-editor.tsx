import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import {
  activeExtensions,
  errorMessage,
  formatMessage,
  MessagesProvider,
  resolvePanels,
  resolveToolbar,
  Toolbar,
  useExtensionSetup,
  useMessages,
  useStableArray,
  type EditorAdapters,
  type EditorExtension,
  type ExtensionContext,
  type InsertContent,
  type Messages,
} from '@editorx/toolbar'
import { ToastProvider, useToast } from '@editorx/ui'
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { richTextCoreExtensions } from './core-extensions'
import { createEditorConfig } from './ck-config'
import { RichTextDrawer } from './drawer'
import { scrollHeadingIntoView } from './headings'
import { RICH_TEXT_TOOLBAR_LAYOUT } from './layout'
import { mountEditor, type MountedEditor } from './mount-editor'
import { PaperChrome } from './paper'
import { ExpandGlyph, TocPanel } from './toc-panel'
import type { RichTextEditorProps } from './types'

const EMPTY_ADAPTERS: EditorAdapters = {}
const EMPTY_EXTENSIONS: readonly EditorExtension[] = []
const EMPTY_FORMATS: ReadonlySet<string> = new Set()

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** CKEditor 空文档常是 `<p>&nbsp;</p>`，这种 getData 仍应显示占位。有可见文字或媒体时隐藏。 */
function isEmptyDocument(html: string): boolean {
  if (/data-ex-embed=|<(img|video|iframe|audio|svg|table|hr|canvas|object)\b/i.test(html)) return false
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, '').replace(/\u00a0/g, '').trim()
  return text.length === 0
}

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

export function RichTextEditor(props: RichTextEditorProps) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
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
      className="ex-rte-theme"
    >
      {content}
    </ThemeProvider>
  )
}

interface EditorDeps {
  getEditor(): MountedEditor | null
  getLive(): {
    adapters: EditorAdapters
    title: string
    theme: 'light' | 'dark'
    readOnly: boolean
    messages: Messages
    notify(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void
  }
  toggleWide(): void
  openPanel(id: string): void
  closePanel(id: string): void
  togglePanel(id: string): void
  getPanel(): string | null
}

function createContext(deps: EditorDeps): ExtensionContext {
  const writeHtml = (content: InsertContent, mode: 'insert' | 'replace') => {
    if (deps.getLive().readOnly) return
    const editor = deps.getEditor()
    if (!editor || content.html === undefined) return
    if (mode === 'replace') editor.setData(content.html)
    else editor.insertHtml(content.html)
  }
  return {
    editorType: 'richtext',
    insert: (content) => writeHtml(content, 'insert'),
    insertEmbed(type, payload) {
      const html = `<div data-ex-embed="${escapeAttr(type)}" data-payload="${escapeAttr(JSON.stringify(payload ?? null))}"></div>`
      writeHtml({ html }, 'insert')
    },
    getSelectionText: () => '',
    replaceSelection: (content) => writeHtml(content, 'insert'),
    replaceDocument: (content) => writeHtml(content, 'replace'),
    getDocument() {
      const editor = deps.getEditor()
      return {
        editorType: 'richtext',
        title: deps.getLive().title,
        html: editor?.getData() ?? '',
        markdown: undefined,
      }
    },
    commands: {
      has: (name) => name === 'wide' || deps.getEditor() !== null,
      run(name, args) {
        if (name === 'wide') {
          deps.toggleWide()
          return true
        }
        const editor = deps.getEditor()
        if (!editor || deps.getLive().readOnly) return false
        editor.execute(name, args)
        return true
      },
      list: () => ['wide'],
    },
    get adapters() {
      return deps.getLive().adapters
    },
    openPanel: (id) => deps.openPanel(id),
    closePanel: (id) => deps.closePanel(id),
    togglePanel: (id) => deps.togglePanel(id),
    get activePanel() {
      return deps.getPanel()
    },
    async uploadImages(files) {
      const upload = deps.getLive().adapters.uploadImage
      const editor = deps.getEditor()
      if (!upload || !editor || deps.getLive().readOnly) return
      for (const file of files) {
        const { url } = await upload(file)
        editor.insertHtml(`<figure class="image"><img src="${escapeAttr(url)}" alt=""></figure>`)
      }
    },
    focus() {
      deps.getEditor()?.focus()
    },
    notify(message, type) {
      deps.getLive().notify(message, type)
    },
    get theme() {
      return deps.getLive().theme
    },
    get locale() {
      return deps.getLive().messages
    },
    get readOnly() {
      return deps.getLive().readOnly
    },
    get formats() {
      return EMPTY_FORMATS
    },
  }
}

function EditorShell({
  value,
  defaultValue,
  onChange,
  title,
  defaultTitle,
  onTitleChange,
  adapters = EMPTY_ADAPTERS,
  extensions = EMPTY_EXTENSIONS,
  coreExtensions = richTextCoreExtensions,
  toolbarLayout = RICH_TEXT_TOOLBAR_LAYOUT,
  missingAdapter,
  readOnly = false,
  ariaLabel,
  height = '100%',
  defaultTocOpen = true,
  defaultRightOpen,
  rightOpen: rightOpenProp,
  onRightOpenChange,
  slots,
  className,
  ref,
}: RichTextEditorProps) {
  const messages = useMessages()
  const { resolved } = useTheme()
  const { notify } = useToast()
  const [wide, setWide] = useState(false)
  const [panel, setPanel] = useState<string | null>(defaultTocOpen ? 'toc' : null)
  const [tocOverlay, setTocOverlay] = useState(false)
  const [innerRightOpen, setInnerRightOpen] = useState(defaultRightOpen ?? true)
  const rightOpenControlled = rightOpenProp !== undefined
  const isRightOpen = rightOpenControlled ? rightOpenProp : innerRightOpen
  const setRightOpen = (open: boolean) => {
    if (!rightOpenControlled) setInnerRightOpen(open)
    onRightOpenChange?.(open)
  }
  const [, setMounted] = useState<MountedEditor | null>(null)
  const [ownTitle, setOwnTitle] = useState(defaultTitle ?? '')
  const [documentHtml, setDocumentHtml] = useState(() => value ?? defaultValue ?? '')
  const currentTitle = title ?? ownTitle
  const editableRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MountedEditor | null>(null)
  const silentRef = useRef(false)
  const initialHtmlRef = useRef(value ?? defaultValue ?? '')
  const onChangeRef = useRef(onChange)
  const panelRef = useRef(panel)
  const liveRef = useRef({
    adapters,
    title: currentTitle,
    theme: resolved,
    readOnly,
    messages,
    notify,
  })
  onChangeRef.current = onChange
  panelRef.current = panel
  liveRef.current = {
    adapters,
    title: currentTitle,
    theme: resolved,
    readOnly,
    messages,
    notify,
  }

  const [ctx] = useState(() =>
    createContext({
      getEditor: () => editorRef.current,
      getLive: () => liveRef.current,
      toggleWide: () => setWide((current) => !current),
      openPanel: (id) => setPanel(id),
      closePanel: (id) => setPanel((current) => (current === id ? null : current)),
      togglePanel: (id) => setPanel((current) => (current === id ? null : id)),
      getPanel: () => panelRef.current,
    }),
  )

  const reportError = (name: string, error: unknown) => {
    console.error(error)
    notify(formatMessage(messages.errors.extension, { name, message: errorMessage(error) }), 'error')
  }

  const allExtensions = useStableArray(useMemo(() => [...coreExtensions, ...extensions], [coreExtensions, extensions]))
  const active = useMemo(() => activeExtensions(allExtensions, 'richtext'), [allExtensions])
  useExtensionSetup(active, ctx, reportError)
  const resolveOptions = useMemo(
    () => ({ editorType: 'richtext' as const, adapters, missingAdapter }),
    [adapters, missingAdapter],
  )
  const groups = useMemo(() => resolveToolbar(active, toolbarLayout, resolveOptions), [active, toolbarLayout, resolveOptions])
  const rightPanels = useMemo(
    () => resolvePanels(active, resolveOptions).filter((entry) => entry.panel.position === 'right'),
    [active, resolveOptions],
  )
  const hasRightPanels = rightPanels.length > 0

  useEffect(() => {
    const element = editableRef.current
    if (!element) return
    let cancelled = false
    let current: MountedEditor | undefined
    let stop = () => {}
    const passedHtml = initialHtmlRef.current
    mountEditor(element, createEditorConfig({ uploadImage: liveRef.current.adapters.uploadImage }), passedHtml)
      .then((editor) => {
        if (cancelled) {
          void editor.destroy()
          return
        }
        const pendingHtml = initialHtmlRef.current
        if (pendingHtml !== passedHtml) editor.setData(pendingHtml)
        editor.setReadOnly(liveRef.current.readOnly)
        current = editor
        editorRef.current = editor
        stop = editor.onChange(() => {
          if (cancelled || silentRef.current) return
          const html = editor.getData()
          onChangeRef.current?.(html)
          setDocumentHtml(html)
        })
        setDocumentHtml(editor.getData())
        setMounted(editor)
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error(error)
      })
    return () => {
      cancelled = true
      stop()
      if (editorRef.current === current) editorRef.current = null
      void current?.destroy()
    }
  }, [])

  useEffect(() => {
    editorRef.current?.setReadOnly(readOnly)
  }, [readOnly])

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        editorRef.current?.focus()
      },
      getValue() {
        return editorRef.current?.getData() ?? initialHtmlRef.current
      },
      setValue(html: string) {
        setDocumentHtml(html)
        const editor = editorRef.current
        if (!editor) {
          initialHtmlRef.current = html
          return
        }
        silentRef.current = true
        try {
          editor.setData(html)
        } finally {
          silentRef.current = false
        }
      },
      getDocument() {
        return {
          editorType: 'richtext' as const,
          title: liveRef.current.title,
          html: editorRef.current?.getData() ?? initialHtmlRef.current,
          markdown: undefined,
        }
      },
      insert(content: InsertContent) {
        ctx.insert(content)
      },
    }),
    [ctx],
  )

  const handleTitleChange = (next: string) => {
    if (title === undefined) {
      setOwnTitle(next)
      liveRef.current.title = next
    }
    onTitleChange?.(next)
  }

  return (
    <div className={cx('ex-rte', className)} data-editor="rich-text" data-wide={wide || undefined} style={{ height }}>
      <div className="ex-rte__band">
        <Toolbar groups={groups} ctx={ctx} readOnly={readOnly} stateKey={`${wide}|${panel ?? ''}`} onError={reportError} />
      </div>
      <div className="ex-rte__scroll" ref={scrollRef}>
        <article className="ex-rte-paper">
          <PaperChrome
            title={currentTitle}
            onTitleChange={handleTitleChange}
            empty={isEmptyDocument(documentHtml)}
            titleActions={slots?.titleActions}
          >
            <div
              className="ex-rte-body"
              ref={editableRef}
              role="textbox"
              aria-multiline="true"
              aria-label={ariaLabel ?? messages.richText.editable}
            />
          </PaperChrome>
        </article>
        <div className="ex-rte__after">{slots?.afterPaper}</div>
      </div>
      <aside
        className={cx('ex-rte-toc', panel !== 'toc' && 'is-collapsed', tocOverlay && 'is-open')}
        aria-label={messages.panels.toc}
      >
        <TocPanel
          html={documentHtml}
          onCollapse={() => setPanel((current) => (current === 'toc' ? null : current))}
          onSelect={(id, index) => {
            const scroll = scrollRef.current
            if (scroll) scrollHeadingIntoView(scroll, id, index)
          }}
        />
      </aside>
      <button
        type="button"
        className="ex-rte-toc__expand"
        aria-label={messages.panels.expand}
        onClick={() => {
          setPanel('toc')
          setTocOverlay(true)
        }}
      >
        <ExpandGlyph />
      </button>
      {hasRightPanels && isRightOpen ? (
        <RichTextDrawer onCollapse={() => setRightOpen(false)}>
          {rightPanels.map(({ panel: panelDef, extension }) => (
            <div key={panelDef.id} data-extension={extension}>
              {panelDef.render(ctx)}
            </div>
          ))}
        </RichTextDrawer>
      ) : null}
      {hasRightPanels && !isRightOpen && slots?.rightCollapsed ? (
        <div className="ex-rte-collapsed">{slots.rightCollapsed}</div>
      ) : null}
    </div>
  )
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char] ?? char
  })
}
