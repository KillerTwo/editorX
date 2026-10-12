import type { EditorExtension, ExtensionContext } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { SquareCode } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { escapeHtml, httpUrl } from './embed-html'
import { ExtField, reportFailure } from './form'

const ICON = 16

function inscodeHtml(payload: unknown): string {
  const data = payload as { url?: unknown; lang?: unknown }
  const href = httpUrl(data.url)
  const lang = escapeHtml(typeof data.lang === 'string' ? data.lang : '')
  if (!href) return `<div class="ex-csdn-ext-card"><p>${lang}</p></div>`
  return `<div class="ex-csdn-ext-card"><a href="${escapeHtml(href)}">${lang || 'InsCode'}</a></div>`
}

function InsCodeDialog({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const copy = ctx.locale.csdnExt
  const [lang, setLang] = useState('javascript')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const canSubmit = lang.trim() !== '' && code.trim() !== '' && !pending

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const runCode = ctx.adapters.runCode
    if (!runCode || !canSubmit) return
    const language = lang.trim()
    const source = code.trim()
    setPending(true)
    runCode(language, source).then(
      (result) => {
        const url = httpUrl(result.url)
        if (!url) {
          setPending(false)
          ctx.notify(copy.inscodeBadUrl, 'error')
          return
        }
        close()
        ctx.insertEmbed('inscode', { url, lang: language })
      },
      (error: unknown) => {
        setPending(false)
        reportFailure(ctx, copy.inscodeFailed, error)
      },
    )
  }

  return (
    <form className="ex-csdn-ext-dialog" onSubmit={submit}>
      <ExtField label={copy.inscodeLang}>
        {(id) => (
          <input id={id} className="ex-csdn-ext-input" value={lang} onChange={(event) => setLang(event.target.value)} />
        )}
      </ExtField>
      <ExtField label={copy.inscodeCode}>
        {(id) => (
          <textarea id={id} className="ex-csdn-ext-area" value={code} onChange={(event) => setCode(event.target.value)} />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="button" onClick={close}>
          {ctx.locale.dialog.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} loading={pending}>
          {ctx.locale.dialog.confirm}
        </Button>
      </div>
    </form>
  )
}

export const csdnInscodeExtension: EditorExtension = {
  name: 'csdn:inscode',
  requires: ['runCode'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:inscode',
      title: (m) => m.csdnExt.inscode,
      label: (m) => m.csdnExt.inscode,
      icon: <SquareCode size={ICON} />,
      group: 'csdn',
      order: 40,
      width: 520,
      render: (ctx, close) => <InsCodeDialog ctx={ctx} close={close} />,
    },
  ],
  embeds: [{ type: 'inscode', renderHtml: inscodeHtml }],
}
