import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { EditorExtension } from '@geekx/toolbar'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountEditor } from './mount-editor'
import { RichTextEditor } from './rich-text-editor'

vi.mock('./mount-editor', () => ({
  mountEditor: vi.fn(),
}))

function createMounted(initial = '') {
  return {
    getData: () => initial,
    setData: vi.fn(),
    setReadOnly: vi.fn(),
    insertHtml: vi.fn(),
    replaceHtml: vi.fn(),
    getSelectionText: () => '',
    execute: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(async () => undefined),
    onChange: () => () => undefined,
  }
}

beforeEach(() => {
  vi.mocked(mountEditor).mockReset()
  vi.mocked(mountEditor).mockImplementation(async (_element, _config, html: string) => createMounted(html))
})

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const panel: EditorExtension = {
  name: 'csdn:ai',
  editors: ['richtext'],
  panels: [{ id: 'csdn:ai', title: 'AI', position: 'right', render: () => <p>占位面板</p> }],
}

describe('右侧抽屉', () => {
  it('展开时抽屉宽 390 且不改变稿纸宽度类', () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor
          defaultTocOpen={false}
          extensions={[panel]}
          slots={{ rightCollapsed: <div data-testid="collapsed">收起占位</div> }}
        />
      </StrictMode>,
    )
    expect(screen.getByText('占位面板')).toBeInTheDocument()
    expect(container.querySelector('.ex-rte-drawer')).toBeInTheDocument()
    expect(container.querySelector('.ex-rte-paper')).toBeInTheDocument()
    expect(screen.queryByTestId('collapsed')).toBeNull()
  })

  it('收起后只渲染 rightCollapsed', async () => {
    const onRightOpenChange = vi.fn()
    const { container } = render(
      <StrictMode>
        <RichTextEditor
          defaultTocOpen={false}
          extensions={[panel]}
          onRightOpenChange={onRightOpenChange}
          slots={{ rightCollapsed: <div>收起占位</div> }}
        />
      </StrictMode>,
    )
    const drawer = container.querySelector('.ex-rte-drawer')
    expect(drawer).not.toBeNull()
    await userEvent.click(within(drawer as HTMLElement).getByRole('button', { name: '收起' }))
    expect(onRightOpenChange).toHaveBeenCalledWith(false)
    expect(screen.getByText('收起占位')).toBeInTheDocument()
    expect(screen.queryByText('占位面板')).toBeNull()
  })

  it('抽屉浮在稿纸上，不推动稿纸', () => {
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*width:\s*390px/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*top:\s*52px/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*bottom:\s*68px/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*z-index:\s*20/)
    expect(css).toMatch(/\.ex-rte-drawer\s*\{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\.ex-rte-paper\s*\{[^}]*width:\s*816px/)
    expect(css).toMatch(/\.ex-rte-paper\s*\{[^}]*margin:\s*0 auto/)
  })
})
