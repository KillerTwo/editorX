import { describe, expect, it } from 'vitest'
import { createRenderer } from '../renderer/renderer'
import { countHtml, countWords } from './count'
import { htmlToMarkdown } from './html-to-markdown'
import { exportHtml, exportMarkdown, importFile, KATEX_CSS_HREF } from './io'

describe('countHtml', () => {
  it.each([
    ['', { words: 0, paragraphs: 0 }],
    ['<h1>标题</h1><p>你好 world</p><p> </p><ul><li>a</li><li></li></ul>', { words: 6, paragraphs: 3 }],
    ['<p>abc</p><p>def</p>', { words: 2, paragraphs: 2 }],
    ['<blockquote><p>引用</p></blockquote><pre><code>x = 1</code></pre>', { words: 4, paragraphs: 3 }],
    ['<table><tr><td>1</td><td>2</td></tr><tr><td> </td></tr></table>', { words: 2, paragraphs: 1 }],
    ['<div>只有 div</div><script>var a</script><style>p{}</style>', { words: 3, paragraphs: 0 }],
  ])('counts %j', (html, expected) => {
    expect(countHtml(html)).toEqual(expected)
  })

  it('does not double-count KaTeX MathML text', () => {
    const html = createRenderer().render('$x$').html
    expect(countHtml(html)).toEqual({ words: 1, paragraphs: 1 })
  })

  it('counts a rendered document', () => {
    const html = createRenderer().render('# 标题\n\n第一段 text\n\n- 项一\n- 项二').html
    expect(countHtml(html)).toEqual({ words: 10, paragraphs: 4 })
  })

  it('ignores the TOC and footnote markers', () => {
    const doc = '# 标题\n\n## 小节\n\n正文 text[^a]\n\n[^a]: 注释'
    const without = countHtml(createRenderer().render(doc).html)
    expect(countHtml(createRenderer().render(`[TOC]\n\n${doc}`).html)).toEqual(without)
    expect(countHtml(createRenderer().render(`@[TOC](目录)\n\n${doc}`).html)).toEqual(without)
    expect(without).toEqual({ words: 9, paragraphs: 5 })
  })

  it('separates words only at block boundaries and line breaks', () => {
    expect(countHtml('<p>foo<em>bar</em></p>')).toEqual({ words: 1, paragraphs: 1 })
    expect(countHtml('<p>H<sub>2</sub>O</p>')).toEqual({ words: 1, paragraphs: 1 })
    expect(countHtml('<p>a<br>b</p><div>c</div><div>d</div>')).toEqual({ words: 4, paragraphs: 1 })
  })
})

describe('countWords', () => {
  it.each([
    ['', { words: 0, chars: 0, lines: 1 }],
    ['你好，世界！Hello world 2026', { words: 9, chars: 20, lines: 1 }],
    ['a\nb\n', { words: 2, chars: 2, lines: 3 }],
    ['中文abc中文', { words: 5, chars: 7, lines: 1 }],
    ["don't", { words: 2, chars: 5, lines: 1 }],
    ['😀', { words: 0, chars: 1, lines: 1 }],
    ['“引号”…', { words: 5, chars: 5, lines: 1 }],
    ['こんにちは 안녕', { words: 7, chars: 7, lines: 1 }],
    ['コーヒー・ティー', { words: 8, chars: 8, lines: 1 }],
    ['コーヒー', { words: 4, chars: 4, lines: 1 }],
    ['ＡＢＣ１２３', { words: 1, chars: 6, lines: 1 }],
    ['\t \n', { words: 0, chars: 0, lines: 2 }],
    ['# 标题\n\n**bold** text', { words: 4, chars: 15, lines: 3 }],
  ])('counts %j', (md, expected) => {
    expect(countWords(md)).toEqual(expected)
  })
})

describe('export / import', () => {
  it('exports markdown as a utf-8 markdown blob', async () => {
    const blob = exportMarkdown('# 标题')
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    expect(await blob.text()).toBe('# 标题')
  })

  it('exports a standalone html document', () => {
    const result = createRenderer().render('# A\n\n$x$')
    const html = exportHtml(result, { title: 'a <b>', css: 'p{color:red}</style><script>' })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>a &lt;b&gt;</title>')
    expect(html).toContain(`<article class="ex-preview">\n${result.html}\n</article>`)
    expect(html).toContain(`<link rel="stylesheet" href="${KATEX_CSS_HREF}">`)
    expect(html).toContain('<style>p{color:red}<\\/style><script></style>')
  })

  it('omits the KaTeX stylesheet when there is no math', () => {
    const html = exportHtml(createRenderer().render('plain'), { title: 't' })
    expect(html).not.toContain('katex')
  })

  it('imports markdown files verbatim', async () => {
    const file = new File(['# Hi\n'], 'note.md', { type: 'text/markdown' })
    expect(await importFile(file)).toBe('# Hi\n')
  })

  it('imports html files as markdown using only the body', async () => {
    const file = new File(
      ['<html><head><title>T</title></head><body><h1>Hi</h1><p><strong>b</strong></p></body></html>'],
      'page.html',
      { type: 'text/html' },
    )
    expect(await importFile(file)).toBe('# Hi\n\n**b**')
  })

  it('drops script, style and noscript content when importing html', async () => {
    const file = new File(
      ['<html><body><style>p{}</style><p>a</p><script>alert(1)</script><noscript>no js</noscript></body></html>'],
      'page.htm',
    )
    expect(await importFile(file)).toBe('a')
  })
})

