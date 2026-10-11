import { errorMessage, type EditorExtension, type ExtensionContext, type Template } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { History } from 'lucide-react'
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

/** CSDN 模板按钮的草稿（软盘）图标：16 盒内墨迹 12×12（G30） */
function DraftIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1} aria-hidden="true">
      <path d="M2.5 2.5h11v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M5 2.5v4h6v-4M9 3.75v1.5" />
    </svg>
  )
}

/** 紫色渐变「AI」字标（G31）；渐变 id 固定，页面上只渲染一次 */
function AiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pg-mde-ai-gradient" x1="2" y1="10" x2="18" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--ex-color-mde-ai-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ex-color-mde-ai-to)' }} />
        </linearGradient>
      </defs>
      <path
        d="M2.5 16 7 4h2l4.5 12M4.4 11.5h7.2M16.5 4v12"
        stroke="url(#pg-mde-ai-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 营销组件：票券轮廓 + 虚线（G31） */
function MarketingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 5.5h15v3a1.5 1.5 0 0 0 0 3v3h-15v-3a1.5 1.5 0 0 0 0-3z" />
      <path d="M12.5 6.5v7" strokeDasharray="1.5 1.5" />
    </svg>
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
          <DraftIcon />
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
  panels: [{ id: 'csdn:ai', title: 'AI', icon: <AiIcon />, position: 'right', order: 10, render: () => <AiPanel /> }],
}

export const csdnMarketingExtension: EditorExtension = {
  name: 'csdn:marketing',
  panels: [
    {
      id: 'csdn:marketing',
      title: '营销组件',
      icon: (
        <span className="pg-mde-badge-icon">
          <MarketingIcon />
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
