import { renderDiagrams } from '@editorx/markdown-core'

export const EXPORT_DIAGRAM_TIMEOUT = 10_000

/** 出错的图表块还原为空占位，exportHtml 会把占位转成源码代码块 */
function resetFailedDiagrams(container: HTMLElement): void {
  for (const block of container.querySelectorAll<HTMLElement>('.ex-mermaid--error, .ex-flowchart--error')) {
    const placeholder = document.createElement('div')
    // 属性顺序须为 class、data-ex-diagram，与 exportHtml 的占位匹配规则一致
    placeholder.className = block.classList.contains('ex-mermaid') ? 'ex-mermaid' : 'ex-flowchart'
    placeholder.dataset.exDiagram = block.dataset.exDiagram ?? ''
    block.replaceWith(placeholder)
  }
}

/** 在离屏副本上补画图表；超时或失败时未画成的块保持占位，导出为源码 */
export async function drawDiagramsForExport(
  html: string,
  theme: 'light' | 'dark',
  timeout = EXPORT_DIAGRAM_TIMEOUT,
): Promise<string> {
  const container = document.createElement('div')
  container.innerHTML = html
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[editorx/markdown] 导出时图表渲染超过 ${timeout}ms，未完成的图表以源码导出`)
      resolve()
    }, timeout)
  })
  try {
    await Promise.race([renderDiagrams(container, { theme }), expired])
  } catch (error) {
    console.error('[editorx/markdown] 导出时图表渲染失败', error)
  } finally {
    clearTimeout(timer)
  }
  // 超时后仍在进行的渲染继续改动 container，不影响这里取出的快照
  const snapshot = document.createElement('div')
  snapshot.innerHTML = container.innerHTML
  resetFailedDiagrams(snapshot)
  return snapshot.innerHTML
}
