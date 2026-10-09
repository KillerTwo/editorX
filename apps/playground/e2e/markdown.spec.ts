import { expect, test, type Page } from '@playwright/test'
import { SAMPLE } from '../app/markdown-core/sample'
import { KEYS } from './platform'
import { installKeyLatencyProbe, pressAndMeasure, typeAndMeasure } from './support/latency'

const content = (page: Page) => page.locator('.ex-editor-content')
const editorRoot = (page: Page) => page.locator('.ex-mde')
const editorScroller = (page: Page) => page.locator('.ex-mde-editor')
const previewPane = (page: Page) => page.locator('.ex-mde-preview-pane')
const preview = (page: Page) => page.locator('.ex-mde-preview')
const previewSections = (page: Page) => preview(page).locator(':scope > .ex-preview-section')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: '编辑工具栏' })
const rail = (page: Page) => page.getByRole('navigation', { name: '侧边栏' })
const statusMd = (page: Page) => page.locator('.ex-mde-status__md')
const statusHtml = (page: Page) => page.locator('.ex-mde-status__html')
const editorValue = (page: Page) => content(page).evaluate((el) => el.textContent ?? '')
const saveCount = async (page: Page) => Number((await page.getByTestId('save-count').textContent())!.replace(/\D/g, ''))

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function open(page: Page, query = '') {
  await page.goto(`/markdown${query}`)
  await expect(content(page)).toBeAttached()
  await expect(previewSections(page).first()).toBeAttached()
  await expect(statusHtml(page)).not.toHaveText('HTML 0 字数 0 段落', { timeout: 5000 })
}

async function appendLine(page: Page, text: string) {
  await content(page).click()
  await page.keyboard.press(KEYS.docEnd)
  await page.keyboard.press('Enter')
  await page.keyboard.type(text)
}

async function loadLargeDoc(page: Page) {
  await page.getByRole('button', { name: '加载 10k 行文档' }).click()
  await expect(statusMd(page)).toContainText('10000 行数', { timeout: 15_000 })
}

async function pasteImage(page: Page, name: string) {
  await content(page).evaluate(
    (el, { fileName, b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], fileName, { type: 'image/png' }))
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    },
    { fileName: name, b64: PNG_BASE64 },
  )
}

function topSections(page: Page) {
  return page.evaluate(() => {
    const first = (container: Element, selector: string) => {
      const top = container.getBoundingClientRect().top
      for (const el of container.querySelectorAll<HTMLElement>(selector)) {
        if (el.getBoundingClientRect().bottom > top + 1) return Number(el.dataset.sectionIndex)
      }
      return -1
    }
    return {
      editor: first(document.querySelector('.ex-mde-editor')!, '.ex-editor-section'),
      preview: first(document.querySelector('.ex-mde-preview-pane')!, '.ex-preview-section'),
    }
  })
}

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test('工具栏「加粗」与 Ctrl+B，撤销恢复', async ({ page }) => {
  await open(page, '?view=edit')
  await appendLine(page, '甲乙')
  await page.keyboard.press(`Shift+${KEYS.lineStart}`)
  await toolbar(page).getByRole('button', { name: '加粗' }).click()
  await expect.poll(() => editorValue(page)).toContain('**甲乙**')
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => editorValue(page)).not.toContain('**甲乙**')
  await page.keyboard.press('Enter')
  await page.keyboard.type('丙丁')
  await page.keyboard.press(`Shift+${KEYS.lineStart}`)
  // Desktop Chrome 设备的 UA 是 Windows，产品在任何宿主上都按 Windows 把 Mod 解析为 Ctrl
  await page.keyboard.press('Control+b')
  await expect.poll(() => editorValue(page)).toContain('**丙丁**')
  await expect(toolbar(page).getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true')
})

test('视图模式：Markdown / 比对 / 预览', async ({ page }) => {
  await open(page, '?view=split')
  // 分隔条本身宽 0（拖动热区是 ::before），Playwright 视为不可见，只断言存在与否
  const sep = page.getByRole('separator', { name: '调整编辑区与预览区宽度' })
  await expect(sep).toHaveCount(1)
  await page.getByRole('tab', { name: 'Markdown' }).click()
  await expect(page.getByRole('tab', { name: 'Markdown' })).toHaveAttribute('aria-selected', 'true')
  await expect(sep).toHaveCount(0)
  await expect(editorScroller(page)).toBeVisible()
  await expect(previewPane(page)).toBeHidden()
  await page.getByRole('tab', { name: '预览' }).click()
  await expect(editorScroller(page)).toBeHidden()
  await expect(previewPane(page)).toBeVisible()
  await expect(statusMd(page)).toHaveCount(0)
  await page.getByRole('tab', { name: '比对' }).click()
  await expect(sep).toHaveCount(1)
  await expect(editorScroller(page)).toBeVisible()
  await expect(previewPane(page)).toBeVisible()
})

