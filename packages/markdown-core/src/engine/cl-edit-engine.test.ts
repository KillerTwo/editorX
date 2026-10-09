import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { splitSections } from '../sections'
import type { EngineOptions, Selection } from '../types'
import { ClEditEngine } from './cl-edit-engine'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function setup(value = '', extra: Omit<EngineOptions, 'value'> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const engine = new ClEditEngine()
  engine.mount(host, { value, ...extra })
  const content = host.querySelector<HTMLElement>('.ex-editor-content')!
  const changes: unknown[] = []
  engine.on('change', (v) => changes.push(v))
  return { host, engine, content, changes }
}

function textNodeContaining(root: Node, needle: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent!.includes(needle)) return n as Text
  throw new Error(`找不到文本节点：${needle}`)
}

function typeInto(node: Text, search: string, insert: string) {
  const at = node.data.indexOf(search) + search.length
  node.data = node.data.slice(0, at) + insert + node.data.slice(at)
  const range = document.createRange()
  range.setStart(node, at + insert.length)
  range.collapse(true)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
}

function keydown(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(ev)
  return ev
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

describe('ClEditEngine 挂载', () => {
  it('渲染分段高亮且 DOM 文本 = value + \\n', () => {
    const doc = '# A\n\nx\n## B\n\ny'
    const { host, engine, content } = setup(doc)
    expect(host.classList.contains('ex-editor')).toBe(true)
    expect(content.getAttribute('role')).toBe('textbox')
    expect(['plaintext-only', 'true']).toContain(content.getAttribute('contenteditable'))
    expect(content.textContent).toBe(doc + '\n')
    expect(content.querySelectorAll('.ex-editor-section')).toHaveLength(splitSections(doc).length)
    expect(engine.getValue()).toBe(doc)
    expect(engine.contentElement).toBe(content)
  })

  it('各段按行数 × 编辑区行高设置 contain-intrinsic-size，读不到行高时用默认值', async () => {
    const intrinsic = (content: HTMLElement) =>
      [...content.querySelectorAll<HTMLElement>('.ex-editor-section')].map((s) =>
        s.style.getPropertyValue('contain-intrinsic-size'),
      )
    const style = document.createElement('style')
    style.textContent = '.ex-editor-content { line-height: 20px; }'
    document.head.appendChild(style)
    try {
      const { engine, content } = setup('# A\n\nx\n## B\n\ny')
      expect(intrinsic(content)).toEqual(['auto 60px', 'auto 60px'])
      content.focus()
      typeInto(textNodeContaining(content, 'y'), 'y', '\nz')
      await flush()
      expect(engine.getValue()).toBe('# A\n\nx\n## B\n\ny\nz')
      expect(intrinsic(content)).toEqual(['auto 60px', 'auto 80px'])
    } finally {
      style.remove()
    }
    const { content } = setup('a\nb')
    expect(intrinsic(content)[0]).toMatch(/^auto \d+(\.\d+)?px$/)
  })

  it('readOnly 与 placeholder', () => {
    const { content, engine } = setup('', { placeholder: '请输入', readOnly: true })
    expect(content.getAttribute('contenteditable')).toBe('false')
    expect(content.getAttribute('aria-readonly')).toBe('true')
    expect(content.dataset.placeholder).toBe('请输入')
    expect(content.hasAttribute('data-empty')).toBe(true)
    engine.setValue('x')
    expect(content.hasAttribute('data-empty')).toBe(false)
  })

  it('aria-label 与 aria-placeholder 来自挂载选项', () => {
    const { content } = setup('', { placeholder: '请输入', ariaLabel: 'Markdown 编辑区' })
    expect(content.getAttribute('aria-label')).toBe('Markdown 编辑区')
    expect(content.getAttribute('aria-placeholder')).toBe('请输入')
    const plain = setup('x').content
    expect(plain.hasAttribute('aria-label')).toBe(false)
    expect(plain.hasAttribute('aria-placeholder')).toBe(false)
  })

  it('destroy 移除内容并停止派发事件', async () => {
    const { host, engine, content, changes } = setup('a')
    const node = textNodeContaining(content, 'a')
    engine.destroy()
    expect(host.querySelector('.ex-editor-content')).toBeNull()
    expect(host.classList.contains('ex-editor')).toBe(false)
    node.data = 'ab'
    await flush()
    expect(changes).toEqual([])
  })
})

describe('ClEditEngine API', () => {
  it('setValue 不派发 change 且清空撤销；keepUndo 可撤销', () => {
    const { engine, changes } = setup('a')
    engine.replace(1, 1, 'b')
    engine.setValue('new')
    expect(engine.getValue()).toBe('new')
    engine.undo()
    expect(engine.getValue()).toBe('new')
    engine.setValue('newer', { keepUndo: true })
    engine.undo()
    expect(engine.getValue()).toBe('new')
    expect(changes).toEqual(['ab', 'new'])
  })

  it('replace 派发 change、光标落在插入文本后，undo/redo 往返', () => {
    const { engine, changes, content } = setup('hello')
    engine.replace(5, 5, ' world')
    expect(engine.getValue()).toBe('hello world')
    expect(engine.getSelection()).toEqual({ start: 11, end: 11 })
    expect(content.textContent).toBe('hello world\n')
    engine.undo()
    expect(engine.getValue()).toBe('hello')
    engine.redo()
    expect(engine.getValue()).toBe('hello world')
    expect(changes).toEqual(['hello world', 'hello', 'hello world'])
  })

  it('setSelection 夹取并规范化，派发 selectionChange；on 返回取消订阅', () => {
    const { engine } = setup('abc')
    const seen: unknown[] = []
    const off = engine.on('selectionChange', (s) => seen.push(s))
    engine.setSelection(5, -1)
    expect(engine.getSelection()).toEqual({ start: 0, end: 3 })
    off()
    engine.setSelection(1, 1)
    expect(seen).toEqual([{ start: 0, end: 3 }])
  })

  it('getCursorPosition：1 起行号、0 起列号，取选区结束处', () => {
    const { engine } = setup('第一行\nab\n\nxyz')
    expect(engine.getCursorPosition()).toEqual({ line: 1, column: 0 })
    engine.setSelection(3, 3)
    expect(engine.getCursorPosition()).toEqual({ line: 1, column: 3 })
    engine.setSelection(4, 4)
    expect(engine.getCursorPosition()).toEqual({ line: 2, column: 0 })
    engine.setSelection(9, 1)
    expect(engine.getCursorPosition()).toEqual({ line: 4, column: 1 })
    engine.setSelection(7, 7)
    expect(engine.getCursorPosition()).toEqual({ line: 3, column: 0 })
    engine.replace(10, 10, '!')
    expect(engine.getCursorPosition()).toEqual({ line: 4, column: 3 })
    engine.setValue('\nx')
    engine.setSelection(0, 0)
    expect(engine.getCursorPosition()).toEqual({ line: 1, column: 0 })
  })

  it('getSectionOffsets 以宿主滚动内容为基准', () => {
    const doc = '# A\n\nx\n## B\n\ny'
    const { host, engine } = setup(doc)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = this.dataset.sectionIndex
      const top = i === undefined ? 10 : 10 + Number(i) * 40 - 25
      const height = i === undefined ? 500 : 40
      return { top, height, left: 0, width: 100, right: 100, bottom: top + height, x: 0, y: top, toJSON() {} } as DOMRect
    })
    Object.defineProperty(host, 'scrollTop', { value: 25, configurable: true })
    expect(engine.getSectionOffsets()).toEqual(
      splitSections(doc).map((s, i) => ({ start: s.start, end: s.end, top: i * 40, height: 40 })),
    )
  })

  it('换行统一为 LF 并去除 U+0000（mount / setValue / replace）', () => {
    const { engine, content } = setup('a\r\nb\rc\u0000d')
    expect(engine.getValue()).toBe('a\nb\ncd')
    expect(content.textContent).toBe('a\nb\ncd\n')
    engine.setValue('x\r\ny')
    expect(engine.getValue()).toBe('x\ny')
    engine.replace(3, 3, '\r\nz\u0000')
    expect(engine.getValue()).toBe('x\ny\nz')
    expect(engine.getSelection()).toEqual({ start: 5, end: 5 })
    expect(content.textContent).toBe('x\ny\nz\n')
  })

  it('聚焦时反向 DOM 选区也返回 start <= end', () => {
    const { engine, content } = setup('abcdef')
    content.focus()
    engine.setSelection(4, 1)
    expect(window.getSelection()!.anchorOffset).toBeGreaterThan(window.getSelection()!.focusOffset)
    expect(engine.getSelection()).toEqual({ start: 1, end: 4 })
  })

  it('setValue(keepUndo) 重新高亮后保留 DOM 选区', () => {
    const { engine, content } = setup('# T\n\nabc def')
    content.focus()
    engine.setSelection(5, 8)
    engine.setValue('# T\n\nabc def!', { keepUndo: true })
    expect(window.getSelection()!.toString()).toBe('abc')
    expect(engine.getSelection()).toEqual({ start: 5, end: 8 })
  })

  it('空文档的光标落在段内文本节点', () => {
    const { engine, content } = setup('')
    content.focus()
    engine.setSelection(0, 0)
    const anchor = window.getSelection()!.anchorNode!
    expect(anchor.nodeType).toBe(Node.TEXT_NODE)
    expect(anchor.parentElement!.closest('.ex-editor-section')).not.toBeNull()
    expect(engine.getSelection()).toEqual({ start: 0, end: 0 })
  })

  it('程序化编辑前先同步尚未投递的 DOM 变更', async () => {
    const { engine, content, changes } = setup('abc')
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', 'X')
    engine.replace(0, 0, '>')
    expect(engine.getValue()).toBe('>abcX')
    await flush()
    expect(engine.getValue()).toBe('>abcX')
    expect(changes).toEqual(['abcX', '>abcX'])
    engine.undo()
    expect(engine.getValue()).toBe('abcX')
  })
})

