import { describe, expect, it } from 'vitest'
import { RICH_TEXT_TOOLBAR_LAYOUT } from './layout'

describe('RICH_TEXT_TOOLBAR_LAYOUT', () => {
  it('参考图分组顺序不变，投票和 InsCode 单独成组', () => {
    expect(RICH_TEXT_TOOLBAR_LAYOUT).toEqual([
      ['undo', 'redo', 'csdn:history'],
      ['format', 'bold', 'color', 'background', 'other'],
      ['list', 'align', 'hr', 'quote'],
      ['code', 'csdn:resource', 'table'],
      ['image', 'csdn:video', 'math', 'link', 'csdn:template', 'toc', 'wide'],
      ['csdn:vote', 'csdn:inscode'],
      ['csdn:switch-editor'],
    ])
  })
})
