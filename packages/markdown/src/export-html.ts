import { renderDiagrams } from '@editorx/markdown-core'

export const EXPORT_DIAGRAM_TIMEOUT = 10_000

/** 导出页独立打开，没有 --ex-* 变量：只给最基本的排版，颜色用系统色以跟随亮/暗 */
export const EXPORT_PAGE_CSS = `
:root { color-scheme: light dark; }
body { margin: 0; background: Canvas; color: CanvasText; }
.ex-preview { box-sizing: border-box; max-width: 860px; margin: 0 auto; padding: 32px 24px; font: 16px/1.75 -apple-system, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif; overflow-wrap: break-word; }
.ex-preview img, .ex-preview svg { max-width: 100%; }
.ex-preview code, .ex-preview pre { font-family: Consolas, Monaco, 'Andale Mono', monospace; }
.ex-preview pre { padding: 12px 16px; overflow: auto; border: 1px solid GrayText; border-radius: 4px; font-size: 14px; line-height: 1.6; }
.ex-preview blockquote { margin: 0 0 1em; padding: 0 1em; border-left: 4px solid GrayText; color: GrayText; }
.ex-preview table { border-collapse: collapse; }
.ex-preview th, .ex-preview td { padding: 6px 12px; border: 1px solid GrayText; }
`.trim()

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
