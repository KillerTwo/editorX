# EditorX：CSDN 博客发布编辑器还原 —— 设计文档

- 日期：2026-10-09
- 状态：已评审（待用户复核 spec）
- 目标：基于 StackEdit 内核与 CKEditor 5，像素级还原 CSDN 博客文章发布编辑器（Markdown 编辑器 + 富文本编辑器 + 发布设置），封装为可在多个 Next.js 项目复用的 npm 组件包。

## 1. 决策摘要

| 议题 | 决策 |
|---|---|
| 范围 | Markdown 编辑器、富文本编辑器、发布设置面板三者统一设计，按顺序实现 |
| 授权 | CKEditor 5 使用 `licenseKey: 'GPL'`；富文本为独立包，作为可选 peer 依赖，未安装则不打包 GPL 代码 |
| 分发 | pnpm monorepo，发布多个 `@geekx/*` npm 包，附 Next.js playground |
| 后端对接 | 组件零后端耦合，全部通过 `adapters` 回调注入；playground 提供 Route Handler 参考实现 |
| 内容模型 | `{ editorType, title, markdown?, html }`；支持双向切换（MD→富文本直接灌 HTML，富文本→MD 走 turndown，有损，需确认） |
| 样式 | 原生 CSS + `.ex-` 前缀 + `--ex-*` CSS 变量；每包输出 `styles.css`；不依赖 Tailwind |
| 主题 | 亮/暗/跟随系统；受控 `theme` + `onThemeChange`，或非受控（localStorage）；可选内置切换按钮 |
| 功能 | 通用编辑功能全部内置；CSDN 平台功能以「工具栏扩展」形式全部还原 UI，行为委托回调 |
| 运行环境 | 仅 React 19 + Next.js 16 App Router |
| StackEdit 接入 | 方案 1：将 StackEdit 内核（cledit、markdown-it 渲染链、同步滚动、命令）移植为框架无关 TS 包，React 重写 UI；编辑层抽象为可替换接口 |

## 2. 非目标

- 不实现任何后端服务（仅 playground 内的参考/模拟实现）。
- 不复用 CSDN 的 logo、图标素材、商标；图标使用 lucide 或自绘 SVG。
- 不支持 React 18、Next.js ≤15、Pages Router、非 Next.js 环境。
- 第一版不实现 `CodeMirrorEngine`，仅预留接口。

## 3. 仓库结构

```
editorx/
├─ apps/
│  └─ playground/            # Next.js 16：开发、/compare 对照页、adapters 参考实现
├─ packages/
│  ├─ theme/                 # @geekx/theme
│  ├─ ui/                    # @geekx/ui
│  ├─ toolbar/               # @geekx/toolbar
│  ├─ markdown-core/         # @geekx/markdown-core（无 React 依赖）
│  ├─ markdown/              # @geekx/markdown
│  ├─ rich-text/             # @geekx/rich-text（GPL）
│  ├─ publish/               # @geekx/publish
│  ├─ csdn-extensions/       # @geekx/csdn-extensions
│  └─ csdn/                  # @geekx/csdn
└─ tooling/                  # 共享 tsconfig / eslint / tsup 配置
```

### 3.1 依赖方向（单向）

```
theme ─┐
ui ────┼─→ toolbar ─┬─→ markdown ───┐
       │            ├─→ rich-text ──┼─→ csdn
       │            ├─→ publish ────┤
       │            └─→ csdn-extensions ┘
markdown-core ──────→ markdown（以及 csdn 中的 htmlToMarkdown）
```

- `markdown-core` 不依赖 React 及其他 `@geekx/*` 包。
- `csdn` 对 `rich-text` 声明为 **optional peerDependency**；运行时动态 `import()`，失败则隐藏富文本模式与「切换编辑器」按钮。
- `markdown`、`rich-text`、`publish` 均可脱离 `csdn` 单独使用。

### 3.2 工具链

