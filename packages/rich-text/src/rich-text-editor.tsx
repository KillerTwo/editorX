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
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createEditorConfig } from './ck-config'
import { countRichTextChars } from './count'
import { richTextCoreExtensions } from './core-extensions'
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
    getSelectionText() {
      return deps.getEditor()?.getSelectionText() ?? ''
    },
    replaceSelection(content) {
      if (deps.getLive().readOnly) return
      const editor = deps.getEditor()
      if (!editor || content.html === undefined) return
      editor.replaceHtml(content.html)
    },
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
      const live = deps.getLive()
      const upload = live.adapters.uploadImage
      const editor = deps.getEditor()
      if (!upload || !editor || live.readOnly) return
      for (const file of files) {
        try {
          const uploaded = await upload(file)
          const url = uploaded?.url
          if (typeof url !== 'string' || url === '') throw new TypeError('uploadImage must resolve to { url: string }')
          const current = deps.getEditor()
          if (!current || deps.getLive().readOnly) return
          current.insertHtml(`<figure class="image"><img src="${escapeAttr(url)}" alt=""></figure>`)
        } catch (error) {
          const next = deps.getLive()
          next.notify(formatMessage(next.messages.upload.error, { name: file.name, message: errorMessage(error) }), 'error')
        }
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
  onWordCount,
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
  const barHostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MountedEditor | null>(null)
  const silentRef = useRef(false)
  const initialHtmlRef = useRef(value ?? defaultValue ?? '')
  const emittedHtmlRef = useRef(value ?? defaultValue ?? '')
  const onChangeRef = useRef(onChange)
  const onWordCountRef = useRef(onWordCount)
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
  onWordCountRef.current = onWordCount
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
      openPanel: (id) => {
        setPanel(id)
        setTocOverlay(id === 'toc')
      },
      closePanel: (id) => {
        if (id === 'toc') setTocOverlay(false)
        setPanel((current) => (current === id ? null : current))
      },
      togglePanel: (id) => {
        const next = panelRef.current === id ? null : id
        setPanel(next)
        if (id === 'toc') setTocOverlay(next === 'toc')
      },
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
          emittedHtmlRef.current = html
          onChangeRef.current?.(html)
          onWordCountRef.current?.(countRichTextChars(html))
          setDocumentHtml(html)
        })
        const html = editor.getData()
        emittedHtmlRef.current = html
        onWordCountRef.current?.(countRichTextChars(html))
        setDocumentHtml(html)
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

  const applySilentHtml = (html: string) => {
    const editor = editorRef.current
    if (!editor) {
      initialHtmlRef.current = html
      emittedHtmlRef.current = html
      onWordCountRef.current?.(countRichTextChars(html))
      return
    }
    if (editor.getData() === html) {
      emittedHtmlRef.current = html
      return
    }
    silentRef.current = true
    try {
      editor.setData(html)
    } finally {
      silentRef.current = false
    }
    const next = editor.getData()
    emittedHtmlRef.current = next
    onWordCountRef.current?.(countRichTextChars(next))
  }
  const applySilentHtmlRef = useRef(applySilentHtml)
  applySilentHtmlRef.current = applySilentHtml

  useEffect(() => {
    if (value === undefined) return
    if (value === emittedHtmlRef.current) return
    applySilentHtmlRef.current(value)
  }, [value])

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
        applySilentHtmlRef.current(html)
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

  const shownHtml = value ?? documentHtml

  // 固定栏留在 .ex-rte（transform + overflow:hidden）里时，布局盒可以宽过内容区，绘制仍被裁回内容边。
  // 移到同级宿主后包含块才是视口。宽度取 innerWidth：滚动条占位与否都等于视口宽，而不是写死 +15px。
  // 宿主带 .ex-pub：栏离开发布区后，主按钮与 Helvetica 仍走 .ex-pub 后代选择器。
  // 只在宿主挂载时移动。卸载前放回原父节点，React 才能从仍拥有 fiber 的父节点 removeChild。
  useLayoutEffect(() => {
    const host = barHostRef.current
    const scope = host?.parentElement
    if (!host || !scope) return
    let bar: HTMLElement | null = null
    let home: ParentNode | null = null
    let next: ChildNode | null = null
    const fit = () => {
      const found = scope.querySelector('.ex-pub-bar.is-fixed')
      if (!(found instanceof HTMLElement)) return
      if (found.parentElement !== host) {
        home = found.parentElement
        next = found.nextSibling
        host.appendChild(found)
      }
      bar = found
      found.style.right = 'auto'
      found.style.width = `${window.innerWidth}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      if (!bar || !home || bar.parentElement !== host) return
      if (next && next.parentNode === home) home.insertBefore(bar, next)
      else home.appendChild(bar)
    }
  }, [])

  return (
    <>
    <div className={cx('ex-rte', className)} data-editor="rich-text" data-wide={wide || undefined} style={{ height }}>
      <div className="ex-rte__band">
        <Toolbar groups={groups} ctx={ctx} readOnly={readOnly} stateKey={`${wide}|${panel ?? ''}`} onError={reportError} />
      </div>
      <div className="ex-rte__scroll" ref={scrollRef}>
        <article className="ex-rte-paper">
          <PaperChrome
            title={currentTitle}
            onTitleChange={handleTitleChange}
            empty={isEmptyDocument(shownHtml)}
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
          html={shownHtml}
          onCollapse={() => {
            setTocOverlay(false)
            setPanel((current) => (current === 'toc' ? null : current))
          }}
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
    <div className="ex-rte-bar-host ex-pub" ref={barHostRef} />
    </>
  )
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char] ?? char
  })
}
