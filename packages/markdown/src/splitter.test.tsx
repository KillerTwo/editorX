import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { markdownCoreExtensions, syntaxPanelExtension } from './core-extensions'
import { clampSplit, Splitter, splitFromPointer } from './splitter'
import { renderEditor } from './test-utils'

const syncRefresh = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@editorx/markdown-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@editorx/markdown-core')>()
  return {
    ...actual,
    createScrollSync: (...args: Parameters<typeof actual.createScrollSync>) => {
      const sync = actual.createScrollSync(...args)
      return {
        ...sync,
        refresh: () => {
          syncRefresh.calls++
          sync.refresh()
        },
      }
    },
  }
})

const body = () => document.querySelector<HTMLElement>('.ex-mde-body')!

function mockRect(el: HTMLElement, left: number, width: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    width,
    top: 0,
    height: 100,
    right: left + width,
    bottom: 100,
    x: left,
    y: 0,
    toJSON: () => ({}),
  })
}

describe('clampSplit / splitFromPointer', () => {
  it('限制在 0.2–0.8，非有限值回到 0.5', () => {
    expect(clampSplit(0.1)).toBe(0.2)
    expect(clampSplit(0.95)).toBe(0.8)
    expect(clampSplit(0.5 + 0.02)).toBe(0.52)
    expect(clampSplit(Number.NaN)).toBe(0.5)
  })

  it('按指针位置换算比例；容器宽度为 0 时返回 null', () => {
    expect(splitFromPointer(400, { left: 100, width: 1000 })).toBe(0.3)
    expect(splitFromPointer(2000, { left: 100, width: 1000 })).toBe(0.8)
    expect(splitFromPointer(400, { left: 0, width: 0 })).toBeNull()
  })
})

