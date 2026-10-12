import { zhCN } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import { titleCounter } from './title-counter'

const m = zhCN.richText

describe('titleCounter', () => {
  it('不足 5 字、够字、正好 100、超过 100', () => {
    expect(titleCounter(0, m)).toEqual({ text: '还需输入5个字', over: false })
    expect(titleCounter(4, m)).toEqual({ text: '还需输入1个字', over: false })
    expect(titleCounter(5, m)).toEqual({ text: '5 / 100', over: false })
    expect(titleCounter(100, m)).toEqual({ text: '100 / 100', over: false })
    expect(titleCounter(101, m)).toEqual({ text: '101/100', over: true })
  })
})