test('状态栏：格式与 CSDN 一致，随输入与光标更新', async ({ page }) => {
  await open(page, '?view=split')
  await expect(statusMd(page)).toHaveText(/^Markdown \d+ 字数 \d+ 行数 当前行 \d+, 当前列 \d+$/)
  await expect(statusMd(page)).toContainText(`${SAMPLE.split('\n').length} 行数`)
  await expect(statusHtml(page)).toHaveText(/^HTML \d+ 字数 \d+ 段落$/)
  await appendLine(page, '新增')
  await expect(statusMd(page)).toContainText(`当前行 ${SAMPLE.split('\n').length + 1}, 当前列 2`)
})

test('目录面板：自定义标题、层级字号、点击跳转预览', async ({ page }) => {
  await open(page, '?fixture=csdn&view=preview')
  await rail(page).getByRole('button', { name: '目录' }).click()
  const panel = page.getByRole('complementary', { name: '目录' })
  await expect(panel.locator('.ex-mde-panel__title')).toHaveText('这里写自定义目录标题')
  await expect(panel.getByRole('button', { name: '欢迎使用Markdown编辑器' })).toHaveCSS('font-size', '18px')
  await expect(panel.getByRole('button', { name: '新的改变' })).toHaveCSS('font-size', '16px')
  await expect(panel.getByRole('button', { name: 'SmartyPants' })).toHaveCSS('font-size', '13px')
  const target = preview(page).getByRole('heading', { name: '导入', exact: true })
  await expect(target).not.toBeInViewport()
  // 图表异步渲染会撑高预览，等它们就位后再跳转，否则目标会被推出视口
  await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
  await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
  await panel.getByRole('button', { name: '导入', exact: true }).click()
  await expect(target).toBeInViewport()
})

test('目录面板：图表未就位时立即跳转，图表撑高预览后仍对准目标', async ({ page }) => {
  await page.goto('/markdown?fixture=csdn&view=preview&panel=toc')
  const panel = page.getByRole('complementary', { name: '目录' })
  const button = panel.getByRole('button', { name: '导入', exact: true })
  await expect(button).toBeVisible()
  await button.click()
  await expect(preview(page).locator('.ex-mermaid svg').first()).toBeAttached()
  await expect(preview(page).locator('.ex-flowchart svg').first()).toBeAttached()
  await expect(preview(page).getByRole('heading', { name: '导入', exact: true })).toBeInViewport()
})

test('目录面板：Markdown 模式跳转编辑区', async ({ page }) => {
  await open(page, '?fixture=csdn&view=edit&panel=toc')
  const panel = page.getByRole('complementary', { name: '目录' })
  const line = content(page).locator('.ex-md-heading', { hasText: '导入' }).last()
  await expect(line).not.toBeInViewport()
  await panel.getByRole('button', { name: '导入', exact: true }).click()
  await expect(line).toBeInViewport()
})

test('语法面板：「更多操作 → 语法说明」与图标栏同步', async ({ page }) => {
  await open(page, '?view=split')
  await toolbar(page).getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('menuitemcheckbox', { name: '语法说明' }).click()
  await expect(page.getByRole('complementary', { name: '语法' })).toContainText('@[TOC](目录标题)')
  await expect(rail(page).getByRole('button', { name: '语法' })).toHaveAttribute('aria-pressed', 'true')
  await rail(page).getByRole('button', { name: '收起' }).click()
  await expect(page.getByRole('complementary')).toHaveCount(0)
})

test('窄屏：放不下的分组折叠进「更多」', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 })
  await open(page, '?view=edit')
  await expect(toolbar(page).getByRole('button', { name: '加粗' })).toBeVisible()
  const more = toolbar(page).getByRole('button', { name: '更多', exact: true })
  await expect(more).toBeVisible()
  await more.click()
  await expect(page.getByRole('menuitem', { name: '导入文件' })).toBeVisible()
})

