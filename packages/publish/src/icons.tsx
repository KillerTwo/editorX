/** 「原创」后的绿色认证盾牌（参考图 9px 宽） */
export function VerifiedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
      <path d="M6 0 12 2.2V7c0 3.3-2.5 5.9-6 7C2.5 12.9 0 10.3 0 7V2.2z" fill="currentColor" />
      <path d="m3.2 7 2 2 3.6-3.8" fill="none" stroke="var(--ex-color-surface)" strokeWidth="1.4" />
    </svg>
  )
}

/** 「保存草稿」后的实心下三角 */
export function CaretDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M0 0h10L5 6z" fill="currentColor" />
    </svg>
  )
}

/** 上传框中的细「+」 */
export function PlusIcon({ size }: { size: number }) {
  return (
    <svg className="ex-pub-plus" width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
