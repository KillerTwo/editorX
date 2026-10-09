'use client'

import { PublishModal, PublishPanel } from '@editorx/publish'
import { ThemeProvider } from '@editorx/theme'
import { zhCN, type EditorAdapters, type MissingAdapterPolicy, type PublishOption } from '@editorx/toolbar'
import { Button, ThemeToggle } from '@editorx/ui'
import { useMemo, useState } from 'react'
import { INLINE_DOC, MODAL_DOC, WORD_COUNT } from './fixture'
import { createPublishAdapters, type PublishLogKind } from './mock-adapters'

export interface PublishPlaygroundProps {
  mode: 'inline' | 'modal'
  /** null 为 adapter 齐全 */
  missing: MissingAdapterPolicy | null
  categories: boolean
}

// 参考图 12-36-37 的弹窗中「墨衍模板」可选；内联卡片（12-36-05）沿用包默认值（禁用）
const MODAL_TEMPLATES: readonly PublishOption[] = [
  { id: 'default', name: zhCN.publish.template.default },
  { id: 'simple', name: zhCN.publish.template.simple },
  { id: 'moyan', name: zhCN.publish.template.moyan },
]

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
          slots={{
            barStart: (
              <>
                <span>共 {WORD_COUNT} 字</span>
                <button type="button" className="pg-pub__top" onClick={() => window.scrollTo({ top: 0 })}>
                  回到顶部
                </button>
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
          templates={MODAL_TEMPLATES}
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
