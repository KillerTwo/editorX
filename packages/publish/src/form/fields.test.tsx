import type { ArticleType, Category, TagCategory } from '@editorx/toolbar'
import { Modal } from '@editorx/ui'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { CategoryField } from './category-field'
import { FormItem } from './form-item'
import { ActivityField, ArticleTypeField, BackupField } from './option-fields'
import { SummaryField } from './summary-field'
import { TagField } from './tag-field'

/** adapter 每次渲染都包一层新函数，模拟调用方内联传入 adapters={{…}} */
function Tags({
  initial = [],
  searchTags,
  getTagCategories,
  getTagsByCategory,
  onLoadError,
}: {
  initial?: string[]
  searchTags?: (k: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (id: string) => Promise<string[]>
  onLoadError?: (error: unknown) => void
}) {
  const [tags, setTags] = useState(initial)
  return (
    <>
      <span id="t-label">文章标签</span>
      <TagField
        id="t"
        tags={tags}
        onChange={setTags}
        searchTags={searchTags && ((k) => searchTags(k))}
        getTagCategories={getTagCategories && (() => getTagCategories())}
        getTagsByCategory={getTagsByCategory && ((id) => getTagsByCategory(id))}
        onLoadError={onLoadError && ((error) => onLoadError(error))}
        invalid={false}
      />
      <output data-testid="tags">{tags.join(',')}</output>
    </>
  )
}

const addButton = () => screen.getByRole('button', { name: '添加文章标签' })
const closeTagPanel = () => userEvent.click(screen.getByRole('button', { name: '关闭标签面板' }))

describe('FormItem', () => {
  it('标签、必填星号、帮助图标、错误信息与 data-field', () => {
    const { container } = renderWithProviders(
      <FormItem field="tags" id="f" label="文章标签" required help="帮助" error="请至少添加 1 个文章标签">
        <button aria-describedby="f-error">控件</button>
      </FormItem>,
    )
    const item = container.querySelector('[data-field="tags"]')!
    expect(item).toHaveClass('ex-pub-item', 'is-error')
    expect(item.querySelector('.ex-pub-item__required')).toHaveTextContent('*')
    expect(screen.getByRole('img', { name: '帮助' })).toHaveClass('ex-pub-item__help')
    expect(screen.getByRole('img', { name: '帮助' }).querySelector('svg.ex-pub-help-icon')).toHaveAttribute('width', '14')
    expect(screen.getByRole('button', { name: '控件' })).toHaveAccessibleDescription('请至少添加 1 个文章标签')
  })
})

describe('TagField', () => {
  it('弹层：推荐标签、关键字防抖搜索、Enter 添加自定义、已选推荐禁用', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [`${k}1`, `${k}2`] : ['React', 'Vue']))
    renderWithProviders(<Tags searchTags={searchTags} />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    expect(screen.getByText('还可添加7个标签')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'React' }))
    expect(screen.getByTestId('tags')).toHaveTextContent('React')
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true')
    expect(searchTags).toHaveBeenCalledWith('')
    await userEvent.type(input, 'ts')
    expect(await screen.findByRole('button', { name: 'ts1' })).toBeInTheDocument()
    expect(searchTags).toHaveBeenLastCalledWith('ts')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent('React,ts')
    expect(input).toHaveValue('')
    await userEvent.type(input, 'React{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^React,ts$/)
    expect(input).toHaveValue('React')
  })

  it('重复判断忽略大小写与首尾空白；未添加时 Enter 保留输入', async () => {
    renderWithProviders(<Tags initial={['React']} />)
    await userEvent.click(addButton())
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    await userEvent.type(input, ' react {Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^React$/)
    expect(input).toHaveValue(' react ')
  })

  it('添加第 7 个标签后面板关闭，焦点落到最后一个标签的 ×', async () => {
    renderWithProviders(<Tags initial={['1', '2', '3', '4', '5', '6']} />)
    await userEvent.click(addButton())
    await userEvent.type(await screen.findByRole('searchbox', { name: '搜索标签' }), '7{Enter}')
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
    expect(screen.getByRole('button', { name: '删除标签 7' })).toHaveFocus()
  })

  it('点 × 删除标签：焦点移到下一个标签的 ×，没有则上一个，都没有则添加按钮', async () => {
    renderWithProviders(<Tags initial={['a', 'b', 'c']} />)
    await userEvent.click(screen.getByRole('button', { name: '删除标签 b' }))
    expect(screen.getByRole('button', { name: '删除标签 c' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: '删除标签 c' }))
    expect(screen.getByRole('button', { name: '删除标签 a' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: '删除标签 a' }))
    expect(screen.getByTestId('tags')).toHaveTextContent(/^$/)
    expect(addButton()).toHaveFocus()
  })

  it('分类与分类标签每次挂载只加载一次：重渲染与关闭再打开都不重新加载', async () => {
    const getTagCategories = vi.fn(async (): Promise<TagCategory[]> => [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ])
    const getTagsByCategory = vi.fn(async (id: string) => [`${id}1`, `${id}2`])
    renderWithProviders(<Tags getTagCategories={getTagCategories} getTagsByCategory={getTagsByCategory} />)
    await userEvent.click(addButton())
    await userEvent.click(await screen.findByRole('button', { name: 'a1' }))
    await userEvent.click(screen.getByRole('tab', { name: 'B' }))
    await userEvent.click(await screen.findByRole('button', { name: 'b1' }))
    expect(screen.getByTestId('tags')).toHaveTextContent(/^a1,b1$/)
    await closeTagPanel()
    await userEvent.click(addButton())
    expect(screen.getByRole('button', { name: 'a2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'B' }))
    expect(screen.getByRole('button', { name: 'b2' })).toBeInTheDocument()
    expect(getTagCategories).toHaveBeenCalledTimes(1)
    expect(getTagsByCategory.mock.calls).toEqual([['a'], ['b']])
  })

  it('分类加载失败不缓存：每次失败提示一次，下次打开重试，成功后不再加载', async () => {
    const onLoadError = vi.fn()
    const getTagCategories = vi
      .fn<() => Promise<TagCategory[]>>()
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValue([{ id: 'a', name: 'A', tags: ['a1'] }])
    renderWithProviders(<Tags getTagCategories={getTagCategories} searchTags={async () => ['Vite']} onLoadError={onLoadError} />)
    await userEvent.click(addButton())
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
    await waitFor(() => expect(onLoadError).toHaveBeenCalledTimes(1))
    await closeTagPanel()
    await userEvent.click(addButton())
    expect(await screen.findByRole('button', { name: 'a1' })).toBeInTheDocument()
    expect(getTagCategories).toHaveBeenCalledTimes(2)
    await closeTagPanel()
    await userEvent.click(addButton())
    expect(screen.getByRole('button', { name: 'a1' })).toBeInTheDocument()
    expect(getTagCategories).toHaveBeenCalledTimes(2)
    expect(onLoadError).toHaveBeenCalledTimes(1)
  })

  it('删除标签；满 7 个隐藏添加按钮；无 searchTags 只有输入框', async () => {
    renderWithProviders(<Tags initial={['1', '2', '3', '4', '5', '6']} />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    expect(screen.queryByText('推荐标签')).toBeNull()
    await userEvent.type(input, '7{Enter}')
    expect(screen.queryByRole('button', { name: '添加文章标签' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '删除标签 3' }))
    expect(screen.getByTestId('tags')).toHaveTextContent('1,2,4,5,6,7')
    const add = screen.getByRole('button', { name: '添加文章标签' })
    await userEvent.click(add)
    await userEvent.click(screen.getByRole('button', { name: '关闭标签面板' }))
    expect(screen.getByRole('button', { name: '添加文章标签' })).toHaveFocus()
    expect(add).toHaveAttribute('aria-expanded', 'false')
  })

  it('无 searchTags（hide 与 disable 策略相同）：弹层只有可用的输入框，无推荐区与禁用控件', async () => {
    const { baseElement } = renderWithProviders(<Tags />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    expect(input).toBeEnabled()
    expect(screen.queryByText('推荐标签')).toBeNull()
    expect(baseElement.querySelector('.ex-pub-tag-picker__body')).toBeNull()
    expect(baseElement.querySelector('.ex-pub-tag-picker :disabled')).toBeNull()
    await userEvent.type(input, 'Rust{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^Rust$/)
  })

  it('输入法组合中的 Enter（isComposing 或 Safari 的 keyCode 229）不添加标签', async () => {
    renderWithProviders(<Tags />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    fireEvent.change(input, { target: { value: 'pinyin' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(screen.getByTestId('tags')).toHaveTextContent(/^$/)
    expect(input).toHaveValue('pinyin')
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    expect(screen.getByTestId('tags')).toHaveTextContent(/^pinyin$/)
  })

  it('已选标签为 primary chip；添加按钮切换面板并带 aria-expanded（B09/B11）', async () => {
    const { container } = renderWithProviders(<Tags initial={['jvm']} />)
    expect(container.querySelector('.ex-pub-tag')).toHaveClass('ex-tag--primary')
    const add = screen.getByRole('button', { name: '添加文章标签' })
    expect(add).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(add)
    expect(add).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: '标签' }).closest('.ex-pub-tags')).not.toBeNull()
    await userEvent.click(add)
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
  })

  it('弹窗内 Esc 只关闭标签面板，第二次 Esc 才关闭弹窗（浮层树子节点）', async () => {
    const onModalClose = vi.fn()
    renderWithProviders(
      <Modal open onClose={onModalClose} title="发布文章">
        <Tags />
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    expect(screen.getByRole('dialog', { name: '标签' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
    expect(onModalClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onModalClose).toHaveBeenCalledTimes(1)
  })

  it('焦点在弹窗其他控件时 Esc 只关闭面板，焦点留在原控件', async () => {
    const onModalClose = vi.fn()
    renderWithProviders(
      <Modal open onClose={onModalClose} title="发布文章">
        <Tags />
        <button type="button">其他控件</button>
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const other = screen.getByRole('button', { name: '其他控件' })
    other.focus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
    expect(onModalClose).not.toHaveBeenCalled()
    expect(other).toHaveFocus()
  })
})

describe('SummaryField', () => {
  function Summary({ variant, source }: { variant: 'inline' | 'modal'; source: string }) {
    const [value, setValue] = useState('')
    return (
      <>
        <span id="s-label">文章摘要</span>
        <SummaryField id="s" value={value} onChange={setValue} source={source} variant={variant} invalid={false} />
      </>
    )
  }

  it('内联：占位与「0 / 256」计数，输入更新计数，AI提取摘要填入正文前 256 字', async () => {
    renderWithProviders(<Summary variant="inline" source={'字'.repeat(256)} />)
    const box = screen.getByRole('textbox', { name: '文章摘要' })
    expect(box).toHaveAttribute('placeholder', expect.stringContaining('支持一键将正文前 256 字符键入摘要文本框'))
    expect(screen.getByText('0 / 256')).toBeInTheDocument()
    await userEvent.type(box, '你好')
    expect(screen.getByText('2 / 256')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'AI提取摘要' }))
    expect(box).toHaveValue('字'.repeat(256))
    expect(screen.getByText('256 / 256')).toBeInTheDocument()
  })

  it('模态：「0/256」计数；超长标 is-over；无正文时提取按钮禁用', async () => {
    const { container } = renderWithProviders(<Summary variant="modal" source="" />)
    expect(screen.getByText('0/256')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI提取摘要' })).toBeDisabled()
    const box = screen.getByRole('textbox', { name: '文章摘要' })
    await userEvent.click(box)
    await userEvent.paste('字'.repeat(257))
    expect(container.querySelector('.ex-pub-summary__box')).toHaveClass('is-over')
  })

  it.each(['inline', 'modal'] as const)('%s：「AI提取摘要」按钮前有魔棒图标，不影响按钮名称', (variant) => {
    renderWithProviders(<Summary variant={variant} source="正文" />)
    const button = screen.getByRole('button', { name: 'AI提取摘要' })
    const icon = button.querySelector('svg.ex-pub-summary__wand')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(button.firstElementChild).toBe(icon)
  })
})

describe('CategoryField', () => {
  const list: Category[] = [
    { id: 'c1', name: '前端' },
    { id: 'c2', name: '后端' },
  ]
  function Categories({ categories, variant = 'inline' }: { categories: Category[] | null; variant?: 'inline' | 'modal' }) {
    const [value, setValue] = useState<string[]>([])
    return (
      <>
        <span id="c-label">分类专栏</span>
        <CategoryField id="c" value={value} onChange={setValue} categories={categories} state="enabled" variant={variant} />
        <output data-testid="cats">{value.join(',')}</output>
      </>
    )
  }

  it('加载中、空提示（按呈现区分）、勾选切换', async () => {
    const { unmount } = renderWithProviders(<Categories categories={null} />)
    expect(screen.getByText('加载中…')).toBeInTheDocument()
    unmount()
    const empty = renderWithProviders(<Categories categories={[]} />)
    expect(screen.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeInTheDocument()
    empty.unmount()
    const modal = renderWithProviders(<Categories categories={[]} variant="modal" />)
    expect(screen.getByText('您暂时不能添加分类专栏!')).toBeInTheDocument()
    modal.unmount()
    renderWithProviders(<Categories categories={list} />)
    expect(screen.getByRole('group', { name: '分类专栏' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: '后端' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '前端' }))
    expect(screen.getByTestId('cats')).toHaveTextContent('c2,c1')
    await userEvent.click(screen.getByRole('checkbox', { name: '后端' }))
    expect(screen.getByTestId('cats')).toHaveTextContent(/^c1$/)
  })
})

describe('选项字段', () => {
  it('文章类型：原创带认证图标；转载/翻译显示原文链接输入框', async () => {
    function Type() {
      const [type, setType] = useState<ArticleType>('original')
      const [url, setUrl] = useState<string | undefined>()
      return (
        <>
          <span id="a-label">文章类型</span>
          <ArticleTypeField id="a" value={type} sourceUrl={url} onType={setType} onSourceUrl={setUrl} sourceUrlInvalid={false} />
        </>
      )
    }
    const { container } = renderWithProviders(<Type />)
    expect(screen.getByRole('radiogroup', { name: '文章类型' })).toBeInTheDocument()
    expect(container.querySelector('.ex-pub-verified')).not.toBeNull()
    expect(screen.queryByRole('textbox', { name: '原文链接' })).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: '转载' }))
    const url = screen.getByRole('textbox', { name: '原文链接' })
    await userEvent.type(url, 'https://a.com')
    expect(url).toHaveValue('https://a.com')
  })

  it('文章备份：复选框与协议链接（有 href 渲染为链接）', async () => {
    const onChange = vi.fn()
    renderWithProviders(<BackupField checked={false} onChange={onChange} links={{ terms: 'https://gitcode.com/terms' }} />)
    await userEvent.click(screen.getByRole('checkbox', { name: '同时备份到GitCode' }))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('link', { name: '用户协议' })).toHaveAttribute('href', 'https://gitcode.com/terms')
    expect(screen.queryByRole('link', { name: '隐私政策' })).toBeNull()
    expect(screen.getByText('隐私政策')).toHaveClass('ex-pub-link')
  })

  it('文章备份：协议文案与参考截图一致', () => {
    const { container } = renderWithProviders(<BackupField checked={false} onChange={() => {}} />)
    expect(container.querySelector('.ex-pub-agreement')).toHaveTextContent(
      /^您已同意GitCode 用户协议 和 隐私政策，我们会为您自动创建账号并备份文章至我的项目。$/,
    )
  })

  it('参与活动/话题：按 adapter 状态隐藏或禁用子行', async () => {
    const onActivity = vi.fn()
    const { unmount } = renderWithProviders(
      <ActivityField
        id="act"
        activityId={undefined}
        topicId={undefined}
        onActivity={onActivity}
        onTopic={() => {}}
        activities={[{ id: 'a1', name: '征文活动' }]}
        topics={[]}
        activityState="enabled"
        topicState="disabled"
      />,
    )
    const activity = screen.getByRole('combobox', { name: '活动' })
    expect(activity).toHaveTextContent('请选择创作活动')
    expect(screen.getByRole('combobox', { name: '话题' })).toBeDisabled()
    await userEvent.click(activity)
    await userEvent.click(await screen.findByRole('option', { name: '征文活动' }))
    expect(onActivity).toHaveBeenCalledWith('a1')
    unmount()
    renderWithProviders(
      <ActivityField
        id="act"
        activityId={undefined}
        topicId={undefined}
        onActivity={() => {}}
        onTopic={() => {}}
        activities={[]}
        topics={[]}
        activityState="hidden"
        topicState="enabled"
      />,
    )
    expect(screen.queryByRole('combobox', { name: '活动' })).toBeNull()
    expect(screen.getByRole('combobox', { name: '话题' })).toHaveTextContent('请选择创作话题')
  })

  it('参与活动/话题：两个 adapter 都隐藏时不渲染任何内容', () => {
    const { container } = renderWithProviders(
      <ActivityField
        id="act"
        activityId={undefined}
        topicId={undefined}
        onActivity={() => {}}
        onTopic={() => {}}
        activities={null}
        topics={null}
        activityState="hidden"
        topicState="hidden"
      />,
    )
    expect(container.querySelector('.ex-pub-activity')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
