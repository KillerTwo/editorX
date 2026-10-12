import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
}

describe('@editorx/csdn package', () => {
  it('直接依赖 rich-text，而 rich-text 与 publish 不反向依赖', () => {
    const csdn = readJson('../package.json')
    const rich = readJson('../../rich-text/package.json')
    const publish = readJson('../../publish/package.json')
    expect(csdn.dependencies?.['@editorx/rich-text']).toBe('workspace:*')
    expect(csdn.dependencies?.['@editorx/markdown']).toBe('workspace:*')
    expect(csdn.dependencies?.['@editorx/publish']).toBe('workspace:*')
    expect(csdn.dependencies?.['@editorx/markdown-core']).toBe('workspace:*')
    expect(csdn.peerDependenciesMeta?.['@editorx/rich-text']).toBeUndefined()
    const richText = JSON.stringify(rich)
    expect(richText).not.toContain('@editorx/csdn')
    expect(richText).not.toContain('@editorx/markdown')
    expect(richText).not.toContain('@editorx/publish')
    const publishText = JSON.stringify(publish)
    expect(publishText).not.toContain('@editorx/csdn')
    expect(publishText).not.toContain('@editorx/rich-text')
  })
})
