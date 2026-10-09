// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditHighlighter.js
import { splitSections } from '../../sections'
import type { SourceSection } from '../../types'
import { highlightMarkdown } from './grammar'
import type { SectionLocator } from './selection'

export interface HighlightedSection extends SourceSection {
  el: HTMLDivElement
}

export interface HighlighterOptions {
  highlight?: (text: string) => string
  /** Line height in px for the `contain-intrinsic-size` estimate of sections skipped by `content-visibility: auto`. */
  lineHeight?: number
}

export const DEFAULT_LINE_HEIGHT = 25

function countLines(text: string): number {
  let n = 0
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++
  return Math.max(1, n)
}

export class Highlighter implements SectionLocator {
  private list: HighlightedSection[] = []
  private starts = new WeakMap<Node, number>()
  private readonly highlight: (text: string) => string
  private readonly lineHeight: number

  constructor(
    private readonly root: HTMLElement,
    opts: HighlighterOptions = {},
  ) {
    this.highlight = opts.highlight ?? highlightMarkdown
    this.lineHeight = opts.lineHeight ?? DEFAULT_LINE_HEIGHT
  }

  get sections(): readonly HighlightedSection[] {
    return this.list
  }

  /**
   * `touched` lists the section elements whose DOM may differ from their last highlighted text; the others are
   * trusted without reading their `textContent`. Omit it to verify every reused section.
   */
  update(value: string, force = false, touched?: ReadonlySet<Node>): number[] {
    const doc = this.root.ownerDocument
    const split = splitSections(value)
    const source = split.length > 0 ? split : [{ text: '', start: 0, end: 0 }]
    const next: SourceSection[] = source.map((s, i) =>
      i === source.length - 1 ? { text: `${s.text}\n`, start: s.start, end: s.end + 1 } : { ...s },
    )
    const old = this.list
    const reusable = (o: HighlightedSection, n: SourceSection) =>
      !force &&
      o.text === n.text &&
      o.el.parentNode === this.root &&
      ((touched !== undefined && !touched.has(o.el)) || o.el.textContent === n.text)

    let left = 0
    while (left < old.length && left < next.length && reusable(old[left]!, next[left]!)) left++
    let right = 0
    while (
      right < old.length - left &&
      right < next.length - left &&
      reusable(old[old.length - 1 - right]!, next[next.length - 1 - right]!)
    ) {
      right++
    }

    const result: HighlightedSection[] = []
    const changed: number[] = []
    const fragment = doc.createDocumentFragment()
    for (let i = 0; i < left; i++) result.push({ ...next[i]!, el: old[i]!.el })
    for (let i = left; i < next.length - right; i++) {
      const el = doc.createElement('div')
      el.className = 'ex-editor-section'
      // `auto` makes the browser keep the real size once the section has been rendered.
      el.style.setProperty('contain-intrinsic-size', `auto ${countLines(next[i]!.text) * this.lineHeight}px`)
      el.innerHTML = this.highlight(next[i]!.text)
      // The selection manager needs a text node to place a caret in.
      if (!el.firstChild) el.appendChild(doc.createTextNode(''))
      fragment.appendChild(el)
      result.push({ ...next[i]!, el })
      changed.push(i)
    }
    for (let i = next.length - right; i < next.length; i++) {
      result.push({ ...next[i]!, el: old[old.length - (next.length - i)]!.el })
    }

    for (let i = left; i < old.length - right; i++) old[i]!.el.remove()
    const anchor = right > 0 ? old[old.length - right]!.el : null
    this.root.insertBefore(fragment, anchor)

    const keep = new Set<Node>(result.map((s) => s.el))
    for (let child = this.root.firstChild; child; ) {
      const following = child.nextSibling
      if (!keep.has(child)) child.parentNode!.removeChild(child)
      child = following
    }

    this.starts = new WeakMap()
    result.forEach((s, i) => {
      this.starts.set(s.el, s.start)
      if (s.el.dataset.sectionIndex !== String(i)) s.el.dataset.sectionIndex = String(i)
    })
    this.list = result
    return changed
  }

  sectionAt(offset: number): { el: Node; start: number } | undefined {
    if (this.list.length === 0) return undefined
    let lo = 0
    let hi = this.list.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.list[mid]!.start <= offset) lo = mid
      else hi = mid - 1
    }
    const s = this.list[lo]!
    return { el: s.el, start: s.start }
  }

  sectionStart(el: Node): number | undefined {
    return this.starts.get(el)
  }
}
