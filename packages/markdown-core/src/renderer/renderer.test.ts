import MarkdownIt from 'markdown-it'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitSections } from '../sections'
import { createRenderer } from './renderer'

function dom(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRenderer — structure', () => {
  it('wraps every source section in an indexed ex-preview-section', () => {
    const md = '# A\n\ntext\n\n## B\n'
    const result = createRenderer().render(md)
    expect(result.html).toBe(
      '<div class="ex-preview-section" data-section-index="0"><h1 id="a">A</h1>\n<p>text</p>\n</div>' +
        '<div class="ex-preview-section" data-section-index="1"><h2 id="b">B</h2>\n</div>',
    )
    expect(result.sections.map(({ text, start, end }) => ({ text, start, end }))).toEqual(splitSections(md))
    expect(result.sections[1]!.html).toBe('<h2 id="b">B</h2>\n')
  })

  it('assigns document-unique slug ids and builds the toc', () => {
    const result = createRenderer().render('# Intro\n## Intro\n# 中文 标题\n### `code` **bold**')
    expect(result.toc).toEqual([
      { level: 1, text: 'Intro', id: 'intro' },
      { level: 2, text: 'Intro', id: 'intro-1' },
      { level: 1, text: '中文 标题', id: '中文-标题' },
      { level: 3, text: 'code bold', id: 'code-bold' },
    ])
    expect(result.html).toContain('<h2 id="intro-1">Intro</h2>')
  })

  it('replaces a [TOC] paragraph with a nested toc list', () => {
    const result = createRenderer().render('[TOC]\n\n# A\n## B\n# C')
    expect(result.sections[0]!.html).toBe(
      '<div class="ex-toc"><ul><li><a href="#a">A</a><ul><li><a href="#b">B</a></li></ul></li><li><a href="#c">C</a></li></ul></div>\n',
    )
  })

  it('supports @[TOC](title) with a title paragraph and @[TOC] without', () => {
    expect(createRenderer().render('@[TOC](自定义目录标题)\n\n# A').sections[0]!.html).toBe(
      '<div class="ex-toc"><p class="ex-toc-title">自定义目录标题</p><ul><li><a href="#a">A</a></li></ul></div>\n',
    )
    expect(createRenderer().render('@[toc]\n\n# A').sections[0]!.html).toBe(
      '<div class="ex-toc"><ul><li><a href="#a">A</a></li></ul></div>\n',
    )
    expect(createRenderer().render('@[TOC](<b>x</b>)\n\n# A').sections[0]!.html).toContain(
      '<p class="ex-toc-title">&lt;b&gt;x&lt;/b&gt;</p>',
    )
  })

  it('keeps [TOC] inside other text untouched', () => {
    expect(createRenderer().render('see [TOC] here').html).toContain('<p>see [TOC] here</p>')
  })

  it('updates a cached TOC section when a heading in another section changes', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    renderer.render('[TOC]\n\n# A\n# B')
    expect(spy).toHaveBeenCalledTimes(3)
    const result = renderer.render('[TOC]\n\n# A\n# B2')
    expect(spy).toHaveBeenCalledTimes(4)
    expect(result.sections[0]!.html).toContain('<a href="#b2">B2</a>')
    expect(result.sections[0]!.html).not.toContain('href="#b"')
  })
})

