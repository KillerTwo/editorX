// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditCore.js
import { closesFence, openFence } from '../sections'
import type {
  EditorEngine,
  EngineEvent,
  EngineEventMap,
  EngineOptions,
  SectionOffset,
  Selection,
  TextState,
  Unsubscribe,
} from '../types'
import { DEFAULT_LINE_HEIGHT, Highlighter } from './cledit/highlighter'
import { handleKeystroke } from './cledit/keystrokes'
import { SelectionManager, topLevelChild } from './cledit/selection'
import { UndoManager, type UndoManagerOptions, type UndoMode } from './cledit/undo'
import { applyChange, diffRange, type TextChange } from './cledit/utils'
import { Watcher } from './cledit/watcher'

export interface ClEditEngineOptions {
  highlight?: (text: string) => string
  undo?: UndoManagerOptions
}

type Listener = (payload: unknown) => void

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])
const NOTHING_TOUCHED: ReadonlySet<Node> = new Set()

/** Top-level children changed since the last sync, or `'all'` when the section structure itself may have changed. */
type DirtyDom = Set<Node> | 'all' | null

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

/**
 * Read once per mount for the per-section `contain-intrinsic-size` estimate (hard lines × line height; soft wraps
 * are not counted). The estimate only matters until a section is first rendered: `auto` then keeps its real size.
 */
function measureLineHeight(el: HTMLElement): number {
  const value = el.ownerDocument.defaultView?.getComputedStyle(el).lineHeight ?? ''
  const px = value.endsWith('px') ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(px) && px > 0 ? px : DEFAULT_LINE_HEIGHT
}

