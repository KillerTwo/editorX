import { expect, test, type Page } from '@playwright/test'
import { SAMPLE } from '../app/markdown-core/sample'
import { KEYS } from './platform'
import { installKeyLatencyProbe, pressAndMeasure, typeAndMeasure } from './support/latency'

const editor = (page: Page) => page.locator('.ex-editor-content')
const preview = (page: Page) => page.getByTestId('preview')
const previewSections = (page: Page) => preview(page).locator('.ex-preview > .ex-preview-section')
const editorValue = (page: Page) => editor(page).evaluate((el) => el.textContent ?? '')
const changeCount = async (page: Page) => Number((await page.getByTestId('change-count').textContent())!.replace(/\D/g, ''))
const statNumber = async (page: Page, testId: string, pattern: RegExp) =>
  Number(pattern.exec((await page.getByTestId(testId).textContent()) ?? '')![1])

async function moveToEnd(page: Page) {
  await editor(page).click()
  await page.keyboard.press(KEYS.docEnd)
}

async function loadLargeDoc(page: Page) {
  await page.getByRole('button', { name: '加载 10k 行文档' }).click()
  await expect(page.getByTestId('status-md')).toContainText('10000 行数')
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
      editor: first(document.querySelector('[data-testid=editor]')!, '.ex-editor-section'),
      preview: first(document.querySelector('[data-testid=preview]')!, '.ex-preview-section'),
    }
  })
}

async function expectAligned(page: Page) {
  await expect
    .poll(async () => {
      const s = await topSections(page)
      return Math.abs(s.editor - s.preview)
    })
    .toBeLessThanOrEqual(1)
}

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/markdown-core')
  await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
  await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test('输入实时高亮并渲染到预览', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('## 新增标题')
  await expect(editor(page).locator('.ex-md-h2', { hasText: '新增标题' })).toHaveCount(1)
  await expect(preview(page).locator('h2', { hasText: '新增标题' })).toBeVisible()
})

test('回车续写无序与有序列表', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('- 第一项')
  await page.keyboard.press('Enter')
  await page.keyboard.type('第二项')
  await page.keyboard.press('Enter')
  // 空列表项回车退出列表（只清除标记），再回车才产生空行
  await page.keyboard.press('Enter')
  await expect.poll(() => editorValue(page)).toMatch(/- 第一项\n- 第二项\n\n$/)
  await page.keyboard.press('Enter')
  await page.keyboard.type('1. 甲')
  await page.keyboard.press('Enter')
  await page.keyboard.type('乙')
  await expect.poll(() => editorValue(page)).toContain('- 第一项\n- 第二项\n\n1. 甲\n2. 乙')
  await expect(preview(page).locator('ol > li', { hasText: '乙' })).toBeVisible()
})

test('撤销与重做', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('undo-test')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => editorValue(page)).not.toContain('undo-test')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('ControlOrMeta+y')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
})

test('输入法组合输入：组合期间不重绘，提交只产生一次变更且高亮恢复', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await expect.poll(() => changeCount(page)).toBeGreaterThan(0)
  const before = await changeCount(page)
  await editor(page)
    .locator('.ex-editor-section')
    .last()
    .evaluate((el) => {
      ;(window as unknown as { __exSection: Element }).__exSection = el
    })

  const client = await page.context().newCDPSession(page)
  await client.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 })
  await client.send('Input.imeSetComposition', { text: 'nihao', selectionStart: 5, selectionEnd: 5 })
  // 断言"什么都没发生"只能等待一段时间
  await page.waitForTimeout(300)
  expect(await editorValue(page)).toContain('nihao')
  expect(await changeCount(page)).toBe(before)
  expect(await page.evaluate(() => (window as unknown as { __exSection: Element }).__exSection.isConnected)).toBe(true)

  await client.send('Input.insertText', { text: '你好' })
  await expect.poll(() => changeCount(page)).toBe(before + 1)
  await page.waitForTimeout(300)
  expect(await changeCount(page)).toBe(before + 1)
  const value = await editorValue(page)
  expect(value).toContain('你好')
  expect(value).not.toContain('nihao')

  await page.keyboard.type(' **bold**')
  await expect(editor(page).locator('.ex-md-strong', { hasText: '**bold**' })).toHaveCount(1)
  await expect(preview(page).locator('strong', { hasText: 'bold' })).toBeVisible()
})

