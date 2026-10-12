import type { EditorExtension, ExtensionContext, Resource } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { Link2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { escapeHtml, httpUrl } from './embed-html'
import { ExtField, reportFailure } from './form'

const ICON = 16

function resourceHtml(payload: unknown): string {
  const data = payload as Partial<Resource>
  const href = httpUrl(data.url)
  const title = escapeHtml(typeof data.title === 'string' ? data.title : '')
  const description = escapeHtml(typeof data.description === 'string' ? data.description : '')
  if (!href) return `<div class="ex-csdn-ext-card"><p>${title}</p></div>`
  return `<div class="ex-csdn-ext-card"><a href="${escapeHtml(href)}">${title}</a><p>${description}</p></div>`
}

function ResourceDialog({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const copy = ctx.locale.csdnExt
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Resource[] | null>(null)
  const [pending, setPending] = useState(false)
  const query = keyword.trim()

  const search = (event: FormEvent) => {
    event.preventDefault()
    const searchResources = ctx.adapters.searchResources
    if (!searchResources || query === '' || pending) return
    setPending(true)
    searchResources(query).then(
      (list) => {
        setPending(false)
        setResults(list)
      },
      (error: unknown) => {
        setPending(false)
        setResults(null)
        reportFailure(ctx, copy.resourceFailed, error)
      },
    )
  }

  const choose = (resource: Resource) => {
    if (!httpUrl(resource.url)) {
      ctx.notify(copy.resourceBadUrl, 'error')
      return
    }
    close()
    ctx.insertEmbed('resource', resource)
  }

  return (
    <form className="ex-csdn-ext-dialog" onSubmit={search}>
      <ExtField label={copy.resourceKeyword}>
        {(id) => (
          <input
            id={id}
            className="ex-csdn-ext-input"
            autoFocus
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="submit" variant="primary" disabled={query === '' || pending} loading={pending}>
          {copy.resourceSearch}
        </Button>
      </div>
      {results && results.length === 0 ? <p className="ex-csdn-ext-muted">{copy.resourceEmpty}</p> : null}
      {results && results.length > 0 ? (
        <ul className="ex-csdn-ext-list">
          {results.map((resource) => (
            <li key={resource.id}>
              <Button type="button" variant="text" onClick={() => choose(resource)}>
                {resource.title}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}

export const csdnResourceExtension: EditorExtension = {
  name: 'csdn:resource',
  requires: ['searchResources'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:resource',
      title: (m) => m.toolbar.resource,
      label: (m) => m.toolbar.resource,
      icon: <Link2 size={ICON} />,
      group: 'csdn',
      order: 30,
      width: 440,
      render: (ctx, close) => <ResourceDialog ctx={ctx} close={close} />,
    },
  ],
  embeds: [{ type: 'resource', renderHtml: resourceHtml }],
}
