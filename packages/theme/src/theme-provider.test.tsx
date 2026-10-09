import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './theme-provider'

function mockSystemDark(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return {
    emit(next: boolean) {
      mql.matches = next
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent))
    },
  }
}

function Probe() {
  const { mode, resolved, setMode, portalRoot } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <span data-testid="portal">{portalRoot?.className ?? 'none'}</span>
      <button onClick={() => setMode('dark')}>to-dark</button>
    </div>
  )
}

const root = () => document.querySelector('.ex-root') as HTMLElement

describe('ThemeProvider', () => {
  it('按 defaultTheme 渲染根节点', () => {
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
  })

  it('system 模式跟随系统并响应变化', () => {
    const media = mockSystemDark(true)
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
    act(() => media.emit(false))
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
  })

  it('非受控：setMode 更新主题并写入 localStorage', async () => {
    const onThemeChange = vi.fn()
    render(<ThemeProvider defaultTheme="light" onThemeChange={onThemeChange}><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('to-dark'))
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
    expect(window.localStorage.getItem('editorx-theme')).toBe('dark')
    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })

  it('非受控：挂载时读取 localStorage', () => {
    window.localStorage.setItem('editorx-theme', 'dark')
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
  })

  it('非受控：忽略 localStorage 中的非法值', () => {
    window.localStorage.setItem('editorx-theme', 'purple')
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
  })

  it('storageKey=false 时不读写 localStorage', async () => {
    render(<ThemeProvider defaultTheme="light" storageKey={false}><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('to-dark'))
    expect(window.localStorage.length).toBe(0)
  })

  it('受控：setMode 只触发回调，主题由 prop 决定', async () => {
    const onThemeChange = vi.fn()
    const { rerender } = render(
      <ThemeProvider theme="light" onThemeChange={onThemeChange}><Probe /></ThemeProvider>,
    )
    await userEvent.click(screen.getByText('to-dark'))
    expect(onThemeChange).toHaveBeenCalledWith('dark')
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
    expect(window.localStorage.length).toBe(0)
    rerender(<ThemeProvider theme="dark" onThemeChange={onThemeChange}><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
  })

  it('提供位于根节点内的 portalRoot', () => {
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(screen.getByTestId('portal')).toHaveTextContent('ex-portal')
    expect(root().querySelector('.ex-portal')).not.toBeNull()
  })

  it('合并自定义 className', () => {
    render(<ThemeProvider defaultTheme="light" className="host"><Probe /></ThemeProvider>)
    expect(root()).toHaveClass('ex-root', 'host')
  })

  it('Provider 外调用 useTheme 抛错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useTheme must be used within <ThemeProvider>')
  })
})
