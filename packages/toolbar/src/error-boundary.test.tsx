import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExtensionErrorBoundary } from './error-boundary'

describe('ExtensionErrorBoundary', () => {
  it('render 函数直接抛错被截获并上报，兄弟节点不受影响', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    render(
      <div>
        <ExtensionErrorBoundary
          name="panel"
          onError={onError}
          render={() => {
            throw new Error('direct')
          }}
        />
        <p>兄弟</p>
      </div>,
    )
    expect(onError).toHaveBeenCalledWith('panel', expect.objectContaining({ message: 'direct' }))
    expect(screen.getByText('兄弟')).toBeInTheDocument()
  })

  it('render 优先于 children', () => {
    render(
      <ExtensionErrorBoundary name="x" onError={vi.fn()} render={() => <span>来自 render</span>}>
        <span>来自 children</span>
      </ExtensionErrorBoundary>,
    )
    expect(screen.getByText('来自 render')).toBeInTheDocument()
    expect(screen.queryByText('来自 children')).toBeNull()
  })

  it('子组件抛错同样被截获', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    const Broken = () => {
      throw new Error('child')
    }
    render(
      <ExtensionErrorBoundary name="c" onError={onError}>
        <Broken />
      </ExtensionErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledWith('c', expect.objectContaining({ message: 'child' }))
  })
})