describe('createRenderer — footnotes', () => {
  it('numbers footnotes document-wide and lists them once at the end', () => {
    const md = '# A\nx[^a]\n# B\ny[^b] z[^a]\n\n[^a]: note A\n[^b]: note B'
    const result = createRenderer().render(md)
    expect(result.sections).toHaveLength(2)
    expect(result.html).not.toContain('ex-fn-ref')
    const el = dom(result.html)

    const refs = Array.from(el.querySelectorAll('sup.footnote-ref a'))
    expect(refs.map((a) => a.textContent)).toEqual(['[1]', '[2]', '[1]'])
    expect(refs.map((a) => a.getAttribute('href'))).toEqual(['#fn1', '#fn2', '#fn1'])
    expect(refs.map((a) => a.id)).toEqual(['fnref1', 'fnref2', 'fnref1:1'])

    expect(el.querySelectorAll('section.footnotes')).toHaveLength(1)
    const lastSection = el.querySelector('.ex-preview-section[data-section-index="1"]')!
    expect(lastSection.querySelector('.ex-footnotes section.footnotes')).not.toBeNull()
    const items = Array.from(el.querySelectorAll('li.footnote-item'))
    expect(items.map((li) => li.id)).toEqual(['fn1', 'fn2'])
    expect(items[0]!.textContent).toContain('note A')
    expect(items[1]!.textContent).toContain('note B')

    const backrefs = Array.from(items[0]!.querySelectorAll('a.footnote-backref')).map((a) => a.getAttribute('href'))
    expect(backrefs).toEqual(['#fnref1', '#fnref1:1'])
    for (const href of [...backrefs, ...refs.map((a) => a.getAttribute('href'))]) {
      expect(el.querySelector(`[id="${href!.slice(1)}"]`)).not.toBeNull()
    }
  })

  it('numbers by first reference, not by definition order', () => {
    const el = dom(createRenderer().render('p[^b]\n# H\nq[^a]\n\n[^a]: A\n[^b]: B').html)
    const items = Array.from(el.querySelectorAll('li.footnote-item'))
    expect(items.map((li) => li.textContent?.replace('↩︎', '').trim())).toEqual(['B', 'A'])
  })

  it('renumbers cached sections without re-rendering them', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    const tail = '# B\ny[^b]\n\n[^a]: A\n[^b]: B'
    renderer.render(`# A\nx[^a]\n${tail}`)
    expect(spy).toHaveBeenCalledTimes(4)
    const result = renderer.render(`# A\nw[^b] x[^a]\n${tail}`)
    expect(spy).toHaveBeenCalledTimes(5)
    const sectionB = dom(result.sections[1]!.html)
    expect(sectionB.querySelector('sup.footnote-ref a')?.textContent).toBe('[1]')
    expect(sectionB.querySelector('sup.footnote-ref a')?.id).toBe('fnref1:1')
  })

  it('resolves reference links inside footnote bodies', () => {
    const el = dom(createRenderer().render('see[^n]\n\n[^n]: go [home][h]\n# B\n[h]: https://h.com').html)
    expect(el.querySelector('li#fn1 a[href="https://h.com"]')?.textContent).toBe('home')
  })

  it('does not leak placeholders from headings, [TOC] or nested refs in footnote bodies', () => {
    const md = 'see[^n] and[^m]\n\n[^n]: body [^m] [^z]\n\n    # Inner\n\n    [TOC]\n\n[^m]: other\n[^z]: unused'
    const html = createRenderer().render(md).html
    expect(html).not.toContain('ex-heading-id-placeholder')
    expect(html).not.toContain('ex-fn-ref')
    expect(html).not.toContain('data-ex-toc')
    const fn1 = dom(html).querySelector('li#fn1')!
    expect(fn1.querySelector('h1')?.textContent).toBe('Inner')
    expect(fn1.querySelector('sup.footnote-ref a')?.getAttribute('href')).toBe('#fn2')
    expect(fn1.querySelector('sup.footnote-ref a')?.id).toBe('')
    expect(fn1.textContent).toContain('[^z]')
  })

  it('supports multi-line definitions and omits the list without references', () => {
    const el = dom(createRenderer().render('see[^n]\n\n[^n]: first\n    second').html)
    expect(el.querySelector('li#fn1')?.textContent).toContain('second')
    expect(createRenderer().render('text\n\n[^u]: unused').html).not.toContain('footnote')
  })
})

