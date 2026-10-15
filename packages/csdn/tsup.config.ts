import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const copyCssScript = fileURLToPath(new URL('../../tooling/copy-css.mjs', import.meta.url))

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: "'use client';" },
  external: [
    'react',
    'react-dom',
    'ckeditor5',
    '@ckeditor/ckeditor5-react',
    '@geekx/markdown',
    '@geekx/markdown-core',
    '@geekx/rich-text',
    '@geekx/publish',
    '@geekx/theme',
    '@geekx/toolbar',
    '@geekx/ui',
    '@geekx/csdn-extensions',
  ],
  onSuccess: async () => {
    execFileSync(process.execPath, [copyCssScript], { cwd: packageDir, stdio: 'inherit' })
  },
})
