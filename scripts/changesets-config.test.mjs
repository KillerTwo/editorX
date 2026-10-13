import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  '@editorx/theme',
  '@editorx/ui',
  '@editorx/toolbar',
  '@editorx/markdown-core',
  '@editorx/markdown',
  '@editorx/rich-text',
  '@editorx/publish',
  '@editorx/csdn-extensions',
  '@editorx/csdn',
]

test('根 package.json 以主版本 2 声明 changesets CLI', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.private, true)
  assert.equal(pkg.packageManager, 'pnpm@10.33.4')
  assert.equal(pkg.devDependencies['@changesets/cli'], '^2')
})

test('changesets 配置公开九个库并忽略 playground', () => {
  const config = JSON.parse(readFileSync(new URL('../.changeset/config.json', import.meta.url), 'utf8'))
  assert.equal(config.changelog, '@changesets/cli/changelog')
  assert.equal(config.commit, false)
  assert.equal(config.access, 'public')
  assert.equal(config.baseBranch, 'main')
  assert.equal(config.updateInternalDependencies, 'patch')
  assert.deepEqual(config.linked, [])
  assert.deepEqual(config.ignore, ['@editorx/playground'])
  assert.deepEqual(config.privatePackages, { version: false, tag: false })
  assert.deepEqual(config.fixed, [PUBLISHABLE])
})
