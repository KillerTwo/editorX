import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyChange, debounce, diffRange, revertChange } from './utils'

describe('diffRange', () => {
  it('相同文本返回 null', () => {
    expect(diffRange('abc', 'abc')).toBeNull()
  })

  it('中间插入', () => {
    expect(diffRange('abef', 'abcdef')).toEqual({ start: 2, removed: '', inserted: 'cd' })
  })

  it('中间删除', () => {
    expect(diffRange('abcdef', 'abef')).toEqual({ start: 2, removed: 'cd', inserted: '' })
  })

  it('替换', () => {
    expect(diffRange('hello world', 'hello there')).toEqual({ start: 6, removed: 'world', inserted: 'there' })
  })

  it('重复字符时前缀优先、后缀不越过前缀', () => {
    expect(diffRange('aaa', 'aaaa')).toEqual({ start: 3, removed: '', inserted: 'a' })
  })

  it('applyChange / revertChange 互逆', () => {
    const before = '# 标题\n\n正文'
    const after = '# 标题\n\n新的正文内容'
    const change = diffRange(before, after)!
    expect(applyChange(before, change)).toBe(after)
    expect(revertChange(after, change)).toBe(before)
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('在静默期结束后只调用一次并使用最后一次参数', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 50)
    d(1)
    d(2)
    vi.advanceTimersByTime(49)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('cancel 取消，flush 立即执行', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 50)
    d(1)
    d.cancel()
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
    d(3)
    d.flush()
    expect(fn).toHaveBeenCalledExactlyOnceWith(3)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
