// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditSelectionMgr.js
import type { Selection } from '../../types'

export interface DomPosition {
  node: Node
  offset: number
}

export interface SectionLocator {
  sectionAt(offset: number): { el: Node; start: number } | undefined
  sectionStart(el: Node): number | undefined
}

function topLevelChild(root: Node, node: Node): Node | undefined {
  let current: Node | null = node
  while (current && current.parentNode !== root) current = current.parentNode
  return current ?? undefined
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

// Carets must never sit between the two code units of a surrogate pair.
function snapToCodePoint(text: Text, offset: number): number {
  const data = text.data
  if (offset > 0 && offset < data.length && isHighSurrogate(data.charCodeAt(offset - 1)) && isLowSurrogate(data.charCodeAt(offset))) {
    return offset - 1
  }
  return offset
}

function positionIn(container: Node, offset: number): DomPosition | undefined {
  const walker = container.ownerDocument!.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let last: Text | undefined
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text
    if (remaining <= text.length) return { node: text, offset: snapToCodePoint(text, remaining) }
    remaining -= text.length
    last = text
  }
  return last ? { node: last, offset: last.length } : undefined
}

export function findPosition(root: Node, offset: number, locator?: SectionLocator): DomPosition {
  const target = Math.max(0, offset)
  const section = locator?.sectionAt(target)
  if (section) {
    const pos = positionIn(section.el, target - section.start)
    if (pos) return pos
  }
  return positionIn(root, target) ?? { node: root, offset: 0 }
}

export function getTextOffset(root: Node, node: Node, nodeOffset: number, locator?: SectionLocator): number {
  const doc = root.ownerDocument!
  if (node === root) {
    let total = 0
    for (let i = 0; i < nodeOffset && i < root.childNodes.length; i++) total += root.childNodes[i]!.textContent!.length
    return total
  }
  const top = topLevelChild(root, node)
  if (!top) return 0
  const offset = node.nodeType === Node.TEXT_NODE ? snapToCodePoint(node as Text, nodeOffset) : nodeOffset
  let base = locator?.sectionStart(top)
  if (base === undefined) {
    base = 0
    for (let s = top.previousSibling; s; s = s.previousSibling) base += s.textContent!.length
  }
  const range = doc.createRange()
  range.setStart(top, 0)
  range.setEnd(node, offset)
  return base + range.toString().length
}

export class SelectionManager {
  private start = 0
  private end = 0

  constructor(
    private readonly root: HTMLElement,
    private readonly locator?: SectionLocator,
  ) {}

  get(): Selection {
    return { start: this.start, end: this.end }
  }

  hasFocus(): boolean {
    return this.root.ownerDocument.activeElement === this.root
  }

  createRange(start: number, end: number): Range {
    const range = this.root.ownerDocument.createRange()
    const a = findPosition(this.root, Math.min(start, end), this.locator)
    const b = start === end ? a : findPosition(this.root, Math.max(start, end), this.locator)
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
    return range
  }

  set(start: number, end: number): void {
    this.start = Math.max(0, start)
    this.end = Math.max(0, end)
    if (this.hasFocus()) this.restore()
  }

  save(): Selection | null {
    const sel = this.root.ownerDocument.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null
    if (!this.root.contains(sel.anchorNode) || !this.root.contains(sel.focusNode)) return null
    this.start = getTextOffset(this.root, sel.anchorNode, sel.anchorOffset, this.locator)
    this.end = getTextOffset(this.root, sel.focusNode, sel.focusOffset, this.locator)
    return this.get()
  }

  /** Skips the write when the native selection already matches: `addRange` forces a synchronous layout. */
  restore(): void {
    const sel = this.root.ownerDocument.getSelection()
    if (!sel) return
    const anchor = findPosition(this.root, this.start, this.locator)
    const focus = this.start === this.end ? anchor : findPosition(this.root, this.end, this.locator)
    if (
      sel.rangeCount === 1 &&
      sel.anchorNode === anchor.node &&
      sel.anchorOffset === anchor.offset &&
      sel.focusNode === focus.node &&
      sel.focusOffset === focus.offset
    ) {
      return
    }
    const range = this.createRange(this.start, this.end)
    sel.removeAllRanges()
    if (this.start > this.end) {
      const anchor = range.cloneRange()
      anchor.collapse(false)
      sel.addRange(anchor)
      sel.extend(range.startContainer, range.startOffset)
    } else {
      sel.addRange(range)
    }
  }
}
