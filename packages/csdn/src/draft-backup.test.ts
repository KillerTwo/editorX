import { createSettings } from '@editorx/publish'
import type { EditorDocument } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import {
  draftFingerprint,
  readDraftBackup,
  shouldPromptRestore,
  writeDraftBackup,
  DRAFT_STORAGE_KEY,
} from './draft-backup'

const initial: EditorDocument = { editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '<p>Hello</p>' }
const settings = createSettings({ tags: ['jvm'] })

describe('draft backup', () => {
  it('坏 JSON 读成 null，写后再读回', () => {
    const storage = new Map<string, string>()
    const memory: Storage = {
      get length() {
        return storage.size
      },
      clear: () => storage.clear(),
      getItem: (key) => storage.get(key) ?? null,
      key: (index) => [...storage.keys()][index] ?? null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, value),
    }
    memory.setItem(DRAFT_STORAGE_KEY, '{')
    expect(readDraftBackup(memory)).toBeNull()
    const backup = {
      document: initial,
      settings,
      updatedAt: 50,
    }
    writeDraftBackup(memory, backup)
    expect(readDraftBackup(memory)).toEqual(backup)
  })

  it('更新且内容不同才询问；更旧或内容相同不询问', () => {
    const backup = {
      document: { ...initial, title: '本地更新的标题啊' },
      settings,
      updatedAt: 50,
    }
    expect(shouldPromptRestore(backup, 10, initial, settings)).toBe(true)
    expect(shouldPromptRestore({ ...backup, updatedAt: 5 }, 10, initial, settings)).toBe(false)
    expect(shouldPromptRestore({ ...backup, document: initial }, 0, initial, settings)).toBe(false)
    expect(draftFingerprint(initial, settings)).toBe(draftFingerprint({ ...initial, html: '<p>ignored</p>' }, settings))
  })
})
