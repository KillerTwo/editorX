import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('..', import.meta.url)

test('工作流只在 changesets action 里发布，且本阶段没有碰 win32 或 RESUME', () => {
  const yaml = readFileSync(new URL('.github/workflows/release.yml', root), 'utf8')
  assert.match(yaml, /changesets\/action@v1/)
  assert.match(yaml, /branches:\s*\n\s+- main/)
  assert.match(yaml, /version:\s*pnpm exec changeset version/)
  assert.equal((yaml.match(/pnpm exec changeset publish/g) ?? []).length, 1)
  assert.equal(yaml.includes('npm publish'), false)
  assert.equal(yaml.includes('npm login'), false)
  assert.match(yaml, /NPM_TOKEN/)
  assert.equal(yaml.includes('playwright'), false)
  assert.equal(yaml.includes('3100'), false)

  const script = readFileSync(new URL('scripts/release-dry-run.mjs', root), 'utf8')
  assert.match(
    script,
    /spawnSync\(\s*'npm',\s*\[\s*'pack',\s*'--dry-run',\s*'--json',\s*'--ignore-scripts',\s*'--offline'\s*\]/,
  )
  assert.doesNotMatch(script, /spawnSync\([\s\S]{0,120}'publish'/)
  assert.doesNotMatch(script, /fetch\s*\(/)
  assert.equal(script.includes('3100'), false)

  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  assert.equal(pkg.scripts['release:dry-run'], 'node scripts/release-dry-run.mjs')
  const readme = readFileSync(new URL('README.md', root), 'utf8')
  assert.ok(readme.includes('pnpm release:dry-run'))

  const committed = spawnSync('git', ['diff', '--name-only', 'a5cf294...HEAD'], { encoding: 'utf8' })
  const worktree = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  assert.equal(committed.status, 0)
  assert.equal(worktree.status, 0)
  const names = `${committed.stdout}\n${worktree.stdout}`
  assert.equal(names.includes('RESUME.md'), false)
  assert.equal(names.includes('win32.png'), false)
  assert.equal(names.includes('e2e/'), false)
})

test('拒绝把 npm publish 当成 dry-run', () => {
  const refused = spawnSync(process.execPath, ['scripts/release-dry-run.mjs', 'npm publish'], {
    encoding: 'utf8',
  })
  assert.equal(refused.status, 1)
  assert.match(`${refused.stdout}\n${refused.stderr}`, /拒绝执行发布命令/)
})

test('offline dry-run 打包九个 0.1.0 库', () => {
  const result = spawnSync(process.execPath, ['scripts/release-dry-run.mjs'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /dry-run ok/)
})
