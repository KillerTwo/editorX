# EditorX

EditorX 是一组 `@editorx/*` npm 包，用来在多个项目里复用 CSDN 博客发布编辑器：Markdown 编辑器、富文本编辑器、发布设置。包管理是 pnpm workspace，构建是 Turborepo 和 tsup（ESM 与 `.d.ts`，每个库导出 `./styles.css`）。CSS 类前缀是 `.ex-`，颜色变量是 `--ex-*`。

## 包

| 包 | 说明 |
|---|---|
| `@editorx/theme` | 主题 token |
| `@editorx/ui` | 界面组件 |
| `@editorx/toolbar` | 工具栏与共享类型，含 `PublishSettings` |
| `@editorx/markdown-core` | Markdown 渲染与命令，不依赖 React |
| `@editorx/markdown` | `<MarkdownEditor />` |
| `@editorx/rich-text` | `<RichTextEditor />` |
| `@editorx/publish` | `<PublishPanel />` 与 `<PublishModal />` |
| `@editorx/csdn-extensions` | AI、投票、视频、资源、InsCode、模板 |
| `@editorx/csdn` | `<CsdnEditor />` |
| `@editorx/playground` | Next.js 演示，不发布 |

## 依赖

`@editorx/markdown-core` 不依赖 React，也不依赖其他 `@editorx/*` 包。

`@editorx/ui` 使用 `@editorx/theme`。`@editorx/toolbar` 使用 `@editorx/theme` 和 `@editorx/ui`。`@editorx/markdown` 依赖 `@editorx/markdown-core`，并使用 `@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。

`@editorx/rich-text` 是单独的包，使用 CKEditor 5，`licenseKey` 为 `GPL`。它使用 `@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。它不依赖 `@editorx/csdn` 或 `@editorx/csdn-extensions`。

`@editorx/publish` 使用 `@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。

`@editorx/csdn-extensions` 的运行时依赖是 `@editorx/toolbar`、`@editorx/ui`、`@editorx/theme`、`lucide-react`。它不依赖 `@editorx/csdn`、`@editorx/markdown`、`@editorx/rich-text`、`@editorx/markdown-core`、`@editorx/publish`。

`@editorx/markdown` 和 `@editorx/rich-text` 不依赖 `@editorx/csdn-extensions`。

`@editorx/csdn` 依赖 `@editorx/csdn-extensions`。`@editorx/csdn` 还依赖 `@editorx/markdown`、`@editorx/markdown-core`、`@editorx/publish`、`@editorx/rich-text`、`@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。

`@editorx/csdn` 把 `@editorx/rich-text` 放在 `dependencies`，版本范围是 `workspace:*`。这是普通依赖，不是 optional peerDependency。

`@editorx/markdown`、`@editorx/rich-text`、`@editorx/publish` 可以不通过 `@editorx/csdn` 单独使用。

## 公开 API

`@editorx/ui` 的公开入口不导出 `MODAL_LAYER_CLASS`、`ModalLayer`、`useModalLayerClass`。写阶段 8 计划时检索了仓库里的 ts/tsx：包外没有文件 import 这三个名字。包内仍从 `./layer` 使用。

`PublishBaseProps.templates` 替换默认文章模板列表，不是工具栏内容 `Template`。

`PublishSettings` 增加了必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。手工构造 `PublishSettings` 或 `PublishPayload` 的宿主需要补上这四个字段。各库的 `CHANGELOG.md` 有同一句说明。

## 开发

需要 Node `>=22` 和 pnpm `10.33.4`。macOS 上 corepack 报 keyid 时，每条 pnpm 命令前先执行 `export COREPACK_INTEGRITY_KEYS=0`。

```sh
pnpm install
pnpm build
pnpm test
```

## 发布

九个库可以发布到 npm，`publishConfig.access` 为 `public`。仓库根包 `editorx` 和 `@editorx/playground` 保持 `"private": true`。

本地检查打包内容：

```sh
export COREPACK_INTEGRITY_KEYS=0
pnpm release:dry-run
```

这条命令执行 `npm pack --dry-run --offline`。它不执行 `npm publish`、`npm login` 或 `changeset publish`。

人把 `main` 上的提交推进远端之后，`.github/workflows/release.yml` 才会版本或发布。
