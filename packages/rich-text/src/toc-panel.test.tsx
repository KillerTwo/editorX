import { readFileSync } from 'node:fs'
import path from 'node:path'
import { zhCN } from '@editorx/toolbar'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { richTextCoreExtensions } from './core-extensions'
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

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('左侧目录', () => {
  it('从正文标题生成目录，不依赖 @[TOC]', async () => {
    const { container, unmount } = render(
      <StrictMode>
        <RichTextEditor defaultValue="<h2>安装</h2>" />
      </StrictMode>,
    )
    expect(await screen.findByRole('button', { name: '安装' })).toBeInTheDocument()
    expect(container.querySelectorAll('aside.ex-rte-toc')).toHaveLength(1)
    expect(container.querySelector('.ex-rte-toc')).not.toHaveClass('is-open')
    expect(container.querySelector('.ex-rte-toc')).not.toHaveClass('is-collapsed')
    unmount()

    render(
      <StrictMode>
        <RichTextEditor defaultValue="<p>@[TOC]</p>" />
      </StrictMode>,
    )
    expect(await screen.findByText('为文内增加标题，这里将生成目录')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '@[TOC]' })).toBeNull()
    expect(zhCN.panels.tocEmptyAfter).toContain('@[TOC]')
  })

  it('收起后面板带 is-collapsed，展开去掉它并加上 is-open', async () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor defaultValue="<h2>安装</h2>" />
      </StrictMode>,
    )
    await userEvent.click(await screen.findByRole('button', { name: '收起' }))
    expect(container.querySelector('.ex-rte-toc')).toHaveClass('is-collapsed')
    expect(screen.getByRole('button', { name: '展开' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '展开' }))
    expect(container.querySelector('.ex-rte-toc')).not.toHaveClass('is-collapsed')
    expect(container.querySelector('.ex-rte-toc')).toHaveClass('is-open')
  })

  it('defaultTocOpen 为 false 时目录收起', () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor defaultTocOpen={false} />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-rte-toc')).toHaveClass('is-collapsed')
    expect(container.querySelector('.ex-rte-toc')).not.toHaveClass('is-open')
  })

  it('点击条目滚动 .ex-rte__scroll，不改 window', async () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor defaultValue={'<h2 id="a">安装</h2><h3>步骤</h3>'} />
      </StrictMode>,
    )
    await waitFor(() => expect(mountEditor).toHaveBeenCalled())
    const scroll = container.querySelector('.ex-rte__scroll') as HTMLElement
    const content = document.createElement('div')
    content.className = 'ck-content'
    content.innerHTML = '<h2 id="a">安装</h2><h3>  </h3><h3>步骤</h3>'
    scroll.appendChild(content)
    const step = content.querySelectorAll('h3')[1] as HTMLElement
    const rect = (top: number): DOMRect =>
      ({
        top,
        bottom: top + 20,
        left: 0,
        right: 0,
        width: 0,
        height: 20,
        x: 0,
        y: top,
        toJSON() {
          return {}
        },
      }) as DOMRect
    step.getBoundingClientRect = () => rect(400)
    scroll.getBoundingClientRect = () => rect(100)
    let top = 0
    Object.defineProperty(scroll, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    const before = window.scrollY
    await userEvent.click(await screen.findByRole('button', { name: '步骤' }))
    expect(scroll.scrollTop).toBe(300)
    expect(window.scrollY).toBe(before)
    expect(container.querySelector('.ex-rte-body')?.innerHTML ?? '').not.toContain('ex-h-')
  })

  it('核心扩展把目录注册在左侧，render 不挂 aside', () => {
    const panel = richTextCoreExtensions.flatMap((ext) => ext.panels ?? []).find((item) => item.id === 'toc')
    expect(panel).toMatchObject({ id: 'toc', position: 'left' })
    const { container } = render(
      <>
        {panel!.render({
          getDocument: () => ({ editorType: 'richtext', title: '', html: '<h2 id="a">安装</h2>' }),
        } as never)}
      </>,
    )
    expect(screen.getByRole('button', { name: '安装' })).toHaveAttribute('data-heading-id', 'a')
    expect(container.querySelector('aside.ex-rte-toc')).toBeNull()
  })

  it('目录宽 280，贴在 left 23、top 84、bottom 37', () => {
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*width:\s*280px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*left:\s*23px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*top:\s*84px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*bottom:\s*37px/)
    expect(css).toMatch(/\.ex-rte-toc\s*\{[^}]*position:\s*absolute/)
    const tocMedia = `@media (max-width: 1199px) {
  .ex-rte-toc { visibility: hidden; }
  .ex-rte-toc.is-open { visibility: visible; }
}`
    expect(css).toContain(tocMedia)
    const mediaAt = css.indexOf(tocMedia)
    expect(css.indexOf('.ex-rte-toc.is-collapsed')).toBeGreaterThan(mediaAt)
  })
})