test('状态栏：字数/行数随输入更新，行列随光标移动更新', async ({ page }) => {
  const md = page.getByTestId('status-md')
  const html = page.getByTestId('status-html')
  await expect(md).toHaveText(/^Markdown \d+ 字数 \d+ 行数 当前行 \d+, 当前列 \d+$/)
  await expect(md).toContainText(`${SAMPLE.split('\n').length} 行数`)
  await expect(html).toHaveText(/^HTML \d+ 字数 \d+ 段落$/)

  // 字数：在文末新起一段输入（不放在标题里，避免目录同步变化影响 HTML 字数）
  const lines = SAMPLE.split('\n')
  const mdWords = await statNumber(page, 'status-md', /Markdown (\d+) 字数/)
  const htmlWords = await statNumber(page, 'status-html', /HTML (\d+) 字数/)
  await moveToEnd(page)
  await expect(md).toContainText(`当前行 ${lines.length}, 当前列 0`)
  await page.keyboard.press('Enter')
  await page.keyboard.type('新增')
  await expect(md).toContainText(`当前行 ${lines.length + 1}, 当前列 2`)
  await expect.poll(() => statNumber(page, 'status-md', /Markdown (\d+) 字数/)).toBe(mdWords + 2)
  await expect.poll(() => statNumber(page, 'status-html', /HTML (\d+) 字数/)).toBe(htmlWords + 2)
  await expect(md).toContainText(`${lines.length + 1} 行数`)

  // 行列：回到开头再移动光标
  await page.keyboard.press(KEYS.docStart)
  await expect(md).toContainText('当前行 1, 当前列 0')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press(KEYS.lineEnd)
  await expect(md).toContainText(`当前行 3, 当前列 ${lines[2]!.length}`)
  await page.keyboard.type(' 新')
  await expect(md).toContainText(`当前行 3, 当前列 ${lines[2]!.length + 2}`)
})

test('自定义标题目录：渲染标题并可跳转到对应标题', async ({ page }) => {
  const toc = preview(page).locator('.ex-toc')
  await expect(toc).toHaveCount(1)
  await expect(toc.locator('.ex-toc-title')).toHaveText('这里写自定义目录标题')
  const link = toc.locator('a', { hasText: '流程图' })
  await expect(link).toHaveCount(1)
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^#.+/)
  const target = preview(page).locator(`[id="${decodeURIComponent(href!.slice(1))}"]`)
  await expect(target).toHaveText('流程图')
  await expect(target).not.toBeInViewport()
  await link.click()
  await expect(target).toBeInViewport()
  await expect.poll(() => preview(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('脚注按出现顺序编号 1、2，且只在末段输出一个列表', async ({ page }) => {
  const p = preview(page)
  await expect(p.locator('.ex-footnotes')).toHaveCount(1)
  await expect(previewSections(page).last().locator('.ex-footnotes')).toHaveCount(1)
  await expect(previewSections(page)).toHaveCount(await editor(page).locator('.ex-editor-section').count())
  await expect(p.locator('sup.footnote-ref > a')).toHaveText(['[1]', '[2]'])
  await expect(p.locator('.ex-footnotes li')).toHaveCount(2)
  await expect(p.locator('.ex-footnotes li').first()).toContainText('第一个脚注的内容')
  await expect(p.locator('.ex-footnotes li').last()).toContainText('第二个脚注的内容')
})

test('同步滚动：编辑区 → 预览、预览 → 编辑区', async ({ page }) => {
  await loadLargeDoc(page)
  const editorScroll = page.getByTestId('editor')
  const previewScroll = preview(page)

  await editorScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.4
  })
  await expect.poll(() => previewScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect.poll(async () => (await topSections(page)).editor).toBeGreaterThan(0)
  await expectAligned(page)

  const editorIndexBefore = (await topSections(page)).editor
  // 等待来源锁（100ms）过期
  await page.waitForTimeout(200)
  await previewScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.8
  })
  await expect.poll(async () => (await topSections(page)).editor).toBeGreaterThan(editorIndexBefore)
  await expectAligned(page)
})

test('同步滚动：脚注位于末段时仍按源段对齐', async ({ page }) => {
  const editorScroll = page.getByTestId('editor')
  const previewScroll = preview(page)
  await expect(previewSections(page).last().locator('.ex-footnotes')).toHaveCount(1)

  await editorScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.5
  })
  await expect.poll(() => previewScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expectAligned(page)

  await page.waitForTimeout(200)
  await editorScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expectAligned(page)

  await page.waitForTimeout(200)
  await previewScroll.evaluate((el) => {
    el.scrollTop = 0
  })
  await expect.poll(() => editorScroll.evaluate((el) => el.scrollTop)).toBeLessThanOrEqual(24)
})

