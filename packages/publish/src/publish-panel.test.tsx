import { zhCN, type EditorAdapters, type EditorDocument, type PublishSettings } from '@editorx/toolbar'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PublishModal, PublishPanel } from './publish-panel'
import { renderWithProviders } from './test-utils'

const doc: EditorDocument = {
  editorType: 'markdown',
  title: '一篇测试文章标题',
  markdown: '正文',
  html: '<p>正文内容</p><img src="/a.png">',
}

function adapters(extra: Partial<EditorAdapters> = {}): EditorAdapters {
  return {
    onPublish: vi.fn(async () => {}),
    onSaveDraft: vi.fn(async () => {}),
    searchTags: vi.fn(async () => ['React']),
    getCategories: vi.fn(async () => [{ id: 'c1', name: '前端' }]),
    getActivities: vi.fn(async () => [{ id: 'a1', name: '征文' }]),
    getTopics: vi.fn(async () => [{ id: 't1', name: '话题一' }]),
    uploadImage: vi.fn(async () => ({ url: '/u.png' })),
    ...extra,
  }
}

const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)))

/** onPublished 抛出的异常会作为未处理的 rejection 交给调用方，这里临时接住以免判定为测试失败 */
async function collectUnhandledRejections(run: () => Promise<void>): Promise<unknown[]> {
  const caught: unknown[] = []
  const saved = process.listeners('unhandledRejection')
  const onRejection = (reason: unknown) => caught.push(reason)
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', onRejection)
  try {
    await run()
    await vi.waitFor(() => expect(caught).toHaveLength(1))
  } finally {
    process.off('unhandledRejection', onRejection)
    for (const listener of saved) process.on('unhandledRejection', listener)
  }
  return caught
}

const LABELS = ['文章标签', '添加封面', '文章摘要', '分类专栏', '文章类型', '创作声明', '文章备份', '可见范围', '文章模板', '多平台发布', '参与活动']

describe('文章模板默认列表', () => {
  const moyan = () => screen.getByRole('radio', { name: '墨衍模板' })

  it('Markdown 文档：墨衍模板可选', () => {
    renderWithProviders(<PublishPanel document={doc} adapters={adapters()} />)
    expect(moyan()).toBeEnabled()
  })

  it('富文本文档或未传文档：墨衍模板禁用', () => {
    const { unmount } = renderWithProviders(
      <PublishPanel document={{ editorType: 'richtext', title: '富文本', html: '<p>正文</p>' }} adapters={adapters()} />,
    )
    expect(moyan()).toBeDisabled()
    unmount()
    renderWithProviders(<PublishPanel adapters={adapters()} />)
    expect(moyan()).toBeDisabled()
  })

  it('显式传入 templates 时以其为准', () => {
    const templates = [
      { id: 'default', name: '默认模板' },
      { id: 'moyan', name: '墨衍模板', disabled: true },
    ]
    const { unmount } = renderWithProviders(<PublishPanel document={doc} adapters={adapters()} templates={templates} />)
    expect(moyan()).toBeDisabled()
    expect(screen.queryByRole('radio', { name: '简洁模板' })).toBeNull()
    unmount()
    renderWithProviders(
      <PublishPanel
        document={{ editorType: 'richtext', title: '富文本', html: '<p>正文</p>' }}
        adapters={adapters()}
        templates={[{ id: 'moyan', name: '墨衍模板' }]}
      />,
    )
    expect(moyan()).toBeEnabled()
  })
})

