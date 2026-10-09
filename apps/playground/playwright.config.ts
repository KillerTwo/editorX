import { defineConfig, devices } from '@playwright/test'

const chromium = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  // Visual baselines exist for Windows (`*-chromium-win32.png`) and macOS (`*-chromium-darwin.png`); other platforms need their own.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  projects: [
    { name: 'chromium', use: chromium, grepInvert: /@perf/ },
    // Latency tests run alone, after everything else, so parallel workers don't skew them. Tracing is off: its
    // per-action DOM snapshots of the 10k-line document run on the page's main thread and add 40-280ms outliers.
    {
      name: 'chromium-perf',
      use: { ...chromium, trace: 'off' },
      grep: /@perf/,
      workers: 1,
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
