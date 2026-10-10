import { zhCN, type EditorAdapters, type EditorDocument, type PublishSettings } from '@editorx/toolbar'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublishModal, PublishPanel } from './publish-panel'
import type { ScheduleRange } from './schedule'
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

async function pickSchedule(dialog: HTMLElement, date: string, time: string) {
  await userEvent.click(within(dialog).getByRole('button', { name: '发布日期' }))
  const calendar = await screen.findByRole('dialog', { name: '发布日期' })
  await userEvent.click(within(calendar).getByRole('button', { name: date }))
  await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
  await userEvent.click(await screen.findByRole('option', { name: time }))
}

const SCHEDULE_HINT = '请选择当前时间后 4小时 至 7天 进行定时发布'

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
})

describe('定时发布', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
  })
  afterEach(() => vi.useRealTimers())

  async function openSchedule() {
    await userEvent.click(screen.getByRole('button', { name: '定时发布' }))
    return screen.findByRole('dialog', { name: '定时发布' })
  }

  it('选择日期与时间后发布，payload 带 scheduledAt，弹窗关闭', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    const dialog = await openSchedule()
    expect(within(dialog).getByText(SCHEDULE_HINT)).toBeInTheDocument()
    await pickSchedule(dialog, '2026-10-10', '10:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    await waitFor(() =>
      expect(a.onPublish).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: new Date(2026, 9, 10, 10, 0).toISOString() }),
      ),
    )
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('未选日期直接确认：提示行变为错误，弹窗保持打开，不发布', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    const dialog = await openSchedule()
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(SCHEDULE_HINT)
    await tick()
    expect(dialog).toBeInTheDocument()
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('所选时刻在点击时已越界：弹窗本地拦截并显示错误，不发布', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-09', '16:00')
    vi.setSystemTime(new Date(2026, 9, 9, 12, 1))
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(SCHEDULE_HINT)
    await tick()
    expect(dialog).toBeInTheDocument()
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('scheduleRange 放宽下限：1 小时后的时间档可选并发布', async () => {
    const a = adapters()
    renderWithProviders(
      <PublishPanel
        document={doc}
        adapters={a}
        defaultValue={{ tags: ['React'] }}
        scheduleRange={{ minOffsetMs: 0, maxOffsetMs: 86_400_000 }}
      />,
    )
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-09', '13:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    await waitFor(() =>
      expect(a.onPublish).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: new Date(2026, 9, 9, 13, 0).toISOString() }),
      ),
    )
  })

  it('scheduleRange 上限 1 天：提示随区间变化，超过 24 小时的日期与时间档禁用', async () => {
    renderWithProviders(
      <PublishPanel
        document={doc}
        adapters={adapters()}
        defaultValue={{ tags: ['React'] }}
        scheduleRange={{ minOffsetMs: 0, maxOffsetMs: 86_400_000 }}
      />,
    )
    const dialog = await openSchedule()
    expect(within(dialog).getByText('请选择当前时间后 0分钟 至 1天 进行定时发布')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '发布日期' }))
    const calendar = await screen.findByRole('dialog', { name: '发布日期' })
    expect(within(calendar).getByRole('button', { name: '2026-10-11' })).toBeDisabled()
    await userEvent.click(within(calendar).getByRole('button', { name: '2026-10-10' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
    expect(await screen.findByRole('option', { name: '12:00' })).toBeEnabled()
    expect(screen.getByRole('option', { name: '12:30' })).toBeDisabled()
  })

  it('发布时间被宿主规则拒绝：错误显示在弹窗提示行，弹窗保持打开', async () => {
    const a = adapters()
    renderWithProviders(
      <PublishPanel
        document={doc}
        adapters={a}
        defaultValue={{ tags: ['React'] }}
        rules={{ scheduledAt: () => '该时段不可发布' }}
      />,
    )
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-10', '10:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('该时段不可发布')
    expect(dialog.querySelector('.ex-pub-schedule__hint')).toBeNull()
    expect(dialog).toBeInTheDocument()
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('宿主错误：改选后清除；再次失败重新播报；空选确认显示区间提示', async () => {
    const a = adapters()
    renderWithProviders(
      <PublishPanel
        document={doc}
        adapters={a}
        defaultValue={{ tags: ['React'] }}
        rules={{ scheduledAt: () => '该时段不可发布' }}
      />,
    )
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-10', '10:00')
    const confirm = within(dialog).getByRole('button', { name: '定时发布' })
    await userEvent.click(confirm)
    const first = await within(dialog).findByRole('alert')
    expect(first).toHaveTextContent('该时段不可发布')
    await userEvent.click(confirm)
    await waitFor(() => expect(within(dialog).getByRole('alert')).not.toBe(first))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('该时段不可发布')
    await userEvent.click(within(dialog).getByRole('button', { name: '发布日期' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: '发布日期' })).getByRole('button', { name: '2026-10-09' }))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(within(dialog).getByText(SCHEDULE_HINT)).toHaveClass('ex-pub-schedule__hint')
    await userEvent.click(confirm)
    expect(within(dialog).getByRole('alert')).toHaveTextContent(SCHEDULE_HINT)
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('onPublish 失败：弹窗保持打开，加载态解除，可以再次确认', async () => {
    const a = adapters({ onPublish: vi.fn(async () => Promise.reject(new Error('网络错误'))) })
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-10', '10:00')
    const confirm = within(dialog).getByRole('button', { name: '定时发布' })
    await userEvent.click(confirm)
    expect(await screen.findByText('发布失败：网络错误')).toBeInTheDocument()
    await waitFor(() => expect(confirm).not.toHaveAttribute('aria-busy'))
    expect(confirm).toBeEnabled()
    expect(dialog).toBeInTheDocument()
    await userEvent.click(confirm)
    await waitFor(() => expect(a.onPublish).toHaveBeenCalledTimes(2))
  })

  it('其他字段校验失败时关闭弹窗并聚焦首个错误字段', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} />)
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-10', '10:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    const add = screen.getByRole('button', { name: '添加文章标签' })
    await waitFor(() => expect(add).toHaveFocus())
    expect(add).toHaveAttribute('aria-invalid', 'true')
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('请求进行中：确认按钮显示加载态，完成后关闭弹窗', async () => {
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
    const dialog = await openSchedule()
    await pickSchedule(dialog, '2026-10-10', '10:00')
    const confirm = within(dialog).getByRole('button', { name: '定时发布' })
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
    scheduleRange,
  }: {
    a: EditorAdapters
    onPublished?: () => void
    defaultValue?: Partial<PublishSettings>
    scheduleRange?: ScheduleRange
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
          scheduleRange={scheduleRange}
        />
      </>
    )
  }

  it('定时发布弹窗按 scheduleRange 显示区间提示', async () => {
    renderWithProviders(<Host a={adapters()} scheduleRange={{ minOffsetMs: 0, maxOffsetMs: 86_400_000 }} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const modal = await screen.findByRole('dialog', { name: '发布文章' })
    await userEvent.click(within(modal).getByRole('button', { name: '定时发布' }))
    const dialog = await screen.findByRole('dialog', { name: '定时发布' })
    expect(within(dialog).getByText('请选择当前时间后 0分钟 至 1天 进行定时发布')).toHaveClass('ex-pub-schedule__hint')
  })

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

  it('选项列表：首次打开才加载；关闭再打开不重新加载、不闪加载中/占位、不重复失败提示', async () => {
    const a = adapters({ getCategories: vi.fn(() => Promise.reject(new Error('网络错误'))) })
    const loaders = [a.getCategories!, a.getActivities!, a.getTopics!] as ReturnType<typeof vi.fn>[]
    const failure = '分类专栏加载失败：网络错误'
    renderWithProviders(<Host a={a} defaultValue={{ activityId: 'a1', topicId: 't1' }} />)
    await tick()
    for (const load of loaders) expect(load).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const first = await screen.findByRole('dialog', { name: '发布文章' })
    expect(await screen.findByText(failure)).toBeInTheDocument()
    await waitFor(() => expect(within(first).getByRole('combobox', { name: '活动' })).toHaveTextContent('征文'))
    await waitFor(() => expect(within(first).getByRole('combobox', { name: '话题' })).toHaveTextContent('话题一'))
    const calls = loaders.map((load) => load.mock.calls.length)
    for (const count of calls) expect(count).toBeGreaterThan(0)
    // 若重新加载，列表会停在加载中，已选的活动/话题只显示占位
    for (const load of loaders.slice(1)) load.mockImplementation(() => new Promise(() => {}))

    await userEvent.click(within(first).getByRole('button', { name: '取消' }))
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    expect(within(dialog).getByRole('combobox', { name: '活动' })).toHaveTextContent('征文')
    expect(within(dialog).getByRole('combobox', { name: '话题' })).toHaveTextContent('话题一')
    expect(within(dialog).queryByText('加载中…')).toBeNull()
    await tick()
    expect(loaders.map((load) => load.mock.calls.length)).toEqual(calls)
    expect(screen.getAllByText(failure)).toHaveLength(1)
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
