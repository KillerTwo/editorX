// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/scrollSync.js
import { debounce } from '../engine/cledit/utils'
import type { EditorEngine } from '../types'
import { buildPairs, measurePreviewSections, syncScrollTop, type ScrollSide, type SectionPair } from './interpolate'

export interface ScrollSyncOptions {
  debounceMs?: number
  lockMs?: number
}

/**
 * Two-way scroll sync between the editor and the preview.
 *
 * `editorScrollEl` must be the element the engine was mounted on: it is the editor's scroll container and
 * `engine.getSectionOffsets()` is measured relative to it.
 *
 * Section sizes are cached and invalidated on `change`, container resizes and editor sections' `content-visibility`
 * state changes. Call `refresh()` after every
 * preview render and after late preview content growth (images loading, diagrams rendering), which a
 * container-level ResizeObserver cannot see.
 *
 * Neither pane may use `scroll-behavior: smooth`: animated writes outlive the source lock and can ping-pong.
 * The ResizeObserver's initial observation schedules an editor → preview sync right after mount, which
 * overrides any preview scroll position restored before that.
 */
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
  let writtenTop = 0
  let droppedDuringLock = false
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
    const range = { max: src.scrollHeight - src.clientHeight, viewport: src.clientHeight }
    const mapped = syncScrollTop(src.scrollTop, current, source, range, dst.scrollHeight - dst.clientHeight)
    if (!Number.isFinite(mapped)) return
    const next = Math.round(mapped)
    if (Math.abs(dst.scrollTop - next) < 1) return
    // The lock expires on its own: the browser may never fire a scroll event for the assignment.
    locked = target
    writtenTop = next
    droppedDuringLock = false
    clearTimeout(lockTimer)
    lockTimer = setTimeout(() => {
      lockTimer = undefined
      locked = null
      if (droppedDuringLock && Math.abs(dst.scrollTop - writtenTop) >= 1) {
        lastSource = target
        scheduleSync(target)
      }
      droppedDuringLock = false
    }, lockMs)
    dst.scrollTop = next
  }

  const scheduleSync = debounce(doSync, opts.debounceMs ?? 16)

  const onScroll = (side: ScrollSide) => () => {
    if (locked === side) {
      droppedDuringLock = true
      return
    }
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
  // Sections skipped by `content-visibility: auto` report estimated sizes until rendered; the event does not bubble.
  editorScrollEl.addEventListener('contentvisibilityautostatechange', invalidate, true)
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          invalidate()
          scheduleSync(lastSource)
        })
  resizeObserver?.observe(editorScrollEl)
  resizeObserver?.observe(previewEl)

  return {
    /** Re-measures both panes and re-aligns from the last scrolled side. Call after each preview render. */
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
      editorScrollEl.removeEventListener('contentvisibilityautostatechange', invalidate, true)
      resizeObserver?.disconnect()
      editorScrollEl.removeEventListener('scroll', onEditorScroll)
      previewEl.removeEventListener('scroll', onPreviewScroll)
    },
  }
}