test('全屏：工具栏下拉菜单浮在全屏编辑器之上，Esc 先关菜单再退出全屏', async ({ page }) => {
  await open(page, '?view=split&autosave=0')
  await toolbar(page).getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('menuitemcheckbox', { name: '全屏' }).click()
  await expect(editorRoot(page)).toHaveAttribute('data-fullscreen')

  const trigger = toolbar(page).getByRole('button', { name: '列表' })
  await trigger.click()
  const menu = page.getByRole('menu', { name: '列表' })
  await expect(menu).toBeVisible()
  await expect(menu).toBeInViewport({ ratio: 1 })
  const onTop = await menu.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return hit !== null && el.contains(hit)
  })
  expect(onTop).toBe(true)

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(editorRoot(page)).toHaveAttribute('data-fullscreen')
  await expect(trigger).toBeFocused()
  // 焦点回到触发按钮会显示 tooltip：下一次 Esc 先关闭 tooltip，再一次才退出全屏
  const tooltip = page.getByRole('tooltip', { name: '列表' })
  await expect(tooltip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tooltip).toBeHidden()
  await expect(editorRoot(page)).toHaveAttribute('data-fullscreen')
  await page.keyboard.press('Escape')
  await expect(editorRoot(page)).not.toHaveAttribute('data-fullscreen')
})

