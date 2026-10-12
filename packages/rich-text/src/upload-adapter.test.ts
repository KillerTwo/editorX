import { describe, expect, it, vi } from 'vitest'
import { createUploadAdapter } from './upload-adapter'

describe('createUploadAdapter', () => {
  it('把 uploadImage 的 url 交给 CKEditor', async () => {
    const upload = vi.fn(async () => ({ url: 'https://cdn.example/a.png' }))
    const adapter = createUploadAdapter(Promise.resolve(new File(['x'], 'a.png', { type: 'image/png' })), upload)
    await expect(adapter.upload()).resolves.toEqual({ default: 'https://cdn.example/a.png' })
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('没有文件时拒绝', async () => {
    const adapter = createUploadAdapter(Promise.resolve(null), vi.fn())
    await expect(adapter.upload()).rejects.toThrow('没有文件')
  })
})
