import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitSections } from '../sections'
import { ClEditEngine } from './cl-edit-engine'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function setup(value = '', extra: { placeholder?: string; readOnly?: boolean } = {}) {
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

  it('readOnly 与 placeholder', () => {
    const { content, engine } = setup('', { placeholder: '请输入', readOnly: true })
    expect(content.getAttribute('contenteditable')).toBe('false')
    expect(content.getAttribute('aria-readonly')).toBe('true')
    expect(content.dataset.placeholder).toBe('请输入')
    expect(content.hasAttribute('data-empty')).toBe(true)
    engine.setValue('x')
    expect(content.hasAttribute('data-empty')).toBe(false)
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
})
