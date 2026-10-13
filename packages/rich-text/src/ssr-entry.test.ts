import { describe, expect, it } from 'vitest'

describe('ckeditor 模块求值', () => {
  it('加载配置模块时不调用 document.createElement', async () => {
    const original = document.createElement.bind(document)
    let calls = 0
    document.createElement = ((tagName: string) => {
      calls += 1
      return original(tagName)
    }) as typeof document.createElement
    try {
      const mod = await import('./rich-text-editor')
      expect(typeof mod.RichTextEditor).toBe('function')
      expect(calls).toBe(0)
    } finally {
      document.createElement = original
    }
  })
})
