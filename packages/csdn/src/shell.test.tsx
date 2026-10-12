import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { CsdnEditor } from './csdn-editor'

describe('CsdnEditor 壳', () => {
  it('根节点占满父级并标出 markdown', () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor />
      </StrictMode>,
    )
    const root = container.querySelector('.ex-csdn')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute('data-editor', 'markdown')
    expect(root).toHaveClass('ex-csdn')
  })

  it('服务端渲染不访问 window', () => {
    const html = renderToString(<CsdnEditor />)
    expect(html).toContain('ex-csdn')
  })

  it('首页链到 /csdn', () => {
    const home = readFileSync(new URL('../../../apps/playground/app/page.tsx', import.meta.url), 'utf8')
    expect(home).toContain('href="/csdn"')
  })
})
