# 阶段 5：`@editorx/rich-text` 的 `<RichTextEditor />` 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `develop` 上交付 `@editorx/rich-text` 的 `<RichTextEditor />`（CKEditor 5 GPL、CSDN 富文本稿纸与工具栏、左侧目录、右侧抽屉宿主、字数与稿纸后插槽），并先修掉阶段 4 留给图片对话框的裁剪器、封面焦点、无障碍与发布默认值问题。

**Architecture:** 富文本包只依赖 `theme` / `ui` / `toolbar`（以及控制方装好的 `ckeditor5`），不依赖 `markdown`、`publish`、`csdn`。编辑器根节点是 `height: 100%` 的滚动容器，工具栏带、左侧目录、右侧抽屉和宿主放进来的固定发布栏都相对这个容器定位，不使用 `window` 滚动。`PublishPanel` 仍归 `@editorx/publish`；playground 的 `/rich-text` 把 `editorType: 'richtext'` 的文档和 `barPosition="fixed"` 的发布栏放进稿纸后插槽。颜色只走 `--ex-color-rte-*`。

**Tech Stack:** React 19、Next.js 16 App Router、`ckeditor5@49.0.0`、`@ckeditor/ckeditor5-react@12.0.0`（`licenseKey: 'GPL'`）、`@editorx/toolbar` 的 `EditorExtension` / `PanelDef` / `ToolbarLayout` / `Messages`、tsup（`'use client';` banner + `tooling/copy-css.mjs`）、Vitest + jsdom、Playwright（darwin 视觉基线）。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md`（§2 非目标、§3.1 依赖方向、§5 扩展 API、§6.2 `<RichTextEditor />`、§10 阶段 5）。视觉数字以本计划正文为准（来源是 2026-10-10 审计，mac 图 `mac_2026-10-10_19-13-05` / `19-13-15` / `19-13-37`，单位 CSS px）。交接约束见 `docs/superpowers/handoff/phase5-notes-from-4.md`；其中「定时发布是原生 datetime-local」和「回到顶部是红色」已被该笔记「阶段 3/4 参考图对齐之后」一节取代，本计划不恢复那两句。

## Global Constraints

- 只在分支 `develop` 上工作（当前 HEAD `49abd5e`）。每个提交前 `test "$(git branch --show-current)" = develop`。中文 Conventional Commits，带正文，消息经 HEREDOC 传入。`git add` 只列明确路径，禁止 `git add .` 与 `git add -A`。不 push、不改 git config。
- 本阶段只交付 `<RichTextEditor />`。不做阶段 6 顶栏、`<CsdnEditor />`、反馈 tab；不做阶段 7 的 AI 面板内容、历史 / 资源绑定 / 视频 / 模版的真实行为。这些布局 id 由 playground 占位，模式同 `apps/playground/app/markdown/csdn-demo-extensions.tsx`。
- 依赖方向：`rich-text` 不依赖 `markdown`、`markdown-core`、`publish`。`publish` 不依赖 `rich-text`。不把外壳改成单一 Helvetica 字体栈；工具栏标签和稿纸标题用已有 `--ex-font-family`（PingFang）。发布栏里的表单继续用阶段 4 的 `--ex-font-family-helvetica`，本阶段不改那套字体。
- 滚动：组件根是 `height: 100%` 的容器。工具栏带、目录、右侧抽屉，以及宿主挂上的固定发布栏，都定位在这个容器内。根上 `transform: translate(0)`，让 `PublishPanel` 已有的 `barPosition="fixed"`（`position: fixed`）相对编辑器而不是窗口。禁止 `window` 滚动。
- `PanelDef.position` 增加 `'left'`。左侧目录是使用该位置的核心扩展。不另做一套面板系统。Markdown 编辑器继续只渲染 `position === 'right'` 与 `'bottom'`（`packages/markdown/src/markdown-editor.tsx` 已有这两次 filter），左侧面板不会进 Markdown 图标栏。
- 颜色只新增 `--ex-color-rte-*`，写在 `packages/theme/src/styles.css` 的 `light-dark()` 主块和三个 `@supports not (color: light-dark(#000, #fff))` 兜底块。已有同值 token 时，rte token 用 `var(--ex-color-…)` 别名（四个位置都写同一个 `var()`）。富文本 CSS 里不写颜色字面量。
- 审计 §7 已接受的默认：下拉内容按下面 Task 7 的清单，用 `@editorx/ui` 的 `Dropdown` 重做样式；悬停背景 `rgba(0, 0, 0, 0.04)`、圆角 4；激活色为 `--ex-color-primary`（图标和标签一起变）；正文样式复用 Markdown 预览值（正文 16/26、`#4d4d4d`，h1 22/32、h2 20/30、h3 18/28、h4–h6 16/26，标题 `#4f4f4f`、字重 600、`margin: 24px 0 8px`，p/ul/ol 下边距 24，列表缩进 31、`#404040`，链接 `#4ea1db`），空占位单独用 32px 行距；稿纸 `min-height: 812px`；窄视口右侧抽屉覆盖、目录在宽度小于 1200 时收起；深色 token 是推断值，深色基线只保证稳定；标题超过 100 被挡住（`maxLength={100}`），计数在「将要超过」时用错误色 token 显示 `n/100`，因为 `maxLength` 挡住了键入，计数不会因键入变成大于 100；已输入标题色 `#606266`。
- 字数 = 非空白码点。先去掉 U+200B–U+200D、U+2060、U+FEFF，再按 `countWords` 的 `chars` 口径去掉 `\s`（`packages/markdown-core/src/utils/count.ts` 的 `WHITESPACE` 与 `INVISIBLE`）。不把空格算进「共 N 字」。不新增对 `markdown-core` 的依赖，在富文本包里复制这两条正则。
- 目录来自 CKEditor 文档里的标题，没有 `@[TOC]` 也生成。Markdown 编辑器的 `@[TOC]` 行为不改。富文本空目录文案是「为文内增加标题，这里将生成目录」（已有 `zhCN.panels.tocEmpty`）。
- CKEditor：`ckeditor5@49.0.0` 与 `@ckeditor/ckeditor5-react@12.0.0`，`licenseKey: 'GPL'`。编辑器只在客户端创建。`value` 是 HTML，`onChange(html)`。ref：`getDocument` / `setValue` / `focus` / `insert`。任何任务都不要运行 `pnpm install`、`pnpm add` 或 `playwright install`。Task 8 开始前由控制方安装，见该任务上方的「控制方安装」。
- `barPosition="fixed"` 已在 `PublishPanel` 上。本阶段暴露字数回调和稿纸后插槽。playground 在稿纸下组合 `PublishPanel`（`editorType: 'richtext'`，`barPosition="fixed"`）。富文本包不拥有发布表单。
- 测试命令是 `pnpm --filter @editorx/<name> exec vitest run <文件>`。`--` 不会缩小范围，不要写 `pnpm --filter … -- vitest`。跑 pnpm 前 `export COREPACK_INTEGRITY_KEYS=0`。改了包 CSS 之后、跑 e2e 之前执行 `pnpm build --force`。杀端口 3100：`pids=$(lsof -ti tcp:3100 || true); if [ -n "$pids" ]; then kill -9 $pids; fi`。不要更新无关视觉基线，不要删除或重生成已有 win32 PNG。
- Mac/darwin 是验收平台。parity spec 把 darwin 与 win32 拆开；win32 的 `describe` 使用 `test.skip`，源码注释写「待 Windows 复测」。
- react-hooks v7：effect 里不要同步 `setState`。焦点放进 `useLayoutEffect` 可以。组件测试用 `StrictMode`。
- 验收平台是 darwin。视觉基线只提交 darwin。深色基线无参考图，只要求连续两次渲染一致。
- 非目标（设计 §2）：不做后端；不复制 CSDN 的 logo、图标素材、商标（图标用 lucide）；不支持 React 18、Next.js 15 及更早、Pages Router。「使用 MD 编辑器」的双色箭头用单色 SVG，这是接受的偏差，写进阶段 6 笔记。

## Review Focus

下面五类输入最容易在实现里被漏掉。每一条在对应任务里都有测试。

1. 受控 `title` 长于 100（粘贴或父组件传入）时，`maxLength` 挡不住已写入的值，计数必须是 `n/100` 且使用 `--ex-color-error`；键盘输入仍停在 100，计数保持 `100 / 100` 且不带错误色。Task 9。
2. `<img data-src="/lazy.png" src="/real.png">` 只收入 `/real.png`；只有 `data-src` 时返回空数组。Task 2。
3. 右键（`button !== 0`）不开始拖动；拖动过程中另一支指针的 `pointermove` 不改变裁剪框。Task 1。
4. HTML 里有 `h1`–`h6` 就生成目录，正文里的文字 `@[TOC]` 不算标题；`zhCN.panels.tocEmptyAfter` 仍含 `@[TOC]`，Markdown 那条文案不动。Task 10。
5. 字数忽略空格和 U+200B / U+200C / U+200D / U+2060 / U+FEFF；`<script>` 里的文字不计入。`12312312312` 是 11，不是 1。Task 12。

## 文件结构

- `packages/ui/src/image-cropper.tsx`：加载失败提示、`crossOrigin`、按 `pointerId` 拖动。
- `packages/publish/src/extract.ts`：`extractImages` 的 src 正则。
- `packages/publish/src/form/cover-field.tsx`：上传中焦点与 `aria-busy`。
- `packages/publish/src/form/form-item.tsx`、`tag-field.tsx`：必填 `aria-required`，帮助按钮。
- `packages/publish/src/settings.ts`：`FALLBACK_DOC`、`resolveTemplate`。
- `packages/publish/src/use-publish-controller.ts`：发布前清掉禁用模板，拒绝空标题和空正文。
- `packages/toolbar/src/extension.ts`：`PanelDef.position` 含 `'left'`。
- `packages/toolbar/src/messages.ts`：富文本工具栏文案、`publish.a11y.help`、`publish.errors.emptyHtml`。
- `packages/theme/src/styles.css`：`--ex-color-rte-*`。
- `packages/rich-text/`：新包。`types.ts` 公开类型；`count.ts` 字数；`headings.ts` 标题；`title-counter.ts` 标题计数；`upload-adapter.ts`、`embed-plugin.ts`、`ck-config.ts`、`mount-editor.ts` 为 CKEditor 桥；`core-extensions.tsx` 内置工具栏与左侧目录；`paper.tsx` 标题行；`toc-panel.tsx` 目录壳；`drawer.tsx` 右侧抽屉；`rich-text-editor.tsx` 组装；`styles.css` 只引用 token。
- `apps/playground/app/rich-text/`：路由、占位扩展、发布栏组合。
- `apps/playground/e2e/rich-text.spec.ts`、`rich-text-parity.spec.ts`、`rich-text-visual.spec.ts`。
- `docs/superpowers/handoff/phase6-notes-from-5.md` 与 `RESUME.md` 的阶段行。

公开类型（Task 5 写出，后面的任务不得改名）：

```ts
export interface RichTextEditorSlots {
  /** 标题行魔杖位置。不传时组件自己渲染 32×32 的「AI 标题」按钮（无 aiAssist 行为） */
  titleActions?: ReactNode
  /** 稿纸下方、滚动容器内部。playground 在这里放 PublishPanel */
  afterPaper?: ReactNode
  /** 右侧抽屉收起后的浮层。阶段 7 放 AI 菜单；playground 放 104×159 占位 */
  rightCollapsed?: ReactNode
}

export interface RichTextEditorHandle {
  focus(): void
  getValue(): string
  /** 替换 HTML，不触发 onChange */
  setValue(html: string): void
  getDocument(): EditorDocument
  insert(content: InsertContent): void
}

export interface RichTextEditorProps {
  value?: string
  defaultValue?: string
  onChange?(html: string): void
  title?: string
  defaultTitle?: string
  onTitleChange?(title: string): void
  /** 非空白字数。首次挂载和每次 HTML 变化时调用 */
  onWordCount?(count: number): void
  adapters?: EditorAdapters
  extensions?: readonly EditorExtension[]
  /** 默认 richTextCoreExtensions */
  coreExtensions?: readonly EditorExtension[]
  /** 默认 RICH_TEXT_TOOLBAR_LAYOUT */
  toolbarLayout?: ToolbarLayout
  missingAdapter?: MissingAdapterPolicy
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  locale?: DeepPartial<Messages>
  readOnly?: boolean
  /** 编辑区 aria-label，默认 messages.richText.editable */
  ariaLabel?: string
  /** 根高度，默认 '100%' */
  height?: number | string
  /** 右侧抽屉，默认展开。受控时传 rightOpen + onRightOpenChange */
  defaultRightOpen?: boolean
  rightOpen?: boolean
  onRightOpenChange?(open: boolean): void
  /** 左侧目录，默认展开 */
  defaultTocOpen?: boolean
  slots?: RichTextEditorSlots
  className?: string
  ref?: Ref<RichTextEditorHandle>
}
```

`EditorDocument` 由 `getDocument()` 返回 `{ editorType: 'richtext', title, html, markdown: undefined }`。没有 `viewMode`、`engine`、`autoSaveInterval`（自动保存属于阶段 6 的 `<CsdnEditor />`）。

---

### Task 1: 加固 ImageCropper

**Files:**
- Modify: `packages/ui/src/image-cropper.tsx`
- Modify: `packages/ui/src/image-cropper.test.tsx`
- Modify: `packages/publish/src/form/cover-field.test.tsx`
- Test: 上面两个测试文件

**Interfaces:**
- Consumes: 现有 `ImageCropperProps`（`src`、`aspect`、`width`、`onChange`、`zoomLabel`、`areaLabel`、`className`）。`CoverCropDialog` 已传 `key={src}`。
- Produces: `ImageCropperProps.errorText?: string`，默认 `'图片无法显示'`。加载失败或 `naturalWidth === 0` 或 `naturalHeight === 0` 时渲染 `<p className="ex-cropper__error" role="alert">`，不调用 `onChange`，缩放滑块保持禁用。`http:` / `https:` 的 `src` 设置 `crossOrigin="anonymous"`，其他 src 不设置该属性。拖动状态为 `{ pointerId, x, y, area }`。

- [ ] **Step 1: 写失败测试**

在 `packages/ui/src/image-cropper.test.tsx` 的 `describe('ImageCropper')` 末尾追加：

```tsx
  it('https 图片设置 crossOrigin，blob 图片不设置', () => {
    const { container, unmount } = renderWithTheme(<ImageCropper src="https://cdn.example/a.png" aspect={16 / 9} onChange={vi.fn()} />)
    expect(container.querySelector('img')).toHaveAttribute('crossorigin', 'anonymous')
    unmount()
    const blob = renderWithTheme(<ImageCropper src="blob:cover" aspect={16 / 9} onChange={vi.fn()} />)
    expect(blob.container.querySelector('img')).not.toHaveAttribute('crossorigin')
  })

  it('error 或 naturalWidth 为 0 时提示，且不给出裁剪框', () => {
    const onChange = vi.fn()
    const { container } = renderWithTheme(<ImageCropper src="blob:bad" aspect={16 / 9} onChange={onChange} />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(screen.getByRole('alert')).toHaveTextContent('图片无法显示')
    expect(screen.getByRole('slider', { name: '缩放' })).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
    Object.defineProperty(img, 'naturalWidth', { value: 0 })
    Object.defineProperty(img, 'naturalHeight', { value: 0 })
    fireEvent.load(img)
    expect(screen.getByRole('alert')).toHaveTextContent('图片无法显示')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('右键不开始拖动；另一支指针的移动不改变裁剪框', () => {
    const { onChange, viewport } = setup()
    const calls = onChange.mock.calls.length
    fireEvent.pointerDown(viewport, { pointerId: 3, button: 2, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 3, button: 2, clientX: 0, clientY: 0 })
    expect(onChange).toHaveBeenCalledTimes(calls)
    fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 2, button: 0, clientX: 0, clientY: 0 })
    expect(onChange).toHaveBeenCalledTimes(calls)
    fireEvent.pointerMove(viewport, { pointerId: 1, button: 0, clientX: 70, clientY: 100 })
    expect(onChange.mock.calls.length).toBeGreaterThan(calls)
  })
```

在 `packages/publish/src/form/cover-field.test.tsx` 追加：

```tsx
  it('裁剪图加载失败时显示提示，确定保持禁用', async () => {
    const { container } = renderWithProviders(<Cover />)
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    fireEvent.error(document.querySelector('.ex-cropper__image')!)
    expect(screen.getByRole('alert')).toHaveTextContent('图片无法显示')
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/ui exec vitest run src/image-cropper.test.tsx
pnpm --filter @editorx/publish exec vitest run src/form/cover-field.test.tsx
```

Expected: FAIL，`图片无法显示` 或 `crossorigin` 找不到。

- [ ] **Step 3: 实现**

`image-cropper.tsx` 的 props 增加 `errorText = '图片无法显示'`。拖动 ref 与事件改为：

```tsx
const drag = useRef<{ pointerId: number; x: number; y: number; area: CropArea } | null>(null)
const [failed, setFailed] = useState(false)

const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
  const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }
  if (size.width === 0 || size.height === 0) {
    setFailed(true)
    setNatural(null)
    setArea(null)
    return
  }
  setFailed(false)
  setNatural(size)
  setZoom(1)
  commit(initialCrop(size, aspect))
}
const onImageError = () => {
  setFailed(true)
  setNatural(null)
  setArea(null)
}
const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
  if (e.button !== 0 || !area) return
  e.currentTarget.setPointerCapture?.(e.pointerId)
  drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, area }
}
const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
  const start = drag.current
  if (!start || start.pointerId !== e.pointerId || !natural) return
  const s = width / start.area.width
  commit(moveCrop(start.area, (start.x - e.clientX) / s, (start.y - e.clientY) / s, natural))
}
const endDrag = (e: PointerEvent<HTMLDivElement>) => {
  if (drag.current && drag.current.pointerId !== e.pointerId) return
  drag.current = null
}
```

`<img>` 增加 `crossOrigin={/^https?:/i.test(src) ? 'anonymous' : undefined}`、`onError={onImageError}`。视口下方、滑块上方：

```tsx
{failed ? <p className="ex-cropper__error" role="alert">{errorText}</p> : null}
```

`CoverCropDialog` 不用改：没有 `onChange` 就没有 `area`，确定按钮继续 `disabled={!area}`。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/ui exec vitest run src/image-cropper.test.tsx
pnpm --filter @editorx/publish exec vitest run src/form/cover-field.test.tsx
```

Expected: PASS。原有「拖动图片」用例仍用 `pointerId: 1`，必须保持通过。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/ui/src/image-cropper.tsx packages/ui/src/image-cropper.test.tsx packages/publish/src/form/cover-field.test.tsx
git commit -m "$(cat <<'EOF'
fix(ui): 图片无法显示时给出提示而不是只禁用确定

远程地址设置 crossOrigin，拖动按 pointerId 过滤，非主键不开始拖动。

EOF
)"
git status
```

---

### Task 2: extractImages 与封面上传焦点

**Files:**
- Modify: `packages/publish/src/extract.ts`
- Modify: `packages/publish/src/logic.test.ts`
- Modify: `packages/publish/src/form/cover-field.tsx`
- Modify: `packages/publish/src/form/cover-field.test.tsx`
- Test: `packages/publish/src/logic.test.ts`、`packages/publish/src/form/cover-field.test.tsx`

**Interfaces:**
- Consumes: `extractImages(html: string): string[]`；`CoverField` 的 `uploading` 状态与文案 `p.cover.uploading`（`上传中…`）。
- Produces: `extractImages` 只用 `[\s"']src\s*=` 识别地址，不再命中 `data-src`。上传槽在「上传中…」期间仍是 `<button>`，`aria-busy="true"`，焦点在该按钮上。

- [ ] **Step 1: 写失败测试**

`logic.test.ts` 的 extractImages 用例后追加：

```tsx
  it('extractImages 不把 data-src 当成 src', () => {
    expect(extractImages('<img data-src="/lazy.png" src="/real.png">')).toEqual(['/real.png'])
    expect(extractImages('<img data-src="/only.png">')).toEqual([])
    expect(extractImages('<p><img src="/a.png" alt=""><img alt="" src=\'/b.png?x=1&amp;y=2\'></p><img src="/a.png"><img src="ex-uploading://1"><img src="">')).toEqual([
      '/a.png',
      '/b.png?x=1&y=2',
    ])
  })
```

`cover-field.test.tsx` 追加：

```tsx
  it('上传中焦点留在该控件并标 aria-busy', async () => {
    let release: (value: { url: string }) => void = () => {}
    const uploadImage = vi.fn(() => new Promise<{ url: string }>((resolve) => { release = resolve }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} />)
    screen.getByRole('button', { name: '从本地上传' }).focus()
    chooseFile(container)
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    const busy = await screen.findByRole('button', { name: '上传中…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(document.activeElement).toBe(busy)
    release({ url: '/uploaded.png' })
    await waitFor(() => expect(screen.getByTestId('cover')).toHaveTextContent('/uploaded.png'))
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/publish exec vitest run src/logic.test.ts src/form/cover-field.test.tsx
```

Expected: FAIL。`data-src` 用例会得到 `['/lazy.png', '/real.png']` 或 `['/only.png']`；上传中节点不是 button，或 `activeElement` 是 `body`。

- [ ] **Step 3: 实现**

`extract.ts` 的循环改为：

```ts
for (const match of html.matchAll(/<img\b[^>]*?[\s"']src\s*=\s*(["'])(.*?)\1/gi)) {
```

`cover-field.tsx`：`import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'`。增加 `const slotRef = useRef<HTMLButtonElement>(null)`。在 `chooseFile` 之前：

```tsx
useLayoutEffect(() => {
  if (uploading === null) return
  const node = slotRef.current
  if (node && node.ownerDocument.activeElement !== node) node.focus()
}, [uploading])
```

把 `uploading === index` 的 `<div … aria-busy="true">` 换成：

```tsx
<button
  key={index}
  ref={slotRef}
  type="button"
  className="ex-pub-cover__slot is-uploading"
  aria-busy="true"
>
  {p.cover.uploading}
</button>
```

不要给这个按钮设 `disabled`（禁用会把焦点送回 `body`）。effect 里不要 `setState`。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/publish exec vitest run src/logic.test.ts src/form/cover-field.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/publish/src/extract.ts packages/publish/src/logic.test.ts packages/publish/src/form/cover-field.tsx packages/publish/src/form/cover-field.test.tsx
git commit -m "$(cat <<'EOF'
fix(publish): 正文图片不再匹配 data-src，上传中保持焦点

富文本粘贴的 HTML 常带 data-src。上传框变成「上传中…」后焦点留在该按钮，并标 aria-busy。

EOF
)"
git status
```

---

### Task 3: 必填星号与帮助图标

**Files:**
- Modify: `packages/toolbar/src/messages.ts`（在 `publish` 下增加 `a11y: { help: '帮助' }`）
- Modify: `packages/publish/src/form/form-item.tsx`
- Modify: `packages/publish/src/form/tag-field.tsx`
- Modify: `packages/publish/src/form/fields.test.tsx`
- Test: `packages/publish/src/form/fields.test.tsx`、`packages/toolbar/src/messages.test.tsx`

**Interfaces:**
- Consumes: `FormItem` 的 `required` / `help`；`TagField` 的添加按钮（文案 `添加文章标签`）；`Tooltip` 会在打开时给触发器补 `aria-describedby`。
- Produces: `messages.publish.a11y.help === '帮助'`。必填星号保持 `aria-hidden="true"`。`required` 时唯一子元素收到 `aria-required={true}`。`TagField` 把该属性放到添加按钮上；标签已满、按钮不渲染时放到根节点 `.ex-pub-tags`。帮助触发器是 `<button type="button" className="ex-pub-item__help" aria-label={帮助}>`，不再是 `role="img"`，`aria-label` 不是帮助正文。

- [ ] **Step 1: 写失败测试**

把 `fields.test.tsx` 里 FormItem 用例中的 `getByRole('img', { name: '帮助' })` 两行换成：

```tsx
    expect(screen.queryByRole('img')).toBeNull()
    const help = screen.getByRole('button', { name: '帮助' })
    expect(help).toHaveClass('ex-pub-item__help')
    expect(help).toHaveAttribute('aria-label', '帮助')
    expect(help.getAttribute('aria-label')).not.toBe('最多 7 个标签')
    expect(screen.getByRole('button', { name: '控件' })).toHaveAttribute('aria-required', 'true')
    expect(item.querySelector('.ex-pub-item__required')).toHaveAttribute('aria-hidden', 'true')
```

并把该用例的 `help="帮助"` 改成 `help="最多 7 个标签"`，子按钮不要自己写 `aria-required`。再追加：

```tsx
  it('标签字段把 aria-required 放在添加按钮上', () => {
    renderWithProviders(
      <FormItem field="tags" id="f" label="文章标签" required>
        <TagField id="f" tags={[]} onChange={() => {}} invalid={false} />
      </FormItem>,
    )
    expect(screen.getByRole('button', { name: '添加文章标签' })).toHaveAttribute('aria-required', 'true')
  })
```

`messages.test.tsx` 的 publish 用例里加 `expect(zhCN.publish.a11y.help).toBe('帮助')`。

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/publish exec vitest run src/form/fields.test.tsx
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx
```

Expected: FAIL，仍然找得到 `role="img"`，或 `a11y` 不存在。

- [ ] **Step 3: 实现**

`messages.ts` 的 `publish` 对象内、`errors` 同级增加 `a11y: { help: '帮助' }`。

`form-item.tsx`：

```tsx
import { Tooltip } from '@editorx/ui'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { useMessages } from '@editorx/toolbar'

export function FormItem({ field, id, label, labelSuffix, required, help, error, children }: FormItemProps) {
  const helpName = useMessages().publish.a11y.help
  const control =
    required && isValidElement(children)
      ? cloneElement(children as ReactElement<{ 'aria-required'?: boolean }>, { 'aria-required': true })
      : children
  return (
    <div className={cx('ex-pub-item', error && 'is-error')} data-field={field}>
      <div className="ex-pub-item__label">
        {required && (
          <span className="ex-pub-item__required" aria-hidden="true">
            *
          </span>
        )}
        <span className="ex-pub-item__text" id={labelId(id)}>
          {label}
        </span>
        {help && (
          <Tooltip content={help} placement="top">
            <button type="button" className="ex-pub-item__help" aria-label={helpName}>
              <HelpIcon />
            </button>
          </Tooltip>
        )}
        {labelSuffix && <span className="ex-pub-item__suffix">{labelSuffix}</span>}
      </div>
      <div className="ex-pub-item__control">
        {control}
        {error && (
          <div className="ex-pub-item__error" id={errorId(id)}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
```

`TagFieldProps` 增加 `'aria-required'?: boolean`。解构出 `ariaRequired`。根节点：

```tsx
<div
  ref={rootRef}
  className="ex-pub-line ex-pub-tags"
  tabIndex={-1}
  aria-required={!canAdd && ariaRequired ? true : undefined}
>
```

添加按钮增加 `aria-required={canAdd && ariaRequired ? true : undefined}`。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx
pnpm --filter @editorx/publish exec vitest run src/form/fields.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/toolbar/src/messages.ts packages/toolbar/src/messages.test.tsx packages/publish/src/form/form-item.tsx packages/publish/src/form/tag-field.tsx packages/publish/src/form/fields.test.tsx
git commit -m "$(cat <<'EOF'
fix(publish): 必填控件暴露 aria-required，帮助图标不再读两遍

星号仍只作视觉。帮助按钮的名称是「帮助」，正文由 Tooltip 在打开时描述。

EOF
)"
git status
```

---

### Task 4: 禁用模板与未传 document

**Files:**
- Modify: `packages/toolbar/src/messages.ts`（`publish.errors.emptyHtml: '正文不能为空'`）
- Modify: `packages/publish/src/settings.ts`
- Modify: `packages/publish/src/use-publish-controller.ts`
- Modify: `packages/publish/src/publish-panel.tsx`（把 `templates` 传给 controller）
- Modify: `packages/publish/src/form/publish-form.tsx`
- Modify: `packages/publish/src/types.ts`（模板 JSDoc）
- Modify: `packages/publish/src/publish-panel.test.tsx`
- Modify: `packages/publish/src/controller.test.tsx`
- Test: 上述两个测试文件

**Interfaces:**
- Consumes: `htmlToText`；`TITLE_MIN` / `TITLE_MAX`；`createSettings`；`PublishControllerOptions`。
- Produces:
  - `FALLBACK_DOC: EditorDocument = { editorType: 'markdown', title: '', html: '' }`（从 `settings.ts` 导出，controller 删掉本地 `EMPTY_DOC`，两处共用这一份）。
  - `resolveTemplate(current: string, editorType: EditorType, templates?: readonly { id: string; disabled?: boolean }[]): string`。未传 `templates` 时，`moyan` 仅在 `editorType === 'markdown'` 可用，不可用则改为 `'default'`。传了 `templates` 时只看该项的 `disabled`，不再套用墨衍规则。
  - `publish()` 先 `resolveTemplate` 并写回 settings，再拒绝发布：`countChars(doc.title.trim()) === 0` 时 toast `文章标题需为 5～100 个字`；否则 `htmlToText(doc.html) === ''` 时 toast `正文不能为空`。两种情况都不调用 `onPublish`。`document` 省略时用 `FALLBACK_DOC`。校验传 `title: doc.title`（字符串，不再因为没传文档而变成 `undefined`）。`saveDraft` 仍允许空文档，载荷文档是 `FALLBACK_DOC`。
  - 表单墨衍禁用条件改为 `(document ?? FALLBACK_DOC).editorType !== 'markdown'`。因此未传 document 时墨衍可选；`editorType: 'richtext'` 时禁用。playground 会传 richtext 文档，12-36-05 的禁用外观不变。

选定默认写在这里，测试锁住它：未传 `document` 与 `FALLBACK_DOC` 都是 `editorType: 'markdown'`。空标题优先于空正文。`rules.title === false` 也不能放行空标题或空正文。

- [ ] **Step 1: 写失败测试**

把 `publish-panel.test.tsx` 的「富文本文档或未传文档：墨衍模板禁用」拆成：

```tsx
  it('富文本文档：墨衍模板禁用', () => {
    renderWithProviders(
      <PublishPanel document={{ editorType: 'richtext', title: '富文本', html: '<p>正文</p>' }} adapters={adapters()} />,
    )
    expect(moyan()).toBeDisabled()
  })

  it('未传文档：与 FALLBACK_DOC 一致，墨衍模板可选', () => {
    renderWithProviders(<PublishPanel adapters={adapters()} />)
    expect(moyan()).toBeEnabled()
  })
