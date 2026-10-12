import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { csdnExtensions } from './index'

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }
}

function productSource(): string {
  const dir = new URL('.', import.meta.url)
  return readdirSync(dir)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes('.test.'))
    .map((name) => readFileSync(new URL(name, dir), 'utf8'))
    .join('\n')
}

describe('@editorx/csdn-extensions package', () => {
  it('只依赖 toolbar、ui、theme，导出列表包含模板', () => {
    const own = readJson('../package.json')
    const markdown = readJson('../../markdown/package.json')
    const rich = readJson('../../rich-text/package.json')
    expect(own.dependencies?.['@editorx/toolbar']).toBe('workspace:*')
    expect(own.dependencies?.['@editorx/ui']).toBe('workspace:*')
    expect(own.dependencies?.['@editorx/theme']).toBe('workspace:*')
    expect(own.dependencies?.['@editorx/csdn']).toBeUndefined()
    expect(own.dependencies?.['@editorx/markdown']).toBeUndefined()
    expect(own.dependencies?.['@editorx/rich-text']).toBeUndefined()
    expect(own.dependencies?.['@editorx/markdown-core']).toBeUndefined()
    expect(own.devDependencies?.['@editorx/csdn']).toBeUndefined()
    expect(own.devDependencies?.['@editorx/markdown']).toBeUndefined()
    expect(own.devDependencies?.['@editorx/rich-text']).toBeUndefined()
    expect(JSON.stringify(markdown)).not.toContain('@editorx/csdn-extensions')
    expect(JSON.stringify(rich)).not.toContain('@editorx/csdn-extensions')
    expect(csdnExtensions.map((ext) => ext.name)).toContain('csdn:template')
    expect(productSource()).not.toContain('阶段 7 接入')
    expect(productSource()).not.toContain('阶段 6 接入')
  })
})
