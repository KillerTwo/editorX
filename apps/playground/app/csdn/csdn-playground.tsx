'use client'

import '../quota-notice.css'
import './csdn.css'
import { CsdnEditor } from '@editorx/csdn'
import type { EditorExtension, EditorType } from '@editorx/toolbar'
import { useEffect, useMemo, useState } from 'react'
import { csdnDemoExtensions } from '../markdown/csdn-demo-extensions'
import { QuotaNotice } from '../quota-notice'
import { createPublishAdapters } from '../publish/mock-adapters'
import {
  csdnAiExtension,
  csdnHistoryExtension,
  csdnResourceExtension,
  csdnTemplateExtension,
  csdnVideoExtension,
} from '../rich-text/stand-in-extensions'

const richTextExtensions: readonly EditorExtension[] = [
  csdnHistoryExtension,
  csdnResourceExtension,
  csdnVideoExtension,
  csdnTemplateExtension,
  csdnAiExtension,
]

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
    () => createPublishAdapters({ categories: false, onLog: (kind, data) => console.info(`[publish:${kind}] ${JSON.stringify(data)}`) }),
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
        extensions={editorType === 'richtext' ? richTextExtensions : csdnDemoExtensions}
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
