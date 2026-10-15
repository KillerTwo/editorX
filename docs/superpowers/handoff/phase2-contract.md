# Phase 2 shared contract (controller-defined; binding for plans 2a and 2b)

Package: `packages/markdown-core` → `@geekx/markdown-core`. Framework-free TS (no React, NO 'use client' banner). Build: tsup ESM + d.ts, single entry `src/index.ts`, plus `./styles.css` export if the package ships styles (tooling/copy-css.mjs skips when `src/styles.css` is missing). Scaffold mirrors packages/theme (tsconfig extends tooling/tsconfig.base.json, vitest jsdom + tooling/test/setup-dom.ts) minus the 'use client' prepend.

## File ownership
- Plan 2a owns: package scaffold; `src/types.ts`; `src/sections.ts`; `src/renderer/**`; `src/commands/**`; `src/utils/**`; `src/index.ts` (2b appends exports).
- Plan 2b owns: `src/engine/**` (cledit port, ClEditEngine, Prism markdown grammar for editor highlighting); `src/scroll-sync/**`; `src/styles.css` (editor highlight + preview base styles using `--ex-*`); `apps/playground/app/markdown-core/**`; `apps/playground/e2e/markdown-core.spec.ts`.
- Execution order: all 2a tasks, then all 2b tasks. 2b may import anything 2a exports.

## Types (`src/types.ts`, created by 2a Task 1 exactly as below)

```ts
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
```

## Behavioral contract
- `splitSections(md: string): SourceSection[]` (2a, `src/sections.ts`): port StackEdit's section splitting (sections start at ATX/setext headings; must not split inside fenced code blocks); sections are contiguous and cover the whole text (`sections[0].start === 0`, last `.end === md.length`, each `.start === prev.end`). Both the renderer (2a) and the ClEditEngine highlighter (2b) use this function so section indices line up.
- `createRenderer(options?: RendererOptions): Renderer` (2a). `RenderResult.html` = concatenation of `<div class="ex-preview-section" data-section-index="{i}">{sectionHtml}</div>` for each section, in order; `toc` ids are stable slugs used as heading ids. Rendering caches per-section by section text (incremental).
- Mermaid: renderer emits `<div class="ex-mermaid" data-ex-diagram="{base64-or-escaped source}"></div>` placeholders; `renderDiagrams(container: HTMLElement, opts: { theme: 'light' | 'dark' }): Promise<void>` (2a, `src/renderer/diagrams.ts`) lazily imports mermaid and replaces placeholders with sanitized SVG; per-block errors shown inside that block only.
- KaTeX rendered synchronously to string (katex imported normally or lazily — 2a decides and justifies).
- Commands (2a): pure transforms `(state: TextState, args?) => TextState` in `src/commands/*`, registry `commands` object keyed by name; adapter `runCommand(engine: EditorEngine, transform, args?)` applies the diff via `engine.replace` (minimal replaced range) then `engine.setSelection`. `undo`/`redo` commands call engine methods directly.
- Scroll sync (2b): `createScrollSync(engine: EditorEngine, editorScrollEl: HTMLElement, previewEl: HTMLElement): { destroy(): void; refresh(): void }` — preview sections located via `.ex-preview-section[data-section-index]`; pure interpolation function exported for unit tests.
- Utilities (2a, `src/utils/*`): `countWords(md): { words: number; chars: number; lines: number }` — `words`（CSDN 状态栏"字数"）= CJK 字符（含中日韩统一表意文字及全角标点）逐个计数 + 连续拉丁字母/数字序列各计 1；`chars` = 所有非空白字符数；`lines` = 行数（空字符串为 1 行，按 `\n` 分割）, `exportMarkdown`, `exportHtml(renderResult, { title })` returning full standalone HTML string, `importFile(file: File): Promise<string>`, `htmlToMarkdown(html: string): string` (turndown + GFM; `<div data-ex-embed>` → ex-embed fence).

