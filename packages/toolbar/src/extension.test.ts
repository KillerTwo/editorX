import { describe, expect, it, vi } from 'vitest'
import { resolveText, safeResolveText } from './extension'
import { zhCN } from './messages'

describe('resolveText / safeResolveText', () => {
  it('字符串原样返回，函数以 messages 求值', () => {
    expect(resolveText('静态', zhCN)).toBe('静态')
    expect(safeResolveText((m) => m.toolbar.bold, zhCN, undefined, 'ext', 'bold')).toBe('加粗')
  })

  it('函数抛错时回退 fallback，并 console.error 扩展名', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const thrown = new TypeError('m.myExt is undefined')
    const text = () => {
      throw thrown
    }
    expect(safeResolveText(text, zhCN, undefined, 'my-ext', 'save')).toBe('save')
    expect(error).toHaveBeenCalledWith(expect.stringContaining('my-ext'), thrown)
  })
})
