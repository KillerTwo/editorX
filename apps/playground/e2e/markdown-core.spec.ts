import { expect, test, type Page } from '@playwright/test'
import { SAMPLE } from '../app/markdown-core/sample'

const editor = (page: Page) => page.locator('.ex-editor-content')
const preview = (page: Page) => page.getByTestId('preview')
const previewSections = (page: Page) => preview(page).locator('.ex-preview > .ex-preview-section')
const editorValue = (page: Page) => editor(page).evaluate((el) => el.textContent ?? '')
const changeCount = async (page: Page) => Number((await page.getByTestId('change-count').textContent())!.replace(/\D/g, ''))
const statNumber = async (page: Page, testId: string, pattern: RegExp) =>
  Number(pattern.exec((await page.getByTestId(testId).textContent()) ?? '')![1])

async function moveToEnd(page: Page) {
  await editor(page).click()
  await page.keyboard.press('Control+End')
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
  await page.keyboard.press('Control+z')
  await expect.poll(() => editorValue(page)).not.toContain('undo-test')
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+y')
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
  await page.keyboard.press('Control+Home')
  await expect(md).toContainText('当前行 1, 当前列 0')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
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

test('10k 行文档单次按键延迟 < 50ms', async ({ page }) => {
  await loadLargeDoc(page)
  await editor(page).click({ position: { x: 60, y: 30 } })
  await page.keyboard.press('End')
  await page.evaluate(() => {
    const w = window as unknown as { __exLatency: number[] }
    w.__exLatency = []
    document.querySelector('.ex-editor-content')!.addEventListener(
      'keydown',
      () => {
        const t0 = performance.now()
        requestAnimationFrame(() => {
          setTimeout(() => w.__exLatency.push(performance.now() - t0), 0)
        })
      },
      { capture: true },
    )
  })
  const keys = 'abcdefghijklmnopqrstuvwxyz0123'
  await page.keyboard.type(keys, { delay: 80 })
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __exLatency: number[] }).__exLatency.length))
    .toBe(keys.length)
  const samples = await page.evaluate(() => (window as unknown as { __exLatency: number[] }).__exLatency)
  const sorted = [...samples].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!
  test.info().annotations.push({ type: 'latency-ms', description: JSON.stringify({ median, p95, max: sorted.at(-1) }) })
  expect(await editorValue(page)).toContain(keys)
  expect(median).toBeLessThan(50)
  expect(p95).toBeLessThan(50)
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
