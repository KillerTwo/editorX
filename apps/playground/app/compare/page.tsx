import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { CompareView } from './compare-view'

const DEFAULT_TARGET = '/showcase'

async function listReferences(): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), 'public', 'reference'))
    return files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file)).sort()
  } catch {
    return []
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// browsers treat `//host` and `/\host` as protocol-relative URLs
function sanitizeTarget(value: string | undefined): string {
  return value && /^\/(?![/\\])/.test(value) ? value : DEFAULT_TARGET
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; target?: string | string[] }>
}) {
  const params = await searchParams
  const ref = first(params.ref) || undefined
  const target = sanitizeTarget(first(params.target))
  const references = await listReferences()
  const found = ref === undefined || references.includes(ref)
  const selected = ref === undefined ? references[0] : found ? ref : undefined
  return (
    <CompareView
      references={references}
      selected={selected}
      missingRef={found ? undefined : ref}
      target={target}
    />
  )
}
