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

  it('未监听时 noWatch 直接执行且保持未监听', () => {
    const w = new Watcher(document.createElement('div'), vi.fn())
    const cb = vi.fn()
    w.noWatch(cb)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(w.isWatching).toBe(false)
  })
})
