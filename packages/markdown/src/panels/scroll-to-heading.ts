import type { EditorEngine } from '@geekx/markdown-core'
import type { ViewMode } from '../types'

export interface ScrollToHeadingTarget {
  id: string
  viewMode: ViewMode
  engine: Pick<EditorEngine, 'getSectionOffsets'>
  editorHost: HTMLElement | null
  previewEl: HTMLElement | null
  previewScroller: HTMLElement | null
}

/**
 * 预览可见时滚动预览区（比对模式由同步滚动带动编辑区）；
 * Markdown 模式预览隐藏但仍渲染，按标题所在段的序号滚动编辑区。
 */
export function scrollToHeading({ id, viewMode, engine, editorHost, previewEl, previewScroller }: ScrollToHeadingTarget): boolean {
  if (!previewEl) return false
  const target = Array.from(previewEl.querySelectorAll<HTMLElement>(':is(h1,h2,h3,h4,h5,h6)[id]')).find((el) => el.id === id)
  if (!target) return false
  if (viewMode !== 'edit') {
    if (!previewScroller) return false
    previewScroller.scrollTop += target.getBoundingClientRect().top - previewScroller.getBoundingClientRect().top
    return true
  }
  const section = target.closest<HTMLElement>('.ex-preview-section')
  const offset = engine.getSectionOffsets()[Number(section?.dataset.sectionIndex ?? -1)]
  if (!editorHost || !offset) return false
  editorHost.scrollTop = offset.top
  return true
}

/** 跳转后继续对齐的时长：覆盖图表首次加载与渲染 */
export const REALIGN_WINDOW = 5000
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

export interface HeadingJumper {
  jump(id: string): boolean
  cancel(): void
}

/**
 * 跳转后图表、图片与离屏段落的真实高度会陆续到位，目标随之移位：在 {@link REALIGN_WINDOW} 内每次内容尺寸变化都重新对齐，
 * 用户滚动、点击或按键、再次跳转、切换视图时停止。
 */
export function createHeadingJumper(getTarget: () => Omit<ScrollToHeadingTarget, 'id'>): HeadingJumper {
  let stop = () => {}

  const jump = (id: string): boolean => {
    stop()
    const first = getTarget()
    if (!scrollToHeading({ id, ...first })) return false
    const observed =
      first.viewMode === 'edit' ? (first.editorHost?.querySelector<HTMLElement>('.ex-editor-content') ?? first.editorHost) : first.previewEl
    const doc = observed?.ownerDocument
    const win = doc?.defaultView
    if (!observed || !doc || !win || typeof win.ResizeObserver !== 'function') return true

    const onInput = () => stop()
    const observer = new win.ResizeObserver(() => {
      const current = getTarget()
      if (current.viewMode !== first.viewMode) stop()
      else scrollToHeading({ id, ...current })
    })
    const timer = win.setTimeout(onInput, REALIGN_WINDOW)
    for (const type of USER_INPUT) doc.addEventListener(type, onInput, { capture: true, passive: true })
    observer.observe(observed)
    stop = () => {
      stop = () => {}
      observer.disconnect()
      win.clearTimeout(timer)
      for (const type of USER_INPUT) doc.removeEventListener(type, onInput, { capture: true })
    }
    return true
  }

  return { jump, cancel: () => stop() }
}
