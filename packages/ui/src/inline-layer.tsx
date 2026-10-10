import {
  FloatingNode,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingTree,
  useInteractions,
} from '@floating-ui/react'
import { useEffect, useRef, type HTMLAttributes } from 'react'
import { withFloatingTree } from './floating-tree'

export interface InlineLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** 按 Esc 时调用；点击外部不调用 */
  onDismiss(): void
}

/**
 * 在正常流中渲染、登记为当前浮层树子节点的容器：外层 Modal 等浮层按 Esc 时
 * 发现它仍打开就不关闭自己，由它先关闭（与 DatePicker 面板同一机制）。
 */
function InlineLayerInner({ onDismiss, children, ...rest }: InlineLayerProps) {
  const nodeId = useFloatingNodeId()
  const tree = useFloatingTree()
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })
  const { refs, context, elements } = useFloating({
    nodeId,
    open: true,
    onOpenChange: (next) => {
      if (!next) dismissRef.current()
    },
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: false, bubbles: { escapeKey: false } }),
  ])

  // 焦点不在层内时 useDismiss 收不到 Esc：外层 Modal 看到打开的子节点就放弃关闭，
  // 而焦点在 body 时浏览器会在两个 document 监听之间刷新 React，导致两层一起关。
  // 因此有祖先浮层时在捕获阶段先处理，除非焦点在其他（非祖先）浮层里——那由该浮层自己处理。
  // 没有祖先时不拦截：层外控件自己的 Esc 处理（如全屏退出）照常收到，useDismiss 的 document 监听随后关闭本层。
  useEffect(() => {
    const layer = elements.floating
    if (!layer) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      const target = event.target as Node
      if (layer.contains(target)) return
      const portal = target instanceof Element ? target.closest('[data-floating-ui-portal]') : null
      if (portal && !portal.contains(layer)) return
      const nodes = tree?.nodesRef.current ?? []
      const parentOf = (id: string | null | undefined) => nodes.find((n) => n.id === id)?.parentId
      const ancestors = new Set<string | undefined>()
      for (let id = parentOf(nodeId); id; id = parentOf(id)) ancestors.add(id)
      const inOtherLayer = nodes.some(
        (n) => n.id !== nodeId && !ancestors.has(n.id) && n.context?.open && n.context.elements.floating?.contains(target),
      )
      if (inOtherLayer || ancestors.size === 0) return
      event.stopPropagation()
      dismissRef.current()
    }
    const doc = layer.ownerDocument
    doc.addEventListener('keydown', onKeyDown, true)
    return () => doc.removeEventListener('keydown', onKeyDown, true)
  }, [elements.floating, nodeId, tree])

  return (
    <FloatingNode id={nodeId}>
      <div ref={refs.setFloating} {...getFloatingProps(rest)}>
        {children}
      </div>
    </FloatingNode>
  )
}

export const InlineLayer = withFloatingTree(InlineLayerInner, 'InlineLayer')
