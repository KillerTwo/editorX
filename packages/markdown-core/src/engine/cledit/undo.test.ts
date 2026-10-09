import { describe, expect, it } from 'vitest'
import { UndoManager } from './undo'
import { applyChange, diffRange } from './utils'

function makeClock() {
  let t = 0
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

function edit(um: UndoManager, text: string, next: string, mode: 'typing' | 'deleting' | 'single') {
  const change = diffRange(text, next)!
  const before = { start: change.start, end: change.start + change.removed.length }
  const caret = change.start + change.inserted.length
  um.record(change, before, { start: caret, end: caret }, mode)
  return applyChange(text, change)
}

describe('UndoManager', () => {
  it('合并窗口内的连续输入合并为一步', () => {
    const clock = makeClock()
    const um = new UndoManager({ now: clock.now })
    let text = ''
    text = edit(um, text, 'a', 'typing')
    clock.advance(100)
    text = edit(um, text, 'ab', 'typing')
    clock.advance(100)
    text = edit(um, text, 'abc', 'typing')
    const undone = um.undo(text)!
    expect(undone.text).toBe('')
    expect(undone.selection).toEqual({ start: 0, end: 0 })
    expect(um.canUndo()).toBe(false)
  })

  it('超过合并窗口或模式变化时拆成多步', () => {
    const clock = makeClock()
    const um = new UndoManager({ now: clock.now, mergeWindowMs: 1000 })
    let text = 'x'
    text = edit(um, text, 'xa', 'typing')
    clock.advance(1500)
    text = edit(um, text, 'xab', 'typing')
    text = edit(um, text, 'xa', 'deleting')
    let s = um.undo(text)!
    expect(s.text).toBe('xab')
    s = um.undo(s.text)!
    expect(s.text).toBe('xa')
    s = um.undo(s.text)!
    expect(s.text).toBe('x')
    expect(um.undo(s.text)).toBeNull()
  })

  it('single 模式永不合并；breakMerge 强制断开', () => {
    const um = new UndoManager({ now: () => 0 })
    let text = ''
    text = edit(um, text, 'a', 'single')
    text = edit(um, text, 'ab', 'single')
    text = edit(um, text, 'abc', 'typing')
    um.breakMerge()
    text = edit(um, text, 'abcd', 'typing')
    const steps: string[] = []
    let s = um.undo(text)
    while (s) {
      steps.push(s.text)
      s = um.undo(s.text)
    }
    expect(steps).toEqual(['abc', 'ab', 'a', ''])
  })

  it('redo 恢复文本与选区；新编辑清空 redo 栈', () => {
    const um = new UndoManager({ now: () => 0 })
    let text = edit(um, 'hello', 'hello world', 'single')
    const undone = um.undo(text)!
    expect(undone.text).toBe('hello')
    expect(undone.selection).toEqual({ start: 5, end: 5 })
    expect(um.canRedo()).toBe(true)
    const redone = um.redo(undone.text)!
    expect(redone.text).toBe('hello world')
    expect(redone.selection).toEqual({ start: 11, end: 11 })
    text = redone.text
    um.undo(text)
    text = edit(um, 'hello', 'hello!', 'single')
    expect(um.canRedo()).toBe(false)
    expect(text).toBe('hello!')
  })

  it('超过 maxSize 时丢弃最旧条目', () => {
    const um = new UndoManager({ now: () => 0, maxSize: 2 })
    let text = ''
    for (const ch of ['a', 'b', 'c']) text = edit(um, text, text + ch, 'single')
    let s = um.undo(text)!
    s = um.undo(s.text)!
    expect(s.text).toBe('a')
    expect(um.undo(s.text)).toBeNull()
  })

  it('clear 清空两个栈', () => {
    const um = new UndoManager()
    edit(um, '', 'a', 'single')
    um.clear()
    expect(um.canUndo()).toBe(false)
    expect(um.canRedo()).toBe(false)
  })
})
