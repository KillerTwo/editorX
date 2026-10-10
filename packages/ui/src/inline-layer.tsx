import { FloatingNode, useDismiss, useFloating, useFloatingNodeId, useInteractions } from '@floating-ui/react'
import type { HTMLAttributes } from 'react'
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
  const { refs, context } = useFloating({
    nodeId,
    open: true,
    onOpenChange: (next) => {
      if (!next) onDismiss()
    },
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: false, bubbles: { escapeKey: false } }),
  ])
  return (
    <FloatingNode id={nodeId}>
      <div ref={refs.setFloating} {...getFloatingProps(rest)}>
        {children}
      </div>
    </FloatingNode>
  )
}

export const InlineLayer = withFloatingTree(InlineLayerInner, 'InlineLayer')
