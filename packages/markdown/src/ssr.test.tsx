import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from './markdown-editor'

describe('SSR', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('无 window/document 时可 renderToString，只输出外壳不输出编辑内容', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const html = renderToString(<MarkdownEditor defaultValue="# 标题" defaultTheme="light" />)
    expect(html).toContain('class="ex-mde"')
    expect(html).toContain('data-view="split"')
    expect(html).toContain('比对')
    expect(html).not.toContain('ex-editor-content')
  })

  it('服务端渲染期间不读取 window/document/navigator', () => {
    const touched: string[] = []
    const { window: win, document: doc, navigator: nav } = globalThis
    try {
      for (const name of ['window', 'document', 'navigator'] as const) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          get() {
            touched.push(name)
            return undefined
          },
        })
      }
      renderToString(
        <StrictMode>
          <MarkdownEditor defaultValue="# 标题" defaultTheme="dark" themeStorageKey="k" />
        </StrictMode>,
      )
    } finally {
      for (const [name, value] of [['window', win], ['document', doc], ['navigator', nav]] as const) {
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
      }
    }
    expect(touched).toEqual([])
  })
})
