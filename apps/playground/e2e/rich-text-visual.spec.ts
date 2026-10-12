import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'darwin', '待 Windows 复测')
test.use({ viewport: { width: 1727, height: 932 }, deviceScaleFactor: 1 })

async function settle(page: Page, path: string, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto(path)
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(page.locator('.ex-rte .ck-content')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
}

test('空文档亮色', async ({ page }) => {
  await settle(page, '/rich-text', 'light')
  await expect(page).toHaveScreenshot('rich-text-empty-light.png', { animations: 'disabled', caret: 'hide' })
})

test('收起亮色', async ({ page }) => {
  await settle(page, '/rich-text?drawer=closed', 'light')
  await expect(page.locator('.pg-rte-float')).toBeVisible()
  await expect(page).toHaveScreenshot('rich-text-collapsed-light.png', { animations: 'disabled', caret: 'hide' })
})

test('滚到卡片亮色', async ({ page }) => {
  await settle(page, '/rich-text?scroll=card', 'light')
  await expect(page.getByRole('button', { name: '回到顶部' })).toBeVisible()
  await expect(page).toHaveScreenshot('rich-text-scrolled-light.png', { animations: 'disabled', caret: 'hide' })
})

test('空文档深色', async ({ page }) => {
  await settle(page, '/rich-text', 'dark')
  await expect(page).toHaveScreenshot('rich-text-empty-dark.png', { animations: 'disabled', caret: 'hide' })
})
