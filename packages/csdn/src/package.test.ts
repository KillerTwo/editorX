import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
}

describe('@geekx/csdn package', () => {
  it('直接依赖 rich-text，而 rich-text 与 publish 不反向依赖', () => {
    const csdn = readJson('../package.json')
    const rich = readJson('../../rich-text/package.json')
    const publish = readJson('../../publish/package.json')
    expect(csdn.dependencies?.['@geekx/rich-text']).toBe('workspace:*')
    expect(csdn.dependencies?.['@geekx/markdown']).toBe('workspace:*')
    expect(csdn.dependencies?.['@geekx/publish']).toBe('workspace:*')
    expect(csdn.dependencies?.['@geekx/markdown-core']).toBe('workspace:*')
    expect(csdn.peerDependenciesMeta?.['@geekx/rich-text']).toBeUndefined()
    const richText = JSON.stringify(rich)
    expect(richText).not.toContain('@geekx/csdn')
    expect(richText).not.toContain('@geekx/markdown')
    expect(richText).not.toContain('@geekx/publish')
    const publishText = JSON.stringify(publish)
    expect(publishText).not.toContain('@geekx/csdn')
    expect(publishText).not.toContain('@geekx/rich-text')
    expect(csdn.dependencies?.['@geekx/csdn-extensions']).toBe('workspace:*')
    expect(JSON.stringify(rich)).not.toContain('@geekx/csdn-extensions')
    expect(JSON.stringify(readJson('../../markdown/package.json'))).not.toContain('@geekx/csdn-extensions')
  })
})
