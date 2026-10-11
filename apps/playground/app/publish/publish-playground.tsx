'use client'

import { PublishModal, PublishPanel } from '@editorx/publish'
import { ThemeProvider } from '@editorx/theme'
import type { EditorAdapters, MissingAdapterPolicy } from '@editorx/toolbar'
import { Button, ThemeToggle } from '@editorx/ui'
import { useMemo, useState } from 'react'
import { QuotaNotice } from '../quota-notice'
import { INLINE_DOC, MODAL_DOC, WORD_COUNT } from './fixture'
import { createPublishAdapters, type PublishLogKind } from './mock-adapters'

export interface PublishPlaygroundProps {
  mode: 'inline' | 'modal'
  /** null 为 adapter 齐全 */
  missing: MissingAdapterPolicy | null
  categories: boolean
}

interface LogEntry {
  kind: PublishLogKind
  data: object
}

function Playground({ mode, missing, categories }: PublishPlaygroundProps) {
  const [log, setLog] = useState<LogEntry[]>([])
  const [open, setOpen] = useState(mode === 'modal')
  const adapters = useMemo<EditorAdapters>(() => {
    const all = createPublishAdapters({ categories, onLog: (kind, data) => setLog((list) => [...list, { kind, data }]) })
    return missing ? { searchTags: all.searchTags } : all
  }, [categories, missing])
  const doc = mode === 'modal' ? MODAL_DOC : INLINE_DOC
  const policy = missing ?? 'hide'

  return (
    <div className="pg-pub">
      <header className="pg-pub__header">
        <strong className="pg-pub__brand">EditorX</strong>
        <span className="pg-pub__title">{doc.title}</span>
        <div className="pg-pub__controls">
          {mode === 'modal' && (
            <Button size="sm" onClick={() => setOpen(true)}>
              打开发布弹窗
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <article className="pg-pub__paper">
        <h1>{doc.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
      {mode === 'inline' ? (
        <PublishPanel
          document={doc}
          adapters={adapters}
          missingAdapter={policy}
          barPosition="fixed"
          slots={{
            barStart: (
              <>
                <span className="pg-pub__count">共 {WORD_COUNT} 字</span>
                <button type="button" className="pg-pub__top" onClick={() => window.scrollTo({ top: 0 })}>
                  回到顶部
                  <svg className="pg-pub__top-icon" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
                    <path d="M.5 5.5 5 1l4.5 4.5" />
                  </svg>
                </button>
                <QuotaNotice />
              </>
            ),
          }}
        />
      ) : (
        <PublishModal
          open={open}
          onClose={() => setOpen(false)}
          document={doc}
          adapters={adapters}
          missingAdapter={policy}
        />
      )}
      <ol data-testid="publish-log" hidden>
        {log.map((entry, index) => (
          <li key={index} data-kind={entry.kind}>
            {JSON.stringify(entry.data)}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PublishPlayground(props: PublishPlaygroundProps) {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <Playground {...props} />
    </ThemeProvider>
  )
}
