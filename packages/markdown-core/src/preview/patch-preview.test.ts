import { beforeEach, describe, expect, it } from 'vitest'
import { patchPreview } from './patch-preview'

let container: HTMLElement
let previous: string[]

const sections = (...htmls: string[]) => htmls.map((html) => ({ html }))
const children = () => [...container.children] as HTMLElement[]
const snapshot = () =>
  children().map((el) => ({ cls: el.className, index: el.dataset.sectionIndex, html: el.innerHTML }))

function expectRendered(htmls: string[]) {
  expect(snapshot()).toEqual(htmls.map((html, i) => ({ cls: 'ex-preview-section', index: String(i), html })))
  expect(previous).toEqual(htmls)
}

beforeEach(() => {
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
  previous = []
})

describe('patchPreview', () => {
  it('首次渲染创建全部段，每段为容器直接子元素', () => {
    const { changed } = patchPreview(container, sections('<p>a</p>', '<p>b</p>'), previous)
    expectRendered(['<p>a</p>', '<p>b</p>'])
    expect(changed).toEqual(children())
  })

  it('无变化时不触碰任何元素', () => {
    patchPreview(container, sections('a', 'b', 'c'), previous)
    const before = children()
    const { changed } = patchPreview(container, sections('a', 'b', 'c'), previous)
    expect(changed).toEqual([])
    expect(children()).toEqual(before)
  })

  it('顶部插入：后续段复用原元素并改写下标', () => {
    patchPreview(container, sections('a', 'b', 'c'), previous)
    const [a, b, c] = children()
    const { changed } = patchPreview(container, sections('new', 'a', 'b', 'c'), previous)
    expectRendered(['new', 'a', 'b', 'c'])
    expect(children().slice(1)).toEqual([a, b, c])
    expect(changed).toEqual([children()[0]])
  })

  it('中间插入与末尾追加', () => {
    patchPreview(container, sections('a', 'b', 'c'), previous)
    const [a, b, c] = children()
    patchPreview(container, sections('a', 'x', 'b', 'c'), previous)
    expectRendered(['a', 'x', 'b', 'c'])
    expect([children()[0], children()[2], children()[3]]).toEqual([a, b, c])
    const { changed } = patchPreview(container, sections('a', 'x', 'b', 'c', 'z'), previous)
    expectRendered(['a', 'x', 'b', 'c', 'z'])
    expect(children()[4]).toBe(changed[0])
    expect(children()[3]).toBe(c)
  })

  it('删除段：前后段均保留', () => {
    patchPreview(container, sections('a', 'b', 'c', 'd'), previous)
    const [a, , c, d] = children()
    const { changed } = patchPreview(container, sections('a', 'c', 'd'), previous)
    expectRendered(['a', 'c', 'd'])
    expect(children()).toEqual([a, c, d])
    expect(changed).toEqual([])
  })

  it('替换中间段只重建该段', () => {
    patchPreview(container, sections('a', 'b', 'c'), previous)
    const [a, b, c] = children()
    const { changed } = patchPreview(container, sections('a', 'B', 'c'), previous)
    expectRendered(['a', 'B', 'c'])
    expect(children()[0]).toBe(a)
    expect(children()[2]).toBe(c)
    expect(children()[1]).not.toBe(b)
    expect(changed).toEqual([children()[1]])
  })

  it('相同内容的重复段：前缀与后缀不重叠', () => {
    patchPreview(container, sections('x', 'x', 'x'), previous)
    const before = children()
    patchPreview(container, sections('x', 'x', 'x', 'x'), previous)
    expectRendered(['x', 'x', 'x', 'x'])
    expect(children().slice(0, 3)).toEqual(before)
    patchPreview(container, sections('x', 'x'), previous)
    expectRendered(['x', 'x'])
    patchPreview(container, sections('x', 'y', 'x'), previous)
    expectRendered(['x', 'y', 'x'])
  })

  it('空文档清空容器', () => {
    patchPreview(container, sections('a', 'b'), previous)
    const { changed } = patchPreview(container, [], previous)
    expectRendered([])
    expect(changed).toEqual([])
    patchPreview(container, sections('c'), previous)
    expectRendered(['c'])
  })

  it('复用段内的后加内容（如已渲染的图表）保留', () => {
    patchPreview(container, sections('<div class="d"></div>', 'b'), previous)
    const diagram = container.querySelector('.d')!
    diagram.innerHTML = '<svg></svg>'
    const svg = diagram.firstChild!
    patchPreview(container, sections('# top', '<div class="d"></div>', 'b'), previous)
    expect(svg.isConnected).toBe(true)
    expect(children()[1]!.dataset.sectionIndex).toBe('1')
  })

  it('previous 与容器不一致（或被清空）时整体重建', () => {
    patchPreview(container, sections('a', 'b'), previous)
    const before = children()
    previous.length = 0
    patchPreview(container, sections('a', 'b'), previous)
    expectRendered(['a', 'b'])
    expect(children()[0]).not.toBe(before[0])
    container.appendChild(document.createElement('span'))
    patchPreview(container, sections('a', 'b'), previous)
    expectRendered(['a', 'b'])
  })
})
