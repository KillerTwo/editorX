import { Component, type ReactNode } from 'react'

interface Props {
  name: string
  onError(name: string, error: unknown): void
  children: ReactNode
}

/** 隔离扩展 render 中的异常：出错后渲染为空并上报 */
export class ExtensionErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(this.props.name, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
