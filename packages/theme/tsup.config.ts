import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const copyCssScript = fileURLToPath(new URL('../../tooling/copy-css.mjs', import.meta.url))
const USE_CLIENT = "'use client';"

// esbuild's banner applies to every entry, but server.js must stay free of 'use client'
function prependUseClient(file: string) {
  const js = readFileSync(file, 'utf8')
  if (js.startsWith(USE_CLIENT)) return
  writeFileSync(file, `${USE_CLIENT}\n${js}`)
  const mapFile = `${file}.map`
  const map = JSON.parse(readFileSync(mapFile, 'utf8'))
  map.mappings = `;${map.mappings}`
  writeFileSync(mapFile, JSON.stringify(map))
}

// A single config: tsup runs array configs in parallel and clean would race between entries
export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // tsup's string onSuccess cannot pass arguments on Windows, so spawn node directly
  onSuccess: async () => {
    prependUseClient(fileURLToPath(new URL('dist/index.js', import.meta.url)))
    execFileSync(process.execPath, [copyCssScript], { cwd: packageDir, stdio: 'inherit' })
  },
})