describe('createRenderer — markdown extensions', () => {
  const render = (md: string) => createRenderer().render(md).html

  it('renders GFM tables with alignment', () => {
    const html = render('| a | b |\n|:-|-:|\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th style="text-align:left">a</th>')
    expect(html).toContain('<td style="text-align:right">2</td>')
  })

  it('renders strikethrough, sub, sup and mark', () => {
    const html = render('~~del~~ H~2~O x^2^ ==hi==')
    expect(html).toContain('<s>del</s>')
    expect(html).toContain('<sub>2</sub>')
    expect(html).toContain('<sup>2</sup>')
    expect(html).toContain('<mark>hi</mark>')
  })

  it('renders task lists as disabled checkboxes', () => {
    const el = dom(render('- [ ] todo\n- [x] done\n- plain'))
    const items = el.querySelectorAll('ul.ex-task-list > li.ex-task-list-item')
    expect(items).toHaveLength(2)
    const boxes = el.querySelectorAll<HTMLInputElement>('input.ex-task-list-item-checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]!.checked).toBe(false)
    expect(boxes[1]!.checked).toBe(true)
    expect(boxes[0]!.disabled).toBe(true)
    expect(items[0]!.textContent?.trim()).toBe('todo')
  })

  it('resolves abbreviations', () => {
    expect(render('*[HTML]: Hyper Text\n\nHTML rocks')).toContain('<abbr title="Hyper Text">HTML</abbr>')
  })

  it('resolves reference-style links defined in another section', () => {
    const result = createRenderer().render('[x][ref] and [y][1]\n# B\n[ref]: https://e.com\n[1]: https://one.com "One"')
    expect(result.sections[0]!.html).toContain('<a href="https://e.com">x</a>')
    expect(result.sections[0]!.html).toContain('<a href="https://one.com" title="One">y</a>')
    expect(result.sections[1]!.html).not.toContain('https://e.com')
  })

  it('resolves abbreviations defined in another section', () => {
    const result = createRenderer().render('HTML rocks\n# B\n*[HTML]: Hyper Text')
    expect(result.sections[0]!.html).toContain('<abbr title="Hyper Text">HTML</abbr>')
  })

  it('does not leak definitions into an unclosed fenced code block', () => {
    const result = createRenderer().render('[x][r]\n\n[r]: https://a.com\n# B\n```js\ncode')
    expect(result.sections[0]!.html).toContain('<a href="https://a.com">x</a>')
    const code = dom(result.sections[1]!.html).querySelector('pre code')
    expect(code?.textContent).toBe('code')
  })

  it.each(['<!--\nopen', '<pre>\nopen'])('does not leak definitions into an unclosed html block: %s', (block) => {
    const md = `[x][r] y[^a] HTML\n\n[r]: https://a.com\n*[HTML]: Hyper\n[^a]: note\n# B\n${block}`
    const result = createRenderer().render(md)
    expect(result.sections[0]!.html).toContain('<a href="https://a.com">x</a>')
    expect(result.sections[0]!.html).toContain('<abbr title="Hyper">HTML</abbr>')
    const sectionB = result.sections[1]!.html.replace(/<div class="ex-footnotes">[\s\S]*$/, '')
    expect(sectionB).not.toContain('https://a.com')
    expect(sectionB).not.toContain('ex-footnote')
    expect(sectionB).not.toContain('Hyper')
  })

  it('renders :emoji: shortcodes and can disable them', () => {
    expect(render(':smile:')).toContain('😄')
    expect(createRenderer({ emoji: false }).render(':smile:').html).toContain(':smile:')
  })

  it('highlights fenced code with Prism and escapes unknown languages', () => {
    expect(render('```js\nconst a = 1\n```')).toContain(
      '<pre class="language-js"><code class="language-js"><span class="token keyword">const</span>',
    )
    expect(render('```nope\n<b>\n```')).toContain('<pre class="language-nope"><code class="language-nope">&lt;b&gt;\n</code></pre>')
    expect(render('```\nx\n```')).toContain('<pre><code>x\n</code></pre>')
  })

  it('puts Prism in manual mode so it never auto-highlights the host page', () => {
    expect((globalThis as { Prism?: { manual?: boolean } }).Prism?.manual).toBe(true)
  })
})

describe('createRenderer — sanitization', () => {
  const render = (md: string) => createRenderer().render(md).html

  function expectSafe(html: string) {
    const el = dom(html)
    expect(el.querySelector('script, iframe, style, object, embed')).toBeNull()
    for (const node of Array.from(el.querySelectorAll('*'))) {
      for (const attr of Array.from(node.attributes)) {
        expect(attr.name.startsWith('on')).toBe(false)
        if (attr.name === 'href' || attr.name === 'src') expect(attr.value).not.toMatch(/^\s*javascript:/i)
      }
    }
  }

  it.each([
    '<script>alert(1)</script>',
    '<img src="x" onerror="alert(1)">',
    '[a](javascript:alert(1))',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<style>body{display:none}</style>',
    '<div onclick="alert(1)">x</div>',
    '<svg><script>alert(1)</script></svg>',
  ])('strips dangerous markup: %s', (md) => {
    expectSafe(render(md))
  })

  it('keeps harmless inline html', () => {
    expect(render('<kbd>Ctrl</kbd> <span title="t">x</span>')).toContain('<kbd>Ctrl</kbd>')
  })
})

describe('createRenderer — incremental cache', () => {
  it('only re-renders sections whose source changed', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    const first = renderer.render('intro\n# A\naaa\n# B\nbbb')
    expect(spy).toHaveBeenCalledTimes(3)

    renderer.render('intro\n# A\naaa\n# B\nbbb')
    expect(spy).toHaveBeenCalledTimes(3)

    const second = renderer.render('intro\n# A\naaa\n# B\nbbb changed')
    expect(spy).toHaveBeenCalledTimes(4)
    expect(second.sections[1]!.html).toBe(first.sections[1]!.html)
  })

  it('invalidates every section when a shared definition changes', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    renderer.render('[x][r]\n# B\n[r]: https://a.com')
    expect(spy).toHaveBeenCalledTimes(2)
    const result = renderer.render('[x][r]\n# B\n[r]: https://b.com')
    expect(spy).toHaveBeenCalledTimes(4)
    expect(result.sections[0]!.html).toContain('https://b.com')
  })
})
