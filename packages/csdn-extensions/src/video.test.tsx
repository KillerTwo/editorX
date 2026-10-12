import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnVideoExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })

async function pick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '视频' }))
  const input = document.querySelector('input.ex-csdn-ext-file')
  expect(input).not.toBeNull()
  await user.upload(input as HTMLInputElement, file)
}

describe('csdn:video', () => {
  it('上传失败、空地址、javascript 地址都不插入', async () => {
    const user = userEvent.setup()
    const rejected = vi.fn(async () => Promise.reject(new Error('太大')))
    const ctx = extensionCtx({ adapters: { uploadVideo: rejected } })
    const first = renderExtension([csdnVideoExtension], ctx, [['csdn:video']])
    await pick(user)
    expect(rejected).toHaveBeenCalledWith(file)
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('视频上传失败：太大', 'error')
    first.unmount()

    for (const url of ['', 'javascript:alert(1)']) {
      const uploadVideo = vi.fn(async () => ({ url }))
      const next = extensionCtx({ adapters: { uploadVideo } })
      const view = renderExtension([csdnVideoExtension], next, [['csdn:video']])
      await pick(user)
      expect(next.insertEmbed).not.toHaveBeenCalled()
      expect(next.notify).toHaveBeenCalledWith('视频地址需以 http:// 或 https:// 开头', 'error')
      view.unmount()
    }
  })

  it('封面不是 http(s) 时不插入；成功时插入 video 嵌入', async () => {
    const user = userEvent.setup()
    const badCover = extensionCtx({
      adapters: { uploadVideo: vi.fn(async () => ({ url: 'https://cdn.example/a.mp4', cover: 'javascript:alert(1)' })) },
    })
    const badView = renderExtension([csdnVideoExtension], badCover, [['csdn:video']])
    await pick(user)
    expect(badCover.insertEmbed).not.toHaveBeenCalled()
    expect(badCover.notify).toHaveBeenCalledWith('视频地址需以 http:// 或 https:// 开头', 'error')
    badView.unmount()

    const ok = extensionCtx({
      adapters: {
        uploadVideo: vi.fn(async () => ({ url: 'https://cdn.example/a.mp4', cover: 'https://cdn.example/a.jpg' })),
      },
    })
    renderExtension([csdnVideoExtension], ok, [['csdn:video']])
    await pick(user)
    expect(ok.insertEmbed).toHaveBeenCalledWith('video', {
      url: 'https://cdn.example/a.mp4',
      cover: 'https://cdn.example/a.jpg',
    })
    const html = csdnVideoExtension.embeds?.[0]?.renderHtml({
      url: 'https://cdn.example/a.mp4',
      cover: 'https://cdn.example/a.jpg',
    })
    expect(html).toContain('src="https://cdn.example/a.mp4"')
    expect(html).toContain('poster="https://cdn.example/a.jpg"')
    expect(csdnVideoExtension.embeds?.[0]?.renderHtml({ url: 'javascript:alert(1)' })).not.toContain('javascript:')
  })

  it('没有 uploadVideo 时隐藏', () => {
    renderExtension([csdnVideoExtension], extensionCtx(), [['csdn:video']])
    expect(screen.queryByRole('button', { name: '视频' })).toBeNull()
  })
})