describe('ClEditEngine 输入', () => {
  it('DOM 变更同步为 value，重新高亮并可撤销', async () => {
    const { engine, content, changes } = setup('# T\n\nabc')
    content.focus()
    const node = textNodeContaining(content, 'abc')
    typeInto(node, 'abc', 'X')
    await flush()
    expect(engine.getValue()).toBe('# T\n\nabcX')
    expect(changes).toEqual(['# T\n\nabcX'])
    expect(engine.getSelection()).toEqual({ start: 9, end: 9 })
    expect(content.contains(node)).toBe(false)
    expect(content.textContent).toBe('# T\n\nabcX\n')
    engine.undo()
    expect(engine.getValue()).toBe('# T\n\nabc')
  })

  it('DOM 中的 CR 被规范化，光标偏移随之换算', async () => {
    const { engine, content } = setup('# T\n\nabc')
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', '\r\nX')
    await flush()
    expect(engine.getValue()).toBe('# T\n\nabc\nX')
    expect(content.textContent).toBe('# T\n\nabc\nX\n')
    expect(engine.getSelection()).toEqual({ start: 10, end: 10 })
  })

  it('一次 DOM 同步最多写一次原生选区', async () => {
    const { engine, content } = setup('# T\n\nabc')
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', 'X')
    const add = vi.spyOn(window.getSelection()!, 'addRange')
    await flush()
    expect(engine.getValue()).toBe('# T\n\nabcX')
    expect(add.mock.calls.length).toBeLessThanOrEqual(1)
    expect(engine.getSelection()).toEqual({ start: 9, end: 9 })
  })

  it('Ctrl/Cmd+Home/End 由引擎移动光标并滚动（Shift 扩展选区），不依赖原生布局', () => {
    const { engine, content, host } = setup('# A\n\nx\n## B\n\ny')
    let top = 0
    Object.defineProperties(host, {
      scrollTop: { get: () => top, set: (v: number) => (top = v), configurable: true },
      scrollHeight: { value: 500, configurable: true },
    })
    content.focus()
    engine.setSelection(5, 5)
    const selections: unknown[] = []
    engine.on('selectionChange', (s) => selections.push(s))

    const end = keydown(content, 'End', { ctrlKey: true })
    expect(end.defaultPrevented).toBe(true)
    expect(engine.getSelection()).toEqual({ start: 14, end: 14 })
    expect(top).toBe(500)
    expect(selections).toEqual([{ start: 14, end: 14 }])

    const home = keydown(content, 'Home', { metaKey: true, shiftKey: true })
    expect(home.defaultPrevented).toBe(true)
    expect(engine.getSelection()).toEqual({ start: 0, end: 14 })
    expect(window.getSelection()!.toString()).toBe('# A\n\nx\n## B\n\ny')
    expect(top).toBe(0)

    expect(keydown(content, 'End').defaultPrevented).toBe(false)
    expect(keydown(content, 'End', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
  })

  it('macOS：Cmd+ArrowUp/ArrowDown 移到文首/文末（Shift 扩展），Ctrl/Alt 组合不处理', () => {
    const { engine, content } = setup('# A\n\nx\n## B\n\ny')
    content.focus()
    engine.setSelection(5, 5)
    const down = keydown(content, 'ArrowDown', { metaKey: true })
    expect(down.defaultPrevented).toBe(true)
    expect(engine.getSelection()).toEqual({ start: 14, end: 14 })
    const up = keydown(content, 'ArrowUp', { metaKey: true, shiftKey: true })
    expect(up.defaultPrevented).toBe(true)
    expect(engine.getSelection()).toEqual({ start: 0, end: 14 })
    expect(keydown(content, 'ArrowDown').defaultPrevented).toBe(false)
    expect(keydown(content, 'ArrowDown', { metaKey: true, ctrlKey: true }).defaultPrevented).toBe(false)
    expect(keydown(content, 'ArrowDown', { metaKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(keydown(content, 'ArrowDown', { ctrlKey: true }).defaultPrevented).toBe(false)
  })

  it('文末的延迟二次滚动：期间用户滚动过或引擎已销毁则跳过', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb))
    const runFrames = () => {
      while (frames.length) frames.shift()!(0)
    }
    const { engine, content, host } = setup('# A\n\nx\n## B\n\ny')
    let top = 0
    let height = 500
    Object.defineProperties(host, {
      scrollTop: { get: () => top, set: (v: number) => (top = v), configurable: true },
      scrollHeight: { get: () => height, configurable: true },
    })
    content.focus()

    keydown(content, 'End', { ctrlKey: true })
    expect(top).toBe(500)
    height = 800
    runFrames()
    expect(top).toBe(800)

    keydown(content, 'End', { ctrlKey: true })
    height = 900
    top = 300
    runFrames()
    expect(top).toBe(300)

    keydown(content, 'End', { ctrlKey: true })
    height = 1000
    engine.destroy()
    runFrames()
    expect(top).toBe(900)
  })

  it('Enter 续写列表并阻止默认行为', () => {
    const { engine, content } = setup('- a')
    content.focus()
    engine.setSelection(3, 3)
    const ev = keydown(content, 'Enter')
    expect(ev.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('- a\n- ')
    expect(engine.getSelection()).toEqual({ start: 6, end: 6 })
  })

  it('围栏代码块内 Enter 只插入换行（保留缩进），不续写列表', () => {
    const { engine, content } = setup('```\n  - a')
    content.focus()
    engine.setSelection(9, 9)
    const ev = keydown(content, 'Enter')
    expect(ev.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('```\n  - a\n  ')
    expect(engine.getSelection()).toEqual({ start: 12, end: 12 })
  })

  it('围栏内的有序列表不被续写或重新编号；围栏闭合后恢复续写', () => {
    const doc = '```\n1. a\n2. b\n```\n1. x'
    const { engine, content } = setup(doc)
    content.focus()
    engine.setSelection(8, 8)
    keydown(content, 'Enter')
    expect(engine.getValue()).toBe('```\n1. a\n\n2. b\n```\n1. x')
    engine.setSelection(engine.getValue().length, engine.getValue().length)
    keydown(content, 'Enter')
    expect(engine.getValue()).toBe('```\n1. a\n\n2. b\n```\n1. x\n2. ')
  })

  it('Escape 后的下一次 Tab 不拦截（键盘可离开编辑区）', () => {
    const { engine, content } = setup('a')
    content.focus()
    engine.setSelection(1, 1)
    keydown(content, 'Escape')
    keydown(content, 'Shift', { shiftKey: true })
    const free = keydown(content, 'Tab', { shiftKey: true })
    expect(free.defaultPrevented).toBe(false)
    expect(engine.getValue()).toBe('a')
    const trapped = keydown(content, 'Tab')
    expect(trapped.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('a\t')
  })

  it('Ctrl+Z / Ctrl+Shift+Z 走引擎撤销栈', () => {
    const { engine, content } = setup('a')
    engine.replace(1, 1, 'b')
    const undo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
    content.dispatchEvent(undo)
    expect(undo.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('a')
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))
    expect(engine.getValue()).toBe('ab')
  })

  it('IME：组合期间不同步不重绘，compositionend 一次性提交', async () => {
    const { engine, content, changes } = setup('# T\n\nabc')
    content.focus()
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(engine.isComposing()).toBe(true)
    const node = textNodeContaining(content, 'abc')
    typeInto(node, 'abc', 'ni')
    await flush()
    typeInto(node, 'abcni', 'hao')
    await flush()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    content.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
    expect(engine.getValue()).toBe('# T\n\nabc')
    expect(changes).toEqual([])
    expect(content.contains(node)).toBe(true)
    node.data = node.data.replace('nihao', '你好')
    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
    expect(engine.isComposing()).toBe(false)
    expect(engine.getValue()).toBe('# T\n\nabc你好')
    expect(changes).toEqual(['# T\n\nabc你好'])
    expect(content.contains(node)).toBe(false)
    engine.undo()
    expect(engine.getValue()).toBe('# T\n\nabc')
  })

  it('IME：组合中调用 replace 先提交组合文本，之后 compositionend 不重复', async () => {
    const { engine, content, changes } = setup('# T\n\nabc')
    content.focus()
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    typeInto(textNodeContaining(content, 'abc'), 'abc', '你好')
    await flush()
    engine.replace(0, 0, '>')
    expect(engine.isComposing()).toBe(false)
    expect(engine.getValue()).toBe('># T\n\nabc你好')
    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
    await flush()
    expect(engine.getValue()).toBe('># T\n\nabc你好')
    expect(changes).toEqual(['# T\n\nabc你好', '># T\n\nabc你好'])
    engine.undo()
    expect(engine.getValue()).toBe('# T\n\nabc你好')
    engine.undo()
    expect(engine.getValue()).toBe('# T\n\nabc')
  })

  it('IME：组合中 setValue / undo 先提交组合文本', async () => {
    const { engine, content } = setup('abc')
    content.focus()
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    typeInto(textNodeContaining(content, 'abc'), 'abc', '好')
    await flush()
    engine.undo()
    expect(engine.isComposing()).toBe(false)
    expect(engine.getValue()).toBe('abc')
    engine.redo()
    expect(engine.getValue()).toBe('abc好')
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    typeInto(textNodeContaining(content, 'abc好'), 'abc好', '!')
    engine.setValue('z', { keepUndo: true })
    expect(engine.isComposing()).toBe(false)
    engine.undo()
    expect(engine.getValue()).toBe('abc好!')
  })

  it('IME：组合期间 beforeinput historyUndo 不处理', () => {
    const { engine, content } = setup('a')
    engine.replace(1, 1, 'b')
    content.focus()
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const ev = new InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true })
    content.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    expect(engine.getValue()).toBe('ab')
    expect(engine.isComposing()).toBe(true)
  })

  it('IME：组合中失焦即提交，之后按键正常', async () => {
    const { engine, content, changes } = setup('- a')
    content.focus()
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    typeInto(textNodeContaining(content, 'a'), 'a', '好')
    await flush()
    content.blur()
    expect(engine.isComposing()).toBe(false)
    expect(changes).toEqual(['- a好'])
    content.focus()
    engine.setSelection(4, 4)
    const enter = keydown(content, 'Enter')
    expect(enter.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('- a好\n- ')
  })

  it('撤销分组：输入后粘贴是两步', async () => {
    const { engine, content } = setup('abc')
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', 'X')
    await flush()
    content.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    typeInto(textNodeContaining(content, 'abcX'), 'abcX', 'PP')
    await flush()
    typeInto(textNodeContaining(content, 'abcXPP'), 'abcXPP', 'Y')
    await flush()
    expect(engine.getValue()).toBe('abcXPPY')
    engine.undo()
    expect(engine.getValue()).toBe('abcXPP')
    engine.undo()
    expect(engine.getValue()).toBe('abcX')
    engine.undo()
    expect(engine.getValue()).toBe('abc')
  })

  it('撤销分组：输入、点击别处、再输入是两步', async () => {
    const { engine, content } = setup('abc def')
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', 'X')
    await flush()
    const node = textNodeContaining(content, 'def')
    const range = document.createRange()
    range.setStart(node, node.data.indexOf('def') + 3)
    range.collapse(true)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    typeInto(textNodeContaining(content, 'def'), 'def', 'Y')
    await flush()
    expect(engine.getValue()).toBe('abcX defY')
    engine.undo()
    expect(engine.getValue()).toBe('abcX def')
    engine.undo()
    expect(engine.getValue()).toBe('abc def')
  })

  it('readOnly 时不转发 paste / drop', () => {
    const { engine, content } = setup('a', { readOnly: true })
    const got: unknown[] = []
    engine.on('paste', (e) => got.push(e))
    engine.on('drop', (e) => got.push(e))
    content.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    content.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
    expect(got).toEqual([])
  })

  it('Escape 的一次性放行在 mousedown / blur 后失效', () => {
    const { engine, content } = setup('a')
    content.focus()
    engine.setSelection(1, 1)
    keydown(content, 'Escape')
    content.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(keydown(content, 'Tab').defaultPrevented).toBe(true)
    keydown(content, 'Escape')
    content.blur()
    content.focus()
    expect(keydown(content, 'Tab').defaultPrevented).toBe(true)
  })

  it('paste / drop / scroll 事件转发', () => {
    const { host, engine, content } = setup('a')
    const got: Array<[string, unknown]> = []
    engine.on('paste', (e) => got.push(['paste', e]))
    engine.on('drop', (e) => got.push(['drop', e]))
    engine.on('scroll', (e) => got.push(['scroll', e]))
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    content.dispatchEvent(paste)
    content.dispatchEvent(drop)
    host.dispatchEvent(new Event('scroll'))
    expect(got).toEqual([
      ['paste', paste],
      ['drop', drop],
      ['scroll', { scrollTop: 0 }],
    ])
  })

  it('on() 的回调参数按事件推断类型', () => {
    const { engine } = setup('a')
    const seen: Array<[string, unknown]> = []
    engine.on('change', (value) => {
      expectTypeOf(value).toEqualTypeOf<string>()
      seen.push(['change', value])
    })
    engine.on('selectionChange', (sel) => {
      expectTypeOf(sel).toEqualTypeOf<Selection>()
      seen.push(['selectionChange', sel])
    })
    engine.on('scroll', (e) => expectTypeOf(e).toEqualTypeOf<{ scrollTop: number }>())
    engine.replace(1, 1, 'b')
    expect(seen).toEqual([
      ['change', 'ab'],
      ['selectionChange', { start: 2, end: 2 }],
    ])
  })
})

describe('ClEditEngine 生命周期', () => {
  it('destroy 后重新 mount：订阅仍有效，用户输入照常派发 change', async () => {
    const { host, engine, changes } = setup('abc')
    engine.destroy()
    expect(engine.getValue()).toBe('abc')
    engine.mount(host, { value: 'abc' })
    const content = engine.contentElement!
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', 'X')
    await flush()
    expect(changes).toEqual(['abcX'])
  })

  it('对已挂载引擎再次 mount 不丢订阅', () => {
    const { host, engine, changes } = setup('a')
    engine.mount(host, { value: 'b' })
    engine.replace(1, 1, 'c')
    expect(changes).toEqual(['bc'])
  })

  it('以相同内容重新挂载时保留撤销历史，内容不同则清空', () => {
    const { host, engine } = setup('a')
    engine.replace(1, 1, 'b')
    engine.destroy()
    engine.mount(host, { value: 'ab' })
    engine.undo()
    expect(engine.getValue()).toBe('a')
    engine.mount(host, { value: 'zzz' })
    engine.undo()
    expect(engine.getValue()).toBe('zzz')
  })

  it('setReadOnly 原地切换只读，保留内容、选区与撤销历史', () => {
    const { engine, content } = setup('- a')
    const got: unknown[] = []
    engine.on('paste', (e) => got.push(e))
    engine.on('drop', (e) => got.push(e))
    engine.replace(3, 3, 'b')
    content.focus()
    engine.setSelection(4, 4)

    engine.setReadOnly(true)
    expect(engine.contentElement).toBe(content)
    expect(content.getAttribute('contenteditable')).toBe('false')
    expect(content.getAttribute('aria-readonly')).toBe('true')
    expect(keydown(content, 'Enter').defaultPrevented).toBe(false)
    expect(keydown(content, 'z', { ctrlKey: true }).defaultPrevented).toBe(false)
    content.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    content.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
    expect(got).toEqual([])
    expect(engine.getValue()).toBe('- ab')
    expect(engine.getSelection()).toEqual({ start: 4, end: 4 })

    engine.setReadOnly(false)
    expect(['plaintext-only', 'true']).toContain(content.getAttribute('contenteditable'))
    expect(content.hasAttribute('aria-readonly')).toBe(false)
    expect(engine.getSelection()).toEqual({ start: 4, end: 4 })
    expect(keydown(content, 'Enter').defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('- ab\n- ')
    engine.undo()
    engine.undo()
    expect(engine.getValue()).toBe('- a')
    content.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    expect(got).toHaveLength(1)
  })

  it('setReadOnly 在挂载前调用也生效，mount 选项优先', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const engine = new ClEditEngine()
    engine.setReadOnly(true)
    engine.setPlaceholder('稍后挂载')
    engine.mount(host, { value: '' })
    const content = engine.contentElement!
    expect(content.getAttribute('contenteditable')).toBe('false')
    expect(content.dataset.placeholder).toBe('稍后挂载')
    engine.mount(host, { value: '', readOnly: false, placeholder: '选项' })
    expect(engine.contentElement!.getAttribute('contenteditable')).not.toBe('false')
    expect(engine.contentElement!.dataset.placeholder).toBe('选项')
  })

  it('setPlaceholder 原地更新 data-placeholder / aria-placeholder，不影响空状态', () => {
    const { engine, content } = setup('')
    expect(content.hasAttribute('data-placeholder')).toBe(false)
    engine.setPlaceholder('写点什么')
    expect(content.dataset.placeholder).toBe('写点什么')
    expect(content.getAttribute('aria-placeholder')).toBe('写点什么')
    expect(content.hasAttribute('data-empty')).toBe(true)
    engine.setPlaceholder(undefined)
    expect(content.hasAttribute('data-placeholder')).toBe(false)
    expect(content.hasAttribute('aria-placeholder')).toBe(false)
    expect(engine.contentElement).toBe(content)
  })

  it('setAriaLabel 原地更新 aria-label', () => {
    const { engine, content } = setup('')
    engine.setAriaLabel('正文')
    expect(content.getAttribute('aria-label')).toBe('正文')
    engine.setAriaLabel(undefined)
    expect(content.hasAttribute('aria-label')).toBe(false)
  })
})

describe('ClEditEngine 撤销边界', () => {
  it('setSelection 改变光标后再输入是新的一步撤销', async () => {
    const { engine, content } = setup('abc')
    content.focus()
    typeInto(textNodeContaining(content, 'abc'), 'abc', 'X')
    await flush()
    engine.setSelection(0, 0)
    typeInto(textNodeContaining(content, 'abcX'), '', 'Y')
    await flush()
    expect(engine.getValue()).toBe('YabcX')
    engine.undo()
    expect(engine.getValue()).toBe('abcX')
  })

  it('setValue 传入相同内容时不清空撤销、不重建 DOM', () => {
    const { engine, content } = setup('a')
    engine.replace(1, 1, 'b')
    const section = content.querySelector('.ex-editor-section')
    engine.setValue('ab')
    expect(content.querySelector('.ex-editor-section')).toBe(section)
    engine.undo()
    expect(engine.getValue()).toBe('a')
  })
})
