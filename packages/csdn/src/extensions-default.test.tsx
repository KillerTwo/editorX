import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CsdnEditor } from './csdn-editor'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('ex-toolbar__group') ? 180 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('ex-toolbar') ? 1400 : 0
  })
})

describe('CsdnEditor 默认扩展', () => {
  it('省略 extensions 时能看见模版，空数组则没有', async () => {
    const getTemplates = vi.fn(async () => [{ id: 'weekly', name: '周报', markdown: '# 周报' }])
    const view = render(
      <StrictMode>
        <CsdnEditor adapters={{ getTemplates }} />
      </StrictMode>,
    )
    expect(await screen.findByRole('button', { name: '模版' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '历史' })).toBeNull()
    expect(screen.queryByRole('button', { name: '历史版本' })).toBeNull()
    expect(screen.queryByRole('button', { name: '使用 MD 编辑器' })).toBeNull()
    view.rerender(
      <StrictMode>
        <CsdnEditor adapters={{ getTemplates }} extensions={[]} />
      </StrictMode>,
    )
    expect(screen.queryByRole('button', { name: '模版' })).toBeNull()
  })

  it('富文本把 aiAssist 交给面板；没有 adapter 时面板不出现', async () => {
    async function* stream() {
      yield '已生成'
    }
    const withAi = render(
      <StrictMode>
        <CsdnEditor defaultEditor="richtext" adapters={{ aiAssist: () => stream() }} />
      </StrictMode>,
    )
    expect(await screen.findByRole('textbox', { name: '告诉 AI 你想写什么' })).toBeInTheDocument()
    withAi.unmount()
    render(
      <StrictMode>
        <CsdnEditor defaultEditor="richtext" />
      </StrictMode>,
    )
    expect(screen.queryByRole('textbox', { name: '告诉 AI 你想写什么' })).toBeNull()
  })

  it('切换编辑器仍打开外壳对话框，不提示阶段 6', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <CsdnEditor />
      </StrictMode>,
    )
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    expect(await screen.findByRole('dialog', { name: '切换编辑器' })).toBeInTheDocument()
    expect(screen.queryByText('阶段 6 接入')).toBeNull()
  })
})
