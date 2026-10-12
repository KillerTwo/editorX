import { expect, test, type Page } from '@playwright/test'
import { box, near } from './helpers'

test.skip(process.platform !== 'win32' && process.platform !== 'darwin', 'Windows/macOS-only geometry')
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

/** 1727 视口减去 15px 滚动条。纸 x、抽屉 x 都按这个内容宽计算。 */
const CONTENT_WIDTH = 1712

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready)
}

test.describe('darwin（19-13-05，1727×932）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1727, height: 932 } })

  test('空文档几何', async ({ page }) => {
    await page.goto('/rich-text')
    await expect(page.locator('.ex-rte-drawer')).toBeVisible()
    await expect(page.locator('.ex-rte-paper')).toBeVisible()
    await ready(page)

    const contentWidth = await page.evaluate(() => document.documentElement.clientWidth)
    near(contentWidth, CONTENT_WIDTH, 1, 'contentWidth')

    const root = await box(page.locator('.ex-rte'))
    const band = await box(page.locator('.ex-rte__band'))
    near(band.x, 0, 1, 'band.x')
    near(band.y, 0, 1, 'band.y')
    near(band.width, contentWidth, 1, 'band.w')
    near(band.height, 52, 1, 'band.h')

    const paper = await box(page.locator('.ex-rte-paper'))
    near(paper.x, (CONTENT_WIDTH - 816) / 2, 1, 'paper.x')
    near(paper.y, 85, 1, 'paper.y')
    near(paper.width, 816, 1, 'paper.w')
    expect(paper.height, 'paper.h').toBeGreaterThanOrEqual(812)

    const toc = await box(page.locator('.ex-rte-toc'))
    near(toc.x, 23, 1, 'toc.x')
    near(toc.y, 84, 1, 'toc.y')
    near(toc.width, 280, 1, 'toc.w')
    near(root.y + root.height - (toc.y + toc.height), 37, 1, 'toc.bottom')

    const drawer = await box(page.locator('.ex-rte-drawer'))
    near(drawer.x, CONTENT_WIDTH - 390, 1, 'drawer.x')
    near(drawer.y, 52, 1, 'drawer.y')
    near(drawer.width, 390, 1, 'drawer.w')
    near(root.y + root.height - (drawer.y + drawer.height), 68, 1, 'drawer.bottom')

    const bar = await box(page.locator('.ex-pub-bar.is-fixed'))
    near(bar.x, 0, 1, 'bar.x')
    near(bar.y, 932 - 68, 1, 'bar.y')
    // left:0; right:0 落在布局视口上，宽度等于内容宽，不伸进滚动条。
    near(bar.width, CONTENT_WIDTH, 1, 'bar.w')
    near(bar.height, 68, 1, 'bar.h')

    const inner = await box(page.locator('.ex-pub-bar__inner'))
    near(inner.width, 1080, 1, 'inner.w')
    near(inner.x + inner.width / 2, bar.x + bar.width / 2, 1, 'inner.center')

    const empty = await box(page.locator('.ex-rte-toc__empty'))
    near(empty.y + empty.height / 2, toc.y + toc.height / 2, 8, 'toc.empty.center')
  })

  test('收起后浮层', async ({ page }) => {
    await page.goto('/rich-text?drawer=closed')
    await expect(page.locator('.pg-rte-float')).toBeVisible()
    await ready(page)
    const float = await box(page.locator('.pg-rte-float'))
    const root = await box(page.locator('.ex-rte'))
    near(float.width, 104, 1, 'float.w')
    near(float.height, 159, 1, 'float.h')
    near(float.y, 86, 1, 'float.y')
    near(root.x + root.width - (float.x + float.width), 8, 1, 'float.right')
  })

  test('滚到卡片时窗口不滚动且按钮为回到顶部', async ({ page }) => {
    await page.goto('/rich-text?scroll=card')
    await expect(page.getByRole('button', { name: '回到顶部' })).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    const card = await box(page.locator('.ex-pub-card'))
    const scroller = await box(page.locator('.ex-rte__scroll'))
    expect(intersects(card, scroller), '卡片与滚动容器相交').toBe(true)
  })
})

test.describe('win32（12-35-51，2544×1305）', () => {
  // 待 Windows 复测
  test.skip(process.platform !== 'win32', '待 Windows 复测')
  test.use({ viewport: { width: 2559, height: 1305 } })
  test('稿纸仍按内容宽居中', async ({ page }) => {
    await page.goto('/rich-text')
    const paper = await box(page.locator('.ex-rte-paper'))
    near(paper.x, 864, 2, 'paper.x')
    near(paper.width, 816, 1, 'paper.w')
    near(paper.y, 85, 2, 'paper.y')
  })
})
