import { cropImage } from '@editorx/ui'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RichTextEditor } from './rich-text-editor'

vi.mock('./mount-editor', () => ({
  mountEditor: vi.fn(async () => ({
    getData: () => '',
    setData: vi.fn(),
    setReadOnly: vi.fn(),
    insertHtml: vi.fn(),
    replaceHtml: vi.fn(),
    getSelectionText: () => '',
    execute: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(async () => undefined),
    onChange: () => () => undefined,
  })),
}))

vi.mock('@editorx/ui', async () => {
  const actual = await vi.importActual<typeof import('@editorx/ui')>('@editorx/ui')
  return { ...actual, cropImage: vi.fn() }
})

beforeEach(() => {
  vi.mocked(cropImage).mockReset()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:photo' })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
})

async function openImageDialog(uploadImage: (file: File) => Promise<{ url: string }>) {
  render(
    <StrictMode>
      <RichTextEditor adapters={{ uploadImage }} />
    </StrictMode>,
  )
  await userEvent.click(await screen.findByRole('button', { name: '图片' }))
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  expect(input).not.toBeNull()
  await userEvent.upload(input!, new File(['x'], 'cover.png', { type: 'image/png' }))
  const image = document.querySelector<HTMLImageElement>('.ex-cropper__image')
  expect(image).not.toBeNull()
  Object.defineProperty(image!, 'naturalWidth', { configurable: true, value: 1600 })
  Object.defineProperty(image!, 'naturalHeight', { configurable: true, value: 900 })
  fireEvent.load(image!)
  const confirm = screen.getByRole('button', { name: '确定' })
  await waitFor(() => expect(confirm).toBeEnabled())
  return confirm
}

describe('图片插入失败', () => {
  it('裁剪失败时提示并留着对话框', async () => {
    vi.mocked(cropImage).mockRejectedValue(new Error('crop failed'))
    const uploadImage = vi.fn(async () => ({ url: 'https://cdn.example/a.png' }))
    const confirm = await openImageDialog(uploadImage)
    await userEvent.click(confirm)
    expect(await screen.findByText('图片 cover.png 上传失败：crop failed')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '图片' })).toBeInTheDocument()
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('上传失败时提示并留着对话框', async () => {
    vi.mocked(cropImage).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    const uploadImage = vi.fn(async () => {
      throw new Error('network')
    })
    const confirm = await openImageDialog(uploadImage)
    await userEvent.click(confirm)
    expect(await screen.findByText('图片 cover.png 上传失败：network')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '图片' })).toBeInTheDocument()
    expect(uploadImage).toHaveBeenCalledTimes(1)
  })
})
