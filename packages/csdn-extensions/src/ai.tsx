import type { EditorExtension, ExtensionContext } from '@geekx/toolbar'
import { Button } from '@geekx/ui'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ExtField, reportFailure } from './form'

function AiPanel({ ctx }: { ctx: ExtensionContext }) {
  const copy = ctx.locale.csdnExt
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const send = () => {
    const text = prompt.trim()
    const aiAssist = ctx.adapters.aiAssist
    if (!text || !aiAssist || running) return
    setRunning(true)
    setOutput('')
    void (async () => {
      try {
        const stream = aiAssist(text, { selection: ctx.getSelectionText(), document: ctx.getDocument() })
        for await (const chunk of stream) {
          if (!alive.current) return
          setOutput((prev) => prev + chunk)
        }
      } catch (error) {
        if (!alive.current) return
        reportFailure(ctx, copy.aiPartial, error)
      } finally {
        if (alive.current) setRunning(false)
      }
    })()
  }

  return (
    <div className="ex-csdn-ext-dialog">
      <ExtField label={copy.aiPrompt}>
        {(id) => (
          <textarea id={id} className="ex-csdn-ext-area" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="button" variant="primary" disabled={prompt.trim() === '' || running} loading={running} onClick={send}>
          {copy.aiSend}
        </Button>
      </div>
      <p className="ex-csdn-ext-output" aria-label={copy.aiOutput}>
        {output}
      </p>
    </div>
  )
}

export const csdnAiExtension: EditorExtension = {
  name: 'csdn:ai',
  requires: ['aiAssist'],
  panels: [
    {
      id: 'csdn:ai',
      title: (m) => m.csdnExt.ai,
      icon: <Sparkles size={20} />,
      position: 'right',
      order: 10,
      render: (ctx) => <AiPanel ctx={ctx} />,
    },
  ],
}
