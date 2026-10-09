import { useRef, useState, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react'
import { initialCrop, MAX_ZOOM, moveCrop, zoomCrop, type CropArea, type Size } from './crop'
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
}: ImageCropperProps) {
  const height = Math.round(width / aspect)
  const [natural, setNatural] = useState<Size | null>(null)
  const [area, setArea] = useState<CropArea | null>(null)
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ x: number; y: number; area: CropArea } | null>(null)
  const scale = area ? width / area.width : 1

  const commit = (next: CropArea) => {
    setArea(next)
    onChange(next)
  }
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }
    setNatural(size)
    setZoom(1)
    commit(initialCrop(size, aspect))
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!area) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, area }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || !natural) return
    const s = width / start.area.width
    commit(moveCrop(start.area, (start.x - e.clientX) / s, (start.y - e.clientY) / s, natural))
  }
  const endDrag = () => {
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
        />
      </div>
      <input
        className="ex-cropper__zoom"
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        aria-label={zoomLabel}
        disabled={!area}
        onChange={(e) => onZoom(Number(e.target.value))}
      />
    </div>
  )
}
