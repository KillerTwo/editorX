/** CSDN 发文额度提示：填充圆形「i」图标 18×18 + 单行文字（G08/G15/G32、B37） */
export function QuotaNotice({ remaining = 5, href = '#quota' }: { remaining?: number; href?: string }) {
  return (
    <span className="pg-quota">
      <svg className="pg-quota__icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="9" fill="currentColor" />
        <path d="M9 8v5" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: 'var(--ex-color-on-primary)' }} />
        <circle cx="9" cy="5.2" r="1" style={{ fill: 'var(--ex-color-on-primary)' }} />
      </svg>
      <span>
        今日发文额度还有 <em>{remaining}</em> 篇，<a href={href}>可去这里提升额度</a>
      </span>
    </span>
  )
}