```

先把可选字段加到 `PublishControllerOptions`，否则测试无法编译：`templates?: readonly { id: string; disabled?: boolean }[]`。`setup({ document: undefined })` 会覆盖默认的 `doc`。`controller.test.tsx` 追加：

```tsx
  it('未传 document：不发布空标题，草稿回退为 markdown', async () => {
    const { result, onPublish, onSaveDraft, notify } = setup({ document: undefined, rules: { tags: false } })
    await act(async () => {
      expect(await result.current.publish()).toBe(false)
    })
    expect(onPublish).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('文章标题需为 5～100 个字', 'error')
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(true)
    })
    expect(onSaveDraft).toHaveBeenCalledWith(
      { editorType: 'markdown', title: '', html: '' },
      expect.objectContaining({ template: 'default' }),
    )
  })

  it('标题够长但正文为空：不调用 onPublish', async () => {
    const { result, onPublish, notify } = setup({
      rules: { tags: false, title: false },
      document: { editorType: 'richtext', title: '足够长的标题', html: '<p>&nbsp;</p>' },
    })
    await act(async () => {
      expect(await result.current.publish()).toBe(false)
    })
    expect(onPublish).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('正文不能为空', 'error')
  })

  it('富文本已选墨衍：发布前改回 default', async () => {
    const { result, onPublish } = setup({
      rules: { tags: false },
      document: { editorType: 'richtext', title: '足够长的标题', html: '<p>正文</p>' },
      defaultValue: { template: 'moyan' },
    })
    await act(async () => {
      expect(await result.current.publish()).toBe(true)
    })
    expect(onPublish.mock.lastCall![0].template).toBe('default')
    expect(result.current.settings.template).toBe('default')
  })

  it('显式 templates 未禁用墨衍时，富文本发布保留墨衍', async () => {
    const { result, onPublish } = setup({
      rules: { tags: false },
      document: { editorType: 'richtext', title: '足够长的标题', html: '<p>正文</p>' },
      defaultValue: { template: 'moyan' },
      templates: [{ id: 'moyan' }],
    })
    await act(async () => {
      expect(await result.current.publish()).toBe(true)
    })
    expect(onPublish.mock.lastCall![0].template).toBe('moyan')
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/publish exec vitest run src/publish-panel.test.tsx src/controller.test.tsx
```

Expected: FAIL。未传文档时墨衍仍禁用；空正文仍调用了 `onPublish`。

- [ ] **Step 3: 实现**

`settings.ts`：

```ts
import type { CoverMode, EditorDocument, EditorType, PublishCover, PublishPayload, PublishSettings } from '@editorx/toolbar'

export const FALLBACK_DOC: EditorDocument = { editorType: 'markdown', title: '', html: '' }

export function resolveTemplate(
  current: string,
  editorType: EditorType,
  templates?: readonly { id: string; disabled?: boolean }[],
): string {
  const disabled = (id: string) => {
    if (templates) {
      const found = templates.find((item) => item.id === id)
      return !found || Boolean(found.disabled)
    }
    return id === 'moyan' ? editorType !== 'markdown' : id !== 'default' && id !== 'simple'
  }
  if (!disabled(current)) return current
  return 'default'
}
```

`use-publish-controller.ts` 删除 `EMPTY_DOC`，改为导入 `FALLBACK_DOC` 与 `resolveTemplate`，并导入 `htmlToText`、`countChars`、`TITLE_MIN`、`TITLE_MAX`。`PublishControllerOptions` 增加 `templates`。`publish` 在 `validatePublish` 之前：

```ts
const doc = latest.current.document ?? FALLBACK_DOC
const template = resolveTemplate(target.template, doc.editorType, latest.current.templates)
if (template !== target.template) {
  target.template = template
  pending.current = { ...pending.current, template }
  if (latest.current.controlled) rerender()
  else setInner(pending.current)
  latest.current.onChange?.(pending.current)
}
const titleEmpty = countChars(doc.title.trim()) === 0
if (titleEmpty || htmlToText(doc.html) === '') {
  const message = titleEmpty
    ? formatMessage(messages.errors.title, { min: TITLE_MIN, max: TITLE_MAX })
    : messages.errors.emptyHtml
  setErrors(titleEmpty ? { title: message } : {})
  setFailedAttempts((n) => n + 1)
  notify(message, 'error')
  return false
}
const found = validatePublish(target, { messages, now: now(), title: doc.title, scheduleRange }, rules)
```

`toPayload` 与 `saveDraft` 的 `doc ?? EMPTY_DOC` 改为 `doc ?? FALLBACK_DOC`。`publish-panel.tsx` 的 `usePublishController({...})` 增加 `templates: props.templates`。

`publish-form.tsx` 导入 `FALLBACK_DOC`，墨衍那一行改为：

```tsx
{ id: 'moyan', name: p.template.moyan, disabled: (doc ?? FALLBACK_DOC).editorType !== 'markdown' },
```

`types.ts` 模板 JSDoc 改为：`文章模板选项；默认 默认模板 / 简洁模板 / 墨衍模板。未传 document 时按 FALLBACK_DOC（markdown）墨衍可选；editorType 不是 markdown 时墨衍禁用。传入 templates 则整表替换默认列表。`

`messages.ts` 的 `publish.errors` 增加 `emptyHtml: '正文不能为空'`。`messages.test.tsx` 加一行断言这个字符串。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx
pnpm --filter @editorx/publish exec vitest run src/publish-panel.test.tsx src/controller.test.tsx src/logic.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/toolbar/src/messages.ts packages/toolbar/src/messages.test.tsx packages/publish/src/settings.ts packages/publish/src/use-publish-controller.ts packages/publish/src/publish-panel.tsx packages/publish/src/form/publish-form.tsx packages/publish/src/types.ts packages/publish/src/publish-panel.test.tsx packages/publish/src/controller.test.tsx
git commit -m "$(cat <<'EOF'
fix(publish): 未传文档不再发出空标题，并在发布前清掉禁用模板

回退文档固定为 markdown，墨衍是否可选与这份回退一致。正文抽掉标签后为空则拒绝发布。

EOF
)"
git status
```

---

### Task 5: 搭建 @editorx/rich-text

**Files:**
- Create: `packages/rich-text/package.json`
- Create: `packages/rich-text/tsconfig.json`
- Create: `packages/rich-text/tsup.config.ts`
- Create: `packages/rich-text/vitest.config.ts`
- Create: `packages/rich-text/src/index.ts`
- Create: `packages/rich-text/src/types.ts`
- Create: `packages/rich-text/src/styles.css`
- Create: `packages/rich-text/src/styles.test.ts`
- Create: `packages/rich-text/src/rich-text-editor.tsx`
- Create: `packages/rich-text/src/dist.test.ts`
- Create: `packages/rich-text/src/editor.test.tsx`
- Modify: `apps/playground/package.json`（dependencies 增加 `"@editorx/rich-text": "workspace:*"`）
- Modify: `apps/playground/app/layout.tsx`（在 publish 样式之后 `import '@editorx/rich-text/styles.css'`）
- Test: `packages/rich-text/src/dist.test.ts`、`packages/rich-text/src/editor.test.tsx`、`packages/rich-text/src/styles.test.ts`

**Interfaces:**
- Consumes: `packages/publish/package.json`、`tsup.config.ts`、`vitest.config.ts`、`tsconfig.json`、`dist.test.ts` 的结构。`pnpm-workspace.yaml` 已包含 `packages/*`。`turbo.json` 的 `build` / `test` 不用改。
- Produces: 包名 `@editorx/rich-text`，导出 `RichTextEditor`、`RichTextEditorProps`、`RichTextEditorHandle`、`RichTextEditorSlots`。根节点 `class="ex-rte"`，内部有 `.ex-rte__scroll`。CSS 含 `height: 100%`、`overflow: auto`、`transform: translate(0)`。`dist/index.js` 首行是 `'use client';`，且存在 `dist/styles.css`。此任务的 `package.json` 不写 ckeditor。

若 `pnpm --filter @editorx/rich-text` 因 lockfile 还没有这个包而拒绝执行，停下来交给控制方跑 `pnpm install --offline`。任务步骤本身不安装。

- [ ] **Step 1: 写失败测试**

`dist.test.ts` 复制 `packages/publish/src/dist.test.ts`，把「不依赖 markdown」的断言留着。`editor.test.tsx`：

```tsx
import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { RichTextEditor } from './rich-text-editor'

describe('RichTextEditor 壳', () => {
  it('滚动容器在组件内部', () => {
    const { container } = render(
      <StrictMode>
        <RichTextEditor />
      </StrictMode>,
    )
    const root = container.querySelector('.ex-rte')
    expect(root).not.toBeNull()
    expect(container.querySelector('.ex-rte__scroll')).not.toBeNull()
    expect(root).toHaveAttribute('data-editor', 'rich-text')
  })

  it('服务端渲染不触碰 window 滚动', () => {
    const html = renderToString(<RichTextEditor />)
    expect(html).toContain('ex-rte__scroll')
    expect(html).not.toContain('ck-editor')
  })
})
```

`styles.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('rich-text styles', () => {
  it('根是高度 100% 的滚动包含块，不用 window', () => {
    expect(css).toMatch(/\.ex-rte \{[^}]*height: 100%;[^}]*transform: translate\(0\)/)
    expect(css).toMatch(/\.ex-rte__scroll \{[^}]*overflow: auto/)
    expect(css).not.toMatch(/window/)
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/editor.test.tsx src/styles.test.ts
```

Expected: FAIL，模块不存在。若 filter 找不到包，先写完 Step 3 的 `package.json` 再跑；仍然失败则交给控制方 `pnpm install --offline`，不要自己装。

- [ ] **Step 3: 实现**

`package.json` 与 `packages/publish/package.json` 相同，名称改为 `@editorx/rich-text`，`dependencies` 只有 `"lucide-react": "^1.53.0"`。`tsconfig.json`、`vitest.config.ts`、`tsup.config.ts` 与 publish 相同（banner `'use client';`，`onSuccess` 调 `tooling/copy-css.mjs`）。

`types.ts` 写入本计划「文件结构」一节的三个 interface 与 `RichTextEditorProps`，并从 `@editorx/toolbar`、`@editorx/theme`、`react` 引入对应类型。

`styles.css`：

```css
.ex-rte-theme { display: contents; }

.ex-rte {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  transform: translate(0);
  background: var(--ex-color-bg);
  font-family: var(--ex-font-family);
}

.ex-rte__scroll {
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
}
```

`rich-text-editor.tsx`：

```tsx
import type { RichTextEditorProps } from './types'

export function RichTextEditor({ className, height = '100%' }: RichTextEditorProps) {
  return (
    <div className={className ? `ex-rte ${className}` : 'ex-rte'} data-editor="rich-text" style={{ height }}>
      <div className="ex-rte__scroll" />
    </div>
  )
}
```

`index.ts`：

```ts
export { RichTextEditor } from './rich-text-editor'
export type { RichTextEditorHandle, RichTextEditorProps, RichTextEditorSlots } from './types'
import './styles.css'
```

`layout.tsx` 增加 `import '@editorx/rich-text/styles.css'`。playground 的 dependencies 增加 `"@editorx/rich-text": "workspace:*"`。

构建后再跑 dist 测试：

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text build
pnpm --filter @editorx/rich-text exec vitest run src/dist.test.ts src/editor.test.tsx src/styles.test.ts
```

- [ ] **Step 4: 跑测试确认通过**

Expected: PASS。`dist/index.js` 第一行是 `'use client';`。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/package.json packages/rich-text/tsconfig.json packages/rich-text/tsup.config.ts packages/rich-text/vitest.config.ts packages/rich-text/src/index.ts packages/rich-text/src/types.ts packages/rich-text/src/styles.css packages/rich-text/src/styles.test.ts packages/rich-text/src/rich-text-editor.tsx packages/rich-text/src/dist.test.ts packages/rich-text/src/editor.test.tsx apps/playground/package.json apps/playground/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(rich-text): 搭建包骨架与内部滚动容器

编辑器占满父高度并把滚动留在组件内，构建产物带 use client 与 styles.css。

EOF
)"
git status
```

若控制方为了让 filter 生效改了 `pnpm-lock.yaml`，把该锁文件一并 `git add`（明确路径 `pnpm-lock.yaml`）。不要把 ckeditor 写进这次提交。

---

### Task 6: 主题 token

**Files:**
- Modify: `packages/theme/src/styles.css`
- Modify: `packages/theme/src/styles.test.ts`
- Test: `packages/theme/src/styles.test.ts`

**Interfaces:**
- Consumes: 主块里每个 `--ex-color-*` 必须以 `light-dark(` 或 `var(--ex-color-` 开头；三个兜底选择器与现有测试一致：`.ex-root,\n  .ex-root[data-ex-theme='light']`、`.ex-root[data-ex-theme='dark']`、`@media (prefers-color-scheme: dark)` 里的 `.ex-root[data-ex-theme='system']`。
- Produces: 下表全部 token。别名在四个位置都写同一个 `var(...)`。字面量在主块写 `light-dark(亮, 暗)`，亮色兜底写亮值，两个暗色兜底写暗值。暗色是推断，无参考图。

别名（实测值已经有 token）：

| token | 值 | 实测 |
|---|---|---|
| `--ex-color-rte-canvas` | `var(--ex-color-bg)` | `#f5f6f7` |
| `--ex-color-rte-paper` | `var(--ex-color-surface)` | `#ffffff` |
| `--ex-color-rte-ink` | `var(--ex-color-text-secondary)` | `#555666` |
| `--ex-color-rte-toc-title` | `var(--ex-color-text)` | `#222226` |
| `--ex-color-rte-chrome` | `var(--ex-color-mde-chrome-text)` | `#1a1a1a` |
| `--ex-color-rte-body` | `var(--ex-color-mde-body-text)` | `#4d4d4d` |
| `--ex-color-rte-placeholder` | `var(--ex-color-mde-disabled-text)` | `#bbbbbb` |
| `--ex-color-rte-title-placeholder` | `var(--ex-color-pub-placeholder)` | `#a8abb2` |
| `--ex-color-rte-title` | `var(--ex-color-pub-label)` | `#606266` |
| `--ex-color-rte-band-border` | `var(--ex-color-pub-bar-border)` | `#e8e8e8` |
| `--ex-color-rte-wand` | `var(--ex-color-mde-divider)` | `#f2f2f2` |
| `--ex-color-rte-heading` | `var(--ex-color-mde-heading-text)` | `#4f4f4f` |
| `--ex-color-rte-list` | `var(--ex-color-mde-list-text)` | `#404040` |
| `--ex-color-rte-link` | `var(--ex-color-mde-preview-link)` | `#4ea1db` |
| `--ex-color-rte-rule` | `var(--ex-color-mde-preview-rule)` | `#dddddd` |

新字面量（主块）：

```css
--ex-color-rte-band: light-dark(#f5f5f5, #1d1e22);
--ex-color-rte-icon-disabled: light-dark(#b5b5bc, #6c6e72);
--ex-color-rte-caret: light-dark(#484848, #a3a6ad);
--ex-color-rte-separator: light-dark(#dbdbdb, #3a3b41);
--ex-color-rte-divider: light-dark(#e8e7e8, #2e2f34);
--ex-color-rte-hover: light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.06));
--ex-color-rte-toc-shadow: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.4));
--ex-color-rte-drawer-shadow: light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.45));
```

激活色继续用 `--ex-color-primary`（`#fc5531`）。标题超限计数用已有 `--ex-color-error`。不要为这两个再造 token。

- [ ] **Step 1: 写失败测试**

`styles.test.ts` 的 `splitLightDark` 开头增加：若 `value.startsWith('var(')` 则 `return [value, value]`。把「每个 `--ex-color-*` 都以 `light-dark(` 开头」改成：

```ts
expect(value, name).toMatch(/^(?:light-dark\(|var\(--ex-color-)/)
```

追加：

```ts
const RTE_ALIAS: Array<[string, string]> = [
  ['--ex-color-rte-canvas', 'var(--ex-color-bg)'],
  ['--ex-color-rte-paper', 'var(--ex-color-surface)'],
  ['--ex-color-rte-ink', 'var(--ex-color-text-secondary)'],
  ['--ex-color-rte-toc-title', 'var(--ex-color-text)'],
  ['--ex-color-rte-chrome', 'var(--ex-color-mde-chrome-text)'],
  ['--ex-color-rte-body', 'var(--ex-color-mde-body-text)'],
  ['--ex-color-rte-placeholder', 'var(--ex-color-mde-disabled-text)'],
  ['--ex-color-rte-title-placeholder', 'var(--ex-color-pub-placeholder)'],
  ['--ex-color-rte-title', 'var(--ex-color-pub-label)'],
  ['--ex-color-rte-band-border', 'var(--ex-color-pub-bar-border)'],
  ['--ex-color-rte-wand', 'var(--ex-color-mde-divider)'],
  ['--ex-color-rte-heading', 'var(--ex-color-mde-heading-text)'],
  ['--ex-color-rte-list', 'var(--ex-color-mde-list-text)'],
  ['--ex-color-rte-link', 'var(--ex-color-mde-preview-link)'],
  ['--ex-color-rte-rule', 'var(--ex-color-mde-preview-rule)'],
]

describe('富文本 token', () => {
  it.each(RTE_ALIAS)('%s 别名已有颜色', (name, value) => {
    expect(mainTokens.get(name)).toBe(value)
  })

  it('新测到的颜色有亮色字面量，暗色为推断值', () => {
    expect(expected.get('--ex-color-rte-band')?.[0]).toBe('#f5f5f5')
    expect(expected.get('--ex-color-rte-icon-disabled')?.[0]).toBe('#b5b5bc')
    expect(expected.get('--ex-color-rte-caret')?.[0]).toBe('#484848')
    expect(expected.get('--ex-color-rte-separator')?.[0]).toBe('#dbdbdb')
    expect(expected.get('--ex-color-rte-divider')?.[0]).toBe('#e8e7e8')
    expect(expected.get('--ex-color-rte-hover')?.[0]).toBe('rgba(0, 0, 0, 0.04)')
    expect(expected.get('--ex-color-rte-toc-shadow')?.[0]).toBe('rgba(0, 0, 0, 0.05)')
    expect(expected.get('--ex-color-rte-drawer-shadow')?.[0]).toBe('rgba(0, 0, 0, 0.06)')
    expect(expected.get('--ex-color-rte-band')?.[1]).toBe('#1d1e22')
    expect(expected.get('--ex-color-rte-hover')?.[1]).toBe('rgba(255, 255, 255, 0.06)')
  })
})
```

现有「兜底块覆盖全部颜色 token」用例会强制这 23 个名字出现在三个兜底块里。

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/theme exec vitest run src/styles.test.ts
```

Expected: FAIL，`mainTokens.get('--ex-color-rte-band')` 为空。

- [ ] **Step 3: 实现**

在主块最后一个 `--ex-color-*` 声明之后（`--ex-font-family` 之前）写入上表。三个兜底块的颜色列表末尾写入对应的亮值或暗值；别名四个位置都是 `var(...)`。不要新开第四个 `@supports` 块。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/theme exec vitest run src/styles.test.ts
```

Expected: PASS，包括原有的兜底一致性用例。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/theme/src/styles.css packages/theme/src/styles.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): 为富文本外壳增加 rte 颜色 token

已有实测色走 var 别名，工具栏带、禁用图标、插字符和阴影用新的 light-dark 值。

EOF
)"
git status
```

---

### Task 7: 工具栏文案、布局与左侧面板位置

**Files:**
- Modify: `packages/toolbar/src/messages.ts`
- Modify: `packages/toolbar/src/messages.test.tsx`
- Modify: `packages/toolbar/src/extension.ts`（`PanelDef.position`）
- Modify: `packages/toolbar/src/layout.test.ts`
- Create: `packages/rich-text/src/layout.ts`
- Create: `packages/rich-text/src/layout.test.ts`
- Modify: `packages/rich-text/src/styles.css`
- Modify: `packages/rich-text/src/styles.test.ts`
- Modify: `packages/rich-text/src/index.ts`
- Test: `packages/toolbar/src/messages.test.tsx`、`packages/toolbar/src/layout.test.ts`、`packages/rich-text/src/layout.test.ts`、`packages/rich-text/src/styles.test.ts`

**Interfaces:**
- Consumes: `ToolbarLayout`、`zhCN.toolbar`、`.ex-toolbar__item.has-label` / `__icon` / `__label` / `__caret`（`packages/toolbar/src/toolbar.tsx`）。Markdown 核心扩展都带 `editors: ['markdown']`。
- Produces:
  - `PanelDef.position: 'left' | 'right' | 'bottom'`。
  - `RICH_TEXT_TOOLBAR_LAYOUT`（从 `@editorx/rich-text` 导出）：

```ts
export const RICH_TEXT_TOOLBAR_LAYOUT: ToolbarLayout = [
  ['undo', 'redo', 'csdn:history'],
  ['format', 'bold', 'color', 'background', 'other'],
  ['list', 'align', 'hr', 'quote'],
  ['code', 'csdn:resource', 'table'],
  ['image', 'csdn:video', 'math', 'link', 'csdn:template', 'toc', 'wide'],
  ['csdn:switch-editor'],
]
```

  - 文案（写在 `zhCN.toolbar`，断言精确字符串）：`undo`「撤消」、`redo`「重做」、`history`「历史」、`format`「格式」、`paragraph`「正文」、`color`「颜色」、`background`「背景」、`other`「其他」、`underline`「下划线」、`clearFormat`「清除格式」、`align`「对齐」、`alignLeft`「左对齐」、`alignCenter`「居中」、`alignRight`「右对齐」、`alignJustify`「两端对齐」、`hr`「水平线」、`quote`「块引用」、`resource`「资源绑定」、`video`「视频」、`template`「模版」、`wide`「宽屏」、`switchEditor`「使用 MD 编辑器」。已有的 `bold`「加粗」、`list`「列表」、`code`「代码块」、`image`「图片」、`link`「链接」、`toc`「目录」保持不变。
  - `zhCN.richText`：`editable`「正文」、`titlePlaceholder`「请输入文章标题（5～100个字）」、`titleNeed`「还需输入{n}个字」、`titleCount`「{n} / 100」、`titleOver`「{n}/100」、`wand`「AI 标题」、`placeholder` 为下面五行用 `\n` 连接的字符串、`drawer`「侧栏」、`words`「共 {n} 字」。

```text
#创作灵感#
• 记录工作实践、项目复盘
• 写技术笔记巩固知识要点
• 发表职场感悟心得
• 搬运自己的原创文章到这
```

- [ ] **Step 1: 写失败测试**

`messages.test.tsx`：

```tsx
  it('富文本工具栏用撤消和模版', () => {
    expect(zhCN.toolbar.undo).toBe('撤消')
    expect(zhCN.toolbar.template).toBe('模版')
    expect(zhCN.toolbar.switchEditor).toBe('使用 MD 编辑器')
    expect(zhCN.richText.titleNeed).toBe('还需输入{n}个字')
    expect(zhCN.richText.placeholder.split('\n')).toEqual([
      '#创作灵感#',
      '• 记录工作实践、项目复盘',
      '• 写技术笔记巩固知识要点',
      '• 发表职场感悟心得',
      '• 搬运自己的原创文章到这',
    ])
    expect(zhCN.panels.tocEmptyAfter).toContain('@[TOC]')
  })
