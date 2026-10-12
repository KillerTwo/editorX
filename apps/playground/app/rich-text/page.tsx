import '@editorx/toolbar/styles.css'
import { RichTextPlayground } from './rich-text-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function RichTextPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  return <RichTextPlayground drawer={first(params.drawer) || null} scroll={first(params.scroll) || null} />
}
