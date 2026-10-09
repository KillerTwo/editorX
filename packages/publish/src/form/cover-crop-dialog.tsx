import { errorMessage, formatMessage, useMessages } from '@editorx/toolbar'
import { Button, cropImage, ImageCropper, Modal, type CropArea } from '@editorx/ui'
import { useState } from 'react'

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
  const area = crop?.src === src ? crop.area : null
  const confirm = async () => {
    if (!area) return
    setBusy(true)
    try {
      onConfirm(await cropImage(src, area, COVER_OUTPUT))
    } catch (error) {
      setBusy(false)
      onError(formatMessage(m.publish.errors.upload, { message: errorMessage(error) }))
    }
  }
  return (
    <Modal
      open
      onClose={onCancel}
      title={m.publish.cover.cropTitle}
      width={528}
      className="ex-pub-crop"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button onClick={onCancel}>{m.publish.actions.cancel}</Button>
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
