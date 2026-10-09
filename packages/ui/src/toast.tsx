import { useTheme } from '@editorx/theme'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastApi {
  notify(message: ReactNode, type?: ToastType, duration?: number): void
}

export interface ToastProviderProps {
  duration?: number
  closeLabel?: string
  children: ReactNode
}

interface ToastItem {
  id: number
  message: ReactNode
  type: ToastType
  duration: number
}

const ToastContext = createContext<ToastApi | null>(null)

function ToastView({ item, closeLabel, onDone }: { item: ToastItem; closeLabel: string; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(item.id), item.duration)
    return () => window.clearTimeout(timer)
  }, [item.id, item.duration, onDone])

  return (
    <div role={item.type === 'error' ? 'alert' : 'status'} className={`ex-toast ex-toast--${item.type}`}>
      <span className="ex-toast__message">{item.message}</span>
      <button type="button" className="ex-toast__close" aria-label={closeLabel} onClick={() => onDone(item.id)}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ duration = 3000, closeLabel = '关闭', children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const { portalRoot } = useTheme()

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (message: ReactNode, type: ToastType = 'info', itemDuration: number = duration) => {
      const id = ++nextId.current
      setItems((list) => [...list, { id, message, type, duration: itemDuration }])
    },
    [duration],
  )

  const api = useMemo<ToastApi>(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portalRoot &&
        createPortal(
          <div className="ex-toast-stack">
            {items.map((item) => (
              <ToastView key={item.id} item={item} closeLabel={closeLabel} onDone={remove} />
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
