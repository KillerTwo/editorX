import { fireEvent, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CropArea } from './crop'
import { ImageCropper } from './image-cropper'
import { renderWithTheme } from './test-utils'

function expectArea(actual: CropArea, expected: CropArea) {
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual[key], key).toBeCloseTo(expected[key], 6)
}

function setup() {
  const onChange = vi.fn()
  const { container } = renderWithTheme(
    <StrictMode>
      <ImageCropper src="blob:cover" aspect={16 / 9} onChange={onChange} />
    </StrictMode>,
  )
  const img = container.querySelector<HTMLImageElement>('.ex-cropper__image')!
  Object.defineProperty(img, 'naturalWidth', { value: 1600 })
  Object.defineProperty(img, 'naturalHeight', { value: 900 })
  fireEvent.load(img)
  return {
    onChange,
    img,
    viewport: screen.getByRole('group', { name: '裁剪区域' }),
    zoom: screen.getByRole('slider', { name: '缩放' }),
  }
}

describe('ImageCropper', () => {
  it('图片加载后给出初始裁剪框，视口 480×270', () => {
    const { onChange, img, viewport } = setup()
    expectArea(onChange.mock.lastCall![0], { x: 0, y: 0, width: 1600, height: 900 })
    expect(viewport).toHaveStyle({ width: '480px', height: '270px' })
    expect(img).not.toHaveClass('is-loading')
    expect(parseFloat(img.style.width)).toBeCloseTo(480)
  })

  it('滑块缩放 2 倍：裁剪框绕中心缩小', () => {
    const { onChange, zoom } = setup()
    fireEvent.change(zoom, { target: { value: '2' } })
    expectArea(onChange.mock.lastCall![0], { x: 400, y: 225, width: 800, height: 450 })
  })

  it('方向键按视口 10px 移动裁剪框', () => {
    const { onChange, zoom, viewport } = setup()
    fireEvent.change(zoom, { target: { value: '2' } })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    const last = onChange.mock.lastCall![0]
    expect(last.x).toBeCloseTo(400 + 10 / (480 / 800))
    expect(last.y).toBeCloseTo(225)
  })

  it('拖动图片：裁剪框反向移动，松开后不再跟随', () => {
    const { onChange, zoom, viewport } = setup()
    fireEvent.change(zoom, { target: { value: '2' } })
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 70, clientY: 100 })
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 70, clientY: 100 })
    expect(onChange.mock.lastCall![0].x).toBeCloseTo(400 + 30 / 0.6)
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 0, clientY: 0 })
    expect(onChange.mock.lastCall![0].x).toBeCloseTo(450)
  })

  it('https 图片设置 crossOrigin，blob 图片不设置', () => {
    const { container, unmount } = renderWithTheme(<ImageCropper src="https://cdn.example/a.png" aspect={16 / 9} onChange={vi.fn()} />)
    expect(container.querySelector('img')).toHaveAttribute('crossorigin', 'anonymous')
    unmount()
    const blob = renderWithTheme(<ImageCropper src="blob:cover" aspect={16 / 9} onChange={vi.fn()} />)
    expect(blob.container.querySelector('img')).not.toHaveAttribute('crossorigin')
  })

  it('error 或 naturalWidth 为 0 时提示，且不给出裁剪框', () => {
    const onChange = vi.fn()
    const { container } = renderWithTheme(<ImageCropper src="blob:bad" aspect={16 / 9} onChange={onChange} />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(screen.getByRole('alert')).toHaveTextContent('图片无法显示')
    expect(screen.getByRole('slider', { name: '缩放' })).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
    Object.defineProperty(img, 'naturalWidth', { value: 0 })
    Object.defineProperty(img, 'naturalHeight', { value: 0 })
    fireEvent.load(img)
    expect(screen.getByRole('alert')).toHaveTextContent('图片无法显示')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('右键不开始拖动；另一支指针的移动不改变裁剪框', () => {
    const { onChange, viewport } = setup()
    const calls = onChange.mock.calls.length
    fireEvent.pointerDown(viewport, { pointerId: 3, button: 2, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 3, button: 2, clientX: 0, clientY: 0 })
    expect(onChange).toHaveBeenCalledTimes(calls)
    fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 2, button: 0, clientX: 0, clientY: 0 })
    expect(onChange).toHaveBeenCalledTimes(calls)
    fireEvent.pointerMove(viewport, { pointerId: 1, button: 0, clientX: 70, clientY: 100 })
    expect(onChange.mock.calls.length).toBeGreaterThan(calls)
  })
})