/** Ctrl/Cmd+Home/End and (macOS) Cmd+ArrowUp/ArrowDown: `true` = document end, `false` = start, `null` = other keys. */
function documentBoundary(e: KeyboardEvent): boolean | null {
  if (e.altKey) return null
  if ((e.ctrlKey || e.metaKey) && (e.key === 'Home' || e.key === 'End')) return e.key === 'End'
  if (e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return e.key === 'ArrowDown'
  return null
}

/**
 * contenteditable Markdown editor with per-section highlighting.
 *
 * Editor sections use `content-visibility: auto`, so off-screen sections are not laid out. The engine moves the caret
 * to the document boundaries itself (see {@link documentBoundary}) because native navigation cannot enter skipped
 * sections. Known limitation: PageUp/PageDown move by estimated heights across not-yet-rendered sections, so the
 * distance per page can differ from the visible page height (the caret still lands on a valid position).
 *
 * Lifecycle: `destroy()` only detaches from the DOM. The value, undo history and `on()` subscriptions survive it, so
 * the same instance can be mounted again (e.g. by a React effect that re-runs); remounting with the current value
 * keeps the undo history. Read-only state, placeholder and aria-label can be changed in place while mounted.
 */
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
  private placeholder: string | undefined
  private ariaLabel: string | undefined
  private releaseTab = false
  private isolateNextSync = false
  private dirty: DirtyDom = null
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

  /** Options left out keep their current state (from an earlier mount or setter); a different value clears undo. */
  mount(el: HTMLElement, opts: EngineOptions): void {
    if (this.host) this.destroy()
    const doc = el.ownerDocument
    const content = doc.createElement('div')
    content.className = 'ex-editor-content'
    content.setAttribute('role', 'textbox')
    content.setAttribute('aria-multiline', 'true')
    content.setAttribute('spellcheck', 'false')
    content.tabIndex = 0
    this.content = content
    this.readOnly = opts.readOnly ?? this.readOnly
    this.placeholder = opts.placeholder ?? this.placeholder
    this.ariaLabel = opts.ariaLabel ?? this.ariaLabel
    this.applyReadOnly()
    this.applyPlaceholder()
    this.applyAriaLabel()
    el.classList.add('ex-editor')
    el.appendChild(content)

    this.host = el
    this.highlighter = new Highlighter(content, {
      ...(this.options.highlight ? { highlight: this.options.highlight } : {}),
      lineHeight: measureLineHeight(content),
    })
    this.selection = new SelectionManager(content, this.highlighter)
    this.dirty = null
    this.watcher = new Watcher(
      content,
      (records) => {
        this.noteMutations(records)
        if (!this.composing) this.syncFromDom()
      },
      (records) => this.noteMutations(records),
    )
    const text = normalize(opts.value)
    if (text === this.value) {
      this.lastSelection = this.clamp(this.lastSelection, text.length)
      this.undoMgr.breakMerge()
    } else {
      this.value = text
      this.lastSelection = { start: 0, end: 0 }
      this.undoMgr.clear()
    }
    this.releaseTab = false
    this.isolateNextSync = false
    this.render(true)
    this.watcher.start()
    this.bindEvents(el, content)
  }

  /** Detaches from the DOM. Keeps the value, undo history and `on()` subscriptions for a later `mount()`. */
  destroy(): void {
    this.flushDom()
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
    this.dirty = null
  }

  setReadOnly(readOnly: boolean): void {
    if (readOnly === this.readOnly) return
    if (readOnly) this.flushDom()
    this.readOnly = readOnly
    this.releaseTab = false
    const { start, end } = this.readSelection()
    this.applyReadOnly()
    if (this.selection?.hasFocus()) this.selection.set(start, end)
  }

  setPlaceholder(text: string | undefined): void {
    this.placeholder = text
    this.applyPlaceholder()
  }

  setAriaLabel(label: string | undefined): void {
    this.ariaLabel = label
    this.applyAriaLabel()
  }

  /** Includes DOM edits whose mutation records are not delivered yet (syncing them emits `change`), except mid-IME. */
  getValue(): string {
    if (this.watcher && !this.composing) {
      this.noteMutations(this.watcher.takeRecords())
      if (this.dirty) this.syncFromDom()
    }
    return this.value
  }

  /** Does not emit `change`; setting the current value is a no-op (undo history and DOM are kept). */
  setValue(md: string, opts: { keepUndo?: boolean } = {}): void {
    this.flushDom()
    const text = normalize(md)
    if (text === this.value) return
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
    this.selection?.setOffsets(after.start, after.end)
    this.render(!opts.keepUndo, NOTHING_TOUCHED)
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
    const prev = this.readSelection()
    if (prev.start !== sel.start || prev.end !== sel.end) this.undoMgr.breakMerge()
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

  on<E extends EngineEvent>(event: E, cb: (payload: EngineEventMap[E]) => void): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    const listener = cb as Listener
    set.add(listener)
    return () => {
      set.delete(listener)
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

  private emit<E extends EngineEvent>(event: E, payload: EngineEventMap[E]): void {
    const set = this.listeners.get(event)
    if (set) for (const cb of [...set]) cb(payload)
  }

  private applyReadOnly(): void {
    const { content } = this
    if (!content) return
    if (this.readOnly) {
      content.setAttribute('contenteditable', 'false')
      content.setAttribute('aria-readonly', 'true')
    } else {
      content.setAttribute('contenteditable', editableMode(content.ownerDocument))
      content.removeAttribute('aria-readonly')
    }
  }

  private applyPlaceholder(): void {
    const { content, placeholder } = this
    if (!content) return
    if (placeholder) {
      content.dataset.placeholder = placeholder
      content.setAttribute('aria-placeholder', placeholder)
    } else {
      delete content.dataset.placeholder
      content.removeAttribute('aria-placeholder')
    }
  }

  private applyAriaLabel(): void {
    const { content, ariaLabel } = this
    if (!content) return
    if (ariaLabel) content.setAttribute('aria-label', ariaLabel)
    else content.removeAttribute('aria-label')
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

  /**
   * Re-highlights changed sections and restores the selection manager's offsets (callers set them first, so the
   * native selection is written at most once). `touched`: see {@link Highlighter.update}.
   */
  private render(force: boolean, touched?: ReadonlySet<Node>): void {
    const { content, highlighter, watcher, selection } = this
    if (!content || !highlighter || !watcher || !selection) return
    watcher.noWatch(() => {
      highlighter.update(this.value, force, touched)
      content.toggleAttribute('data-empty', this.value === '')
    })
    if (selection.hasFocus()) selection.restore()
    // Records undelivered when noWatch stopped the observer are parked in `dirty`; make sure they get synced.
    if (this.dirty && !this.composing) {
      queueMicrotask(() => {
        if (this.content === content && !this.composing) this.flushDom()
      })
    }
  }

  private noteMutations(records: readonly MutationRecord[]): void {
    const { content } = this
    if (!content || records.length === 0 || this.dirty === 'all') return
    const touched = this.dirty ?? new Set<Node>()
    for (const record of records) {
      const top = record.target === content ? undefined : topLevelChild(content, record.target)
      if (!top) {
        this.dirty = 'all'
        return
      }
      touched.add(top)
    }
    this.dirty = touched
  }

  /**
   * Syncs DOM edits whose mutation records were not delivered yet, so programmatic edits never overwrite them. The
   * DOM is only read when records say it changed. An in-progress composition is committed first so its text is never
   * overwritten or duplicated.
   */
  private flushDom(): void {
    if (!this.content || !this.watcher) return
    this.noteMutations(this.watcher.takeRecords())
    if (this.composing) {
      this.composing = false
      this.syncFromDom()
    } else if (this.dirty) {
      this.syncFromDom()
    }
  }

  /**
   * Derives the edit from the touched sections only: untouched sections still hold their last highlighted text.
   * Returns null when that is not safe (structure changed, or text needs normalizing) and the whole DOM must be read.
   */
  private readTouchedSections(touched: ReadonlySet<Node>): { text: string; change: TextChange | null } | null {
    const { content, highlighter } = this
    if (!content || !highlighter) return null
    const sections = highlighter.sections
    let first = -1
    let last = -1
    let found = 0
    sections.forEach((s, i) => {
      if (!touched.has(s.el)) return
      found++
      if (first < 0) first = i
      last = i
    })
    if (found !== touched.size) return null
    let before = ''
    let after = ''
    for (let i = first; i <= last; i++) {
      const s = sections[i]!
      if (s.el.parentNode !== content) return null
      const text = touched.has(s.el) ? (s.el.textContent ?? '') : s.text
      if (text.includes('\r') || text.includes('\u0000')) return null
      before += s.text
      after += text
    }
    const local = diffRange(before, after)
    if (!local) return { text: this.value, change: null }
    // Sections span value + '\n'; a change reaching that final newline goes through the generic path below.
    const change = { ...local, start: sections[first]!.start + local.start }
    if (change.start + change.removed.length <= this.value.length) {
      return { text: applyChange(this.value, change), change }
    }
    const full = applyChange(`${this.value}\n`, change)
    const text = full.endsWith('\n') ? full.slice(0, -1) : full
    return { text, change: diffRange(this.value, text) }
  }

  private syncFromDom(): void {
    const { content, selection } = this
    if (!content || !selection) return
    if (this.watcher) this.noteMutations(this.watcher.takeRecords())
    const dirty = this.dirty
    this.dirty = null
    const local = dirty === null ? { text: this.value, change: null } : dirty === 'all' ? null : this.readTouchedSections(dirty)
    let text: string
    let change: TextChange | null
    let domSel = selection.save()
    if (local) {
      ;({ text, change } = local)
    } else {
      const raw = content.textContent ?? ''
      const normalized = normalize(raw)
      text = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
      if (domSel && normalized !== raw) {
        domSel = { start: normalize(raw.slice(0, domSel.start)).length, end: normalize(raw.slice(0, domSel.end)).length }
      }
      change = diffRange(this.value, text)
    }
    const before = this.lastSelection
    const after = this.clamp(domSel ?? before, text.length)
    if (change) {
      const mode: UndoMode = change.removed === '' ? 'typing' : change.inserted === '' ? 'deleting' : 'single'
      if (this.isolateNextSync) this.undoMgr.breakMerge()
      this.undoMgr.record(change, before, after, mode)
      if (this.isolateNextSync) this.undoMgr.breakMerge()
      this.isolateNextSync = false
      this.value = text
    }
    this.lastSelection = after
    selection.setOffsets(after.start, after.end)
    this.render(false, dirty === 'all' ? undefined : (dirty ?? NOTHING_TOUCHED))
    if (change) this.emit('change', this.value)
    if (after.start !== before.start || after.end !== before.end) this.emit('selectionChange', this.getSelection())
  }

  /** Callers flush the DOM first, so no section is touched. */
  private applyState(next: TextState, mode: UndoMode): void {
    const change = diffRange(this.value, next.text)
    const after = this.clamp(next.selection, next.text.length)
    if (change) this.undoMgr.record(change, this.lastSelection, after, mode)
    this.lastSelection = after
    if (change) {
      this.value = next.text
      this.selection?.setOffsets(after.start, after.end)
      this.render(false, NOTHING_TOUCHED)
    } else {
      this.selection?.set(after.start, after.end)
    }
    if (change) this.emit('change', this.value)
    this.emit('selectionChange', this.getSelection())
  }

  private restoreState(state: TextState): void {
    const sel = this.clamp(state.selection, state.text.length)
    this.value = state.text
    this.lastSelection = sel
    this.selection?.setOffsets(sel.start, sel.end)
    this.render(false, NOTHING_TOUCHED)
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
    const boundary = documentBoundary(e)
    if (boundary !== null) {
      e.preventDefault()
      this.moveToBoundary(boundary, e.shiftKey)
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

  private moveToBoundary(end: boolean, extend: boolean): void {
    this.flushDom()
    const anchor = this.readSelection().start
    const caret = end ? this.value.length : 0
    this.undoMgr.breakMerge()
    this.setSelection(extend ? anchor : caret, caret)
    const host = this.host
    if (!host) return
    const scroll = () => {
      host.scrollTop = end ? host.scrollHeight : 0
    }
    scroll()
    // The target section only gets its real size once rendered, a frame or two later.
    const win = host.ownerDocument.defaultView
    if (!end || !win) return
    const scrolledTo = host.scrollTop
    win.requestAnimationFrame(() =>
      win.requestAnimationFrame(() => {
        if (this.host === host && host.scrollTop === scrolledTo) scroll()
      }),
    )
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
      if (this.composing || this.readOnly) return
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
    const forward = <E extends 'paste' | 'drop'>(event: E, e: EngineEventMap[E]) => {
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
