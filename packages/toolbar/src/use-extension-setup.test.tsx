import { fireEvent, render } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorExtension, ExtensionContext } from './extension'
import { useExtensionSetup, useStableArray } from './use-extension-setup'

const ctx = {} as ExtensionContext

function Host({ extensions, onError }: { extensions: EditorExtension[]; onError: (n: string, e: unknown) => void }) {
  useExtensionSetup(useStableArray(extensions), ctx, onError)
  return null
}

describe('useExtensionSetup', () => {
  it('挂载时 setup、卸载时清理；StrictMode 下成对执行', () => {
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const { unmount } = render(
      <StrictMode>
        <Host extensions={[{ name: 'a', setup }]} onError={vi.fn()} />
      </StrictMode>,
    )
    expect(setup).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledTimes(1)
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(setup).toHaveBeenCalledWith(ctx)
  })

  it('元素不变的新数组不重跑；扩展移除时清理', () => {
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const ext: EditorExtension = { name: 'a', setup }
    const { rerender } = render(<Host extensions={[ext]} onError={vi.fn()} />)
    rerender(<Host extensions={[ext]} onError={vi.fn()} />)
    expect(setup).toHaveBeenCalledTimes(1)
    rerender(<Host extensions={[]} onError={vi.fn()} />)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('setup 或 cleanup 抛错交给 onError，其他扩展照常', () => {
    const onError = vi.fn()
    const good = vi.fn()
    const { unmount } = render(
      <Host
        extensions={[
          { name: 'bad', setup: () => { throw new Error('setup') } },
          { name: 'bad-cleanup', setup: () => () => { throw new Error('cleanup') } },
          { name: 'good', setup: good },
        ]}
        onError={onError}
      />,
    )
    expect(good).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('bad', expect.objectContaining({ message: 'setup' }))
    unmount()
    expect(onError).toHaveBeenCalledWith('bad-cleanup', expect.objectContaining({ message: 'cleanup' }))
  })

  it('useStableArray：元素逐个相同则返回同一引用', () => {
    const seen: unknown[] = []
    const a = { name: 'a' }
    function Probe({ list }: { list: object[] }) {
      seen.push(useStableArray(list))
      return null
    }
    function Parent() {
      const [n, setN] = useState(0)
      return (
        <>
          <button onClick={() => setN(n + 1)}>+</button>
          <Probe list={[a]} />
        </>
      )
    }
    const { getByText } = render(<Parent />)
    fireEvent.click(getByText('+'))
    expect(seen.length).toBeGreaterThan(1)
    expect(seen[seen.length - 1]).toBe(seen[0])
  })

  it('useStableArray：元素变化时返回新引用', () => {
    const seen: unknown[] = []
    function Probe({ list }: { list: object[] }) {
      seen.push(useStableArray(list))
      return null
    }
    const { rerender } = render(<Probe list={[{ name: 'a' }]} />)
    rerender(<Probe list={[{ name: 'a' }]} />)
    expect(seen[1]).not.toBe(seen[0])
  })
})
