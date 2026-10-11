import { expect, test, type Page } from '@playwright/test'
import { CSDN_TITLE } from '../app/markdown/csdn-sample'
import { PARAGRAPHS } from '../app/publish/fixture'
import { testPng } from './helpers'

const card = (page: Page) => page.getByRole('region', { name: '发布设置' })
const bar = (page: Page) => page.locator('.ex-pub-bar')
const modal = (page: Page) => page.getByRole('dialog', { name: '发布文章' })
const modalFooter = (page: Page) => modal(page).locator('.ex-modal__footer')
const tagButton = (page: Page) => page.getByRole('button', { name: '添加文章标签' })
const fieldError = (page: Page, field: string) => page.locator(`[data-field="${field}"] .ex-pub-item__error`)
// Next 的路由播报器也是 role="alert"，/markdown 还有两个 toast 区域，必须按文字过滤
const alert = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text })

/** RadioGroup / Checkbox 的原生 input 是 1px 透明且不接收指针的元素，用户点的是外层 label */
async function choose(page: Page, role: 'radio' | 'checkbox', name: string) {
  const input = page.getByRole(role, { name, exact: true })
  await page.locator('label').filter({ has: input }).click()
  await expect(input).toBeChecked()
}

async function open(page: Page, query = '') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/publish${query}`)
  await expect(tagButton(page)).toBeVisible()
}

/** 打开标签弹层，逐个输入并回车添加，最后 Esc 关闭弹层 */
async function addTags(page: Page, ...tags: string[]) {
  await tagButton(page).click()
  const search = page.getByRole('searchbox', { name: '搜索标签' })
  for (const tag of tags) {
    await search.fill(tag)
    await search.press('Enter')
  }
  await search.press('Escape')
  await expect(search).toBeHidden()
}

/** 读取 publish-log 中唯一一条指定类型的记录 */
async function logged(page: Page, kind: 'publish' | 'draft') {
  const entries = page.getByTestId('publish-log').locator(`li[data-kind="${kind}"]`)
  await expect(entries).toHaveCount(1)
  return JSON.parse((await entries.first().textContent())!) as Record<string, unknown>
}

async function select(page: Page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox }).click()
  await page.getByRole('option', { name: option }).click()
  await expect(page.getByRole('combobox', { name: combobox })).toContainText(option)
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

test.describe('/publish 内联', () => {
  test('标签、摘要、转载校验、下拉与单选，发布 payload 正确', async ({ page }) => {
    await open(page)

    await tagButton(page).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('rea')
    const suggestions = page.getByRole('list', { name: '推荐标签' }).getByRole('button')
    await expect(suggestions).toHaveText(['React'])
    await suggestions.first().click()
    await search.fill('自定义标签')
    await search.press('Enter')
    await expect(page.getByText('还可添加 5 个标签')).toBeVisible()
    await search.press('Escape')
    await expect(card(page).locator('.ex-pub-tag')).toHaveText(['React', '自定义标签'])

    const summary = page.getByRole('textbox', { name: '文章摘要' })
    await page.getByRole('button', { name: 'AI提取摘要' }).click()
    const extracted = await summary.inputValue()
    expect(extracted.startsWith(PARAGRAPHS[0])).toBe(true)
    expect(extracted.length).toBeLessThanOrEqual(256)
    await expect(card(page).locator('.ex-pub-summary__count')).toHaveText(`${extracted.length} / 256`)

    await choose(page, 'radio', '转载')
    const sourceUrl = page.getByRole('textbox', { name: '原文链接' })
    await expect(sourceUrl).toBeVisible()
    await bar(page).getByRole('button', { name: '发布博客' }).click()
    await expect(sourceUrl).toBeFocused()
    await expect(sourceUrl).toHaveAttribute('aria-invalid', 'true')
    await expect(alert(page, '转载或翻译文章请填写原文链接')).toBeVisible()
    await expect(fieldError(page, 'articleType')).toHaveText('转载或翻译文章请填写原文链接')
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)

    await sourceUrl.fill('https://example.com/post')
    await expect(sourceUrl).not.toHaveAttribute('aria-invalid', 'true')
    await select(page, '创作声明', '部分内容由AI辅助生成')
    await choose(page, 'radio', '粉丝可见')
    await choose(page, 'checkbox', '同时备份到GitCode')
    await select(page, '活动', '开源之夏')
    await select(page, '话题', 'AI 编程')

    await bar(page).getByRole('button', { name: '发布博客' }).click()
    await expect(page.getByText('发布成功')).toBeVisible()
    const payload = await logged(page, 'publish')
    expect(payload).toMatchObject({
      editorType: 'richtext',
      title: CSDN_TITLE,
      tags: ['React', '自定义标签'],
      summary: extracted,
      articleType: 'reprint',
      sourceUrl: 'https://example.com/post',
      declaration: 'ai',
      backupToGitCode: true,
      visibility: 'fans',
      activityId: 'summer',
      topicId: 'ai-coding',
      cover: { mode: 'single', urls: [] },
    })
    expect(payload).not.toHaveProperty('scheduledAt')
    expect(payload).not.toHaveProperty('html')
  })

  test('未填标签：错误显示在字段下并聚焦，补齐后错误消失', async ({ page }) => {
    await open(page)
    await bar(page).getByRole('button', { name: '发布博客' }).click()
    await expect(tagButton(page)).toBeFocused()
    await expect(tagButton(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(fieldError(page, 'tags')).toHaveText('请至少添加 1 个文章标签')
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)

    await addTags(page, 'Vite')
    await expect(tagButton(page)).not.toHaveAttribute('aria-invalid', 'true')
    await expect(fieldError(page, 'tags')).toHaveCount(0)
  })

  test('发布失败：错误提示，按钮恢复可用', async ({ page }) => {
    await open(page)
    await addTags(page, '发布失败')
    const publish = bar(page).getByRole('button', { name: '发布博客' })
    await publish.click()
    await expect(alert(page, '发布失败：模拟发布失败')).toBeVisible()
    await expect(publish).toBeEnabled()
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)
  })

  test('保存草稿：带分类专栏与当前设置', async ({ page }) => {
    await open(page, '?categories=1')
    await choose(page, 'checkbox', '学习笔记')
    await addTags(page, 'TypeScript')
    await bar(page).getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存')).toBeVisible()
    expect(await logged(page, 'draft')).toMatchObject({
      title: CSDN_TITLE,
      tags: ['TypeScript'],
      categories: ['notes'],
    })
  })

  test('定时发布：过去时间报错且弹窗不关，未来时间发布成功', async ({ page }) => {
    await open(page)
    await addTags(page, 'React')
    await bar(page).getByRole('button', { name: '定时发布', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '定时发布' })
    const input = dialog.getByLabel('发布时间')
    await expect(input).toHaveAttribute('type', 'datetime-local')

    await input.fill('2000-01-01T10:00')
    await dialog.getByRole('button', { name: '确定' }).click()
    await expect(dialog.locator('.ex-pub-schedule__error')).toHaveText('发布时间需晚于当前时间')
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)

    await input.fill('2099-01-01T10:00')
    await dialog.getByRole('button', { name: '确定' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('已设置定时发布：2099-01-01 10:00')).toBeVisible()
    const expected = await page.evaluate(() => new Date(2099, 0, 1, 10, 0).toISOString())
    expect(await logged(page, 'publish')).toMatchObject({ scheduledAt: expected })
  })

  test('标签面板：分类切换、按需加载；操作栏固定在视口底部且有占位（B20–B24、B37）', async ({ page }) => {
    await open(page)
    await tagButton(page).click()
    const picker = page.getByRole('dialog', { name: '标签' })
    await expect(picker.getByRole('list', { name: '推荐标签' }).getByRole('button')).toHaveCount(6)
    // 分类列是 role="tab" 的垂直 tablist（Task 12），不是 list/button
    await picker.getByRole('tab', { name: 'Java' }).click()
    await picker.getByRole('button', { name: 'Spring', exact: true }).click()
    await expect(card(page).locator('.ex-pub-tag')).toHaveText(['Spring'])
    await page.locator('.pg-pub__paper').click()
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: '关闭标签面板' }).click()
    await expect(picker).toBeHidden()

    await expect(bar(page)).toHaveCSS('position', 'fixed')
    await expect(page.locator('.ex-pub-bar-spacer')).toHaveCount(1)
    await expect(bar(page).locator('.pg-pub__count')).toHaveText(/^共 \d+ 字$/)
    await expect(bar(page).getByRole('button', { name: '回到顶部' })).toHaveCSS('font-weight', '700')
    await expect(bar(page).locator('.pg-quota')).toBeVisible()
  })
})

test.describe('/publish 模态', () => {
  test('正文图片选封面；取消后重开设置保留；Esc 只关标签弹层；发布后关闭', async ({ page }) => {
    await open(page, '?mode=modal')
    const dialog = modal(page)
    await expect(dialog).toBeVisible()
    await expect(modalFooter(page).getByRole('button')).toHaveText(['取消', '保存为草稿', '定时发布', '发布文章'])
    await expect(dialog.getByText('0/256')).toBeVisible()

    const second = dialog.getByRole('button', { name: '选择正文图片 2 作为封面' })
    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.locator('.ex-pub-cover__img')).toHaveAttribute('src', '/publish/cover-b.svg')
    await choose(page, 'radio', '翻译')

    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: '打开发布弹窗' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('radio', { name: '翻译' })).toBeChecked()
    await expect(dialog.getByRole('button', { name: '选择正文图片 2 作为封面' })).toHaveAttribute('aria-pressed', 'true')

    await tagButton(page).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('React')
    await search.press('Enter')
    await page.keyboard.press('Escape')
    await expect(search).toBeHidden()
    await expect(dialog).toBeVisible()

    await dialog.getByRole('textbox', { name: '原文链接' }).fill('https://example.com/origin')
    await modalFooter(page).getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('发布成功')).toBeVisible()
    expect(await logged(page, 'publish')).toMatchObject({
      tags: ['React'],
      articleType: 'translated',
      sourceUrl: 'https://example.com/origin',
      cover: { mode: 'single', urls: ['/publish/cover-b.svg'] },
    })
  })

  test('弹窗内浮层：创作声明下拉选项与推荐标签可用鼠标点中', async ({ page }) => {
    await open(page, '?mode=modal')
    const dialog = modal(page)
    await expect(dialog).toBeVisible()

    // 不用 force：选项被遮罩或弹窗盖住时 Playwright 的命中检查会让点击失败
    const declaration = dialog.getByRole('combobox', { name: '创作声明' })
    await expect(declaration).toContainText('无声明')
    await declaration.click()
    await page.getByRole('option', { name: '个人观点，仅供参考' }).click()
    await expect(declaration).toContainText('个人观点，仅供参考')
    await expect(page.getByRole('option')).toHaveCount(0)
    await expect(dialog).toBeVisible()

    await tagButton(page).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('script')
    const suggestions = page.getByRole('list', { name: '推荐标签' }).getByRole('button')
    await expect(suggestions).toHaveText(['TypeScript', 'JavaScript'])
    await suggestions.filter({ hasText: 'TypeScript' }).click()
    await expect(suggestions.filter({ hasText: 'TypeScript' })).toHaveAttribute('aria-pressed', 'true')
    await search.press('Escape')
    await expect(search).toBeHidden()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.ex-pub-tag')).toHaveText(['TypeScript'])

    await modalFooter(page).getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeHidden()
    expect(await logged(page, 'publish')).toMatchObject({ tags: ['TypeScript'], declaration: 'personal' })
  })

  test('本地上传封面：16:9 裁剪后上传，导出 640×360', async ({ page }) => {
    await open(page, '?mode=modal')
    const dialog = modal(page)
    const png = await testPng(page)
    const chooser = page.waitForEvent('filechooser')
    await dialog.getByRole('button', { name: '从本地上传' }).click()
    await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png })

    const crop = page.getByRole('dialog', { name: '裁剪封面' })
    await expect(crop).toBeVisible()
    await crop.getByLabel('裁剪区域，可拖动或用方向键移动').focus()
    await page.keyboard.press('ArrowDown')
    await crop.getByRole('button', { name: '确定' }).click()
    await expect(crop).toBeHidden()
    await expect(dialog).toBeVisible()

    const img = dialog.locator('.ex-pub-cover__img')
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/)
    const size = await img.evaluate(async (el: HTMLImageElement) => {
      await el.decode()
      return [el.naturalWidth, el.naturalHeight]
    })
    expect(size).toEqual([640, 360])
  })
})

test.describe('/publish 缺失 adapter', () => {
  test('hide：不渲染按钮、上传框、分类专栏与活动行；标签仍可添加', async ({ page }) => {
    await open(page, '?missing=hide')
    // 操作栏左侧 barStart 有演示页自己的「回到顶部」按钮，只统计发布操作组内的按钮
    await expect(bar(page).getByRole('button', { name: '回到顶部' })).toBeVisible()
    const actions = bar(page).getByRole('group', { name: '发布操作' })
    await expect(actions).toBeAttached()
    await expect(actions.getByRole('button')).toHaveCount(0)
    await expect(bar(page).getByRole('button')).toHaveText(['回到顶部'])
    await expect(page.locator('[data-action]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '从本地上传' })).toHaveCount(0)
    await expect(page.locator('[data-field="categories"]')).toHaveCount(0)
    await expect(page.locator('[data-field="activity"]')).toHaveCount(0)
    await addTags(page, 'React')
    await expect(card(page).locator('.ex-pub-tag')).toHaveText(['React'])
  })

  test('disable：按钮、上传框与活动/话题下拉禁用，分类专栏显示空提示', async ({ page }) => {
    await open(page, '?missing=disable')
    for (const name of ['保存草稿', '定时发布', '发布博客']) {
      await expect(bar(page).getByRole('button', { name, exact: true })).toBeDisabled()
    }
    await expect(page.getByRole('button', { name: '从本地上传' })).toBeDisabled()
    await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
    await expect(page.getByRole('combobox', { name: '活动' })).toBeDisabled()
    await expect(page.getByRole('combobox', { name: '话题' })).toBeDisabled()
  })
})

test.describe('/markdown 接入', () => {
  test('「发布文章」打开发布弹窗，以当前文档发布', async ({ page }) => {
    await page.goto('/markdown?fixture=csdn')
    await expect(page.locator('.ex-mde-status__html')).not.toHaveText('HTML 0 字数 0 段落', { timeout: 5000 })
    await page.getByRole('button', { name: '发布文章' }).click()
    const dialog = modal(page)
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'AI提取摘要' }).click()
    await expect(dialog.getByRole('textbox', { name: '文章摘要' })).not.toHaveValue('')
    await addTags(page, 'React')

    const published = page.waitForEvent('console', (msg) => msg.text().startsWith('[publish:publish] '))
    await modalFooter(page).getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('发布成功')).toBeVisible()
    const payload = JSON.parse((await published).text().slice('[publish:publish] '.length)) as Record<string, unknown>
    expect(payload).toMatchObject({ editorType: 'markdown', title: CSDN_TITLE, tags: ['React'] })
    expect(String(payload.summary).length).toBeGreaterThan(0)
  })

  test('?publish=1 首屏自动打开；Esc 关闭后可再次打开', async ({ page }) => {
    await page.goto('/markdown?fixture=csdn&publish=1')
    const dialog = modal(page)
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeVisible()
  })
})
