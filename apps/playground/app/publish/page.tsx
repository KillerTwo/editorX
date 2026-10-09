import './publish.css'
import type { MissingAdapterPolicy } from '@editorx/toolbar'
import { PublishPlayground } from './publish-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const POLICIES: readonly MissingAdapterPolicy[] = ['hide', 'disable']
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function PublishPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  return (
    <PublishPlayground
      mode={first(params.mode) === 'modal' ? 'modal' : 'inline'}
      missing={POLICIES.find((p) => p === first(params.missing)) ?? null}
      categories={first(params.categories) === '1'}
    />
  )
}
