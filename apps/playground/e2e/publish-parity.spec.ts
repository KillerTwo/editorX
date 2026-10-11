import { expect, test, type Page } from '@playwright/test'
import { box, near, scrollToBottom } from './helpers'
import { fontTol } from './platform'

test.skip(process.platform !== 'win32' && process.platform !== 'darwin', 'Windows/macOS-only geometry')

// 参考图显示常驻滚动条；Playwright 无头模式默认 --hide-scrollbars，这里恢复真实滚动条
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

const row = (page: Page, field: string) => page.locator(`[data-field="${field}"]`)

/** [字段, 顶 y, 高]：内联为页面绝对坐标（Windows 12-36-05），模态为相对模态框顶 T */
const INLINE_ROWS: Array<[field: string, top: number, height: number]> = [
  ['tags', 249, 32],
  ['cover', 313, 90],
  ['summary', 435, 148],
  ['categories', 615, 34],
  ['articleType', 681, 32],
  ['declaration', 745, 32],
  ['backup', 809, 52],
  ['visibility', 893, 32],
  ['template', 957, 32],
  ['multiPlatform', 1021, 32],
  ['activity', 1085, 74],
]

// 共享 CSS 推算，待 Windows 复测（B02）
const MODAL_ROWS: Array<[field: string, top: number, height: number]> = [
  ['tags', 73, 32],
  ['cover', 121, 90],
  ['summary', 227, 95],
  ['categories', 338, 32],
  ['articleType', 386, 32],
  ['declaration', 434, 32],
  ['backup', 482, 52],
  ['visibility', 550, 32],
  ['template', 598, 32],
  ['multiPlatform', 646, 32],
  ['activity', 694, 74],
]

const radioLabel = (page: Page, field: string, index: number) =>
  row(page, field).locator('.ex-radio').nth(index).locator('.ex-radio__label')

async function dotsX(page: Page, field: string) {
  const dots = row(page, field).locator('.ex-radio__dot')
  return Promise.all((await dots.all()).map(async (dot) => (await box(dot)).x))
}

