import { ThemeProvider } from '@editorx/theme'
import { ToastProvider } from '@editorx/ui'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ExtensionContext } from './extension'
import { resolveToolbar } from './layout'
import { zhCN } from './messages'
import { Toolbar } from './toolbar'

const ctx = {
  editorType: 'markdown',
  commands: { has: () => true, run: () => true, list: () => [] },
  adapters: {},
  activePanel: null,
  theme: 'light',
  locale: zhCN,
  readOnly: false,
  formats: new Set<string>(),
} as unknown as ExtensionContext

describe('Toolbar SSR', () => {
  it('服务端渲染期间不读取 navigator', () => {
    const groups = resolveToolbar(
      [{ name: 'core', toolbar: [{ type: 'button', id: 'bold', title: '加粗', shortcut: 'Mod-B', run: vi.fn() }] }],
      undefined,
      { editorType: 'markdown', adapters: {} },
    )
    const touched: string[] = []
    const nav = globalThis.navigator
    let html = ''
    try {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        get() {
          touched.push('navigator')
          return undefined
        },
      })
      html = renderToString(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={groups} ctx={ctx} />
          </ToastProvider>
        </ThemeProvider>,
      )
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: nav })
    }
    expect(html).toContain('aria-label="加粗"')
    expect(touched).toEqual([])
  })
})
