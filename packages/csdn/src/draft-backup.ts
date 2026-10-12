import type { EditorDocument, PublishSettings } from '@editorx/toolbar'

export const DRAFT_STORAGE_KEY = 'editorx-csdn-draft'
export const MAX_TIMER_DELAY = 2_147_483_647

export interface CsdnDraftBackup {
  document: EditorDocument
  settings: PublishSettings
  updatedAt: number
}

export function draftFingerprint(doc: EditorDocument, settings: PublishSettings): string {
  const body = doc.editorType === 'markdown' ? (doc.markdown ?? '') : doc.html
  return JSON.stringify({ editorType: doc.editorType, title: doc.title, body, settings })
}

export function readDraftBackup(storage: Storage, key = DRAFT_STORAGE_KEY): CsdnDraftBackup | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CsdnDraftBackup>
    if (!parsed.document || !parsed.settings || typeof parsed.updatedAt !== 'number') return null
    if (parsed.document.editorType !== 'markdown' && parsed.document.editorType !== 'richtext') return null
    if (typeof parsed.document.title !== 'string' || typeof parsed.document.html !== 'string') return null
    return parsed as CsdnDraftBackup
  } catch {
    return null
  }
}

export function writeDraftBackup(storage: Storage, backup: CsdnDraftBackup, key = DRAFT_STORAGE_KEY): void {
  storage.setItem(key, JSON.stringify(backup))
}

export function shouldPromptRestore(
  backup: CsdnDraftBackup | null,
  initialUpdatedAt: number,
  initialDoc: EditorDocument,
  initialSettings: PublishSettings,
): boolean {
  if (!backup) return false
  if (!(typeof backup.updatedAt === 'number' && Number.isFinite(backup.updatedAt))) return false
  if (!(backup.updatedAt > initialUpdatedAt)) return false
  return draftFingerprint(backup.document, backup.settings) !== draftFingerprint(initialDoc, initialSettings)
}
