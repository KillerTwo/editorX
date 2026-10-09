import { act, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@editorx/theme'
import { StrictMode, useEffect, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast, type ToastType } from './toast'

function Trigger({ type, duration }: { type?: ToastType; duration?: number }) {
  const { notify } = useToast()
  return <button onClick={() => notify('草稿已保存', type, duration)}>notify</button>
}

function setup(ui: ReactNode, duration?: number) {
  return render(
    <ThemeProvider defaultTheme="light" storageKey={false}>
      <ToastProvider duration={duration}>{ui}</ToastProvider>
    </ThemeProvider>,
  )
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('notify 显示消息并带类型类名，渲染在 .ex-portal 内', () => {
    setup(<Trigger type="success" />)
    fireEvent.click(screen.getByText('notify'))
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('草稿已保存')
    expect(toast).toHaveClass('ex-toast', 'ex-toast--success')
    expect(toast.closest('.ex-portal')).not.toBeNull()
  })

  it('默认类型为 info', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getByRole('status')).toHaveClass('ex-toast--info')
  })

  it('到达 Provider 默认时长后自动消失', () => {
    setup(<Trigger />, 1000)
    fireEvent.click(screen.getByText('notify'))
    act(() => vi.advanceTimersByTime(999))
    expect(screen.queryByRole('status')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('单次调用的 duration 覆盖默认时长', () => {
    setup(<Trigger duration={500} />)
    fireEvent.click(screen.getByText('notify'))
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('可同时显示多条', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('卸载时清理定时器', () => {
    const { unmount } = setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('StrictMode 下挂载时触发的提示也会按时消失', () => {
    function MountNotify() {
      const { notify } = useToast()
      useEffect(() => {
        notify('挂载提示')
      }, [notify])
      return null
    }
    render(
      <StrictMode>
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider duration={1000}>
            <MountNotify />
          </ToastProvider>
        </ThemeProvider>
      </StrictMode>,
    )
    expect(screen.queryAllByRole('status').length).toBeGreaterThan(0)
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('Provider 外调用 useToast 抛错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('useToast must be used within <ToastProvider>')
  })
})
