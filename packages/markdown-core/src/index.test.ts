import { describe, expect, it } from 'vitest'
import * as api from './index'

describe('@geekx/markdown-core public API', () => {
  it('exposes every phase 2a runtime export', () => {
    expect(Object.keys(api)).toEqual(
      expect.arrayContaining([
        'splitSections',
        'createRenderer',
        'isFlowchartJs',
        'renderDiagrams',
        'FLOWCHART_THEMES',
        'commands',
        'execCommand',
        'minimalDiff',
        'runCommand',
        'MERMAID_TEMPLATES',
        'countWords',
        'countHtml',
        'htmlToMarkdown',
        'exportHtml',
        'exportMarkdown',
        'importFile',
        'KATEX_CSS_HREF',
        'patchPreview',
      ]),
    )
  })

  it('renders, edits and converts through the public entry', () => {
    const result = api.createRenderer().render('# 标题\n\n**粗体**')
    expect(result.html).toContain('<h1 id="标题">标题</h1>')
    expect(api.commands.bold({ text: 'a', selection: { start: 0, end: 1 } }).text).toBe('**a**')
    expect(api.countWords('# 标题')).toEqual({ words: 2, chars: 3, lines: 1 })
    expect(api.countHtml(result.html)).toEqual({ words: 4, chars: 4, paragraphs: 2 })
    expect(api.isFlowchartJs('st=>start: 开始\ne=>end: 结束\nst->e')).toBe(true)
    expect(api.htmlToMarkdown(result.html)).toBe('# 标题\n\n**粗体**')
  })
})
