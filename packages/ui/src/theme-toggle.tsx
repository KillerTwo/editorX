import { useTheme } from '@editorx/theme'
import { Moon, Sun } from 'lucide-react'
import { Button } from './button'

export interface ThemeToggleProps {
  labels?: { toLight: string; toDark: string }
  className?: string
}

const DEFAULT_LABELS = { toLight: '切换到明亮模式', toDark: '切换到暗黑模式' }

export function ThemeToggle({ labels = DEFAULT_LABELS, className }: ThemeToggleProps) {
  const { resolved, setMode } = useTheme()
  const isDark = resolved === 'dark'
  return (
    <Button
      variant="text"
      className={className ? `ex-theme-toggle ${className}` : 'ex-theme-toggle'}
      aria-label={isDark ? labels.toLight : labels.toDark}
      title={isDark ? labels.toLight : labels.toDark}
      icon={isDark ? <Sun size={16} /> : <Moon size={16} />}
      onClick={() => setMode(isDark ? 'light' : 'dark')}
    />
  )
}
