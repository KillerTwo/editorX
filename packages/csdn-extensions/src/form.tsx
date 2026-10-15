import { errorMessage, formatMessage, type ExtensionContext, type InsertContent, type Template } from '@geekx/toolbar'
import { useId, type ReactNode } from 'react'

export function ExtField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="ex-csdn-ext-field">
      <label htmlFor={id} className="ex-csdn-ext-field__label">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

function usable(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.trim() === '' ? undefined : value
}

export function templateContent(editorType: ExtensionContext['editorType'], template: Template): InsertContent | null {
  const markdown = usable(template.markdown)
  const html = usable(template.html)
  if (editorType === 'richtext') {
    if (!html) return null
    return markdown ? { html, markdown } : { html }
  }
  if (markdown) return html ? { markdown, html } : { markdown }
  if (html) return { html }
  return null
}

export function applyTemplate(
  ctx: ExtensionContext,
  template: Template,
  mode: 'insert' | 'replace',
  close: () => void,
): void {
  const content = templateContent(ctx.editorType, template)
  if (!content) {
    ctx.notify(
      ctx.editorType === 'richtext' ? ctx.locale.csdnExt.templateNoHtml : ctx.locale.csdnExt.templateEmptyBody,
      'error',
    )
    return
  }
  close()
  if (mode === 'replace') ctx.replaceDocument(content)
  else ctx.insert(content)
}

export function reportFailure(ctx: ExtensionContext, template: string, error: unknown): void {
  ctx.notify(formatMessage(template, { message: errorMessage(error) }), 'error')
}
