import { describe, expect, it } from 'vitest'
import { csdnExtensions } from './index'

describe('csdnExtensions', () => {
  it('按规格顺序导出六项，不含历史和切换编辑器', () => {
    expect(csdnExtensions.map((ext) => ext.name)).toEqual([
      'csdn:ai',
      'csdn:vote',
      'csdn:video',
      'csdn:resource',
      'csdn:inscode',
      'csdn:template',
    ])
    for (const ext of csdnExtensions) expect(ext.editors).toBeUndefined()
    const names = csdnExtensions.map((ext) => ext.name)
    expect(names).not.toContain('csdn:history')
    expect(names).not.toContain('csdn:switch-editor')
  })
})
