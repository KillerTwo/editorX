import type { EditorExtension, ExtensionContext, Template } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyTemplate, reportFailure } from './form'

const ICON = 16

function TemplatePicker({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const copy = ctx.locale.csdnExt

  useEffect(() => {
    let alive = true
    const load = ctx.adapters.getTemplates
    if (!load) return
    load().then(
      (list) => {
        if (alive) setTemplates(list)
      },
      (error: unknown) => {
        if (!alive) return
        const message = copy.templateFailed.replace('{message}', error instanceof Error ? error.message : String(error))
        setFailed(message)
        setTemplates([])
        reportFailure(ctx, copy.templateFailed, error)
      },
    )
    return () => {
      alive = false
    }
  }, [ctx, copy.templateFailed])

  if (failed) return <p className="ex-csdn-ext-muted">{failed}</p>
  if (!templates) return <p className="ex-csdn-ext-muted">{copy.templateLoading}</p>
  if (templates.length === 0) return <p className="ex-csdn-ext-muted">{copy.templateEmpty}</p>
  return (
    <ul className="ex-csdn-ext-list">
      {templates.map((template) => (
        <li key={template.id} className="ex-csdn-ext-row">
          <span>{template.name}</span>
          <Button variant="text" onClick={() => applyTemplate(ctx, template, 'replace', close)}>
            {`${copy.templateReplace} ${template.name}`}
          </Button>
          <Button variant="text" onClick={() => applyTemplate(ctx, template, 'insert', close)}>
            {`${copy.templateInsert} ${template.name}`}
          </Button>
        </li>
      ))}
    </ul>
  )
}

export const csdnTemplateExtension: EditorExtension = {
  name: 'csdn:template',
  requires: ['getTemplates'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:template',
      title: (m) => m.toolbar.template,
      label: (m) => m.toolbar.template,
      icon: <FileText size={ICON} />,
      width: 420,
      render: (ctx, close) => <TemplatePicker ctx={ctx} close={close} />,
    },
  ],
}
