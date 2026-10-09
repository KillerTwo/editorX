import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from './resolve-theme'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode(mode: ThemeMode): void
  /** `.ex-root` 内的浮层容器 */
  portalRoot: HTMLElement | null
  /** `document.body` 下带同一主题的浮层容器，供无法渲染进 `.ex-root` 的第三方浮层使用 */
  bodyPortalRoot: HTMLElement | null
  /** 客户端挂载完成（系统主题已解析）后为 true */
  ready: boolean
}

export interface ThemeProviderProps {
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?: (mode: ThemeMode) => void
  storageKey?: string | false
  className?: string
  children: ReactNode
}

const DARK_QUERY = '(prefers-color-scheme: dark)'
const SWITCHING_ATTR = 'data-ex-theme-switching'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(key: string): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(key)
    return isThemeMode(stored) ? stored : null
  } catch {
    return null
  }
}

function writeStoredMode(key: string, mode: ThemeMode): void {
  try {
    window.localStorage.setItem(key, mode)
  } catch {
    // storage unavailable (private mode, quota): keep the in-memory theme only
  }
}

export function ThemeProvider({
  theme,
  defaultTheme = 'system',
  onThemeChange,
  storageKey = 'editorx-theme',
  className,
  children,
}: ThemeProviderProps) {
  const isControlled = theme !== undefined
  const [innerMode, setInnerMode] = useState<ThemeMode>(defaultTheme)
  const [systemDark, setSystemDark] = useState(false)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const [bodyPortalRoot, setBodyPortalRoot] = useState<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const mode = isControlled ? theme : innerMode
  const resolved = resolveTheme(mode, systemDark)
  const appliedTheme = !mounted && mode === 'system' ? 'system' : resolved
  const previousTheme = useRef(appliedTheme)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isControlled || !storageKey) return
    const stored = readStoredMode(storageKey)
    if (stored) setInnerMode(stored)
  }, [isControlled, storageKey])

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY)
    setSystemDark(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'ex-root ex-body-portal'
    document.body.appendChild(el)
    setBodyPortalRoot(el)
    return () => {
      el.remove()
      setBodyPortalRoot(null)
    }
  }, [])

  useEffect(() => {
    bodyPortalRoot?.setAttribute('data-ex-theme', appliedTheme)
  }, [bodyPortalRoot, appliedTheme])

  // Colours would otherwise animate through every `transition` declared on themed elements.
  useEffect(() => {
    if (previousTheme.current === appliedTheme) return
    previousTheme.current = appliedTheme
    const targets = [rootRef.current, bodyPortalRoot].filter((el): el is HTMLElement => el !== null)
    for (const el of targets) el.setAttribute(SWITCHING_ATTR, '')
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        for (const el of targets) el.removeAttribute(SWITCHING_ATTR)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      for (const el of targets) el.removeAttribute(SWITCHING_ATTR)
    }
  }, [appliedTheme, bodyPortalRoot])

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (!isControlled) {
        setInnerMode(next)
        if (storageKey) writeStoredMode(storageKey, next)
      }
      onThemeChange?.(next)
    },
    [isControlled, storageKey, onThemeChange],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, portalRoot, bodyPortalRoot, ready: mounted }),
    [mode, resolved, setMode, portalRoot, bodyPortalRoot, mounted],
  )

  return (
    <ThemeContext.Provider value={value}>
      <div ref={rootRef} className={className ? `ex-root ${className}` : 'ex-root'} data-ex-theme={appliedTheme}>
        {children}
        <div className="ex-portal" ref={setPortalRoot} />
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}

/** 与 useTheme 相同，但在 Provider 外返回 null（用于「有外层主题就复用」的组件） */
export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext)
}
