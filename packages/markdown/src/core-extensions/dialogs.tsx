import type { ExtensionContext } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { Upload } from 'lucide-react'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

interface DialogProps {
  ctx: ExtensionContext
  close: () => void
}

/** 等对话框卸载、焦点归还后再执行，让命令最终把焦点交给编辑区 */
const afterClose = (fn: () => void) => {
  setTimeout(fn, 0)
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="ex-mde-field">
      <label htmlFor={id} className="ex-mde-field__label">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

function Actions({ ctx, close, canSubmit = true }: DialogProps & { canSubmit?: boolean }) {
  return (
    <div className="ex-mde-dialog__actions">
      <Button onClick={close}>{ctx.locale.dialog.cancel}</Button>
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {ctx.locale.dialog.confirm}
      </Button>
    </div>
  )
}

const URL_PREFIX = 'https://'
const isUrlFilled = (url: string) => {
  const value = url.trim()
  return value !== '' && value !== URL_PREFIX
}

export function LinkDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [text, setText] = useState(() => ctx.getSelectionText())
  const [url, setUrl] = useState(URL_PREFIX)
  const canSubmit = isUrlFilled(url)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    close()
    afterClose(() => ctx.commands.run('link', { text: text || undefined, url: url.trim() }))
  }
  return (
    <form className="ex-mde-dialog" onSubmit={submit}>
      <Field label={m.dialog.linkText}>
        {(id) => <input id={id} className="ex-mde-input" autoFocus value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <Field label={m.dialog.linkUrl}>
        {(id) => <input id={id} className="ex-mde-input" value={url} onChange={(e) => setUrl(e.target.value)} />}
      </Field>
      <Actions ctx={ctx} close={close} canSubmit={canSubmit} />
    </form>
  )
}

export function ImageDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [url, setUrl] = useState(URL_PREFIX)
  const [alt, setAlt] = useState(() => ctx.getSelectionText())
  const fileRef = useRef<HTMLInputElement>(null)
  const canSubmit = isUrlFilled(url)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    close()
    afterClose(() => ctx.commands.run('image', { url: url.trim(), text: alt || undefined }))
  }
  const onFiles = (files: FileList | null) => {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    close()
    afterClose(() => void ctx.uploadImages(list))
  }
  return (
    <form className="ex-mde-dialog" onSubmit={submit}>
      <Field label={m.dialog.imageUrl}>
        {(id) => <input id={id} className="ex-mde-input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} />}
      </Field>
      <Field label={m.dialog.imageAlt}>
        {(id) => <input id={id} className="ex-mde-input" value={alt} onChange={(e) => setAlt(e.target.value)} />}
      </Field>
      {ctx.adapters.uploadImage && (
        <div className="ex-mde-dialog__row">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <Button icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
            {m.dialog.imageUpload}
          </Button>
        </div>
      )}
      <Actions ctx={ctx} close={close} canSubmit={canSubmit} />
    </form>
  )
}

const clampCount = (value: string) => Math.min(20, Math.max(1, Number.parseInt(value, 10) || 1))

export function TableDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    close()
    afterClose(() => ctx.commands.run('table', { rows: clampCount(rows), cols: clampCount(cols) }))
  }
  return (
    <form className="ex-mde-dialog" onSubmit={submit}>
      <div className="ex-mde-dialog__row">
        <Field label={m.dialog.tableRows}>
          {(id) => (
            <input id={id} className="ex-mde-input" type="number" min={1} max={20} autoFocus value={rows} onChange={(e) => setRows(e.target.value)} />
          )}
        </Field>
        <Field label={m.dialog.tableCols}>
          {(id) => (
            <input id={id} className="ex-mde-input" type="number" min={1} max={20} value={cols} onChange={(e) => setCols(e.target.value)} />
          )}
        </Field>
      </div>
      <Actions ctx={ctx} close={close} />
    </form>
  )
}
