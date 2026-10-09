// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditCore.js
import { closesFence, openFence } from '../sections'
import type {
  EditorEngine,
  EngineEvent,
  EngineOptions,
  SectionOffset,
  Selection,
  TextState,
  Unsubscribe,
} from '../types'
import { Highlighter } from './cledit/highlighter'
import { handleKeystroke } from './cledit/keystrokes'
import { SelectionManager } from './cledit/selection'
import { UndoManager, type UndoManagerOptions, type UndoMode } from './cledit/undo'
import { diffRange } from './cledit/utils'
import { Watcher } from './cledit/watcher'

export interface ClEditEngineOptions {
  highlight?: (text: string) => string
  undo?: UndoManagerOptions
}

type Listener = (payload: unknown) => void

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

// The HTML parser drops U+0000, so keeping it would break DOM text === value + '\n'.
function normalize(text: string): string {
  if (!text.includes('\r') && !text.includes('\u0000')) return text
  return text.replace(/\r\n?/g, '\n').split('\u0000').join('')
}

function editableMode(doc: Document): 'plaintext-only' | 'true' {
  const probe = doc.createElement('div')
  try {
    probe.contentEditable = 'plaintext-only'
  } catch {
    return 'true'
  }
  return probe.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'
}

export class ClEditEngine implements EditorEngine {
  private host: HTMLElement | null = null
  private content: HTMLElement | null = null
  private highlighter: Highlighter | null = null
  private selection: SelectionManager | null = null
  private watcher: Watcher | null = null
  private readonly undoMgr: UndoManager
  private value = ''
  private lastSelection: Selection = { start: 0, end: 0 }
  private composing = false
  private readOnly = false
  private releaseTab = false
  private isolateNextSync = false
  private readonly listeners = new Map<EngineEvent, Set<Listener>>()
  private cleanups: Array<() => void> = []

  constructor(private readonly options: ClEditEngineOptions = {}) {
    this.undoMgr = new UndoManager(options.undo)
  }

  get contentElement(): HTMLElement | null {
    return this.content
  }

  isComposing(): boolean {
    return this.composing
  }

  mount(el: HTMLElement, opts: EngineOptions): void {
    if (this.host) this.destroy()
    const doc = el.ownerDocument
    const content = doc.createElement('div')
    content.className = 'ex-editor-content'
    content.setAttribute('role', 'textbox')
    content.setAttribute('aria-multiline', 'true')
    content.setAttribute('spellcheck', 'false')
    content.tabIndex = 0
    if (opts.placeholder) content.dataset.placeholder = opts.placeholder
    this.readOnly = opts.readOnly ?? false
    if (this.readOnly) {
      content.setAttribute('contenteditable', 'false')
      content.setAttribute('aria-readonly', 'true')
    } else {
      content.setAttribute('contenteditable', editableMode(doc))
    }
    el.classList.add('ex-editor')
    el.appendChild(content)

    this.host = el
    this.content = content
    this.highlighter = new Highlighter(content, this.options.highlight ? { highlight: this.options.highlight } : {})
    this.selection = new SelectionManager(content, this.highlighter)
    this.watcher = new Watcher(content, () => {
      if (!this.composing) this.syncFromDom()
    })
    this.value = normalize(opts.value)
    this.lastSelection = { start: 0, end: 0 }
    this.releaseTab = false
    this.isolateNextSync = false
    this.undoMgr.clear()
    this.render(true)
    this.watcher.start()
    this.bindEvents(el, content)
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.watcher?.stop()
    this.content?.remove()
    this.host?.classList.remove('ex-editor')
    this.host = null
    this.content = null
    this.highlighter = null
    this.selection = null
    this.watcher = null
    this.composing = false
    this.listeners.clear()
  }

  getValue(): string {
    return this.value
  }

  setValue(md: string, opts: { keepUndo?: boolean } = {}): void {
    this.flushDom()
    const text = normalize(md)
    const before = this.readSelection()
    const after = this.clamp(before, text.length)
    const change = diffRange(this.value, text)
    if (opts.keepUndo) {
      if (change) this.undoMgr.record(change, before, after, 'single')
    } else {
      this.undoMgr.clear()
    }
    this.value = text
    this.lastSelection = after
    this.render(!opts.keepUndo)
    this.selection?.set(after.start, after.end)
  }

  getSelection(): Selection {
    const s = this.readSelection()
    return { start: Math.min(s.start, s.end), end: Math.max(s.start, s.end) }
  }

