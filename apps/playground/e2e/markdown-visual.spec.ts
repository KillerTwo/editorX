import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'win32' && process.platform !== 'darwin', 'Windows/macOS-only visual baselines')

type Scheme = 'light' | 'dark'
type View = 'edit' | 'split' | 'preview'

const preview = (page: Page) => page.locator('.ex-mde-preview')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: '编辑工具栏' })

async function ready(page: Page, view: View, scheme: Scheme) {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto(`/markdown?view=${view}`)
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(preview(page).locator('.ex-preview-section').first()).toBeAttached()
  if (view !== 'edit') {
    await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
    await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
  }
  await expect(page.locator('.ex-mde-status__html')).not.toHaveText('HTML 0 字数 0 段落', { timeout: 5000 })
  await page.evaluate(() => document.fonts.ready)
}

for (const scheme of ['light', 'dark'] as const) {
  for (const view of ['edit', 'split', 'preview'] as const) {
    test(`视觉基线：${view} / ${scheme}`, async ({ page }) => {
      await ready(page, view, scheme)
      await expect(page).toHaveScreenshot(`markdown-${view}-${scheme}.png`)
    })
  }
}

test('视觉基线：「列表」下拉菜单', async ({ page }) => {
  await ready(page, 'split', 'light')
  await toolbar(page).getByRole('button', { name: '列表' }).click()
  await expect(page.getByRole('menu', { name: '列表' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('markdown-menu-list-light.png')
})

test('视觉基线：链接对话框', async ({ page }) => {
  await ready(page, 'split', 'light')
  await toolbar(page).getByRole('button', { name: '链接' }).click()
  await expect(page.getByRole('dialog', { name: '链接' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('markdown-dialog-link-light.png')
})
