import type { TagCategory } from '@editorx/toolbar'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { TagPicker } from './tag-picker'
import { useTagCatalog, type TagSources } from './use-tag-catalog'

function Harness({ initial, ...sources }: TagSources & { initial?: string[] }) {
  const [tags, setTags] = useState(initial ?? [])
  const [open, setOpen] = useState(true)
  const catalog = useTagCatalog(sources)
  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.includes(tag)) return false
    setTags([...tags, tag])
    return true
  }
  return (
    <>
      <button type="button">外部</button>
      {open && <TagPicker selected={tags} onAdd={add} onClose={() => setOpen(false)} catalog={catalog} />}
      <output data-testid="tags">{tags.join(',')}</output>
    </>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const panel = () => screen.getByRole('dialog', { name: '标签' })
const tab = (name: string) => screen.getByRole('tab', { name })
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

describe('TagPicker', () => {
  it('只有 searchTags：回退为「推荐」分类，点击推荐标签添加并标记已选', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [] : ['React', 'Vue']))
    renderWithProviders(<Harness searchTags={searchTags} />)
    const categories = await screen.findByRole('tablist', { name: '标签分类' })
    expect(categories).toHaveAttribute('aria-orientation', 'vertical')
    expect(within(categories).getByRole('tab', { name: '推荐' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(await screen.findByRole('button', { name: 'React' }))
    expect(screen.getByTestId('tags')).toHaveTextContent('React')
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByText('添加标签')).toBeInTheDocument()
    expect(within(panel()).getByText('还可添加6个标签')).toBeInTheDocument()
    expect(searchTags).toHaveBeenCalledWith('')
  })

  it('分类：内联 tags 直接显示，未内联的按需 getTagsByCategory', async () => {
    const categories: TagCategory[] = [
      { id: 'py', name: 'Python', tags: ['Django'] },
      { id: 'java', name: 'Java' },
    ]
    const getTagsByCategory = vi.fn(async () => ['Spring'])
    renderWithProviders(<Harness getTagCategories={async () => categories} getTagsByCategory={getTagsByCategory} />)
    expect(await screen.findByRole('button', { name: 'Django' })).toBeInTheDocument()
    expect(getTagsByCategory).not.toHaveBeenCalled()
    await userEvent.click(tab('Java'))
    expect(await screen.findByRole('button', { name: 'Spring' })).toBeInTheDocument()
    expect(getTagsByCategory).toHaveBeenCalledWith('java')
    expect(tab('Java')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Python')).toHaveAttribute('aria-selected', 'false')
  })

  it('分类为 tablist：tab 指向右栏 tabpanel，上下方向键循环切换并使用 roving tabindex', async () => {
    const categories: TagCategory[] = [
      { id: 'a', name: 'A', tags: ['a1'] },
      { id: 'b', name: 'B', tags: ['b1'] },
      { id: 'c', name: 'C', tags: ['c1'] },
    ]
    renderWithProviders(<Harness getTagCategories={async () => categories} />)
    await screen.findByRole('button', { name: 'a1' })
    const tabpanel = screen.getByRole('tabpanel')
    expect(tab('A')).toHaveAttribute('aria-controls', tabpanel.id)
    expect(tabpanel).toHaveAttribute('aria-labelledby', tab('A').id)
    expect([tab('A'), tab('B'), tab('C')].map((t) => t.tabIndex)).toEqual([0, -1, -1])
    tab('A').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(tab('B')).toHaveFocus()
    expect(tab('B')).toHaveAttribute('aria-selected', 'true')
    expect([tab('A'), tab('B'), tab('C')].map((t) => t.tabIndex)).toEqual([-1, 0, -1])
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'b1' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(tab('A')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(tab('C')).toHaveFocus()
    expect(tab('C')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'c1' })).toBeInTheDocument()
  })

  it('getTagCategories 返回空数组：回退「推荐」', async () => {
    renderWithProviders(<Harness getTagCategories={async () => []} searchTags={async () => ['Vite']} />)
    expect(await screen.findByRole('tab', { name: '推荐' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
  })

  it('分类加载中：右侧主体按固定高度占位，不等加载完才出现', async () => {
    const pending = deferred<TagCategory[]>()
    const { baseElement } = renderWithProviders(<Harness getTagCategories={() => pending.promise} />)
    expect(baseElement.querySelector('.ex-pub-tag-picker__body')).not.toBeNull()
    expect(within(screen.getByRole('tablist', { name: '标签分类' })).queryAllByRole('tab')).toHaveLength(0)
    pending.resolve([{ id: 'a', name: 'A', tags: ['a1'] }])
    expect(await screen.findByRole('button', { name: 'a1' })).toBeInTheDocument()
  })

  it('getTagCategories 抛错：onLoadError 只调用一次（StrictMode）并回退「推荐」', async () => {
    const onLoadError = vi.fn()
    renderWithProviders(
      <Harness getTagCategories={() => Promise.reject(new Error('网络错误'))} searchTags={async () => ['Vite']} onLoadError={onLoadError} />,
    )
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
    await waitFor(() => expect(onLoadError).toHaveBeenCalledTimes(1))
    expect(onLoadError.mock.calls[0]![0]).toEqual(new Error('网络错误'))
  })

  it('getTagCategories 同步抛错：面板不崩溃，回退「推荐」且 onLoadError 只调用一次', async () => {
    const onLoadError = vi.fn()
    const getTagCategories = (): Promise<TagCategory[]> => {
      throw new Error('同步错误')
    }
    renderWithProviders(<Harness getTagCategories={getTagCategories} searchTags={async () => ['Vite']} onLoadError={onLoadError} />)
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
    expect(tab('推荐')).toHaveAttribute('aria-selected', 'true')
    await flush()
    expect(onLoadError).toHaveBeenCalledTimes(1)
    expect(onLoadError.mock.calls[0]![0]).toEqual(new Error('同步错误'))
  })

  it('面板关闭后分类才加载失败：不再调用 onLoadError', async () => {
    const onLoadError = vi.fn()
    const pending = deferred<TagCategory[]>()
    const { unmount } = renderWithProviders(<Harness getTagCategories={() => pending.promise} onLoadError={onLoadError} />)
    unmount()
    pending.reject(new Error('网络错误'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onLoadError).not.toHaveBeenCalled()
  })

  it('getTagsByCategory 失败不缓存为空：显示空态，再次选中该分类重新加载', async () => {
    const getTagsByCategory = vi.fn().mockRejectedValueOnce(new Error('网络错误')).mockResolvedValue(['Spring'])
    renderWithProviders(<Harness getTagCategories={async () => [{ id: 'java', name: 'Java' }]} getTagsByCategory={getTagsByCategory} />)
    expect(await screen.findByText('暂无相关标签')).toBeInTheDocument()
    expect(getTagsByCategory).toHaveBeenCalledTimes(1)
    await userEvent.click(tab('Java'))
    expect(await screen.findByRole('button', { name: 'Spring' })).toBeInTheDocument()
    expect(getTagsByCategory).toHaveBeenCalledTimes(2)
  })

  it('切换分类时未完成的加载仍写入缓存：a→b→a 不重复加载 a', async () => {
    const a = deferred<string[]>()
    const getTagsByCategory = vi.fn((id: string) => (id === 'a' ? a.promise : Promise.resolve(['b1'])))
    renderWithProviders(
      <Harness
        getTagCategories={async () => [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ]}
        getTagsByCategory={getTagsByCategory}
      />,
    )
    await waitFor(() => expect(getTagsByCategory).toHaveBeenCalledWith('a'))
    await userEvent.click(tab('B'))
    expect(await screen.findByRole('button', { name: 'b1' })).toBeInTheDocument()
    a.resolve(['a1'])
    await flush()
    await userEvent.click(tab('A'))
    expect(screen.getByRole('button', { name: 'a1' })).toBeInTheDocument()
    expect(getTagsByCategory.mock.calls.filter(([id]) => id === 'a')).toHaveLength(1)
  })

  it('两个 adapter 都缺：只有搜索框，Enter 添加自定义标签', async () => {
    const { baseElement } = renderWithProviders(<Harness />)
    const input = screen.getByRole('searchbox', { name: '搜索标签' })
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('placeholder', '请输入文字搜索，Enter键入可添加自定义标签')
    expect(screen.queryByRole('tablist', { name: '标签分类' })).toBeNull()
    expect(baseElement.querySelector('.ex-pub-tag-picker__body')).toBeNull()
    await userEvent.type(input, 'Rust{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^Rust$/)
    expect(input).toHaveValue('')
  })

  it('Enter 未真正添加（onAdd 返回 false）时保留输入内容', async () => {
    renderWithProviders(<Harness initial={['Rust']} />)
    const input = screen.getByRole('searchbox', { name: '搜索标签' })
    await userEvent.type(input, 'Rust{Enter}')
    expect(input).toHaveValue('Rust')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^Rust$/)
  })

  it('剩余数量为 aria-live 区域', () => {
    renderWithProviders(<Harness />)
    expect(within(panel()).getByText('还可添加7个标签')).toHaveAttribute('aria-live', 'polite')
  })

  it('关键字：300ms 防抖搜索结果替换右栏', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [`${k}1`, `${k}2`] : ['React']))
    renderWithProviders(<Harness searchTags={searchTags} />)
    await screen.findByRole('button', { name: 'React' })
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索标签' }), 'ts')
    expect(await screen.findByRole('button', { name: 'ts1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'React' })).toBeNull()
    expect(searchTags).toHaveBeenLastCalledWith('ts')
  })

  it('输入法组合中的 Enter 不添加', () => {
    renderWithProviders(<Harness />)
    const input = screen.getByRole('searchbox', { name: '搜索标签' })
    fireEvent.change(input, { target: { value: 'pinyin' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(screen.getByTestId('tags')).toHaveTextContent(/^$/)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    expect(screen.getByTestId('tags')).toHaveTextContent(/^pinyin$/)
  })

  it('点击外部不关闭；× 与 Esc 关闭', async () => {
    const { unmount } = renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '外部' }))
    expect(panel()).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '关闭标签面板' }))
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
    unmount()
    renderWithProviders(<Harness />)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
  })
})
