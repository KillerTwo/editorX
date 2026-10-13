import type { PublishCover } from '@editorx/toolbar'
import { cropImage } from '@editorx/ui'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { CoverField, type CoverFieldProps } from './cover-field'

vi.mock('@editorx/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@editorx/ui')>()),
  cropImage: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))

function Cover(props: Partial<Omit<CoverFieldProps, 'cover' | 'onChange'>>) {
  const [cover, setCover] = useState<PublishCover>({ mode: 'single', urls: [] })
  return (
    <>
      <span id="cv-label">添加封面</span>
      <CoverField
        id="cv"
        cover={cover}
        onChange={setCover}
        bodyImages={[]}
        modes={['single']}
        uploadState="enabled"
        uploadImage={async () => ({ url: '/uploaded.png' })}
        variant="inline"
        invalid={false}
        onError={() => {}}
        {...props}
      />
      <output data-testid="cover">{`${cover.mode}:${cover.urls.join(',')}`}</output>
    </>
  )
}

function chooseFile(container: HTMLElement, name = 'a.png') {
  const input = container.querySelector<HTMLInputElement>('.ex-pub-cover__file')!
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type: 'image/png' })] } })
}

function loadCropImage() {
  const img = document.querySelector<HTMLImageElement>('.ex-cropper__image')!
  Object.defineProperty(img, 'naturalWidth', { value: 1600 })
  Object.defineProperty(img, 'naturalHeight', { value: 900 })
  fireEvent.load(img)
}

