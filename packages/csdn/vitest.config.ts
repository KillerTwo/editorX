import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// Vite rewrites static `new URL('./x', import.meta.url)` into `/@fs/...` or an
// http dev URL. Node's readFileSync only accepts file: URLs.
function keepNodeFileUrls(): Plugin {
  return {
    name: 'keep-node-file-urls',
    enforce: 'post',
    transform(code) {
      const next = code.replace(
        /new URL\(\s*(["'])(?:https?:\/\/[^/"']+)?(\/@fs)?(\/[^"']+)\1\s*,\s*(?:'' \+ )?import\.meta\.url\s*\)/g,
        (_full, quote: string, fsMarker: string | undefined, absPath: string) => {
          const absolute = fsMarker ? absPath : path.join(repoRoot, absPath.replace(/^\//, ''))
          return `new URL(${quote}${pathToFileURL(absolute).href}${quote})`
        },
      )
      return next === code ? null : next
    },
  }
}

export default defineConfig({
  plugins: [keepNodeFileUrls()],
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
    restoreMocks: true,
  },
})
