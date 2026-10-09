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
  // Visual baselines (`*-chromium-win32.png`) currently exist for Windows only; other platforms need their own.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  projects: [
    { name: 'chromium', use: chromium, grepInvert: /@perf/ },
    // Latency tests run alone, after everything else, so parallel workers don't skew them.
    { name: 'chromium-perf', use: chromium, grep: /@perf/, workers: 1, dependencies: ['chromium'] },
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
