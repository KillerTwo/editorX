import '@geekx/markdown-core/styles.css'
import '@geekx/toolbar/styles.css'
import '@geekx/markdown/styles.css'
import 'katex/dist/katex.min.css'
import type { EditorType } from '@geekx/toolbar'
import { CsdnPlayground } from './csdn-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function CsdnPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const editorParam = first(params.editor)
  const editor: EditorType = editorParam === 'richtext' ? 'richtext' : 'markdown'
  return (
    <CsdnPlayground editor={editor} drawer={first(params.drawer) ?? null} scroll={first(params.scroll) ?? null} />
  )
}
