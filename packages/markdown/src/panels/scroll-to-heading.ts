import type { EditorEngine } from '@editorx/markdown-core'
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
  const target = Array.from(previewEl.querySelectorAll<HTMLElement>('[id]')).find((el) => el.id === id)
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
