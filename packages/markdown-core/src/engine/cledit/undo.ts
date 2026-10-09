// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditUndoMgr.js
import type { Selection, TextState } from '../../types'
import { applyChange, revertChange, type TextChange } from './utils'

export type UndoMode = 'typing' | 'deleting' | 'single'

interface UndoEntry {
  changes: TextChange[]
  before: Selection
  after: Selection
  mode: UndoMode
  time: number
}

export interface UndoManagerOptions {
  maxSize?: number
  mergeWindowMs?: number
  now?: () => number
}

export class UndoManager {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private mergeBroken = true
  private readonly maxSize: number
  private readonly mergeWindowMs: number
  private readonly now: () => number

  constructor(opts: UndoManagerOptions = {}) {
    this.maxSize = opts.maxSize ?? 200
    this.mergeWindowMs = opts.mergeWindowMs ?? 1000
    this.now = opts.now ?? Date.now
  }

  record(change: TextChange, before: Selection, after: Selection, mode: UndoMode): void {
    this.redoStack = []
    const time = this.now()
    const last = this.undoStack[this.undoStack.length - 1]
    if (
      last &&
      !this.mergeBroken &&
      mode !== 'single' &&
      last.mode === mode &&
      time - last.time < this.mergeWindowMs
    ) {
      last.changes.push(change)
      last.after = after
      last.time = time
    } else {
      this.undoStack.push({ changes: [change], before, after, mode, time })
      while (this.undoStack.length > this.maxSize) this.undoStack.shift()
    }
    this.mergeBroken = false
  }

  undo(text: string): TextState | null {
    const entry = this.undoStack.pop()
    if (!entry) return null
    let next = text
    for (let i = entry.changes.length - 1; i >= 0; i--) next = revertChange(next, entry.changes[i]!)
    this.redoStack.push(entry)
    this.mergeBroken = true
    return { text: next, selection: { ...entry.before } }
  }

  redo(text: string): TextState | null {
    const entry = this.redoStack.pop()
    if (!entry) return null
    let next = text
    for (const change of entry.changes) next = applyChange(next, change)
    this.undoStack.push(entry)
    this.mergeBroken = true
    return { text: next, selection: { ...entry.after } }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  breakMerge(): void {
    this.mergeBroken = true
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.mergeBroken = true
  }
}
