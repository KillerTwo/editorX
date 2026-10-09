import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from '../markdown-editor'
import { editorContent, previewEl, renderEditor } from '../test-utils'

const png = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })

describe('MarkdownEditor 图片上传', () => {
  it('粘贴图片：拦截默认粘贴，上传后插入图片并渲染', async () => {
    const uploadImage = vi.fn(async () => ({ url: 'https://cdn.example.com/a.png' }))
    const { handle } = renderEditor({ adapters: { uploadImage } })
    fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    await waitFor(() => expect(handle().getValue()).toBe('![shot](https://cdn.example.com/a.png)'))
    expect(uploadImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'shot.png' }))
    await waitFor(() => expect(previewEl().querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/a.png'))
  })

  it('粘贴事件被拦截（defaultPrevented）', () => {
    renderEditor({ adapters: { uploadImage: () => new Promise(() => {}) } })
    const prevented = !fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    expect(prevented).toBe(true)
  })

  it('未配置 uploadImage 时不拦截粘贴', () => {
    const { handle } = renderEditor({ defaultValue: 'x' })
    const notPrevented = fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    expect(notPrevented).toBe(true)
    expect(handle().getValue()).toBe('x')
  })

  it('只读时不处理粘贴', () => {
    const uploadImage = vi.fn(async () => ({ url: 'u' }))
    const { handle } = renderEditor({ defaultValue: 'x', readOnly: true, adapters: { uploadImage } })
    fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    expect(uploadImage).not.toHaveBeenCalled()
    expect(handle().getValue()).toBe('x')
  })

  it('拖拽失败：显示失败条，可删除', async () => {
    const { handle } = renderEditor({ adapters: { uploadImage: async () => Promise.reject(new Error('超时')) } })
    fireEvent.drop(editorContent(), { dataTransfer: { files: [png('bad.png')], types: ['Files'] } })
    const list = await screen.findByRole('list', { name: '上传失败的图片' })
    expect(list).toHaveTextContent('bad.png 上传失败')
    expect(screen.getByRole('alert')).toHaveTextContent('图片 bad.png 上传失败：超时')
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByRole('list', { name: '上传失败的图片' })).toBeNull()
    expect(handle().getValue()).toBe('')
  })

  it('失败条重试：使用最新的 adapters', async () => {
    const { ref, handle, rerender } = renderEditor({ adapters: { uploadImage: async () => Promise.reject(new Error('超时')) } })
    fireEvent.drop(editorContent(), { dataTransfer: { files: [png('bad.png')], types: ['Files'] } })
    await screen.findByRole('list', { name: '上传失败的图片' })
    rerender(<MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} adapters={{ uploadImage: async () => ({ url: 'ok.png' }) }} />)
    await userEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(handle().getValue()).toBe('![bad](ok.png)'))
    expect(screen.queryByRole('list', { name: '上传失败的图片' })).toBeNull()
  })

  it('上传中卸载：不抛错、不写入已销毁的引擎', async () => {
    let finish!: (v: { url: string }) => void
    const uploadImage = vi.fn(() => new Promise<{ url: string }>((resolve) => (finish = resolve)))
    const errors = vi.spyOn(console, 'error')
    const { handle, unmount } = renderEditor({ adapters: { uploadImage } })
    fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    const engine = handle().getEngine()
    const pending = engine.getValue()
    unmount()
    await act(async () => finish({ url: 'late.png' }))
    expect(engine.getValue()).toBe(pending)
    expect(errors).not.toHaveBeenCalled()
  })
})
