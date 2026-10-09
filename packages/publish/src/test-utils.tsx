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
