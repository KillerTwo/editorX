import { expect, type Page } from '@playwright/test'

export type LatencyWindow = Window & { __exLatency: number[] }

export interface LatencyStats {
  median: number
  p95: number
  max: number
  samples: number[]
}

/** 从事件创建时刻（e.timeStamp，与 performance.now 同一时钟）到下一帧之后的任务 */
export async function installKeyLatencyProbe(page: Page, selector = '.ex-editor-content') {
  await page.evaluate((sel) => {
    const w = window as unknown as LatencyWindow
    w.__exLatency = []
    document.querySelector(sel)!.addEventListener(
      'keydown',
      (e) => {
        const t0 = e.timeStamp
        requestAnimationFrame(() => {
          setTimeout(() => w.__exLatency.push(performance.now() - t0), 0)
        })
      },
      { capture: true },
    )
  }, selector)
}

export async function typeAndMeasure(page: Page, keys: string, delay: number): Promise<LatencyStats> {
  await page.evaluate(() => {
    ;(window as unknown as LatencyWindow).__exLatency = []
  })
  await page.keyboard.type(keys, { delay })
  await expect.poll(() => page.evaluate(() => (window as unknown as LatencyWindow).__exLatency.length)).toBe(keys.length)
  return latencyStats(page)
}

export async function pressAndMeasure(page: Page, keys: string[], gap: number): Promise<LatencyStats> {
  await page.evaluate(() => {
    ;(window as unknown as LatencyWindow).__exLatency = []
  })
  for (const key of keys) {
    await page.keyboard.press(key)
    await page.waitForTimeout(gap)
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as LatencyWindow).__exLatency.length)).toBe(keys.length)
  return latencyStats(page)
}

export async function latencyStats(page: Page): Promise<LatencyStats> {
  const samples = await page.evaluate(() => (window as unknown as LatencyWindow).__exLatency)
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    median: sorted[Math.floor(sorted.length / 2)]!,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    max: sorted.at(-1)!,
    samples: samples.map((s) => Math.round(s)),
  }
}
