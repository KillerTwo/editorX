import { ThemeProvider } from '@editorx/theme'
import { render, type RenderResult } from '@testing-library/react'
import { StrictMode, type ReactElement, type ReactNode } from 'react'

function Providers({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider defaultTheme="light" storageKey={false}>
        {children}
      </ThemeProvider>
    </StrictMode>
  )
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: Providers })
}

/** 切换 process.env.TZ，返回恢复函数（原值为空时删除，避免写入字符串 'undefined'） */
export function setTimeZone(tz: string): () => void {
  const previous = process.env.TZ
  process.env.TZ = tz
  return () => {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}
