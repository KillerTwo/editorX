export interface TocHeading {
  level: number
  text: string
  id: string
}

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

export function extractHeadings(html: string): TocHeading[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const headings: TocHeading[] = []
  for (const el of doc.querySelectorAll(HEADING_SELECTOR)) {
    const text = (el.textContent ?? '').trim()
    if (!text) continue
    const index = headings.length + 1
    headings.push({
      level: Number(el.tagName.slice(1)),
      text,
      id: el.id || `ex-h-${index}`,
    })
  }
  return headings
}

/** 活文档里有同 id 的标题就用它，否则按非空 h1–h6 的顺序。不把生成的 id 写回编辑器。 */
export function findLiveHeading(content: ParentNode, id: string, index: number): HTMLElement | null {
  const headings = [...content.querySelectorAll(HEADING_SELECTOR)].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && (el.textContent ?? '').trim() !== '',
  )
  return headings.find((el) => el.id === id) ?? headings[index] ?? null
}

export function scrollHeadingIntoView(scroll: HTMLElement, id: string, index: number): void {
  const content = scroll.querySelector('.ck-content')
  if (!content) return
  const target = findLiveHeading(content, id, index)
  if (!target) return
  scroll.scrollTop += target.getBoundingClientRect().top - scroll.getBoundingClientRect().top
}
