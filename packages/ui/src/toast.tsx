import { useTheme } from '@editorx/theme'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastApi {
  notify(message: ReactNode, type?: ToastType, duration?: number): void
}

export interface ToastProviderProps {
  duration?: number
  children: ReactNode
}

interface ToastItem {
  id: number
  message: ReactNode
  type: ToastType
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ duration = 3000, children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())
  const { portalRoot } = useTheme()

  const remove = useCallback((id: number) => {
    timers.current.delete(id)
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (message: ReactNode, type: ToastType = 'info', itemDuration: number = duration) => {
      const id = ++nextId.current
      setItems((list) => [...list, { id, message, type }])
      timers.current.set(id, window.setTimeout(() => remove(id), itemDuration))
    },
    [duration, remove],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portalRoot &&
        createPortal(
          <div className="ex-toast-stack" aria-live="polite">
            {items.map((item) => (
              <div key={item.id} role="status" className={`ex-toast ex-toast--${item.type}`}>
                {item.message}
              </div>
            ))}
          </div>,
          portalRoot,
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
