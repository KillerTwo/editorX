'use client'

import '../quota-notice.css'
import './rich-text.css'
import { PublishPanel } from '@geekx/publish'
import { RichTextEditor } from '@geekx/rich-text'
import { formatMessage, zhCN } from '@geekx/toolbar'
import { useEffect, useMemo, useState } from 'react'
import { QuotaNotice } from '../quota-notice'
import { createPublishAdapters } from '../publish/mock-adapters'
import { richTextStandInExtensions } from './stand-in-extensions'

export interface RichTextPlaygroundProps {
  drawer: string | null
  scroll: string | null
}

function scrollRoot(): HTMLElement | null {
  const root = document.querySelector('.pg-rte .ex-rte__scroll')
  return root instanceof HTMLElement ? root : null
}

function alignCard(root: HTMLElement) {
  const card = root.querySelector('.ex-pub-card')
  if (!(card instanceof HTMLElement)) return
  const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top
  root.scrollTop += delta
}

export function RichTextPlayground({ drawer, scroll }: RichTextPlaygroundProps) {
  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const [words, setWords] = useState(0)
  const [cardVisible, setCardVisible] = useState(false)
  const adapters = useMemo(
    () =>
      createPublishAdapters({
        categories: false,
        onLog: (kind, data) => console.info(`[publish:${kind}] ${JSON.stringify(data)}`),
      }),
    [],
  )

  useEffect(() => {
    const root = scrollRoot()
    const card = root?.querySelector('.ex-pub-card')
    if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return
    if (scroll === 'card') alignCard(root)
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setCardVisible(entry.isIntersecting)
      },
      { root },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [scroll])

  const onJump = () => {
    const root = scrollRoot()
    if (!root) return
    if (cardVisible) {
      root.scrollTop = 0
      return
    }
    alignCard(root)
  }

  return (
    <div className="pg-rte">
      <RichTextEditor
        defaultRightOpen={drawer !== 'closed'}
        extensions={richTextStandInExtensions}
        onChange={setHtml}
        onTitleChange={setTitle}
        onWordCount={setWords}
        slots={{
          afterPaper: (
            <PublishPanel
              document={{ editorType: 'richtext', title, html }}
              adapters={adapters}
              barPosition="fixed"
              slots={{
                barStart: (
                  <>
                    <span className="pg-rte-count">{formatMessage(zhCN.richText.words, { n: words })}</span>
                    <button type="button" className="pg-rte-jump" onClick={onJump}>
                      {cardVisible ? '回到顶部' : '发文设置'}
                    </button>
                    <QuotaNotice />
                  </>
                ),
              }}
            />
          ),
          rightCollapsed: <div className="pg-rte-float">AI助手</div>,
        }}
      />
    </div>
  )
}
