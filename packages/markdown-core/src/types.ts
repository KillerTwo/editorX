export interface Selection { start: number; end: number }
export interface TextState { text: string; selection: Selection }

export interface EngineOptions { value: string; placeholder?: string; readOnly?: boolean }
export interface SectionOffset { start: number; end: number; top: number; height: number }
export type EngineEvent = 'change' | 'selectionChange' | 'scroll' | 'paste' | 'drop'
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
  on(event: EngineEvent, cb: (payload: unknown) => void): Unsubscribe
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
