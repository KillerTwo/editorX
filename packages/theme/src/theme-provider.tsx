import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from './resolve-theme'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode(mode: ThemeMode): void
  portalRoot: HTMLElement | null
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
  const [mounted, setMounted] = useState(false)
  const mode = isControlled ? theme : innerMode

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

  const resolved = resolveTheme(mode, systemDark)
  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, portalRoot }),
    [mode, resolved, setMode, portalRoot],
  )

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={className ? `ex-root ${className}` : 'ex-root'}
        data-ex-theme={!mounted && mode === 'system' ? 'system' : resolved}
      >
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
