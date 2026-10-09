import { describe, expect, it, vi } from 'vitest'
import type { EmbedDef } from '../types'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'
import { isFlowchartJs } from './fences'
import { createRenderer } from './renderer'

function dom(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('math', () => {
  const render = (md: string) => createRenderer().render(md).html

  it('renders inline $..$ with KaTeX including MathML', () => {
    const html = render('a $x^2$ b')
    expect(html).toContain('class="katex"')
    expect(html).toContain('<math')
    expect(html).not.toContain('katex-display')
  })

  it('renders $$ blocks in display mode', () => {
    expect(render('$$\n\\sum_{i=1}^n i\n$$')).toContain('<div class="ex-math-block"><span class="katex-display">')
    expect(render('$$E=mc^2$$')).toContain('katex-display')
  })

  it('does not render math inside code', () => {
    expect(render('`$x$`')).toContain('<code>$x$</code>')
    expect(render('```\n$x$\n$$\ny\n$$\n```')).not.toContain('katex')
  })

  it('ignores currency-like and space-padded dollars', () => {
    expect(render('costs $5 and $6')).not.toContain('katex')
    expect(render('a $ x$ b')).not.toContain('katex')
    expect(render('\\$x$')).not.toContain('katex')
  })

  it('shows KaTeX errors inline instead of throwing', () => {
    expect(render('$\\frac{$')).toContain('katex-error')
  })

  it('can be disabled', () => {
    expect(createRenderer({ math: false }).render('$x$').html).toContain('<p>$x$</p>')
  })
})

describe('base64 helpers', () => {
  it('round-trips unicode text', () => {
    const text = 'graph TD\nA["中文 😄"]-->B\n'
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text)
  })
})

describe('mermaid placeholders', () => {
  it('emits an ex-mermaid placeholder carrying the base64 source (survives DOMPurify with -->)', () => {
    const el = dom(createRenderer().render('```mermaid\ngraph TD\nA-->B\n```').html)
    const block = el.querySelector('.ex-mermaid')
    expect(block).not.toBeNull()
    expect(decodeBase64Utf8(block!.getAttribute('data-ex-diagram')!)).toBe('graph TD\nA-->B\n')
    expect(block!.innerHTML).toBe('')
  })

  it('falls back to a code block when diagrams are disabled', () => {
    const html = createRenderer({ diagrams: false }).render('```mermaid\ngraph TD\n```').html
    expect(html).toContain('<pre class="language-mermaid">')
    expect(html).not.toContain('ex-mermaid')
  })
})

describe('flowchart.js placeholders', () => {
  const FLOW = 'st=>start: 开始\ne=>end: 结束\nst->e\n'

  it.each([
    [`flowchart\n${FLOW}`, true],
    [`\n  flowchart  \n${FLOW}`, true],
    [FLOW, true],
    ['cond=>condition: 是否?\ncond(yes)->e', true],
    ['flowchart TD\nA-->B', false],
    ['flowchart LR\nA[开始] --> B', false],
    ['graph LR\nA-->B', false],
    ['sequenceDiagram\nA->>B: hi', false],
    ['flowchart\nA-->B', false],
    ['', false],
  ])('isFlowchartJs(%j) === %s', (src, expected) => {
    expect(isFlowchartJs(src)).toBe(expected)
  })

  function flowchartSource(md: string, options?: Parameters<typeof createRenderer>[0]): string | null {
    const el = dom(createRenderer(options).render(md).html)
    const block = el.querySelector('.ex-flowchart')
    return block ? decodeBase64Utf8(block.getAttribute('data-ex-diagram')!) : null
  }

  it('turns mermaid fences written in flowchart.js syntax into ex-flowchart (header stripped)', () => {
    expect(flowchartSource(`\`\`\`mermaid\nflowchart\n${FLOW}\`\`\``)).toBe(FLOW)
  })

  it.each(['flow', 'flowchart'])('renders ```%s fences as ex-flowchart', (lang) => {
    const md = `\`\`\`${lang}\n${FLOW}\`\`\``
    expect(flowchartSource(md)).toBe(FLOW)
    expect(createRenderer().render(md).html).not.toContain('ex-mermaid')
  })

  it('keeps ordinary mermaid flowcharts as mermaid', () => {
    const html = createRenderer().render('```mermaid\nflowchart TD\nA-->B\n```').html
    expect(html).toContain('class="ex-mermaid"')
    expect(html).not.toContain('ex-flowchart')
  })

  it('falls back to a code block when diagrams are disabled', () => {
    const html = createRenderer({ diagrams: false }).render(`\`\`\`flow\n${FLOW}\`\`\``).html
    expect(html).toContain('<pre class="language-flow">')
    expect(html).not.toContain('ex-flowchart')
  })
})

describe('ex-embed fences', () => {
  const card: EmbedDef = {
    type: 'card',
    renderHtml: (payload) => {
      const { url, title } = payload as { url: string; title: string }
      return `<a class="ex-card" href="${url}">${title}</a><script>bad()</script>`
    },
  }

  it('renders registered embeds through renderHtml and keeps the payload', () => {
    const md = '```ex-embed:card\n{"url":"https://e.com","title":"T"}\n```'
    const el = dom(createRenderer({ embeds: [card] }).render(md).html)
    const embed = el.querySelector<HTMLElement>('.ex-embed')!
    expect(embed.dataset.exEmbed).toBe('card')
    expect(JSON.parse(decodeBase64Utf8(embed.dataset.exPayload!))).toEqual({ url: 'https://e.com', title: 'T' })
    expect(embed.querySelector('a.ex-card')?.getAttribute('href')).toBe('https://e.com')
    expect(el.querySelector('script')).toBeNull()
  })

  it('sanitizes dangerous embed output', () => {
    const md = '```ex-embed:card\n{"url":"javascript:alert(1)","title":"T"}\n```'
    const el = dom(createRenderer({ embeds: [card] }).render(md).html)
    expect(el.querySelector('a.ex-card')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
  })

  it.each([
    ['unknown type', '```ex-embed:nope\n{"a":1}\n```', '{"a":1}\n'],
    ['invalid JSON', '```ex-embed:card\n{oops\n```', '{oops\n'],
  ])('falls back to an escaped code block for %s', (_name, md, code) => {
    const el = dom(createRenderer({ embeds: [card] }).render(md).html)
    expect(el.querySelector('.ex-embed')).toBeNull()
    expect(el.querySelector('pre code')?.textContent).toBe(code)
  })

  it('falls back to a code block when renderHtml throws', () => {
    const broken: EmbedDef = {
      type: 'card',
      renderHtml: () => {
        throw new Error('boom')
      },
    }
    const el = dom(createRenderer({ embeds: [broken] }).render('```ex-embed:card\n{}\n```').html)
    expect(el.querySelector('.ex-embed')).toBeNull()
    expect(el.querySelector('pre code')?.textContent).toBe('{}\n')
  })

  it('reuses cached sections instead of calling renderHtml again', () => {
    const renderHtml = vi.fn(() => '<b>card</b>')
    const renderer = createRenderer({ embeds: [{ type: 'card', renderHtml }] })
    const md = '# A\n```ex-embed:card\n{}\n```\n# B\n```ex-embed:card\n{}\n```\n'
    renderer.render(md)
    expect(renderHtml).toHaveBeenCalledTimes(2)
    renderer.render(md)
    expect(renderHtml).toHaveBeenCalledTimes(2)
    renderer.render(`${md}tail`)
    expect(renderHtml).toHaveBeenCalledTimes(3)
  })
})
