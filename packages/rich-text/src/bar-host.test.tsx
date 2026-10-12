import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountEditor } from './mount-editor'
import { RichTextEditor } from './rich-text-editor'

vi.mock('./mount-editor', () => ({
  mountEditor: vi.fn(async () => ({
    getData: () => '',
    setData: vi.fn(),
    setReadOnly: vi.fn(),
    insertHtml: vi.fn(),
    replaceHtml: vi.fn(),
    getSelectionText: () => '',
    execute: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(async () => undefined),
    onChange: () => () => undefined,
  })),
}))

beforeEach(() => {
  vi.mocked(mountEditor).mockClear()
})

function FixedBar() {
  return (
    <div className="ex-pub">
      <div className="ex-pub-card">卡片</div>
      <div className="ex-pub-bar is-fixed">操作</div>
    </div>
  )
}

describe('固定栏宿主', () => {
  it('挂载时移到宿主，重渲染不再搬，卸载前放回原父节点', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    })
    const { container, rerender, unmount } = render(
      <StrictMode>
        <RichTextEditor slots={{ afterPaper: <FixedBar /> }} />
      </StrictMode>,
    )
    const host = container.querySelector('.ex-rte-bar-host')
    const bar = container.querySelector('.ex-pub-bar.is-fixed')
    expect(bar?.parentElement).toBe(host)
    expect(container.querySelector('.ex-rte__after .ex-pub-card')).not.toBeNull()
    const resizeAdds = () => add.mock.calls.filter((call) => call[0] === 'resize').length
    const afterMount = resizeAdds()
    expect(afterMount).toBeGreaterThan(0)

    rerender(
      <StrictMode>
        <RichTextEditor readOnly slots={{ afterPaper: <FixedBar /> }} />
      </StrictMode>,
    )
    expect(resizeAdds()).toBe(afterMount)
    expect(container.querySelector('.ex-pub-bar.is-fixed')?.parentElement).toBe(host)

    expect(() => unmount()).not.toThrow()
    expect(errors.join('\n')).not.toMatch(/removeChild|not a child/i)
    expect(container.querySelector('.ex-pub-bar')).toBeNull()
  })
})
