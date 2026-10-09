import { Component, type ReactNode } from 'react'

export interface ExtensionErrorBoundaryProps {
  name: string
  onError(name: string, error: unknown): void
  /** 优先于 children；在边界内部调用，扩展 render 函数本身抛错也能被截获 */
  render?: () => ReactNode
  children?: ReactNode
}

function RenderSlot({ render }: { render: () => ReactNode }) {
  return <>{render()}</>
}

/** 隔离扩展 render 中的异常：出错后渲染为空并上报 */
export class ExtensionErrorBoundary extends Component<ExtensionErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(this.props.name, error)
  }

  render() {
    if (this.state.failed) return null
    const { render, children } = this.props
    return render ? <RenderSlot render={render} /> : children
  }
}
