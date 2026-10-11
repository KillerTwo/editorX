'use client'

import { MarkdownEditor, type MarkdownEditorHandle, type ViewMode } from '@editorx/markdown'
import { PublishModal } from '@editorx/publish'
import { ThemeProvider } from '@editorx/theme'
import type { EditorAdapters, EditorDocument } from '@editorx/toolbar'
import { Button, ThemeToggle } from '@editorx/ui'
import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from '../markdown-core/sample'
import { QuotaNotice } from '../quota-notice'
import { createPublishAdapters } from '../publish/mock-adapters'
import { csdnDemoExtensions } from './csdn-demo-extensions'
import { CSDN_SAMPLE, CSDN_TITLE } from './csdn-sample'
import { createMockAdapters } from './mock-adapters'

export interface MarkdownPlaygroundProps {
  fixture: 'sample' | 'csdn' | 'test'
  view: ViewMode
  panel: string | null
  /** 0 为关闭自动保存 */
  autosave: number
  /** 首屏自动打开发布弹窗（/compare 对照 12-36-37 用） */
  publish: boolean
}

function Playground({ fixture, view, panel, autosave, publish }: MarkdownPlaygroundProps) {
  const ref = useRef<MarkdownEditorHandle>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [changes, setChanges] = useState(0)
  const [saves, setSaves] = useState(0)
  const [publishDoc, setPublishDoc] = useState<EditorDocument | null>(null)
  const adapters = useMemo<EditorAdapters>(() => {
    const { onPublish, searchTags, getCategories, getActivities, getTopics } = createPublishAdapters({
      categories: false,
      onLog: (kind, data) => console.info(`[publish:${kind}] ${JSON.stringify(data)}`),
    })
    return {
      ...createMockAdapters(() => setSaves((n) => n + 1)),
      onPublish,
      searchTags,
      getCategories,
      getActivities,
      getTopics,
    }
  }, [])
  const openPublish = () => setPublishDoc(ref.current?.getDocument() ?? null)

  useEffect(() => {
    if (publish) setPublishDoc(ref.current?.getDocument() ?? null)
  }, [publish])
  const title = fixture === 'sample' ? 'EditorX 示例文档' : CSDN_TITLE

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
          defaultValue={fixture === 'csdn' ? CSDN_SAMPLE : fixture === 'test' ? 'test' : SAMPLE}
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
                <SwitchIcon />
                使用富文本编辑器
              </button>
            ),
            statusCenter: <QuotaNotice />,
            statusEnd: (
              <>
                <button type="button" className="pg-mde-draft" onClick={() => void ref.current?.saveDraft()}>
                  保存草稿
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <Button variant="primary" className="pg-mde-publish" onClick={openPublish}>
                  发布文章
                </Button>
              </>
            ),
          }}
        />
      </div>
      <PublishModal
        open={publishDoc !== null}
        onClose={() => setPublishDoc(null)}
        document={publishDoc ?? undefined}
        adapters={adapters}
      />
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

/** ⇄ 13×13：上箭头向右、下箭头向左（G28） */
function SwitchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 4h11M9 1l3 3-3 3" />
      <path d="M12 9H1M4 6 1 9l3 3" />
    </svg>
  )
}