  getCursorPosition(): { line: number; column: number } {
    const caret = this.getSelection().end
    let line = 1
    for (let i = this.value.indexOf('\n'); i !== -1 && i < caret; i = this.value.indexOf('\n', i + 1)) line++
    const lineStart = caret === 0 ? 0 : this.value.lastIndexOf('\n', caret - 1) + 1
    return { line, column: caret - lineStart }
  }

  setSelection(start: number, end: number): void {
    const sel = this.clamp({ start, end }, this.value.length)
    this.lastSelection = sel
    this.selection?.set(sel.start, sel.end)
    this.emit('selectionChange', this.getSelection())
  }

  replace(start: number, end: number, text: string): void {
    this.flushDom()
    const s = Math.max(0, Math.min(start, end, this.value.length))
    const e = Math.min(this.value.length, Math.max(start, end, 0))
    const inserted = normalize(text)
    this.readSelection()
    const caret = s + inserted.length
    this.applyState(
      { text: this.value.slice(0, s) + inserted + this.value.slice(e), selection: { start: caret, end: caret } },
      'single',
    )
  }

  undo(): void {
    this.flushDom()
    const state = this.undoMgr.undo(this.value)
    if (state) this.restoreState(state)
  }

  redo(): void {
    this.flushDom()
    const state = this.undoMgr.redo(this.value)
    if (state) this.restoreState(state)
  }

  focus(): void {
    this.content?.focus({ preventScroll: true })
    this.selection?.set(this.lastSelection.start, this.lastSelection.end)
  }

