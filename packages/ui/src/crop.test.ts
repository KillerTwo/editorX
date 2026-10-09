import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampCrop, cropImage, initialCrop, MAX_ZOOM, moveCrop, zoomCrop, type CropArea } from './crop'

const ASPECT = 16 / 9

/** 16/9 不是有限二进制小数，比较时允许浮点误差 */
function expectArea(actual: CropArea, expected: CropArea) {
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual[key], key).toBeCloseTo(expected[key], 6)
}

describe('裁剪几何', () => {
  it('initialCrop：横图取满高居中，方图取满宽居中', () => {
    expectArea(initialCrop({ width: 1600, height: 600 }, ASPECT), {
      x: (1600 - 600 * ASPECT) / 2,
      y: 0,
      width: 600 * ASPECT,
      height: 600,
    })
    expectArea(initialCrop({ width: 1000, height: 1000 }, ASPECT), { x: 0, y: 218.75, width: 1000, height: 562.5 })
  })

  it('clampCrop：不越界、尺寸不超过原图', () => {
    const image = { width: 1000, height: 500 }
    expect(clampCrop({ x: -20, y: 600, width: 400, height: 225 }, image)).toEqual({ x: 0, y: 275, width: 400, height: 225 })
    expect(clampCrop({ x: 10, y: 10, width: 2000, height: 900 }, image)).toEqual({ x: 0, y: 0, width: 1000, height: 500 })
  })

  it('moveCrop：平移后夹在原图内', () => {
    const image = { width: 1600, height: 900 }
    const area = { x: 400, y: 225, width: 800, height: 450 }
    expect(moveCrop(area, 100, -50, image)).toEqual({ x: 500, y: 175, width: 800, height: 450 })
    expect(moveCrop(area, 5000, 5000, image)).toEqual({ x: 800, y: 450, width: 800, height: 450 })
  })

  it('zoomCrop：绕当前中心缩放，倍数夹在 [1, MAX_ZOOM]', () => {
    const image = { width: 1600, height: 900 }
    const full = initialCrop(image, ASPECT)
    expectArea(zoomCrop(full, 2, image, ASPECT), { x: 400, y: 225, width: 800, height: 450 })
    const max = zoomCrop(full, 10, image, ASPECT)
    expect(max.width).toBeCloseTo(1600 / MAX_ZOOM)
    expectArea(zoomCrop(max, 0.5, image, ASPECT), full)
  })
})

describe('cropImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('把原图区域绘制到输出尺寸并导出 Blob', async () => {
    const drawImage = vi.fn()
    vi.stubGlobal(
      'Image',
      class {
        crossOrigin = ''
        src = ''
        decode() {
          return Promise.resolve()
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb) {
      cb(new Blob([`${this.width}x${this.height}`], { type: 'image/png' }))
    })
    const blob = await cropImage('blob:a', { x: 10, y: 20, width: 320, height: 180 }, { width: 640, height: 360 })
    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('640x360')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 320, 180, 0, 0, 640, 360)
  })

  it('toBlob 返回 null 时 reject', async () => {
    vi.stubGlobal(
      'Image',
      class {
        decode() {
          return Promise.resolve()
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(cropImage('blob:a', { x: 0, y: 0, width: 1, height: 1 }, { width: 1, height: 1 })).rejects.toThrow()
  })
})