test('分隔条：拖动调整宽度，键盘 End 到 80%', async ({ page }) => {
  await open(page, '?view=split')
  const sep = page.getByRole('separator', { name: '调整编辑区与预览区宽度' })
  const body = (await page.locator('.ex-mde-body').boundingBox())!
  const handle = (await sep.boundingBox())!
  const y = body.y + body.height / 2
  await page.mouse.move(handle.x + 2, y)
  await page.mouse.down()
  // 按位移拖动：从 50% 向左移 20% 的宽度
  await page.mouse.move(handle.x + 2 - body.width * 0.2, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => Number(await sep.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(29)
  expect(Number(await sep.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(31)
  const editorWidth = (await editorScroller(page).boundingBox())!.width
  const handleAfter = (await sep.boundingBox())!
  expect(Math.abs(handleAfter.x - (handle.x - body.width * 0.2))).toBeLessThan(body.width * 0.012)
  expect(Math.abs(editorWidth - (body.width * 0.3 - 13))).toBeLessThan(body.width * 0.012)
  await sep.focus()
  await page.keyboard.press('End')
  await expect(sep).toHaveAttribute('aria-valuenow', '80')
})

test('粘贴图片：上传成功替换为图片地址', async ({ page }) => {
  await open(page, '?view=edit')
  await appendLine(page, '')
  await pasteImage(page, 'shot.png')
  await expect.poll(() => editorValue(page)).toContain('![shot](data:image/png;base64,')
  expect(await editorValue(page)).not.toContain('ex-uploading://')
})

test('粘贴图片：上传失败提示，失败条可删除占位', async ({ page }) => {
  await open(page, '?view=edit')
  await appendLine(page, '')
  await pasteImage(page, 'fail.png')
  await expect(page.getByRole('alert').filter({ hasText: '图片 fail.png 上传失败：模拟上传失败' })).toBeVisible()
  const strip = page.getByRole('list', { name: '上传失败的图片' })
  await expect(strip).toContainText('fail.png 上传失败')
  await expect.poll(() => editorValue(page)).toContain('ex-upload-failed://')
  await strip.getByRole('button', { name: '删除 fail.png' }).click()
  await expect.poll(() => editorValue(page)).not.toContain('ex-upload-failed://')
  await expect(strip).toHaveCount(0)
})

test('自动保存：编辑后按间隔保存，状态栏显示保存时间', async ({ page }) => {
  await open(page, '?view=edit&autosave=500')
  await page.waitForTimeout(700)
  await expect(page.getByTestId('save-count')).toHaveText('保存 0')
  await appendLine(page, '自动保存')
  const saveStatus = page.locator('.ex-mde-status__save')
  await expect(saveStatus).toHaveText(/^文章已保存\d{2}:\d{2}:\d{2}$/)
  // 输入跨过一次间隔时，最终内容之前可能已有一次自动保存；再等一个间隔确认没有排队中的保存
  await page.waitForTimeout(700)
  await expect(saveStatus).toHaveText(/^文章已保存\d{2}:\d{2}:\d{2}$/)
  const autoSaves = await saveCount(page)
  expect(autoSaves).toBeGreaterThanOrEqual(1)
  await page.waitForTimeout(700)
  expect(await saveCount(page)).toBe(autoSaves)
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByTestId('save-count')).toHaveText(`保存 ${autoSaves + 1}`)
})

test('只读：编辑区只读，格式按钮禁用，导出仍可用', async ({ page }) => {
  await open(page, '?view=edit')
  await page.getByLabel('只读').check()
  await expect(content(page)).toHaveAttribute('aria-readonly', 'true')
  await expect(toolbar(page).getByRole('button', { name: '加粗' })).toBeDisabled()
  await expect(toolbar(page).getByRole('button', { name: '更多操作' })).toBeEnabled()
  const before = await editorValue(page)
  await content(page).click()
  await page.keyboard.type('x')
  expect(await editorValue(page)).toBe(before)
})

test('主题切换：外壳与浮层跟随暗色', async ({ page }) => {
  await open(page, '?view=split')
  await page.getByRole('button', { name: '切换到暗黑模式' }).click()
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect(page.locator('.ex-mde-main')).toHaveCSS('background-color', 'rgb(35, 36, 40)')
  await expect(page.locator('.pg-mde')).toHaveCSS('background-color', 'rgb(17, 18, 20)')
})

test('同步滚动：10k 行文档编辑区 → 预览', async ({ page }) => {
  await open(page, '?view=split')
  await loadLargeDoc(page)
  await editorScroller(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.4
  })
  await expect.poll(() => previewPane(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect
    .poll(async () => {
      const s = await topSections(page)
      return Math.abs(s.editor - s.preview)
    })
    .toBeLessThanOrEqual(1)
})

test('10k 行文档：Ctrl+End 后仍可输入，状态栏行号正确', async ({ page }) => {
  await open(page, '?view=split')
  await loadLargeDoc(page)
  await content(page).click({ position: { x: 60, y: 30 } })
  await page.keyboard.press(KEYS.docEnd)
  await page.keyboard.type('Z')
  await expect.poll(() => editorValue(page)).toMatch(/Z\n$/)
  await expect(statusMd(page)).toContainText('当前行 10000,')
})

test.describe('性能（MarkdownEditor）', () => {
  test.describe.configure({ mode: 'serial' })

  test('10k 行文档单次按键延迟 < 50ms（连续输入、停顿输入与回车/退格）', { tag: '@perf' }, async ({ page }) => {
    test.setTimeout(90_000)
    // 关闭自动保存：30s 间隔的保存（整篇渲染 HTML）不应落进测量窗口
    await open(page, '?view=split&autosave=0')
    await loadLargeDoc(page)
    await content(page).click({ position: { x: 60, y: 30 } })
    await page.keyboard.press(KEYS.lineEnd)
    await installKeyLatencyProbe(page)

    const burstKeys = 'abcdefghijklmnopqrstuvwxyz0123'
    const burst = await typeAndMeasure(page, burstKeys, 80)
    // 260ms 间隔让 200ms 防抖的预览渲染落在两次按键之间
    const pausedKeys = '456789abcdefghijklmnopqrstuvwx'
    const paused = await typeAndMeasure(page, pausedKeys, 260)
    const before = await editorValue(page)
    const lines = await pressAndMeasure(page, [...Array<string>(10).fill('Enter'), ...Array<string>(10).fill('Backspace')], 260)
    test.info().annotations.push({ type: 'latency-ms', description: JSON.stringify({ burst, paused, lines }) })

    expect(before).toContain(burstKeys + pausedKeys)
    await expect.poll(() => editorValue(page)).toBe(before)
    expect(burst.median).toBeLessThan(50)
    expect(burst.p95).toBeLessThan(50)
    expect(paused.median).toBeLessThan(50)
    expect(paused.p95).toBeLessThan(50)
    expect(lines.median).toBeLessThan(50)
    expect(lines.p95).toBeLessThan(50)
  })

  test('10k 行文档顶部插入标题：预览更新无 > 50ms 的长任务', { tag: '@perf' }, async ({ page }) => {
    await open(page, '?view=split&autosave=0')
    await loadLargeDoc(page)
    const sections = await previewSections(page).count()
    await content(page).click({ position: { x: 60, y: 30 } })
    await page.keyboard.press(KEYS.lineEnd)
    await page.evaluate(() => {
      const w = window as unknown as { __exLongTasks: number[] }
      w.__exLongTasks = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__exLongTasks.push(entry.duration)
      }).observe({ type: 'longtask' })
    })
    await page.keyboard.press('Enter')
    await page.keyboard.type('# H')
    await expect(previewSections(page)).toHaveCount(sections + 1)
    await expect(preview(page).locator('h1', { hasText: /^H$/ })).toHaveCount(1)
    // 等预览更新的后续任务（统计、图表）跑完
    await page.waitForTimeout(500)
    const longTasks = await page.evaluate(() => (window as unknown as { __exLongTasks: number[] }).__exLongTasks)
    test.info().annotations.push({ type: 'long-tasks-ms', description: JSON.stringify(longTasks) })
    expect(longTasks).toEqual([])
  })
})
