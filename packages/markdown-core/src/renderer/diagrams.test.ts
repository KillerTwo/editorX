import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOWCHART_THEMES, renderDiagrams } from './diagrams'
import { renderFlowchartPlaceholder, renderMermaidPlaceholder } from './fences'
import { sanitizeMermaidSvg } from './sanitize'

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

const flowchartMock = vi.hoisted(() => ({
  parse: vi.fn(),
}))

vi.mock('mermaid', () => ({ default: mermaidMock }))
vi.mock('flowchart.js', () => ({ default: flowchartMock }))

function mount(...sources: string[]): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = sources.map((source) => renderMermaidPlaceholder(source)).join('')
  document.body.appendChild(container)
  return container
}

function mountFlow(...sources: string[]): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = sources.map((source) => renderFlowchartPlaceholder(source)).join('')
  document.body.appendChild(container)
  return container
}

function blocks(container: HTMLElement, selector = '.ex-mermaid'): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
}

beforeEach(() => {
  document.body.innerHTML = ''
  mermaidMock.initialize.mockReset()
  mermaidMock.render.mockReset()
  mermaidMock.render.mockImplementation(async (_id: string, source: string) => {
    if (source.includes('bad')) throw new Error('Parse error on line 1')
    return { svg: `<svg data-src="ok" onload="alert(1)"><text>${source.trim()}</text><script>alert(1)</script></svg>` }
  })
  flowchartMock.parse.mockReset()
  flowchartMock.parse.mockImplementation((code: string) => {
    if (code.includes('bad')) throw new Error('Unknown symbol type')
    return {
      drawSVG: (host: HTMLElement, options: Record<string, string>) => {
        expect(host.isConnected).toBe(true)
        host.innerHTML = `<svg data-line="${options['line-color']}" data-font="${options['font-color']}"><text>${code.trim()}</text><script>x()</script></svg>`
      },
    }
  })
})

describe('renderDiagrams', () => {
  it('does nothing (and loads no diagram library) without placeholders', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>no diagrams</p>'
    await renderDiagrams(container, { theme: 'light' })
    expect(mermaidMock.initialize).not.toHaveBeenCalled()
    expect(flowchartMock.parse).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('<p>no diagrams</p>')
  })

  it('replaces placeholders with sanitized svg and keeps the source attribute', async () => {
    const container = mount('graph TD\nA-->B1\n')
    await renderDiagrams(container, { theme: 'light' })

    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, securityLevel: 'strict', theme: 'default' }),
    )
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.stringMatching(/^ex-mermaid-\d+$/), 'graph TD\nA-->B1\n')
    const [block] = blocks(container)
    expect(block!.querySelector('svg text')?.textContent).toBe('graph TD\nA-->B1')
    expect(block!.querySelector('script')).toBeNull()
    expect(block!.querySelector('svg')!.hasAttribute('onload')).toBe(false)
    expect(block!.hasAttribute('data-ex-diagram')).toBe(true)
    expect(block!.dataset.exRenderedTheme).toBe('light')
  })

  it('isolates errors to the failing block', async () => {
    const container = mount('graph TD\nbad', 'graph TD\nC-->D2')
    await renderDiagrams(container, { theme: 'light' })

    const [broken, fine] = blocks(container)
    expect(broken!.classList.contains('ex-mermaid--error')).toBe(true)
    expect(broken!.querySelector('pre.ex-mermaid-error')?.textContent).toBe('Parse error on line 1')
    expect(fine!.classList.contains('ex-mermaid--error')).toBe(false)
    expect(fine!.querySelector('svg')).not.toBeNull()
  })

  it('re-renders with the dark theme and skips blocks already rendered for a theme', async () => {
    const container = mount('graph TD\nE-->F3')
    await renderDiagrams(container, { theme: 'light' })
    expect(mermaidMock.render).toHaveBeenCalledTimes(1)

    await renderDiagrams(container, { theme: 'dark' })
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }))
    expect(mermaidMock.render).toHaveBeenCalledTimes(2)
    expect(blocks(container)[0]!.dataset.exRenderedTheme).toBe('dark')

    await renderDiagrams(container, { theme: 'dark' })
    expect(mermaidMock.render).toHaveBeenCalledTimes(2)
  })

  it('reuses cached svg for the same source and theme', async () => {
    await renderDiagrams(mount('graph TD\nG-->H4'), { theme: 'light' })
    const second = mount('graph TD\nG-->H4')
    await renderDiagrams(second, { theme: 'light' })
    expect(mermaidMock.render).toHaveBeenCalledTimes(1)
    expect(blocks(second)[0]!.querySelector('svg')).not.toBeNull()
  })

  it('serializes concurrent calls so themes do not interleave', async () => {
    const a = mount('graph TD\nI-->J5')
    const b = mount('graph TD\nK-->L6')
    await Promise.all([renderDiagrams(a, { theme: 'light' }), renderDiagrams(b, { theme: 'dark' })])
    const themes = mermaidMock.initialize.mock.calls.map(([config]) => (config as { theme: string }).theme)
    expect(themes).toEqual(['default', 'dark'])
    expect(blocks(a)[0]!.dataset.exRenderedTheme).toBe('light')
    expect(blocks(b)[0]!.dataset.exRenderedTheme).toBe('dark')
  })

  it('keeps mermaid scoped <style> but still strips <script>', async () => {
    mermaidMock.render.mockImplementationOnce(async (id: string) => ({
      svg: `<svg id="${id}"><style>#${id} .node{fill:red}</style><g class="node"></g><script>alert(1)</script></svg>`,
    }))
    const container = mount('graph TD\nS-->T9')
    await renderDiagrams(container, { theme: 'light' })

    const [block] = blocks(container)
    const id = mermaidMock.render.mock.calls[0]![0] as string
    expect(block!.querySelector('svg style')?.textContent).toBe(`#${id} .node{fill:red}`)
    expect(block!.querySelector('script')).toBeNull()
  })

  it('skips blocks removed from the container while an earlier block renders', async () => {
    const container = mount('graph TD\nU-->V10', 'graph TD\nW-->X10')
    const [, second] = blocks(container)
    mermaidMock.render.mockImplementationOnce(async (_id: string, source: string) => {
      second!.remove()
      return { svg: `<svg><text>${source}</text></svg>` }
    })
    await renderDiagrams(container, { theme: 'light' })

    expect(mermaidMock.render).toHaveBeenCalledTimes(1)
    expect(second!.hasAttribute('data-ex-rendered-theme')).toBe(false)
  })

  it('skips blocks removed before a queued call runs', async () => {
    const a = mount('graph TD\nY-->Z11')
    const b = mount('graph TD\nAA-->BB11')
    mermaidMock.render.mockImplementationOnce(async (_id: string, source: string) => {
      blocks(b)[0]!.remove()
      return { svg: `<svg><text>${source}</text></svg>` }
    })
    await Promise.all([renderDiagrams(a, { theme: 'light' }), renderDiagrams(b, { theme: 'light' })])

    expect(mermaidMock.render).toHaveBeenCalledTimes(1)
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.any(String), 'graph TD\nY-->Z11')
  })
})