describe('htmlToMarkdown', () => {
  it('converts basic formatting', () => {
    expect(htmlToMarkdown('<h2>T</h2><p>a <em>b</em> <s>c</s> <code>d</code></p>')).toBe('## T\n\na *b* ~~c~~ `d`')
  })

  it('converts lists with single-space markers and task items', () => {
    expect(htmlToMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b')
    expect(htmlToMarkdown('<ol><li>a</li><li>b</li></ol>')).toBe('1. a\n2. b')
    const md = htmlToMarkdown(createRenderer().render('- [ ] todo\n- [x] done').html)
    expect(md).toBe('- [ ] todo\n- [x] done')
  })

  it('round-trips fenced code with language', () => {
    const md = htmlToMarkdown(createRenderer().render('```js\nconst a = 1\n```').html)
    expect(md).toBe('```js\nconst a = 1\n```')
  })

  it('converts GFM tables', () => {
    const md = htmlToMarkdown(createRenderer().render('| a | b |\n|---|---|\n| 1 | 2 |').html)
    expect(md).toMatch(/^\|\s*a\s*\|\s*b\s*\|\n\|\s*-+\s*\|\s*-+\s*\|\n\|\s*1\s*\|\s*2\s*\|$/)
  })

  it('round-trips ex-embed cards through the renderer', () => {
    const renderer = createRenderer({ embeds: [{ type: 'card', renderHtml: () => '<a href="https://e.com">card</a>' }] })
    const source = '```ex-embed:card\n{"url":"https://e.com","title":"T"}\n```'
    expect(htmlToMarkdown(renderer.render(source).html)).toBe(source)
  })

  it('round-trips empty embeds and unrendered mermaid placeholders', () => {
    const renderer = createRenderer({ embeds: [{ type: 'card', renderHtml: () => '' }] })
    expect(htmlToMarkdown(renderer.render('```ex-embed:card\n{}\n```').html)).toBe('```ex-embed:card\n{}\n```')
    const mermaid = '```mermaid\ngraph TD\nA-->B\n```'
    expect(htmlToMarkdown(renderer.render(mermaid).html)).toBe(mermaid)
  })

  it('restores rendered mermaid diagrams from the source attribute', () => {
    const container = document.createElement('div')
    container.innerHTML = createRenderer().render('```mermaid\ngraph TD\nA-->B\n```').html
    container.querySelector('.ex-mermaid')!.innerHTML = '<svg><text>A</text></svg>'
    expect(htmlToMarkdown(container.innerHTML)).toBe('```mermaid\ngraph TD\nA-->B\n```')
  })

  it('round-trips KaTeX math and the [TOC] marker', () => {
    const md = htmlToMarkdown(createRenderer().render('[TOC]\n\n# A\n\n$x^2$ and\n\n$$\ny\n$$').html)
    expect(md).toBe('[TOC]\n\n# A\n\n$x^2$ and\n\n$$\ny\n$$')
  })

  it('round-trips @[TOC](title)', () => {
    const md = htmlToMarkdown(createRenderer().render('@[TOC](目录)\n\n# A').html)
    expect(md).toBe('@[TOC](目录)\n\n# A')
  })

  it('round-trips flowchart.js placeholders as flow fences', () => {
    const md = htmlToMarkdown(createRenderer().render('```flow\nst=>start: 开始\ne=>end\nst->e\n```').html)
    expect(md).toBe('```flow\nst=>start: 开始\ne=>end\nst->e\n```')
  })

  it('round-trips document-wide footnotes as definitions at the end', () => {
    const html = createRenderer().render('# A\nx[^a]\n# B\ny[^b]\n\n[^a]: note A\n[^b]: note B').html
    expect(htmlToMarkdown(html)).toBe('# A\n\nx[^1]\n\n# B\n\ny[^2]\n\n[^1]: note A\n[^2]: note B')
  })

  it('keeps an unknown-embed code block as a fence', () => {
    const md = htmlToMarkdown(createRenderer().render('```ex-embed:nope\n{"a":1}\n```').html)
    expect(md).toBe('```ex-embed:nope\n{"a":1}\n```')
  })

  it('drops script, style and noscript content', () => {
    expect(htmlToMarkdown('<p>a</p><script>alert(1)</script><style>p{}</style><noscript>x</noscript>')).toBe('a')
  })

  it('falls back to 1 for an invalid ordered-list start', () => {
    expect(htmlToMarkdown('<ol start="x"><li>a</li><li>b</li></ol>')).toBe('1. a\n2. b')
    expect(htmlToMarkdown('<ol start="3"><li>a</li></ol>')).toBe('3. a')
    expect(htmlToMarkdown('<ol start="0"><li>a</li></ol>')).toBe('0. a')
  })

  it('keeps a malformed base64 payload verbatim', () => {
    expect(htmlToMarkdown('<div class="ex-embed" data-ex-embed="card" data-ex-payload="not base64!"></div>')).toBe(
      '```ex-embed:card\nnot base64!\n```',
    )
  })
})
