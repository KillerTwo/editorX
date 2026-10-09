import { afterEach, describe, expect, it, vi } from 'vitest'
import { findPosition, getTextOffset, SelectionManager, type SectionLocator } from './selection'

function build(html: string): HTMLElement {
  const root = document.createElement('div')
  root.tabIndex = 0
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

const HTML =
  '<div class="s"><span class="h"># </span><span>Title</span>\n</div>' +
  '<div class="s">body <b>bold</b>\n</div>'
// text: "# Title\n" (0-8) + "body bold\n" (8-18)

describe('findPosition / getTextOffset', () => {
  it('偏移落到正确的文本节点', () => {
    const root = build(HTML)
    const p = findPosition(root, 3)
    expect(p.node.textContent).toBe('Title')
    expect(p.offset).toBe(1)
    const q = findPosition(root, 14)
    expect(q.node.textContent).toBe('bold')
    expect(q.offset).toBe(1)
  })

  it('越界偏移夹到末尾；空 root 返回 (root, 0)', () => {
    const root = build(HTML)
    const end = findPosition(root, 999)
    expect(getTextOffset(root, end.node, end.offset)).toBe(18)
    const empty = build('')
    expect(findPosition(empty, 5)).toEqual({ node: empty, offset: 0 })
  })

  it('getTextOffset 与 findPosition 互逆', () => {
    const root = build(HTML)
    for (let i = 0; i <= 18; i++) {
      const p = findPosition(root, i)
      expect(getTextOffset(root, p.node, p.offset)).toBe(i)
    }
  })

  it('元素容器 + 子节点下标也能换算', () => {
    const root = build(HTML)
    const second = root.children[1]!
    expect(getTextOffset(root, second, 0)).toBe(8)
    expect(getTextOffset(root, root, 1)).toBe(8)
    expect(getTextOffset(root, root, 2)).toBe(18)
  })

  it('使用 SectionLocator 时结果一致且不遍历其他段', () => {
    const root = build(HTML)
    const els = [...root.children]
    const starts = [0, 8]
    const calls: number[] = []
    const locator: SectionLocator = {
      sectionAt(offset) {
        calls.push(offset)
        const i = offset >= 8 ? 1 : 0
        return { el: els[i]!, start: starts[i]! }
      },
      sectionStart(el) {
        const i = els.indexOf(el as Element)
        return i === -1 ? undefined : starts[i]
      },
    }
    const p = findPosition(root, 14, locator)
    expect(p.node.textContent).toBe('bold')
    expect(getTextOffset(root, p.node, p.offset, locator)).toBe(14)
    expect(calls).toEqual([14])
  })

  it('不把光标放进代理对中间（emoji）', () => {
    // "a😀b\n": 'a'=0, 😀=1..3 (two UTF-16 code units), 'b'=3
    const root = build('<div>a😀b\n</div>')
    const mid = findPosition(root, 2)
    expect(mid.offset).toBe(1)
    expect(getTextOffset(root, mid.node, mid.offset)).toBe(1)
    expect(findPosition(root, 3).offset).toBe(3)
    const text = root.firstChild!.firstChild!
    expect(getTextOffset(root, text, 2)).toBe(1)
  })
})

describe('SelectionManager', () => {
  it('set 在聚焦时写入原生选区，save 读回偏移', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(2, 7)
    const range = window.getSelection()!.getRangeAt(0)
    expect(range.toString()).toBe('Title')
    window.getSelection()!.removeAllRanges()
    const r = sm.createRange(8, 12)
    window.getSelection()!.addRange(r)
    expect(sm.save()).toEqual({ start: 8, end: 12 })
    expect(sm.get()).toEqual({ start: 8, end: 12 })
  })

  it('未聚焦时 set 只记录不写原生选区', () => {
    const root = build(HTML)
    const sm = new SelectionManager(root)
    sm.set(-3, 4)
    expect(sm.get()).toEqual({ start: 0, end: 4 })
    expect(window.getSelection()!.rangeCount).toBe(0)
  })

  it('选区在 root 外时 save 返回 null 且保留旧值', () => {
    const root = build(HTML)
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)
    const sm = new SelectionManager(root)
    sm.set(1, 1)
    const r = document.createRange()
    r.selectNodeContents(outside)
    window.getSelection()!.addRange(r)
    expect(sm.save()).toBeNull()
    expect(sm.get()).toEqual({ start: 1, end: 1 })
  })

  it('反向选区：restore 后 save 仍保持方向', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(12, 8)
    expect(sm.save()).toEqual({ start: 12, end: 8 })
  })

  it('DOM 被整体替换后 restore 仍按偏移定位', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(3, 3)
    root.innerHTML = '<div># Title\n</div><div>body bold\n</div>'
    sm.restore()
    const sel = window.getSelection()!
    expect(sel.anchorNode!.textContent).toBe('# Title\n')
    expect(sel.anchorOffset).toBe(3)
  })

  it('原生选区已等于目标（含方向）时 restore 不改写，否则照常写入', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(3, 3)
    const sel = window.getSelection()!
    const remove = vi.spyOn(sel, 'removeAllRanges')
    const add = vi.spyOn(sel, 'addRange')
    sm.restore()
    sm.set(3, 3)
    expect(remove).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()

    sm.set(12, 8)
    expect(add).toHaveBeenCalledTimes(1)
    expect(sm.save()).toEqual({ start: 12, end: 8 })
    sm.restore()
    expect(add).toHaveBeenCalledTimes(1)

    sm.set(8, 12)
    expect(add).toHaveBeenCalledTimes(2)
    expect(sm.save()).toEqual({ start: 8, end: 12 })

    root.innerHTML = '<div># Title\n</div><div>body bold\n</div>'
    sm.restore()
    expect(add).toHaveBeenCalledTimes(3)
    expect(sm.save()).toEqual({ start: 8, end: 12 })
  })

  it('选区端点落在 emoji 中间时 save 吸附到码点边界', () => {
    const root = build('<div>a😀b\n</div>')
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(0, 2)
    expect(window.getSelection()!.toString()).toBe('a')
    expect(sm.save()).toEqual({ start: 0, end: 1 })
  })
})