describe('renderDiagrams — flowchart.js', () => {
  it('renders ex-flowchart blocks with theme colors into sanitized svg', async () => {
    const container = mountFlow('st=>start: A1\ne=>end: Z1\nst->e\n')
    await renderDiagrams(container, { theme: 'light' })

    expect(flowchartMock.parse).toHaveBeenCalledWith('st=>start: A1\ne=>end: Z1\nst->e\n')
    expect(mermaidMock.initialize).not.toHaveBeenCalled()
    const [block] = blocks(container, '.ex-flowchart')
    const svg = block!.querySelector('svg')!
    expect(svg.getAttribute('data-line')).toBe(FLOWCHART_THEMES.light['line-color'])
    expect(svg.getAttribute('data-font')).toBe(FLOWCHART_THEMES.light['font-color'])
    expect(block!.querySelector('script')).toBeNull()
    expect(block!.dataset.exRenderedTheme).toBe('light')
    expect(document.body.children).toHaveLength(1)
  })

  it('strips the flowchart header line before parsing', async () => {
    await renderDiagrams(mountFlow('flowchart\nst=>start: A2\n'), { theme: 'light' })
    expect(flowchartMock.parse).toHaveBeenCalledWith('st=>start: A2\n')
  })

  it('isolates flowchart errors to the failing block', async () => {
    const container = mountFlow('bad=>start: X', 'st=>start: A3\n')
    await renderDiagrams(container, { theme: 'light' })
    const [broken, fine] = blocks(container, '.ex-flowchart')
    expect(broken!.classList.contains('ex-flowchart--error')).toBe(true)
    expect(broken!.querySelector('pre.ex-flowchart-error')?.textContent).toBe('Unknown symbol type')
    expect(fine!.querySelector('svg')).not.toBeNull()
  })

  it('re-renders flowcharts with dark colors on theme change', async () => {
    const container = mountFlow('st=>start: A4\n')
    await renderDiagrams(container, { theme: 'light' })
    await renderDiagrams(container, { theme: 'dark' })
    expect(flowchartMock.parse).toHaveBeenCalledTimes(2)
    const svg = blocks(container, '.ex-flowchart')[0]!.querySelector('svg')!
    expect(svg.getAttribute('data-line')).toBe(FLOWCHART_THEMES.dark['line-color'])
  })

  it('renders mermaid and flowchart blocks in the same container', async () => {
    const container = document.createElement('div')
    container.innerHTML = renderMermaidPlaceholder('graph TD\nM-->N7') + renderFlowchartPlaceholder('st=>start: A7\n')
    document.body.appendChild(container)
    await renderDiagrams(container, { theme: 'dark' })
    expect(container.querySelector('.ex-mermaid svg')).not.toBeNull()
    expect(container.querySelector('.ex-flowchart svg')).not.toBeNull()
  })
})

describe('sanitizeMermaidSvg', () => {
  it('strips event handlers and javascript: links but keeps the scoped <style>', () => {
    const el = document.createElement('div')
    el.innerHTML = sanitizeMermaidSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">' +
        '<style>#m .node{fill:red}</style>' +
        '<g onclick="alert(2)"><a href="javascript:alert(3)"><text>a</text></a>' +
        '<a xlink:href="javascript:alert(4)"><text>b</text></a></g></svg>',
    )
    const svg = el.querySelector('svg')!
    expect(svg.hasAttribute('onload')).toBe(false)
    expect(el.querySelector('g')!.hasAttribute('onclick')).toBe(false)
    expect(el.querySelector('style')?.textContent).toBe('#m .node{fill:red}')
    for (const a of Array.from(el.querySelectorAll('a'))) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
      expect(a.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '').not.toMatch(/javascript:/i)
    }
    expect(el.innerHTML).not.toMatch(/javascript:|onload|onclick/i)
  })
})
