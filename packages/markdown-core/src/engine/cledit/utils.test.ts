import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyChange, debounce, diffRange, revertChange } from './utils'

function naiveDiff(a: string, b: string) {
  if (a === b) return null
  let p = 0
  while (p < Math.min(a.length, b.length) && a[p] === b[p]) p++
  let s = 0
  while (s < Math.min(a.length, b.length) - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  return { start: p, removed: a.slice(p, a.length - s), inserted: b.slice(p, b.length - s) }
}

describe('diffRange 与逐字符比较结果一致', () => {
  it('随机编辑（含重复字符与边界）', () => {
    let seed = 42
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    const alphabet = 'ab\n#'
    const word = (n: number) => Array.from({ length: n }, () => alphabet[rand(alphabet.length)]).join('')
    for (let i = 0; i < 2000; i++) {
      const a = word(rand(40))
      const at = rand(a.length + 1)
      const del = rand(Math.min(5, a.length - at) + 1)
      const b = a.slice(0, at) + word(rand(5)) + a.slice(at + del)
      expect(diffRange(a, b)).toEqual(naiveDiff(a, b))
    }
  })
})

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
