import { describe, expect, it } from 'vitest'
import type { TextState } from '../../types'
import { handleBackspace, handleEnter, handleKeystroke, handleTab, type KeyInfo } from './keystrokes'

function parse(marked: string): TextState {
  const caret = marked.indexOf('|')
  if (caret !== -1) return { text: marked.replace('|', ''), selection: { start: caret, end: caret } }
  const start = marked.indexOf('[[')
  const end = marked.indexOf(']]') - 2
  return { text: marked.replace('[[', '').replace(']]', ''), selection: { start, end } }
}

function show(state: TextState): string {
  const { text, selection } = state
  if (selection.start === selection.end) return text.slice(0, selection.start) + '|' + text.slice(selection.start)
  return text.slice(0, selection.start) + '[[' + text.slice(selection.start, selection.end) + ']]' + text.slice(selection.end)
}

const key = (k: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
})

describe('handleEnter', () => {
  it.each([
    ['无序列表续写', '- a|', '- a\n- |'],
    ['保留缩进与符号', '  * a|', '  * a\n  * |'],
    ['加号符号', '+ a|', '+ a\n+ |'],
    ['任务列表续写为未勾选', '- [x] a|', '- [x] a\n- [ ] |'],
    ['有序列表 +1 并保留分隔符', '9) a|', '9) a\n10) |'],
    ['有序任务列表', '1. [ ] a|', '1. [ ] a\n2. [ ] |'],
    ['空列表项回车退出列表', 'x\n- |', 'x\n|'],
    ['空任务项回车退出列表', '- [ ] |', '|'],
    ['列表项中间断行', '- ab|cd', '- ab\n- |cd'],
    ['光标在行首：普通换行', '|- a', '\n|- a'],
    ['引用续写', '> q|', '> q\n> |'],
    ['空引用行退出', '> q\n> |', '> q\n|'],
    ['普通行保持缩进', '    code|', '    code\n    |'],
    ['普通行', 'ab|c', 'ab\n|c'],
    ['选区被替换', 'a[[bc]]d', 'a\n|d'],
  ])('%s', (_name, input, expected) => {
    expect(show(handleEnter(parse(input)))).toBe(expected)
  })

  it('有序列表插入后重排同级后续编号，嵌套与空行后不动', () => {
    const input = '1. a|\n2. b\n   - sub\n3. c\n\n4. d'
    expect(show(handleEnter(parse(input)))).toBe('1. a\n2. |\n3. b\n   - sub\n4. c\n\n4. d')
  })
})

describe('handleTab', () => {
  it.each([
    ['普通行插入制表符', 'ab|c', false, 'ab\t|c'],
    ['列表行整行缩进', '- a|', false, '\t- a|'],
    ['多行选区逐行缩进', '[[a\nb]]', false, '\t[[a\n\tb]]'],
    ['反缩进去掉制表符', '\t- a|', true, '- a|'],
    ['反缩进最多 4 个空格', '      x|', true, '  x|'],
    ['多行反缩进', '[[\ta\n  b]]', true, '[[a\nb]]'],
    ['无缩进时反缩进不变', 'a|', true, 'a|'],
  ])('%s', (_name, input, outdent, expected) => {
    expect(show(handleTab(parse(input), outdent))).toBe(expected)
  })
})

describe('handleBackspace', () => {
  it.each([
    ['删除空列表项标记', '- |', '|'],
    ['保留缩进', '  1. |', '  |'],
    ['空任务项', '- [ ] |', '|'],
  ])('%s', (_name, input, expected) => {
    expect(show(handleBackspace(parse(input))!)).toBe(expected)
  })

  it.each([['- a|'], ['abc|'], ['[[- ]]'], ['- |a']])('其他情况交给浏览器：%s', (input) => {
    expect(handleBackspace(parse(input))).toBeNull()
  })
})

describe('handleKeystroke', () => {
  it('Enter / Tab / Shift+Tab 返回 single 模式', () => {
    expect(handleKeystroke(key('Enter'), parse('- a|'))).toEqual({ state: parse('- a\n- |'), mode: 'single' })
    expect(show(handleKeystroke(key('Tab'), parse('a|'))!.state)).toBe('a\t|')
    expect(show(handleKeystroke(key('Tab', { shiftKey: true }), parse('\ta|'))!.state)).toBe('a|')
  })

  it('Shift+Enter 插入纯换行，不续写列表', () => {
    expect(show(handleKeystroke(key('Enter', { shiftKey: true }), parse('- a|'))!.state)).toBe('- a\n|')
  })

  it('组合输入中或带修饰键时不处理', () => {
    expect(handleKeystroke(key('Enter', { isComposing: true }), parse('- a|'))).toBeNull()
    expect(handleKeystroke(key('Enter', { ctrlKey: true }), parse('- a|'))).toBeNull()
    expect(handleKeystroke(key('Tab', { metaKey: true }), parse('a|'))).toBeNull()
    expect(handleKeystroke(key('a'), parse('a|'))).toBeNull()
  })

  it('Backspace 不命中时返回 null', () => {
    expect(handleKeystroke(key('Backspace'), parse('ab|'))).toBeNull()
    expect(show(handleKeystroke(key('Backspace'), parse('- |'))!.state)).toBe('|')
  })
})