test.describe('win32 内联卡片（12-36-05，2554×1310）', () => {
  test.skip(process.platform !== 'win32', 'Windows 参考图')
  test.use({ viewport: { width: 2554, height: 1310 } })

  test('卡片、各行、控件与底部操作栏位置', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish')
    await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    if (process.platform === 'win32') expect(clientWidth, '常驻滚动条 15px').toBe(2539)
    // 卡片在内容区水平居中，左缘随滚动条宽度变化
    const L = (clientWidth - 816) / 2
    await scrollToBottom(page)

    near((await box(page.locator('.pg-pub__header'))).height, 105, 0.5, '页头高（下边框 y=104）')
    const paper = await box(page.locator('.pg-pub__paper'))
    near(paper.y + paper.height, 192, 1, '纸面底')

    const card = await box(page.locator('.ex-pub-card'))
    near(card.x, L, 1, 'card.x')
    near(card.y, 217, 1, 'card.y')
    near(card.width, 816, 0.5, 'card.width')
    near(card.height, 998, 2, 'card.height')

    for (const [field, top, height] of INLINE_ROWS) {
      const r = await box(row(page, field))
      near(r.y, top, 1, `${field}.y`)
      near(r.height, height, 2, `${field}.height`)
    }

    const label = await box(row(page, 'tags').locator('.ex-pub-item__label'))
    near(label.x, L + 40, 1, '标签列 x')
    near(label.width, 88, 1, '标签列宽')
    const control = await box(row(page, 'tags').locator('.ex-pub-item__control'))
    near(control.x, L + 128, 1, '控件列 x')
    near(control.width, 648, 1, '控件列宽')
    // 参考图：「*」墨迹 x 958–961 紧贴标签文字，帮助图标墨迹 x 963–976
    near((await box(row(page, 'tags').locator('.ex-pub-item__required'))).x, L + 96, 1, '必填星号 x')
    near((await box(row(page, 'tags').locator('.ex-pub-item__help'))).x, L + 101, 1, '帮助图标 x')

    const add = await box(page.locator('.ex-pub-tag-add'))
    near(add.y, 251, 1, '添加标签 y')
    near(add.width, 120, 1, '添加标签宽')
    near(add.height, 28, 0.5, '添加标签高')

    const upload = await box(page.locator('.ex-pub-cover__upload'))
    near(upload.x, L + 128, 1, '上传框 x')
    near(upload.width, 160, 0.5, '上传框宽')
    near(upload.height, 90, 0.5, '上传框高')
    const empty = await box(page.locator('.ex-pub-cover__empty'))
    near(empty.x, L + 304, 1, '无图提示 x')
    near(empty.width, 472, 1, '无图提示宽')

    const textarea = await box(row(page, 'summary').locator('textarea'))
    near(textarea.width, 648, 0.5, '摘要框宽')
    near(textarea.height, 108, 0.5, '摘要框高')
    const extract = await box(page.locator('.ex-pub-summary__extract'))
    near(extract.y, 551, 1, 'AI提取摘要 y')
    near(extract.width, 120, 1, 'AI提取摘要宽')
    near(extract.height, 32, 0.5, 'AI提取摘要高')

    // 后续单选的 x 由前面选项文字宽度累加而来。共享 CSS 推算（B36 点→字 8，每个前置选项 +1），待 Windows 复测。
    const dotTol = fontTol(2, 3)
    const expectDots = async (field: string, offsets: number[]) => {
      const xs = await dotsX(page, field)
      expect(xs).toHaveLength(offsets.length)
      xs.forEach((x, i) => near(x, L + offsets[i]!, dotTol, `${field} 单选${i}.x`))
    }
    await expectDots('articleType', [128, 232, 315])
    await expectDots('visibility', [128, 239, 350, 461])
    await expectDots('multiPlatform', [128, 197])
    await expect(radioLabel(page, 'articleType', 0)).toHaveCSS('color', 'rgb(26, 26, 26)')
    await expect(radioLabel(page, 'articleType', 1)).toHaveCSS('color', 'rgb(96, 98, 102)')
    await expect(radioLabel(page, 'visibility', 3)).toHaveCSS('color', 'rgb(96, 98, 102)')

    const declaration = await box(row(page, 'declaration').locator('.ex-select'))
    near(declaration.x, L + 128, 1, '创作声明 x')
    near(declaration.width, 300, 0.5, '创作声明宽')
    near(declaration.height, 32, 0.5, '创作声明高')

    near((await box(row(page, 'backup').locator('.ex-checkbox__box'))).y, 818, 1, '复选框 y')

    const selects = row(page, 'activity').locator('.ex-select')
    const activity = await box(selects.nth(0))
    const topic = await box(selects.nth(1))
    near(activity.x, L + 164, 1, '活动 x')
    near(activity.width, 612, 1, '活动宽')
    near(activity.y, 1085, 1, '活动 y')
    near(topic.y, 1127, 1, '话题 y')

    const bar = await box(page.locator('.ex-pub-bar'))
    near(bar.y, 1241, 1, '操作栏顶')
    // 共享 CSS，mac 实测 68（Audit C §bar）
    near(bar.height, 68, 0.5, '操作栏高')
    const actions: Array<[action: string, offset: number, width: number]> = [
      ['draft', 588, 116],
      ['schedule', 720, 116],
      ['publish', 852, 96],
    ]
    for (const [action, offset, width] of actions) {
      const b = await box(page.locator(`.ex-pub-bar [data-action="${action}"]`))
      near(b.x, L + offset, 1, `${action}.x`)
      near(b.width, width, 1, `${action}.width`)
      near(b.y, 1254, 1, `${action}.y`)
      near(b.height, 40, 0.5, `${action}.height`)
    }
    // 参考图：「定时发布」文字墨迹止于 x 1661，「›」墨迹 x 1669–1675、y 1268–1279
    const chevron = await box(page.locator('.ex-pub-bar [data-action="schedule"] .ex-pub-action__chevron'))
    near(chevron.x, L + 807.5, 1, '定时发布 › x')
    near(chevron.width, 7, 0.5, '定时发布 › 宽')
    near(chevron.height, 12, 0.5, '定时发布 › 高')
    near(chevron.y + chevron.height / 2, 1274, 1, '定时发布 › 中心 y')
  })
})

