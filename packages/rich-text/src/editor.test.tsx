import type { EditorExtension } from '@geekx/toolbar'
import { renderToString } from 'react-dom/server'
import { StrictMode, createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { RichTextEditor } from './rich-text-editor'
import type { RichTextEditorHandle } from './types'

describe('RichTextEditor 壳', () => {
  it('滚动容器在组件内部', () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor />
      </StrictMode>,
    )
    const root = container.querySelector('.ex-rte')
    expect(root).not.toBeNull()
    expect(container.querySelector('.ex-rte__scroll')).not.toBeNull()
    expect(root).toHaveAttribute('data-editor', 'rich-text')
  })

  it('编辑态与 getData 包含扩展卡片', async () => {
    const card = (title: string) => `<p class="ex-csdn-ext-card">${title}</p>`
    const extensions: EditorExtension[] = [
      {
        name: 'cards',
        embeds: [
          { type: 'vote', renderHtml: (payload) => card((payload as { title?: string }).title ?? '') },
          { type: 'video', renderHtml: (payload) => card((payload as { title?: string }).title ?? '') },
          { type: 'resource', renderHtml: (payload) => card((payload as { title?: string }).title ?? '') },
          { type: 'inscode', renderHtml: (payload) => card((payload as { title?: string }).title ?? '') },
        ],
      },
    ]
    const block = (type: string, title: string) =>
      `<div data-ex-embed="${type}" data-payload='${JSON.stringify({ title })}'></div>`
    const ref = createRef<RichTextEditorHandle>()
    const { container } = render(
      <StrictMode>
        <RichTextEditor
          ref={ref}
          extensions={extensions}
          defaultValue={[block('vote', '投票卡片'), block('video', '视频卡片'), block('resource', '资源卡片'), block('inscode', '代码卡片')].join('')}
        />
      </StrictMode>,
    )
    await waitFor(() => {
      expect(container.innerHTML).toContain('ex-csdn-ext-card')
      expect(container.innerHTML).toContain('投票卡片')
      expect(container.innerHTML).toContain('视频卡片')
      expect(container.innerHTML).toContain('资源卡片')
      expect(container.innerHTML).toContain('代码卡片')
    })
    const data = ref.current?.getValue() ?? ''
    expect(data).toContain('投票卡片')
    expect(data).toContain('视频卡片')
    expect(data).toContain('资源卡片')
    expect(data).toContain('代码卡片')
    expect(data).toContain('data-ex-embed="vote"')
    expect(data).not.toContain('data-ex-payload')
  })

  it('服务端渲染不触碰 window 滚动', () => {
    const html = renderToString(<RichTextEditor />)
    expect(html).toContain('ex-rte__scroll')
    expect(html).not.toContain('ck-editor')
  })
})
