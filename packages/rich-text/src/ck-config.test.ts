import { describe, expect, it } from 'vitest'
import { createEditorConfig } from './ck-config'

describe('createEditorConfig', () => {
  it('使用 GPL，且不渲染 CKEditor 自己的工具栏', () => {
    const config = createEditorConfig({})
    expect(config.licenseKey).toBe('GPL')
    expect(config.toolbar).toEqual({ items: [] })
  })
})
