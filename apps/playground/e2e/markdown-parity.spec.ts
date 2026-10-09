import { expect, test, type Locator, type Page } from '@playwright/test'

test.skip(process.platform !== 'win32', 'Windows-only geometry')

// 数值实测自 apps/playground/public/reference/screenshot_2026-10-09_12-35-10.png（2558×1308，Markdown 模式 + AI 面板）
// 参考图显示常驻滚动条；Playwright 无头模式默认 --hide-scrollbars，这里恢复真实滚动条
test.use({ viewport: { width: 2558, height: 1308 }, launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  expect(b, '元素不可见').not.toBeNull()
  return b!
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: 实际 ${actual}，期望 ${expected}±${tolerance}`).toBeLessThanOrEqual(tolerance)
}

async function open(page: Page, view: 'edit' | 'split') {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto(`/markdown?fixture=csdn&view=${view}&panel=csdn:ai`)
  await expect(page.getByRole('complementary', { name: 'AI' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('外框、页签、工具栏、状态栏、面板与图标栏位置', async ({ page }) => {
  await open(page, 'edit')

  const main = await box(page.locator('.ex-mde-main'))
  near(main.x, 14, 1, 'main.x')
  near(main.y, 77, 1, 'main.y')
  near(main.width, 2050, 2, 'main.width')
  near(main.height, 1217, 2, 'main.height')

  // 期望值为 CSS 边缘坐标（像素索引 +1 处），不是参考图中最后一个着色像素的索引
  const tabs = page.getByRole('tab')
  const expectedX = [26, 157, 243]
  const expectedWidth = [119, 74, 74]
  for (let i = 0; i < 3; i++) {
    const t = await box(tabs.nth(i))
    near(t.x, expectedX[i]!, 3, `tab${i}.x`)
    near(t.y, 89, 1, `tab${i}.y`)
    near(t.height, 32, 1, `tab${i}.height`)
    near(t.width, expectedWidth[i]!, i === 0 ? 4 : 1, `tab${i}.width`)
  }
  await expect(tabs.first()).toHaveCSS('font-weight', '600')

  const headerEnd = await box(page.locator('.ex-mde-header__end'))
  near(headerEnd.x + headerEnd.width, 2052, 3, 'headerEnd 右缘')

  const toolbar = page.locator('.ex-mde-toolbar')
  const bar = await box(toolbar)
  near(bar.y + bar.height, 177, 1, '工具栏底边')
  await expect(toolbar).toHaveCSS('height', '39px')
  await expect(toolbar).toHaveCSS('padding-left', '10px')
  await expect(toolbar).toHaveCSS('padding-right', '10px')
  const bold = await box(page.getByRole('toolbar', { name: '编辑工具栏' }).getByRole('button', { name: '加粗' }))
  near(bold.x + bold.width / 2, 38, 2, '加粗 中心 x')
  near(bold.y + bold.height / 2, 157, 2, '加粗 中心 y')

  const statusBar = page.locator('.ex-mde-status')
  const status = await box(statusBar)
  near(status.y, 1230, 1, '状态栏顶')
  await expect(statusBar).toHaveCSS('padding', '9px 24px 12px 25px')
  await expect(statusBar).toHaveCSS('font-size', '12px')
  await expect(statusBar).toHaveCSS('line-height', '21px')
  const md = await box(page.locator('.ex-mde-status__md'))
  const html = await box(page.locator('.ex-mde-status__html'))
  near(md.y + md.height / 2, 1250.5, 1.5, '状态栏第一行中心')
  near(html.y + html.height / 2, 1271.5, 1.5, '状态栏第二行中心')
  near(md.x, 40, 3, '状态栏文字 x')

  const panelEl = page.locator('.ex-mde-panel')
  const panel = await box(panelEl)
  near(panel.x, 2080, 2, 'panel.x')
  near(panel.width, 390, 1, 'panel.width')
  await expect(panelEl).toHaveCSS('padding-top', '10px')
  await expect(panelEl).toHaveCSS('padding-bottom', '10px')
  const rail = await box(page.getByRole('navigation', { name: '侧边栏' }))
  near(rail.x, 2486, 2, 'rail.x')
  near(rail.width, 56, 1, 'rail.width')

  const paddingLeft = await page.locator('.ex-editor-content').evaluate((el) => getComputedStyle(el).paddingLeft)
  near(Number.parseFloat(paddingLeft), 410, 1, 'Markdown 模式内容左 padding')
})

test('比对模式：编辑区宽度、内边距与预览底色', async ({ page }) => {
  await open(page, 'split')
  const editor = await box(page.locator('.ex-mde-editor'))
  near(editor.width, 1025, 16, '比对模式编辑区宽')
  await expect(page.locator('.ex-editor-content')).toHaveCSS('padding', '16px 24px')
  await expect(page.locator('.ex-mde-preview-pane')).toHaveCSS('background-color', 'rgb(249, 249, 249)')
  await expect(page.locator('.ex-mde-preview')).toHaveCSS('padding', '16px 40px')
})

test('编辑区与预览滚动条宽 8px（参考图滑块占 x 2056–2063）', async ({ page }) => {
  await open(page, 'split')
  const width = (selector: string) => page.locator(selector).evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
  expect(await width('.ex-mde-editor'), '编辑区滚动条宽').toBe(8)
  expect(await width('.ex-mde-preview-pane'), '预览滚动条宽').toBe(8)
})
