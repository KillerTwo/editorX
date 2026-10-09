import { expect, test, type Page } from '@playwright/test'
import { testPng } from './helpers'

test.skip(process.platform !== 'win32' && process.platform !== 'darwin', 'Windows/macOS-only visual baselines')

type Scheme = 'light' | 'dark'

// 定时发布弹窗的默认时间由 Date.now() 推算，固定时钟才能得到稳定基线；计时器照常运行
const FIXED_TIME = new Date('2026-10-09T10:00:00')
const INLINE_VIEWPORT = { width: 1440, height: 1310 }
const MODAL_VIEWPORT = { width: 1440, height: 1000 }

async function openInline(page: Page, scheme: Scheme) {
  await page.clock.setFixedTime(FIXED_TIME)
  await page.setViewportSize(INLINE_VIEWPORT)
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto('/publish')
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.mouse.move(0, 0)
}

async function openModal(page: Page, scheme: Scheme) {
  await page.clock.setFixedTime(FIXED_TIME)
  await page.setViewportSize(MODAL_VIEWPORT)
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto('/publish?mode=modal')
  const dialog = page.getByRole('dialog', { name: '发布文章' })
  await expect(dialog).toBeVisible()
  // 页面加载即打开时关闭按钮的初始焦点会显示 focus-visible 外框；像用户一样关掉再用鼠标点开
  await dialog.locator('.ex-modal__footer').getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: '打开发布弹窗' }).click()
  await expect(dialog).toBeVisible()
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(dialog.getByText('您暂时不能添加分类专栏!')).toBeVisible()
  const thumbs = dialog.locator('.ex-pub-cover__thumb img')
  await expect(thumbs).toHaveCount(2)
  for (const img of await thumbs.all()) await expect(img).toHaveJSProperty('complete', true)
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  return dialog
}

for (const scheme of ['light', 'dark'] as const) {
  test(`视觉基线：内联卡片 / ${scheme}`, async ({ page }) => {
    await openInline(page, scheme)
    await expect(page).toHaveScreenshot(`publish-inline-${scheme}.png`)
  })

  test(`视觉基线：发布弹窗 / ${scheme}`, async ({ page }) => {
    await openModal(page, scheme)
    await expect(page).toHaveScreenshot(`publish-modal-${scheme}.png`)
  })
}

test('视觉基线：标签弹层', async ({ page }) => {
  await openInline(page, 'light')
  await page.getByRole('button', { name: '添加文章标签' }).click()
  await expect(page.getByRole('list', { name: '推荐标签' }).getByRole('button')).toHaveCount(6)
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('publish-tags-popover-light.png')
})

// 没有 CSDN 参考图，仅作稳定性基线
test('视觉基线：定时发布弹窗', async ({ page }) => {
  await openInline(page, 'light')
  await page.locator('.ex-pub-bar').getByRole('button', { name: '定时发布', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '定时发布' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('publish-schedule-light.png')
})

test('视觉基线：封面裁剪弹窗', async ({ page }) => {
  const dialog = await openModal(page, 'light')
  const buffer = await testPng(page)
  const chooser = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: '从本地上传' }).click()
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer })
  const crop = page.getByRole('dialog', { name: '裁剪封面' })
  await expect(crop.getByRole('button', { name: '确定' })).toBeEnabled()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('publish-crop-light.png')
})
