export const FAILED_CLASS = 'ex-mde-upload-failed'

/** 占位地址的协议会被净化器去掉，预览里的失败占位只剩 alt：按无 src 且 alt 等于失败文案识别 */
export function markFailedPlaceholders(root: HTMLElement, label: string): void {
  for (const img of root.querySelectorAll('img:not([src])')) {
    img.classList.toggle(FAILED_CLASS, img.getAttribute('alt') === label)
  }
}

export function observeFailedPlaceholders(root: HTMLElement, getLabel: () => string): () => void {
  const mark = () => markFailedPlaceholders(root, getLabel())
  mark()
  const observer = new MutationObserver(mark)
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}