```

`packages/toolbar/src/layout.test.ts` 的 `resolvePanels` describe 追加：

```ts
  it('保留 position 为 left 的面板', () => {
    const render = () => null
    const panels = resolvePanels(
      [{ name: 'toc', panels: [{ id: 'toc', title: '目录', position: 'left', render }] }],
      { editorType: 'richtext', adapters: {} },
    )
    expect(panels.map((item) => item.panel.position)).toEqual(['left'])
  })
```

`packages/rich-text/src/layout.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { RICH_TEXT_TOOLBAR_LAYOUT } from './layout'

describe('RICH_TEXT_TOOLBAR_LAYOUT', () => {
  it('分组与参考图顺序一致，平台项用 csdn: 前缀', () => {
    expect(RICH_TEXT_TOOLBAR_LAYOUT).toEqual([
      ['undo', 'redo', 'csdn:history'],
      ['format', 'bold', 'color', 'background', 'other'],
      ['list', 'align', 'hr', 'quote'],
      ['code', 'csdn:resource', 'table'],
      ['image', 'csdn:video', 'math', 'link', 'csdn:template', 'toc', 'wide'],
      ['csdn:switch-editor'],
    ])
  })
})
```

`styles.test.ts` 追加，并在同一文件读取 `packages/markdown/src/styles.css`，断言不含 `grid-template-areas: 'icon caret'`：

```ts
  it('图标在文字上方，且只作用于 .ex-rte', () => {
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item\.has-label \{[^}]*grid-template-areas: 'icon caret' 'label label'/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item:disabled \{[^}]*color: var\(--ex-color-rte-ink\)/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item:disabled \.ex-toolbar__icon \{[^}]*color: var\(--ex-color-rte-icon-disabled\)/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item:hover:not\(:disabled\) \{[^}]*background: var\(--ex-color-rte-hover\)/)
    expect(css).toMatch(/\.ex-rte \.ex-toolbar__item\.is-active \{[^}]*color: var\(--ex-color-primary\)/)
    const markdownCss = readFileSync(path.join(import.meta.dirname, '../../markdown/src/styles.css'), 'utf8')
    expect(markdownCss).not.toContain("grid-template-areas: 'icon caret'")
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx src/layout.test.ts
pnpm --filter @editorx/rich-text exec vitest run src/layout.test.ts src/styles.test.ts
```

Expected: FAIL，`zhCN.toolbar.undo` 或布局常量不存在。

- [ ] **Step 3: 实现**

`extension.ts` 的 `position` 改为 `'left' | 'right' | 'bottom'`，注释写明 left 不进入 Markdown 右侧图标栏。

`messages.ts` 按接口列出的键补全。`richText.placeholder` 用模板字符串五字行。

`layout.ts` 导出 `RICH_TEXT_TOOLBAR_LAYOUT`。`index.ts` 再导出它。

在 `styles.css` 追加（数字来自审计 §2）：

```css
.ex-rte__band {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 52px;
  border-bottom: 1px solid var(--ex-color-rte-band-border);
  background: var(--ex-color-rte-band);
}

.ex-rte .ex-toolbar {
  justify-content: center;
  width: 100%;
  height: 52px;
  padding-right: 10px;
  overflow: hidden;
  font-family: var(--ex-font-family);
}

.ex-rte .ex-toolbar__group { gap: 0; }

.ex-rte .ex-toolbar__divider {
  width: 1px;
  height: 18px;
  margin: 0 9px;
  background: var(--ex-color-rte-separator);
}

.ex-rte .ex-toolbar__item.has-label {
  display: grid;
  grid-template-areas: 'icon caret' 'label label';
  grid-template-columns: 16px 6px;
  justify-content: center;
  align-items: center;
  height: auto;
  min-height: 0;
  padding: 9px 11px 0;
  gap: 0;
  border-radius: 4px;
  color: var(--ex-color-rte-ink);
  font-size: 12px;
  line-height: 17px;
}

.ex-rte .ex-toolbar__icon { grid-area: icon; width: 16px; height: 16px; }
.ex-rte .ex-toolbar__label { grid-area: label; }
.ex-rte .ex-toolbar__caret {
  grid-area: caret;
  width: 6px;
  height: 3px;
  color: var(--ex-color-rte-caret);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.ex-rte .ex-toolbar__item:hover:not(:disabled) { background: var(--ex-color-rte-hover); }
.ex-rte .ex-toolbar__item.is-active,
.ex-rte .ex-toolbar__item.is-active .ex-toolbar__label,
.ex-rte .ex-toolbar__item.is-active .ex-toolbar__icon { color: var(--ex-color-primary); }
.ex-rte .ex-toolbar__item:disabled { color: var(--ex-color-rte-ink); }
.ex-rte .ex-toolbar__item:disabled .ex-toolbar__icon { color: var(--ex-color-rte-icon-disabled); }
```

不要改 `packages/toolbar/src/styles.css` 与 `packages/markdown/src/styles.css`。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx src/layout.test.ts
pnpm --filter @editorx/rich-text exec vitest run src/layout.test.ts src/styles.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/toolbar/src/messages.ts packages/toolbar/src/messages.test.tsx packages/toolbar/src/extension.ts packages/toolbar/src/layout.test.ts packages/rich-text/src/layout.ts packages/rich-text/src/layout.test.ts packages/rich-text/src/styles.css packages/rich-text/src/styles.test.ts packages/rich-text/src/index.ts
git commit -m "$(cat <<'EOF'
feat(toolbar): 富文本工具栏文案与左侧面板位置

撤消和模版按参考图用字。图标在标签上方的样式只挂在 .ex-rte 下。

EOF
)"
git status
```

---

## 控制方安装（Task 8 开始前，不是任务步骤）

实现者不要执行安装。控制方在 Task 8 开始前执行：

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text add --offline ckeditor5@49.0.0 @ckeditor/ckeditor5-react@12.0.0
```

Task 8 开始时，这两项已经在 `packages/rich-text/package.json` 的 `dependencies` 里。若没有，停下来交给控制方。不要运行 `pnpm install`、`pnpm add` 或 `playwright install`。

`tsup.config.ts` 增加 `external: ['ckeditor5', '@ckeditor/ckeditor5-react', 'react', 'react-dom']`。`apps/playground/next.config.ts` 增加 `transpilePackages: ['ckeditor5', '@ckeditor/ckeditor5-react']`。这两处改动属于 Task 8 的提交，不是安装步骤。

### Task 8: CKEditor 桥

**Files:**
- Create: `packages/rich-text/src/upload-adapter.ts`
- Create: `packages/rich-text/src/upload-adapter.test.ts`
- Create: `packages/rich-text/src/embed-plugin.ts`
- Create: `packages/rich-text/src/ck-config.ts`
- Create: `packages/rich-text/src/ck-config.test.ts`
- Create: `packages/rich-text/src/mount-editor.ts`
- Create: `packages/rich-text/src/core-extensions.tsx`
- Create: `packages/rich-text/src/bridge.test.tsx`
- Modify: `packages/rich-text/src/rich-text-editor.tsx`
- Modify: `packages/rich-text/src/index.ts`
- Modify: `packages/rich-text/tsup.config.ts`
- Modify: `apps/playground/next.config.ts`
- Test: `upload-adapter.test.ts`、`ck-config.test.ts`、`bridge.test.tsx`

**Interfaces:**
- Consumes: Task 5 的 props / handle；Task 7 的布局与文案；Task 1 的 `ImageCropper`。`EditorAdapters.uploadImage`。
- Produces:
  - `createUploadAdapter(file: Promise<File | null>, upload: (file: File, onProgress?: (percent: number) => void) => Promise<{ url: string }>): { upload: () => Promise<{ default: string }>; abort: () => void }`。成功时 `{ default: url }`。
  - `createEditorConfig(options: { uploadImage?: EditorAdapters['uploadImage'] }): { licenseKey: 'GPL'; toolbar: { items: [] }; plugins: unknown[]; extraPlugins: unknown[] }`。
  - `mountEditor(element: HTMLElement, config: ReturnType<typeof createEditorConfig>, initialHtml: string): Promise<MountedEditor>`，且只由 `useEffect` 调用。第三个参数写入 CKEditor 的 `initialData`，这样首次内容不经过会触发 `onChange` 的 `setData`。`MountedEditor`：`getData(): string`、`setData(html: string): void`、`insertHtml(html: string): void`、`execute(name: string, args?: unknown): void`、`focus(): void`、`destroy(): Promise<void>`、`onChange(cb: () => void): () => void`。组件传入 `props.value ?? props.defaultValue ?? ''`。
  - 嵌入块模型名 `exEmbed`，数据 HTML 为 `<div data-ex-embed="TYPE" data-payload="JSON">`。编辑态 `contenteditable="false"`。
  - `richTextCoreExtensions`：`editors: ['richtext']`。按钮 `run` 调用 `ctx.commands.run`。命令名：`undo`、`redo`、`bold`、`italic`、`underline`、`strikethrough`、`superscript`、`subscript`、`code`、`removeFormat`、`bulletedList`、`numberedList`、`todoList`、`horizontalLine`、`blockQuote`、`insertTable`。标题用 `heading`，参数 `{ heading: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6' }`。对齐用 `alignment`，参数 `{ value: 'left' | 'center' | 'right' | 'justify' }`。字色 `fontColor`、底色 `fontBackgroundColor`，参数 `{ value: string }`。
  - 下拉（推断，用 `Dropdown`，不是 CKEditor 自带菜单）：格式＝正文 + 标题 1–6；其他＝斜体、下划线、删除线、上标、下标、行内代码、清除格式；列表＝无序、有序、任务；对齐＝左、中、右、两端；代码＝代码块（语言 `plaintext`、`javascript`、`typescript`、`python`、`java`、`go`、`bash`、`json`）+ 行内代码。颜色与背景是 `popover`，色块值为 `#1a1a1a`、`#fc5531`、`#ff9900`、`#2ea121`、`#4183f1`、`#8e44ad`、`#555666`、`#4d4d4d`（这是写入文档的颜色，不写进 CSS）。
  - 图像是 `modal`：选本地文件后用 `ImageCropper`（`aspect={16 / 9}`，`width={480}`，这是封面裁剪对话框的既有比例），确定后 `adapters.uploadImage`，再 `ctx.insert({ html })`，HTML 为 `<figure class="image"><img src="URL" alt=""></figure>`。链接是 `modal`，字段用 `messages.dialog.linkText` / `linkUrl`。表格是 `modal`，默认 3 行 3 列，`execute('insertTable', { rows, columns })`。公式是 `modal`，一个输入框，插入 `<p data-ex-math="TEX">$$TEX$$</p>`（不新增 katex 依赖，不排版 TeX）。`wide` 切换根节点 `data-wide="true"`。`toc` 按钮 `ctx.togglePanel('toc')`。`requires: ['uploadImage']` 只加在图像项上。
  - `csdn:history`、`csdn:resource`、`csdn:video`、`csdn:template`、`csdn:switch-editor` 不在核心扩展里，缺失时布局跳过。

若 `ckeditor5` 没有具名导出 `ImageInsert`，只把这一项换成 `ImageInsertViaUrl`，其他导入名不动。

- [ ] **Step 1: 写失败测试**

`upload-adapter.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import { createUploadAdapter } from './upload-adapter'

describe('createUploadAdapter', () => {
  it('把 uploadImage 的 url 交给 CKEditor', async () => {
    const upload = vi.fn(async () => ({ url: 'https://cdn.example/a.png' }))
    const adapter = createUploadAdapter(Promise.resolve(new File(['x'], 'a.png', { type: 'image/png' })), upload)
    await expect(adapter.upload()).resolves.toEqual({ default: 'https://cdn.example/a.png' })
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('没有文件时拒绝', async () => {
    const adapter = createUploadAdapter(Promise.resolve(null), vi.fn())
    await expect(adapter.upload()).rejects.toThrow('没有文件')
  })
})
```

`ck-config.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { createEditorConfig } from './ck-config'

describe('createEditorConfig', () => {
  it('使用 GPL，且不渲染 CKEditor 自己的工具栏', () => {
    const config = createEditorConfig({})
    expect(config.licenseKey).toBe('GPL')
    expect(config.toolbar).toEqual({ items: [] })
  })
})
```

`bridge.test.tsx` 用 `vi.mock('./mount-editor', () => ({ mountEditor: vi.fn() }))`。`mountEditor` 返回一个假的 `MountedEditor`：`getData` 初始 `'<p></p>'`，`setData` 改内部字符串，`onChange` 把回调存起来，`insertHtml` 把 HTML 追加进去并触发回调，`execute` / `focus` / `destroy` 为 `vi.fn()`。测试：

```tsx
it('客户端挂载后 onChange 给出 HTML，ref 能读能写', async () => {
  const onChange = vi.fn()
  const ref = createRef<RichTextEditorHandle>()
  render(<StrictMode><RichTextEditor ref={ref} defaultValue="<p>a</p>" onChange={onChange} /></StrictMode>)
  await waitFor(() => expect(mountEditor).toHaveBeenCalled())
  expect(mountEditor).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ licenseKey: 'GPL' }), '<p>a</p>')
  act(() => ref.current!.insert({ html: '<p>b</p>' }))
  expect(onChange).toHaveBeenCalledWith(expect.stringContaining('<p>b</p>'))
  act(() => ref.current!.setValue('<p>c</p>'))
  expect(onChange).not.toHaveBeenCalledWith('<p>c</p>')
  expect(ref.current!.getValue()).toBe('<p>c</p>')
  expect(ref.current!.getDocument()).toEqual({ editorType: 'richtext', title: '', html: '<p>c</p>', markdown: undefined })
})

it('服务端渲染不调用 mountEditor', () => {
  renderToString(<RichTextEditor />)
  expect(mountEditor).not.toHaveBeenCalled()
})
```

`mountEditor` 的 mock 要在两次 `StrictMode` effect 里安全：`destroy` 被调用后不再 `onChange`。

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/upload-adapter.test.ts src/ck-config.test.ts src/bridge.test.tsx
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

`upload-adapter.ts`：

```ts
export function createUploadAdapter(
  file: Promise<File | null>,
  upload: (file: File, onProgress?: (percent: number) => void) => Promise<{ url: string }>,
) {
  return {
    async upload() {
      const resolved = await file
      if (!resolved) throw new Error('没有文件')
      const { url } = await upload(resolved)
      return { default: url }
    },
    abort() {},
  }
}
```

`ck-config.ts` 从 `ckeditor5` 具名导入 `Essentials`、`Paragraph`、`Heading`、`Bold`、`Italic`、`Underline`、`Strikethrough`、`Code`、`Subscript`、`Superscript`、`RemoveFormat`、`Font`、`FontColor`、`FontBackgroundColor`、`List`、`TodoList`、`Alignment`、`HorizontalLine`、`BlockQuote`、`CodeBlock`、`Link`、`Image`、`ImageUpload`、`ImageInsert`、`ImageCaption`、`ImageStyle`、`ImageToolbar`、`Table`、`TableToolbar`、`GeneralHtmlSupport`、`Undo`、`Plugin`。`licenseKey: 'GPL'`。`extraPlugins` 里注册一个 `Plugin`：若有 `uploadImage`，则 `editor.plugins.get('FileRepository').createUploadAdapter = (loader) => createUploadAdapter(loader.file, uploadImage)`。同一插件在 `init` 里注册 `exEmbed`（`inheritAllFrom: '$blockObject'`，属性 `embedType`、`payload`），upcast `div[data-ex-embed]`，dataDowncast 写回这两个 data 属性，editingDowncast 使用 `toWidget`，`contenteditable: 'false'`。

`mount-editor.ts` 在函数内部 `await import('ckeditor5')`，`DecoupledEditor.create(element, config)`。不要在模块顶层调用 `create`。`insertHtml` 用 `editor.data.processor.toView` 与 `editor.data.toModel`，再 `editor.model.insertContent`。`onChange` 监听 `change:data`。组件卸载时 `destroy()`。

`rich-text-editor.tsx`：外壳对齐 `PublishRoot`（有外层 `ThemeProvider` 且没传 `theme` / `defaultTheme` 时复用外层，类名 `ex-rte-theme`）。包一层 `MessagesProvider`。`useEffect` 里调用 `mountEditor`，cleanup 里 `cancelled = true` 并 `destroy`。不要在 effect 函数体里同步 `setState`；`setMounted` 放在 `mountEditor(...).then(...)` 里，且检查 `cancelled`。工具栏用 `@editorx/toolbar` 的 `Toolbar`，`editorType: 'richtext'`，扩展为 `[...coreExtensions, ...extensions]`，布局默认 `RICH_TEXT_TOOLBAR_LAYOUT`。`commands.run` 转到 `mounted.execute`。`insert` / `replaceSelection` 在有 `html` 时调用 `insertHtml`。根结构：

```tsx
<div className={cx('ex-rte', className)} data-editor="rich-text" data-wide={wide || undefined} style={{ height }}>
  <div className="ex-rte__band"><Toolbar ... /></div>
  <div className="ex-rte__scroll">
    <article className="ex-rte-paper">
      <div className="ex-rte-body" ref={editableRef} role="textbox" aria-multiline="true" aria-label={ariaLabel} />
    </article>
    <div className="ex-rte__after">{slots?.afterPaper}</div>
  </div>
</div>
```

`core-extensions.tsx` 按接口做按钮。图像模态里的 `ImageCropper` 使用 Task 1 的失败提示。公式模态不引用 katex。`wide` 通过 `ExtensionContext` 做不到切换根属性时，在编辑器里监听命令名 `wide`（`commands.run('wide')` 由编辑器自己处理，不调用 `editor.execute`）。

CSS 追加正文样式（选择器 `.ex-rte .ck-content`）：字号 16px、行高 26px、颜色 `var(--ex-color-rte-body)`、字体 `var(--ex-font-family)`；标题规则与「Global Constraints」里列出的 Markdown 预览值一致，颜色用 `--ex-color-rte-heading` / `--ex-color-rte-list` / `--ex-color-rte-link` / `--ex-color-rte-rule`。组件文件可以 `import 'ckeditor5/ckeditor5.css'`，这项 import 必须在 `mountEditor` 动态 import 之后的客户端路径里，不要放进会被服务端首屏求值的顶层若它导致 `renderToString` 失败；若顶层 import CSS 让 `bridge.test.tsx` 的服务端用例失败，把 CSS import 移进 `mount-editor.ts`。

`index.ts` 额外导出 `richTextCoreExtensions` 与 `RICH_TEXT_TOOLBAR_LAYOUT`。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/upload-adapter.test.ts src/ck-config.test.ts src/bridge.test.tsx src/editor.test.tsx
```

Expected: PASS。`editor.test.tsx` 继续断言 `.ex-rte__scroll` 存在，且 `renderToString` 的 HTML 不含 `ck-editor`。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/package.json packages/rich-text/tsup.config.ts packages/rich-text/src/upload-adapter.ts packages/rich-text/src/upload-adapter.test.ts packages/rich-text/src/embed-plugin.ts packages/rich-text/src/ck-config.ts packages/rich-text/src/ck-config.test.ts packages/rich-text/src/mount-editor.ts packages/rich-text/src/core-extensions.tsx packages/rich-text/src/bridge.test.tsx packages/rich-text/src/rich-text-editor.tsx packages/rich-text/src/editor.test.tsx packages/rich-text/src/styles.css packages/rich-text/src/index.ts apps/playground/next.config.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(rich-text): 用 GPL 的 CKEditor 编辑 HTML

上传走 adapters.uploadImage，嵌入块写成 data-ex-embed。编辑器只在客户端创建。

EOF
)"
git status
```

只在锁文件确实被控制方安装改过时才加入 `pnpm-lock.yaml`。不要加入未列出的文件。

---

### Task 9: 稿纸标题行

**Files:**
- Create: `packages/rich-text/src/title-counter.ts`
- Create: `packages/rich-text/src/title-counter.test.ts`
- Create: `packages/rich-text/src/paper.tsx`
- Modify: `packages/rich-text/src/rich-text-editor.tsx`
- Modify: `packages/rich-text/src/styles.css`
- Create: `packages/rich-text/src/paper.test.tsx`
- Test: `packages/rich-text/src/title-counter.test.ts`、`packages/rich-text/src/paper.test.tsx`

**Interfaces:**
- Consumes: `messages.richText.titlePlaceholder` / `titleNeed` / `titleCount` / `titleOver` / `wand` / `placeholder`；`--ex-color-rte-title`、`--ex-color-rte-title-placeholder`、`--ex-color-rte-chrome`、`--ex-color-rte-divider`、`--ex-color-rte-placeholder`、`--ex-color-rte-wand`、`--ex-color-rte-paper`、`--ex-color-error`。props `title` / `defaultTitle` / `onTitleChange` / `slots.titleActions`。
- Produces: `titleCounter(length: number, m: Pick<Messages['richText'], 'titleNeed' | 'titleCount' | 'titleOver'>): { text: string; over: boolean }`。`length < 5` 时 `formatMessage(m.titleNeed, { n: 5 - length })` 且 `over: false`。`5 <= length <= 100` 时 `formatMessage(m.titleCount, { n: length })`。`length > 100` 时 `formatMessage(m.titleOver, { n: length })` 且 `over: true`。输入框显示长度用 `Array.from(value).length`。输入框 `maxLength={100}`。占位是 `<p className="ex-rte-placeholder">` 的文本（`white-space: pre-wrap`），不是 `ul`。稿纸 `min-height: 812px`，水平 padding 64，上 padding 32，下 padding 64，无边框无阴影，圆角 4。分隔线在标题行下方，1px，颜色 `--ex-color-rte-divider`。空文档显示占位，`getValue()` 非空时不显示。

- [ ] **Step 1: 写失败测试**

`title-counter.test.ts`：

```ts
import { zhCN } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import { titleCounter } from './title-counter'

const m = zhCN.richText

describe('titleCounter', () => {
  it('不足 5 字、够字、正好 100、超过 100', () => {
    expect(titleCounter(0, m)).toEqual({ text: '还需输入5个字', over: false })
    expect(titleCounter(4, m)).toEqual({ text: '还需输入1个字', over: false })
    expect(titleCounter(5, m)).toEqual({ text: '5 / 100', over: false })
    expect(titleCounter(100, m)).toEqual({ text: '100 / 100', over: false })
    expect(titleCounter(101, m)).toEqual({ text: '101/100', over: true })
  })
})
```

`paper.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { RichTextEditor } from './rich-text-editor'

describe('稿纸标题', () => {
it('空标题显示还需输入 5 个字，占位不是列表', () => {
  const { container } = render(<StrictMode><RichTextEditor /></StrictMode>)
  const input = screen.getByRole('textbox', { name: '文章标题' })
  expect(input).toHaveAttribute('maxLength', '100')
  expect(input).toHaveAttribute('placeholder', '请输入文章标题（5～100个字）')
  expect(screen.getByText('还需输入5个字')).not.toHaveClass('is-over')
  const placeholder = container.querySelector('.ex-rte-placeholder')
  expect(placeholder?.tagName).toBe('P')
  expect(placeholder).toHaveTextContent('#创作灵感#')
  expect(container.querySelector('.ex-rte-placeholder ul')).toBeNull()
  expect(container.querySelector('.ex-rte-paper')).toBeInTheDocument()
})

it('键入停在 100，计数不带错误色', async () => {
  render(
    <StrictMode>
      <RichTextEditor />
    </StrictMode>,
  )
  const input = screen.getByRole('textbox', { name: '文章标题' })
  await userEvent.type(input, '1'.repeat(101))
  expect(input).toHaveValue('1'.repeat(100))
  expect(screen.getByText('100 / 100')).not.toHaveClass('is-over')
  expect(screen.queryByText('101/100')).toBeNull()
})

function Harness({ title }: { title: string }) {
  return (
    <StrictMode>
      <RichTextEditor title={title} />
    </StrictMode>
  )
}

it('受控超长标题显示错误色的 n/100', () => {
  const { rerender } = render(<Harness title={'字'.repeat(101)} />)
  expect(screen.getByText('101/100')).toHaveClass('is-over')
  rerender(<Harness title={'字'.repeat(100)} />)
  expect(screen.getByText('100 / 100')).not.toHaveClass('is-over')
})
})
```

CSS 测试断言：

```ts
expect(css).toMatch(/\.ex-rte-paper \{[^}]*min-height: 812px/)
expect(css).toMatch(/\.ex-rte-paper \{[^}]*padding: 32px 64px 64px/)
expect(css).toMatch(/\.ex-rte-title__input \{[^}]*color: var\(--ex-color-rte-title\)/)
expect(css).toMatch(/\.ex-rte-title__count\.is-over \{[^}]*color: var\(--ex-color-error\)/)
expect(css).toMatch(/\.ex-rte-placeholder \{[^}]*line-height: 32px/)
expect(css).not.toMatch(/\.ex-rte-placeholder[^,{]*ul/)
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/title-counter.test.ts src/paper.test.tsx src/styles.test.ts
```

Expected: FAIL，找不到标题输入框。

- [ ] **Step 3: 实现**

`title-counter.ts`：

```ts
import { formatMessage, type Messages } from '@editorx/toolbar'

type TitleMessages = Pick<Messages['richText'], 'titleNeed' | 'titleCount' | 'titleOver'>

export function titleCounter(length: number, m: TitleMessages): { text: string; over: boolean } {
  if (length > 100) return { text: formatMessage(m.titleOver, { n: length }), over: true }
  if (length < 5) return { text: formatMessage(m.titleNeed, { n: 5 - length }), over: false }
  return { text: formatMessage(m.titleCount, { n: length }), over: false }
}
```

`paper.tsx` 导出 `PaperChrome`，接收 `title`、`onTitleChange`、`empty`、`titleActions`。计数用 `titleCounter(Array.from(title).length, useMessages().richText)`。输入：

```tsx
<input
  className="ex-rte-title__input"
  aria-label="文章标题"
  placeholder={m.richText.titlePlaceholder}
  maxLength={100}
  value={title}
  onChange={(event) => onTitleChange(event.target.value)}
/>
```

`aria-label` 用常量「文章标题」（不进工具栏桶，避免和 `titlePlaceholder` 混淆）。计数 `<span className={cx('ex-rte-title__count', over && 'is-over')}>`。`n < 5` 时动作区 `margin-right: 12px`，否则 `8px`（类名 `is-ready` 加在 `.ex-rte-title` 上）。默认魔杖：

```tsx
<button type="button" className="ex-rte-title__wand" aria-label={m.richText.wand}>
  <Wand2 size={14} aria-hidden="true" />
</button>
```

有 `slots.titleActions` 时替换这个按钮，外层仍是 32×32 的 `.ex-rte-title__actions`。占位 `<p className="ex-rte-placeholder">{m.richText.placeholder}</p>`，`empty` 为假时不渲染。

CSS（稿纸相对坐标来自审计 §3）：

```css
.ex-rte__scroll { padding-top: 33px; }
.ex-rte-paper {
  box-sizing: border-box;
  width: 816px;
  min-height: 812px;
  margin: 0 auto;
  padding: 32px 64px 64px;
  border-radius: 4px;
  background: var(--ex-color-rte-paper);
}
.ex-rte-title { display: flex; align-items: center; min-height: 32px; }
.ex-rte-title__input {
  flex: 1;
  min-width: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--ex-color-rte-title);
  font-family: var(--ex-font-family);
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}
.ex-rte-title__input::placeholder { color: var(--ex-color-rte-title-placeholder); font-weight: 600; }
.ex-rte-title__count { flex: none; color: var(--ex-color-rte-chrome); font-size: 12px; line-height: 17px; }
.ex-rte-title__count.is-over { color: var(--ex-color-error); }
.ex-rte-title__actions { flex: none; margin-right: 12px; }
.ex-rte-title.is-ready .ex-rte-title__actions { margin-right: 8px; }
.ex-rte-title__wand {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: var(--ex-color-rte-wand);
  color: var(--ex-color-rte-chrome);
}
.ex-rte-paper__rule { height: 1px; margin: 23px 0 0; border: 0; background: var(--ex-color-rte-divider); }
.ex-rte-placeholder {
  margin: 24px 0 0;
  color: var(--ex-color-rte-placeholder);
  font-size: 16px;
  line-height: 32px;
  white-space: pre-wrap;
  pointer-events: none;
}
.ex-rte[data-wide='true'] .ex-rte-paper { width: calc(100% - 240px); min-width: 816px; }
```

`33px` 是页面坐标 133 减去顶栏 48 再减去工具栏 52。分隔线上边距 23 使线落在稿纸 y=87（32 + 32 + 23）。占位 `margin-top: 24px` 对应分隔线后的第一行盒子从 y=112 起。

受控 `title` 原样显示，即使超过 100。非受控用 `defaultTitle`。`onTitleChange` 传输入框的值。`getDocument().title` 用当前标题。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/title-counter.test.ts src/paper.test.tsx src/styles.test.ts src/bridge.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/src/title-counter.ts packages/rich-text/src/title-counter.test.ts packages/rich-text/src/paper.tsx packages/rich-text/src/paper.test.tsx packages/rich-text/src/rich-text-editor.tsx packages/rich-text/src/styles.css packages/rich-text/src/styles.test.ts
git commit -m "$(cat <<'EOF'
feat(rich-text): 稿纸标题、计数与空文档占位

不足 5 字提示还需输入，超长受控值用错误色显示 n/100，占位按参考文案渲染为文本。

EOF
)"
git status
```

---

### Task 10: 左侧目录

**Files:**
- Create: `packages/rich-text/src/headings.ts`
- Create: `packages/rich-text/src/headings.test.ts`
- Create: `packages/rich-text/src/toc-panel.tsx`
- Modify: `packages/rich-text/src/core-extensions.tsx`（`toc` 面板 `position: 'left'`）
- Modify: `packages/rich-text/src/rich-text-editor.tsx`
- Modify: `packages/rich-text/src/styles.css`
- Test: `packages/rich-text/src/headings.test.ts`、`packages/rich-text/src/toc-panel.test.tsx`

**Interfaces:**
- Consumes: `resolvePanels`；`messages.panels.toc`「目录」、`panels.tocEmpty`、`panels.collapse`「收起」、`panels.expand`「展开」。`PanelDef.position === 'left'`。
- Produces: `extractHeadings(html: string): { level: number; text: string; id: string }[]`。只收集 `h1`–`h6`，`text` 为 trim 后的文本，`id` 用元素 id，没有则 `ex-h-${序号}`（从 1 起）。忽略空标题。正文里的 `@[TOC]` 不产生条目。编辑器在 `.ex-rte` 内渲染 `<aside class="ex-rte-toc" aria-label="目录">`，宽 280，`left: 23px`，`top: 84px`，`bottom: 37px`。空态文字水平居中，并在面板内垂直居中。收起后面板加 `is-collapsed`，留下 `aria-label="展开"` 的按钮。`defaultTocOpen` 默认 `true`。点击条目滚动 `.ex-rte__scroll` 里对应标题（`scrollIntoView` 的滚动容器是该元素，不是 window）。宽度小于 1200px 时目录默认不显示，展开按钮仍在。

- [ ] **Step 1: 写失败测试**

```ts
it('从标题生成目录，不要求 @[TOC]', () => {
  expect(extractHeadings('<p>@[TOC]</p><h2 id="a">安装</h2><h3>  </h3><h3>步骤</h3>')).toEqual([
    { level: 2, text: '安装', id: 'a' },
    { level: 3, text: '步骤', id: 'ex-h-2' },
  ])
})
```

`toc-panel.test.tsx` 渲染 `<RichTextEditor defaultValue="<h2>安装</h2>" />`，等待目录按钮「安装」。再渲染 `defaultValue="<p>@[TOC]</p>"`，期望文案「为文内增加标题，这里将生成目录」，且没有按钮「@[TOC]」。断言 `zhCN.panels.tocEmptyAfter` 仍包含 `@[TOC]`。点击「收起」后面板有 `is-collapsed`。CSS 断言宽 280、`left: 23px`、`top: 84px`、`bottom: 37px`，以及：

```css
@media (max-width: 1199px) {
  .ex-rte-toc { visibility: hidden; }
  .ex-rte-toc.is-open { visibility: visible; }
}
```

把这段写进样式测试的 `toMatch`。

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/headings.test.ts src/toc-panel.test.tsx
```

Expected: FAIL，`extractHeadings` 不存在。

- [ ] **Step 3: 实现**

`extractHeadings` 用 `DOMParser`，`querySelectorAll('h1, h2, h3, h4, h5, h6')`。核心扩展增加面板：

```tsx
{
  id: 'toc',
  title: (m) => m.panels.toc,
  position: 'left',
  render: (ctx) => <TocPanel html={ctx.getDocument().html} />,
}
```

`TocPanel` 自己不读 CKEditor。编辑器把 `extractHeadings(html)` 的结果画在 aside 里，避免面板 render 与文档状态分叉。头部是「目录」加收起按钮。列表按钮 `data-heading-id`。空态 `<p className="ex-rte-toc__empty">`。

```css
.ex-rte-toc {
  position: absolute;
  z-index: 4;
  top: 84px;
  bottom: 37px;
  left: 23px;
  display: flex;
  flex-direction: column;
  width: 280px;
  border-radius: 4px;
  background: var(--ex-color-rte-paper);
  box-shadow: 0 0 20px var(--ex-color-rte-toc-shadow);
}
.ex-rte-toc.is-collapsed { width: 0; visibility: hidden; }
.ex-rte-toc__expand { position: absolute; z-index: 4; top: 84px; left: 23px; }
.ex-rte-toc__empty {
  margin: auto;
  color: var(--ex-color-rte-ink);
  font-size: 14px;
  text-align: center;
}
.ex-rte-toc__title { margin: 0; padding: 16px 16px 0; color: var(--ex-color-rte-toc-title); font-size: 14px; }
.ex-rte-toc__rule { height: 1px; margin: 12px 16px 0; background: var(--ex-color-rte-divider); }
```

收起按钮的图标是 1px 描边的竖线加左箭头，颜色 `currentColor`，不要用图片素材。`z-index: 4` 低于发布栏的 10，使目录底部藏在栏后面。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/headings.test.ts src/toc-panel.test.tsx src/styles.test.ts
pnpm --filter @editorx/markdown exec vitest run src/panels/panels.test.tsx
```

Expected: PASS。Markdown 目录测试不该因 `position: 'left'` 失败。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/src/headings.ts packages/rich-text/src/headings.test.ts packages/rich-text/src/toc-panel.tsx packages/rich-text/src/toc-panel.test.tsx packages/rich-text/src/core-extensions.tsx packages/rich-text/src/rich-text-editor.tsx packages/rich-text/src/styles.css packages/rich-text/src/styles.test.ts
git commit -m "$(cat <<'EOF'
feat(rich-text): 按标题生成左侧目录

没有 @[TOC] 也列出 h1 到 h6。空目录使用「为文内增加标题，这里将生成目录」。

EOF
)"
git status
```

---

### Task 11: 右侧抽屉宿主

**Files:**
- Create: `packages/rich-text/src/drawer.tsx`
- Create: `packages/rich-text/src/drawer.test.tsx`
- Modify: `packages/rich-text/src/rich-text-editor.tsx`
- Modify: `packages/rich-text/src/styles.css`
- Test: `packages/rich-text/src/drawer.test.tsx`

**Interfaces:**
- Consumes: `rightOpen` / `defaultRightOpen` / `onRightOpenChange` / `slots.rightCollapsed`；`resolvePanels` 的 `position === 'right'`。
- Produces: 有右侧面板且展开时，`<aside className="ex-rte-drawer" aria-label={messages.richText.drawer}>`，宽 390，`top: 52px`，`right: 0`，`bottom: 68px`，`z-index: 20`（高于发布栏的 10，低于 `--ex-z-popover`）。位置是 `absolute`，不推动稿纸。头部有 `aria-label="收起"` 的按钮，点击后 `onRightOpenChange(false)` 并渲染 `slots.rightCollapsed`。没有右侧面板时不渲染抽屉。稿纸保持 `width: 816px` 且 `margin: 0 auto`。

- [ ] **Step 1: 写失败测试**

```tsx
const panel: EditorExtension = {
  name: 'csdn:ai',
  editors: ['richtext'],
  panels: [{ id: 'csdn:ai', title: 'AI', position: 'right', render: () => <p>占位面板</p> }],
}

it('展开时抽屉宽 390 且不改变稿纸宽度类', () => {
  const { container } = render(
    <StrictMode>
      <RichTextEditor extensions={[panel]} slots={{ rightCollapsed: <div data-testid="collapsed">收起占位</div> }} />
    </StrictMode>,
  )
  expect(screen.getByText('占位面板')).toBeInTheDocument()
  expect(container.querySelector('.ex-rte-drawer')).toBeInTheDocument()
  expect(container.querySelector('.ex-rte-paper')).toBeInTheDocument()
  expect(screen.queryByTestId('collapsed')).toBeNull()
})

it('收起后只渲染 rightCollapsed', async () => {
  const onRightOpenChange = vi.fn()
  render(
    <StrictMode>
      <RichTextEditor extensions={[panel]} onRightOpenChange={onRightOpenChange} slots={{ rightCollapsed: <div>收起占位</div> }} />
    </StrictMode>,
  )
  await userEvent.click(screen.getByRole('button', { name: '收起' }))
  expect(onRightOpenChange).toHaveBeenCalledWith(false)
  expect(screen.getByText('收起占位')).toBeInTheDocument()
  expect(screen.queryByText('占位面板')).toBeNull()
})
```

CSS 断言 `width: 390px`、`top: 52px`、`bottom: 68px`、`z-index: 20`、`position: absolute`。

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/drawer.test.tsx
```

Expected: FAIL，找不到「占位面板」。

- [ ] **Step 3: 实现**

`drawer.tsx` 只负责框和收起按钮，`children` 是面板内容。编辑器过滤 `position === 'right'`，展开时把这些面板的 `render(ctx)` 放进抽屉。受控与非受控：传了 `rightOpen` 就用它，否则用内部 state，初值 `defaultRightOpen ?? true`。收起时若有 `rightCollapsed` 就渲染在 `.ex-rte-collapsed`。

```css
.ex-rte-drawer {
  position: absolute;
  z-index: 20;
  top: 52px;
  right: 0;
  bottom: 68px;
  width: 390px;
  overflow: auto;
  background: var(--ex-color-rte-paper);
  box-shadow: 0 0 20px var(--ex-color-rte-drawer-shadow);
}
.ex-rte-collapsed {
  position: absolute;
  z-index: 20;
  top: 86px;
  right: 8px;
}
```

`86px` 是参考图浮动菜单 y=134 减去顶栏 48。`right: 8px` 对应 `W - 8 - 104`。不要在包里画 AI 助手的芯片、输入框或渐变 logo。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/drawer.test.tsx src/styles.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/src/drawer.tsx packages/rich-text/src/drawer.test.tsx packages/rich-text/src/rich-text-editor.tsx packages/rich-text/src/styles.css packages/rich-text/src/styles.test.ts
git commit -m "$(cat <<'EOF'
feat(rich-text): 增加不推动稿纸的右侧抽屉宿主

展开宽 390，收起后把浮层交给 rightCollapsed，面板内容仍由扩展渲染。

EOF
)"
git status
```

---

### Task 12: 字数与稿纸后插槽

**Files:**
- Create: `packages/rich-text/src/count.ts`
- Create: `packages/rich-text/src/count.test.ts`
- Modify: `packages/rich-text/src/rich-text-editor.tsx`
- Test: `packages/rich-text/src/count.test.ts`、`packages/rich-text/src/count-editor.test.tsx`

**Interfaces:**
- Consumes: `onWordCount`、`slots.afterPaper`。`countWords` 的口径：`INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/gu`，`WHITESPACE = /\s/gu`，`chars = Array.from(text.replace(INVISIBLE, '').replace(WHITESPACE, '')).length`。
- Produces: `countRichTextChars(html: string): number`。用 `DOMParser` 去掉 `script, style, noscript` 后再按上面的口径计数。编辑器在挂载后和每次 HTML 变化时调用 `onWordCount(countRichTextChars(html))`。`.ex-rte__after` 渲染 `slots.afterPaper`。组件不渲染「共 N 字」这句话（那是宿主的发布栏内容）；包内导出该函数，playground 用 `messages.richText.words` 格式化。

- [ ] **Step 1: 写失败测试**

```ts
it('字数不计空格和零宽字符，不计 script', () => {
  expect(countRichTextChars('<p>12312312312</p>')).toBe(11)
  expect(countRichTextChars('<p>a b</p>')).toBe(2)
  expect(countRichTextChars('<p>a\u200Bb\u200Cc\u200Dd\u2060e\uFEFFf</p>')).toBe(6)
  expect(countRichTextChars('<script>secret</script><p>ab</p>')).toBe(2)
  expect(countRichTextChars('<p> </p>')).toBe(0)
})
```

`count-editor.test.tsx` 用与 `bridge.test.tsx` 相同的方式 `vi.mock('./mount-editor')`。mock 的第三个参数成为 `getData()` 的初值；`insertHtml` 追加 HTML 并调用 `onChange`；`setData` 只改字符串。测试正文：

```tsx
it('挂载和插入都会报告非空白字数', async () => {
  const onWordCount = vi.fn()
  const ref = createRef<RichTextEditorHandle>()
  const { container } = render(
    <StrictMode>
      <RichTextEditor ref={ref} defaultValue="<p>a b</p>" onWordCount={onWordCount} slots={{ afterPaper: <p>发布栏占位</p> }} />
    </StrictMode>,
  )
  await waitFor(() => expect(onWordCount).toHaveBeenCalledWith(2))
  act(() => ref.current!.insert({ html: '<p>cd</p>' }))
  await waitFor(() => expect(onWordCount).toHaveBeenCalledWith(4))
  const after = container.querySelector('.ex-rte__after')
  expect(after).toHaveTextContent('发布栏占位')
  expect(after?.parentElement).toHaveClass('ex-rte__scroll')
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/count.test.ts src/count-editor.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现**

```ts
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/gu
const WHITESPACE = /\s/gu

export function countRichTextChars(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove())
  const text = doc.body.textContent ?? ''
  return Array.from(text.replace(INVISIBLE, '').replace(WHITESPACE, '')).length
}
```

在 `mountEditor` 的 `onChange` 和首次 `getData` 之后调用 `onWordCount`。不要在 effect 里同步 `setState` 来存字数；宿主自己存。`index.ts` 导出 `countRichTextChars`。

- [ ] **Step 4: 跑测试确认通过**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/count.test.ts src/count-editor.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/src/count.ts packages/rich-text/src/count.test.ts packages/rich-text/src/count-editor.test.tsx packages/rich-text/src/rich-text-editor.tsx packages/rich-text/src/index.ts
git commit -m "$(cat <<'EOF'
feat(rich-text): 按非空白字符报告字数并露出稿纸后插槽

零宽字符和 script 不计数。发布栏由宿主放在插槽里，不放进富文本包。

EOF
)"
git status
```

---

### Task 13: Playground /rich-text

**Files:**
- Create: `apps/playground/app/rich-text/page.tsx`
- Create: `apps/playground/app/rich-text/rich-text-playground.tsx`
- Create: `apps/playground/app/rich-text/stand-in-extensions.tsx`
- Create: `apps/playground/app/rich-text/rich-text.css`
- Modify: `apps/playground/app/page.tsx`（若首页有包链接列表，加一条 `/rich-text`；没有列表则不要改首页）
- Test: `packages/rich-text` 无新单测；本任务用 Step 4 的类型检查，浏览器行为放到 Task 14

**Interfaces:**
- Consumes: `RichTextEditor`、`onWordCount`、`slots.afterPaper`、`slots.rightCollapsed`、`countRichTextChars`、`PublishPanel` 的 `barPosition="fixed"`、`QuotaNotice`、`formatMessage(zhCN.richText.words, { n })`。
- Produces: 路由 `/rich-text`。页面根 `.pg-rte` 高 100%，`html:has(.pg-rte), html:has(.pg-rte) body { height: 100%; overflow: hidden; }`。文档 `editorType: 'richtext'`。占位扩展（`editors: ['richtext']`）：
  - `csdn:history`、`csdn:resource`、`csdn:video`、`csdn:template`：按钮，`run` 时 `ctx.notify('阶段 7 接入', 'info')`。
  - `csdn:switch-editor`：按钮，`ctx.notify('阶段 6 接入', 'info')`。图标单色 `ArrowLeftRight`。
  - `csdn:ai`：`position: 'right'` 的面板，内容只有一段「AI 助手占位」。
  - 收起浮层是 `<div className="pg-rte-float">AI助手</div>`，宽 104、高 159，圆角 `20px 0 8px 20px`，背景 `var(--ex-color-rte-paper)`，阴影 `0 0 40px var(--ex-color-rte-drawer-shadow)`。
- 发布栏 `barStart`：`<span className="pg-rte-count">共 {n} 字</span>`、一个加粗按钮、`QuotaNotice`。按钮在卡片进入 `.ex-rte__scroll` 可见区域时文案为「回到顶部」，否则为「发文设置」。颜色 `var(--ex-color-rte-chrome)`，不是 primary。点击「发文设置」把 `.ex-pub-card` 滚进 `.ex-rte__scroll`；点击「回到顶部」把该容器的 `scrollTop` 设为 0。观察器用 `IntersectionObserver`，`root` 是 `.ex-rte__scroll`。查询参数 `drawer=closed` 时 `defaultRightOpen={false}`。`scroll=card` 时挂载后把卡片滚进容器。不要画顶栏，不要画反馈 tab。

- [ ] **Step 1: 写页面与样式**

`page.tsx` 是服务端组件，读 `searchParams`，把 `drawer` 与 `scroll` 传给客户端 `RichTextPlayground`。`stand-in-extensions.tsx` 按接口写出五个扩展，不要写 `TODO`。发布栏：

```tsx
<PublishPanel
  document={{ editorType: 'richtext', title, html }}
  adapters={adapters}
  barPosition="fixed"
  slots={{
    barStart: (
      <>
        <span className="pg-rte-count">{formatMessage(zhCN.richText.words, { n: words })}</span>
        <button type="button" className="pg-rte-jump" onClick={onJump}>
          {cardVisible ? '回到顶部' : '发文设置'}
        </button>
        <QuotaNotice />
      </>
    ),
  }}
/>
```

`adapters` 复用 `apps/playground/app/publish/mock-adapters.ts` 的 `createPublishAdapters`。`title` / `html` 来自编辑器 `onTitleChange` 与 `onChange`。

```css
.pg-rte { height: 100%; }
.pg-rte-jump { border: 0; background: transparent; color: var(--ex-color-rte-chrome); font-weight: 600; font-size: 14px; }
.pg-rte-float {
  box-sizing: border-box;
  width: 104px;
  height: 159px;
  border-radius: 20px 0 8px 20px;
  background: var(--ex-color-rte-paper);
  box-shadow: 0 0 40px var(--ex-color-rte-drawer-shadow);
  color: var(--ex-color-rte-chrome);
  font-size: 14px;
  font-weight: 600;
}
```

- [ ] **Step 2: 类型检查**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec tsc -p tsconfig.json --noEmit
pnpm --filter @editorx/playground exec tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
test "$(git branch --show-current)" = develop
git add apps/playground/app/rich-text/page.tsx apps/playground/app/rich-text/rich-text-playground.tsx apps/playground/app/rich-text/stand-in-extensions.tsx apps/playground/app/rich-text/rich-text.css apps/playground/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(playground): 增加富文本演示页

稿纸下挂固定发布栏，历史和 AI 只做占位，便于对照 mac 参考图。

EOF
)"
git status
```

首页没改就不要 `git add` 它。

---

### Task 14: 功能 e2e、几何对照与 darwin 基线

**Files:**
- Create: `apps/playground/e2e/rich-text.spec.ts`
- Create: `apps/playground/e2e/rich-text-parity.spec.ts`
- Create: `apps/playground/e2e/rich-text-visual.spec.ts`
- Test: 上述三个 spec

**Interfaces:**
- Consumes: `/rich-text`、`drawer=closed`、`scroll=card`、`box` / `near`（`apps/playground/e2e/helpers.ts`）。参考图已在 `apps/playground/public/reference/`：`mac_2026-10-10_19-13-05.png`（空文档、抽屉开）、`19-13-15.png`（收起）、`19-13-37.png`（滚到卡片）。页面原点只用于说明，几何断言用编辑器坐标：参考图页面 y 减去顶栏 48。darwin 视口 1727×932（内容宽 1712 + 15px 滚动条），win32 视口 2559×1305（内容宽 2544 + 15）。`launchOptions.ignoreDefaultArgs` 含 `'--hide-scrollbars'`。
- Produces: 功能 spec 不截图像素。parity 是必过门槛。视觉基线只在 darwin 更新一次再无更新重跑。不新增 `EX_ACCEPTANCE` 像素检索：工具栏是 lucide，和 CSDN 图标素材的通道差会超过 0.03。不改 `reference-acceptance.spec.ts`。

darwin 期望（容差 1px，纸高除外）：

| 区域 | x | y | w | h |
|---|---|---|---|---|
| `.ex-rte__band` | 0 | 0 | 视口内容宽 | 52 |
| `.ex-rte-paper` | 448 | 85 | 816 | ≥ 812 |
| `.ex-rte-toc` | 23 | 84 | 280 | 底边距容器底 37 |
| `.ex-rte-drawer` | 1322 | 52 | 390 | 底边在容器底上方 68 |
| `.ex-pub-bar.is-fixed` | 0 | 864 | 视口宽 | 68 |
| `.ex-pub-bar__inner` | 水平居中 |  | 1080 |  |

纸的 x=448 是 `(1712-816)/2`。抽屉 x=1322 是 `1712-390`。栏 y=864 是 `932-68`。收起后 `.pg-rte-float` 为 104×159，`top` 约 86，`right` 距容器右边 8。`scroll=card` 时 `.ex-pub-card` 与 `.ex-rte__scroll` 的可见区域相交，且 `window.scrollY === 0`。

- [ ] **Step 1: 写 spec**

`rich-text.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test('空标题不能发布，输入标题和正文后字数变化', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/rich-text')
  await page.getByRole('button', { name: '发布博客' }).click()
  await expect(page.getByRole('status').filter({ hasText: '文章标题需为 5～100 个字' })).toBeVisible()
  await page.getByRole('textbox', { name: '文章标题' }).fill('足够长的标题')
  await page.locator('.ex-rte-body').click()
  await page.keyboard.type('你好 世界')
  await expect(page.locator('.pg-rte-count')).toHaveText('共 4 字')
  await page.getByRole('button', { name: '历史' }).click()
  await expect(page.getByRole('status').filter({ hasText: '阶段 7 接入' })).toBeVisible()
  expect(errors).toEqual([])
})
```

「你好 世界」去掉空格是 4 个字。若 CKEditor 把空格留在文本里，断言仍是 4。

`rich-text-parity.spec.ts` 开头：

```ts
import { expect, test } from '@playwright/test'
import { box, near } from './helpers'

