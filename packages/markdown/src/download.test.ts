import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, REVOKE_DELAY } from './download'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('downloadBlob', () => {
  it('锚点挂到 body 上点击后移除；对象 URL 延迟回收', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:x')
    const revokeObjectURL = vi.fn<(url: string) => void>()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = revokeObjectURL
      },
    )
    let connected = false
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      connected = this.isConnected
    })
    downloadBlob(new Blob(['x']), 'a.md')
    expect(click).toHaveBeenCalledTimes(1)
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(connected).toBe(true)
    expect(anchor.isConnected).toBe(false)
    expect(anchor.download).toBe('a.md')
    expect(anchor.getAttribute('href')).toBe('blob:x')
    vi.advanceTimersByTime(REVOKE_DELAY - 1)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x')
    expect(REVOKE_DELAY).toBeGreaterThanOrEqual(1000)
  })
})
