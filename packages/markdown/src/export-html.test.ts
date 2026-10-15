import { exportHtml, renderDiagrams } from '@geekx/markdown-core'
import { describe, expect, it, vi } from 'vitest'
import { drawDiagramsForExport } from './export-html'

vi.mock('@geekx/markdown-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@geekx/markdown-core')>()),
  renderDiagrams: vi.fn(() => Promise.resolve()),
}))

const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
const placeholder = (kind: 'mermaid' | 'flowchart', source: string) =>
  `<div class="ex-${kind}" data-ex-diagram="${b64(source)}"></div>`

/** 模拟 markdown-core：出错块写入错误文本、加 --error 类、标记已渲染主题 */
function failBlocks(container: HTMLElement, theme: string) {
  for (const block of container.querySelectorAll<HTMLElement>('[data-ex-diagram]')) {
    const kind = block.classList.contains('ex-mermaid') ? 'mermaid' : 'flowchart'
    block.innerHTML = `<pre class="ex-${kind}-error">diagram exploded</pre>`
    block.classList.add(`ex-${kind}--error`)
    block.dataset.exRenderedTheme = theme
  }
}

describe('drawDiagramsForExport', () => {
  it('成功绘制的图表保留 SVG', async () => {
    vi.mocked(renderDiagrams).mockImplementationOnce(async (container) => {
      container.querySelector<HTMLElement>('[data-ex-diagram]')!.innerHTML = '<svg id="ok"></svg>'
    })
    const html = await drawDiagramsForExport(placeholder('mermaid', 'graph TD'), 'light')
    expect(html).toContain('<svg id="ok"></svg>')
  })

  it('绘制失败的块还原为占位，exportHtml 输出源码代码块而非错误文本', async () => {
    vi.mocked(renderDiagrams).mockImplementationOnce(async (container, { theme }) => failBlocks(container, theme))
    const html = await drawDiagramsForExport(
      `<p>前</p>${placeholder('mermaid', 'graph TD\nA-->B')}${placeholder('flowchart', 'st=>start: 开始')}`,
      'dark',
    )
    expect(html).not.toContain('diagram exploded')
    const page = exportHtml({ html, sections: [], toc: [] }, { title: 't' })
    expect(page).toContain('<pre><code class="language-mermaid">graph TD\nA--&gt;B</code></pre>')
    expect(page).toContain('<pre><code class="language-flow">st=&gt;start: 开始</code></pre>')
    expect(page).not.toContain('diagram exploded')
  })

  it('预览中已处于出错状态的块同样还原', async () => {
    const container = document.createElement('div')
    container.innerHTML = placeholder('mermaid', 'graph LR')
    failBlocks(container, 'light')
    const html = await drawDiagramsForExport(container.innerHTML, 'light')
    expect(html).toBe(placeholder('mermaid', 'graph LR'))
  })

  it('超时后不再等待，未画完的块保持占位', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(renderDiagrams).mockImplementationOnce(() => new Promise<void>(() => {}))
    const html = await drawDiagramsForExport(placeholder('mermaid', 'graph TD'), 'light', 20)
    expect(html).toBe(placeholder('mermaid', 'graph TD'))
    expect(console.warn).toHaveBeenCalled()
  })

  it('renderDiagrams 拒绝时记录错误并返回占位', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(renderDiagrams).mockRejectedValueOnce(new Error('chunk'))
    const html = await drawDiagramsForExport(placeholder('mermaid', 'graph TD'), 'light')
    expect(html).toBe(placeholder('mermaid', 'graph TD'))
    expect(console.error).toHaveBeenCalled()
  })
})
