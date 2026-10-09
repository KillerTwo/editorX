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

const finite = (n: number) => (Number.isFinite(n) ? n : 0)

export function mapScrollTop(scrollTop: number, pairs: SectionPair[], from: ScrollSide): number {
  if (pairs.length === 0) return scrollTop
  const to: ScrollSide = from === 'editor' ? 'preview' : 'editor'
  const pos = finite(scrollTop)
  for (const pair of pairs) {
    const src = pair[from]
    const top = finite(src.top)
    const height = Math.max(0, finite(src.height))
    if (pos > top + height) continue
    const ratio = Math.max(0, (pos - top) / (height || 1))
    return finite(pair[to].top) + Math.max(0, finite(pair[to].height)) * ratio
  }
  const last = pairs[pairs.length - 1]![to]
  return finite(last.top) + Math.max(0, finite(last.height))
}

/** Offsets are relative to the top of `previewEl`'s scroll content, indexed by `data-section-index`. */
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
 * Pairs editor and preview sections by index. Preview sections with index >= editor.length are not
 * paired; the last pair's preview height is extended to cover them so both sides reach the bottom together.
 * (2a renders footnotes inside the last preview section, so they are already part of its height.)
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
  return pairs
}
