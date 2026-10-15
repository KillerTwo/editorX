import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const libs = [
  ['@geekx/theme', 'theme'],
  ['@geekx/ui', 'ui'],
  ['@geekx/toolbar', 'toolbar'],
  ['@geekx/markdown-core', 'markdown-core'],
  ['@geekx/markdown', 'markdown'],
  ['@geekx/rich-text', 'rich-text'],
  ['@geekx/publish', 'publish'],
  ['@geekx/csdn-extensions', 'csdn-extensions'],
  ['@geekx/csdn', 'csdn'],
]

const haystack = process.argv.slice(2).join(' ')
if (
  haystack.includes('npm publish') ||
  haystack.includes('npm login') ||
  haystack.includes('changeset publish') ||
  process.env.npm_command === 'publish'
) {
  console.error('拒绝执行发布命令')
  process.exit(1)
}

for (const [name, dirName] of libs) {
  const dir = path.join(root, 'packages', dirName)
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
  if (pkg.name !== name || pkg.private === true || pkg.publishConfig?.access !== 'public' || pkg.version !== '0.1.0') {
    console.error(`${name} 不能打包：name/private/publishConfig/version 不符合`)
    process.exit(1)
  }
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--offline'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, npm_config_offline: 'true', COREPACK_INTEGRITY_KEYS: '0' },
  })
  if (result.status !== 0) {
    console.error(result.stderr)
    process.exit(result.status ?? 1)
  }
  const packed = JSON.parse(result.stdout)
  const entry = packed[0]
  if (entry.name !== name || entry.version !== '0.1.0') {
    console.error(`${name} pack 版本不是 0.1.0`)
    process.exit(1)
  }
  const files = entry.files.map((file) => file.path)
  if (!files.includes('package.json') || !files.some((file) => file.startsWith('dist/'))) {
    console.error(`${name} pack 结果缺少 package.json 或 dist`)
    process.exit(1)
  }
}

const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const playground = JSON.parse(readFileSync(path.join(root, 'apps/playground/package.json'), 'utf8'))
if (rootPkg.private !== true || playground.private !== true) {
  console.error('仓库根和 playground 必须保持 private')
  process.exit(1)
}

console.log('dry-run ok')
