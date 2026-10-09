/** 过早回收会让部分浏览器（旧版 Safari/Firefox）取消下载 */
export const REVOKE_DELAY = 10_000

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const revoke = URL.revokeObjectURL.bind(URL)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  // 旧版 Firefox 只响应挂在文档中的锚点
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    a.remove()
    setTimeout(() => revoke(url), REVOKE_DELAY)
  }
}

/**
 * 不支持 input 的 `cancel` 事件的浏览器里，用户取消选择时 Promise 永不 settle（仅保留一个闭包，无其他副作用）。
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}
