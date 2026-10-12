import { describe, expect, it } from 'vitest'
import { RICH_TEXT_TOOLBAR_LAYOUT } from './layout'

describe('RICH_TEXT_TOOLBAR_LAYOUT', () => {
  it('分组与参考图顺序一致，平台项用 csdn: 前缀', () => {
    expect(RICH_TEXT_TOOLBAR_LAYOUT).toEqual([
      ['undo', 'redo', 'csdn:history'],
      ['format', 'bold', 'color', 'background', 'other'],
      ['list', 'align', 'hr', 'quote'],
      ['code', 'csdn:resource', 'table'],
      ['image', 'csdn:video', 'math', 'link', 'csdn:template', 'toc', 'wide'],
      ['csdn:switch-editor'],
    ])
  })
})
