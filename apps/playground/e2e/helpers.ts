import { expect, type Locator, type Page } from '@playwright/test'

export async function box(locator: Locator) {
  const b = await locator.boundingBox()
  expect(b, '元素不可见').not.toBeNull()
  return b!
}

export function near(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: 实际 ${actual}，期望 ${expected}±${tolerance}`).toBeLessThanOrEqual(tolerance)
}

/** 滚到页面底部，并轮询直到视口确实贴底 */
export async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect
    .poll(() => page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight))
    .toBe(true)
}

/** 在页面里用 canvas 画一张 PNG（蓝底 + 居中半尺寸黄块），供文件选择器 setFiles 使用 */
export async function testPng(page: Page, width = 800, height = 600): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ w, h }) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#3d7eff'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(w / 4, h / 4, w / 2, h / 2)
      return canvas.toDataURL('image/png').split(',')[1]!
    },
    { w: width, h: height },
  )
  return Buffer.from(base64, 'base64')
}