test.skip(process.platform !== 'win32' && process.platform !== 'darwin', 'Windows/macOS-only geometry')
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })
```

darwin `describe`：`test.skip(process.platform !== 'darwin', 'mac 参考图')`，`test.use({ viewport: { width: 1727, height: 932 } })`。打开 `/rich-text`，用 `near` 断言上表。目录空文案的中心 y 与 `.ex-rte-toc` 的中心 y 相差不超过 8（面板内垂直居中；因为没有顶栏，不要求等于参考图的页面 y 513.75）。`/rich-text?drawer=closed` 断言浮层盒子。`/rich-text?scroll=card` 断言 `window.scrollY === 0` 且卡片与滚动容器相交，按钮名为「回到顶部」。

win32 `describe`：

```ts
test.describe('win32（12-35-51，2544×1305）', () => {
  // 待 Windows 复测
  test.skip(process.platform !== 'win32', '待 Windows 复测')
  test.use({ viewport: { width: 2559, height: 1305 } })
  test('稿纸仍按内容宽居中', async ({ page }) => {
    await page.goto('/rich-text')
    const paper = await box(page.locator('.ex-rte-paper'))
    near(paper.x, 864, 2, 'paper.x')
    near(paper.width, 816, 1, 'paper.w')
    near(paper.y, 85, 2, 'paper.y')
  })
})
```

864 是 `(2544-816)/2`。

`rich-text-visual.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test.skip(process.platform !== 'darwin', '待 Windows 复测')
test.use({ viewport: { width: 1727, height: 932 }, deviceScaleFactor: 1 })

