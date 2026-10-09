// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/scrollSync.js
import { debounce } from '../engine/cledit/utils'
import type { EditorEngine } from '../types'
import { buildPairs, mapScrollTop, measurePreviewSections, type ScrollSide, type SectionPair } from './interpolate'

export interface ScrollSyncOptions {
  debounceMs?: number
  lockMs?: number
}

export function createScrollSync(
  engine: EditorEngine,
  editorScrollEl: HTMLElement,
  previewEl: HTMLElement,
  opts: ScrollSyncOptions = {},
): { destroy(): void; refresh(): void } {
  const lockMs = opts.lockMs ?? 100
  let pairs: SectionPair[] | null = null
  let lastSource: ScrollSide = 'editor'
  let locked: ScrollSide | null = null
  let lockTimer: ReturnType<typeof setTimeout> | undefined
  let destroyed = false

  const elementOf = (side: ScrollSide) => (side === 'editor' ? editorScrollEl : previewEl)
  const other = (side: ScrollSide): ScrollSide => (side === 'editor' ? 'preview' : 'editor')

  const measure = (): SectionPair[] => {
    pairs = buildPairs(engine.getSectionOffsets(), measurePreviewSections(previewEl))
    return pairs
  }

  const doSync = (source: ScrollSide) => {
    if (destroyed) return
    const current = pairs ?? measure()
    if (current.length === 0) return
    const src = elementOf(source)
    const target = other(source)
    const dst = elementOf(target)
    const mapped = mapScrollTop(src.scrollTop, current, source)
    if (!Number.isFinite(mapped)) return
    const max = Math.max(0, dst.scrollHeight - dst.clientHeight)
    const next = Math.round(Math.min(Math.max(0, mapped), max))
    if (Math.abs(dst.scrollTop - next) < 1) return
    // The lock expires on its own: the browser may never fire a scroll event for the assignment.
    locked = target
    clearTimeout(lockTimer)
    lockTimer = setTimeout(() => {
      locked = null
      lockTimer = undefined
    }, lockMs)
    dst.scrollTop = next
  }

  const scheduleSync = debounce(doSync, opts.debounceMs ?? 16)

  const onScroll = (side: ScrollSide) => () => {
    if (locked === side) return
    lastSource = side
    scheduleSync(side)
  }
  const onEditorScroll = onScroll('editor')
  const onPreviewScroll = onScroll('preview')
  editorScrollEl.addEventListener('scroll', onEditorScroll, { passive: true })
  previewEl.addEventListener('scroll', onPreviewScroll, { passive: true })

  const invalidate = () => {
    pairs = null
  }
  const offChange = engine.on('change', invalidate)
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate)
  resizeObserver?.observe(editorScrollEl)
  resizeObserver?.observe(previewEl)

  return {
    refresh() {
      if (destroyed) return
      scheduleSync.cancel()
      measure()
      doSync(lastSource)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      scheduleSync.cancel()
      clearTimeout(lockTimer)
      lockTimer = undefined
      locked = null
      pairs = null
      offChange()
      resizeObserver?.disconnect()
      editorScrollEl.removeEventListener('scroll', onEditorScroll)
      previewEl.removeEventListener('scroll', onPreviewScroll)
    },
  }
}
