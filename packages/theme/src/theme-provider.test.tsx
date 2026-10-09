import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useOptionalTheme, useTheme } from './theme-provider'

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

  it('SSR：system 模式输出 data-ex-theme="system"，显式模式输出对应值', () => {
    expect(renderToString(<ThemeProvider><span /></ThemeProvider>)).toContain('data-ex-theme="system"')
    expect(renderToString(<ThemeProvider defaultTheme="dark"><span /></ThemeProvider>)).toContain(
      'data-ex-theme="dark"',
    )
  })

  it('localStorage.getItem 抛错时正常渲染并使用 defaultTheme', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      render(<ThemeProvider defaultTheme="dark"><Probe /></ThemeProvider>)
      expect(root()).toHaveAttribute('data-ex-theme', 'dark')
      expect(screen.getByTestId('mode')).toHaveTextContent('dark')
    } finally {
      spy.mockRestore()
    }
  })

  it('localStorage.setItem 抛错时切换主题不抛错', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    try {
      render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
      await userEvent.click(screen.getByText('to-dark'))
      expect(root()).toHaveAttribute('data-ex-theme', 'dark')
    } finally {
      spy.mockRestore()
    }
  })

  it('Provider 外调用 useTheme 抛错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useTheme must be used within <ThemeProvider>')
  })
})

function ReadyProbe() {
  const { ready } = useTheme()
  return <span data-testid="ready">{`ready:${ready}`}</span>
}

function OptionalProbe() {
  const theme = useOptionalTheme()
  return <span data-testid="optional">{`optional:${theme ? theme.resolved : 'none'}`}</span>
}

const bodyPortals = () => document.querySelectorAll<HTMLElement>('body > .ex-root.ex-body-portal')

describe('ThemeProvider（阶段 3 补充）', () => {
  it('useOptionalTheme：Provider 外返回 null，内部返回上下文', () => {
    const { unmount } = render(<OptionalProbe />)
    expect(screen.getByTestId('optional')).toHaveTextContent('optional:none')
    unmount()
    render(<ThemeProvider defaultTheme="dark" storageKey={false}><OptionalProbe /></ThemeProvider>)
    expect(screen.getByTestId('optional')).toHaveTextContent('optional:dark')
  })

  it('ready：SSR 输出为 false，客户端挂载后为 true', () => {
    expect(renderToString(<ThemeProvider defaultTheme="light"><ReadyProbe /></ThemeProvider>)).toContain('ready:false')
    render(<ThemeProvider defaultTheme="light" storageKey={false}><ReadyProbe /></ThemeProvider>)
    expect(screen.getByTestId('ready')).toHaveTextContent('ready:true')
  })

  it('bodyPortalRoot：挂在 body 下、同步主题、卸载时移除；StrictMode 下只有一个', async () => {
    let captured: HTMLElement | null = null
    function Capture() {
      captured = useTheme().bodyPortalRoot
      return null
    }
    const { unmount } = render(
      <StrictMode>
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <Capture />
          <Probe />
        </ThemeProvider>
      </StrictMode>,
    )
    expect(bodyPortals()).toHaveLength(1)
    expect(captured).toBe(bodyPortals()[0])
    expect(bodyPortals()[0]).toHaveAttribute('data-ex-theme', 'light')
    await userEvent.click(screen.getByText('to-dark'))
    expect(bodyPortals()[0]).toHaveAttribute('data-ex-theme', 'dark')
    unmount()
    expect(bodyPortals()).toHaveLength(0)
  })

  it('切换主题时在两帧内标记 data-ex-theme-switching，随后移除', async () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    render(<ThemeProvider defaultTheme="light" storageKey={false}><Probe /></ThemeProvider>)
    frames.splice(0).forEach((cb) => cb(0))
    await userEvent.click(screen.getByText('to-dark'))
    expect(root()).toHaveAttribute('data-ex-theme-switching')
    expect(bodyPortals()[0]).toHaveAttribute('data-ex-theme-switching')
    act(() => frames.splice(0).forEach((cb) => cb(0)))
    expect(root()).toHaveAttribute('data-ex-theme-switching')
    act(() => frames.splice(0).forEach((cb) => cb(0)))
    expect(root()).not.toHaveAttribute('data-ex-theme-switching')
    expect(bodyPortals()[0]).not.toHaveAttribute('data-ex-theme-switching')
  })
})