test('空文档亮色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/rich-text')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('rich-text-empty-light.png', { animations: 'disabled', caret: 'hide' })
})
```

同样方式再写 `rich-text-collapsed-light.png`（`drawer=closed`）、`rich-text-scrolled-light.png`（`scroll=card`）、`rich-text-empty-dark.png`（`colorScheme: 'dark'`）。不要在 win32 上去掉 skip，否则会写出 win32 PNG。

- [ ] **Step 2: 构建并跑功能与几何**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force
pids=$(lsof -ti tcp:3100 || true); if [ -n "$pids" ]; then kill -9 $pids; fi
pnpm --filter @editorx/playground exec playwright test e2e/rich-text.spec.ts e2e/rich-text-parity.spec.ts
```

Expected: darwin 上功能 spec 与 darwin parity 通过；win32 describe 为 skipped。失败时改组件，不要放宽容差到超过 2px，也不要改预期去迎合一个写错的选择器。

- [ ] **Step 3: 更新 darwin 基线一次，然后不带更新重跑**

```bash
export COREPACK_INTEGRITY_KEYS=0
pids=$(lsof -ti tcp:3100 || true); if [ -n "$pids" ]; then kill -9 $pids; fi
pnpm --filter @editorx/playground exec playwright test e2e/rich-text-visual.spec.ts --update-snapshots
pnpm --filter @editorx/playground exec playwright test e2e/rich-text-visual.spec.ts
```

