import { ThemeProvider } from '@geekx/theme'
import {
  Toolbar,
  resolveToolbar,
  zhCN,
  type EditorExtension,
  type ExtensionContext,
  type MissingAdapterPolicy,
  type ToolbarLayout,
} from '@geekx/toolbar'
import { render } from '@testing-library/react'
import { StrictMode, type ReactElement } from 'react'
import { vi } from 'vitest'

export function showToolbar(): void {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('ex-toolbar__group') ? 180 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('ex-toolbar') ? 1400 : 0
  })
}

export function extensionCtx(over: Partial<ExtensionContext> = {}): ExtensionContext {
  return {
    editorType: 'markdown',
    insert: vi.fn(),
    insertEmbed: vi.fn(),
    getSelectionText: () => '',
    replaceSelection: vi.fn(),
    replaceDocument: vi.fn(),
    getDocument: () => ({ editorType: 'markdown', title: '', markdown: '', html: '' }),
    commands: { has: () => true, run: vi.fn(() => true), list: () => [] },
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    togglePanel: vi.fn(),
    activePanel: null,
    uploadImages: vi.fn(async () => {}),
    focus: vi.fn(),
    notify: vi.fn(),
    theme: 'light',
    locale: zhCN,
    readOnly: false,
    formats: new Set<string>(),
    ...over,
    adapters: { ...over.adapters },
  }
}

export function renderExtension(
  extensions: readonly EditorExtension[],
  ctx: ExtensionContext,
  layout: ToolbarLayout,
  missingAdapter?: MissingAdapterPolicy,
): ReturnType<typeof render> {
  showToolbar()
  const groups = resolveToolbar([...extensions], layout, {
    editorType: ctx.editorType,
    adapters: ctx.adapters,
    missingAdapter,
  })
  return render(
    <StrictMode>
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <Toolbar groups={groups} ctx={ctx} />
      </ThemeProvider>
    </StrictMode>,
  )
}

export function renderStrict(ui: ReactElement): ReturnType<typeof render> {
  return render(<StrictMode>{ui}</StrictMode>)
}
