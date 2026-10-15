import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// Vite rewrites static `new URL('./x', import.meta.url)` into `/@fs/...` or an
// http dev URL, and drops the trailing slash on directory URLs. Node's
// readFileSync only accepts file: URLs; without the slash, `new URL('page.tsx', root)`
// replaces the last path segment.
function keepNodeFileUrls(): Plugin[] {
  return [
    {
      name: 'keep-node-file-urls-dir',
      enforce: 'pre',
      transform(code, id) {
        const filePath = id.split('?')[0]
        if (!filePath) return null
        const next = code.replace(
          /new URL\(\s*(['"])(\.\.?\/[^'"]*\/)\1\s*,\s*import\.meta\.url\s*\)/g,
          (_full, quote: string, rel: string) => {
            const href = new URL(rel, pathToFileURL(filePath)).href
            return `new URL(${quote}${href}${quote})`
          },
        )
        return next === code ? null : next
      },
    },
    {
      name: 'keep-node-file-urls',
      enforce: 'post',
      transform(code) {
        const next = code.replace(
          /new URL\(\s*(["'])(?:https?:\/\/[^/"']+)?(\/@fs)?(\/[^"']+)\1\s*,\s*(?:'' \+ )?import\.meta\.url\s*\)/g,
          (_full, quote: string, fsMarker: string | undefined, absPath: string) => {
            // On Windows `/@fs` is followed by `/D:/...`; the leading slash must go.
            const absolute = fsMarker
              ? absPath.replace(/^\/(?=[A-Za-z]:)/, '')
              : path.join(repoRoot, absPath.replace(/^\//, ''))
            return `new URL(${quote}${pathToFileURL(absolute).href}${quote})`
          },
        )
        return next === code ? null : next
      },
    },
  ]
}

export default defineConfig({
  plugins: [keepNodeFileUrls()],
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
    restoreMocks: true,
    // turbo runs every package suite at once, so jsdom/CKEditor tests need headroom.
    testTimeout: 15_000,
  },
})