describe('Splitter 拖动', () => {
  function setup() {
    const bodyRef = createRef<HTMLDivElement>()
    const onChange = vi.fn()
    const utils = render(
      <div ref={bodyRef}>
        <Splitter value={0.5} onChange={onChange} bodyRef={bodyRef} />
      </div>,
    )
    mockRect(bodyRef.current!, 100, 1000)
    return { ...utils, bodyRef, onChange, sep: screen.getByRole('separator') }
  }

  it('拖动中只写 CSS 变量与 aria-valuenow，松开时提交一次', () => {
    const { bodyRef, onChange, sep } = setup()
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 600 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 400 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 450 })
    expect(onChange).not.toHaveBeenCalled()
    expect(bodyRef.current!.style.getPropertyValue('--ex-mde-split')).toBe('0.35')
    expect(sep).toHaveAttribute('aria-valuenow', '35')
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 50 })
    expect(sep).toHaveAttribute('aria-valuenow', '20')
    fireEvent.pointerUp(sep, { pointerId: 1, clientX: 50 })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(0.2)
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 700 })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('按位移换算比例：按下位置偏离分隔条时不跳动', () => {
    const { onChange, sep } = setup()
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 587 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 588 })
    expect(sep).toHaveAttribute('aria-valuenow', '50')
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 387 })
    fireEvent.pointerUp(sep, { pointerId: 1, clientX: 387 })
    expect(onChange).toHaveBeenCalledWith(0.3)
  })

  it('pointercancel 恢复拖动前的比例且不提交', () => {
    const { bodyRef, onChange, sep } = setup()
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 600 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 400 })
    fireEvent.pointerCancel(sep, { pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
    expect(bodyRef.current!.style.getPropertyValue('--ex-mde-split')).toBe('0.5')
  })

  it('拖动中卸载：移除监听，不提交', () => {
    const { onChange, sep, unmount } = setup()
    const remove = vi.spyOn(sep, 'removeEventListener')
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 600 })
    unmount()
    expect(remove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']),
    )
    fireEvent.pointerUp(sep, { pointerId: 1, clientX: 400 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('非主键按下不开始拖动', () => {
    const { onChange, sep } = setup()
    fireEvent.pointerDown(sep, { button: 2, pointerId: 1, clientX: 600 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 400 })
    fireEvent.pointerUp(sep, { pointerId: 1, clientX: 400 })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('分隔条', () => {
  it('只在比对模式渲染；方向键/Home/End 调整比例并写入 --ex-mde-split', async () => {
    renderEditor({ defaultViewMode: 'edit' })
    expect(screen.queryByRole('separator')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    const sep = screen.getByRole('separator', { name: '调整编辑区与预览区宽度' })
    expect(sep).toHaveAttribute('aria-valuenow', '50')
    expect(sep).toHaveAttribute('aria-valuemin', '20')
    expect(sep).toHaveAttribute('aria-valuemax', '80')
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
    act(() => sep.focus())
    await userEvent.keyboard('{ArrowRight}')
    expect(sep).toHaveAttribute('aria-valuenow', '52')
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.52')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(sep).toHaveAttribute('aria-valuenow', '48')
    await userEvent.keyboard('{Home}')
    expect(sep).toHaveAttribute('aria-valuenow', '20')
    await userEvent.keyboard('{End}{ArrowRight}')
    expect(sep).toHaveAttribute('aria-valuenow', '80')
  })

  it('比例变化后刷新同步滚动', () => {
    renderEditor()
    const sep = screen.getByRole('separator')
    const before = syncRefresh.calls
    act(() => {
      fireEvent.keyDown(sep, { key: 'ArrowRight' })
    })
    expect(sep).toHaveAttribute('aria-valuenow', '52')
    expect(syncRefresh.calls).toBe(before + 1)
  })

  it('PageUp/PageDown 按 10% 调整；aria-controls 指向编辑区', () => {
    renderEditor()
    const sep = screen.getByRole('separator')
    const editor = document.querySelector<HTMLElement>('.ex-mde-editor')!
    expect(editor.id).not.toBe('')
    expect(sep).toHaveAttribute('aria-controls', editor.id)
    fireEvent.keyDown(sep, { key: 'PageUp' })
    expect(sep).toHaveAttribute('aria-valuenow', '60')
    fireEvent.keyDown(sep, { key: 'PageDown' })
    fireEvent.keyDown(sep, { key: 'PageDown' })
    expect(sep).toHaveAttribute('aria-valuenow', '40')
  })

  it('拖动中 Esc 取消拖动并恢复比例，不退出全屏；方向键被忽略', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '全屏' }))
    const root = document.querySelector<HTMLElement>('.ex-mde')!
    expect(root).toHaveAttribute('data-fullscreen')
    mockRect(body(), 0, 1000)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 500 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 300 })
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.3')
    fireEvent.keyDown(sep, { key: 'ArrowRight' })
    expect(sep).toHaveAttribute('aria-valuenow', '30')
    fireEvent.keyDown(sep, { key: 'Escape' })
    expect(root).toHaveAttribute('data-fullscreen')
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.5')
    expect(sep).toHaveAttribute('aria-valuenow', '50')
    fireEvent.pointerUp(sep, { pointerId: 1, clientX: 300 })
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.5')
    fireEvent.keyDown(sep, { key: 'Escape' })
    expect(root).not.toHaveAttribute('data-fullscreen')
  })

  it('defaultSplit 超出范围时被限制', () => {
    renderEditor({ defaultSplit: 0.95 })
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '80')
  })

  it('编辑器内拖动：松开后比例保留，切换模式往返后仍为拖动结果', async () => {
    renderEditor()
    mockRect(body(), 0, 1000)
    const sep = screen.getByRole('separator')
    fireEvent.pointerDown(sep, { button: 0, pointerId: 1, clientX: 500 })
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 300 })
    fireEvent.pointerUp(sep, { pointerId: 1, clientX: 300 })
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.3')
    await userEvent.click(screen.getByRole('tab', { name: 'Markdown' }))
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '30')
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.3')
  })
})

describe('语法说明菜单项', () => {
  it('宿主移除语法面板时禁用，不切换为选中', async () => {
    renderEditor({ coreExtensions: markdownCoreExtensions.filter((ext) => ext !== syntaxPanelExtension) })
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    const item = await screen.findByRole('menuitemcheckbox', { name: '语法说明' })
    expect(item).toBeDisabled()
    expect(item).toHaveAttribute('aria-checked', 'false')
  })

  it('语法面板存在时可用', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    expect(await screen.findByRole('menuitemcheckbox', { name: '语法说明' })).toBeEnabled()
  })
})
