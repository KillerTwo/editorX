import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import {
  activeExtensions,
  errorMessage,
  formatMessage,
  MessagesProvider,
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
import { RICH_TEXT_TOOLBAR_LAYOUT } from './layout'
import { mountEditor, type MountedEditor } from './mount-editor'
import type { RichTextEditorProps } from './types'

const EMPTY_ADAPTERS: EditorAdapters = {}
const EMPTY_EXTENSIONS: readonly EditorExtension[] = []
const EMPTY_FORMATS: ReadonlySet<string> = new Set()

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
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
  adapters = EMPTY_ADAPTERS,
  extensions = EMPTY_EXTENSIONS,
  coreExtensions = richTextCoreExtensions,
  toolbarLayout = RICH_TEXT_TOOLBAR_LAYOUT,
  missingAdapter,
  readOnly = false,
  ariaLabel,
  height = '100%',
  slots,
  className,
  ref,
}: RichTextEditorProps) {
  const messages = useMessages()
  const { resolved } = useTheme()
  const { notify } = useToast()
  const [wide, setWide] = useState(false)
  const [panel, setPanel] = useState<string | null>(null)
  const [, setMounted] = useState<MountedEditor | null>(null)
  const editableRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MountedEditor | null>(null)
  const silentRef = useRef(false)
  const initialHtmlRef = useRef(value ?? defaultValue ?? '')
  const onChangeRef = useRef(onChange)
  const panelRef = useRef(panel)
  const liveRef = useRef({
    adapters,
    title: title ?? defaultTitle ?? '',
    theme: resolved,
    readOnly,
    messages,
    notify,
  })
  onChangeRef.current = onChange
  panelRef.current = panel
  liveRef.current = {
    adapters,
    title: title ?? defaultTitle ?? '',
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
  const groups = useMemo(
    () => resolveToolbar(active, toolbarLayout, { editorType: 'richtext', adapters, missingAdapter }),
    [active, toolbarLayout, adapters, missingAdapter],
  )

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
          onChangeRef.current?.(editor.getData())
        })
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

  return (
    <div className={cx('ex-rte', className)} data-editor="rich-text" data-wide={wide || undefined} style={{ height }}>
      <div className="ex-rte__band">
        <Toolbar groups={groups} ctx={ctx} readOnly={readOnly} stateKey={`${wide}|${panel ?? ''}`} onError={reportError} />
      </div>
      <div className="ex-rte__scroll">
        <article className="ex-rte-paper">
          <div
            className="ex-rte-body"
            ref={editableRef}
            role="textbox"
            aria-multiline="true"
            aria-label={ariaLabel ?? messages.richText.editable}
          />
        </article>
        <div className="ex-rte__after">{slots?.afterPaper}</div>
      </div>
    </div>
  )
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char] ?? char
  })
}
