import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PublishBaseProps.templates', () => {
  it('templates 仍是这个名字，并说明它不是工具栏内容 Template', () => {
    const source = readFileSync(path.join(import.meta.dirname, 'types.ts'), 'utf8')
    expect(source).not.toContain('articleTemplates')
    const match = /\/\*\*([\s\S]*?)\*\/\s*templates\?: readonly PublishOption\[\]/.exec(source)
    expect(match).not.toBeNull()
    const doc = match?.[1] ?? ''
    expect(doc).toContain('这个属性替换默认文章模板列表')
    expect(doc).toContain('这不是工具栏内容 Template')
  })
})
