import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { editorRoot, renderEditor } from '../test-utils'
import { clampPanelWidth } from './panel-grip'

const grip = () => screen.getByRole('separator', { name: '调整面板宽度' })
const width = () => editorRoot().style.getPropertyValue('--ex-mde-panel-width')

describe('面板宽度拖柄（G23）', () => {
  it('clampPanelWidth：夹在 300–600 并取整，非有限值回到 390', () => {
    expect(clampPanelWidth(10)).toBe(300)
    expect(clampPanelWidth(999)).toBe(600)
    expect(clampPanelWidth(412.6)).toBe(413)
    expect(clampPanelWidth(Number.NaN)).toBe(390)
  })

  it('只在右侧面板打开时渲染；aria-controls 指向面板', async () => {
    renderEditor({ defaultValue: '# 一' })
    expect(screen.queryByRole('separator', { name: '调整面板宽度' })).toBeNull()
    const rail = screen.getByRole('navigation', { name: '侧边栏' })
    await userEvent.click(within(rail).getByRole('button', { name: '目录' }))
    const panel = screen.getByRole('complementary', { name: '目录' })
    expect(grip()).toHaveAttribute('aria-controls', panel.id)
    expect(grip()).toHaveAttribute('aria-valuenow', '390')
    expect(width()).toBe('390px')
    await userEvent.click(within(rail).getByRole('button', { name: '收起' }))
    expect(screen.queryByRole('separator', { name: '调整面板宽度' })).toBeNull()
  })

  it('键盘：← 加宽 10、→ 收窄 10、Home / End 到最小 / 最大', async () => {
    renderEditor({ defaultPanel: 'toc' })
    grip().focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(grip()).toHaveAttribute('aria-valuenow', '400')
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(grip()).toHaveAttribute('aria-valuenow', '380')
    await userEvent.keyboard('{End}{ArrowLeft}')
    expect(grip()).toHaveAttribute('aria-valuenow', '600')
    await userEvent.keyboard('{Home}')
    expect(grip()).toHaveAttribute('aria-valuenow', '300')
    expect(width()).toBe('300px')
  })

  it('指针拖动：向左拖加宽，拖动中只写 CSS 变量；松开提交；pointercancel 与 Esc 恢复', () => {
    renderEditor({ defaultPanel: 'toc' })
    fireEvent.pointerDown(grip(), { button: 0, pointerId: 1, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 950 })
    expect(width()).toBe('440px')
    expect(grip()).toHaveAttribute('aria-valuenow', '440')
    fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 500 })
    expect(grip()).toHaveAttribute('aria-valuenow', '600')
    fireEvent.pointerUp(grip(), { pointerId: 1 })
    expect(width()).toBe('600px')

    fireEvent.pointerDown(grip(), { button: 0, pointerId: 2, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 2, clientX: 1200 })
    expect(grip()).toHaveAttribute('aria-valuenow', '400')
    fireEvent.pointerCancel(grip(), { pointerId: 2 })
    expect(grip()).toHaveAttribute('aria-valuenow', '600')
    expect(width()).toBe('600px')

    fireEvent.pointerDown(grip(), { button: 0, pointerId: 3, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 3, clientX: 1100 })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(width()).toBe('600px')
  })

  it('非主键按下不开始拖动', () => {
    renderEditor({ defaultPanel: 'toc' })
    fireEvent.pointerDown(grip(), { button: 2, pointerId: 1, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 900 })
    expect(width()).toBe('390px')
  })
})
