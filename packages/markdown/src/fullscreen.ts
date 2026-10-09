/** 浮层容器（主题 portal、body 级 portal、Floating UI portal）保持可交互 */
const KEEP_INTERACTIVE = '.ex-portal, .ex-body-portal, [data-floating-ui-portal]'

/**
 * 全屏期间锁定页面滚动，并把编辑器根节点祖先链上的兄弟节点设为 inert，使 Tab 焦点留在编辑器与浮层内。
 * 返回的函数还原 overflow 与本次添加的 inert（原本就 inert 的节点不动）。
 * 限制：之后才挂到页面上的节点不会被 inert；祖先带 transform/filter/contain 时 position: fixed 无法铺满视口。
 */
export function isolateFullscreen(root: HTMLElement): () => void {
  const doc = root.ownerDocument
  const html = doc.documentElement
  const previousOverflow = html.style.overflow
  html.style.overflow = 'hidden'

  const inerted: Element[] = []
  for (let node: Element = root; node.parentElement && node !== doc.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute('inert') || sibling.matches(KEEP_INTERACTIVE)) continue
      if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE' || sibling.tagName === 'LINK') continue
      sibling.setAttribute('inert', '')
      inerted.push(sibling)
    }
  }

  return () => {
    html.style.overflow = previousOverflow
    for (const el of inerted) el.removeAttribute('inert')
  }
}
