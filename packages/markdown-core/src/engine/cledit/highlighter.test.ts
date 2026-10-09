import { afterEach, describe, expect, it } from 'vitest'
import { splitSections } from '../../sections'
import { Highlighter } from './highlighter'

function setup() {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return { root, hl: new Highlighter(root) }
}

afterEach(() => {
  document.body.innerHTML = ''
})

const DOC = '# 一\n\n第一段\n\n## 二\n\n第二段\n\n## 三\n\n第三段'

describe('Highlighter', () => {
  it('段数与 splitSections 一致，DOM 文本 = value + \\n，带 data-section-index', () => {
    const { root, hl } = setup()
    const changed = hl.update(DOC)
    const expected = splitSections(DOC)
    expect(root.children).toHaveLength(expected.length)
    expect(changed).toEqual(expected.map((_, i) => i))
    expect(root.textContent).toBe(DOC + '\n')
    ;[...root.children].forEach((el, i) => {
      expect(el.className).toBe('ex-editor-section')
      expect((el as HTMLElement).dataset.sectionIndex).toBe(String(i))
    })
    expect(hl.sections.map((s) => s.start)).toEqual(expected.map((s) => s.start))
  })

  it('只重建变化的段，其余元素复用', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const before = [...root.children]
    const changed = hl.update(DOC.replace('第二段', '第二段改'))
    const after = [...root.children]
    expect(changed).toEqual([1])
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(after[2]).toBe(before[2])
    expect(root.textContent).toBe(DOC.replace('第二段', '第二段改') + '\n')
  })

  it('中间插入新段：下标顺延，前后段复用', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const before = [...root.children]
    const next = DOC.replace('## 三', '## 新\n\n内容\n\n## 三')
    const changed = hl.update(next)
    const after = [...root.children] as HTMLElement[]
    expect(after).toHaveLength(4)
    expect(changed).toEqual([2])
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[3]).toBe(before[2])
    expect(after.map((el) => el.dataset.sectionIndex)).toEqual(['0', '1', '2', '3'])
  })

  it('浏览器改过的段与段外杂散节点会被修正', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const first = root.children[0]!
    first.appendChild(document.createTextNode('X'))
    root.appendChild(document.createTextNode('stray'))
    const changed = hl.update(DOC)
    expect(changed).toEqual([0])
    expect(root.children[0]).not.toBe(first)
    expect(root.textContent).toBe(DOC + '\n')
  })

  it('force 重建全部段；空文本也有一个段', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    expect(hl.update(DOC, true)).toEqual([0, 1, 2])
    hl.update('')
    expect(root.children).toHaveLength(1)
    expect(root.textContent).toBe('\n')
  })

  it('每个段元素至少含一个文本节点', () => {
    const { root, hl } = setup()
    const blank = new Highlighter(root, { highlight: () => '' })
    blank.update('')
    expect(root.children[0]!.firstChild?.nodeType).toBe(Node.TEXT_NODE)
    hl.update('')
    expect(root.children[0]!.firstChild?.nodeType).toBe(Node.TEXT_NODE)
  })

  it('SectionLocator：sectionAt 二分定位，段边界归后一段', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const starts = hl.sections.map((s) => s.start)
    expect(hl.sectionAt(0)!.el).toBe(root.children[0])
    expect(hl.sectionAt(starts[1]! - 1)!.el).toBe(root.children[0])
    expect(hl.sectionAt(starts[1]!)).toEqual({ el: root.children[1], start: starts[1] })
    expect(hl.sectionAt(DOC.length + 1)!.el).toBe(root.children[2])
    expect(hl.sectionStart(root.children[2]!)).toBe(starts[2])
    expect(hl.sectionStart(document.createElement('div'))).toBeUndefined()
  })
})
