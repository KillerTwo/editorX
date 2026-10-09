import { errorMessage, formatMessage, useMessages } from '@editorx/toolbar'
import { Button, cropImage, ImageCropper, Modal, type CropArea } from '@editorx/ui'
import { useEffect, useRef, useState } from 'react'

export const COVER_ASPECT = 16 / 9
export const COVER_OUTPUT = { width: 640, height: 360 } as const

export interface CoverCropDialogProps {
  src: string
  onCancel(): void
  onConfirm(blob: Blob): void
  onError(message: string): void
}

export function CoverCropDialog({ src, onCancel, onConfirm, onError }: CoverCropDialogProps) {
  const m = useMessages()
  const [crop, setCrop] = useState<{ src: string; area: CropArea } | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useRef(0)
  useEffect(() => {
    const runs = run
    return () => {
      runs.current++
    }
  }, [])
  const area = crop?.src === src ? crop.area : null
  const cancel = () => {
    run.current++
    onCancel()
  }
  const confirm = async () => {
    if (!area) return
    const token = ++run.current
    setBusy(true)
    let blob: Blob
    try {
      blob = await cropImage(src, area, COVER_OUTPUT)
    } catch (error) {
      if (token !== run.current) return
      setBusy(false)
      onError(formatMessage(m.publish.errors.upload, { message: errorMessage(error) }))
      return
    }
    if (token === run.current) onConfirm(blob)
  }
  return (
    <Modal
      open
      onClose={cancel}
      title={m.publish.cover.cropTitle}
      width={528}
      className="ex-pub-crop"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button onClick={cancel}>{m.publish.actions.cancel}</Button>
          <Button variant="primary" disabled={!area} loading={busy} onClick={() => void confirm()}>
            {m.dialog.confirm}
          </Button>
        </>
      }
    >
      <ImageCropper
        key={src}
        src={src}
        aspect={COVER_ASPECT}
        onChange={(next) => setCrop({ src, area: next })}
        zoomLabel={m.publish.cover.cropZoom}
        areaLabel={m.publish.cover.cropArea}
      />
    </Modal>
  )
}
