import { expect, test } from '@playwright/test'

test('对照页渲染目标 iframe 与透明度滑块', async ({ page }) => {
  await page.goto('/compare?target=/showcase')
  await expect(page.locator('iframe[title="目标页面"]')).toHaveAttribute('src', '/showcase')
  await expect(page.getByRole('slider', { name: '参考图透明度' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '叠加' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '并排' })).toBeVisible()
})

test('iframe 按参考图原始尺寸渲染，不被控制栏挤压', async ({ page }) => {
  await page.goto(
    '/compare?ref=screenshot_2026-10-09_12-35-10.png&target=%2Fmarkdown%3Ffixture%3Dcsdn%26view%3Dedit%26panel%3Dcsdn%3Aai',
  )
  const iframe = page.locator('iframe[title="目标页面"]')
  await expect(iframe).toHaveCSS('width', '2558px')
  await expect(iframe).toHaveCSS('height', '1308px')
  const frame = (await iframe.boundingBox())!
  const img = (await page.getByAltText('CSDN 参考截图').boundingBox())!
  expect(frame.x).toBe(img.x)
  expect(frame.y).toBe(img.y)
  expect(img.width).toBe(2558)
  expect(img.height).toBe(1308)
})

test('显式 ref 不存在时显示未找到提示', async ({ page }) => {
  await page.goto('/compare?ref=__missing__.png')
  await expect(page.getByText('未找到参考截图')).toBeVisible()
  await expect(page.getByText('public/reference/')).toBeVisible()
})

test('外站 target 被替换为 /showcase', async ({ page }) => {
  await page.goto('/compare?target=https://example.com')
  await expect(page.locator('iframe[title="目标页面"]')).toHaveAttribute('src', '/showcase')
})
