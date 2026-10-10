import type { TocItem } from '@editorx/markdown-core'
import { useSyncExternalStore } from 'react'
import type { PreviewStats } from './pipeline/stats-counter'

export interface CursorPosition {
  line: number
  column: number
}

export interface FailedUpload {
  id: string
  name: string
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveState {
  status: SaveStatus
  savedAt: number | null
}

export interface EditorSnapshot {
  cursor: CursorPosition
  formats: ReadonlySet<string>
  formatsKey: string
  stats: PreviewStats | null
  toc: readonly TocItem[]
  tocTitle: string | null
  panel: string | null
  fullscreen: boolean
  readOnly: boolean
  uploads: readonly FailedUpload[]
  save: SaveState
}

export interface EditorStore {
  get(): EditorSnapshot
  set(patch: Partial<EditorSnapshot>): void
  subscribe(listener: () => void): () => void
}

const EMPTY_FORMATS: ReadonlySet<string> = new Set()

export function createEditorStore(initial: Partial<EditorSnapshot> = {}): EditorStore {
  let state: EditorSnapshot = {
    cursor: { line: 1, column: 0 },
    formats: EMPTY_FORMATS,
    formatsKey: '',
    stats: null,
    toc: [],
    tocTitle: null,
    panel: null,
    fullscreen: false,
    readOnly: false,
    uploads: [],
    save: { status: 'idle', savedAt: null },
    ...initial,
  }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as Array<keyof EditorSnapshot>
      if (keys.every((key) => Object.is(state[key], patch[key]))) return
      state = { ...state, ...patch }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** selector 必须返回快照中的已有引用或原始值 */
export function useEditorState<T>(store: EditorStore, selector: (snapshot: EditorSnapshot) => T): T {
  const read = () => selector(store.get())
  return useSyncExternalStore(store.subscribe, read, read)
}
