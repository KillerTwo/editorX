# Notes for phase 3 from phase 2 (binding unless superseded)

Phase 2 = plans 2a (49da3f7..bb5b85c) + 2b (bb5b85c..4ec434e). Contract: .superpowers/phase2-contract.md incl. Addendum A and B.

## React wrapper (<MarkdownEditor />) rules
1. Engine listeners survive destroy()/remount. destroy() keeps value, undo history, subscriptions and may emit one final `change` — unsubscribe before destroy() or tolerate it.
2. mount() with the same value keeps undo; a different value clears it → remount with `engine.getValue()`, never the initial prop.
3. setValue with identical text is a no-op; setValue does NOT emit `change` → call scroll-sync `refresh()` after setValue. Controlled mode: compare before calling setValue.
4. readOnly / placeholder / ariaLabel are live: setReadOnly, setPlaceholder, setAriaLabel (ClEditEngine only).
5. getValue() flushes undelivered DOM edits (may emit `change` synchronously; safe inside a change callback).
6. Page-level pipeline to port (apps/playground/app/markdown-core/markdown-core-demo.tsx): debounced 200ms render → yield → `patchPreview` (exported, prefix/suffix) → rAF scroll-sync refresh → renderDiagrams (can be limited to `changed`) → refresh; per-section cached counts in requestIdleCallback; generation counter drops stale work; theme switch = renderDiagrams only. Status counts lag up to ~1s by design.
7. Scroll sync: editorScrollEl must be the engine host and the scrolling element; no `scroll-behavior: smooth` on either pane; refresh after every preview patch, after renderDiagrams, on image load/error. ResizeObserver initial callback syncs editor→preview at mount.
8. Editor sections use content-visibility:auto with per-section contain-intrinsic-size; engine handles Ctrl/Cmd+Home/End and macOS Cmd+Up/Down; PageUp/Down distance uses estimates (documented limitation).
9. Exports available: patchPreview, PreviewPatchResult, ScrollSync, UndoManagerOptions, EngineEventMap (typed on()), markdownGrammar (frozen except RegExps).
10. Client-only: sanitizer needs DOM; importing the package on the server is safe (verified), but engine/preview must mount in effects.
11. Pass live preview HTML (after renderDiagrams) to exportHtml so diagrams export as SVG.

## Perf gates
- 10k-line latency e2e (`@perf`, project chromium-perf, workers 1, trace off): burst/paused/Enter+Backspace median ~14-16ms, p95 ~17-21ms. Run alone with `--project chromium-perf --no-deps`. Long-task test: inserting a heading at top of 10k doc → no task > 50ms.
- The Playwright MCP headed browser is frame-throttled (~1 fps idle) on this host — never use it for latency numbers; use the headless perf project.
- Visual baselines are Windows-only (*-chromium-win32.png).

## Deferred minors still open (consider when touching the area)
- Keystrokes: all-'1.' lists rewritten; ')' vs '.' delimiter renumbered; mid-list empty exit leaves gap; Enter with selection in list item no continuation; Tab multi-line selection ending col 0 indents next line; plain Tab replaces selection; nested quotes one level; '* * *' treated as list; '- [ ]' w/o space drops checkbox.
- Engine: placeholder visible during composition in empty doc; Safari post-compositionend mutation not covered by e2e (Chromium only); isolateNextSync over-split; caret restore polish on inverted selectionchange/MO order; diffRange O(log n) substrings.
- Scroll sync: zero-height preview section jump when scrolling from preview; tail round-trip drift ≤ ~1 viewport.
- Styles: grammar test hardcodes alias mapping; .ex-embed overflow-x may clip custom embed popovers.
- Renderer (2a): definition collector misses definitions inside blockquotes/lists, multi-line labels, escaped \]; spoofing nonce, HTML-block splitting, target rel, TOC math text, CDN KaTeX default.
- Playground: superseded full render drops full-rebuild flag (harmless); idle-timeout counts all sections at once.

## Visual gaps vs CSDN reference (phase 3 owns pixel parity)
No CSDN top bar/tabs/toolbar/sidebar; editor uses monospace + coloured tokens vs CSDN proportional font + grey markers; preview type larger/bolder; footnote styling; status bar lacks save/publish area; flowchart nodes heavier. See .superpowers/reference-index.md.
