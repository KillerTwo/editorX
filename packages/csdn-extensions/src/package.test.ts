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

describe('@geekx/csdn-extensions package', () => {
  it('只依赖 toolbar、ui、theme，导出列表包含模板', () => {
    const own = readJson('../package.json')
    const markdown = readJson('../../markdown/package.json')
    const rich = readJson('../../rich-text/package.json')
    expect(own.dependencies?.['@geekx/toolbar']).toBe('workspace:*')
    expect(own.dependencies?.['@geekx/ui']).toBe('workspace:*')
    expect(own.dependencies?.['@geekx/theme']).toBe('workspace:*')
    expect(own.dependencies?.['@geekx/csdn']).toBeUndefined()
    expect(own.dependencies?.['@geekx/markdown']).toBeUndefined()
    expect(own.dependencies?.['@geekx/rich-text']).toBeUndefined()
    expect(own.dependencies?.['@geekx/markdown-core']).toBeUndefined()
    expect(own.devDependencies?.['@geekx/csdn']).toBeUndefined()
    expect(own.devDependencies?.['@geekx/markdown']).toBeUndefined()
    expect(own.devDependencies?.['@geekx/rich-text']).toBeUndefined()
    expect(JSON.stringify(markdown)).not.toContain('@geekx/csdn-extensions')
    expect(JSON.stringify(rich)).not.toContain('@geekx/csdn-extensions')
    expect(csdnExtensions.map((ext) => ext.name)).toContain('csdn:template')
    expect(productSource()).not.toContain('阶段 7 接入')
    expect(productSource()).not.toContain('阶段 6 接入')
  })
})