test.describe('win32 发布弹窗（12-36-37，2554×1312）', () => {
  test.skip(process.platform !== 'win32', 'Windows 参考图')
  test.use({ viewport: { width: 2554, height: 1312 } })

  test('模态框尺寸、各行、控件与 footer 按钮位置', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish?mode=modal')
    const dialog = page.getByRole('dialog', { name: '发布文章' })
    await expect(dialog.getByText('您暂时不能添加分类专栏!')).toBeVisible()
    await expect(dialog.locator('.ex-pub-cover__thumb')).toHaveCount(2)
    await page.evaluate(() => document.fonts.ready)

    await expect(page.locator('.ex-pub-mask')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.19)')
    const d = await box(dialog)
    near(d.width, 740, 0.5, '模态框宽')
    // 共享 CSS 推算，待 Windows 复测（B02：高 / y −3）
    near(d.height, 872, 1, '模态框高')
    near(d.y, 220, 2, '模态框 y')
    await expect(dialog).toHaveCSS('border-radius', '0px')
    const M = d.x
    const T = d.y

    near((await box(dialog.locator('.ex-modal__title'))).x, M + 28, 1, '标题 x')
    const close = await box(dialog.locator('.ex-modal__close'))
    near(close.x + close.width / 2, M + 704, 1, '关闭按钮中心 x')
    near(close.y + close.height / 2, T + 28, 1, '关闭按钮中心 y')

    for (const [field, top, height] of MODAL_ROWS) {
      const r = await box(row(page, field))
      near(r.y - T, top, 1, `${field}.top`)
      near(r.height, height, 2, `${field}.height`)
    }

    near((await box(row(page, 'tags').locator('.ex-pub-item__label'))).x, M + 28, 1, '标签列 x')
    const control = await box(row(page, 'tags').locator('.ex-pub-item__control'))
    near(control.x, M + 120, 1, '控件列 x')
    near(control.width, 589, 1, '控件列宽')

    const upload = await box(dialog.locator('.ex-pub-cover__upload'))
    near(upload.x, M + 120, 1, '上传框 x')
    near(upload.width, 160, 0.5, '上传框宽')
    const thumb = await box(dialog.locator('.ex-pub-cover__thumb').first())
    near(thumb.x, M + 300, 1, '缩略图 x')
    near(thumb.y, T + 144, 1, '缩略图 y')
    near(thumb.width, 80, 0.5, '缩略图宽')
    near(thumb.height, 45, 0.5, '缩略图高')

    const textarea = await box(row(page, 'summary').locator('textarea'))
    near(textarea.width, 589, 0.5, '摘要框宽')
    near(textarea.height, 57, 0.5, '摘要框高')

    // 参考图：只有多平台发布一行的单选组比控件列右移 4px，选项间距仍为最小宽 75 + 32
    const multi = await dotsX(page, 'multiPlatform')
    expect(multi).toHaveLength(2)
    near(multi[0]! - M, 124, 1, 'multiPlatform 单选0.x')
    near(multi[1]! - M, 231, 1, 'multiPlatform 单选1.x')
    await expect(radioLabel(page, 'articleType', 0)).toHaveCSS('color', 'rgb(64, 158, 255)')
    await expect(radioLabel(page, 'articleType', 1)).toHaveCSS('color', 'rgb(85, 86, 102)')
    await expect(radioLabel(page, 'visibility', 3)).toHaveCSS('color', 'rgb(85, 86, 102)')

    const declaration = await box(row(page, 'declaration').locator('.ex-select'))
    near(declaration.x, M + 110, 1, '创作声明 x')
    near(declaration.width, 200, 0.5, '创作声明宽')

    const selects = row(page, 'activity').locator('.ex-select')
    const activity = await box(selects.nth(0))
    near(activity.x, M + 156, 1, '活动 x')
    near(activity.width, 521, 1, '活动宽')
    near((await box(selects.nth(1))).y - T, 736, 1, '话题 top')

    const footer = await box(dialog.locator('.ex-modal__footer'))
    near(footer.y - T, 808, 1, 'footer top')
    near(footer.height, 64, 0.5, 'footer 高')
    const actions: Array<[action: string, offset: number, width: number]> = [
      ['cancel', 282, 70],
      ['draft', 368, 112],
      ['schedule', 496, 98],
      ['publish', 610, 96],
    ]
    for (const [action, offset, width] of actions) {
      const b = await box(dialog.locator(`.ex-modal__footer [data-action="${action}"]`))
      near(b.x, M + offset, 1, `${action}.x`)
      near(b.width, width, 1, `${action}.width`)
      near(b.height, 40, 0.5, `${action}.height`)
    }
  })
})

// INLINE_ROWS 是 Windows 12-36-05 的绝对 y；217 = 该图卡片顶 y（win32 用例的 near(card.y, 217, …)）。
// mac 19-13-37 各行相对卡片顶的距离与 Windows 相同，减去 217 即得相对值。
const MAC_INLINE_ROWS = INLINE_ROWS.map(([field, top, height]) => [field, top - 217, height] as const)

