# Notes for plan 2b from plan 2a final review (binding unless superseded)

1. Section alignment: `result.sections.length === splitSections(text).length` always. Footnote list is appended INSIDE the last section's HTML (`.ex-footnotes`), not an extra section. Scroll sync: treat content from `.ex-footnotes` onward in the last section as unmapped tail.
2. Patch preview per section: never `innerHTML = result.html` per keystroke; compare each `section.html` to previous and replace only changed section nodes (TOC sections and the last section change when headings/footnotes change elsewhere). After patching call `renderDiagrams`, then scroll-sync `refresh()` after it resolves.
3. Performance: cold render 1.1–1.6 s in jsdom on 8.5k lines → schedule on idle/debounce for mount/setValue/large paste. Highlighter calls `splitSections` directly (~1 ms). Include reference definitions in the 10k-line E2E fixture (I1 fix makes definition edits incremental).
4. Status bar: `countHtml` parses whole HTML with DOMParser → debounce; `countWords` O(n).
5. No SSR: sanitizer needs DOM; playground page must render the engine/preview client-only.
6. Prism: import via this package so manual mode is set first. Do NOT register the editor grammar under `Prism.languages.markdown` (preview uses it for ```markdown fences) — use a distinct key or tokenize with a private grammar object.
7. Mermaid: its `<style>` is preserved (ruling) → drop class-based Mermaid coloring from 2b Task 6, keep only container styles. Failed chunk load won't retry for the same theme unless the block is re-inserted. Playwright must cover real mermaid + flowchart.js/raphael bundling under Next.
8. Engine: normalize to LF everywhere (contract §A6). `runCommand` normalizes backward selections after the 2a fix wave, but `getSelection` should still return start ≤ end. Styles/playground must include `katex/dist/katex.min.css`.
9. Export: pass live preview HTML (after renderDiagrams) to `exportHtml` for SVG; otherwise diagrams export as source code blocks.
