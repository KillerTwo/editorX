import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  ['@editorx/theme', 'packages/theme/package.json'],
  ['@editorx/ui', 'packages/ui/package.json'],
  ['@editorx/toolbar', 'packages/toolbar/package.json'],
  ['@editorx/markdown-core', 'packages/markdown-core/package.json'],
  ['@editorx/markdown', 'packages/markdown/package.json'],
  ['@editorx/rich-text', 'packages/rich-text/package.json'],
  ['@editorx/publish', 'packages/publish/package.json'],
  ['@editorx/csdn-extensions', 'packages/csdn-extensions/package.json'],
  ['@editorx/csdn', 'packages/csdn/package.json'],
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
  assert.equal(csdn.dependencies['@editorx/rich-text'], 'workspace:*')
  assert.equal(csdn.peerDependencies['@editorx/rich-text'], undefined)
  assert.equal(csdn.peerDependenciesMeta, undefined)

  const root = readJson('package.json')
  const playground = readJson('apps/playground/package.json')
  assert.equal(root.name, 'editorx')
  assert.equal(root.private, true)
  assert.equal(playground.name, '@editorx/playground')
  assert.equal(playground.private, true)
  assert.equal(playground.publishConfig, undefined)
})
