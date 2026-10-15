import { formatMessage, type EditorExtension, type ExtensionContext, type VoteInput } from '@geekx/toolbar'
import { Button, Checkbox } from '@geekx/ui'
import { ListChecks } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { escapeHtml } from './embed-html'
import { ExtField, reportFailure } from './form'

const ICON = 16

interface VoteEmbed {
  id: string
  title: string
  options: string[]
  multiple: boolean
  deadline?: string
}

function voteHtml(payload: unknown): string {
  const data = payload as Partial<VoteEmbed>
  const title = escapeHtml(typeof data.title === 'string' ? data.title : '')
  const options = Array.isArray(data.options) ? data.options.filter((item): item is string => typeof item === 'string') : []
  const items = options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')
  return `<div class="ex-csdn-ext-card"><p class="ex-csdn-ext-card__title">投票</p><p>${title}</p><ul>${items}</ul></div>`
}

function VoteDialog({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const copy = ctx.locale.csdnExt
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [pending, setPending] = useState(false)
  const open = useRef(true)
  useEffect(() => {
    open.current = true
    return () => {
      open.current = false
    }
  }, [])
  const cleaned = options.map((option) => option.trim()).filter((option) => option !== '')
  const deadlineDate = deadline === '' ? null : new Date(deadline)
  const deadlineOk = deadline === '' || (deadlineDate !== null && !Number.isNaN(deadlineDate.getTime()))
  const canSubmit = title.trim() !== '' && cleaned.length >= 2 && deadlineOk && !pending

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    const createVote = ctx.adapters.createVote
    if (!createVote) return
    const input: VoteInput = { title: title.trim(), options: cleaned, multiple }
    if (deadlineDate) input.deadline = deadlineDate.toISOString()
    setPending(true)
    createVote(input).then(
      (result) => {
        if (!open.current) return
        const payload: VoteEmbed = { id: result.id, title: input.title, options: input.options, multiple: input.multiple }
        if (input.deadline) payload.deadline = input.deadline
        close()
        ctx.insertEmbed('vote', payload)
      },
      (error: unknown) => {
        if (!open.current) return
        setPending(false)
        reportFailure(ctx, copy.voteFailed, error)
      },
    )
  }

  return (
    <form className="ex-csdn-ext-dialog" onSubmit={submit}>
      <ExtField label={copy.voteTitle}>
        {(id) => (
          <input id={id} className="ex-csdn-ext-input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
        )}
      </ExtField>
      {options.map((option, index) => (
        <ExtField key={index} label={formatMessage(copy.voteOption, { n: index + 1 })}>
          {(id) => (
            <input
              id={id}
              className="ex-csdn-ext-input"
              value={option}
              onChange={(event) => {
                const next = options.slice()
                next[index] = event.target.value
                setOptions(next)
              }}
            />
          )}
        </ExtField>
      ))}
      <Button type="button" variant="text" onClick={() => setOptions([...options, ''])}>
        {copy.voteAddOption}
      </Button>
      <Checkbox checked={multiple} onChange={setMultiple}>
        {copy.voteMultiple}
      </Checkbox>
      <ExtField label={copy.voteDeadline}>
        {(id) => (
          <input
            id={id}
            className="ex-csdn-ext-input"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button
          type="button"
          onClick={() => {
            open.current = false
            close()
          }}
        >
          {ctx.locale.dialog.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} loading={pending}>
          {ctx.locale.dialog.confirm}
        </Button>
      </div>
    </form>
  )
}

export const csdnVoteExtension: EditorExtension = {
  name: 'csdn:vote',
  requires: ['createVote'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:vote',
      title: (m) => m.csdnExt.vote,
      label: (m) => m.csdnExt.vote,
      icon: <ListChecks size={ICON} />,
      group: 'csdn',
      order: 10,
      width: 440,
      render: (ctx, close) => <VoteDialog ctx={ctx} close={close} />,
    },
  ],
  embeds: [{ type: 'vote', renderHtml: voteHtml }],
}