test('KaTeX、Mermaid 与 flowchart.js 在亮/暗主题下真实渲染', async ({ page }) => {
  const p = preview(page)
  await expect(p.locator('.katex')).toHaveCount(2)
  await expect(p.locator('.katex-display')).toHaveCount(1)
  await expect(p.locator('.ex-mermaid')).toHaveCount(1)
  await expect(p.locator('.ex-flowchart')).toHaveCount(1)
  const mermaidSvg = p.locator('.ex-mermaid svg').first()
  const flowSvg = p.locator('.ex-flowchart svg').first()
  await expect(mermaidSvg).toContainText('编辑')
  await expect(flowSvg).toContainText('开始')
  await expect(flowSvg).toContainText('确认？')
  const lightSvg = await mermaidSvg.evaluate((el) => el.outerHTML)

  await page.getByRole('button', { name: '切换到暗黑模式' }).click()
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect.poll(() => mermaidSvg.evaluate((el) => el.outerHTML)).not.toBe(lightSvg)
  await expect(mermaidSvg).toContainText('编辑')
  await expect(flowSvg).toBeVisible()
  await expect(flowSvg).toContainText('开始')
  await expect(p.locator('.katex')).toHaveCount(2)
})

test('在图表上方插入标题：预览增量更新，已渲染的图表 SVG 不被重建', async ({ page }) => {
  const p = preview(page)
  const diagramSection = previewSections(page).filter({ has: page.locator('.ex-mermaid') })
  const indexBefore = Number(await diagramSection.getAttribute('data-section-index'))
  await p.locator('.ex-mermaid svg').first().evaluate((el) => {
    ;(window as unknown as { __exSvg: Element }).__exSvg = el
  })

  await editor(page).locator('.ex-md-h2', { hasText: '公式' }).click()
  await page.keyboard.press(KEYS.lineEnd)
  await page.keyboard.press('Enter')
  await page.keyboard.type('# 插入的标题')
  await expect(p.locator('h1', { hasText: '插入的标题' })).toBeVisible()

  await expect(diagramSection).toHaveAttribute('data-section-index', String(indexBefore + 1))
  expect(await page.evaluate(() => (window as unknown as { __exSvg: Element }).__exSvg.isConnected)).toBe(true)
  await expect(previewSections(page)).toHaveCount(await editor(page).locator('.ex-editor-section').count())
  const indices = await previewSections(page).evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.sectionIndex))
  expect(indices).toEqual(indices.map((_, i) => String(i)))
})

test.describe('性能', () => {
  test.describe.configure({ mode: 'serial' })

  test('10k 行文档单次按键延迟 < 50ms（连续输入、停顿输入与回车/退格）', { tag: '@perf' }, async ({ page }) => {
    test.setTimeout(90_000)
    await loadLargeDoc(page)
    await editor(page).click({ position: { x: 60, y: 30 } })
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
    await loadLargeDoc(page)
    const sections = await previewSections(page).count()
    await editor(page).click({ position: { x: 60, y: 30 } })
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

test('10k 行文档：Ctrl+End 跳到尚未渲染的末段后仍可输入', async ({ page }) => {
  await loadLargeDoc(page)
  await editor(page).click({ position: { x: 60, y: 30 } })
  await page.keyboard.press(KEYS.docEnd)
  await page.keyboard.type('Z')
  await expect.poll(() => editorValue(page)).toMatch(/Z\n$/)
  await expect(page.getByTestId('status-md')).toContainText('当前行 10000,')
  await expect(editor(page).locator('.ex-editor-section').last()).toBeInViewport()
})

test('视觉基线：明亮模式', async ({ page }) => {
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'light')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('markdown-core-light.png')
})

test('视觉基线：暗黑模式', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/markdown-core')
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
  await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('markdown-core-dark.png')
})