- pnpm workspace + Turborepo
- tsup 构建：ESM + `.d.ts`，每包导出 `./styles.css`
- 所有组件入口文件标注 `'use client'`；CKEditor、cledit 等仅在客户端懒加载
- Vitest（单元/组件）、Playwright（E2E + 视觉回归）
- Changesets 管理版本发布
- 命名：npm scope `@geekx`，CSS 类前缀 `.ex-`，CSS 变量 `--ex-*`

## 4. `@geekx/markdown-core`

### 4.1 编辑层接口

```ts
type Unsubscribe = () => void

interface EngineOptions {
  value: string
  placeholder?: string
  readOnly?: boolean
}

interface SectionOffset { start: number; end: number; top: number; height: number }

interface EditorEngine {
  mount(el: HTMLElement, opts: EngineOptions): void
  destroy(): void
  getValue(): string
  setValue(md: string, opts?: { keepUndo?: boolean }): void
  getSelection(): { start: number; end: number }
  setSelection(start: number, end: number): void
  replace(start: number, end: number, text: string): void // 进入撤销栈
  undo(): void
  redo(): void
  focus(): void
  on(event: 'change' | 'selectionChange' | 'scroll' | 'paste' | 'drop', cb: (e: unknown) => void): Unsubscribe
  getSectionOffsets(): SectionOffset[]
}
```

- `ClEditEngine`（默认）：移植 StackEdit `cledit`——contenteditable 的 Markdown 语法高亮分段渲染、撤销管理、选区保持。`compositionstart`~`compositionend` 期间暂停重渲染以兼容中文输入法。
- `CodeMirrorEngine`：仅定义接口占位，按需后续实现。

### 4.2 渲染链

`createRenderer(options) → { render(md): { html, sections, toc } }`

- markdown-it + 扩展：GFM 表格、删除线、任务列表、脚注、缩写、上/下标、`==mark==`、emoji、`[TOC]`、KaTeX（`$..$` / `$$..$$`）、Mermaid（flowchart / sequence / gantt / class 等）。
- 代码高亮：Prism；亮/暗两套 token 配色由 `--ex-*` 变量驱动。
- 安全：输出统一经 DOMPurify 净化，白名单放行 KaTeX/MathML 与 Mermaid SVG。
- 增量：按 section 切分，仅重渲染变更段；KaTeX / Mermaid 结果缓存。
- 发布时保存的 `html` 由同一渲染器生成，保证预览与发布一致。
- 自定义嵌入块：Markdown 中以约定代码块 ```` ```ex-embed:<type> ```` + JSON payload 表示，渲染器调用已注册的 embed 渲染函数输出卡片 HTML（见 §5.3）。

### 4.3 同步滚动

`createScrollSync(engine, previewEl) → { destroy() }`

- 移植 StackEdit 的段落对齐算法：编辑区 section 偏移与预览区对应 DOM 偏移做线性插值。
- 双向同步，以用户当前滚动的一侧为主；防抖并通过「滚动来源锁」避免循环触发。

### 4.4 命令

纯函数 `(engine, args?) => void`：加粗、斜体、标题 H1–H6、删除线、引用、有序/无序列表、任务列表、行内代码/代码块、链接、图片、表格（rows × cols）、分割线、公式、Mermaid 模板、目录、撤销、重做。工具栏、快捷键、扩展共用这一套命令。

### 4.5 工具函数

- `countWords(md)`：中文按字、英文按词，另统计行数；口径对齐 CSDN 状态栏。
- 导入/导出：`.md`、`.html`。
- `htmlToMarkdown(html)`：turndown + GFM 插件；`ex-embed` 卡片反向还原为约定代码块。

## 5. `@geekx/toolbar`：扩展 API 与共享类型

### 5.1 共享类型

```ts
type EditorType = 'markdown' | 'richtext'

interface EditorDocument {
  editorType: EditorType
  title: string
  markdown?: string
  html: string
}