describe('CoverField', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:cover') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })
  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('点击「从本地上传」会激活文件控件', async () => {
    renderWithProviders(<Cover />)
    const input = screen.getByLabelText('从本地上传')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).not.toHaveAttribute('hidden')
    const clicked = vi.fn()
    input.addEventListener('click', clicked)
    await userEvent.click(screen.getByText('从本地上传'))
    expect(clicked).toHaveBeenCalled()
  })

  it('默认单图：上传框 + 无正文图片提示，不显示模式切换', () => {
    renderWithProviders(<Cover />)
    expect(screen.getByRole('group', { name: '添加封面' })).toBeInTheDocument()
    expect(screen.getByLabelText('从本地上传')).toBeEnabled()
    expect(screen.getByText('暂无内容图片，请在正文中添加图片')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: '封面类型' })).toBeNull()
  })

  it('正文图片：点选设为封面，再点取消', async () => {
    renderWithProviders(<Cover bodyImages={['/a.png', '/b.png']} />)
    const second = screen.getByRole('button', { name: '选择正文图片 2 作为封面' })
    await userEvent.click(second)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: '封面 1' })).toHaveAttribute('src', '/b.png')
    expect(screen.getByTestId('cover')).toHaveTextContent('single:/b.png')
    await userEvent.click(second)
    expect(screen.getByTestId('cover')).toHaveTextContent(/^single:$/)
  })

  it('本地上传：裁剪 → cropImage → uploadImage → 写入封面', async () => {
    const uploadImage = vi.fn<(file: File) => Promise<{ url: string }>>(async () => ({ url: '/uploaded.png' }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} />)
    chooseFile(container)
    const dialog = await screen.findByRole('dialog', { name: '裁剪封面' })
    expect(screen.getByRole('group', { name: '裁剪区域，可拖动或用方向键移动' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: '缩放' })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: '确定' })
    expect(confirm).toBeDisabled()
    loadCropImage()
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    await waitFor(() => expect(screen.getByTestId('cover')).toHaveTextContent('single:/uploaded.png'))
    expect(dialog).not.toBeInTheDocument()
    expect(cropImage).toHaveBeenLastCalledWith('blob:cover', expect.any(Object), { width: 640, height: 360 })
    expect(uploadImage.mock.lastCall![0]).toBeInstanceOf(File)
    expect(uploadImage.mock.lastCall![0].type).toBe('image/png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover')
  })

  it('上传文件名保留原文件名主体，扩展名改为 .png', async () => {
    const uploadImage = vi.fn<(file: File) => Promise<{ url: string }>>(async () => ({ url: '/uploaded.png' }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} />)
    chooseFile(container, 'my.photo-fail.jpg')
    await screen.findByRole('dialog', { name: '裁剪封面' })
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1))
    expect(uploadImage.mock.lastCall![0].name).toBe('my.photo-fail.png')
  })

  it('上传失败回调 onError；取消裁剪不上传', async () => {
    const onError = vi.fn()
    const uploadImage = vi.fn(async () => {
      throw new Error('网络错误')
    })
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} onError={onError} />)
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(uploadImage).not.toHaveBeenCalled()
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('封面上传失败：网络错误'))
  })

  it('裁剪导出失败：通知 onError，弹窗保留且不上传', async () => {
    vi.mocked(cropImage).mockRejectedValueOnce(new Error('图片跨域'))
    const onError = vi.fn()
    const uploadImage = vi.fn<(file: File) => Promise<{ url: string }>>(async () => ({ url: '/uploaded.png' }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} onError={onError} />)
    chooseFile(container)
    const dialog = await screen.findByRole('dialog', { name: '裁剪封面' })
    loadCropImage()
    const confirm = screen.getByRole('button', { name: '确定' })
    await userEvent.click(confirm)
    await waitFor(() => expect(onError).toHaveBeenCalledWith('封面上传失败：图片跨域'))
    expect(dialog).toBeInTheDocument()
    expect(confirm).toBeEnabled()
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('裁剪进行中取消：之后导出成功也不上传', async () => {
    let finish!: (blob: Blob) => void
    vi.mocked(cropImage).mockImplementationOnce(() => new Promise<Blob>((resolve) => (finish = resolve)))
    const uploadImage = vi.fn<(file: File) => Promise<{ url: string }>>(async () => ({ url: '/uploaded.png' }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} />)
    chooseFile(container)
    const dialog = await screen.findByRole('dialog', { name: '裁剪封面' })
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(dialog).not.toBeInTheDocument()
    finish(new Blob(['png'], { type: 'image/png' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(uploadImage).not.toHaveBeenCalled()
    expect(screen.getByTestId('cover')).toHaveTextContent(/^single:$/)
  })

  it('裁剪进行中取消：之后导出失败也不报错', async () => {
    let fail!: (error: Error) => void
    vi.mocked(cropImage).mockImplementationOnce(() => new Promise<Blob>((_, reject) => (fail = reject)))
    const onError = vi.fn()
    const { container } = renderWithProviders(<Cover onError={onError} />)
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    fail(new Error('图片已释放'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onError).not.toHaveBeenCalled()
  })

  it('裁剪弹窗打开时卸载：只释放一次当前临时链接，打开期间图片可用', async () => {
    const { container, unmount } = renderWithProviders(<Cover />)
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    expect(document.querySelector('.ex-cropper__image')).toHaveAttribute('src', 'blob:cover')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover')
  })

  it('缺 uploadImage：hidden 不渲染上传框，disabled 禁用', () => {
    const { unmount } = renderWithProviders(<Cover uploadState="hidden" uploadImage={undefined} />)
    expect(screen.queryByLabelText('从本地上传')).toBeNull()
    unmount()
    renderWithProviders(<Cover uploadState="disabled" uploadImage={undefined} />)
    expect(screen.getByLabelText('从本地上传')).toBeDisabled()
  })

  it('多模式：三图显示 3 个槽位，无封面隐藏上传行', async () => {
    renderWithProviders(<Cover modes={['single', 'triple', 'none']} bodyImages={['/a.png']} />)
    await userEvent.click(screen.getByRole('radio', { name: '三图' }))
    expect(screen.getAllByLabelText('从本地上传')).toHaveLength(3)
    await userEvent.click(screen.getByRole('radio', { name: '无封面' }))
    expect(screen.queryByLabelText('从本地上传')).toBeNull()
    expect(screen.getByTestId('cover')).toHaveTextContent(/^none:$/)
  })

  it('校验失败：根元素 aria-invalid 且可聚焦', () => {
    renderWithProviders(<Cover invalid />)
    const group = screen.getByRole('group', { name: '添加封面' })
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group).toHaveAttribute('tabindex', '-1')
    expect(group).toHaveAttribute('aria-describedby', 'cv-error')
  })

  it('裁剪图加载失败时显示提示，确定保持禁用', async () => {
    const { container } = renderWithProviders(<Cover />)
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    fireEvent.error(document.querySelector('.ex-cropper__image')!)
    expect(screen.getByRole('alert')).toHaveTextContent('图片无法显示')
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
  })

  it('上传中焦点留在该控件并标 aria-busy', async () => {
    let release: (value: { url: string }) => void = () => {}
    const uploadImage = vi.fn(() => new Promise<{ url: string }>((resolve) => { release = resolve }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} />)
    screen.getByLabelText('从本地上传').focus()
    chooseFile(container)
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    const busy = await screen.findByRole('button', { name: '上传中…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(document.activeElement).toBe(busy)
    release({ url: '/uploaded.png' })
    await waitFor(() => expect(screen.getByTestId('cover')).toHaveTextContent('/uploaded.png'))
  })
})
