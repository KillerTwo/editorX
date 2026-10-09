import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { CompareView } from './compare-view'

async function listReferences(): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), 'public', 'reference'))
    return files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file)).sort()
  } catch {
    return []
  }
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; target?: string }>
}) {
  const { ref, target } = await searchParams
  const references = await listReferences()
  const selected = ref && references.includes(ref) ? ref : references[0]
  return <CompareView references={references} selected={selected} target={target ?? '/showcase'} />
}
