import { expect, test } from '@playwright/test'

test('对照页渲染目标 iframe 与透明度滑块', async ({ page }) => {
  await page.goto('/compare?target=/showcase')
  await expect(page.locator('iframe[title="目标页面"]')).toHaveAttribute('src', '/showcase')
  await expect(page.getByRole('slider', { name: '参考图透明度' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '叠加' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '并排' })).toBeVisible()
})

test('无参考图时显示放置提示', async ({ page }) => {
  await page.goto('/compare?ref=__missing__.png')
  await expect(page.getByText('public/reference/')).toBeVisible()
})
