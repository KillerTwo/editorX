import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1727, height: 932 } })

test('空标题不能发布，取消切换后仍是 Markdown', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/csdn')
  await expect(page.locator('.ex-csdn__bar')).toBeVisible()
  await page.locator('.ex-csdn__publish').click()
  await expect(page.getByRole('alert').filter({ hasText: '文章标题需为 5～100 个字' })).toBeVisible()
  await page.getByRole('button', { name: '切换编辑器' }).click()
  await expect(page.getByRole('dialog', { name: '切换编辑器' })).toBeVisible()
  await page.getByRole('dialog', { name: '切换编辑器' }).getByRole('button', { name: '取消' }).click()
  await expect(page.locator('.ex-mde')).toBeVisible()
  await expect(page.locator('.ex-rte')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('富文本空格不计入字数，历史占位提示阶段 7', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/csdn?editor=richtext')
  await page.getByRole('textbox', { name: '文章标题' }).fill('足够长的标题')
  await page.locator('.ex-rte-body').click()
  await page.keyboard.type('你好 世界')
  await expect(page.locator('.ex-csdn-words')).toHaveText('共 4 字')
  await page.getByRole('button', { name: '历史' }).click()
  await expect(page.getByRole('status').filter({ hasText: '阶段 7 接入' })).toBeVisible()
  await page.locator('.ex-csdn__publish').click()
  await expect(page.getByRole('alert').filter({ hasText: '请至少添加 1 个文章标签' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '发布成功' })).toHaveCount(0)
  expect(errors).toEqual([])
})
