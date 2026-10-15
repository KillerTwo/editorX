import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
    restoreMocks: true,
    // turbo runs every package suite at once, so jsdom/CKEditor tests need headroom.
    testTimeout: 15_000,
  },
})
