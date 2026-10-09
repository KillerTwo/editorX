import { createContext, useContext, type ReactNode } from 'react'

/**
 * 浮层都挂在同一个 .ex-portal 里，Modal 遮罩（--ex-z-modal）会盖住 --ex-z-popover 的浮层。
 * Modal 内打开的浮层根元素需追加此状态类，样式把它抬到遮罩之上、toast 之下。
 */
export const MODAL_LAYER_CLASS = 'is-in-modal'

const ModalLayerContext = createContext(false)

/** 标记子树位于 Modal 内；Modal 自动提供，自定义模态外壳也可使用 */
export function ModalLayer({ children }: { children: ReactNode }) {
  return <ModalLayerContext.Provider value>{children}</ModalLayerContext.Provider>
}

/** 浮层根元素应追加的层级类：Modal 内为 is-in-modal，否则 undefined */
export function useModalLayerClass(): string | undefined {
  return useContext(ModalLayerContext) ? MODAL_LAYER_CLASS : undefined
}
