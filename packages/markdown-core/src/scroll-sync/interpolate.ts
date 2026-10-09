// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/scrollSync.js
import type { SectionOffset } from '../types'

export type ScrollSide = 'editor' | 'preview'

export interface Dimension {
  top: number
  height: number
}

export interface SectionPair {
  editor: Dimension
  preview: Dimension
}

/** Scroll extent of the source pane: `max = scrollHeight - clientHeight`, `viewport = clientHeight`. */
export interface ScrollRange {
  max: number
  viewport: number
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0)

function project(pos: number, src: Dimension, dst: Dimension): number {
  const top = finite(src.top)
  const height = Math.max(0, finite(src.height))
  const ratio = Math.max(0, (pos - top) / (height || 1))
  return finite(dst.top) + Math.max(0, finite(dst.height)) * ratio
}

/**
 * Maps a scroll position by section layout. A virtual head segment spans [0, first section top] on both
 * sides, so content padding above the first section maps 0 to 0.
 */
export function mapScrollTop(scrollTop: number, pairs: SectionPair[], from: ScrollSide): number {
  if (pairs.length === 0) return scrollTop
  const to: ScrollSide = from === 'editor' ? 'preview' : 'editor'
  const pos = Math.max(0, finite(scrollTop))
  const first = pairs[0]!
  const headSrc = { top: 0, height: Math.max(0, finite(first[from].top)) }
  if (pos <= headSrc.height) return project(pos, headSrc, { top: 0, height: Math.max(0, finite(first[to].top)) })
  for (const pair of pairs) {
    const src = pair[from]
    if (pos > finite(src.top) + Math.max(0, finite(src.height))) continue
    return project(pos, src, pair[to])
  }
  const last = pairs[pairs.length - 1]![to]
  return finite(last.top) + Math.max(0, finite(last.height))
}

/**
 * Scroll position for the target pane, clamped to `[0, dstMax]`. Near both ends the layout mapping is blended
 * linearly with scroll progress so that 0 ↔ 0 and srcMax ↔ dstMax, without jumps: the head window covers the
 * padding above the first section; the tail window starts at the last section's top or one viewport above srcMax,
 * whichever is lower, so it always spans at least one viewport. Negative input (elastic overscroll) is treated as 0.
 */
export function syncScrollTop(
  scrollTop: number,
  pairs: SectionPair[],
  from: ScrollSide,
  src: ScrollRange,
  dstMax: number,
): number {
  const maxDst = Math.max(0, finite(dstMax))
  const clamp = (n: number) => Math.min(Math.max(0, finite(n)), maxDst)
  const pos = Math.max(0, finite(scrollTop))
  if (pairs.length === 0) return clamp(pos)
  const srcMax = Math.max(0, finite(src.max))
  if (srcMax <= 0) return clamp(mapScrollTop(pos, pairs, from))
  const to: ScrollSide = from === 'editor' ? 'preview' : 'editor'

  const lastTop = finite(pairs[pairs.length - 1]![from].top)
  const tailStart = Math.max(0, Math.min(lastTop, srcMax - Math.max(0, finite(src.viewport))))
  if (pos >= tailStart) {
    const startDst = clamp(mapScrollTop(tailStart, pairs, from))
    const progress = srcMax > tailStart ? Math.min(1, (pos - tailStart) / (srcMax - tailStart)) : 1
    return startDst + (maxDst - startDst) * progress
  }

  const first = pairs[0]!
  const headEnd = Math.min(tailStart, Math.max(0, finite(first[from].top), finite(first[to].top)))
  if (headEnd > 0 && pos < headEnd) return (clamp(mapScrollTop(headEnd, pairs, from)) * pos) / headEnd
  return clamp(mapScrollTop(pos, pairs, from))
}

/**
 * Offsets are relative to the top of `previewEl`'s scroll content, indexed by `data-section-index`.
 * Like `ClEditEngine.getSectionOffsets()`, this ignores `clientTop`; the border causes the same constant shift on both sides.
 */
export function measurePreviewSections(previewEl: HTMLElement): Dimension[] {
  const base = previewEl.getBoundingClientRect().top - previewEl.scrollTop
  const out: Dimension[] = []
  for (const el of previewEl.querySelectorAll<HTMLElement>('.ex-preview-section[data-section-index]')) {
    const index = Number(el.dataset.sectionIndex)
    if (!Number.isInteger(index) || index < 0) continue
    const rect = el.getBoundingClientRect()
    out[index] = { top: rect.top - base, height: rect.height }
  }
  return out
}

/**
 * Pairs editor and preview sections by index. Every pair except the last spans up to the next pair's top on
 * both sides (absorbing collapsed margins and unpaired sections), so the mapping is continuous at boundaries.
 * Preview sections with index >= editor.length are not paired; the last pair's preview height is extended to
 * cover them. (2a renders footnotes inside the last preview section, so they are already part of its height.)
 */
export function buildPairs(editor: SectionOffset[], preview: Array<Dimension | undefined>): SectionPair[] {
  const pairs: SectionPair[] = []
  const n = Math.min(editor.length, preview.length)
  for (let i = 0; i < n; i++) {
    const e = editor[i]
    const p = preview[i]
    if (e && p) pairs.push({ editor: { top: e.top, height: e.height }, preview: { top: p.top, height: p.height } })
  }
  const last = pairs[pairs.length - 1]
  if (last) {
    let tailBottom = last.preview.top + last.preview.height
    for (let i = editor.length; i < preview.length; i++) {
      const p = preview[i]
      if (p) tailBottom = Math.max(tailBottom, p.top + p.height)
    }
    last.preview.height = tailBottom - last.preview.top
  }
  for (let i = 0; i < pairs.length - 1; i++) {
    const cur = pairs[i]!
    const next = pairs[i + 1]!
    cur.editor.height = Math.max(0, next.editor.top - cur.editor.top)
    cur.preview.height = Math.max(0, next.preview.top - cur.preview.top)
  }
  return pairs
}