interface EditorAdapters {
  uploadImage?(file: File, onProgress?: (p: number) => void): Promise<{ url: string }>
  onSaveDraft?(doc: EditorDocument): Promise<void>
  onPublish?(payload: PublishPayload): Promise<void>
  searchTags?(keyword: string): Promise<string[]>
  getCategories?(): Promise<Category[]>
  aiAssist?(prompt: string, ctx: { selection: string; document: EditorDocument }): AsyncIterable<string>
  createVote?(data: VoteInput): Promise<{ id: string }>
  uploadVideo?(file: File, onProgress?: (p: number) => void): Promise<{ url: string; cover?: string }>
  searchResources?(keyword: string): Promise<Resource[]>
  runCode?(lang: string, code: string): Promise<{ url: string }>
  getTemplates?(): Promise<Template[]>
}
```

`PublishPayload`、`Category`、`VoteInput`、`Resource`、`Template` 的字段在实现计划中按 CSDN 表单字段逐一定义（`PublishPayload = EditorDocument & PublishSettings`，见 §6.3）。

### 5.2 扩展协议

```ts
interface EditorExtension {
  name: string                                  // 唯一，如 'csdn:vote'
  editors?: EditorType[]                        // 默认两者都适用
  requires?: (keyof EditorAdapters)[]           // 依赖的 adapter，缺失则按 missingAdapter 策略处理
  toolbar?: ToolbarItem[]
  shortcuts?: Record<string, (ctx: ExtensionContext) => void> // 如 'Mod-Shift-V'
  panels?: PanelDef[]                           // 侧边/底部面板
  embeds?: EmbedDef[]                           // 自定义嵌入块（卡片）渲染定义
  setup?(ctx: ExtensionContext): void | (() => void)
}

type ToolbarItem =
  | { type: 'button'; id: string; icon: ReactNode; title: string; group?: string; order?: number; run(ctx: ExtensionContext): void }
  | { type: 'dropdown'; id: string; icon: ReactNode; title: string; items: ToolbarItem[] }
  | { type: 'popover'; id: string; icon: ReactNode; title: string; render(ctx: ExtensionContext, close: () => void): ReactNode }
  | { type: 'modal'; id: string; icon: ReactNode; title: string; render(ctx: ExtensionContext, close: () => void): ReactNode }
  | { type: 'separator' }

interface PanelDef { id: string; title: string; position: 'right' | 'bottom'; render(ctx: ExtensionContext): ReactNode }

interface EmbedDef {
  type: string                                    // 如 'vote'、'video'
  renderHtml(payload: unknown): string            // 预览/发布 HTML（经 DOMPurify）
}

