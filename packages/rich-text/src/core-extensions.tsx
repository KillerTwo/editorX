import type { EditorExtension, ExtensionContext } from '@editorx/toolbar'
import { TocPanel } from './toc-panel'
import { Button, cropImage, ImageCropper, type CropArea } from '@editorx/ui'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Maximize2,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableOfContents,
  Underline,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

const ICON = 16

/** 写入文档的颜色，不进入样式表。 */
const SWATCHES = ['#1a1a1a', '#fc5531', '#ff9900', '#2ea121', '#4183f1', '#8e44ad', '#555666', '#4d4d4d'] as const

const CODE_LANGUAGES = [
  ['plaintext', 'Plain text'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['go', 'Go'],
  ['bash', 'Bash'],
  ['json', 'JSON'],
] as const

const HEADINGS = ['heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'] as const

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char] ?? char
  })
}

const run = (name: string, args?: unknown) => (ctx: ExtensionContext) => {
  ctx.commands.run(name, args)
}

interface DialogProps {
  ctx: ExtensionContext
  close: () => void
}

function DialogActions({
  close,
  confirm,
  busy = false,
  disabled = false,
  confirmLabel,
  cancelLabel,
}: {
  close: () => void
  confirm?: () => void
  busy?: boolean
  disabled?: boolean
  confirmLabel: string
  cancelLabel: string
}) {
  return (
    <div className="ex-rte-dialog__actions">
      <Button onClick={close}>{cancelLabel}</Button>
      <Button type="submit" variant="primary" loading={busy} disabled={disabled} onClick={confirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ex-rte-dialog__field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ColorSwatches({ ctx, close, command }: DialogProps & { command: 'fontColor' | 'fontBackgroundColor' }) {
  return (
    <div className="ex-rte-colors" role="listbox" aria-label={ctx.locale.toolbar[command === 'fontColor' ? 'color' : 'background']}>
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          className="ex-rte-colors__swatch"
          style={{ backgroundColor: color }}
          aria-label={color}
          onClick={() => {
            ctx.commands.run(command, { value: color })
            close()
          }}
        />
      ))}
    </div>
  )
}

function LinkDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale.dialog
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const href = url.trim()
    if (!href) return
    const label = text.trim() || href
    ctx.insert({ html: `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` })
    close()
  }
  return (
    <form className="ex-rte-dialog" onSubmit={submit}>
      <Field label={m.linkText}>
        <input className="ex-rte-dialog__input" value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <Field label={m.linkUrl}>
        <input className="ex-rte-dialog__input" value={url} onChange={(event) => setUrl(event.target.value)} />
      </Field>
      <DialogActions close={close} confirmLabel={m.confirm} cancelLabel={m.cancel} disabled={!url.trim()} />
    </form>
  )
}

function ImageDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('image.png')
  const [area, setArea] = useState<CropArea | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    setFileName(file.name)
    setArea(null)
    setSrc(url)
  }

  const confirm = async () => {
    if (!src || !area || !ctx.adapters.uploadImage) return
    setBusy(true)
    try {
      const blob = await cropImage(src, area, { width: 480, height: 270 })
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })
      const { url } = await ctx.adapters.uploadImage(file)
      ctx.insert({ html: `<figure class="image"><img src="${escapeHtml(url)}" alt=""></figure>` })
      close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ex-rte-dialog">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {src ? (
        <ImageCropper src={src} aspect={16 / 9} width={480} errorText="图片无法显示" onChange={setArea} />
      ) : (
        <Button onClick={() => inputRef.current?.click()}>{m.dialog.imageUpload}</Button>
      )}
      <DialogActions
        close={close}
        confirm={() => void confirm()}
        busy={busy}
        disabled={!area}
        confirmLabel={m.dialog.confirm}
        cancelLabel={m.dialog.cancel}
      />
    </div>
  )
}

function TableDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale.dialog
  const [rows, setRows] = useState('3')
  const [columns, setColumns] = useState('3')
  const count = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    ctx.commands.run('insertTable', { rows: count(rows), columns: count(columns) })
    close()
  }
  return (
    <form className="ex-rte-dialog" onSubmit={submit}>
      <Field label={m.tableRows}>
        <input className="ex-rte-dialog__input" type="number" min={1} value={rows} onChange={(event) => setRows(event.target.value)} />
      </Field>
      <Field label={m.tableCols}>
        <input className="ex-rte-dialog__input" type="number" min={1} value={columns} onChange={(event) => setColumns(event.target.value)} />
      </Field>
      <DialogActions close={close} confirmLabel={m.confirm} cancelLabel={m.cancel} />
    </form>
  )
}

function MathDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [tex, setTex] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const source = tex.trim()
    if (!source) return
    const safe = escapeHtml(source)
    ctx.insert({ html: `<p data-ex-math="${safe}">$$${safe}$$</p>` })
    close()
  }
  return (
    <form className="ex-rte-dialog" onSubmit={submit}>
      <Field label={m.toolbar.mathBlock}>
        <input className="ex-rte-dialog__input" value={tex} onChange={(event) => setTex(event.target.value)} />
      </Field>
      <DialogActions close={close} confirmLabel={m.dialog.confirm} cancelLabel={m.dialog.cancel} disabled={!tex.trim()} />
    </form>
  )
}

const headingTitle = {
  heading1: (m: ExtensionContext['locale']) => m.toolbar.heading1,
  heading2: (m: ExtensionContext['locale']) => m.toolbar.heading2,
  heading3: (m: ExtensionContext['locale']) => m.toolbar.heading3,
  heading4: (m: ExtensionContext['locale']) => m.toolbar.heading4,
  heading5: (m: ExtensionContext['locale']) => m.toolbar.heading5,
  heading6: (m: ExtensionContext['locale']) => m.toolbar.heading6,
} as const

export const richTextCoreExtensions: readonly EditorExtension[] = [
  {
    name: 'core:richtext',
    editors: ['richtext'],
    toolbar: [
      { type: 'button', id: 'undo', title: (m) => m.toolbar.undo, label: (m) => m.toolbar.undo, icon: <Undo2 size={ICON} />, run: run('undo') },
      { type: 'button', id: 'redo', title: (m) => m.toolbar.redo, label: (m) => m.toolbar.redo, icon: <Redo2 size={ICON} />, run: run('redo') },
      {
        type: 'dropdown',
        id: 'format',
        title: (m) => m.toolbar.format,
        label: (m) => m.toolbar.format,
        icon: <Heading size={ICON} />,
        items: [
          { type: 'button', id: 'paragraph', title: (m) => m.toolbar.paragraph, run: run('heading', { heading: 'paragraph' }) },
          ...HEADINGS.map((level) => ({
            type: 'button' as const,
            id: level,
            title: headingTitle[level],
            run: run('heading', { heading: level }),
          })),
        ],
      },
      { type: 'button', id: 'bold', title: (m) => m.toolbar.bold, label: (m) => m.toolbar.bold, icon: <Bold size={ICON} />, run: run('bold') },
      {
        type: 'popover',
        id: 'color',
        title: (m) => m.toolbar.color,
        label: (m) => m.toolbar.color,
        icon: <Highlighter size={ICON} />,
        render: (ctx, close) => <ColorSwatches ctx={ctx} close={close} command="fontColor" />,
      },
      {
        type: 'popover',
        id: 'background',
        title: (m) => m.toolbar.background,
        label: (m) => m.toolbar.background,
        icon: <Highlighter size={ICON} />,
        render: (ctx, close) => <ColorSwatches ctx={ctx} close={close} command="fontBackgroundColor" />,
      },
      {
        type: 'dropdown',
        id: 'other',
        title: (m) => m.toolbar.other,
        label: (m) => m.toolbar.other,
        icon: <Italic size={ICON} />,
        items: [
          { type: 'button', id: 'italic', title: (m) => m.toolbar.italic, icon: <Italic size={ICON} />, run: run('italic') },
          { type: 'button', id: 'underline', title: (m) => m.toolbar.underline, icon: <Underline size={ICON} />, run: run('underline') },
          { type: 'button', id: 'strikethrough', title: (m) => m.toolbar.strikethrough, icon: <Strikethrough size={ICON} />, run: run('strikethrough') },
          { type: 'button', id: 'superscript', title: (m) => m.toolbar.superscript, icon: <Superscript size={ICON} />, run: run('superscript') },
          { type: 'button', id: 'subscript', title: (m) => m.toolbar.subscript, icon: <Subscript size={ICON} />, run: run('subscript') },
          { type: 'button', id: 'inlineCode', title: (m) => m.toolbar.inlineCode, icon: <Code size={ICON} />, run: run('code') },
          { type: 'button', id: 'removeFormat', title: (m) => m.toolbar.clearFormat, icon: <RemoveFormatting size={ICON} />, run: run('removeFormat') },
        ],
      },
      {
        type: 'dropdown',
        id: 'list',
        title: (m) => m.toolbar.list,
        label: (m) => m.toolbar.list,
        icon: <List size={ICON} />,
        items: [
          { type: 'button', id: 'bulletedList', title: (m) => m.toolbar.unorderedList, icon: <List size={ICON} />, run: run('bulletedList') },
          { type: 'button', id: 'numberedList', title: (m) => m.toolbar.orderedList, icon: <ListOrdered size={ICON} />, run: run('numberedList') },
          { type: 'button', id: 'todoList', title: (m) => m.toolbar.taskList, icon: <ListTodo size={ICON} />, run: run('todoList') },
        ],
      },
      {
        type: 'dropdown',
        id: 'align',
        title: (m) => m.toolbar.align,
        label: (m) => m.toolbar.align,
        icon: <AlignLeft size={ICON} />,
        items: [
          { type: 'button', id: 'alignLeft', title: (m) => m.toolbar.alignLeft, icon: <AlignLeft size={ICON} />, run: run('alignment', { value: 'left' }) },
          { type: 'button', id: 'alignCenter', title: (m) => m.toolbar.alignCenter, icon: <AlignCenter size={ICON} />, run: run('alignment', { value: 'center' }) },
          { type: 'button', id: 'alignRight', title: (m) => m.toolbar.alignRight, icon: <AlignRight size={ICON} />, run: run('alignment', { value: 'right' }) },
          { type: 'button', id: 'alignJustify', title: (m) => m.toolbar.alignJustify, icon: <AlignJustify size={ICON} />, run: run('alignment', { value: 'justify' }) },
        ],
      },
      { type: 'button', id: 'hr', title: (m) => m.toolbar.hr, label: (m) => m.toolbar.hr, icon: <Minus size={ICON} />, run: run('horizontalLine') },
      { type: 'button', id: 'quote', title: (m) => m.toolbar.quote, label: (m) => m.toolbar.quote, icon: <Quote size={ICON} />, run: run('blockQuote') },
      {
        type: 'dropdown',
        id: 'code',
        title: (m) => m.toolbar.code,
        label: (m) => m.toolbar.code,
        icon: <Code size={ICON} />,
        items: [
          ...CODE_LANGUAGES.map(([language, label]) => ({
            type: 'button' as const,
            id: `code-${language}`,
            title: label,
            run: run('codeBlock', { language }),
          })),
          { type: 'button', id: 'codeInline', title: (m) => m.toolbar.inlineCode, icon: <Code size={ICON} />, run: run('code') },
        ],
      },
      {
        type: 'modal',
        id: 'table',
        title: (m) => m.toolbar.table,
        label: (m) => m.toolbar.table,
        icon: <Table size={ICON} />,
        width: 400,
        render: (ctx, close) => <TableDialog ctx={ctx} close={close} />,
      },
      {
        type: 'modal',
        id: 'image',
        title: (m) => m.toolbar.image,
        label: (m) => m.toolbar.image,
        icon: <Image size={ICON} />,
        width: 560,
        requires: ['uploadImage'],
        render: (ctx, close) => <ImageDialog ctx={ctx} close={close} />,
      },
      {
        type: 'modal',
        id: 'math',
        title: (m) => m.toolbar.mathBlock,
        label: (m) => m.toolbar.mathBlock,
        icon: <Sigma size={ICON} />,
        width: 440,
        render: (ctx, close) => <MathDialog ctx={ctx} close={close} />,
      },
      {
        type: 'modal',
        id: 'link',
        title: (m) => m.toolbar.link,
        label: (m) => m.toolbar.link,
        icon: <Link size={ICON} />,
        width: 440,
        render: (ctx, close) => <LinkDialog ctx={ctx} close={close} />,
      },
      {
        type: 'button',
        id: 'toc',
        title: (m) => m.toolbar.toc,
        label: (m) => m.toolbar.toc,
        icon: <TableOfContents size={ICON} />,
        run: (ctx) => ctx.togglePanel('toc'),
      },
      {
        type: 'button',
        id: 'wide',
        title: (m) => m.toolbar.wide,
        label: (m) => m.toolbar.wide,
        icon: <Maximize2 size={ICON} />,
        run: run('wide'),
      },
    ],
    panels: [
      {
        id: 'toc',
        title: (m) => m.panels.toc,
        position: 'left',
        render: (ctx) => <TocPanel html={ctx.getDocument().html} />,
      },
    ],
  },
]
