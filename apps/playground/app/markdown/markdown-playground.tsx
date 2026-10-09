'use client'

import { MarkdownEditor, type MarkdownEditorHandle, type ViewMode } from '@editorx/markdown'
import { ThemeProvider } from '@editorx/theme'
import { Button, ThemeToggle } from '@editorx/ui'
import { ArrowLeftRight, ChevronDown, CircleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from '../markdown-core/sample'
import { csdnDemoExtensions } from './csdn-demo-extensions'
import { CSDN_SAMPLE, CSDN_TITLE } from './csdn-sample'
import { createMockAdapters } from './mock-adapters'

export interface MarkdownPlaygroundProps {
  fixture: 'sample' | 'csdn'
  view: ViewMode
  panel: string | null
  /** 0 为关闭自动保存 */
  autosave: number
}

function Playground({ fixture, view, panel, autosave }: MarkdownPlaygroundProps) {
  const ref = useRef<MarkdownEditorHandle>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [changes, setChanges] = useState(0)
  const [saves, setSaves] = useState(0)
  const adapters = useMemo(() => createMockAdapters(() => setSaves((n) => n + 1)), [])
  const title = fixture === 'csdn' ? CSDN_TITLE : 'EditorX 示例文档'

  return (
    <div className="pg-mde">
      <header className="pg-mde__topbar">
        <strong className="pg-mde__brand">EditorX</strong>
        <span className="pg-mde__title">{title}</span>
        <div className="pg-mde__controls">
          <label className="pg-mde__check">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            只读
          </label>
          <Button size="sm" onClick={() => ref.current?.setValue(generateLargeDoc(10000))}>
            加载 10k 行文档
          </Button>
          <span data-testid="change-count">变更 {changes}</span>
          <span data-testid="save-count">保存 {saves}</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="pg-mde__frame">
        <MarkdownEditor
          ref={ref}
          defaultValue={fixture === 'csdn' ? CSDN_SAMPLE : SAMPLE}
          title={title}
          defaultViewMode={view}
          defaultPanel={panel}
          readOnly={readOnly}
          adapters={adapters}
          extensions={csdnDemoExtensions}
          autoSaveInterval={autosave}
          onChange={() => setChanges((n) => n + 1)}
          slots={{
            headerEnd: (
              <button type="button" className="pg-mde-switch">
                <ArrowLeftRight size={14} aria-hidden="true" />
                使用富文本编辑器
              </button>
            ),
            statusCenter: (
              <span className="pg-mde-quota">
                <CircleAlert size={16} aria-hidden="true" />
                今日发文额度还有 <em>5</em> 篇，<a href="#quota">可去这里提升额度</a>
              </span>
            ),
            statusEnd: (
              <>
                <button type="button" className="pg-mde-draft" onClick={() => void ref.current?.saveDraft()}>
                  保存草稿
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <Button variant="primary" className="pg-mde-publish" onClick={() => console.info(ref.current?.getDocument())}>
                  发布文章
                </Button>
              </>
            ),
          }}
        />
      </div>
    </div>
  )
}

export function MarkdownPlayground(props: MarkdownPlaygroundProps) {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <Playground {...props} />
    </ThemeProvider>
  )
}