interface ExtensionContext {
  editorType: EditorType
  insert(content: { markdown?: string; html?: string }): void
  insertEmbed(type: string, payload: unknown): void
  getSelectionText(): string
  replaceSelection(content: { markdown?: string; html?: string }): void
  getDocument(): EditorDocument
  commands: CommandRegistry                       // 按 editorType 路由到 MD 命令或 CKEditor 命令
  adapters: EditorAdapters
  openPanel(id: string): void
  closePanel(id: string): void
  notify(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void
  theme: 'light' | 'dark'
  locale: Messages
}
```

### 5.3 规则

- **布局**：`toolbarLayout: (string | string[])[]`（分组的 item id 列表）。默认值为 CSDN 原版布局；可重排、隐藏、插入自定义项。
- **内置即扩展**：加粗、表格、图片、表情等以 `coreExtensions` 实现（各编辑器包内导出），与第三方扩展同等地位、可替换。
- **跨编辑器嵌入块**：
  - Markdown：```` ```ex-embed:<type> ```` + JSON payload，由 `EmbedDef.renderHtml` 渲染卡片。
  - 富文本：通用 CKEditor「嵌入块」插件，模型元素映射为 `<div data-ex-embed="<type>" data-payload="<json>">`，编辑态不可修改、显示卡片。
  - 两种表示可通过 `htmlToMarkdown` / 渲染器互转，保证切换编辑器不丢嵌入块。
- **缺失 adapter**：`missingAdapter: 'hide' | 'disable'`（默认 `'hide'`）。
- 扩展 `setup` 的清理函数在编辑器卸载或扩展被移除时调用；扩展抛出的异常被捕获并 `notify`，不影响编辑器。

## 6. React 组件

### 6.1 `<MarkdownEditor />`（`@geekx/markdown`）

Props：`value` / `defaultValue` / `onChange(md, html)`、`adapters`、`extensions`、`toolbarLayout`、`viewMode: 'split' | 'edit' | 'preview'`、`theme`、`height`、`placeholder`、`autoSaveInterval`、`missingAdapter`、`locale`、`engine?: () => EditorEngine`。

Ref：`getDocument()`、`insert()`、`setValue()`、`focus()`、`getEngine()`。

UI：工具栏；编辑区 + 预览区双栏（可拖动分隔条）；状态栏（字数、行数、光标位置、保存状态）；目录面板；语法说明面板；全屏。

图片：粘贴/拖拽/工具栏上传 → 插入占位 `![上传中...](ex-uploading://<id>)` → 成功替换为真实 URL；失败标红，可重试或删除。

### 6.2 `<RichTextEditor />`（`@geekx/rich-text`）

- `@ckeditor/ckeditor5-react` + 自选插件集，`licenseKey: 'GPL'`；工具栏按 CSDN 富文本编辑器布局排列。
- Props 与 `MarkdownEditor` 对齐（`value` 为 HTML，无 `viewMode` / `engine`）。
- 自定义 `UploadAdapter` 桥接 `adapters.uploadImage`。
- 嵌入块插件（§5.3）；CKEditor 工具栏项与扩展 API 打通（扩展的 button/dropdown/popover/modal 在 CKEditor 工具栏中渲染为自定义 UI 组件）。
- 内容区样式通过 CKEditor CSS 变量映射到 `--ex-*`，支持暗色。

### 6.3 `<PublishPanel />`（`@geekx/publish`）

`PublishSettings` 字段（还原 CSDN「发布文章」区）：

- `tags: string[]`（最多 7 个，`adapters.searchTags` 联想）
- `cover: { mode: 'single' | 'triple' | 'none'; urls: string[] }`（上传 + 裁剪）
- `summary: string`（≤256 字，可一键从正文提取）
- `categories: string[]`（分类专栏，`adapters.getCategories`）
- `articleType: 'original' | 'reprint' | 'translated'`；`reprint` / `translated` 需 `sourceUrl`
- `visibility: 'public' | 'private' | 'fans' | 'vip'`
- `scheduledAt?: string`（ISO，定时发布）

底部操作：保存草稿、定时发布、发布文章。受控组件（`value` / `onChange`），内置可配置的校验规则（`rules` 可覆盖）。

### 6.4 `<CsdnEditor />`（`@geekx/csdn`）

- 布局：顶栏（返回、标题输入 5–100 字及计数、保存草稿、主题切换、切换编辑器、发布）→ 编辑器区域 → 发布设置面板。
- Props：`adapters`、`initialDocument`、`initialSettings`、`defaultEditor`、`extensions`（默认启用全部 `csdn-extensions`）、`toolbarLayout`、`theme` / `onThemeChange` / `showThemeToggle`、`locale`（默认 `zh-CN`，可覆盖文案字典）、`autoSaveInterval`、`onBack`。
- 切换编辑器：确认弹窗 → MD→富文本：`html` 灌入 CKEditor；富文本→MD：`htmlToMarkdown(html)`。
- 自动保存：按 `autoSaveInterval` 调用 `onSaveDraft`；同时写 localStorage 兜底，加载时若本地版本更新则提示恢复。
- 发布：校验标题与 `PublishSettings` → 调用 `onPublish({ ...document, ...settings })`。

### 6.5 主题

- `@geekx/theme` 导出 `ThemeProvider`、`useTheme`、`tokens.css`（亮/暗两套 `--ex-*`）。
- `ThemeProvider` 在组件根节点设置 `data-ex-theme="light|dark"`；`'system'` 时监听 `prefers-color-scheme`。
- 受控：`theme` + `onThemeChange`；非受控：内部状态 + localStorage（key 可配置）。
- 覆盖范围：外壳 UI、预览区（含 Prism）、CKEditor 内容区、弹窗/弹层、发布面板；Mermaid 在主题切换时以对应主题重新初始化并重渲染图表。

### 6.6 国际化

所有文案集中于 `Messages` 字典（默认 `zh-CN`），通过 `locale` prop 覆盖部分或全部键。

## 7. 错误处理

- 所有 adapter 调用统一包装：捕获异常 → `notify(error)`；不吞掉保存失败——保持「未保存」状态并写入本地备份。
- 上传失败：占位标红，可重试/删除。
- 渲染错误：Mermaid / KaTeX 出错仅在该块内显示错误信息，不影响整体预览。
- 扩展异常：隔离捕获，不中断编辑器。
- `rich-text` 未安装：隐藏富文本模式；`initialDocument.editorType === 'richtext'` 时给出明确错误提示。

## 8. 还原度保障

- playground `/compare` 页：组件与 CSDN 参考截图并排 / 叠加（透明度可调）。参考截图由用户登录 CSDN 后手动截取，放入 `apps/playground/public/reference/`（由 Next.js 静态托管）；不爬取 CSDN。
- 设计 token（颜色、间距、字号、圆角、阴影）统一定义在 `@geekx/theme`，组件中不出现硬编码视觉值。
- Playwright 视觉回归覆盖：亮/暗 × 三种视图模式、所有弹窗/弹层、发布面板、富文本工具栏；像素差异阈值 0.1%。

## 9. 测试策略

- 单元（Vitest）：渲染链快照、命令（输入+选区 → 输出+选区）、同步滚动插值、字数统计、`htmlToMarkdown`（含嵌入块往返）、扩展注册与布局解析、发布表单校验。
- 组件（Vitest + Testing Library）：受控/非受控、回调调用时机、缺失 adapter 时的隐藏/禁用。
- E2E（Playwright，playground）：完整写作流程（上传图片、切换编辑器、保存草稿、发布、切换主题）；中文输入法组合输入；10,000 行文档输入延迟 < 50ms。

## 10. 实现阶段

每阶段产出可运行成果，各自编写实现计划：

1. 基础设施：monorepo、工具链、`theme`、`ui`、playground 骨架
2. `markdown-core`：渲染链、cledit 移植、命令、同步滚动
3. `toolbar` 扩展 API + `<MarkdownEditor />`：内置功能齐全，通过视觉回归
4. `<PublishPanel />`
5. `<RichTextEditor />`：CKEditor 5、嵌入块插件、扩展 API 打通
6. `<CsdnEditor />`：组合、编辑器切换、自动保存
7. `csdn-extensions`：AI 助手、投票、视频、资源绑定、InsCode、模板
8. 发布准备：Changesets、文档/README、npm 发布流程

## 11. 风险

| 风险 | 应对 |
|---|---|
| cledit 中文输入法 / 大文档表现不佳 | 阶段 2 尽早做 IME 与 10k 行 E2E；不达标则启用 `CodeMirrorEngine` 实现（接口已预留） |
| GPL 传染 | `rich-text` 独立包 + optional peer；文档中明确说明 |
| CSDN 改版导致还原基准漂移 | 以 `public/reference/` 截图为冻结基准，改版需显式更新截图 |
| Mermaid / KaTeX 体积大 | 按需动态加载，首次遇到对应语法时才加载 |