## Addendum A (from CSDN reference screenshots; binding, supersedes conflicting text above)
1. **TOC syntax**: both `[TOC]` and `@[TOC](自定义目录标题)` (title optional, `@[TOC]` allowed) on their own line render `<div class="ex-toc"><p class="ex-toc-title">{title}</p><ul>…nested by level…</ul></div>` (title paragraph omitted when no title). Links are `<a href="#{id}">`. TOC covers headings of the whole document, not only the section; because of the per-section cache, sections containing a TOC marker must be re-rendered when the toc changes (cache key includes toc signature for such sections).
2. **flowchart.js diagrams**: fences with lang `flow` or `flowchart`, AND `mermaid` fences whose body matches flowchart.js syntax (first non-empty line `flowchart` followed by lines containing `=>` definitions, e.g. `st=>start: 开始`) render placeholder `<div class="ex-flowchart" data-ex-diagram="…"></div>` (the leading `flowchart` line stripped). `renderDiagrams` also handles these by lazily importing `flowchart.js` (npm `flowchart.js`, needs `raphael` in browser) and rendering into the block; same per-block error isolation; theme passed as line/font colors. Mermaid fences with ordinary mermaid syntax (`graph`, `flowchart TD`, `sequenceDiagram`, `gantt`, `classDiagram`, `stateDiagram`, `pie`, …) stay mermaid. Detection fn `isFlowchartJs(src: string): boolean` exported for tests.
3. **Status bar stats**: add `countHtml(html: string): { words: number; paragraphs: number }` in `src/utils/count.ts` (words = same counting rule on text content; paragraphs = number of block elements p/li/h1-6/blockquote/pre/tr with non-empty text). `ClEditEngine` (2b) must provide the cursor line/column: add to `EditorEngine` a method `getCursorPosition(): { line: number; column: number }` (1-based line, 0-based column, matching CSDN "当前行 1, 当前列 0").
5. **Cross-plan decisions**: `RenderedSection.html` is the INNER section HTML (no wrapper). Footnote list may be an extra trailing preview section with index === source section count (`ex-footnotes`); scroll sync ignores it. 2a sets Prism manual mode (`Prism.manual = true` before load / no auto-highlight). Package root exports `createRenderer`, `renderDiagrams`, `isFlowchartJs`, `splitSections`, `commands`, `runCommand`, `execCommand`, `countWords`, `countHtml`, other utils, all types.
6. **Line endings**: `ClEditEngine` (2b) normalizes all incoming text (`mount` value, `setValue`, paste/drop, `replace`) to LF; `getValue()` always returns LF-only text. Commands assume LF.
4. **Reference-style links and footnotes** (`[text][1]`, `[1]: url`, `[^1]`) must render (markdown-it core + footnote plugin).

## Addendum B (phase 2b final fix wave; binding for phase 3 wrappers)
1. **New required `EditorEngine` members**: `setReadOnly(readOnly: boolean): void` and `setPlaceholder(text: string | undefined): void` update the mounted textbox in place (contenteditable / `aria-readonly`, `data-placeholder` / `aria-placeholder`) without losing value, selection or undo history; callable before mount (mount options take precedence when given). `ClEditEngine` additionally has `setAriaLabel(label | undefined)`; `EngineOptions` gains optional `ariaLabel` (-> `aria-label`).
2. **Typed events**: `EngineEventMap { change: string; selectionChange: Selection; scroll: { scrollTop: number }; paste: ClipboardEvent; drop: DragEvent }`, `EngineEvent = keyof EngineEventMap`, `on<E extends EngineEvent>(event: E, cb: (payload: EngineEventMap[E]) => void): Unsubscribe`. Callbacks typed `(payload: unknown) => void` remain valid.
3. **Lifecycle**: `destroy()` only detaches from the DOM; it keeps the value, undo history and `on()` subscriptions, and first syncs not-yet-delivered DOM edits, so it may emit one final `change`. `mount()` with the same (normalized) value keeps undo history; a different value replaces the value and clears undo. Wrappers that remount (e.g. React StrictMode effects) should pass `engine.getValue()`. Options omitted at mount keep their current state.
4. **`setValue`** does not emit `change`; setting the current value is a no-op (no undo clear, no DOM rebuild). Call scroll-sync `refresh()` after `setValue` (normally via the following preview render).
5. **Preview patching**: package root exports `patchPreview(container: HTMLElement, sections: readonly { html: string }[], previous: string[]): { changed: HTMLElement[] }` (`PreviewPatchResult`). Sections are direct children `<div class="ex-preview-section" data-section-index="i">`; the unchanged prefix/suffix (matched by HTML) keep their elements (rendered diagrams/images survive), only the middle is rebuilt; `previous` is caller-owned state updated in place (empty it to force a rebuild). Call `renderDiagrams` and scroll-sync `refresh()` after it.
6. **Scroll sync**: `createScrollSync(...)` returns the exported `ScrollSync` interface `{ destroy(): void; refresh(): void }`. Also exported: `UndoManagerOptions`, `EngineEventMap`. `markdownGrammar` is deep-frozen (RegExps excluded) and read-only.
