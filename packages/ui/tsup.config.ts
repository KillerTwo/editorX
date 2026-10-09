import { execFileSync } from 'node:child_process'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: "'use client';" },
  // tsup's string onSuccess cannot pass arguments on Windows, so spawn node directly
  onSuccess: async () => {
    execFileSync(process.execPath, ['../../tooling/copy-css.mjs'], { stdio: 'inherit' })
  },
})