test.describe('darwin 发布弹窗（19-09-01 / 19-14-31，1714×932，DSF 2）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1714, height: 932 }, deviceScaleFactor: 2 })

  test('模态框、各行、控件列、帮助图标、星号、滚动条、footer、标签 chip', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish?mode=modal')
    const dialog = page.getByRole('dialog', { name: '发布文章' })
    await expect(dialog.getByText('您暂时不能添加分类专栏!')).toBeVisible()
    await expect(dialog.locator('.ex-pub-cover__thumb')).toHaveCount(2)
    await page.evaluate(() => document.fonts.ready)

    const d = await box(dialog)
    near(d.width, 740, 0.5, '模态框宽')
    near(d.height, 868, 1, '模态框高')
    near(d.x, 487, 1, '模态框 x')
    near(d.y, 32, 1, '模态框 y')
    const M = d.x
    const T = d.y
    for (const [field, top, height] of MODAL_ROWS) {
      const r = await box(row(page, field))
      near(r.y - T, top, 1, `${field}.top`)
      near(r.height, height, 1, `${field}.height`)
    }
    const control = await box(row(page, 'tags').locator('.ex-pub-item__control'))
    near(control.x - M, 120, 1, '控件列 x')
    near(control.width, 589, 1, '控件列宽（B01）')
    const textarea = await box(row(page, 'summary').locator('textarea'))
    near(textarea.width, 589, 0.5, '摘要框宽')
    near(textarea.height, 57, 0.5, '摘要框高（B02）')
    const activity = await box(row(page, 'activity').locator('.ex-select').first())
    near(activity.x - M, 156, 1, '活动 x')
    near(activity.width, 521, 1, '活动宽（B12）')
    near((await box(row(page, 'tags').locator('.ex-pub-item__help'))).x - M, 90, 1.5, '帮助图标 x（B05）')
    const star = await box(row(page, 'tags').locator('.ex-pub-item__required'))
    near(star.y + star.height / 2 - T, 76.5, 1.5, '必填星号中心 y（B06）')
    await expect(row(page, 'tags').locator('.ex-pub-item__required')).toHaveCSS('color', 'rgb(252, 85, 49)')
    const scrollbar = await dialog.locator('.ex-modal__body').evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
    expect(scrollbar, '弹窗滚动条宽（B01）').toBe(11)
    near((await box(dialog.locator('.ex-modal__footer'))).y - T, 804, 1, 'footer top')

    await page.getByRole('button', { name: '添加文章标签' }).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('jvm')
    await search.press('Enter')
    await search.press('Escape')
    await expect(search).toBeHidden()
    await expect(dialog, '标签面板内 Esc 不关闭发布弹窗').toBeVisible()
    const chipEl = dialog.locator('.ex-pub-tag')
    const chip = await box(chipEl)
    near(chip.x - M, 120, 1, 'chip x')
    near(chip.width, 60, 1.5, 'chip 宽（B10）')
    near(chip.height, 28, 0.5, 'chip 高')
    const close = await box(chipEl.locator('.ex-tag__close'))
    near(chip.x + chip.width - (close.x + close.width), 8.5, 1, 'chip × 右内距（B10）')
    near((await box(dialog.locator('.ex-pub-tag-add'))).x - M, 192, 1.5, '添加按钮 x（B10）')

    await dialog.getByRole('combobox', { name: '创作声明' }).click()
    const list = page.getByRole('listbox')
    near((await box(list)).width, 242, 1, '声明下拉列表宽（B18）')
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    await expect(dialog).toBeVisible()
  })
})

test.describe('darwin 内联卡片（19-13-37，1705×932，overlay 滚动条）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1705, height: 932 }, deviceScaleFactor: 2 })

  test('各行相对卡片、单选点到文字 24、固定操作栏贴底且不遮挡卡片', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish')
    await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const L = (await page.evaluate(() => document.documentElement.clientWidth) - 816) / 2
    const card = await box(page.locator('.ex-pub-card'))
    near(card.x, L, 1, 'card.x')
    for (const [field, top, height] of MAC_INLINE_ROWS) {
      const r = await box(row(page, field))
      near(r.y - card.y, top, 1, `${field}.top`)
      near(r.height, height, 2, `${field}.height`)
    }
    for (const field of ['articleType', 'visibility']) {
      const radios = row(page, field).locator('.ex-radio')
      for (let i = 0; i < (await radios.count()); i++) {
        const dot = await box(radios.nth(i).locator('.ex-radio__dot'))
        const label = await box(radios.nth(i).locator('.ex-radio__label'))
        near(label.x - dot.x, 24, 0.5, `${field} 单选${i} 点→字（B36）`)
      }
    }
    const bar = await box(page.locator('.ex-pub-bar'))
    near(bar.y + bar.height, 932, 0.5, '操作栏贴视口底')
    near(bar.height, 68, 0.5, '操作栏高')
    await scrollToBottom(page)
    const cardEnd = await box(page.locator('.ex-pub-card'))
    const barEnd = await box(page.locator('.ex-pub-bar'))
    expect(cardEnd.y + cardEnd.height + 26, '卡片底 + 26 ≤ 操作栏顶').toBeLessThanOrEqual(barEnd.y + 0.5)
  })
})
