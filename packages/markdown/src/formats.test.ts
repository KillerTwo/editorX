import { describe, expect, it } from 'vitest'
import { detectFormats, formatsKey } from './formats'

const at = (marked: string) => {
  const caret = marked.indexOf('|')
  return [...detectFormats(marked.replace('|', ''), { start: caret, end: caret })].sort()
}

describe('detectFormats', () => {
  it('块级：标题级别、引用、三种列表', () => {
    expect(at('## 标|题')).toEqual(['heading', 'heading2'])
    expect(at('> 引|用')).toEqual(['quote'])
    expect(at('- 项|目')).toEqual(['unorderedList'])
    expect(at('1. 项|目')).toEqual(['orderedList'])
    expect(at('- [x] 完|成')).toEqual(['taskList'])
  })

  it('行内：光标位于标记范围内（含标记）', () => {
    expect(at('a **b|old** c')).toEqual(['bold'])
    expect(at('a *it|al* c')).toEqual(['italic'])
    expect(at('~~de|l~~')).toEqual(['strikethrough'])
    expect(at('`co|de`')).toEqual(['inlineCode'])
    expect(at('==ma|rk==')).toEqual(['mark'])
    expect(at('x^2|^')).toEqual(['superscript'])
    expect(at('H~2|~O')).toEqual(['subscript'])
  })

  it('不在标记内或位于闭合标记之后时不激活；加粗不被识别为斜体', () => {
    expect(at('**bold**| c')).toEqual([])
    expect(at('**b|old**')).not.toContain('italic')
    expect(at('~~d|el~~')).not.toContain('subscript')
  })

  it('formatsKey 与顺序无关', () => {
    expect(formatsKey(new Set(['italic', 'bold']))).toBe(formatsKey(new Set(['bold', 'italic'])))
  })
})
