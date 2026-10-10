/** CSDN Markdown 外壳的自绘图标（墨迹尺寸按 mac 参考图实测，路径形状为推断） */

export function MarkdownModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="0.6" y="0.6" width="14.8" height="14.8" rx="3" />
      <path d="M6.5 5.5 4 8l2.5 2.5M9.5 5.5 12 8l-2.5 2.5" />
    </svg>
  )
}

export function SplitModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1.75" width="14" height="12.5" rx="1.5" />
      <path d="M8 1.75v12.5" />
    </svg>
  )
}

export function PreviewModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="10" rx="1.5" fill="currentColor" />
      <path d="M5 14.4h6M8 11v3.4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function StrikeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <path d="M11.4 3.6C10.9 2.4 9.6 1.6 8 1.6c-2 0-3.3 1.1-3.3 2.6 0 1.3.9 2.1 3 2.7" strokeLinecap="round" />
      <path d="M2.75 8h10.5" />
      <path d="M10.9 9.9c.4.4.6 1 .6 1.6 0 1.7-1.5 2.9-3.6 2.9-1.8 0-3.2-.8-3.8-2.2" strokeLinecap="round" />
    </svg>
  )
}

export function PanelToggleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <rect x="1.6" y="1.6" width="16.8" height="16.8" rx="2" />
      <path d="M13 1.6v16.8" />
      <path d="M15 6.5h1.4M15 10h1.4M15 13.5h1.4" strokeLinecap="round" />
    </svg>
  )
}

export function TocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3.5" width="3" height="2.5" rx="0.5" />
      <rect x="7" y="3.5" width="11" height="2.5" rx="0.5" />
      <rect x="2" y="8.75" width="3" height="2.5" rx="0.5" />
      <rect x="7" y="8.75" width="11" height="2.5" rx="0.5" />
      <rect x="2" y="14" width="3" height="2.5" rx="0.5" />
      <rect x="7" y="14" width="11" height="2.5" rx="0.5" />
    </svg>
  )
}

export function SyntaxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="2" />
      <path d="M8.5 11.5l-3 3M5.5 11.5v3h3M11.5 8.5l3-3M11.5 5.5h3v3" />
    </svg>
  )
}

export function LocateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <path d="M8 0.6V3M8 13v2.4M0.6 8H3M13 8h2.4" />
    </svg>
  )
}

export function SyncScrollIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 1.1h12M2 14.9h12" />
      <path d="M8 3.5v9M5.5 6 8 3.5 10.5 6M5.5 10 8 12.5 10.5 10" />
    </svg>
  )
}
