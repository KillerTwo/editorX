export interface Selection { start: number; end: number }
export interface TextState { text: string; selection: Selection }

export interface EngineOptions {
  value: string
  placeholder?: string
  readOnly?: boolean
  /** Accessible name of the textbox (`aria-label`). */
  ariaLabel?: string
}
export interface SectionOffset { start: number; end: number; top: number; height: number }
/** Payload of each engine event. */
export interface EngineEventMap {
  /** The new value (same as `getValue()`); not emitted by `setValue`. */
  change: string
  /** Normalized selection (`start <= end`). */
  selectionChange: Selection
  scroll: { scrollTop: number }
  paste: ClipboardEvent
  drop: DragEvent
}
export type EngineEvent = keyof EngineEventMap
export type Unsubscribe = () => void

export interface EditorEngine {
  mount(el: HTMLElement, opts: EngineOptions): void
  destroy(): void
  getValue(): string
  setValue(md: string, opts?: { keepUndo?: boolean }): void
  getSelection(): Selection
  setSelection(start: number, end: number): void
  replace(start: number, end: number, text: string): void
  undo(): void
  redo(): void
  focus(): void
  /** Toggles read-only in place, keeping value, selection and undo history. */
  setReadOnly(readOnly: boolean): void
  /** Sets or (with `undefined`) removes the placeholder in place. */
  setPlaceholder(text: string | undefined): void
  on<E extends EngineEvent>(event: E, cb: (payload: EngineEventMap[E]) => void): Unsubscribe
  getSectionOffsets(): SectionOffset[]
  getCursorPosition(): { line: number; column: number }
}

export interface SourceSection { text: string; start: number; end: number }
export interface RenderedSection extends SourceSection { html: string }
export interface TocItem { level: number; text: string; id: string }
export interface RenderResult { html: string; sections: RenderedSection[]; toc: TocItem[] }

export interface EmbedDef { type: string; renderHtml(payload: unknown): string }
export interface RendererOptions {
  embeds?: EmbedDef[]
  math?: boolean      // default true
  diagrams?: boolean  // default true (mermaid placeholders)
  emoji?: boolean     // default true
}
export interface Renderer { render(md: string): RenderResult }
