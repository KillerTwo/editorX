import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'darwin' || process.env.EX_ACCEPTANCE !== '1', '仅 darwin 且 EX_ACCEPTANCE=1 时运行')
test.use({ viewport: { width: 1728, height: 932 }, deviceScaleFactor: 2 })

/** 每像素 RGB 最大通道差 > 48 计为不一致；不一致比例阈值 0.03（inferred default） */
const CHANNEL_TOL = 48
const MAX_MISMATCH = 0.03

interface Case {
  ref: string
  query: string
  /** 页面原点在参考图中的设备像素坐标（Global Constraints「参考几何」） */
  origin: [x: number, y: number]
  /** 比较区域（CSS px）：只比卡片 / 面板，排除顶栏（阶段 6）与 AI 面板内容（阶段 7） */
  clip: { x: number; y: number; width: number; height: number }
}

const MAIN = { x: 16, y: 72, width: 1218, height: 844 }
const MAIN_WIDE = { x: 16, y: 72, width: 1624, height: 844 }

const CASES: Case[] = [
  { ref: 'mac_2026-10-10_19-12-09.png', query: 'view=edit&panel=csdn:ai', origin: [-10, 2], clip: MAIN },
  { ref: 'mac_2026-10-10_19-12-19.png', query: 'view=split&panel=csdn:ai', origin: [-6, 2], clip: MAIN },
  { ref: 'mac_2026-10-10_19-12-27.png', query: 'view=preview&panel=csdn:ai', origin: [-10, 4], clip: MAIN },
  { ref: 'mac_2026-10-10_19-12-39.png', query: 'view=preview&panel=', origin: [-4, 0], clip: MAIN_WIDE },
  { ref: 'mac_2026-10-10_19-12-48.png', query: 'view=preview&panel=toc', origin: [0, 2], clip: MAIN_WIDE },
]

async function mismatch(page: Page, actual: Buffer, ref: string, sx: number, sy: number): Promise<number> {
  return page.evaluate(
    async ({ a, src, sx, sy, tol }) => {
      const load = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`无法加载 ${url.slice(0, 64)}`))
          img.src = url
        })
      const [ai, ri] = await Promise.all([load(`data:image/png;base64,${a}`), load(src)])
      const pixels = (img: HTMLImageElement, x: number, y: number) => {
        const canvas = document.createElement('canvas')
        canvas.width = ai.width
        canvas.height = ai.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, -x, -y)
        return ctx.getImageData(0, 0, ai.width, ai.height).data
      }
      const pa = pixels(ai, 0, 0)
      const pr = pixels(ri, sx, sy)
      let bad = 0
      for (let i = 0; i < pa.length; i += 4) {
        const diff = Math.max(Math.abs(pa[i]! - pr[i]!), Math.abs(pa[i + 1]! - pr[i + 1]!), Math.abs(pa[i + 2]! - pr[i + 2]!))
        if (diff > tol) bad++
      }
      return bad / (ai.width * ai.height)
    },
    { a: actual.toString('base64'), src: `/reference/${ref}`, sx, sy, tol: CHANNEL_TOL },
  )
}

for (const c of CASES) {
  test(`参考图比对：${c.ref}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`/markdown?fixture=test&${c.query}`)
    await expect(page.locator('.ex-mde-status__html')).toHaveText('HTML 4 字数 1 段落', { timeout: 5000 })
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0)
    const shot = await page.screenshot({ clip: c.clip, scale: 'device', caret: 'hide', animations: 'disabled' })
    const ratio = await mismatch(page, shot, c.ref, c.origin[0] + c.clip.x * 2, c.origin[1] + c.clip.y * 2)
    expect.soft(ratio, `${c.ref} 不一致像素比例`).toBeLessThanOrEqual(MAX_MISMATCH)
  })
}
