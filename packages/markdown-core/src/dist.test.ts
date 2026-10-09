import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface DomWindow {
  document: Document
  close(): void
}
type JsdomCtor = new (html: string, options: Record<string, unknown>) => { window: DomWindow }

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distEntry = resolve(packageDir, 'dist/index.js')
const hasDist = existsSync(distEntry)

const require = createRequire(import.meta.url)
// esbuild is not a direct dependency; reuse the copy tsup builds with
const esbuildPath = createRequire(require.resolve('tsup')).resolve('esbuild')
const { JSDOM } = require('jsdom') as { JSDOM: JsdomCtor }

// esbuild rejects jsdom's TextEncoder, so bundle in a plain Node child process
const bundleScript = `
const [esbuildPath, resolveDir, contents] = process.argv.slice(1)
require(esbuildPath)
  .build({
    stdin: { contents, resolveDir, loader: 'js' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    external: ['mermaid', 'flowchart.js'],
    logLevel: 'error',
  })
  .then((result) => process.stdout.write(result.outputFiles[0].text))
`

function bundle(contents: string): string {
  const output = execFileSync(process.execPath, ['-e', bundleScript, esbuildPath, packageDir, contents], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return output.replace(/<\/script/gi, '<\\/script')
}

async function highlightedTokensAfterLoad(script: string): Promise<number> {
  const { window } = new JSDOM(
    `<!doctype html><html><body><pre><code class="language-js">const a = 1</code></pre><script>${script}</script></body></html>`,
    { runScripts: 'dangerously', pretendToBeVisual: true },
  )
  try {
    if (window.document.readyState === 'loading') {
      await new Promise((done) => window.document.addEventListener('DOMContentLoaded', done))
    }
    await new Promise((done) => setTimeout(done, 50))
    return window.document.querySelectorAll('code .token').length
  } finally {
    window.close()
  }
}

describe.skipIf(!hasDist)('built dist in a host page', () => {
  it('harness detects Prism auto-highlighting (control)', async () => {
    expect(await highlightedTokensAfterLoad(bundle(`import 'prismjs'`))).toBeGreaterThan(0)
  })

  it('does not let Prism auto-highlight the host page', async () => {
    const script = bundle(`import * as api from './dist/index.js'\nwindow.__api = api`)
    expect(await highlightedTokensAfterLoad(script)).toBe(0)
  })
})

it.runIf(!hasDist)('dist check skipped: run `pnpm --filter @editorx/markdown-core build` first', () => {
  console.warn('[dist.test] packages/markdown-core/dist/index.js not found; skipping built-dist Prism check')
})
