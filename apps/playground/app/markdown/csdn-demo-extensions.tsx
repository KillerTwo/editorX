import { errorMessage, type EditorExtension, type ExtensionContext, type Template } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { Bot, History, LayoutTemplate, Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'

function TemplatePicker({ ctx, close }: { ctx: ExtensionContext; close(): void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null)

  useEffect(() => {
    let alive = true
    ctx.adapters.getTemplates?.().then(
      (list) => {
        if (alive) setTemplates(list)
      },
      (error: unknown) => {
        if (alive) ctx.notify(errorMessage(error), 'error')
      },
    )
    return () => {
      alive = false
    }
  }, [ctx])

  if (!templates) return <p className="pg-mde-muted">加载中…</p>
  return (
    <ul className="pg-mde-templates">
      {templates.map((template) => (
        <li key={template.id}>
          <Button
            variant="text"
            onClick={() => {
              ctx.replaceDocument({ markdown: template.markdown, html: template.html })
              close()
            }}
          >
            {template.name}
          </Button>
        </li>
      ))}
    </ul>
  )
}

function AiPanel() {
  return (
    <div className="pg-mde-panel">
      <div className="ex-mde-panel__title">AI 助手</div>
      <p className="pg-mde-muted">AI 写作助手在阶段 7 接入 aiAssist adapter，此处为占位。</p>
    </div>
  )
}

export const csdnTemplateExtension: EditorExtension = {
  name: 'csdn:template',
  editors: ['markdown'],
  requires: ['getTemplates'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:template',
      title: '模板',
      icon: (
        <span className="pg-mde-badge-icon">
          <LayoutTemplate size={16} />
          <span className="pg-mde-dot" />
        </span>
      ),
      width: 420,
      render: (ctx, close) => <TemplatePicker ctx={ctx} close={close} />,
    },
  ],
}

export const csdnHistoryExtension: EditorExtension = {
  name: 'csdn:history',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:history',
      title: '历史版本',
      label: '历史版本',
      icon: <History size={16} />,
      disabled: () => true,
      run: () => {},
    },
  ],
}

export const csdnAiPanelExtension: EditorExtension = {
  name: 'csdn:ai',
  panels: [{ id: 'csdn:ai', title: 'AI', icon: <Bot size={20} />, position: 'right', order: 10, render: () => <AiPanel /> }],
}

export const csdnMarketingExtension: EditorExtension = {
  name: 'csdn:marketing',
  panels: [
    {
      id: 'csdn:marketing',
      title: '营销组件',
      icon: (
        <span className="pg-mde-badge-icon">
          <Megaphone size={20} />
          <span className="pg-mde-new">NEW</span>
        </span>
      ),
      position: 'right',
      order: 40,
      render: () => (
        <div className="pg-mde-panel">
          <div className="ex-mde-panel__title">营销组件</div>
          <p className="pg-mde-muted">营销组件演示面板。</p>
        </div>
      ),
    },
  ],
}

export const csdnDemoExtensions: readonly EditorExtension[] = [
  csdnTemplateExtension,
  csdnHistoryExtension,
  csdnAiPanelExtension,
  csdnMarketingExtension,
]
