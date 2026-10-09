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

const toasts = () => document.querySelectorAll('.ex-toast')

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('notify 显示消息并带类型类名，渲染在 .ex-portal 内', () => {
    setup(<Trigger type="success" />)
    fireEvent.click(screen.getByText('notify'))
    const toast = document.querySelector('.ex-toast') as HTMLElement
    expect(toast).toHaveTextContent('草稿已保存')
    expect(toast).toHaveClass('ex-toast', 'ex-toast--success')
    expect(toast.closest('.ex-portal')).not.toBeNull()
  })

  it('默认类型为 info', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    expect(document.querySelector('.ex-toast')).toHaveClass('ex-toast--info')
  })

  it('到达 Provider 默认时长后自动消失', () => {
    setup(<Trigger />, 1000)
    fireEvent.click(screen.getByText('notify'))
    act(() => vi.advanceTimersByTime(999))
    expect(toasts()).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1))
    expect(toasts()).toHaveLength(0)
  })

  it('单次调用的 duration 覆盖默认时长', () => {
    setup(<Trigger duration={500} />)
    fireEvent.click(screen.getByText('notify'))
    act(() => vi.advanceTimersByTime(500))
    expect(toasts()).toHaveLength(0)
  })

  it('可同时显示多条', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    fireEvent.click(screen.getByText('notify'))
    expect(toasts()).toHaveLength(2)
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
    expect(toasts().length).toBeGreaterThan(0)
    act(() => vi.advanceTimersByTime(1000))
    expect(toasts()).toHaveLength(0)
  })

  it('status/alert 播报容器在提示出现前就已挂载且为空', () => {
    setup(<Trigger />)
    const status = screen.getByRole('status')
    const alert = screen.getByRole('alert')
    expect(status.closest('.ex-toast-stack')).not.toBeNull()
    expect(alert.closest('.ex-toast-stack')).not.toBeNull()
    expect(status).toBeEmptyDOMElement()
    expect(alert).toBeEmptyDOMElement()
  })

  it('非 error 提示进入 status 容器，error 进入 alert 容器，单条提示本身不带 role', () => {
    setup(
      <>
        <Trigger type="success" />
        <Trigger type="error" />
      </>,
    )
    const [successBtn, errorBtn] = screen.getAllByText('notify') as [HTMLElement, HTMLElement]
    fireEvent.click(successBtn)
    fireEvent.click(errorBtn)
    const success = document.querySelector('.ex-toast--success') as HTMLElement
    const error = document.querySelector('.ex-toast--error') as HTMLElement
    expect(screen.getByRole('status')).toContainElement(success)
    expect(screen.getByRole('alert')).toContainElement(error)
    expect(success).not.toHaveAttribute('role')
    expect(error).not.toHaveAttribute('role')
  })

  it('播报容器的文本只有消息本身', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getByRole('status')).toHaveTextContent(/^草稿已保存$/)
  })

  it('关闭按钮立即移除提示，按钮名可配置', () => {
    render(
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <ToastProvider closeLabel="Close">
          <Trigger />
        </ToastProvider>
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByText('notify'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(toasts()).toHaveLength(0)
  })

  it('Provider 外调用 useToast 抛错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('useToast must be used within <ToastProvider>')
  })
})
