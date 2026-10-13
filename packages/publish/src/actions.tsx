import { useMessages } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import type { AdapterState } from './adapter-state'
import { CaretDownIcon, ChevronRightIcon } from './icons'
import type { PublishVariant } from './types'
import type { PublishBusy } from './use-publish-controller'

export interface PublishActionsProps {
  variant: PublishVariant
  busy: PublishBusy
  draftState: AdapterState
  publishState: AdapterState
  onSaveDraft(): void
  onSchedule(): void
  onPublish(): void
  /** 仅模态呈现 */
  onCancel?(): void
  showSchedule?: boolean
}

export function PublishActions(props: PublishActionsProps) {
  const { variant, busy, draftState, publishState, onSaveDraft, onSchedule, onPublish, onCancel, showSchedule = true } =
    props
  const a = useMessages().publish.actions
  const modal = variant === 'modal'
  return (
    <div className="ex-pub-actions" role="group" aria-label={a.label}>
      {modal && onCancel && (
        <Button className="ex-pub-action" data-action="cancel" onClick={onCancel}>
          {a.cancel}
        </Button>
      )}
      {draftState !== 'hidden' && (
        <Button
          className="ex-pub-action"
          data-action="draft"
          disabled={draftState === 'disabled' || busy === 'publish'}
          loading={busy === 'draft'}
          onClick={onSaveDraft}
        >
          {modal ? (
            a.saveDraftModal
          ) : (
            <>
              {a.saveDraft}
              <CaretDownIcon className="ex-pub-action__caret" />
            </>
          )}
        </Button>
      )}
      {publishState !== 'hidden' && (
        <>
          {showSchedule && (
            <Button
              className="ex-pub-action"
              data-action="schedule"
              disabled={publishState === 'disabled' || busy !== null}
              onClick={onSchedule}
            >
              {a.schedule}
              {!modal && <ChevronRightIcon className="ex-pub-action__chevron" />}
            </Button>
          )}
          <Button
            variant="primary"
            className="ex-pub-action"
            data-action="publish"
            disabled={publishState === 'disabled' || busy === 'draft'}
            loading={busy === 'publish'}
            onClick={onPublish}
          >
            {modal ? a.publish : a.publishInline}
          </Button>
        </>
      )}
    </div>
  )
}
