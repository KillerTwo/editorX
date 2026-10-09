import { ThemeProvider, useOptionalTheme } from '@editorx/theme'
import { MessagesProvider, useMessages, type CoverMode, type EditorAdapters } from '@editorx/toolbar'
import { Modal, ToastProvider, useToast, type ToastType } from '@editorx/ui'
import { useState, type ReactNode } from 'react'
import { PublishActions } from './actions'
import { adapterState } from './adapter-state'
import { cx } from './cx'
import { PublishForm } from './form/publish-form'
import { ScheduleDialog } from './schedule-dialog'
import type { PublishBaseProps, PublishModalProps, PublishPanelProps, PublishVariant } from './types'
import { usePublishController } from './use-publish-controller'

const EMPTY_ADAPTERS: EditorAdapters = {}
const DEFAULT_COVER_MODES: readonly CoverMode[] = ['single']

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

// 与 packages/markdown/src/markdown-editor.tsx 的 MarkdownEditor 外壳同规则，phase 6 抽出共享外壳前两处同步修改
function PublishRoot({ props, children }: { props: PublishBaseProps; children: ReactNode }) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
  const [ownTheme] = useState(() => !outer || theme !== undefined || defaultTheme !== undefined)
  const content = (
    <MessagesProvider messages={locale}>
      <LocalizedToasts>{children}</LocalizedToasts>
    </MessagesProvider>
  )
  if (!ownTheme) return content
  return (
    <ThemeProvider
      theme={theme}
      defaultTheme={defaultTheme}
      onThemeChange={onThemeChange}
      storageKey={themeStorageKey}
      className="ex-pub-theme"
    >
      {content}
    </ThemeProvider>
  )
}

/** attempts：打开弹窗（或上次失败）时的 failedAttempts；showError：弹窗内的发布是否因时间无效失败 */
interface ScheduleState {
  attempts: number
  showError: boolean
}

function usePublishParts(
  props: PublishBaseProps,
  variant: PublishVariant,
  open: boolean,
  onDone?: () => void,
  onCancel?: () => void,
) {
  const m = useMessages()
  const toast = useToast()
  const adapters = props.adapters ?? EMPTY_ADAPTERS
  const missing = props.missingAdapter ?? 'hide'
  const notify = (message: string, type?: ToastType) => toast.notify(message, type)
  const [schedule, setSchedule] = useState<ScheduleState | null>(null)
  const ctl = usePublishController({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    document: props.document,
    adapters,
    rules: props.rules,
    messages: m.publish,
    notify,
    onPublished: (payload) => {
      // 先收起：onPublished 抛错时文章已发布，弹窗照常关闭
      setSchedule(null)
      onDone?.()
      props.onPublished?.(payload)
    },
  })
  if (schedule && (!open || ctl.failedAttempts !== schedule.attempts)) {
    // 只有发布时间无效时留在定时弹窗里；其他字段无效则关闭弹窗，由表单聚焦首个错误字段
    const timeOnly = open && Object.keys(ctl.errors).every((field) => field === 'scheduledAt')
    setSchedule(timeOnly ? { attempts: ctl.failedAttempts, showError: true } : null)
  }
  const form = (
    <PublishForm
      ctl={ctl}
      variant={variant}
      document={props.document}
      adapters={adapters}
      missingAdapter={missing}
      coverModes={props.coverModes ?? DEFAULT_COVER_MODES}
      templates={props.templates}
      agreementLinks={props.agreementLinks}
      notify={notify}
    />
  )
  const actions = (
    <PublishActions
      variant={variant}
      busy={ctl.busy}
      draftState={adapterState(adapters, 'onSaveDraft', missing)}
      publishState={adapterState(adapters, 'onPublish', missing)}
      onSaveDraft={() => void ctl.saveDraft()}
      onSchedule={() => setSchedule({ attempts: ctl.failedAttempts, showError: false })}
      onPublish={() => void ctl.publish()}
      onCancel={onCancel}
    />
  )
  const scheduleDialog = schedule && (
    <ScheduleDialog
      error={schedule.showError ? ctl.errors.scheduledAt : undefined}
      onCancel={() => setSchedule(null)}
      onConfirm={(iso) => void ctl.publish(iso)}
    />
  )
  return { form, actions, schedule: scheduleDialog }
}

function InlinePanel(props: PublishPanelProps) {
  const m = useMessages()
  const { form, actions, schedule } = usePublishParts(props, 'inline', true)
  return (
    <section className={cx('ex-pub', props.className)} aria-label={m.publish.label}>
      <div className="ex-pub-card">{form}</div>
      <div className="ex-pub-bar">
        <div className="ex-pub-bar__inner">
          <div className="ex-pub-bar__start">{props.slots?.barStart}</div>
          {actions}
        </div>
      </div>
      {schedule}
    </section>
  )
}

function ModalPanel(props: PublishModalProps) {
  const m = useMessages()
  const { open, onClose } = props
  const { form, actions, schedule } = usePublishParts(props, 'modal', open, onClose, onClose)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={m.publish.modalTitle}
      width={740}
      className={cx('ex-pub ex-pub--modal ex-pub-modal', props.className)}
      maskClassName="ex-pub-mask"
      closeLabel={m.dialog.close}
      footer={actions}
    >
      {form}
      {schedule}
    </Modal>
  )
}

/** CSDN 内联发布设置卡片 + 底部 sticky 操作栏 */
export function PublishPanel(props: PublishPanelProps) {
  return (
    <PublishRoot props={props}>
      <InlinePanel {...props} />
    </PublishRoot>
  )
}

/** 740 宽发布弹窗；控制器在弹窗外，关闭后非受控设置与进行中的请求保留，发布成功后调用 onClose */
export function PublishModal(props: PublishModalProps) {
  return (
    <PublishRoot props={props}>
      <ModalPanel {...props} />
    </PublishRoot>
  )
}