Expected: 第二次不带 `--update-snapshots` 也通过。只应出现 `*-chromium-darwin.png`。若出现 win32 文件，删掉这次误生成的 win32 新文件，保留 skip，不要删除仓库里原有的其他 win32 基线。

- [ ] **Step 4: 提交**

```bash
test "$(git branch --show-current)" = develop
git add apps/playground/e2e/rich-text.spec.ts apps/playground/e2e/rich-text-parity.spec.ts apps/playground/e2e/rich-text-visual.spec.ts apps/playground/e2e/rich-text-visual.spec.ts-snapshots
git commit -m "$(cat <<'EOF'
test(playground): 为富文本页补上功能、几何与 darwin 基线

几何按 mac 参考图减去顶栏高度。win32 描述先跳过，留待 Windows 复测。

EOF
)"
git status
```

快照在 `apps/playground/e2e/rich-text-visual.spec.ts-snapshots/`。只 `git add` 该目录里新的 `*-chromium-darwin.png`。不要 `git add` 其他 spec 的基线。

---

### Task 15: 阶段 6 交接笔记

**Files:**
- Create: `docs/superpowers/handoff/phase6-notes-from-5.md`
- Modify: `docs/superpowers/handoff/RESUME.md`
- Test: 无代码测试。笔记必须包含下面列出的事实，提交前用 `git diff --check`。

