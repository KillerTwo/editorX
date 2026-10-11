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

/** 「定时发布」后的细箭头：svg 盒即墨迹盒（参考图 7×12） */
export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="7" height="12" viewBox="0 0 7 12" aria-hidden="true">
      <path d="M.5.5 6 6 .5 11.5" fill="none" stroke="currentColor" />
    </svg>
  )
}

/** 「AI提取摘要」前的魔棒：斜向描边棒身 + 三粒星点（参考图 14×14） */
export function WandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M.7 11.3 10.3 1.7l2 2-9.6 9.6zM8.3 3.7l2 2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.2.2h2v2h-2zM.8 4.3h2v2h-2zM10.8 7.3h1.6v2h-1.6z" fill="currentColor" />
    </svg>
  )
}

/** 标签面板关闭「×」：svg 盒即墨迹盒（参考图 10×10，描边约 1.4） */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M.7.7l8.6 8.6M9.3.7.7 9.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** 13.5×13.5 圆圈问号，描边 1.3（B08） */
export function HelpIcon() {
  return (
    <svg
      className="ex-pub-help-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="6.1" />
      <path d="M5.3 5.4a1.75 1.75 0 1 1 2.5 1.6c-.5.25-.8.6-.8 1.1v.4" />
      <circle cx="7" cy="10.3" r="0.35" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 上传框中的细「+」 */
export function PlusIcon({ size, className = 'ex-pub-plus' }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
