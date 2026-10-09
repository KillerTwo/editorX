import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatMessage, mergeMessages, zhCN } from './messages'
import { MessagesProvider, useMessages } from './messages-context'

function Probe() {
  const m = useMessages()
  return <span data-testid="probe">{`${m.toolbar.bold}|${m.modes.split}|${m.status.saved}`}</span>
}

describe('Messages', () => {
  it('默认中文文案', () => {
    expect(zhCN.toolbar.bold).toBe('加粗')
    expect(zhCN.modes).toMatchObject({ edit: 'Markdown', split: '比对', preview: '预览' })
    expect(zhCN.syntax.items.length).toBeGreaterThan(5)
  })

  it('mergeMessages 深合并，未覆盖的键保留默认，数组整体替换', () => {
    const merged = mergeMessages(zhCN, { toolbar: { bold: 'Bold' }, syntax: { items: [['A', 'a']] } })
    expect(merged.toolbar.bold).toBe('Bold')
    expect(merged.toolbar.italic).toBe('斜体')
    expect(merged.syntax.items).toEqual([['A', 'a']])
    expect(zhCN.toolbar.bold).toBe('加粗')
  })

  it('formatMessage 替换 {name} 占位，未知占位保持原样', () => {
    expect(formatMessage('扩展 {name} 出错：{message}', { name: 'demo', message: 'boom' })).toBe('扩展 demo 出错：boom')
    expect(formatMessage('{a}-{b}', { a: 1 })).toBe('1-{b}')
  })

  it('无 Provider 时 useMessages 返回 zhCN；嵌套 Provider 逐层叠加', () => {
    const { unmount } = render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('加粗|比对|文章已保存')
    unmount()
    render(
      <MessagesProvider messages={{ toolbar: { bold: 'Bold' } }}>
        <MessagesProvider messages={{ modes: { split: 'Split' } }}>
          <Probe />
        </MessagesProvider>
      </MessagesProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('Bold|Split|文章已保存')
  })
})
