import { describe, expect, it } from 'vitest'
import { extractHeadings, findLiveHeading, scrollHeadingIntoView } from './headings'

describe('extractHeadings', () => {
  it('从标题生成目录，不要求 @[TOC]', () => {
    expect(extractHeadings('<p>@[TOC]</p><h2 id="a">安装</h2><h3>  </h3><h3>步骤</h3>')).toEqual([
      { level: 2, text: '安装', id: 'a' },
      { level: 3, text: '步骤', id: 'ex-h-2' },
    ])
  })

  it('活文档按 id 命中，否则按非空标题顺序', () => {
    const content = document.createElement('div')
    content.innerHTML = '<h2 id="a">安装</h2><h3>  </h3><h3>步骤</h3><p id="ex-h-2">@[TOC]</p>'
    expect(findLiveHeading(content, 'a', 0)?.textContent).toBe('安装')
    expect(findLiveHeading(content, 'ex-h-2', 1)?.textContent).toBe('步骤')
  })

  it('只改滚动容器的 scrollTop', () => {
    const scroll = document.createElement('div')
    const content = document.createElement('div')
    content.className = 'ck-content'
    content.innerHTML = '<h2 id="a">安装</h2><h3>  </h3><h3>步骤</h3>'
    scroll.appendChild(content)
    const step = content.querySelectorAll('h3')[1] as HTMLElement
    const rect = (top: number): DOMRect =>
      ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON() { return {} } }) as DOMRect
    step.getBoundingClientRect = () => rect(400)
    scroll.getBoundingClientRect = () => rect(100)
    let top = 0
    Object.defineProperty(scroll, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    scrollHeadingIntoView(scroll, 'ex-h-2', 1)
    expect(scroll.scrollTop).toBe(300)
  })
})
