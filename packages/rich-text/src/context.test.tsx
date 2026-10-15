import type { EditorExtension } from '@geekx/toolbar'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountEditor } from './mount-editor'
import { RichTextEditor } from './rich-text-editor'

const insertHtml = vi.fn()
const replaceHtml = vi.fn()
let selected = 'hello'

vi.mock('./mount-editor', () => ({
  mountEditor: vi.fn(async () => ({
    getData: () => '<p>hello</p>',
    setData: vi.fn(),
    setReadOnly: vi.fn(),
    insertHtml,
    replaceHtml,
    getSelectionText: () => selected,
    execute: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(async () => undefined),
    onChange: () => () => undefined,
  })),
}))

const probe: EditorExtension = {
  name: 'probe-context',
  editors: ['richtext'],
  toolbar: [
    {
      type: 'button',
      id: 'read-selection',
      title: '读选区',
      run: (ctx) => {
        const node = document.querySelector('[data-probe="selection"]')
        if (node) node.textContent = ctx.getSelectionText()
      },
    },
    { type: 'button', id: 'insert-it', title: '插入', run: (ctx) => ctx.insert({ html: '<p>add</p>' }) },
    { type: 'button', id: 'replace-it', title: '替换', run: (ctx) => ctx.replaceSelection({ html: '<p>new</p>' }) },
    {
      type: 'button',
      id: 'upload-it',
      title: '上传',
      run: (ctx) => {
        void ctx.uploadImages([
          new File(['a'], 'a.png', { type: 'image/png' }),
          new File(['b'], 'bad.png', { type: 'image/png' }),
          new File(['c'], 'c.png', { type: 'image/png' }),
        ])
      },
    },
  ],
}

beforeEach(() => {
  selected = 'hello'
  insertHtml.mockReset()
  replaceHtml.mockReset()
  vi.mocked(mountEditor).mockClear()
})

describe('ExtensionContext', () => {
  it('getSelectionText 返回选中文本；replace 删除选区，insert 不删', async () => {
    render(
      <StrictMode>
        <div data-probe="selection" />
        <RichTextEditor extensions={[probe]} toolbarLayout={[['read-selection', 'insert-it', 'replace-it']]} />
      </StrictMode>,
    )
    await userEvent.click(await screen.findByRole('button', { name: '读选区' }))
    expect(document.querySelector('[data-probe="selection"]')).toHaveTextContent('hello')

    await userEvent.click(screen.getByRole('button', { name: '插入' }))
    expect(insertHtml).toHaveBeenCalledWith('<p>add</p>')
    expect(replaceHtml).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '替换' }))
    expect(replaceHtml).toHaveBeenCalledWith('<p>new</p>')
    expect(insertHtml).toHaveBeenCalledTimes(1)
  })

  it('一张图片上传失败时提示并继续其余文件', async () => {
    const uploadImage = vi
      .fn()
      .mockResolvedValueOnce({ url: 'https://cdn.example/a.png' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ url: 'https://cdn.example/c.png' })
    render(
      <StrictMode>
        <RichTextEditor
          adapters={{ uploadImage }}
          extensions={[probe]}
          toolbarLayout={[['upload-it']]}
        />
      </StrictMode>,
    )
    await userEvent.click(await screen.findByRole('button', { name: '上传' }))
    await waitFor(() => expect(insertHtml).toHaveBeenCalledTimes(2))
    expect(uploadImage).toHaveBeenCalledTimes(3)
    expect(insertHtml.mock.calls.map((call) => call[0])).toEqual([
      '<figure class="image"><img src="https://cdn.example/a.png" alt=""></figure>',
      '<figure class="image"><img src="https://cdn.example/c.png" alt=""></figure>',
    ])
    expect(await screen.findByText('图片 bad.png 上传失败：boom')).toBeInTheDocument()
  })
})
