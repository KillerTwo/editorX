import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { createRef, StrictMode, type ReactNode, type RefObject } from 'react'
import { MarkdownEditor } from './markdown-editor'
import type { MarkdownEditorHandle, MarkdownEditorProps } from './types'

/** 组件测试统一在 StrictMode 下渲染（rerender 沿用 wrapper） */
export const strict: RenderOptions = { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> }

export interface RenderedEditor extends RenderResult {
  ref: RefObject<MarkdownEditorHandle | null>
  handle(): MarkdownEditorHandle
}

export function renderEditor(props: MarkdownEditorProps = {}): RenderedEditor {
  const ref = createRef<MarkdownEditorHandle>()
  const utils = render(<MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} {...props} />, strict)
  return { ...utils, ref, handle: () => ref.current! }
}

export const editorContent = () => document.querySelector<HTMLElement>('.ex-editor-content')!
export const previewEl = () => document.querySelector<HTMLElement>('.ex-mde-preview')!
export const editorRoot = () => document.querySelector<HTMLElement>('.ex-mde')!
