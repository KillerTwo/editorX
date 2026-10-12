import { useRef, useState, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react'
import { CROP_MAX_ZOOM, initialCrop, moveCrop, zoomCrop, type CropArea, type CropSize } from './crop'
import { cx } from './cx'

export interface ImageCropperProps {
  src: string
  /** 宽高比，如 16 / 9 */
  aspect: number
  /** 视口宽（px），高 = 宽 / aspect */
  width?: number
  onChange: (area: CropArea) => void
  zoomLabel?: string
  areaLabel?: string
  className?: string
  errorText?: string
}

const KEY_STEP = 10

export function ImageCropper({
  src,
  aspect,
  width = 480,
  onChange,
  zoomLabel = '缩放',
  areaLabel = '裁剪区域',
  className,
  errorText = '图片无法显示',
}: ImageCropperProps) {
  const height = Math.round(width / aspect)
  const [natural, setNatural] = useState<CropSize | null>(null)
  const [area, setArea] = useState<CropArea | null>(null)
  const [zoom, setZoom] = useState(1)
  const [failed, setFailed] = useState(false)
  const drag = useRef<{ pointerId: number; x: number; y: number; area: CropArea } | null>(null)
  const scale = area ? width / area.width : 1

  const commit = (next: CropArea) => {
    setArea(next)
    onChange(next)
  }
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }
    if (size.width === 0 || size.height === 0) {
      setFailed(true)
      setNatural(null)
      setArea(null)
      return
    }
    setFailed(false)
    setNatural(size)
    setZoom(1)
    commit(initialCrop(size, aspect))
  }
  const onImageError = () => {
    setFailed(true)
    setNatural(null)
    setArea(null)
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !area) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, area }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.pointerId !== e.pointerId || !natural) return
    const s = width / start.area.width
    commit(moveCrop(start.area, (start.x - e.clientX) / s, (start.y - e.clientY) / s, natural))
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && drag.current.pointerId !== e.pointerId) return
    drag.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!area || !natural) return
    const d = KEY_STEP / scale
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    }
    const step = delta[e.key]
    if (!step) return
    e.preventDefault()
    commit(moveCrop(area, step[0], step[1], natural))
  }
  const onZoom = (value: number) => {
    if (!area || !natural) return
    setZoom(value)
    commit(zoomCrop(area, value, natural, aspect))
  }

  return (
    <div className={cx('ex-cropper', className)}>
      <div
        className="ex-cropper__viewport"
        style={{ width, height }}
        role="group"
        aria-label={areaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <img
          className={cx('ex-cropper__image', !area && 'is-loading')}
          src={src}
          alt=""
          crossOrigin={/^https?:/i.test(src) ? 'anonymous' : undefined}
          draggable={false}
          style={
            area && natural
              ? {
                  width: natural.width * scale,
                  height: natural.height * scale,
                  transform: `translate(${-area.x * scale}px, ${-area.y * scale}px)`,
                }
              : undefined
          }
          onLoad={onLoad}
          onError={onImageError}
        />
      </div>
      {failed ? <p className="ex-cropper__error" role="alert">{errorText}</p> : null}
      <input
        className="ex-cropper__zoom"
        type="range"
        min={1}
        max={CROP_MAX_ZOOM}
        step={0.01}
        value={zoom}
        aria-label={zoomLabel}
        disabled={!area}
        onChange={(e) => onZoom(Number(e.target.value))}
      />
    </div>
  )
}
