import type { RichTextEditorProps } from './types'

export function RichTextEditor({ className, height = '100%' }: RichTextEditorProps) {
  return (
    <div className={className ? `ex-rte ${className}` : 'ex-rte'} data-editor="rich-text" style={{ height }}>
      <div className="ex-rte__scroll" />
    </div>
  )
}
