import { describe, expect, it } from 'vitest'
import { Marker } from './marker'

describe('Marker', () => {
  it('前方插入时后移', () => {
    const m = new Marker(5)
    m.adjust({ start: 2, removed: '', inserted: 'ab' })
    expect(m.offset).toBe(7)
  })

  it('在标记处插入：非 trailing 后移，trailing 不动', () => {
    const a = new Marker(5)
    const b = new Marker(5, true)
    a.adjust({ start: 5, removed: '', inserted: 'xy' })
    b.adjust({ start: 5, removed: '', inserted: 'xy' })
    expect(a.offset).toBe(7)
    expect(b.offset).toBe(5)
  })

  it('后方编辑不影响', () => {
    const m = new Marker(3)
    m.adjust({ start: 4, removed: 'abc', inserted: 'z' })
    expect(m.offset).toBe(3)
  })

  it('删除覆盖标记时收缩到删除起点', () => {
    const m = new Marker(3)
    m.adjust({ start: 2, removed: 'abcd', inserted: '' })
    expect(m.offset).toBe(2)
  })

  it('删除在标记之前时前移删除长度', () => {
    const m = new Marker(5)
    m.adjust({ start: 1, removed: 'ab', inserted: '' })
    expect(m.offset).toBe(3)
  })
})
