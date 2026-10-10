import type { TagCategory } from '@editorx/toolbar'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { TagPicker, type TagPickerProps } from './tag-picker'

function Harness(props: Partial<TagPickerProps> & { initial?: string[] }) {
  const [tags, setTags] = useState(props.initial ?? [])
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button">外部</button>
      {open && <TagPicker selected={tags} onAdd={(t) => setTags([...tags, t])} onClose={() => setOpen(false)} {...props} />}
      <output data-testid="tags">{tags.join(',')}</output>
    </>
  )
}

const panel = () => screen.getByRole('dialog', { name: '标签' })

describe('TagPicker', () => {
  it('只有 searchTags：回退为「推荐」分类，点击推荐标签添加并标记已选', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [] : ['React', 'Vue']))
    renderWithProviders(<Harness searchTags={searchTags} />)
    const categories = await screen.findByRole('list', { name: '标签分类' })
    expect(within(categories).getByRole('button', { name: '推荐' })).toHaveAttribute('aria-pressed', 'true')
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
    await userEvent.click(screen.getByRole('button', { name: 'Java' }))
    expect(await screen.findByRole('button', { name: 'Spring' })).toBeInTheDocument()
    expect(getTagsByCategory).toHaveBeenCalledWith('java')
    expect(screen.getByRole('button', { name: 'Java' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('getTagCategories 返回空数组：回退「推荐」', async () => {
    renderWithProviders(<Harness getTagCategories={async () => []} searchTags={async () => ['Vite']} />)
    expect(await screen.findByRole('button', { name: '推荐' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
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

  it('面板关闭后分类才加载失败：不再调用 onLoadError', async () => {
    const onLoadError = vi.fn()
    let reject!: (error: unknown) => void
    const { unmount } = renderWithProviders(
      <Harness getTagCategories={() => new Promise((_, r) => (reject = r))} onLoadError={onLoadError} />,
    )
    unmount()
    reject(new Error('网络错误'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onLoadError).not.toHaveBeenCalled()
  })

  it('两个 adapter 都缺：只有搜索框，Enter 添加自定义标签', async () => {
    renderWithProviders(<Harness />)
    const input = screen.getByRole('searchbox', { name: '搜索标签' })
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('placeholder', '请输入文字搜索，Enter键入可添加自定义标签')
    expect(screen.queryByRole('list', { name: '标签分类' })).toBeNull()
    await userEvent.type(input, 'Rust{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^Rust$/)
    expect(input).toHaveValue('')
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
