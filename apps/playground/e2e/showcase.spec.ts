import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/showcase')
})

test('切换主题会更新 data-ex-theme', async ({ page }) => {
  const root = page.locator('.ex-root').first()
  await expect(root).toHaveAttribute('data-ex-theme', 'light')
  await page.getByRole('button', { name: '切换到暗黑模式' }).click()
  await expect(root).toHaveAttribute('data-ex-theme', 'dark')
})

test('弹窗可打开并按 Esc 关闭', async ({ page }) => {
  await page.getByRole('button', { name: '打开弹窗' }).click()
  await expect(page.getByRole('dialog', { name: '插入投票' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '插入投票' })).toBeHidden()
})

test('Toast 提示可见', async ({ page }) => {
  await page.getByRole('button', { name: '显示提示' }).click()
  await expect(page.getByRole('status')).toHaveText('草稿已保存')
})

test('视觉基线：明亮模式', async ({ page }) => {
  await expect(page).toHaveScreenshot('showcase-light.png', { fullPage: true })
})

test('视觉基线：暗黑模式', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/showcase')
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect(page).toHaveScreenshot('showcase-dark.png', { fullPage: true })
})
