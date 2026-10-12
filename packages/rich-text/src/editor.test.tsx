import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { RichTextEditor } from './rich-text-editor'

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

  it('服务端渲染不触碰 window 滚动', () => {
    const html = renderToString(<RichTextEditor />)
    expect(html).toContain('ex-rte__scroll')
    expect(html).not.toContain('ck-editor')
  })
})
