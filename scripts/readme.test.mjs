import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('README 写明 rich-text 的 GPL 和已发布的依赖', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
  const sentences = [
    '@geekx/rich-text` 是单独的包，使用 CKEditor 5，`licenseKey` 为 `GPL`。',
    '@geekx/csdn` 把 `@geekx/rich-text` 放在 `dependencies`，版本范围是 `workspace:*`。这是普通依赖，不是 optional peerDependency。',
    '@geekx/csdn-extensions` 的运行时依赖是 `@geekx/toolbar`、`@geekx/ui`、`@geekx/theme`、`lucide-react`。',
    '它不依赖 `@geekx/csdn`、`@geekx/markdown`、`@geekx/rich-text`、`@geekx/markdown-core`、`@geekx/publish`。',
    '@geekx/markdown` 和 `@geekx/rich-text` 不依赖 `@geekx/csdn-extensions`。',
    '@geekx/csdn` 依赖 `@geekx/csdn-extensions`。',
    'PublishBaseProps.templates` 替换默认文章模板列表，不是工具栏内容 `Template`。',
    '@geekx/ui` 的公开入口不导出 `MODAL_LAYER_CLASS`、`ModalLayer`、`useModalLayerClass`。',
    'PublishSettings` 增加了必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。',
    'pnpm release:dry-run',
    'npm pack --dry-run --offline',
  ]
  for (const sentence of sentences) assert.ok(readme.includes(sentence), sentence)
  assert.equal(readme.includes('反馈'), false)
  assert.equal(readme.includes('历史版本'), false)
})
