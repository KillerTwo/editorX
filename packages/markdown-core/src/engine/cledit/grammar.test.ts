import { describe, expect, it } from 'vitest'
import { highlightMarkdown } from './grammar'

function render(md: string): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = highlightMarkdown(md)
  return div
}

const text = (root: ParentNode, selector: string) => [...root.querySelectorAll(selector)].map((n) => n.textContent)

const SAMPLES = [
  '# 标题\n\n正文 **粗体** *斜体* `code` $x^2$\n',
  '```js\nconst a = "<b>" && 1\n```\n',
  '```\n未闭合的代码块\n还在继续',
  '- [ ] 待办\n- [x] 完成\n1. 一\n2. 二\n',
  '> 引用 [链接](https://a.b)\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
  '<!-- 注释 --> <span>&amp;</span> ==高亮== ~~删除~~ ![图](u.png) https://csdn.net\n',
  '$$\n\\sum_{i=1}^n i\n$$\n',
  '标题\n===\n\n副标题\n---\n',
  '',
]

describe('highlightMarkdown', () => {
  it.each(SAMPLES)('textContent 与源文本逐字符一致：%j', (md) => {
    expect(render(md).textContent).toBe(md)
  })

  it('转义 HTML，不产生真实元素', () => {
    const div = render('<b>x</b> & <script>alert(1)</script>')
    expect(div.querySelector('b, script')).toBeNull()
    expect(text(div, '.ex-md-tag')).toEqual(['<b>', '</b>', '<script>', '</script>'])
  })

  it('ATX 标题：级别类 + heading 别名 + marker', () => {
    const div = render('## 二级标题 **粗**')
    const h = div.querySelector('.ex-md-h2.ex-md-heading')!
    expect(h.textContent).toBe('## 二级标题 **粗**')
    expect(h.querySelector('.ex-md-marker')!.textContent).toBe('##')
    expect(h.querySelector('.ex-md-strong')!.textContent).toBe('**粗**')
    expect(render('#没有空格').querySelector('.ex-md-heading')).toBeNull()
  })

  it('Setext 标题与分割线', () => {
    expect(render('标题\n===').querySelector('.ex-md-setext-h1.ex-md-heading')).not.toBeNull()
    expect(render('副标题\n---').querySelector('.ex-md-setext-h2.ex-md-heading')).not.toBeNull()
    expect(text(render('---'), '.ex-md-hr')).toEqual(['---'])
    expect(text(render('* * *'), '.ex-md-hr')).toEqual(['* * *'])
  })

  it('代码块内部不做行内高亮，未闭合时延续到段尾', () => {
    const closed = render('```js\nconst a = **b**\n```\nafter **x**')
    expect(text(closed, '.ex-md-fence')).toEqual(['```js\nconst a = **b**\n```'])
    expect(text(closed, '.ex-md-fence .ex-md-marker')).toEqual(['```js', '```'])
    expect(text(closed, '.ex-md-strong')).toEqual(['**x**'])
    const open = render('~~~\nline1\nline2')
    expect(text(open, '.ex-md-fence')).toEqual(['~~~\nline1\nline2'])
  })

  it('列表、任务、有序列表', () => {
    const div = render('- [x] 完成\n  * 子项\n12. 第十二')
    expect(text(div, '.ex-md-list')).toEqual(['- [x] 完成', '  * 子项', '12. 第十二'])
    expect(text(div, '.ex-md-list > .ex-md-marker')).toEqual(['-', '  *', '12.'])
    expect(text(div, '.ex-md-task')).toEqual(['[x]'])
  })

  it('引用与表格', () => {
    const div = render('> 引用 `c`\n| a | b |')
    expect(text(div, '.ex-md-blockquote > .ex-md-marker')).toEqual(['>'])
    expect(text(div, '.ex-md-blockquote .ex-md-code')).toEqual(['`c`'])
    expect(text(div, '.ex-md-table > .ex-md-marker')).toEqual(['|', '|', '|'])
  })

  it('行内 token', () => {
    const div = render('**b** *i* ~~s~~ `c` $x$ [l](u) ![p](q) ==m== <!-- n --> https://a.cn')
    expect(text(div, '.ex-md-strong')).toEqual(['**b**'])
    expect(text(div, '.ex-md-em')).toEqual(['*i*'])
    expect(text(div, '.ex-md-strike')).toEqual(['~~s~~'])
    expect(text(div, '.ex-md-code')).toEqual(['`c`'])
    expect(text(div, '.ex-md-math')).toEqual(['$x$'])
    expect(text(div, '.ex-md-link')).toEqual(['[l](u)'])
    expect(text(div, '.ex-md-image')).toEqual(['![p](q)'])
    expect(text(div, '.ex-md-mark')).toEqual(['==m=='])
    expect(text(div, '.ex-md-comment')).toEqual(['<!-- n -->'])
    expect(text(div, '.ex-md-url')).toEqual(['https://a.cn'])
  })

  it('公式块（多行与单行）', () => {
    expect(text(render('$$\na+b\n$$'), '.ex-md-math-block')).toEqual(['$$\na+b\n$$'])
    expect(text(render('$$a+b$$'), '.ex-md-math-block')).toEqual(['$$a+b$$'])
  })
})
