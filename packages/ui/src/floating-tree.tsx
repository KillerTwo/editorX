import { FloatingTree, useFloatingParentNodeId } from '@floating-ui/react'
import type { ComponentType } from 'react'

/**
 * 没有外层浮层时自建一棵 FloatingTree，让嵌套在其中的浮层（如 Modal 里的 Dropdown）
 * 共享父子关系：Esc 只关最内层，子浮层内的点击不算父浮层的外部点击。
 */
export function withFloatingTree<P extends object>(Inner: ComponentType<P>, displayName: string): ComponentType<P> {
  function WithFloatingTree(props: P) {
    const parentId = useFloatingParentNodeId()
    if (parentId === null) {
      return (
        <FloatingTree>
          <Inner {...props} />
        </FloatingTree>
      )
    }
    return <Inner {...props} />
  }
  WithFloatingTree.displayName = displayName
  return WithFloatingTree
}
