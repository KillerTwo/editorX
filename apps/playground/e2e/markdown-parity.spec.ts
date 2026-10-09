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

  // 由参考图按钮内容（图标/文字/下拉三角）起点反推：带文字按钮左右 10px、内部间距 6px，分隔线左右 16px
  const toolbarButtons: Array<[name: string, x: number, width: number]> = [
    ['加粗', 24, 28],
    ['斜体', 58, 28],
    ['标题', 92, 28],
    ['删除线', 126, 28],
    ['列表', 187, 84],
    ['代码块', 277, 96],
    ['更多格式', 379, 92],
    ['图片', 504, 28],
    ['链接', 538, 28],
    ['更多插入', 572, 92],
    ['模板', 697, 28],
    ['历史版本', 731, 90],
    ['更多操作', 827, 92],
  ]
  const toolbarRole = page.getByRole('toolbar', { name: '编辑工具栏' })
  for (const [name, x, width] of toolbarButtons) {
    const b = await box(toolbarRole.getByRole('button', { name, exact: true }))
    near(b.x, x, 1, `${name}.x`)
    near(b.width, width, 1, `${name}.width`)
  }
  const dividers = toolbar.locator('.ex-toolbar__divider')
  const dividerX = [170, 487, 680]
  await expect(dividers).toHaveCount(dividerX.length)
  for (let i = 0; i < dividerX.length; i++) near((await box(dividers.nth(i))).x, dividerX[i]!, 1, `分隔线${i}.x`)
  await expect(toolbarRole.getByRole('button', { name: '列表' })).toHaveCSS('font-size', '12px')

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

// 参考图 12-35-21 相对其他参考图左裁 1px、上裁 6px；以下为换算回页面坐标后的值
test('比对模式：编辑区宽度、内边距与预览底色', async ({ page }) => {
  await open(page, 'split')
  // mermaid 绘制期间在 body 上临时挂载渲染容器，页面会短暂出现纵向滚动条（宽度少 15px）
  await expect(page.locator('.ex-mde-preview [data-ex-diagram]:not([data-ex-rendered-theme])')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  const editor = await box(page.locator('.ex-mde-editor'))
  near(editor.x, 14, 1, '比对模式编辑区 x')
  near(editor.width, 1012, 1, '比对模式编辑区宽')
  const pane = await box(page.locator('.ex-mde-preview-pane'))
  near(pane.x, 1026, 1, '比对模式预览区 x')
  await expect(page.locator('.ex-editor-content')).toHaveCSS('padding', '16px')
  await expect(page.locator('.ex-mde-preview-pane')).toHaveCSS('background-color', 'rgb(249, 249, 249)')
  await expect(page.locator('.ex-mde-preview')).toHaveCSS('padding', '19px 24px 16px 42px')
})

test('目录面板：标题条与条目位置', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/markdown?fixture=csdn&view=preview&panel=toc')
  const panel = page.getByRole('complementary', { name: '目录' })
  await expect(panel).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  near((await box(panel.getByRole('heading', { level: 2 }))).y, 87, 1, '目录标题条 y')
  const items = panel.locator('.ex-mde-toc__item')
  // 参考图 12-36-59 中前两行文字墨迹顶为 127、165（行高 35px）
  near((await box(items.nth(0))).y, 120, 1, '目录第一项 y')
  near((await box(items.nth(1))).y, 155, 1, '目录第二项 y')
})

test('编辑区与预览滚动条宽 8px（参考图滑块占 x 2056–2063）', async ({ page }) => {
  await open(page, 'split')
  const width = (selector: string) => page.locator(selector).evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
  expect(await width('.ex-mde-editor'), '编辑区滚动条宽').toBe(8)
  expect(await width('.ex-mde-preview-pane'), '预览滚动条宽').toBe(8)
})
