import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { ThemeProvider } from '@editorx/theme'
import type { ReactElement, ReactNode } from 'react'

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" storageKey={false}>
      {children}
    </ThemeProvider>
  )
}

export function renderWithTheme(ui: ReactElement, options?: RenderOptions): RenderResult {
  return render(ui, { wrapper: Wrapper, ...options })
}
