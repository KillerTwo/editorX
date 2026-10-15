import '@geekx/theme/styles.css'
import '@geekx/ui/styles.css'
import '@geekx/publish/styles.css'
import '@geekx/rich-text/styles.css'
import '@geekx/csdn-extensions/styles.css'
import '@geekx/csdn/styles.css'
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
