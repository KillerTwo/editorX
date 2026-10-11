import { expect, test, type Page } from '@playwright/test'
import { box, near } from './helpers'

test.skip(process.platform !== 'win32' && process.platform !== 'darwin', 'Windows/macOS-only geometry')

// 参考图显示常驻滚动条；Playwright 无头模式默认 --hide-scrollbars，这里恢复真实滚动条
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

async function open(page: Page, view: 'edit' | 'split') {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto(`/markdown?fixture=csdn&view=${view}&panel=csdn:ai`)
  await expect(page.getByRole('complementary', { name: 'AI' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test.describe('win32（12-35-10，2558×1308）', () => {
  test.skip(process.platform !== 'win32', 'Windows 参考图')
  test.use({ viewport: { width: 2558, height: 1308 } })

  // 裁切修正：顶栏 61→56、外框四周 16（相对 12-35-10 平移 +2 / −5）。
  // 字重、状态栏与正文 padding 为共享 CSS 推算，待 Windows 复测。
  test('外框、页签、工具栏、状态栏、面板与图标栏位置', async ({ page }) => {
    await open(page, 'edit')

    const main = await box(page.locator('.ex-mde-main'))
    near(main.x, 16, 1, 'main.x')
    near(main.y, 72, 1, 'main.y')
    near(main.width, 2048, 2, 'main.width')
    near(main.height, 1220, 2, 'main.height')

    // 期望值为 CSS 边缘坐标（像素索引 +1 处），不是参考图中最后一个着色像素的索引。
    // 第 2/3 个页签 x 与页签宽度依赖字体度量，见下方 fixme。
    const tabs = page.getByRole('tab')
    for (let i = 0; i < 3; i++) {
      const t = await box(tabs.nth(i))
      if (i === 0) near(t.x, 28, 3, 'tab0.x')
      near(t.y, 84, 1, `tab${i}.y`)
      near(t.height, 32, 1, `tab${i}.height`)
    }
    await expect(tabs.first()).toHaveCSS('font-weight', '500')

    const headerEnd = await box(page.locator('.ex-mde-header__end'))
    near(headerEnd.x + headerEnd.width, 2052, 3, 'headerEnd 右缘')

    const toolbar = page.locator('.ex-mde-toolbar')
    const bar = await box(toolbar)
    near(bar.y + bar.height, 172, 1, '工具栏底边')
    await expect(toolbar).toHaveCSS('height', '39px')
    await expect(toolbar).toHaveCSS('padding-left', '10px')
    await expect(toolbar).toHaveCSS('padding-right', '10px')
    const bold = await box(page.getByRole('toolbar', { name: '编辑工具栏' }).getByRole('button', { name: '加粗' }))
    near(bold.x + bold.width / 2, 40, 2, '加粗 中心 x')
    near(bold.y + bold.height / 2, 152, 2, '加粗 中心 y')

    // 由参考图按钮内容（图标/文字/下拉三角）起点反推：带文字按钮左右 10px、内部间距 6px，分隔线左右 16px
    const toolbarButtons: Array<[name: string, x: number, width: number]> = [
      ['加粗', 26, 28],
      ['斜体', 60, 28],
      ['标题', 94, 28],
      ['删除线', 128, 28],
      ['列表', 189, 84],
      ['代码块', 279, 96],
      ['更多格式', 381, 92],
      ['图片', 506, 28],
      ['链接', 540, 28],
      ['更多插入', 574, 92],
      ['模板', 699, 28],
      ['历史版本', 733, 90],
      ['更多操作', 829, 92],
    ]
    const toolbarRole = page.getByRole('toolbar', { name: '编辑工具栏' })
    for (const [name, x, width] of toolbarButtons) {
      const b = await box(toolbarRole.getByRole('button', { name, exact: true }))
      near(b.x, x, 1, `${name}.x`)
      near(b.width, width, 1, `${name}.width`)
    }
    const dividers = toolbar.locator('.ex-toolbar__divider')
    const dividerX = [172, 489, 682]
    await expect(dividers).toHaveCount(dividerX.length)
    for (let i = 0; i < dividerX.length; i++) near((await box(dividers.nth(i))).x, dividerX[i]!, 1, `分隔线${i}.x`)
    await expect(toolbarRole.getByRole('button', { name: '列表' })).toHaveCSS('font-size', '12px')

    const statusBar = page.locator('.ex-mde-status')
    const status = await box(statusBar)
    near(status.y, 1228, 1, '状态栏顶')
    await expect(statusBar).toHaveCSS('padding', '9px 16px 12px 26.5px')
    await expect(statusBar).toHaveCSS('font-size', '12px')
    await expect(statusBar).toHaveCSS('line-height', '21px')
    const md = await box(page.locator('.ex-mde-status__md'))
    const html = await box(page.locator('.ex-mde-status__html'))
    near(md.y + md.height / 2, 1248.5, 1.5, '状态栏第一行中心')
    near(html.y + html.height / 2, 1269.5, 1.5, '状态栏第二行中心')
    near(md.x, 42.5, 3, '状态栏文字 x')

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
    near(editor.x, 16, 1.5, '比对模式编辑区 x')
    near(editor.width, 1011, 1.5, '比对模式编辑区宽')
    const pane = await box(page.locator('.ex-mde-preview-pane'))
    near(pane.x, 1027, 1.5, '比对模式预览区 x')
    await expect(page.locator('.ex-editor-content')).toHaveCSS('padding', '11px 16px 16px')
    await expect(page.locator('.ex-mde-preview-pane')).toHaveCSS('background-color', 'rgb(249, 249, 249)')
    await expect(page.locator('.ex-mde-preview')).toHaveCSS('padding', '11px 24px 16px 42px')
  })

  test('目录面板：标题条与条目位置', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/markdown?fixture=csdn&view=preview&panel=toc')
    const panel = page.getByRole('complementary', { name: '目录' })
    await expect(panel).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    near((await box(panel.getByRole('heading', { level: 2 }))).y, 82, 1, '目录标题条 y')
    const items = panel.locator('.ex-mde-toc__item')
    // 参考图 12-36-59 中前两行文字墨迹顶为 127、165（行高 35px），裁切后 −5
    near((await box(items.nth(0))).y, 115, 1, '目录第一项 y')
    near((await box(items.nth(1))).y, 150, 1, '目录第二项 y')
  })

  test('编辑区与预览滚动条宽 8px（参考图滑块占 x 2056–2063）', async ({ page }) => {
    await open(page, 'split')
    const width = (selector: string) => page.locator(selector).evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
    expect(await width('.ex-mde-editor'), '编辑区滚动条宽').toBe(8)
    expect(await width('.ex-mde-preview-pane'), '预览滚动条宽').toBe(8)
  })

  test.fixme('页签宽度与第 2/3 个页签 x（共享 CSS 改为字重 500、无字距，需在 Windows 上按 12-35-10 重新实测）', async ({ page }) => {
    await open(page, 'edit')
    const tabs = page.getByRole('tab')
    near((await box(tabs.nth(0))).width, 119, 4, 'tab0.width')
    near((await box(tabs.nth(1))).x, 159, 3, 'tab1.x')
    near((await box(tabs.nth(2))).x, 245, 3, 'tab2.x')
  })
})

test.describe('darwin（mac 参考图 2026-10-10，1728×932，DSF 2）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1728, height: 932 }, deviceScaleFactor: 2 })

  async function openMac(page: Page, view: 'edit' | 'split' | 'preview', panel: string) {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`/markdown?fixture=test&view=${view}&panel=${panel}`)
    await expect(page.locator('.ex-mde-status__html')).toHaveText('HTML 4 字数 1 段落', { timeout: 5000 })
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0)
  }

  test('外框、页签、工具栏、状态栏、按钮、面板、拖柄、图标栏（19-12-09）', async ({ page }) => {
    await openMac(page, 'edit', 'csdn:ai')
    const topbar = page.locator('.pg-mde__topbar')
    await expect(topbar).toHaveCSS('height', '56px')
    await expect(topbar).toHaveCSS('border-bottom-width', '0px')
    const main = await box(page.locator('.ex-mde-main'))
    near(main.x, 16, 0.5, 'main.x')
    near(main.y, 72, 0.5, 'main.y')
    near(main.width, 1218, 1, 'main.width')
    near(main.height, 844, 1, 'main.height')

    const tabs = page.getByRole('tab')
    const tabX = [28, 155.5, 241.5]
    const tabW = [115.5, 74, 74]
    for (let i = 0; i < 3; i++) {
      const t = await box(tabs.nth(i))
      near(t.x, tabX[i]!, 1.5, `tab${i}.x`)
      near(t.width, tabW[i]!, 1.5, `tab${i}.width`)
      near(t.y, 84, 1, `tab${i}.y`)
      near(t.height, 32, 0.5, `tab${i}.height`)
    }
    await expect(tabs.first()).toHaveCSS('font-weight', '500')

    const toolbar = await box(page.locator('.ex-mde-toolbar'))
    near(toolbar.y + toolbar.height, 172, 1, '工具栏底边')
    const divider = page.locator('.ex-mde-toolbar .ex-toolbar__divider').first()
    const d = await box(divider)
    near(d.height, 17, 0.5, '分隔线高')
    near(d.y, 143.5, 1, '分隔线 y')
    await expect(divider).toHaveCSS('background-color', 'rgb(217, 217, 217)')

    const content = page.locator('.ex-editor-content')
    near(Number.parseFloat(await content.evaluate((el) => getComputedStyle(el).paddingLeft)), 101, 1, '正文左内边距（G03）')
    await expect(content).toHaveCSS('padding-top', '11px')

    const statusBar = page.locator('.ex-mde-status')
    const status = await box(statusBar)
    near(status.y, 852, 1, '状态栏顶')
    near(status.height, 64, 0.5, '状态栏高')
    await expect(statusBar).toHaveCSS('padding', '9px 16px 12px 26.5px')

    const centerY = main.y + main.height - 32
    const draft = await box(page.locator('.pg-mde-draft'))
    near(draft.x, 990, 1, '保存草稿 x')
    near(draft.width, 114, 0.5, '保存草稿宽')
    near(draft.height, 41, 1, '保存草稿高（G07）')
    near(draft.y + draft.height / 2, centerY, 1, '保存草稿中心 y（G07：主区底 −32）')
    const publish = await box(page.locator('.pg-mde-publish'))
    near(publish.x, 1120, 1, '发布文章 x')
    near(publish.width, 98, 0.5, '发布文章宽')
    near(publish.height, 43, 1, '发布文章高（G07）')
    near(publish.y + publish.height / 2, centerY, 1, '发布文章中心 y')
    await expect(page.locator('.pg-mde-publish')).toHaveCSS('border-radius', '6px')

    const quota = await box(page.locator('.pg-quota'))
    near(quota.width, 320, 0.5, '额度提示宽')
    near(quota.height, 38, 0.5, '额度提示高')
    near(quota.y + quota.height / 2, centerY, 1, '额度提示中心 y（G08）')
    near((await box(page.locator('.pg-quota__icon'))).x - quota.x, 13, 1, '额度图标偏移')

    const panel = await box(page.locator('.ex-mde-panel'))
    near(panel.x, 1250, 1, 'panel.x')
    near(panel.width, 390, 1, 'panel.width')
    const grip = page.locator('.ex-mde-panel-grip')
    const g = await box(grip)
    near(g.x + g.width / 2, 1242, 1, '拖柄中心 x（G23）')
    const after = await grip.evaluate((el) => {
      const s = getComputedStyle(el, '::after')
      return [s.top, s.width, s.height]
    })
    expect(after).toEqual(['438px', '4px', '24px'])

    const rail = page.getByRole('navigation', { name: '侧边栏' })
    const r = await box(rail)
    near(r.x, 1656, 1, 'rail.x')
    near(r.width, 56, 0.5, 'rail.width')
    near((await box(rail.locator('.ex-mde-rail__divider'))).y, 135, 1, '图标栏分隔线 y（G10）')
    const items = rail.locator('.ex-mde-rail__item:not(.ex-mde-rail__toggle)')
    near((await box(items.nth(0))).y, 144, 1, 'AI 项 y')
    near((await box(items.nth(0))).height, 51, 0.5, 'AI 项高')
    near((await box(items.nth(1))).y, 199, 1, '目录项 y')
    const badge = await box(page.locator('.pg-mde-new'))
    near(badge.x, 1686, 1, 'NEW x（G12）')
    near(badge.y, 310, 1, 'NEW y')
    near(badge.width, 22, 0.5, 'NEW 宽')
    near(badge.height, 11, 0.5, 'NEW 高')
  })

  test('比对模式：内容内边距与同步按钮（19-12-19）', async ({ page }) => {
    await openMac(page, 'split', 'csdn:ai')
    const pane = await box(page.locator('.ex-mde-preview-pane'))
    near(pane.x, 612, 1.5, '预览区 x')
    await expect(page.locator('.ex-editor-content')).toHaveCSS('padding', '11px 16px 16px')
    await expect(page.locator('.ex-mde-preview')).toHaveCSS('padding', '11px 24px 16px 42px')
    const locate = await box(page.getByRole('button', { name: '定位到编辑位置' }))
    near(locate.x, 617, 1, '定位 x（G24）')
    near(locate.y, 801, 1, '定位 y')
    near(locate.height, 16, 0.5, '定位高')
    near((await box(page.getByRole('button', { name: '同步滚动' }))).y, 830, 1.5, '同步滚动 y')
  })

  test('目录空状态（19-12-48）', async ({ page }) => {
    await openMac(page, 'preview', 'toc')
    const panel = page.getByRole('complementary', { name: '目录' })
    await expect(panel.getByRole('heading')).toHaveCount(0)
    const p = await box(panel)
    near((await box(panel.locator('.ex-mde-toc__empty-title'))).y - p.y, 49, 2, '暂无目录 行框顶')
    near((await box(panel.locator('.ex-mde-toc__empty'))).y - p.y, 86, 2, '第二行 行框顶')
    await expect(panel.getByRole('button', { name: '添加' })).toHaveCSS('color', 'rgb(39, 125, 204)')
  })

  test('编辑区与预览滚动条宽 8px', async ({ page }) => {
    // fixture=test 不溢出，gutter 为 0。8px 是溢出时的 webkit 滚动条，与 win32 open() 同一篇 csdn 文档。
    await open(page, 'split')
    const width = (selector: string) => page.locator(selector).evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
    expect(await width('.ex-mde-editor')).toBe(8)
    expect(await width('.ex-mde-preview-pane')).toBe(8)
  })
})
