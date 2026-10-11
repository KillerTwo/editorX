import '@editorx/markdown-core/styles.css'
import '@editorx/toolbar/styles.css'
import '@editorx/markdown/styles.css'
import 'katex/dist/katex.min.css'
import '../quota-notice.css'
import './markdown.css'
import type { ViewMode } from '@editorx/markdown'
import { MarkdownPlayground } from './markdown-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const VIEWS: readonly ViewMode[] = ['edit', 'split', 'preview']
const FIXTURES = ['sample', 'csdn', 'test'] as const
const MAX_TIMER_DELAY = 2 ** 31 - 1
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function MarkdownPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const view = VIEWS.find((v) => v === first(params.view)) ?? 'split'
  const autosave = Number(first(params.autosave) ?? 30000)
  return (
    <MarkdownPlayground
      fixture={FIXTURES.find((f) => f === first(params.fixture)) ?? 'sample'}
      view={view}
      panel={first(params.panel) || null}
      autosave={autosave > 0 && autosave <= MAX_TIMER_DELAY ? autosave : 0}
      publish={first(params.publish) === '1'}
    />
  )
}
