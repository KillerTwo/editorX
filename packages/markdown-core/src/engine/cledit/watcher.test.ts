import { describe, expect, it, vi } from 'vitest'
import { Watcher } from './watcher'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('Watcher', () => {
  it('start 后上报子树文本变化', async () => {
    const el = document.createElement('div')
    el.appendChild(document.createTextNode('a'))
    const listener = vi.fn()
    const w = new Watcher(el, listener)
    w.start()
    expect(w.isWatching).toBe(true)
    ;(el.firstChild as Text).data = 'b'
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
    w.stop()
    expect(w.isWatching).toBe(false)
  })

  it('noWatch 内的变化不会上报，之后恢复监听', async () => {
    const el = document.createElement('div')
    const listener = vi.fn()
    const w = new Watcher(el, listener)
    w.start()
    w.noWatch(() => {
      el.textContent = 'silent'
    })
    await flush()
    expect(listener).not.toHaveBeenCalled()
    expect(w.isWatching).toBe(true)
    el.textContent = 'loud'
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('takeRecords 取走尚未投递的记录，之后不再投递', async () => {
    const el = document.createElement('div')
    el.appendChild(document.createTextNode('a'))
    const listener = vi.fn()
    const w = new Watcher(el, listener)
    w.start()
    ;(el.firstChild as Text).data = 'b'
    expect(w.takeRecords()).toHaveLength(1)
    expect(w.takeRecords()).toEqual([])
    await flush()
    expect(listener).not.toHaveBeenCalled()
    w.stop()
  })

  it('stop / noWatch 时未投递的记录交给 onDropped，而非丢弃', () => {
    const el = document.createElement('div')
    el.appendChild(document.createTextNode('a'))
    const dropped = vi.fn()
    const w = new Watcher(el, vi.fn(), dropped)
    w.start()
    ;(el.firstChild as Text).data = 'b'
    w.noWatch(() => {})
    expect(dropped).toHaveBeenCalledTimes(1)
    expect(dropped.mock.calls[0]![0]).toHaveLength(1)
    w.stop()
    expect(dropped).toHaveBeenCalledTimes(1)
  })

  it('未监听时 noWatch 直接执行且保持未监听', () => {
    const w = new Watcher(document.createElement('div'), vi.fn())
    const cb = vi.fn()
    w.noWatch(cb)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(w.isWatching).toBe(false)
  })
})
