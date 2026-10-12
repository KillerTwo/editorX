'use client'

import '../quota-notice.css'
import './csdn.css'
import { CsdnEditor } from '@editorx/csdn'
import { csdnExtensions } from '@editorx/csdn-extensions'
import type { EditorExtension, EditorType } from '@editorx/toolbar'
import { useEffect, useMemo, useState } from 'react'
import { csdnHistoryExtension as markdownHistory, csdnMarketingExtension } from '../markdown/csdn-demo-extensions'
import { QuotaNotice } from '../quota-notice'
import { createPublishAdapters } from '../publish/mock-adapters'
import { csdnHistoryExtension as richHistory } from '../rich-text/stand-in-extensions'

const markdownExtensions: readonly EditorExtension[] = [...csdnExtensions, markdownHistory, csdnMarketingExtension]
const richTextExtensions: readonly EditorExtension[] = [...csdnExtensions, richHistory]

export function CsdnPlayground({
  editor,
  drawer,
  scroll,
}: {
  editor: EditorType
  drawer: string | null
  scroll: string | null
}) {
  const [editorType, setEditorType] = useState(editor)
  const [cardVisible, setCardVisible] = useState(false)
  const adapters = useMemo(
    () => ({
      ...createPublishAdapters({
        categories: false,
        onLog: (kind, data) => console.info(`[publish:${kind}] ${JSON.stringify(data)}`),
      }),
      async getTemplates() {
        return [
          { id: 'weekly', name: '周报模板', markdown: '# 本周工作\n\n- \n' },
          { id: 'card', name: '卡片模板', html: '<p>卡片</p>' },
        ]
      },
      async createVote(data: { title: string }) {
        return { id: `vote-${data.title}` }
      },
      async uploadVideo(file: File) {
        if (/fail/i.test(file.name)) throw new Error('模拟上传失败')
        return { url: 'https://cdn.example/video.mp4' }
      },
      async searchResources(keyword: string) {
        return [{ id: 'r1', title: `资源 ${keyword}`, url: 'https://cdn.example/res' }]
      },
      async runCode(lang: string) {
        return { url: `https://inscode.example/${encodeURIComponent(lang)}` }
      },
      async *aiAssist(prompt: string) {
        yield prompt.slice(0, 4)
        yield '已写完'
      },
    }),
    [],
  )

  useEffect(() => {
    const root = document.querySelector('.pg-csdn .ex-rte__scroll')
    const card = root?.querySelector('.ex-pub-card')
    if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return
    if (scroll === 'card') {
      const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top
      root.scrollTop += delta
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setCardVisible(entry.isIntersecting)
      },
      { root },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [scroll, editorType])

  const onJump = () => {
    const root = document.querySelector('.pg-csdn .ex-rte__scroll')
    const card = root?.querySelector('.ex-pub-card')
    if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return
    if (cardVisible) {
      root.scrollTop = 0
      return
    }
    const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top
    root.scrollTop += delta
  }

  return (
    <div className="pg-csdn">
      <CsdnEditor
        defaultTheme="light"
        defaultEditor={editor}
        onEditorTypeChange={setEditorType}
        extensions={editorType === 'richtext' ? richTextExtensions : markdownExtensions}
        adapters={adapters}
        autoSaveInterval={0}
        defaultRightOpen={drawer !== 'closed'}
        slots={{
          publishBarStart: (
            <>
              <button type="button" className="pg-csdn-jump" onClick={onJump}>
                {cardVisible ? '回到顶部' : '发文设置'}
              </button>
              <QuotaNotice />
            </>
          ),
          rightCollapsed: drawer === 'closed' ? <div className="pg-csdn-float">AI助手</div> : undefined,
        }}
      />
    </div>
  )
}
