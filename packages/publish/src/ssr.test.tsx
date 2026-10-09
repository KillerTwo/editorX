import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublishModal, PublishPanel } from './publish-panel'

describe('SSR', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('无 window/document 时可 renderToString', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const html = renderToString(
      <PublishPanel
        defaultTheme="light"
        document={{ editorType: 'markdown', title: '服务端渲染标题', html: '<p>正文</p>' }}
        adapters={{ onPublish: async () => {} }}
      />,
    )
    expect(html).toContain('ex-pub-card')
    expect(html).toContain('文章标签')
    expect(html).toContain('发布博客')
    expect(renderToString(<PublishModal defaultTheme="light" open={false} onClose={() => {}} />)).not.toContain('ex-pub-form')
  })
})
