/** 裁剪框，单位为原图像素 */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export const MAX_ZOOM = 3

/** 以原图中心为中心、宽高比为 aspect 的最大裁剪框（缩放 1 倍） */
export function initialCrop(image: Size, aspect: number): CropArea {
  const width = Math.min(image.width, image.height * aspect)
  const height = width / aspect
  return { x: (image.width - width) / 2, y: (image.height - height) / 2, width, height }
}

export function clampCrop(area: CropArea, image: Size): CropArea {
  const width = Math.min(area.width, image.width)
  const height = Math.min(area.height, image.height)
  return {
    x: Math.min(Math.max(area.x, 0), image.width - width),
    y: Math.min(Math.max(area.y, 0), image.height - height),
    width,
    height,
  }
}

export function moveCrop(area: CropArea, dx: number, dy: number, image: Size): CropArea {
  return clampCrop({ ...area, x: area.x + dx, y: area.y + dy }, image)
}

/** zoom 为相对 initialCrop 的倍数，绕当前裁剪框中心缩放 */
export function zoomCrop(area: CropArea, zoom: number, image: Size, aspect: number): CropArea {
  const base = initialCrop(image, aspect)
  const z = Math.min(Math.max(zoom, 1), MAX_ZOOM)
  const width = base.width / z
  const height = base.height / z
  const centerX = area.x + area.width / 2
  const centerY = area.y + area.height / 2
  return clampCrop({ x: centerX - width / 2, y: centerY - height / 2, width, height }, image)
}

export async function cropImage(src: string, area: CropArea, output: Size, type = 'image/png'): Promise<Blob> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = src
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = output.width
  canvas.height = output.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, output.width, output.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type)
  })
}
