import {
  errorMessage,
  formatMessage,
  useMessages,
  type CoverMode,
  type PublishCover,
} from '@geekx/toolbar'
import { RadioGroup } from '@geekx/ui'
import { Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import type { AdapterState } from '../adapter-state'
import { cx } from '../cx'
import { PlusIcon } from '../icons'
import { COVER_CAPACITY, pickCover, placeCover, removeCover, setCoverMode } from '../settings'
import type { PublishVariant } from '../types'
import { useLatest } from '../use-latest'
import { CoverCropDialog } from './cover-crop-dialog'
import { errorId, labelId } from './form-item'

export interface CoverFieldProps {
  id: string
  cover: PublishCover
  onChange(cover: PublishCover): void
  bodyImages: readonly string[]
  modes: readonly CoverMode[]
  uploadState: AdapterState
  uploadImage?: (file: File) => Promise<{ url: string }>
  variant: PublishVariant
  invalid: boolean
  onError(message: string): void
}

/** 裁剪后统一导出 PNG，文件名沿用原文件主体 */
function pngName(name: string) {
  return `${name.replace(/\.[^.]*$/, '') || 'cover'}.png`
}

export function CoverField(props: CoverFieldProps) {
  const { id, cover, onChange, bodyImages, modes, uploadState, uploadImage, variant, invalid, onError } = props
  const p = useMessages().publish
  const slotRef = useRef<HTMLButtonElement>(null)
  const coverRef = useLatest(cover)
  const [slot, setSlot] = useState(0)
  const [crop, setCrop] = useState<{ src: string; name: string } | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const cropRef = useLatest(crop)
  const capacity = COVER_CAPACITY[cover.mode]

  useEffect(
    () => () => {
      if (cropRef.current) URL.revokeObjectURL(cropRef.current.src)
    },
    [cropRef],
  )

  useLayoutEffect(() => {
    if (uploading === null) return
    const node = slotRef.current
    if (node && node.ownerDocument.activeElement !== node) node.focus()
  }, [uploading])

  const onFile = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSlot(index)
    setCrop({ src: URL.createObjectURL(file), name: file.name })
  }
  const closeCrop = () => {
    if (crop) URL.revokeObjectURL(crop.src)
    setCrop(null)
  }
  const onCropped = async (blob: Blob, name: string) => {
    closeCrop()
    if (!uploadImage) return
    setUploading(slot)
    try {
      const { url } = await uploadImage(new File([blob], pngName(name), { type: blob.type || 'image/png' }))
      onChange(placeCover(coverRef.current, slot, url))
    } catch (error) {
      onError(formatMessage(p.errors.upload, { message: errorMessage(error) }))
    } finally {
      setUploading(null)
    }
  }

  const slots = Array.from({ length: capacity }, (_, index) => {
    const url = cover.urls[index]
    if (uploading === index) {
      return (
        <button
          key={index}
          ref={slotRef}
          type="button"
          className="ex-pub-cover__slot is-uploading"
          aria-busy="true"
        >
          {p.cover.uploading}
        </button>
      )
    }
    if (url) {
      return (
        <div key={index} className="ex-pub-cover__slot is-filled">
          <img className="ex-pub-cover__img" src={url} alt={formatMessage(p.cover.slot, { index: index + 1 })} />
          <div className="ex-pub-cover__ops">
            {uploadState === 'enabled' && (
              <label className="ex-pub-cover__op">
                <input
                  className="ex-pub-cover__file"
                  type="file"
                  accept="image/*"
                  onChange={(event) => onFile(event, index)}
                />
                {p.cover.replace}
              </label>
            )}
            <button
              type="button"
              className="ex-pub-cover__op"
              aria-label={p.cover.remove}
              onClick={() => onChange(removeCover(cover, index))}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )
    }
    if (uploadState === 'hidden') return null
    return (
      <label key={index} className="ex-pub-cover__slot ex-pub-cover__upload">
        <input
          className="ex-pub-cover__file"
          type="file"
          accept="image/*"
          disabled={uploadState === 'disabled'}
          onChange={(event) => onFile(event, index)}
        />
        <PlusIcon size={variant === 'modal' ? 14 : 12} />
        <span className="ex-pub-cover__upload-text">{p.cover.upload}</span>
      </label>
    )
  })

  return (
    <div
      className="ex-pub-cover"
      role="group"
      aria-labelledby={labelId(id)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId(id) : undefined}
      tabIndex={invalid ? -1 : undefined}
      data-mode={cover.mode}
    >
      {modes.length > 1 && (
        <RadioGroup<CoverMode>
          className="ex-pub-line ex-pub-cover__modes"
          label={p.cover.modes}
          value={cover.mode}
          options={modes.map((mode) => ({ value: mode, label: p.cover[mode] }))}
          onChange={(mode) => onChange(setCoverMode(cover, mode))}
        />
      )}
      {capacity > 0 && (
        <div className="ex-pub-cover__row">
          <div className="ex-pub-cover__slots">{slots}</div>
          {bodyImages.length > 0 ? (
            <ul className="ex-pub-cover__images" aria-label={p.cover.bodyImages}>
              {bodyImages.map((src, index) => {
                const on = cover.urls.includes(src)
                return (
                  <li key={src}>
                    <button
                      type="button"
                      className={cx('ex-pub-cover__thumb', on && 'is-selected')}
                      aria-pressed={on}
                      aria-label={formatMessage(p.cover.pick, { index: index + 1 })}
                      onClick={() => onChange(pickCover(cover, src))}
                    >
                      <img src={src} alt="" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="ex-pub-cover__empty">{p.cover.noImages}</div>
          )}
        </div>
      )}
      {crop && (
        <CoverCropDialog
          src={crop.src}
          onCancel={closeCrop}
          onConfirm={(blob) => void onCropped(blob, crop.name)}
          onError={onError}
        />
      )}
    </div>
  )
}
