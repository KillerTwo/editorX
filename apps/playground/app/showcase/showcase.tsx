'use client'

import { ThemeProvider } from '@geekx/theme'
import {
  Button,
  Dropdown,
  Modal,
  Popover,
  Tabs,
  Tag,
  ThemeToggle,
  ToastProvider,
  Tooltip,
  useToast,
} from '@geekx/ui'
import { Bold, Heading, Upload } from 'lucide-react'
import { useState } from 'react'

const articleTypes = [
  { key: 'original', label: '原创' },
  { key: 'reprint', label: '转载' },
  { key: 'translated', label: '翻译' },
]

function Sections() {
  const { notify } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [tags, setTags] = useState(['React', 'Next.js', '前端'])
  const [articleType, setArticleType] = useState('original')
  const [heading, setHeading] = useState('未选择')

  return (
    <>
      <section className="pg-section">
        <h2>Button</h2>
        <div className="pg-row">
          <Button variant="primary">发布文章</Button>
          <Button>保存草稿</Button>
          <Button variant="text" icon={<Upload size={16} />}>上传</Button>
          <Button size="sm">小按钮</Button>
          <Button size="lg">大按钮</Button>
          <Button loading>保存中</Button>
          <Button disabled>禁用</Button>
        </div>
      </section>

      <section className="pg-section">
        <h2>Tag</h2>
        <div className="pg-row">
          {tags.map((tag) => (
            <Tag key={tag} closable onClose={() => setTags((list) => list.filter((t) => t !== tag))}>
              {tag}
            </Tag>
          ))}
        </div>
      </section>

      <section className="pg-section">
        <h2>Tooltip / Popover / Dropdown</h2>
        <div className="pg-row">
          <Tooltip content="加粗 Ctrl+B">
            <Button variant="text" icon={<Bold size={16} />} aria-label="加粗" />
          </Tooltip>
          <Popover content={(close) => (
            <div className="pg-row">
              <span>表格 3 × 4</span>
              <Button size="sm" variant="primary" onClick={close}>插入</Button>
            </div>
          )}>
            <Button>表格</Button>
          </Popover>
          <Dropdown
            items={[
              { key: 'h1', label: '一级标题' },
              { key: 'h2', label: '二级标题' },
              { key: 'h3', label: '三级标题' },
            ]}
            onSelect={setHeading}
          >
            <Button icon={<Heading size={16} />}>标题</Button>
          </Dropdown>
          <span>已选：{heading}</span>
        </div>
      </section>

      <section className="pg-section">
        <h2>Tabs</h2>
        <Tabs items={articleTypes} activeKey={articleType} onChange={setArticleType} />
      </section>

      <section className="pg-section">
        <h2>Modal / Toast</h2>
        <div className="pg-row">
          <Button onClick={() => setModalOpen(true)}>打开弹窗</Button>
          <Button onClick={() => notify('草稿已保存', 'success')}>显示提示</Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="插入投票"
          footer={
            <>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>确定</Button>
            </>
          }
        >
          这里是投票表单。
        </Modal>
      </section>
    </>
  )
}

export function Showcase() {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <ToastProvider>
        <main className="pg-page">
          <header className="pg-header">
            <h1>EditorX 组件展示</h1>
            <ThemeToggle />
          </header>
          <Sections />
        </main>
      </ToastProvider>
    </ThemeProvider>
  )
}
