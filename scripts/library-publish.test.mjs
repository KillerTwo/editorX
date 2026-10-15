import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  ['@geekx/theme', 'packages/theme/package.json'],
  ['@geekx/ui', 'packages/ui/package.json'],
  ['@geekx/toolbar', 'packages/toolbar/package.json'],
  ['@geekx/markdown-core', 'packages/markdown-core/package.json'],
  ['@geekx/markdown', 'packages/markdown/package.json'],
  ['@geekx/rich-text', 'packages/rich-text/package.json'],
  ['@geekx/publish', 'packages/publish/package.json'],
  ['@geekx/csdn-extensions', 'packages/csdn-extensions/package.json'],
  ['@geekx/csdn', 'packages/csdn/package.json'],
]

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'))
}

test('九个库可发布且 csdn 依赖 rich-text', () => {
  for (const [name, file] of PUBLISHABLE) {
    const pkg = readJson(file)
    assert.equal(pkg.name, name)
    assert.equal(Object.hasOwn(pkg, 'private'), false, name)
    assert.equal(pkg.publishConfig?.access, 'public', name)
  }

  const csdn = readJson('packages/csdn/package.json')
  assert.equal(csdn.dependencies['@geekx/rich-text'], 'workspace:*')
  assert.equal(csdn.peerDependencies['@geekx/rich-text'], undefined)
  assert.equal(csdn.peerDependenciesMeta, undefined)

  const root = readJson('package.json')
  const playground = readJson('apps/playground/package.json')
  assert.equal(root.name, 'editorx')
  assert.equal(root.private, true)
  assert.equal(playground.name, '@geekx/playground')
  assert.equal(playground.private, true)
  assert.equal(playground.publishConfig, undefined)
})