**Interfaces:**
- Consumes: 本计划的公开类型与 `FALLBACK_DOC`。
- Produces: 阶段 6 可以不翻审计原文就接着做顶栏和 `<CsdnEditor />`。

- [ ] **Step 1: 写笔记**

`phase6-notes-from-5.md` 用中文，至少包括这些段落（数字保持本计划里的值）：

- 代码范围：`@editorx/rich-text` 的 `<RichTextEditor />`。HEAD 用提交时的 `git rev-parse --short HEAD`。分支 `develop`。
- 公开 API：`RichTextEditor`、`richTextCoreExtensions`、`RICH_TEXT_TOOLBAR_LAYOUT`、`countRichTextChars`。ref 为 `focus` / `getValue` / `setValue` / `getDocument` / `insert`。插槽 `titleActions`、`afterPaper`、`rightCollapsed`。`onWordCount` 是非空白字数。
- 滚动：根节点 `transform: translate(0)` 之后，`barPosition="fixed"` 相对编辑器。阶段 6 顶栏若在编辑器外面，不要改回 `window` 滚动。
- 发布：playground 传 `editorType: 'richtext'`，墨衍禁用。未传 document 的回退是 `FALLBACK_DOC`（markdown）。空标题或 `htmlToText` 为空不会 `onPublish`。
- 目录：富文本看标题，不看 `@[TOC]`。Markdown 的 `tocEmptyAfter` 未改。
- 不做的事：顶栏、反馈 tab、`<CsdnEditor />`、编辑器切换的真实行为、AI 面板内容。占位扩展会 toast「阶段 6 接入」或「阶段 7 接入」。「使用 MD 编辑器」是单色 SVG。
- 视觉：darwin 基线四个名字（empty / collapsed / scrolled / empty-dark）。深色无参考。win32 parity 已 skip，注释是「待 Windows 复测」。没有新增 EX_ACCEPTANCE 像素检索。
- 参考图：`mac_2026-10-10_19-13-05`、`19-13-15`、`19-13-37`。编辑器坐标 = 参考页面坐标减 48。

