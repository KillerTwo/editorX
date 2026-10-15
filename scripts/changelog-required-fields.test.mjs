import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  ['@geekx/theme', 'packages/theme'],
  ['@geekx/ui', 'packages/ui'],
  ['@geekx/toolbar', 'packages/toolbar'],
  ['@geekx/markdown-core', 'packages/markdown-core'],
  ['@geekx/markdown', 'packages/markdown'],
  ['@geekx/rich-text', 'packages/rich-text'],
  ['@geekx/publish', 'packages/publish'],
  ['@geekx/csdn-extensions', 'packages/csdn-extensions'],
  ['@geekx/csdn', 'packages/csdn'],
]

const SENTENCE =
  '`PublishSettings` 增加必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。手工构造 `PublishSettings` 或 `PublishPayload` 的宿主需要补上这四个字段。'

test('九个库的 changelog 写明四个必填字段', () => {
  for (const [name, dir] of PUBLISHABLE) {
    const pkg = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8'))
    assert.equal(pkg.name, name)
    assert.equal(pkg.version, '0.1.0')
    assert.equal(Object.hasOwn(pkg, 'private'), false)
    assert.equal(pkg.publishConfig.access, 'public')
    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const block = pkg[depType] ?? {}
      for (const [dep, range] of Object.entries(block)) {
        if (!dep.startsWith('@geekx/')) continue
        assert.equal(range, depType === 'peerDependencies' ? 'workspace:^' : 'workspace:*', `${name} ${depType} ${dep}`)
      }
    }
    const changelog = readFileSync(new URL(`../${dir}/CHANGELOG.md`, import.meta.url), 'utf8')
    assert.ok(changelog.includes(SENTENCE), name)
    assert.ok(changelog.includes(name), name)
  }

  assert.equal(existsSync(new URL('../CHANGELOG.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../apps/playground/CHANGELOG.md', import.meta.url)), false)
  const playground = JSON.parse(readFileSync(new URL('../apps/playground/package.json', import.meta.url), 'utf8'))
  assert.equal(playground.version, '0.0.0')
  assert.equal(playground.private, true)
  assert.equal(existsSync(new URL('../.changeset/publish-settings-required-fields.md', import.meta.url)), false)
})