  on(event: EngineEvent, cb: (payload: unknown) => void): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(cb)
    return () => {
      set.delete(cb)
    }
  }

  getSectionOffsets(): SectionOffset[] {
    const { host, highlighter } = this
    if (!host || !highlighter) return []
    const base = host.getBoundingClientRect().top - host.scrollTop
    return highlighter.sections.map((s) => {
      const rect = s.el.getBoundingClientRect()
      return { start: s.start, end: Math.min(s.end, this.value.length), top: rect.top - base, height: rect.height }
    })
  }

  private emit(event: EngineEvent, payload: unknown): void {
    const set = this.listeners.get(event)
    if (set) for (const cb of [...set]) cb(payload)
  }

  private clamp(sel: Selection, length: number): Selection {
    return {
      start: Math.min(Math.max(0, sel.start), length),
      end: Math.min(Math.max(0, sel.end), length),
    }
  }

  private readSelection(): Selection {
    const saved = this.selection?.hasFocus() ? this.selection.save() : null
    if (saved) this.lastSelection = this.clamp(saved, this.value.length)
    return this.lastSelection
  }

  private render(force: boolean): void {
    const { content, highlighter, watcher, selection } = this
    if (!content || !highlighter || !watcher || !selection) return
    watcher.noWatch(() => {
      highlighter.update(this.value, force)
      content.toggleAttribute('data-empty', this.value === '')
    })
    if (selection.hasFocus()) selection.restore()
  }

  /**
   * Mutation records can be dropped by `noWatch`, so compare the DOM text itself before programmatic edits.
   * An in-progress composition is committed first so its text is never overwritten or duplicated.
   */
  private flushDom(): void {
    if (!this.content) return
    if (this.composing) {
      this.composing = false
      this.syncFromDom()
    } else if (this.content.textContent !== `${this.value}\n`) {
      this.syncFromDom()
    }
  }

  private syncFromDom(): void {
    const { content, selection } = this
    if (!content || !selection) return
    const raw = content.textContent ?? ''
    const normalized = normalize(raw)
    const text = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
    let domSel = selection.save()
    if (domSel && normalized !== raw) {
      domSel = { start: normalize(raw.slice(0, domSel.start)).length, end: normalize(raw.slice(0, domSel.end)).length }
    }
    const before = this.lastSelection
    const after = this.clamp(domSel ?? before, text.length)
    const change = diffRange(this.value, text)
    if (change) {
      const mode: UndoMode = change.removed === '' ? 'typing' : change.inserted === '' ? 'deleting' : 'single'
      if (this.isolateNextSync) this.undoMgr.breakMerge()
      this.undoMgr.record(change, before, after, mode)
      if (this.isolateNextSync) this.undoMgr.breakMerge()
      this.isolateNextSync = false
      this.value = text
    }
    this.lastSelection = after
    selection.set(after.start, after.end)
    this.render(false)
    if (change) this.emit('change', this.value)
    if (after.start !== before.start || after.end !== before.end) this.emit('selectionChange', this.getSelection())
  }

  private applyState(next: TextState, mode: UndoMode): void {
    const change = diffRange(this.value, next.text)
    const after = this.clamp(next.selection, next.text.length)
    if (change) {
      this.undoMgr.record(change, this.lastSelection, after, mode)
      this.value = next.text
      this.render(false)
    }
    this.lastSelection = after
    this.selection?.set(after.start, after.end)
    if (change) this.emit('change', this.value)
    this.emit('selectionChange', this.getSelection())
  }

  private restoreState(state: TextState): void {
    const sel = this.clamp(state.selection, state.text.length)
    this.value = state.text
    this.lastSelection = sel
    this.render(false)
    this.selection?.set(sel.start, sel.end)
    this.emit('change', this.value)
    this.emit('selectionChange', this.getSelection())
  }

  private insideFence(pos: number): boolean {
    const section = this.highlighter?.sectionAt(pos)
    const from = section ? section.start : 0
    const lineStart = pos === 0 ? 0 : this.value.lastIndexOf('\n', pos - 1) + 1
    if (lineStart <= from) return false
    let fence: ReturnType<typeof openFence> = null
    for (const line of this.value.slice(from, lineStart - 1).split('\n')) {
      if (fence) {
        if (closesFence(line, fence)) fence = null
      } else {
        fence = openFence(line)
      }
    }
    return fence !== null
  }

  private onKeydown(e: KeyboardEvent): void {
    if (this.composing || e.isComposing || e.keyCode === 229 || this.readOnly) return
    if (e.key === 'Escape') {
      this.releaseTab = true
      return
    }
    if (MODIFIER_KEYS.has(e.key)) return
    const releaseTab = this.releaseTab
    this.releaseTab = false
    if (e.key === 'Tab' && releaseTab) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && !e.altKey && (k === 'z' || k === 'y')) {
      e.preventDefault()
      if (k === 'y' || e.shiftKey) this.redo()
      else this.undo()
      return
    }
    if (e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Backspace') return
    this.flushDom()
    const state: TextState = { text: this.value, selection: this.getSelection() }
    let result: { state: TextState; mode: UndoMode } | null
    if (e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey && this.insideFence(state.selection.start)) {
      const { start, end } = state.selection
      const lineStart = start === 0 ? 0 : this.value.lastIndexOf('\n', start - 1) + 1
      const insert = `\n${/^[ \t]*/.exec(this.value.slice(lineStart, start))![0]}`
      const caret = start + insert.length
      result = {
        state: { text: this.value.slice(0, start) + insert + this.value.slice(end), selection: { start: caret, end: caret } },
        mode: 'single',
      }
    } else {
      result = handleKeystroke(
        { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: false },
        state,
      )
    }
    if (!result) return
    e.preventDefault()
    this.undoMgr.breakMerge()
    this.applyState(result.state, result.mode)
  }

  private bindEvents(host: HTMLElement, content: HTMLElement): void {
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      target.addEventListener(type, fn)
      this.cleanups.push(() => target.removeEventListener(type, fn))
    }
    listen(content, 'keydown', (e) => this.onKeydown(e))
    listen(content, 'beforeinput', (e) => {
      if (this.composing) return
      if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo') return
      e.preventDefault()
      if (e.inputType === 'historyUndo') this.undo()
      else this.redo()
    })
    listen(content, 'compositionstart', () => {
      this.flushDom()
      this.readSelection()
      this.isolateNextSync = true
      this.composing = true
    })
    listen(content, 'compositionend', () => {
      if (!this.composing) return
      this.composing = false
      this.syncFromDom()
    })
    listen(content, 'blur', () => {
      this.releaseTab = false
      if (this.composing) this.flushDom()
    })
    listen(content, 'mousedown', () => {
      this.releaseTab = false
    })
    const forward = (event: 'paste' | 'drop', e: Event) => {
      if (this.readOnly) return
      this.isolateNextSync = true
      this.undoMgr.breakMerge()
      this.emit(event, e)
    }
    listen(content, 'paste', (e) => forward('paste', e))
    listen(content, 'drop', (e) => forward('drop', e))
    listen(host, 'scroll', () => this.emit('scroll', { scrollTop: host.scrollTop }))

    const doc = host.ownerDocument
    const onSelectionChange = () => {
      if (this.composing || !this.selection?.hasFocus()) return
      const prev = this.lastSelection
      const next = this.readSelection()
      if (next.start !== prev.start || next.end !== prev.end) {
        this.undoMgr.breakMerge()
        this.emit('selectionChange', this.getSelection())
      }
    }
    doc.addEventListener('selectionchange', onSelectionChange)
    this.cleanups.push(() => doc.removeEventListener('selectionchange', onSelectionChange))
  }
}