`RESUME.md` 的阶段表里，把阶段 5 那一行改为已完成，并指向 `phase6-notes-from-5.md`。阶段 6–8 仍是未开始。不要改「陈旧 win32 基线」列表里已有的文件名。

- [ ] **Step 2: 检查并提交**

```bash
test "$(git branch --show-current)" = develop
git diff --check
git add docs/superpowers/handoff/phase6-notes-from-5.md docs/superpowers/handoff/RESUME.md
git commit -m "$(cat <<'EOF'
docs(handoff): 记录阶段 5 交给阶段 6 的富文本接口

顶栏和编辑器切换仍未做。笔记写明滚动容器、字数口径和 darwin 基线范围。

EOF
)"
git status
```

---

## 自检记录

- 设计 §6.2：CKEditor、GPL、HTML value、UploadAdapter、`data-ex-embed`、扩展命令、内容区 token，分别在 Task 8 与 Task 6。
- 设计 §5：`PanelDef.position` 增加 `left`（Task 7）；布局 id 与缺失即跳过（Task 7、Task 8）。
- 设计 §10 阶段 5 之外的顶栏、CsdnEditor、csdn-extensions 真实行为不在任务里。
- 审计归属表：工具栏与稿纸 Task 7–9；左侧目录 Task 10；右侧宿主 Task 11；字数与稿纸后插槽 Task 12；顶栏、反馈、AI 内容不实现。
- 六项遗留：裁剪器 Task 1；`data-src` 与上传焦点 Task 2；星号和帮助图标 Task 3；禁用模板与空文档 Task 4。
- 已核对前后任务的名字：`FALLBACK_DOC`、`resolveTemplate`、`titleCounter(length, messages)`、`countRichTextChars`、`extractHeadings`、`createUploadAdapter`、`createEditorConfig`、`mountEditor(element, config, initialHtml)`、`RICH_TEXT_TOOLBAR_LAYOUT`、`richTextCoreExtensions`、插槽 `titleActions` / `afterPaper` / `rightCollapsed`、`onWordCount`。