describe('PublishPanel（内联）', () => {
  it('按 CSDN 顺序渲染全部字段与底部操作栏', async () => {
    const { container } = renderWithProviders(<PublishPanel document={doc} adapters={adapters()} />)
    expect(screen.getByRole('region', { name: '发布设置' })).toHaveClass('ex-pub')
    const labels = [...container.querySelectorAll('.ex-pub-item__text')].map((n) => n.textContent)
    expect(labels).toEqual(LABELS)
    expect(container.querySelector('[data-field="activity"] .ex-pub-item__suffix')).toHaveTextContent('/话题')
    expect(await screen.findByRole('checkbox', { name: '前端' })).toBeInTheDocument()
    const bar = within(container.querySelector('.ex-pub-bar')!)
    expect(bar.getAllByRole('button').map((b) => b.textContent)).toEqual(['保存草稿', '定时发布', '发布博客'])
    expect(screen.getByRole('textbox', { name: '文章摘要' })).toHaveAttribute(
      'placeholder',
      zhCN.publish.summary.placeholderInline,
    )
  })

  it('非受控：defaultValue 生效并回调 onChange；受控：跟随 value', async () => {
    const onChange = vi.fn()
    const { unmount } = renderWithProviders(
      <PublishPanel adapters={adapters()} defaultValue={{ visibility: 'fans' }} onChange={onChange} />,
    )
    expect(screen.getByRole('radio', { name: '粉丝可见' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: '仅我可见' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: 'private' }))
    expect(screen.getByRole('radio', { name: '仅我可见' })).toBeChecked()
    unmount()

    function Controlled() {
      const [value, setValue] = useState<PublishSettings>({
        tags: [],
        cover: { mode: 'single', urls: [] },
        summary: '',
        categories: [],
        articleType: 'original',
        declaration: 'none',
        backupToGitCode: false,
        visibility: 'public',
        template: 'default',
        multiPlatform: false,
      })
      return (
        <>
          <PublishPanel adapters={adapters()} value={value} onChange={setValue} />
          <button onClick={() => setValue({ ...value, multiPlatform: true })}>外部修改</button>
        </>
      )
    }
    renderWithProviders(<Controlled />)
    await userEvent.click(screen.getByRole('button', { name: '外部修改' }))
    expect(screen.getByRole('radio', { name: '是' })).toBeChecked()
  })

  it('校验失败：显示错误、焦点移到标签按钮、提示错误、不调用 onPublish', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} />)
    await userEvent.click(screen.getByRole('button', { name: '发布博客' }))
    const add = screen.getByRole('button', { name: '添加文章标签' })
    await waitFor(() => expect(add).toHaveFocus())
    expect(add).toHaveAttribute('aria-invalid', 'true')
    expect(add).toHaveAccessibleDescription('请至少添加 1 个文章标签')
    expect(await screen.findByRole('alert')).toHaveTextContent('请至少添加 1 个文章标签')
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('原文链接错误显示在「文章类型」行，焦点移到原文链接输入框', async () => {
    const a = adapters()
    const { container } = renderWithProviders(
      <PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />,
    )
    await userEvent.click(screen.getByRole('radio', { name: '转载' }))
    await userEvent.click(screen.getByRole('button', { name: '发布博客' }))
    const url = screen.getByRole('textbox', { name: '原文链接' })
    await waitFor(() => expect(url).toHaveFocus())
    expect(url).toHaveAttribute('aria-invalid', 'true')
    expect(url).toHaveAccessibleDescription('转载或翻译文章请填写原文链接')
    expect(container.querySelector('[data-field="articleType"] .ex-pub-item__error')).toHaveTextContent(
      '转载或翻译文章请填写原文链接',
    )
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('标题不合规：只提示错误，表单内没有对应字段，焦点不移动', async () => {
    const a = adapters()
    renderWithProviders(
      <PublishPanel document={{ ...doc, title: '短' }} adapters={a} defaultValue={{ tags: ['React'] }} />,
    )
    const publish = screen.getByRole('button', { name: '发布博客' })
    await userEvent.click(publish)
    expect(await screen.findByRole('alert')).toHaveTextContent('文章标题需为 5～100 个字')
    await tick()
    expect(publish).toHaveFocus()
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('发布成功：payload 含文档与设置，提示「发布成功」并回调 onPublished', async () => {
    const a = adapters()
    const onPublished = vi.fn()
    renderWithProviders(
      <PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} onPublished={onPublished} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '选择正文图片 1 作为封面' }))
    await userEvent.click(screen.getByRole('button', { name: 'AI提取摘要' }))
    await userEvent.click(screen.getByRole('button', { name: '发布博客' }))
    await waitFor(() => expect(a.onPublish).toHaveBeenCalledTimes(1))
    expect(a.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ ...doc, tags: ['React'], cover: { mode: 'single', urls: ['/a.png'] }, summary: '正文内容' }),
    )
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(onPublished).toHaveBeenCalledTimes(1)
  })

  it('保存草稿：onSaveDraft(doc, settings)', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['X'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    await waitFor(() => expect(a.onSaveDraft).toHaveBeenCalledWith(doc, expect.objectContaining({ tags: ['X'] })))
    expect(await screen.findByText('草稿已保存')).toBeInTheDocument()
  })

  it('定时发布：选择时间后发布，payload 带 scheduledAt', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '定时发布' }))
    const dialog = await screen.findByRole('dialog', { name: '定时发布' })
    const input = screen.getByLabelText('发布时间')
    expect(input).toHaveAttribute('type', 'datetime-local')
    fireEvent.change(input, { target: { value: '2099-01-01T10:00' } })
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await waitFor(() =>
      expect(a.onPublish).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: new Date(2099, 0, 1, 10, 0).toISOString() }),
      ),
    )
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('定时发布：时间早于当前时，弹窗保持打开并显示错误', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '定时发布' }))
    const dialog = await screen.findByRole('dialog', { name: '定时发布' })
    const input = within(dialog).getByLabelText('发布时间')
    fireEvent.change(input, { target: { value: '2000-01-01T10:00' } })
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(await within(dialog).findByText('发布时间需晚于当前时间')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(dialog).toBeInTheDocument()
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('定时发布：其他字段校验失败时关闭弹窗并聚焦首个错误字段', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} />)
    await userEvent.click(screen.getByRole('button', { name: '定时发布' }))
    const dialog = await screen.findByRole('dialog', { name: '定时发布' })
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    const add = screen.getByRole('button', { name: '添加文章标签' })
    await waitFor(() => expect(add).toHaveFocus())
    expect(add).toHaveAttribute('aria-invalid', 'true')
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('缺失 adapter：hide 隐藏、disable 禁用', () => {
    const { container, unmount } = renderWithProviders(<PublishPanel document={doc} adapters={{}} />)
    expect(screen.queryByRole('button', { name: '保存草稿' })).toBeNull()
    expect(screen.queryByRole('button', { name: '定时发布' })).toBeNull()
    expect(screen.queryByRole('button', { name: '发布博客' })).toBeNull()
    expect(screen.queryByRole('button', { name: '从本地上传' })).toBeNull()
    expect(container.querySelector('[data-field="categories"]')).toBeNull()
    expect(container.querySelector('[data-field="activity"]')).toBeNull()
    expect(screen.getByRole('button', { name: '添加文章标签' })).toBeInTheDocument()
    unmount()
    renderWithProviders(<PublishPanel document={doc} adapters={{}} missingAdapter="disable" />)
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '定时发布' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发布博客' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '从本地上传' })).toBeDisabled()
    expect(screen.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '活动' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '话题' })).toBeDisabled()
  })

  it('缺失 searchTags：disable 策略下标签弹层同样只有输入框', async () => {
    renderWithProviders(<PublishPanel document={doc} adapters={{ onPublish: vi.fn() }} missingAdapter="disable" />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    expect(await screen.findByRole('searchbox', { name: '搜索标签' })).toBeEnabled()
    expect(screen.queryByText('推荐标签')).toBeNull()
  })

  it('参与活动/话题：只缺 getTopics 时只渲染「活动」子行', () => {
    const { container } = renderWithProviders(
      <PublishPanel document={doc} adapters={{ getActivities: vi.fn(async () => []) }} />,
    )
    expect(container.querySelector('[data-field="activity"]')).not.toBeNull()
    expect(screen.getByRole('combobox', { name: '活动' })).toBeEnabled()
    expect(screen.queryByRole('combobox', { name: '话题' })).toBeNull()
  })

  it('locale 覆盖文案；无外层主题时自建 .ex-root', () => {
    const { container } = render(
      <StrictMode>
        <PublishPanel
          adapters={adapters()}
          defaultTheme="dark"
          locale={{ publish: { actions: { publishInline: 'Publish' } } }}
        />
      </StrictMode>,
    )
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    const root = container.querySelector('.ex-root')!
    expect(root).toHaveClass('ex-pub-theme')
    expect(root).toHaveAttribute('data-ex-theme', 'dark')
  })

  it('有外层 ThemeProvider 且未传主题属性：复用外层主题，不自建 .ex-pub-theme', () => {
    const { container } = renderWithProviders(<PublishPanel document={doc} adapters={adapters()} />)
    expect(container.querySelectorAll('.ex-root')).toHaveLength(1)
    expect(container.querySelector('.ex-pub-theme')).toBeNull()
    expect(container.querySelector('.ex-root')).toContainElement(screen.getByRole('region', { name: '发布设置' }))
  })

  it('定时发布请求进行中：「确定」显示加载态，完成后关闭弹窗', async () => {
    let finish!: () => void
    const a = adapters({
      onPublish: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      ),
    })
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '定时发布' }))
    const dialog = await screen.findByRole('dialog', { name: '定时发布' })
    const confirm = within(dialog).getByRole('button', { name: '确定' })
    expect(confirm).not.toHaveAttribute('aria-busy')
    await userEvent.click(confirm)
    await waitFor(() => expect(a.onPublish).toHaveBeenCalledTimes(1))
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm).toBeDisabled()
    await act(async () => finish())
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })
})

