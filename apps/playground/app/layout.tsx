import '@editorx/theme/styles.css'
import '@editorx/ui/styles.css'
import '@editorx/publish/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'EditorX Playground',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
