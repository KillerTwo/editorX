import {
  countChars,
  firstError,
  htmlToText,
  resolveTemplate,
  TITLE_MAX,
  TITLE_MIN,
  toPayload,
  validatePublish,
} from '@geekx/publish'
import {
  errorMessage,
  formatMessage,
  type EditorAdapters,
  type EditorDocument,
  type Messages,
  type PublishSettings,
} from '@geekx/toolbar'

export async function submitPublish(input: {
  document: EditorDocument
  settings: PublishSettings
  adapters: EditorAdapters
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  messages: Messages['publish']
  now?: () => number
}): Promise<boolean> {
  const { document: doc, adapters, notify, messages } = input
  const now = input.now ?? Date.now
  if (!adapters.onPublish) return false
  const settings: PublishSettings = {
    ...input.settings,
    tags: [...input.settings.tags],
    categories: [...input.settings.categories],
    cover: { ...input.settings.cover, urls: [...input.settings.cover.urls] },
  }
  delete settings.scheduledAt
  const template = resolveTemplate(settings.template, doc.editorType)
  if (template !== settings.template) settings.template = template
  if (countChars(doc.title.trim()) === 0) {
    notify(formatMessage(messages.errors.title, { min: TITLE_MIN, max: TITLE_MAX }), 'error')
    return false
  }
  if (htmlToText(doc.html) === '') {
    notify(messages.errors.emptyHtml, 'error')
    return false
  }
  const found = firstError(validatePublish(settings, { messages, now: now(), title: doc.title }))
  if (found) {
    notify(found.message, 'error')
    return false
  }
  try {
    await adapters.onPublish(toPayload(doc, settings))
  } catch (error) {
    notify(formatMessage(messages.errors.publish, { message: errorMessage(error) }), 'error')
    return false
  }
  notify(messages.status.published, 'success')
  return true
}
