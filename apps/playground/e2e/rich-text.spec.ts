import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1727, height: 932 } })

test('空标题不能发布，输入标题和正文后字数变化', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/rich-text')
  await page.getByRole('button', { name: '发布博客' }).click()
  // 校验失败走 error toast，播报容器是 alert。历史按钮的 info 提示才在 status。
  await expect(page.getByRole('alert').filter({ hasText: '文章标题需为 5～100 个字' })).toBeVisible()
  await page.getByRole('textbox', { name: '文章标题' }).fill('足够长的标题')
  await page.locator('.ex-rte-body').click()
  await page.keyboard.type('你好 世界')
  await expect(page.locator('.pg-rte-count')).toHaveText('共 4 字')
  await page.getByRole('button', { name: '历史' }).click()
  await expect(page.getByRole('status').filter({ hasText: '阶段 7 接入' })).toBeVisible()
  expect(errors).toEqual([])
})
