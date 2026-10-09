import '@editorx/markdown-core/styles.css'
import '@editorx/toolbar/styles.css'
import '@editorx/markdown/styles.css'
import 'katex/dist/katex.min.css'
import './markdown.css'
import type { ViewMode } from '@editorx/markdown'
import { MarkdownPlayground } from './markdown-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const VIEWS: readonly ViewMode[] = ['edit', 'split', 'preview']
const MAX_TIMER_DELAY = 2 ** 31 - 1
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function MarkdownPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const view = VIEWS.find((v) => v === first(params.view)) ?? 'split'
  const autosave = Number(first(params.autosave) ?? 30000)
  return (
    <MarkdownPlayground
      fixture={first(params.fixture) === 'csdn' ? 'csdn' : 'sample'}
      view={view}
      panel={first(params.panel) || null}
      autosave={autosave > 0 && autosave <= MAX_TIMER_DELAY ? autosave : 0}
    />
  )
}
