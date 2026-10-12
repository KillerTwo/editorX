import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'darwin', '待 Windows 复测')
test.use({ viewport: { width: 1727, height: 932 }, deviceScaleFactor: 1 })

async function settle(page: Page, path: string) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto(path)
  await expect(page.locator('.ex-csdn__bar')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
}

test('Markdown 顶栏几何', async ({ page }) => {
  await settle(page, '/csdn')
  const bar = page.locator('.ex-csdn__bar')
  const box = await bar.boundingBox()
  expect(box?.y).toBe(0)
  expect(box?.height).toBe(56)
  expect(await bar.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('0px')
  const card = await page.locator('.ex-mde-main').boundingBox()
  expect(card?.x).toBe(16)
  expect(card?.y).toBe(72)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page).toHaveScreenshot('csdn-markdown-light.png', { animations: 'disabled', caret: 'hide' })
})

test('富文本顶栏几何与内部滚动', async ({ page }) => {
  await settle(page, '/csdn?editor=richtext')
  const bar = page.locator('.ex-csdn__bar')
  expect((await bar.boundingBox())?.height).toBe(56)
  await expect(page.locator('.ex-pub-bar.is-fixed').locator('..')).toHaveClass(/ex-rte-bar-host/)
  await page.locator('.ex-rte__scroll').evaluate((el) => {
    el.scrollTop = 40
  })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(await page.locator('.ex-rte__scroll').evaluate((el) => el.scrollTop)).toBe(40)
  await page.locator('.ex-rte__scroll').evaluate((el) => {
    el.scrollTop = 0
  })
  await expect(page).toHaveScreenshot('csdn-richtext-light.png', { animations: 'disabled', caret: 'hide' })
})