describe('PublishModal', () => {
  function Host({
    a,
    onPublished,
    defaultValue,
  }: {
    a: EditorAdapters
    onPublished?: () => void
    defaultValue?: Partial<PublishSettings>
  }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>打开</button>
        <PublishModal
          open={open}
          onClose={() => setOpen(false)}
          document={doc}
          adapters={a}
          defaultValue={defaultValue}
          onPublished={onPublished}
        />
      </>
    )
  }

  it('模态呈现：标题、模态文案与按钮；取消关闭；重新打开保留设置', async () => {
    renderWithProviders(<Host a={adapters()} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    expect(dialog).toHaveClass('ex-modal', 'ex-pub', 'ex-pub--modal')
    expect(dialog.closest('.ex-modal-mask')).toHaveClass('ex-pub-mask')
    const footer = within(dialog.querySelector('.ex-modal__footer') as HTMLElement)
    expect(footer.getAllByRole('button').map((b) => b.textContent)).toEqual(['取消', '保存为草稿', '定时发布', '发布文章'])
    expect(screen.getByText('0/256')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '转载' }))
    await userEvent.click(footer.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '发布文章' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(await screen.findByRole('radio', { name: '转载' })).toBeChecked()
  })

  it('发布成功后关闭并回调 onPublished', async () => {
    const a = adapters()
    const onPublished = vi.fn()
    renderWithProviders(<Host a={a} onPublished={onPublished} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await screen.findByRole('dialog', { name: '发布文章' })
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: '搜索标签' }), 'React{Enter}')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '发布文章' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '发布文章' })).toBeNull())
    expect(a.onPublish).toHaveBeenCalledWith(expect.objectContaining({ tags: ['React'] }))
    expect(onPublished).toHaveBeenCalledTimes(1)
  })

  it('请求中关闭弹窗：发布结果提示仍然显示', async () => {
    let finish!: () => void
    const a = adapters({
      onPublish: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      ),
    })
    renderWithProviders(<Host a={a} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    await userEvent.click(within(dialog).getByRole('button', { name: '发布文章' }))
    await waitFor(() => expect(a.onPublish).toHaveBeenCalledTimes(1))
    await userEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '发布文章' })).toBeNull()
    await act(async () => finish())
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
  })

  it('请求中关闭又重新打开：成功后提示并回调 onPublished，但不关闭重新打开的弹窗', async () => {
    let finish!: () => void
    const a = adapters({
      onPublish: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      ),
    })
    const onPublished = vi.fn()
    renderWithProviders(<Host a={a} onPublished={onPublished} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const first = await screen.findByRole('dialog', { name: '发布文章' })
    await userEvent.click(within(first).getByRole('button', { name: '发布文章' }))
    await waitFor(() => expect(a.onPublish).toHaveBeenCalledTimes(1))
    await userEvent.click(within(first).getByRole('button', { name: '取消' }))
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await screen.findByRole('dialog', { name: '发布文章' })
    await act(async () => finish())
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(onPublished).toHaveBeenCalledTimes(1)
    await tick()
    expect(screen.getByRole('dialog', { name: '发布文章' })).toBeInTheDocument()
  })

  it('校验失败后关闭再打开：不把焦点移到旧的错误字段；再次发布失败仍聚焦首个错误字段', async () => {
    // 弹窗初始焦点走 requestAnimationFrame；同步执行以模拟浏览器里它先于 setTimeout 到达的时序
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now())
      return 0
    })
    const a = adapters()
    renderWithProviders(<Host a={a} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const first = await screen.findByRole('dialog', { name: '发布文章' })
    await userEvent.click(within(first).getByRole('button', { name: '发布文章' }))
    await waitFor(() => expect(within(first).getByRole('button', { name: '添加文章标签' })).toHaveFocus())
    await userEvent.click(within(first).getByRole('button', { name: '取消' }))
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    const add = within(dialog).getByRole('button', { name: '添加文章标签' })
    expect(add).toHaveAttribute('aria-invalid', 'true')
    await tick()
    expect(add).not.toHaveFocus()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.click(within(dialog).getByRole('button', { name: '发布文章' }))
    await waitFor(() => expect(add).toHaveFocus())
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('onPublished 抛错：弹窗仍自动关闭，不提示发布失败，异常交给调用方', async () => {
    const a = adapters()
    const onPublished = vi.fn(() => {
      throw new Error('导航失败')
    })
    renderWithProviders(<Host a={a} onPublished={onPublished} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    const caught = await collectUnhandledRejections(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: '发布文章' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '发布文章' })).toBeNull())
    })
    expect(caught).toEqual([expect.objectContaining({ message: '导航失败' })])
    expect(onPublished).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(screen.queryByText(/发布失败/)).toBeNull()
  })
})
