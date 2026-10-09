# 阶段 4：`@editorx/publish` 发布设置面板（`<PublishPanel />` / `<PublishModal />`）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `@editorx/publish` 包，100% 复刻 CSDN「发布文章」设置表单。同一份表单有两种呈现：
- Markdown 页面底部的**内联卡片**（参考 `12-36-05`）；
- 点击「发布文章」弹出的**模态框**（参考 `12-36-37`）。

字段覆盖 spec §6.3 全部字段（标签/封面/摘要/分类专栏/文章类型/可见范围/定时发布），以及截图中的全部 CSDN 额外字段（创作声明、文章备份、文章模板、多平台发布、参与活动/话题）。表单受控/非受控两用，校验规则可配置，文案走 Messages，后端只经 `EditorAdapters`。另外搭建 playground `/publish`，把 `/markdown` 的「发布文章」接到模态框，补齐 Vitest、Playwright 功能 e2e、视觉基线和参考截图几何对照。

**Architecture:** 纯逻辑与 UI 分层。
- `settings.ts` / `validate.ts` / `extract.ts` / `schedule.ts` / `adapter-state.ts` 是无 React 依赖的纯函数（默认值、封面增删、校验规则、正文摘要与图片提取、定时时间换算、缺失 adapter 状态），全部单测覆盖。
- `usePublishController` 持有表单状态（受控/非受控）、校验错误、提交中状态，调用 `adapters.onPublish` / `onSaveDraft` 并发 toast。
- `PublishForm` 只渲染字段（`FormItem` + 各字段组件），`PublishActions` 渲染按钮，`ScheduleDialog` 是定时发布弹窗；`PublishPanel`（内联）与 `PublishModal`（模态）只是把三者装进不同外壳。
- 两种呈现的尺寸差异全部在 `styles.css` 中用 `.ex-pub`（内联）/ `.ex-pub--modal`（模态）上的组件私有变量 `--ex-pub-*` 表达；颜色只取 theme 新增的 `--ex-color-pub-*` token。
- 通用控件 `RadioGroup`、`Checkbox`、`Select`、`ImageCropper`（+ `cropImage`）放进 `@editorx/ui`，供 phase 5/6 复用。

**Tech Stack:** React 19、`@editorx/theme` / `@editorx/ui` / `@editorx/toolbar`（类型、Messages、MessagesProvider）、@floating-ui/react 0.27.20、lucide-react 1.53、tsup（`'use client';` banner + copy-css）、Vitest + jsdom + Testing Library + user-event、Next 16 playground、Playwright 1.64（`chromium` project，基线 `*-chromium-win32.png`）。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md` §5.1（`EditorAdapters`）、§6.3（`<PublishPanel />`）、§6.5（i18n）、§6.6（主题）、§7（缺失 adapter 策略）、§8（tokens-only、发布面板视觉回归 0.1%）、§9（发布表单校验单测）。绑定输入：
- `.superpowers/phase4-notes-from-3.md`（可复用 API、约定、坑）；
- `.superpowers/reference-index.md`；
- `apps/playground/public/reference/screenshot_2026-10-09_12-36-05.png`（2554×1310，内联卡片，页面已滚到底）、`12-36-37.png`（2554×1312，模态框）、`12-35-10.png`（2558×1308，Markdown 页底部「保存草稿 / 发布文章」）。

---

## Global Constraints

- 继承 3a/3b 的全部 Global Constraints：
  - `'use client'` 只加在 React 包（`@editorx/publish` 是 React 包，tsup banner `'use client';`）；
  - SSR 安全：渲染期间不读 `window` / `document` / `navigator`，DOM 访问只在 effect 或事件里；
  - StrictMode：组件测试统一包 `<StrictMode>`；
  - 只用 `var(--ex-*)`，类名前缀 `ex-`（状态类 `is-*` 除外）；
  - 浮层挂 `.ex-portal`（`useTheme().portalRoot`）；
  - i18n：所有文案来自 `Messages`（`zhCN` 默认，`locale` 深合并覆盖）；
  - `restoreMocks: true`；
  - PowerShell 用 `;` 串联；
  - 逐文件 `git add`，中文 Conventional Commits（`-m` 标题 + `-m` 正文）。
- **依赖方向**：`@editorx/publish` 依赖 `@editorx/theme`、`@editorx/ui`、`@editorx/toolbar`（peer + dev workspace），**绝不依赖** `@editorx/markdown` / `@editorx/markdown-core`。组合成 `<CsdnEditor />` 是 phase 6 的事。
- **后端解耦**：只通过 `EditorAdapters`（`onPublish`、`onSaveDraft`、`searchTags`、`getCategories`、`uploadImage`，以及本计划新增的 `getActivities`、`getTopics`）与外界交互。
- **缺失 adapter 策略**（spec §7，`missingAdapter: 'hide' | 'disable'`，默认 `'hide'`）：

  | adapter | hide | disable |
  | --- | --- | --- |
  | `onPublish` | 不渲染「定时发布」「发布」按钮 | 按钮禁用 |
  | `onSaveDraft` | 不渲染「保存草稿」 | 按钮禁用 |
  | `uploadImage` | 不渲染「从本地上传」框（仍可从正文图片选封面） | 上传框禁用 |
  | `getCategories` | 不渲染「分类专栏」行 | 显示空提示 |
  | `getActivities` / `getTopics` | 不渲染对应子行；两者都缺时不渲染整行 | 对应 Select 禁用 |
  | `searchTags` | 标签弹层只有输入框（回车添加自定义标签），无推荐 | 同 hide |

- **颜色**：CSDN 实测色只出现在 `packages/theme/src/styles.css` 新增的 `--ex-color-on-primary` 与 `--ex-color-pub-*` token 中（`light-dark()` 主块 + 三个 `@supports not` 兜底块）。`packages/publish/src/styles.css` 与 `packages/ui/src/styles.css` 不写任何颜色字面量。像素尺寸写在包 CSS 中（3b 先例）。
- **视觉基线**：新基线 `publish-{inline,modal}-{light,dark}`、`publish-tags-popover-light`、`publish-schedule-light`、`publish-crop-light`，只在 Windows 上生成，只对 `e2e/publish-visual.spec.ts` 使用 `--update-snapshots`；既有 `showcase-*`、`markdown-core-*`、`markdown-*` 基线必须不变。`maxDiffPixelRatio` 沿用 0.001。
- **e2e 前**：先 `pnpm build`，并释放 3100 端口：
  `Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

### 参考几何（Task 10 的 CSS 与 Task 13 的 parity 用例以此为准）

**内联卡片**（`12-36-05`，视口 2554×1310，页面滚到底；Windows 常驻滚动条 15px → 内容区宽 2539，卡片水平居中，中心 x=1269.5。parity 用例与 3b 一样恢复真实滚动条，因此 x 可用绝对坐标）：

- 页面底色 `#f5f6f7`（`--ex-color-bg`）；顶栏底边 y=104（1px `#e8e8e8`）；编辑纸面底边 y=192。
- 卡片：x=862（CSS 结果 861.5，容差 1）、y=217、宽 816、高 998，白底，圆角 4，padding `32px 40px 56px`。
- 标签列：x=卡片左 L+40，宽 88，字号 14、行高 32、颜色 `#606266`；帮助图标 14px `#999aaa`，与文字间距 4；「文章标签」后红色 `*`（`--ex-color-error`）。
- 控件列：x=L+128，宽 648。
- 各行（行间距 32）：

  | 行 | 顶 y | 高 | 说明 |
  | --- | --- | --- | --- |
  | 文章标签 | 249 | 32 | 「+ 添加文章标签」按钮 y=251，120×28，1px `#e8e8ee`，圆角 4，14px `#555666` |
  | 添加封面 | 313 | 90 | 上传框 160×90，1px `#cccccc` 圆角 8，「+」12px `#cccccc` 中心 y=+27.5，「从本地上传」14px `#999999` 中心 y=+59；间隔 16 处灰块 x=L+304 宽 472 高 90 `#f2f2f2` 圆角 8，12px `#555666` 居中「暂无内容图片，请在正文中添加图片」 |
  | 文章摘要 | 435 | 148 | 文本框 648×108，1px `#dcdfe6` 圆角 4，padding `5px 15px`，占位 `#a8abb2` 14px，计数「0 / 256」12px `#909399` 距右 10 距底 5；下方 8px「AI提取摘要」120×32，`#f2f2f2` 底，圆角 6，14px `#1a1a1a` |
  | 分类专栏 | 615 | 34 | 12px `#999999`「专栏已达到上限，暂不可创建新专栏，请选择已有专栏」 |
  | 文章类型 | 681 | 32 | 单选 16px，x=L+128 / +231 / +313；选中 4px `#006fff` 环 + 白心，未选 1px `#dcdfe6`；文字 14px `#1a1a1a`，间距 7；选项右间距 30；「原创」后 9px 绿盾 `#73bd88` |
  | 创作声明 | 745 | 32 | Select 300×32，1px `#dcdfe6` 圆角 4，padding `0 8px 0 11px`，文字 `#606266`「无声明」，箭头 `#bec0c5` |
  | 文章备份 | 809 | 52 | 复选框 14px（y=818）1px `#dcdfe6` 圆角 2，「同时备份到GitCode」`#606266` 间距 8；下行 20px 协议文字 14px `#1a1a1a`，链接 `#006fff` |
  | 可见范围 | 893 | 32 | 单选 x=L+128 / +238 / +348 / +458 |
  | 文章模板 | 957 | 32 | 「墨衍模板」禁用：1px `#e4e7ed`、底 `#f5f7fa`、文字 `#a8abb2` |
  | 多平台发布 | 1021 | 32 | 单选 x=L+128 / +196 |
  | 参与活动/话题 | 1085 | 74 | 子标签「活动」「话题」`#666666` 宽 28 间距 8；Select x=L+164 宽 612 高 32，两行间距 10（话题 y=1127），占位 `#666666` |

- 底部操作栏：顶边 y=1241（1px `#e8e8e8`），白底，含边框高 69，padding-bottom 4；内容宽 1080，以卡片中心居中；按钮 y=1254 高 40 圆角 6，1px `#e5e5e5`，16px 字重 600 `#1a1a1a`，间距 16，右对齐：「保存草稿 ▾」x=L+588 宽 116（实心三角 10px，间距 8）、「定时发布 ›」x=L+720 宽 116（细箭头 `#797979`）、「发布博客」x=L+852 宽 96（`#fc5531` 底白字）。
- 垂直核算：217 + 32 + 910 + 56 = 1215（卡片底）；+26 = 1241（操作栏顶，sticky bottom 0）；+69 = 1310（视口底）。

**模态框**（`12-36-37`，视口 2554×1312；参考图是 2560 宽画面裁切，模态框中心 x=1280 与 2554 视口不一致，所以 x 用相对模态框左缘 M 断言）：

- 遮罩 `rgba(0,0,0,0.19)`；模态框 740×875，垂直居中（y≈218.5，参考 220，容差 2），圆角 0，白底。
- 标题「发布文章」18px 粗体 `#000`，x=M+28，header padding `20px 28px 0`，行高 27；关闭 × 字形 8px `#8c8c8c`，按钮 24×24 绝对定位 top 16 right 24（中心 M+704, M+28）。
- body padding `26px 28px 40px`；标签列 M+28 宽 92；控件列 M+120 宽 600；必填 `*` 在标签左侧（绝对定位 left −16）。
- 各行（相对 M，行间距 16）：

  | 行 | 顶 | 高 | 说明 |
  | --- | --- | --- | --- |
  | 文章标签 | 73 | 32 | 按钮 120×28（顶 75） |
  | 添加封面 | 121 | 90 | 上传框 160×90 1px `#dcddde` 圆角 8，「+」14px `#a6a7a6`，文字 14px `#999999`；右侧间隔 20 处正文图片缩略图 80×45，间距 8，1px `#e5e5e5` 圆角 4（x=M+300，y=M+144） |
  | 文章摘要 | 227 | 97 | 文本框 600×58，占位 `#c0c4cc`，计数「0/256」`#909399`；下方 8px「AI提取摘要」121×30，另有 1px 下边距 |
  | 分类专栏 | 340 | 32 | 14px `#cccccc`「您暂时不能添加分类专栏!」 |
  | 文章类型 | 388 | 32 | 单选 14px，选中 4px `#409eff` 环，选中文字 `#409eff`，选项右间距 32 |
  | 创作声明 | 436 | 32 | Select 200×32，x=M+110，文字 `#808080`，箭头 `#cdd0d7`，padding `0 7px 0 12px` |
  | 文章备份 | 484 | 52 | 复选框 x=M+110；协议文字 `#555666`，链接 `#4ea1db` |
  | 可见范围 | 552 | 32 | |
  | 文章模板 | 600 | 32 | |
  | 多平台发布 | 648 | 33 | 选项最小宽 75 |
  | 参与活动/话题 | 697 | 74 | 子标签 M+120，Select x=M+156 宽 532，占位 `#c0c4cc`，padding `0 6px 0 15px`；话题行顶 739 |

- footer：顶 M+811，高 64，padding `12px 34px 12px 28px`，上方淡阴影；按钮高 40 圆角 8，14px `#555666`，1px `#e8e8ed`，右对齐间距 16：「取消」M+282 宽 70、「保存为草稿」M+368 宽 112、「定时发布」M+496 宽 98、「发布文章」M+610 宽 96（主色粗体）。
- 垂直核算：47（header）+ 26 + 698 + 40 + 64 = 875。

**Markdown 页底部**（`12-35-10`，phase 3 已实现）：「保存草稿 ▾」x1820..1933、「发布文章」x1950..2047，y1242..1281。本阶段只把「发布文章」的点击接到 `PublishModal`。

---

## File Structure

```text
packages/toolbar/src/
  types.ts                 # 修改：PublishSettings 定稿、PublishOption 等；EditorAdapters 增 getActivities/getTopics，onSaveDraft 增可选 settings
  publish-types.test.ts    # 新增：expectTypeOf 类型断言（typecheck 期生效）
  messages.ts / messages.test.tsx / index.ts   # 修改：zhCN.publish、导出新类型
packages/theme/src/
  styles.css / styles.test.ts                   # 修改：--ex-color-on-primary + 35 个 --ex-color-pub-*
packages/ui/src/
  radio-group.tsx / checkbox.tsx / select.tsx / crop.ts / image-cropper.tsx  (+ 各自 test)   # 新增
  modal.tsx / modal.test.tsx                    # 修改：maskClassName
  styles.css / styles.test.ts / index.ts        # 修改/新增
packages/publish/                               # 新增包
  package.json / tsconfig.json / tsup.config.ts / vitest.config.ts
  src/index.ts / types.ts / cx.ts / use-latest.ts / icons.tsx / test-utils.tsx
  src/settings.ts / validate.ts / extract.ts / schedule.ts / adapter-state.ts   (+ logic.test.ts)
  src/use-async-list.ts / use-publish-controller.ts                            (+ controller.test.tsx)
  src/form/form-item.tsx / tag-field.tsx / summary-field.tsx / category-field.tsx / option-fields.tsx (+ fields.test.tsx)
  src/form/cover-field.tsx / cover-crop-dialog.tsx                             (+ cover-field.test.tsx)
  src/form/publish-form.tsx / actions.tsx / schedule-dialog.tsx / publish-panel.tsx (+ publish-panel.test.tsx)
  src/styles.css / styles.test.ts / ssr.test.tsx / dist.test.ts
apps/playground/
  package.json / app/layout.tsx / app/page.tsx  # 修改：依赖、样式、首页链接
  app/publish/{page.tsx,publish-playground.tsx,publish.css,fixture.ts,mock-adapters.ts}   # 新增
  public/publish/cover-a.svg / cover-b.svg      # 新增：正文图片 fixture
  app/markdown/{page.tsx,markdown-playground.tsx}  # 修改：发布文章 → PublishModal，?publish=1 自动打开
  e2e/publish.spec.ts / publish-visual.spec.ts / publish-parity.spec.ts               # 新增
```

## Tasks 一览

| # | 任务 |
| --- | --- |
| 1 | 共享类型定稿 + `zhCN.publish` 文案（toolbar） |
| 2 | 发布面板颜色 token（theme） |
| 3 | RadioGroup + Checkbox + Modal `maskClassName`（ui） |
| 4 | Select（ui） |
| 5 | ImageCropper + `cropImage`（ui） |
| 6 | `@editorx/publish` 脚手架 + 纯逻辑 |
| 7 | `useAsyncList` + `usePublishController` |
| 8 | 字段组件：FormItem / 标签 / 摘要 / 分类 / 选项字段 |
| 9 | 封面字段 + 裁剪弹窗 |
| 10 | PublishForm / Actions / ScheduleDialog / PublishPanel / PublishModal + 样式 + SSR/dist |
| 11 | playground `/publish` + `/markdown` 接入 |
| 12 | 功能 e2e |
| 13 | 视觉基线 + 参考几何对照 |
| 14 | 全量验证 + `/compare` 核对 + phase 5 交接笔记 |

---

## Tasks

### Task 1: 共享类型定稿 + `zhCN.publish` 文案

**Files:**
- Create: `packages/toolbar/src/publish-types.test.ts`
- Modify: `packages/toolbar/src/types.ts`、`packages/toolbar/src/index.ts`、`packages/toolbar/src/messages.ts`、`packages/toolbar/src/messages.test.tsx`

**Interfaces:**
- Consumes：现有 `EditorDocument`、`Category`、`EditorAdapters`、`zhCN` / `mergeMessages` / `formatMessage`。
- Produces：
  ```ts
  type CoverMode = 'single' | 'triple' | 'none'
  type ArticleType = 'original' | 'reprint' | 'translated'
  type Visibility = 'public' | 'private' | 'fans' | 'vip'
  type CreationDeclaration = 'none' | 'ai' | 'network' | 'personal'
  interface PublishCover { mode: CoverMode; urls: string[] }
  interface PublishOption { id: string; name: string; disabled?: boolean }
  interface PublishSettings {
    tags: string[]; cover: PublishCover; summary: string; categories: string[]
    articleType: ArticleType; sourceUrl?: string; declaration: CreationDeclaration
    backupToGitCode: boolean; visibility: Visibility; template: string; multiPlatform: boolean
    activityId?: string; topicId?: string; scheduledAt?: string
  }
  type PublishPayload = EditorDocument & PublishSettings
  // EditorAdapters.onSaveDraft?(doc, settings?)；新增 getActivities?() / getTopics?(): Promise<PublishOption[]>
  // Messages['publish']：见 Step 3
  ```

- [ ] **Step 1: 写失败测试**

`packages/toolbar/src/publish-types.test.ts`：

```ts
import { describe, expectTypeOf, it } from 'vitest'
import type {
  ArticleType,
  Category,
  CoverMode,
  CreationDeclaration,
  EditorAdapters,
  EditorDocument,
  PublishOption,
  PublishPayload,
  PublishSettings,
  Visibility,
} from './index'

describe('发布相关共享类型（typecheck 期断言）', () => {
  it('PublishSettings 字段与取值', () => {
    expectTypeOf<CoverMode>().toEqualTypeOf<'single' | 'triple' | 'none'>()
    expectTypeOf<ArticleType>().toEqualTypeOf<'original' | 'reprint' | 'translated'>()
    expectTypeOf<Visibility>().toEqualTypeOf<'public' | 'private' | 'fans' | 'vip'>()
    expectTypeOf<CreationDeclaration>().toEqualTypeOf<'none' | 'ai' | 'network' | 'personal'>()
    expectTypeOf<PublishSettings['tags']>().toEqualTypeOf<string[]>()
    expectTypeOf<PublishSettings['cover']>().toEqualTypeOf<{ mode: CoverMode; urls: string[] }>()
    expectTypeOf<PublishSettings['categories']>().toEqualTypeOf<string[]>()
    expectTypeOf<PublishSettings['backupToGitCode']>().toEqualTypeOf<boolean>()
    expectTypeOf<PublishSettings['multiPlatform']>().toEqualTypeOf<boolean>()
    expectTypeOf<PublishSettings['template']>().toEqualTypeOf<string>()
    expectTypeOf<PublishSettings['sourceUrl']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<PublishSettings['activityId']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<PublishSettings['scheduledAt']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Category>().toEqualTypeOf<{ id: string; name: string }>()
    expectTypeOf<PublishOption>().toEqualTypeOf<{ id: string; name: string; disabled?: boolean }>()
  })

  it('PublishPayload = EditorDocument & PublishSettings', () => {
    expectTypeOf<PublishPayload>().toEqualTypeOf<EditorDocument & PublishSettings>()
  })

  it('EditorAdapters：getActivities/getTopics 与带 settings 的 onSaveDraft', () => {
    expectTypeOf<NonNullable<EditorAdapters['getActivities']>>().returns.toEqualTypeOf<Promise<PublishOption[]>>()
    expectTypeOf<NonNullable<EditorAdapters['getTopics']>>().returns.toEqualTypeOf<Promise<PublishOption[]>>()
    expectTypeOf<NonNullable<EditorAdapters['onSaveDraft']>>().parameters.toEqualTypeOf<
      [doc: EditorDocument, settings?: PublishSettings]
    >()
    expectTypeOf<NonNullable<EditorAdapters['onPublish']>>().parameters.toEqualTypeOf<[payload: PublishPayload]>()
  })
})
```

`packages/toolbar/src/messages.test.tsx`：确保从 `./messages` import 了 `formatMessage`、`mergeMessages`、`zhCN`，并在顶层 `describe` 末尾追加：

```tsx
  it('publish 分桶：CSDN 文案、冻结、可深合并覆盖', () => {
    expect(zhCN.publish.modalTitle).toBe('发布文章')
    expect(zhCN.publish.fields.tags).toBe('文章标签')
    expect(zhCN.publish.fields.activity).toBe('参与活动')
    expect(zhCN.publish.actions).toMatchObject({
      saveDraft: '保存草稿',
      saveDraftModal: '保存为草稿',
      schedule: '定时发布',
      publish: '发布文章',
      publishInline: '发布博客',
      cancel: '取消',
    })
    expect(zhCN.publish.cover.noImages).toBe('暂无内容图片，请在正文中添加图片')
    expect(formatMessage(zhCN.publish.summary.counterInline, { count: 0, max: 256 })).toBe('0 / 256')
    expect(formatMessage(zhCN.publish.summary.counterModal, { count: 0, max: 256 })).toBe('0/256')
    expect(Object.isFrozen(zhCN.publish.errors)).toBe(true)
    const merged = mergeMessages(zhCN, { publish: { actions: { publish: 'Publish' } } })
    expect(merged.publish.actions.publish).toBe('Publish')
    expect(merged.publish.actions.cancel).toBe('取消')
  })
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/toolbar typecheck; pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx
```

预期：typecheck 报 `ArticleType` / `PublishOption` 等未导出、`getActivities` 不存在；vitest 报 `zhCN.publish` 为 undefined。

- [ ] **Step 3: 实现**

`packages/toolbar/src/types.ts`：把现有的 `PublishSettings` 接口和 `PublishPayload` 类型整体替换为：

```ts
export type CoverMode = 'single' | 'triple' | 'none'
export type ArticleType = 'original' | 'reprint' | 'translated'
export type Visibility = 'public' | 'private' | 'fans' | 'vip'
/** 创作声明：无声明 / AI 辅助 / 网络整合 / 个人观点 */
export type CreationDeclaration = 'none' | 'ai' | 'network' | 'personal'

export interface PublishCover {
  mode: CoverMode
  /** single 最多 1 张，triple 最多 3 张，none 为空 */
  urls: string[]
}

/** 下拉选项：创作活动、话题、文章模板 */
export interface PublishOption {
  id: string
  name: string
  disabled?: boolean
}

/** CSDN「发布文章」表单：spec §6.3 字段 + 参考截图 12-36-05 / 12-36-37 的额外字段 */
export interface PublishSettings {
  /** 文章标签，1–7 个 */
  tags: string[]
  cover: PublishCover
  /** ≤256 字 */
  summary: string
  /** 分类专栏 Category.id */
  categories: string[]
  articleType: ArticleType
  /** articleType 为 reprint / translated 时必填 */
  sourceUrl?: string
  declaration: CreationDeclaration
  /** 文章备份：同时备份到 GitCode */
  backupToGitCode: boolean
  visibility: Visibility
  /** 文章模板 PublishOption.id，默认 'default' */
  template: string
  multiPlatform: boolean
  /** 参与活动 PublishOption.id */
  activityId?: string
  /** 话题 PublishOption.id */
  topicId?: string
  /** ISO 8601；有值即定时发布 */
  scheduledAt?: string
}

export type PublishPayload = EditorDocument & PublishSettings
```

同文件 `EditorAdapters`：把 `onSaveDraft` 声明替换为

```ts
  /** 保存草稿；从发布面板触发时附带当前发布设置 */
  onSaveDraft?(doc: EditorDocument, settings?: PublishSettings): Promise<void>
```

并在 `getCategories` 声明之后追加：

```ts
  /** 发布面板「参与活动」下拉选项 */
  getActivities?(): Promise<PublishOption[]>
  /** 发布面板「话题」下拉选项 */
  getTopics?(): Promise<PublishOption[]>
```

（`AdapterName = keyof EditorAdapters` 自动包含新增两项。）

`packages/toolbar/src/index.ts`：把第一段 `export type { … } from './types'` 替换为：

```ts
export type {
  AdapterName,
  ArticleType,
  Category,
  CoverMode,
  CreationDeclaration,
  EditorAdapters,
  EditorDocument,
  EditorType,
  PublishCover,
  PublishOption,
  PublishPayload,
  PublishSettings,
  Resource,
  Template,
  Visibility,
  VoteInput,
} from './types'
```

`packages/toolbar/src/messages.ts`：在 `zhCN` 中 `syntax: {` 分桶之前插入：

```ts
  publish: {
    label: '发布设置',
    modalTitle: '发布文章',
    fields: {
      tags: '文章标签',
      cover: '添加封面',
      summary: '文章摘要',
      categories: '分类专栏',
      articleType: '文章类型',
      sourceUrl: '原文链接',
      declaration: '创作声明',
      backup: '文章备份',
      visibility: '可见范围',
      template: '文章模板',
      multiPlatform: '多平台发布',
      activity: '参与活动',
      activitySuffix: '/话题',
      activitySub: '活动',
      topicSub: '话题',
    },
    help: {
      tags: '标签可以帮助文章被更多读者发现，最多添加 7 个',
      cover: '封面会在推荐、列表等场景展示，建议比例 16:9',
      summary: '摘要会在推荐、列表等场景外露，不填则默认提取正文前 256 个字',
      categories: '将文章归入已有的分类专栏',
      articleType: '转载与翻译文章需要填写原文链接',
      visibility: '设置哪些读者可以看到这篇文章',
      template: '选择文章详情页的展示模板',
      activity: '参与创作活动或话题，获得更多曝光',
    },
    tags: {
      add: '添加文章标签',
      search: '搜索标签',
      searchPlaceholder: '请输入文字搜索，Enter 键入可添加自定义标签',
      suggestions: '推荐标签',
      empty: '暂无相关标签',
      count: '还可添加 {count} 个标签',
      remove: '删除标签',
    },
    cover: {
      modes: '封面类型',
      single: '单图',
      triple: '三图',
      none: '无封面',
      upload: '从本地上传',
      uploading: '上传中…',
      replace: '更换',
      remove: '删除封面',
      slot: '封面 {index}',
      bodyImages: '正文图片',
      pick: '选择正文图片 {index} 作为封面',
      noImages: '暂无内容图片，请在正文中添加图片',
      cropTitle: '裁剪封面',
      cropZoom: '缩放',
      cropArea: '裁剪区域，可拖动或用方向键移动',
    },
    summary: {
      placeholderInline:
        '摘要：会在推荐、列表等场景外露，帮助读者快速了解内容，支持一键将正文前 256 字符键入摘要文本框',
      placeholderModal: '本内容会在各展现列表中展示，帮助读者快速了解内容。若不填，则默认提取正文前256个字。',
      counterInline: '{count} / {max}',
      counterModal: '{count}/{max}',
      extract: 'AI提取摘要',
    },
    categories: {
      loading: '加载中…',
      emptyInline: '专栏已达到上限，暂不可创建新专栏，请选择已有专栏',
      emptyModal: '您暂时不能添加分类专栏!',
    },
    articleType: {
      original: '原创',
      reprint: '转载',
      translated: '翻译',
      sourceUrlPlaceholder: '请填写原文链接',
    },
    declaration: {
      none: '无声明',
      ai: '部分内容由AI辅助生成',
      network: '内容来源网络，进行整合/再创作',
      personal: '个人观点，仅供参考',
    },
    backup: {
      label: '同时备份到GitCode',
      agreementPrefix: '勾选即表示同意 GitCode ',
      terms: '用户协议',
      and: ' 和 ',
      privacy: '隐私政策',
      agreementSuffix: '',
    },
    visibility: { public: '全部可见', private: '仅我可见', fans: '粉丝可见', vip: 'VIP可见' },
    template: { default: '默认模板', simple: '简洁模板', moyan: '墨衍模板' },
    multiPlatform: { no: '否', yes: '是' },
    activity: { placeholder: '请选择创作活动', topicPlaceholder: '请选择创作话题' },
    actions: {
      label: '发布操作',
      saveDraft: '保存草稿',
      saveDraftModal: '保存为草稿',
      schedule: '定时发布',
      publish: '发布文章',
      publishInline: '发布博客',
      cancel: '取消',
    },
    schedule: {
      title: '定时发布',
      label: '发布时间',
      hint: '文章将在设定时间自动发布',
      confirm: '确定',
    },
    status: {
      published: '发布成功',
      scheduled: '已设置定时发布：{time}',
      draftSaved: '草稿已保存',
    },
    errors: {
      title: '文章标题需为 {min}～{max} 个字',
      tagsRequired: '请至少添加 1 个文章标签',
      tagsMax: '最多添加 {max} 个文章标签',
      summaryMax: '摘要不能超过 {max} 个字',
      coverTriple: '三图封面需要选择 3 张图片',
      sourceUrlRequired: '转载或翻译文章请填写原文链接',
      sourceUrlInvalid: '原文链接需以 http:// 或 https:// 开头',
      scheduledAtInvalid: '请选择有效的发布时间',
      scheduledAtPast: '发布时间需晚于当前时间',
      publish: '发布失败：{message}',
      saveDraft: '保存草稿失败：{message}',
      load: '{name}加载失败：{message}',
      upload: '封面上传失败：{message}',
    },
  },
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/toolbar typecheck; pnpm --filter @editorx/toolbar test; pnpm --filter @editorx/markdown typecheck; pnpm --filter @editorx/playground typecheck
```

预期：全部无错误。`publish-types.test.ts` 运行期为空断言，检查发生在 typecheck；下游既有 `onSaveDraft(doc)` 调用不受影响（`settings` 可选）。

- [ ] **Step 5: 提交**

```powershell
git add packages/toolbar/src/types.ts
git add packages/toolbar/src/index.ts
git add packages/toolbar/src/messages.ts
git add packages/toolbar/src/messages.test.tsx
git add packages/toolbar/src/publish-types.test.ts
git commit -m "feat(toolbar): 定稿发布设置类型与发布面板文案" -m "PublishSettings 补齐 CSDN 发布表单全部字段（创作声明、GitCode 备份、文章模板、多平台发布、活动/话题），新增 CoverMode/ArticleType/Visibility/CreationDeclaration/PublishCover/PublishOption。" -m "EditorAdapters 新增 getActivities/getTopics，onSaveDraft 增加可选 settings 参数；zhCN 新增 publish 分桶，内联与模态两种呈现的差异文案分开定义。"
```

---

### Task 2: 发布面板颜色 token

**Files:**
- Modify: `packages/theme/src/styles.css`、`packages/theme/src/styles.test.ts`

**Interfaces:**
- Produces：`--ex-color-on-primary` 与 35 个 `--ex-color-pub-*`（下表）。Task 3/4/5/10 的 CSS 只引用这些 token 与既有 token。

- [ ] **Step 1: 写失败测试**

`packages/theme/src/styles.test.ts` 末尾追加：

```ts
const PUB_TOKENS: Array<[name: string, light: string, dark: string]> = [
  ['--ex-color-on-primary', '#ffffff', '#ffffff'],
  ['--ex-color-pub-label', '#606266', '#a3a6ad'],
  ['--ex-color-pub-text', '#1a1a1a', '#e8e8ed'],
  ['--ex-color-pub-border', '#dcdfe6', '#4c4d4f'],
  ['--ex-color-pub-tag-border', '#e8e8ee', '#3a3b41'],
  ['--ex-color-pub-upload-border', '#cccccc', '#4c4d4f'],
  ['--ex-color-pub-upload-border-modal', '#dcddde', '#4c4d4f'],
  ['--ex-color-pub-upload-icon', '#cccccc', '#6c6e72'],
  ['--ex-color-pub-upload-icon-modal', '#a6a7a6', '#8d9095'],
  ['--ex-color-pub-upload-text', '#999999', '#8d9095'],
  ['--ex-color-pub-placeholder', '#a8abb2', '#6c6e72'],
  ['--ex-color-pub-placeholder-modal', '#c0c4cc', '#6c6e72'],
  ['--ex-color-pub-counter', '#909399', '#8d9095'],
  ['--ex-color-pub-hint', '#999999', '#8d9095'],
  ['--ex-color-pub-hint-modal', '#cccccc', '#6c6e72'],
  ['--ex-color-pub-fill', '#f2f2f2', '#2e2f34'],
  ['--ex-color-pub-check', '#006fff', '#3b8eff'],
  ['--ex-color-pub-check-modal', '#409eff', '#409eff'],
  ['--ex-color-pub-link', '#006fff', '#5aa0ff'],
  ['--ex-color-pub-link-modal', '#4ea1db', '#6cb6ea'],
  ['--ex-color-pub-verified', '#73bd88', '#73bd88'],
  ['--ex-color-pub-disabled-bg', '#f5f7fa', '#26272b'],
  ['--ex-color-pub-disabled-border', '#e4e7ed', '#363637'],
  ['--ex-color-pub-select-text-modal', '#808080', '#a3a6ad'],
  ['--ex-color-pub-select-arrow', '#bec0c5', '#6c6e72'],
  ['--ex-color-pub-select-arrow-modal', '#cdd0d7', '#6c6e72'],
  ['--ex-color-pub-sublabel', '#666666', '#a3a6ad'],
  ['--ex-color-pub-bar-border', '#e8e8e8', '#2e2f34'],
  ['--ex-color-pub-button-border', '#e5e5e5', '#3a3b41'],
  ['--ex-color-pub-button-border-modal', '#e8e8ed', '#3a3b41'],
  ['--ex-color-pub-chevron', '#797979', '#8d9095'],
  ['--ex-color-pub-title', '#000000', '#f2f2f5'],
  ['--ex-color-pub-close', '#8c8c8c', '#8d9095'],
  ['--ex-color-pub-thumb-border', '#e5e5e5', '#3a3b41'],
  ['--ex-color-pub-mask', 'rgba(0, 0, 0, 0.19)', 'rgba(0, 0, 0, 0.6)'],
  ['--ex-color-pub-footer-shadow', 'rgba(0, 0, 0, 0.04)', 'rgba(0, 0, 0, 0.4)'],
]

describe('发布面板 token', () => {
  it.each(PUB_TOKENS)('%s 亮色 %s / 暗色 %s（亮色为参考截图实测值）', (name, light, dark) => {
    expect(expected.get(name)).toEqual([light, dark])
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/theme exec vitest run src/styles.test.ts
```

预期：「发布面板 token」36 条全部失败（`expected.get` 为 undefined）。

- [ ] **Step 3: 实现**

`packages/theme/src/styles.css` 共 4 处插入，都放在所在块的 `--ex-color-mde-disabled-text` 那一行之后，缩进与所在块一致。

① 主块（`.ex-root {` 内 `--ex-color-mde-disabled-text: light-dark(#bbbbbb, #5a5b63);` 之后）。每行格式为 `--name: light-dark(<亮>, <暗>);`，按 Step 1 的 `PUB_TOKENS` 顺序逐项写出：

```css
  --ex-color-on-primary: light-dark(#ffffff, #ffffff);
  --ex-color-pub-label: light-dark(#606266, #a3a6ad);
  --ex-color-pub-text: light-dark(#1a1a1a, #e8e8ed);
  --ex-color-pub-border: light-dark(#dcdfe6, #4c4d4f);
  --ex-color-pub-tag-border: light-dark(#e8e8ee, #3a3b41);
  --ex-color-pub-upload-border: light-dark(#cccccc, #4c4d4f);
  --ex-color-pub-upload-border-modal: light-dark(#dcddde, #4c4d4f);
  --ex-color-pub-upload-icon: light-dark(#cccccc, #6c6e72);
  --ex-color-pub-upload-icon-modal: light-dark(#a6a7a6, #8d9095);
  --ex-color-pub-upload-text: light-dark(#999999, #8d9095);
  --ex-color-pub-placeholder: light-dark(#a8abb2, #6c6e72);
  --ex-color-pub-placeholder-modal: light-dark(#c0c4cc, #6c6e72);
  --ex-color-pub-counter: light-dark(#909399, #8d9095);
  --ex-color-pub-hint: light-dark(#999999, #8d9095);
  --ex-color-pub-hint-modal: light-dark(#cccccc, #6c6e72);
  --ex-color-pub-fill: light-dark(#f2f2f2, #2e2f34);
  --ex-color-pub-check: light-dark(#006fff, #3b8eff);
  --ex-color-pub-check-modal: light-dark(#409eff, #409eff);
  --ex-color-pub-link: light-dark(#006fff, #5aa0ff);
  --ex-color-pub-link-modal: light-dark(#4ea1db, #6cb6ea);
  --ex-color-pub-verified: light-dark(#73bd88, #73bd88);
  --ex-color-pub-disabled-bg: light-dark(#f5f7fa, #26272b);
  --ex-color-pub-disabled-border: light-dark(#e4e7ed, #363637);
  --ex-color-pub-select-text-modal: light-dark(#808080, #a3a6ad);
  --ex-color-pub-select-arrow: light-dark(#bec0c5, #6c6e72);
  --ex-color-pub-select-arrow-modal: light-dark(#cdd0d7, #6c6e72);
  --ex-color-pub-sublabel: light-dark(#666666, #a3a6ad);
  --ex-color-pub-bar-border: light-dark(#e8e8e8, #2e2f34);
  --ex-color-pub-button-border: light-dark(#e5e5e5, #3a3b41);
  --ex-color-pub-button-border-modal: light-dark(#e8e8ed, #3a3b41);
  --ex-color-pub-chevron: light-dark(#797979, #8d9095);
  --ex-color-pub-title: light-dark(#000000, #f2f2f5);
  --ex-color-pub-close: light-dark(#8c8c8c, #8d9095);
  --ex-color-pub-thumb-border: light-dark(#e5e5e5, #3a3b41);
  --ex-color-pub-mask: light-dark(rgba(0, 0, 0, 0.19), rgba(0, 0, 0, 0.6));
  --ex-color-pub-footer-shadow: light-dark(rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.4));
```

② 兜底亮色块（`.ex-root,\n  .ex-root[data-ex-theme='light'] {` 内 `--ex-color-mde-disabled-text: #bbbbbb;` 之后）：

```css
    --ex-color-on-primary: #ffffff;
    --ex-color-pub-label: #606266;
    --ex-color-pub-text: #1a1a1a;
    --ex-color-pub-border: #dcdfe6;
    --ex-color-pub-tag-border: #e8e8ee;
    --ex-color-pub-upload-border: #cccccc;
    --ex-color-pub-upload-border-modal: #dcddde;
    --ex-color-pub-upload-icon: #cccccc;
    --ex-color-pub-upload-icon-modal: #a6a7a6;
    --ex-color-pub-upload-text: #999999;
    --ex-color-pub-placeholder: #a8abb2;
    --ex-color-pub-placeholder-modal: #c0c4cc;
    --ex-color-pub-counter: #909399;
    --ex-color-pub-hint: #999999;
    --ex-color-pub-hint-modal: #cccccc;
    --ex-color-pub-fill: #f2f2f2;
    --ex-color-pub-check: #006fff;
    --ex-color-pub-check-modal: #409eff;
    --ex-color-pub-link: #006fff;
    --ex-color-pub-link-modal: #4ea1db;
    --ex-color-pub-verified: #73bd88;
    --ex-color-pub-disabled-bg: #f5f7fa;
    --ex-color-pub-disabled-border: #e4e7ed;
    --ex-color-pub-select-text-modal: #808080;
    --ex-color-pub-select-arrow: #bec0c5;
    --ex-color-pub-select-arrow-modal: #cdd0d7;
    --ex-color-pub-sublabel: #666666;
    --ex-color-pub-bar-border: #e8e8e8;
    --ex-color-pub-button-border: #e5e5e5;
    --ex-color-pub-button-border-modal: #e8e8ed;
    --ex-color-pub-chevron: #797979;
    --ex-color-pub-title: #000000;
    --ex-color-pub-close: #8c8c8c;
    --ex-color-pub-thumb-border: #e5e5e5;
    --ex-color-pub-mask: rgba(0, 0, 0, 0.19);
    --ex-color-pub-footer-shadow: rgba(0, 0, 0, 0.04);
```

③ 兜底暗色块（`.ex-root[data-ex-theme='dark'] {` 内 `--ex-color-mde-disabled-text: #5a5b63;` 之后）：

```css
    --ex-color-on-primary: #ffffff;
    --ex-color-pub-label: #a3a6ad;
    --ex-color-pub-text: #e8e8ed;
    --ex-color-pub-border: #4c4d4f;
    --ex-color-pub-tag-border: #3a3b41;
    --ex-color-pub-upload-border: #4c4d4f;
    --ex-color-pub-upload-border-modal: #4c4d4f;
    --ex-color-pub-upload-icon: #6c6e72;
    --ex-color-pub-upload-icon-modal: #8d9095;
    --ex-color-pub-upload-text: #8d9095;
    --ex-color-pub-placeholder: #6c6e72;
    --ex-color-pub-placeholder-modal: #6c6e72;
    --ex-color-pub-counter: #8d9095;
    --ex-color-pub-hint: #8d9095;
    --ex-color-pub-hint-modal: #6c6e72;
    --ex-color-pub-fill: #2e2f34;
    --ex-color-pub-check: #3b8eff;
    --ex-color-pub-check-modal: #409eff;
    --ex-color-pub-link: #5aa0ff;
    --ex-color-pub-link-modal: #6cb6ea;
    --ex-color-pub-verified: #73bd88;
    --ex-color-pub-disabled-bg: #26272b;
    --ex-color-pub-disabled-border: #363637;
    --ex-color-pub-select-text-modal: #a3a6ad;
    --ex-color-pub-select-arrow: #6c6e72;
    --ex-color-pub-select-arrow-modal: #6c6e72;
    --ex-color-pub-sublabel: #a3a6ad;
    --ex-color-pub-bar-border: #2e2f34;
    --ex-color-pub-button-border: #3a3b41;
    --ex-color-pub-button-border-modal: #3a3b41;
    --ex-color-pub-chevron: #8d9095;
    --ex-color-pub-title: #f2f2f5;
    --ex-color-pub-close: #8d9095;
    --ex-color-pub-thumb-border: #3a3b41;
    --ex-color-pub-mask: rgba(0, 0, 0, 0.6);
    --ex-color-pub-footer-shadow: rgba(0, 0, 0, 0.4);
```

④ system 暗色块（`@media (prefers-color-scheme: dark)` 内 `.ex-root[data-ex-theme='system'] {` 的 `--ex-color-mde-disabled-text: #5a5b63;` 之后）：

```css
      --ex-color-on-primary: #ffffff;
      --ex-color-pub-label: #a3a6ad;
      --ex-color-pub-text: #e8e8ed;
      --ex-color-pub-border: #4c4d4f;
      --ex-color-pub-tag-border: #3a3b41;
      --ex-color-pub-upload-border: #4c4d4f;
      --ex-color-pub-upload-border-modal: #4c4d4f;
      --ex-color-pub-upload-icon: #6c6e72;
      --ex-color-pub-upload-icon-modal: #8d9095;
      --ex-color-pub-upload-text: #8d9095;
      --ex-color-pub-placeholder: #6c6e72;
      --ex-color-pub-placeholder-modal: #6c6e72;
      --ex-color-pub-counter: #8d9095;
      --ex-color-pub-hint: #8d9095;
      --ex-color-pub-hint-modal: #6c6e72;
      --ex-color-pub-fill: #2e2f34;
      --ex-color-pub-check: #3b8eff;
      --ex-color-pub-check-modal: #409eff;
      --ex-color-pub-link: #5aa0ff;
      --ex-color-pub-link-modal: #6cb6ea;
      --ex-color-pub-verified: #73bd88;
      --ex-color-pub-disabled-bg: #26272b;
      --ex-color-pub-disabled-border: #363637;
      --ex-color-pub-select-text-modal: #a3a6ad;
      --ex-color-pub-select-arrow: #6c6e72;
      --ex-color-pub-select-arrow-modal: #6c6e72;
      --ex-color-pub-sublabel: #a3a6ad;
      --ex-color-pub-bar-border: #2e2f34;
      --ex-color-pub-button-border: #3a3b41;
      --ex-color-pub-button-border-modal: #3a3b41;
      --ex-color-pub-chevron: #8d9095;
      --ex-color-pub-title: #f2f2f5;
      --ex-color-pub-close: #8d9095;
      --ex-color-pub-thumb-border: #3a3b41;
      --ex-color-pub-mask: rgba(0, 0, 0, 0.6);
      --ex-color-pub-footer-shadow: rgba(0, 0, 0, 0.4);
```

（②③④ 与 Step 1 表格逐项对应；既有的兜底一致性用例会逐项比对四处，漏写或写错任何一项都会失败。）

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/theme test
```

预期：全部通过，包括既有的「兜底块覆盖全部颜色 token 且值与主块一致」三条。

- [ ] **Step 5: 提交**

```powershell
git add packages/theme/src/styles.css
git add packages/theme/src/styles.test.ts
git commit -m "feat(theme): 新增发布面板颜色 token" -m "新增通用的 --ex-color-on-primary 与 35 个 --ex-color-pub-*，亮色值取自参考截图 12-36-05（内联卡片）与 12-36-37（模态框）实测，两种呈现色值不同的项以 -modal 后缀区分；暗色值为自定。" -m "token 同时写入 light-dark() 主块与三个 @supports 兜底块，由既有一致性用例校验。"
```

---

### Task 3: `@editorx/ui` —— RadioGroup + Checkbox + Modal `maskClassName`

**Files:**
- Create: `packages/ui/src/radio-group.tsx`、`radio-group.test.tsx`、`checkbox.tsx`、`checkbox.test.tsx`、`styles.test.ts`（均在 `packages/ui/src/`）
- Modify: `packages/ui/src/modal.tsx`、`modal.test.tsx`、`styles.css`、`index.ts`

**Interfaces:**
- Produces：
  ```ts
  interface RadioOption<V extends string = string> { value: V; label: ReactNode; disabled?: boolean }
  interface RadioGroupProps<V extends string = string> {
    value: V | undefined; onChange(value: V): void; options: readonly RadioOption<V>[]
    name?: string; disabled?: boolean; label?: string; labelledBy?: string; describedBy?: string; invalid?: boolean; className?: string
  }
  function RadioGroup<V extends string = string>(props: RadioGroupProps<V>): JSX.Element
  interface CheckboxProps { checked: boolean; onChange(checked: boolean): void; disabled?: boolean; children?: ReactNode; label?: string; describedBy?: string; className?: string }
  function Checkbox(props: CheckboxProps): JSX.Element
  // ModalProps.maskClassName?: string
  ```
- DOM 约定：`.ex-radio-group > label.ex-radio(.is-checked/.is-disabled) > input.ex-radio__input + span.ex-radio__dot + span.ex-radio__label`；`label.ex-checkbox(.is-checked/.is-disabled) > input.ex-checkbox__input + span.ex-checkbox__box + span.ex-checkbox__label`。原生 input 视觉隐藏但可聚焦，键盘行为由浏览器提供。

- [ ] **Step 1: 写失败测试**

`packages/ui/src/radio-group.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RadioGroup, type RadioOption } from './radio-group'
import { renderWithTheme } from './test-utils'

type Kind = 'a' | 'b' | 'c'
const options: RadioOption<Kind>[] = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
  { value: 'c', label: '丙', disabled: true },
]

function Controlled({ onChange }: { onChange?: (v: Kind) => void }) {
  const [value, setValue] = useState<Kind>('a')
  return (
    <RadioGroup<Kind>
      label="类型"
      value={value}
      options={options}
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
    />
  )
}

describe('RadioGroup', () => {
  it('渲染 radiogroup 与同名原生单选，选中项带 is-checked', () => {
    renderWithTheme(<Controlled />)
    expect(screen.getByRole('radiogroup', { name: '类型' })).toHaveClass('ex-radio-group')
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(new Set(radios.map((r) => r.getAttribute('name'))).size).toBe(1)
    expect(screen.getByRole('radio', { name: '甲' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '甲' }).closest('label')).toHaveClass('ex-radio', 'is-checked')
  })

  it('点击文字切换并回调；禁用项不可选', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Controlled onChange={onChange} />)
    await userEvent.click(screen.getByText('乙'))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('radio', { name: '乙' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '丙' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: '丙' }).closest('label')).toHaveClass('is-disabled')
    await userEvent.click(screen.getByText('丙'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('整组禁用、invalid 与 labelledBy', () => {
    renderWithTheme(
      <>
        <span id="lbl">可见范围</span>
        <RadioGroup labelledBy="lbl" value="a" options={options} onChange={() => {}} disabled invalid />
      </>,
    )
    expect(screen.getByRole('radiogroup', { name: '可见范围' })).toHaveAttribute('aria-invalid', 'true')
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })
})
```

`packages/ui/src/checkbox.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './checkbox'
import { renderWithTheme } from './test-utils'

describe('Checkbox', () => {
  it('点击文字切换，回调新值', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <Checkbox checked={false} onChange={onChange}>
        同时备份到GitCode
      </Checkbox>,
    )
    const box = screen.getByRole('checkbox', { name: '同时备份到GitCode' })
    expect(box).not.toBeChecked()
    expect(box.closest('label')).toHaveClass('ex-checkbox')
    await userEvent.click(screen.getByText('同时备份到GitCode'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('选中态 is-checked；禁用时不回调；无 children 用 label 作名称', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Checkbox checked onChange={onChange} disabled label="专栏 A" />)
    const box = screen.getByRole('checkbox', { name: '专栏 A' })
    expect(box).toBeChecked()
    expect(box).toBeDisabled()
    expect(box.closest('label')).toHaveClass('is-checked', 'is-disabled')
    await userEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

`packages/ui/src/modal.test.tsx` 顶层 `describe` 末尾追加：

```tsx
  it('maskClassName 追加到遮罩', () => {
    renderWithTheme(
      <Modal open onClose={() => {}} title="发布文章" maskClassName="ex-pub-mask">
        内容
      </Modal>,
    )
    const mask = screen.getByRole('dialog', { name: '发布文章' }).closest('.ex-modal-mask')
    expect(mask).toHaveClass('ex-modal-mask', 'ex-pub-mask')
  })
```

`packages/ui/src/styles.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('ui styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    for (const name of used) expect(themeCss, name).toContain(`${name}:`)
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('单选、复选、下拉、裁剪控件有样式', () => {
    for (const cls of ['ex-radio', 'ex-radio__dot', 'ex-checkbox', 'ex-checkbox__box', 'ex-select', 'ex-select__option', 'ex-cropper__viewport']) {
      expect(css, cls).toMatch(new RegExp(`\\.${cls}(?![\\w-])`))
    }
  })
})
```

（第三条用例中 `ex-select*`、`ex-cropper*` 的样式在本任务 Step 3 一并写入，供 Task 4/5 直接使用。）

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/ui exec vitest run src/radio-group.test.tsx src/checkbox.test.tsx src/modal.test.tsx src/styles.test.ts
```

预期：找不到 `./radio-group`、`./checkbox`；`maskClassName` 用例失败；「不写死颜色值」因 `.ex-btn--primary` 的 `#fff` 失败。

- [ ] **Step 3: 实现**

`packages/ui/src/radio-group.tsx`：

```tsx
import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export interface RadioOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps<V extends string = string> {
  value: V | undefined
  onChange: (value: V) => void
  options: readonly RadioOption<V>[]
  /** 原生 radio 的 name，默认自动生成 */
  name?: string
  disabled?: boolean
  /** 组的无障碍名称（与 labelledBy 二选一） */
  label?: string
  labelledBy?: string
  describedBy?: string
  invalid?: boolean
  className?: string
}

export function RadioGroup<V extends string = string>({
  value,
  onChange,
  options,
  name,
  disabled = false,
  label,
  labelledBy,
  describedBy,
  invalid = false,
  className,
}: RadioGroupProps<V>) {
  const autoName = useId()
  return (
    <div
      role="radiogroup"
      className={cx('ex-radio-group', className)}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-disabled={disabled || undefined}
    >
      {options.map((option) => {
        const checked = option.value === value
        const off = disabled || option.disabled === true
        return (
          <label key={option.value} className={cx('ex-radio', checked && 'is-checked', off && 'is-disabled')}>
            <input
              type="radio"
              className="ex-radio__input"
              name={name ?? autoName}
              value={option.value}
              checked={checked}
              disabled={off}
              onChange={() => onChange(option.value)}
            />
            <span className="ex-radio__dot" aria-hidden="true" />
            <span className="ex-radio__label">{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}
```

`packages/ui/src/checkbox.tsx`：

```tsx
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  children?: ReactNode
  /** 无 children 时的无障碍名称 */
  label?: string
  describedBy?: string
  className?: string
}

export function Checkbox({ checked, onChange, disabled = false, children, label, describedBy, className }: CheckboxProps) {
  return (
    <label className={cx('ex-checkbox', checked && 'is-checked', disabled && 'is-disabled', className)}>
      <input
        type="checkbox"
        className="ex-checkbox__input"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ex-checkbox__box" aria-hidden="true">
        <Check size={10} strokeWidth={3} />
      </span>
      {children != null && <span className="ex-checkbox__label">{children}</span>}
    </label>
  )
}
```

`packages/ui/src/modal.tsx`：
- `ModalProps` 中 `className?: string` 之后加：
  ```ts
    /** 追加到遮罩 .ex-modal-mask 的类名 */
    maskClassName?: string
  ```
- `ModalInner` 解构参数在 `className,` 之后加 `maskClassName,`；
- `<FloatingOverlay className="ex-modal-mask" lockScroll>` 改为 `<FloatingOverlay className={cx('ex-modal-mask', maskClassName)} lockScroll>`。

`packages/ui/src/styles.css`：
- `.ex-btn--primary` 与 `.ex-btn--primary:hover:not(:disabled)` 两行中的 `color: #fff;` 改为 `color: var(--ex-color-on-primary);`；
- 文件末尾追加：

```css
.ex-radio-group { display: flex; flex-wrap: wrap; align-items: center; }
.ex-radio {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-right: 30px;
  color: var(--ex-color-text);
  font-size: var(--ex-font-size-md);
  line-height: 1;
  cursor: pointer;
}
.ex-radio:last-child { margin-right: 0; }
.ex-radio__input,
.ex-checkbox__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
.ex-radio__dot {
  flex: none;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border: 1px solid var(--ex-color-border);
  border-radius: 50%;
  background: var(--ex-color-surface);
}
.ex-radio.is-checked .ex-radio__dot { border: 4px solid var(--ex-color-primary); }
.ex-radio__input:focus-visible + .ex-radio__dot,
.ex-checkbox__input:focus-visible + .ex-checkbox__box { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }
.ex-radio.is-disabled,
.ex-checkbox.is-disabled { cursor: not-allowed; opacity: 0.6; }
.ex-radio__label { display: inline-flex; align-items: center; }

.ex-checkbox {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ex-color-text);
  font-size: var(--ex-font-size-md);
  line-height: 1;
  cursor: pointer;
}
.ex-checkbox__box {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-surface);
  color: transparent;
}
.ex-checkbox.is-checked .ex-checkbox__box {
  border-color: var(--ex-color-primary);
  background: var(--ex-color-primary);
  color: var(--ex-color-on-primary);
}

.ex-select {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ex-space-2);
  box-sizing: border-box;
  height: 32px;
  padding: 0 8px 0 11px;
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  font: inherit;
  font-size: var(--ex-font-size-md);
  text-align: left;
  cursor: pointer;
}
.ex-select:disabled { cursor: not-allowed; opacity: 0.6; }
.ex-select.is-placeholder .ex-select__value { color: var(--ex-color-text-muted); }
.ex-select__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-select__arrow { flex: none; color: var(--ex-color-text-muted); transition: transform var(--ex-transition); }
.ex-select.is-open .ex-select__arrow { transform: rotate(180deg); }
.ex-select__list { box-sizing: border-box; max-height: 274px; margin: 0; padding: 6px 0; overflow: auto; list-style: none; }
.ex-select__option {
  display: block;
  width: 100%;
  padding: 0 20px;
  border: 0;
  background: transparent;
  color: var(--ex-color-text);
  font: inherit;
  font-size: var(--ex-font-size-md);
  line-height: 34px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.ex-select__option:hover:not(:disabled),
.ex-select__option:focus-visible { background: var(--ex-color-surface-hover); outline: none; }
.ex-select__option.is-selected { color: var(--ex-color-primary); font-weight: 600; }
.ex-select__option:disabled { color: var(--ex-color-text-muted); cursor: not-allowed; }

.ex-cropper { display: flex; flex-direction: column; gap: var(--ex-space-3); }
.ex-cropper__viewport {
  position: relative;
  overflow: hidden;
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-bg);
  cursor: grab;
  touch-action: none;
}
.ex-cropper__viewport:active { cursor: grabbing; }
.ex-cropper__viewport:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }
.ex-cropper__image { position: absolute; top: 0; left: 0; max-width: none; user-select: none; pointer-events: none; }
.ex-cropper__image.is-loading { visibility: hidden; }
.ex-cropper__zoom { width: 100%; accent-color: var(--ex-color-primary); }
```

`packages/ui/src/index.ts` 末尾追加：

```ts
export { RadioGroup } from './radio-group'
export type { RadioGroupProps, RadioOption } from './radio-group'
export { Checkbox } from './checkbox'
export type { CheckboxProps } from './checkbox'
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/ui test; pnpm --filter @editorx/ui typecheck
```

预期：ui 全部用例通过（含既有 button/modal 用例）；typecheck 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/ui/src/radio-group.tsx
git add packages/ui/src/radio-group.test.tsx
git add packages/ui/src/checkbox.tsx
git add packages/ui/src/checkbox.test.tsx
git add packages/ui/src/modal.tsx
git add packages/ui/src/modal.test.tsx
git add packages/ui/src/styles.css
git add packages/ui/src/styles.test.ts
git add packages/ui/src/index.ts
git commit -m "feat(ui): 新增单选组与复选框，Modal 支持遮罩类名" -m "RadioGroup/Checkbox 基于原生 input（视觉隐藏、键盘行为由浏览器提供），自绘圆点与方框，支持禁用、invalid 与 labelledBy；Modal 新增 maskClassName，供发布面板使用 CSDN 遮罩色。" -m "预置 Select 与 ImageCropper 样式；主按钮文字改用 --ex-color-on-primary，新增 styles.test 保证 ui 样式只引用 theme token。"
```

---

### Task 4: `@editorx/ui` —— Select

**Files:**
- Create: `packages/ui/src/select.tsx`、`packages/ui/src/select.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes：`withFloatingTree`、`useTheme().portalRoot`、`.ex-popover` 浮层样式；结构仿 `dropdown.tsx`。
- Produces：
  ```ts
  interface SelectOption<V extends string = string> { value: V; label: ReactNode; disabled?: boolean }
  interface SelectProps<V extends string = string> {
    value: V | undefined; onChange(value: V): void; options: readonly SelectOption<V>[]
    placeholder?: ReactNode; disabled?: boolean; label?: string; labelledBy?: string; className?: string; listClassName?: string
  }
  const Select: <V extends string = string>(props: SelectProps<V>) => ReactElement
  ```
- DOM 约定：触发器 `button.ex-select(.is-open/.is-placeholder)[role=combobox]`；列表 `ul.ex-popover.ex-select__list[role=listbox]` 挂 `.ex-portal`，最小宽度 = 触发器宽；选项 `button.ex-select__option[role=option][aria-selected]`，外包 `li[role=none]`（用 button 以便 Enter/Space 原生触发 click）。

- [ ] **Step 1: 写失败测试**

`packages/ui/src/select.test.tsx`：

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './modal'
import { Select, type SelectOption } from './select'
import { renderWithTheme } from './test-utils'

const options: SelectOption[] = [
  { value: 'none', label: '无声明' },
  { value: 'ai', label: 'AI 辅助' },
  { value: 'off', label: '已下线', disabled: true },
  { value: 'net', label: '网络整合' },
]

function Controlled({ onChange, initial }: { onChange?: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial)
  return (
    <Select
      label="创作声明"
      value={value}
      options={options}
      placeholder="请选择"
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
    />
  )
}

describe('Select', () => {
  it('无值显示占位；点击打开 listbox，点选项回调并关闭', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Controlled onChange={onChange} />)
    const trigger = screen.getByRole('combobox', { name: '创作声明' })
    expect(trigger).toHaveClass('ex-select', 'is-placeholder')
    expect(trigger).toHaveTextContent('请选择')
    await userEvent.click(trigger)
    const list = await screen.findByRole('listbox')
    expect(list).toHaveClass('ex-popover', 'ex-select__list')
    expect(list.closest('.ex-portal')).not.toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('option', { name: 'AI 辅助' }))
    expect(onChange).toHaveBeenCalledWith('ai')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveTextContent('AI 辅助')
    expect(trigger).not.toHaveClass('is-placeholder')
  })

  it('已选项 aria-selected，禁用项不可点', async () => {
    renderWithTheme(<Controlled initial="net" />)
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    expect(await screen.findByRole('option', { name: '网络整合' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '无声明' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('option', { name: '已下线' })).toBeDisabled()
  })

  it('键盘：ArrowDown 打开并聚焦首项，跳过禁用项，Enter 选择', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Controlled onChange={onChange} />)
    screen.getByRole('combobox', { name: '创作声明' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('option', { name: '无声明' })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'AI 辅助' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: '网络整合' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('net')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('disabled 时不可打开', async () => {
    renderWithTheme(<Select label="活动" value={undefined} options={options} onChange={() => {}} disabled />)
    const trigger = screen.getByRole('combobox', { name: '活动' })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('Modal 内：Esc 先关列表，再关 Modal', async () => {
    const onClose = vi.fn()
    renderWithTheme(
      <Modal open onClose={onClose} title="发布文章">
        <Controlled />
      </Modal>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/ui exec vitest run src/select.test.tsx
```

预期：找不到 `./select`。

- [ ] **Step 3: 实现**

`packages/ui/src/select.tsx`：

```tsx
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  offset,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useListNavigation,
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { ChevronDown } from 'lucide-react'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'

export interface SelectOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
}

export interface SelectProps<V extends string = string> {
  value: V | undefined
  onChange: (value: V) => void
  options: readonly SelectOption<V>[]
  placeholder?: ReactNode
  disabled?: boolean
  /** 无障碍名称（与 labelledBy 二选一） */
  label?: string
  labelledBy?: string
  className?: string
  /** 弹出列表的类名 */
  listClassName?: string
}

function SelectInner<V extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  label,
  labelledBy,
  className,
  listClassName,
}: SelectProps<V>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const { portalRoot } = useTheme()
  const nodeId = useFloatingNodeId()
  const listRef = useRef<Array<HTMLElement | null>>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: (next) => {
      if (!disabled || !next) setOpen(next)
    },
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip(),
      size({
        apply({ rects, elements }) {
          elements.floating.style.minWidth = `${rects.reference.width}px`
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })
  const disabledIndices = options.flatMap((option, index) => (option.disabled ? [index] : []))
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context, { bubbles: { escapeKey: false } }),
    useRole(context, { role: 'listbox' }),
    useListNavigation(context, {
      listRef,
      activeIndex,
      selectedIndex: selectedIndex === -1 ? null : selectedIndex,
      onNavigate: setActiveIndex,
      loop: true,
      disabledIndices,
    }),
  ])
  const selected = selectedIndex === -1 ? undefined : options[selectedIndex]

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={cx('ex-select', open && 'is-open', !selected && 'is-placeholder', className)}
        disabled={disabled}
        aria-label={label}
        aria-labelledby={labelledBy}
        {...getReferenceProps()}
      >
        <span className="ex-select__value">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="ex-select__arrow" size={14} aria-hidden="true" />
      </button>
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false}>
              <ul
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-select__list', listClassName)}
                aria-label={label}
                {...getFloatingProps()}
              >
                {options.map((option, index) => (
                  <li key={option.value} role="none">
                    <button
                      ref={(node) => {
                        listRef.current[index] = node
                      }}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      className={cx('ex-select__option', index === selectedIndex && 'is-selected')}
                      tabIndex={activeIndex === index ? 0 : -1}
                      disabled={option.disabled}
                      {...getItemProps({
                        onClick: () => {
                          onChange(option.value)
                          setOpen(false)
                        },
                      })}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

export const Select = withFloatingTree(SelectInner, 'Select') as unknown as <V extends string = string>(
  props: SelectProps<V>,
) => ReactElement
```

`packages/ui/src/index.ts` 末尾追加：

```ts
export { Select } from './select'
export type { SelectOption, SelectProps } from './select'
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/ui test; pnpm --filter @editorx/ui typecheck
```

预期：全部通过。若「键盘」用例首项未获焦，检查 `listRef` 下标是否与 `options` 下标一致（禁用项也占位）、`tabIndex` 是否随 `activeIndex` 更新。

- [ ] **Step 5: 提交**

```powershell
git add packages/ui/src/select.tsx
git add packages/ui/src/select.test.tsx
git add packages/ui/src/index.ts
git commit -m "feat(ui): 新增 Select 下拉选择" -m "触发器为 combobox，列表为挂在 .ex-portal 的 listbox 浮层，最小宽度与触发器一致；支持占位、禁用项、整体禁用、方向键循环与 Enter 选择。" -m "沿用 withFloatingTree，在 Modal 内按 Esc 只关闭最内层列表。"
```

---

### Task 5: `@editorx/ui` —— ImageCropper + `cropImage`

**Files:**
- Create: `packages/ui/src/crop.ts`、`crop.test.ts`、`image-cropper.tsx`、`image-cropper.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces：
  ```ts
  interface CropArea { x: number; y: number; width: number; height: number }   // 原图像素
  interface Size { width: number; height: number }
  const MAX_ZOOM = 3
  function initialCrop(image: Size, aspect: number): CropArea      // 居中、最大
  function clampCrop(area: CropArea, image: Size): CropArea
  function moveCrop(area: CropArea, dx: number, dy: number, image: Size): CropArea
  function zoomCrop(area: CropArea, zoom: number, image: Size, aspect: number): CropArea  // 绕当前中心
  function cropImage(src: string, area: CropArea, output: Size, type?: string): Promise<Blob>
  interface ImageCropperProps { src: string; aspect: number; width?: number; onChange(area: CropArea): void; zoomLabel?: string; areaLabel?: string; className?: string }
  function ImageCropper(props: ImageCropperProps): JSX.Element
  ```
- 交互：视口固定 `width × round(width/aspect)`（默认 480×270）；拖动图片（裁剪框反向移动）、方向键移动裁剪框 10 视口像素、滑块缩放 1–3 倍。

- [ ] **Step 1: 写失败测试**

`packages/ui/src/crop.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampCrop, cropImage, initialCrop, MAX_ZOOM, moveCrop, zoomCrop, type CropArea } from './crop'

const ASPECT = 16 / 9

/** 16/9 不是有限二进制小数，比较时允许浮点误差 */
function expectArea(actual: CropArea, expected: CropArea) {
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual[key], key).toBeCloseTo(expected[key], 6)
}

describe('裁剪几何', () => {
  it('initialCrop：横图取满高居中，方图取满宽居中', () => {
    expectArea(initialCrop({ width: 1600, height: 600 }, ASPECT), {
      x: (1600 - 600 * ASPECT) / 2,
      y: 0,
      width: 600 * ASPECT,
      height: 600,
    })
    expectArea(initialCrop({ width: 1000, height: 1000 }, ASPECT), { x: 0, y: 218.75, width: 1000, height: 562.5 })
  })

  it('clampCrop：不越界、尺寸不超过原图', () => {
    const image = { width: 1000, height: 500 }
    expect(clampCrop({ x: -20, y: 600, width: 400, height: 225 }, image)).toEqual({ x: 0, y: 275, width: 400, height: 225 })
    expect(clampCrop({ x: 10, y: 10, width: 2000, height: 900 }, image)).toEqual({ x: 0, y: 0, width: 1000, height: 500 })
  })

  it('moveCrop：平移后夹在原图内', () => {
    const image = { width: 1600, height: 900 }
    const area = { x: 400, y: 225, width: 800, height: 450 }
    expect(moveCrop(area, 100, -50, image)).toEqual({ x: 500, y: 175, width: 800, height: 450 })
    expect(moveCrop(area, 5000, 5000, image)).toEqual({ x: 800, y: 450, width: 800, height: 450 })
  })

  it('zoomCrop：绕当前中心缩放，倍数夹在 [1, MAX_ZOOM]', () => {
    const image = { width: 1600, height: 900 }
    const full = initialCrop(image, ASPECT)
    expectArea(zoomCrop(full, 2, image, ASPECT), { x: 400, y: 225, width: 800, height: 450 })
    const max = zoomCrop(full, 10, image, ASPECT)
    expect(max.width).toBeCloseTo(1600 / MAX_ZOOM)
    expectArea(zoomCrop(max, 0.5, image, ASPECT), full)
  })
})

describe('cropImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('把原图区域绘制到输出尺寸并导出 Blob', async () => {
    const drawImage = vi.fn()
    vi.stubGlobal(
      'Image',
      class {
        crossOrigin = ''
        src = ''
        decode() {
          return Promise.resolve()
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb) {
      cb(new Blob([`${this.width}x${this.height}`], { type: 'image/png' }))
    })
    const blob = await cropImage('blob:a', { x: 10, y: 20, width: 320, height: 180 }, { width: 640, height: 360 })
    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('640x360')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 320, 180, 0, 0, 640, 360)
  })

  it('toBlob 返回 null 时 reject', async () => {
    vi.stubGlobal(
      'Image',
      class {
        decode() {
          return Promise.resolve()
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(cropImage('blob:a', { x: 0, y: 0, width: 1, height: 1 }, { width: 1, height: 1 })).rejects.toThrow()
  })
})
```

`packages/ui/src/image-cropper.test.tsx`：

```tsx
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CropArea } from './crop'
import { ImageCropper } from './image-cropper'
import { renderWithTheme } from './test-utils'

function expectArea(actual: CropArea, expected: CropArea) {
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(actual[key], key).toBeCloseTo(expected[key], 6)
}

function setup() {
  const onChange = vi.fn()
  const { container } = renderWithTheme(<ImageCropper src="blob:cover" aspect={16 / 9} onChange={onChange} />)
  const img = container.querySelector<HTMLImageElement>('.ex-cropper__image')!
  Object.defineProperty(img, 'naturalWidth', { value: 1600 })
  Object.defineProperty(img, 'naturalHeight', { value: 900 })
  fireEvent.load(img)
  return {
    onChange,
    img,
    viewport: screen.getByRole('group', { name: '裁剪区域' }),
    zoom: screen.getByRole('slider', { name: '缩放' }),
  }
}

describe('ImageCropper', () => {
  it('图片加载后给出初始裁剪框，视口 480×270', () => {
    const { onChange, img, viewport } = setup()
    expectArea(onChange.mock.lastCall![0], { x: 0, y: 0, width: 1600, height: 900 })
    expect(viewport).toHaveStyle({ width: '480px', height: '270px' })
    expect(img).not.toHaveClass('is-loading')
    expect(parseFloat(img.style.width)).toBeCloseTo(480)
  })

  it('滑块缩放 2 倍：裁剪框绕中心缩小', () => {
    const { onChange, zoom } = setup()
    fireEvent.change(zoom, { target: { value: '2' } })
    expectArea(onChange.mock.lastCall![0], { x: 400, y: 225, width: 800, height: 450 })
  })

  it('方向键按视口 10px 移动裁剪框', () => {
    const { onChange, zoom, viewport } = setup()
    fireEvent.change(zoom, { target: { value: '2' } })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    const last = onChange.mock.lastCall![0]
    expect(last.x).toBeCloseTo(400 + 10 / (480 / 800))
    expect(last.y).toBeCloseTo(225)
  })

  it('拖动图片：裁剪框反向移动，松开后不再跟随', () => {
    const { onChange, zoom, viewport } = setup()
    fireEvent.change(zoom, { target: { value: '2' } })
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 70, clientY: 100 })
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 70, clientY: 100 })
    expect(onChange.mock.lastCall![0].x).toBeCloseTo(400 + 30 / 0.6)
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 0, clientY: 0 })
    expect(onChange.mock.lastCall![0].x).toBeCloseTo(450)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/ui exec vitest run src/crop.test.ts src/image-cropper.test.tsx
```

预期：找不到 `./crop`、`./image-cropper`。

- [ ] **Step 3: 实现**

`packages/ui/src/crop.ts`：

```ts
/** 裁剪框，单位为原图像素 */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export const MAX_ZOOM = 3

/** 以原图中心为中心、宽高比为 aspect 的最大裁剪框（缩放 1 倍） */
export function initialCrop(image: Size, aspect: number): CropArea {
  const width = Math.min(image.width, image.height * aspect)
  const height = width / aspect
  return { x: (image.width - width) / 2, y: (image.height - height) / 2, width, height }
}

export function clampCrop(area: CropArea, image: Size): CropArea {
  const width = Math.min(area.width, image.width)
  const height = Math.min(area.height, image.height)
  return {
    x: Math.min(Math.max(area.x, 0), image.width - width),
    y: Math.min(Math.max(area.y, 0), image.height - height),
    width,
    height,
  }
}

export function moveCrop(area: CropArea, dx: number, dy: number, image: Size): CropArea {
  return clampCrop({ ...area, x: area.x + dx, y: area.y + dy }, image)
}

/** zoom 为相对 initialCrop 的倍数，绕当前裁剪框中心缩放 */
export function zoomCrop(area: CropArea, zoom: number, image: Size, aspect: number): CropArea {
  const base = initialCrop(image, aspect)
  const z = Math.min(Math.max(zoom, 1), MAX_ZOOM)
  const width = base.width / z
  const height = base.height / z
  const centerX = area.x + area.width / 2
  const centerY = area.y + area.height / 2
  return clampCrop({ x: centerX - width / 2, y: centerY - height / 2, width, height }, image)
}

export async function cropImage(src: string, area: CropArea, output: Size, type = 'image/png'): Promise<Blob> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = src
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = output.width
  canvas.height = output.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, output.width, output.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type)
  })
}
```

`packages/ui/src/image-cropper.tsx`：

```tsx
import { useRef, useState, type KeyboardEvent, type PointerEvent, type SyntheticEvent } from 'react'
import { initialCrop, MAX_ZOOM, moveCrop, zoomCrop, type CropArea, type Size } from './crop'
import { cx } from './cx'

export interface ImageCropperProps {
  src: string
  /** 宽高比，如 16 / 9 */
  aspect: number
  /** 视口宽（px），高 = 宽 / aspect */
  width?: number
  onChange: (area: CropArea) => void
  zoomLabel?: string
  areaLabel?: string
  className?: string
}

const KEY_STEP = 10

export function ImageCropper({
  src,
  aspect,
  width = 480,
  onChange,
  zoomLabel = '缩放',
  areaLabel = '裁剪区域',
  className,
}: ImageCropperProps) {
  const height = Math.round(width / aspect)
  const [natural, setNatural] = useState<Size | null>(null)
  const [area, setArea] = useState<CropArea | null>(null)
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ x: number; y: number; area: CropArea } | null>(null)
  const scale = area ? width / area.width : 1

  const commit = (next: CropArea) => {
    setArea(next)
    onChange(next)
  }
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }
    setNatural(size)
    setZoom(1)
    commit(initialCrop(size, aspect))
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!area) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, area }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || !natural) return
    const s = width / start.area.width
    commit(moveCrop(start.area, (start.x - e.clientX) / s, (start.y - e.clientY) / s, natural))
  }
  const endDrag = () => {
    drag.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!area || !natural) return
    const d = KEY_STEP / scale
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    }
    const step = delta[e.key]
    if (!step) return
    e.preventDefault()
    commit(moveCrop(area, step[0], step[1], natural))
  }
  const onZoom = (value: number) => {
    if (!area || !natural) return
    setZoom(value)
    commit(zoomCrop(area, value, natural, aspect))
  }

  return (
    <div className={cx('ex-cropper', className)}>
      <div
        className="ex-cropper__viewport"
        style={{ width, height }}
        role="group"
        aria-label={areaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <img
          className={cx('ex-cropper__image', !area && 'is-loading')}
          src={src}
          alt=""
          draggable={false}
          style={
            area && natural
              ? {
                  width: natural.width * scale,
                  height: natural.height * scale,
                  transform: `translate(${-area.x * scale}px, ${-area.y * scale}px)`,
                }
              : undefined
          }
          onLoad={onLoad}
        />
      </div>
      <input
        className="ex-cropper__zoom"
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        aria-label={zoomLabel}
        disabled={!area}
        onChange={(e) => onZoom(Number(e.target.value))}
      />
    </div>
  )
}
```

`packages/ui/src/index.ts` 末尾追加：

```ts
export { ImageCropper } from './image-cropper'
export type { ImageCropperProps } from './image-cropper'
export { clampCrop, cropImage, initialCrop, MAX_ZOOM, moveCrop, zoomCrop } from './crop'
export type { CropArea, Size } from './crop'
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/ui test; pnpm --filter @editorx/ui typecheck; pnpm --filter @editorx/ui build
```

预期：全部通过，`dist/index.d.ts` 含 `ImageCropper`、`cropImage`、`Select`、`RadioGroup`、`Checkbox`。

- [ ] **Step 5: 提交**

```powershell
git add packages/ui/src/crop.ts
git add packages/ui/src/crop.test.ts
git add packages/ui/src/image-cropper.tsx
git add packages/ui/src/image-cropper.test.tsx
git add packages/ui/src/index.ts
git commit -m "feat(ui): 新增图片裁剪组件与 cropImage" -m "crop.ts 提供裁剪框几何纯函数（初始居中、夹紧、平移、绕中心缩放 1–3 倍）与 cropImage（canvas 按输出尺寸导出 Blob）。" -m "ImageCropper 以固定宽高比视口显示图片，支持拖动、方向键移动与滑块缩放，每次变化回调原图像素坐标的裁剪框。"
```

---

### Task 6: `@editorx/publish` 脚手架 + 纯逻辑

**Files:**
- Create: `packages/publish/package.json`、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`
- Create: `packages/publish/src/index.ts`、`cx.ts`、`use-latest.ts`、`styles.css`（本任务只放根规则，Task 10 全文替换）
- Create: `packages/publish/src/settings.ts`、`validate.ts`、`extract.ts`、`schedule.ts`、`adapter-state.ts`、`logic.test.ts`
- Modify: `pnpm-lock.yaml`（`pnpm install` 生成）

**Interfaces:**
- Consumes：Task 1 的 `PublishSettings` / `PublishCover` / `CoverMode` / `EditorDocument` / `EditorAdapters` / `AdapterName` / `MissingAdapterPolicy` / `Messages` / `formatMessage`。
- Produces：
  ```ts
  // settings.ts
  const COVER_CAPACITY: Record<CoverMode, number>            // single 1 / triple 3 / none 0
  const DEFAULT_SETTINGS: Readonly<PublishSettings>
  function createSettings(partial?: Partial<PublishSettings>): PublishSettings
  function normalizeCover(cover: PublishCover): PublishCover // 去重、按容量截断
  function setCoverMode(cover: PublishCover, mode: CoverMode): PublishCover
  function pickCover(cover: PublishCover, url: string): PublishCover   // 正文图片点选：已选则取消
  function placeCover(cover: PublishCover, index: number, url: string): PublishCover // 上传结果写入槽位
  function removeCover(cover: PublishCover, index: number): PublishCover
  function toPayload(doc: EditorDocument, settings: PublishSettings): PublishPayload  // original 时去掉 sourceUrl
  // validate.ts
  const MAX_TAGS = 7, SUMMARY_MAX = 256, TITLE_MIN = 5, TITLE_MAX = 100
  type PublishField = 'title' | 'tags' | 'cover' | 'summary' | 'sourceUrl' | 'scheduledAt'
  const FIELD_ORDER: readonly PublishField[]
  interface RuleContext { messages: Messages['publish']; now: number; title?: string }
  type PublishRule = (settings: PublishSettings, ctx: RuleContext) => string | undefined
  type PublishRules = Partial<Record<PublishField, PublishRule | false>>   // 函数替换内置，false 关闭
  type PublishErrors = Partial<Record<PublishField, string>>
  const builtinRules: Record<PublishField, PublishRule>
  function validatePublish(settings, ctx, rules?): PublishErrors
  function firstError(errors): { field: PublishField; message: string } | undefined
  function countChars(s: string): number; function sliceChars(s: string, max: number): string   // 按码点
  // extract.ts
  function htmlToText(html: string): string
  function extractSummary(doc: Pick<EditorDocument, 'html'> | undefined, max?: number): string
  function extractImages(html: string): string[]             // 去重，跳过 ex-uploading://
  // schedule.ts
  function toLocalInputValue(date: Date): string             // YYYY-MM-DDTHH:mm（本地时间）
  function fromLocalInputValue(value: string): string | undefined  // → ISO
  function defaultScheduleTime(now: number): Date            // 一小时后，向上取整到 5 分钟
  function formatScheduleTime(iso: string): string           // YYYY-MM-DD HH:mm
  // adapter-state.ts
  type AdapterState = 'enabled' | 'disabled' | 'hidden'
  function adapterState(adapters: EditorAdapters, name: AdapterName, policy: MissingAdapterPolicy): AdapterState
  ```

- [ ] **Step 1: 脚手架**

`packages/publish/package.json`：

```json
{
  "name": "@editorx/publish",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": [
    "*.css"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "@editorx/theme": "workspace:^",
    "@editorx/toolbar": "workspace:^",
    "@editorx/ui": "workspace:^",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@editorx/theme": "workspace:*",
    "@editorx/toolbar": "workspace:*",
    "@editorx/ui": "workspace:*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "dependencies": {
    "lucide-react": "^1.53.0"
  }
}
```

`packages/publish/tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`：与 `packages/markdown/` 下同名文件**逐字相同**（tsconfig 继承 `../../tooling/tsconfig.base.json` 并 include `src`、两个 config 与 `../../tooling/test/setup-dom.ts`；tsup 为 `entry: ['src/index.ts']`、ESM、dts、`banner: { js: "'use client';" }`、onSuccess 用 `execFileSync` 运行 `tooling/copy-css.mjs`；vitest 为 jsdom + setup-dom + `restoreMocks: true`）。执行时用复制命令创建：

```powershell
New-Item -ItemType Directory -Force packages/publish/src/form | Out-Null; Copy-Item packages/markdown/tsconfig.json packages/publish/tsconfig.json; Copy-Item packages/markdown/tsup.config.ts packages/publish/tsup.config.ts; Copy-Item packages/markdown/vitest.config.ts packages/publish/vitest.config.ts
```

`packages/publish/src/cx.ts`、`packages/publish/src/use-latest.ts`：分别与 `packages/ui/src/cx.ts`、`packages/markdown/src/use-latest.ts` 逐字相同：

```powershell
Copy-Item packages/ui/src/cx.ts packages/publish/src/cx.ts; Copy-Item packages/markdown/src/use-latest.ts packages/publish/src/use-latest.ts
```

`packages/publish/src/styles.css`（Task 10 全文替换）：

```css
.ex-pub { color: var(--ex-color-text); font-family: var(--ex-font-family); }
```

`packages/publish/src/index.ts`：

```ts
export {
  COVER_CAPACITY,
  createSettings,
  DEFAULT_SETTINGS,
  normalizeCover,
  pickCover,
  placeCover,
  removeCover,
  setCoverMode,
  toPayload,
} from './settings'
export {
  builtinRules,
  countChars,
  FIELD_ORDER,
  firstError,
  MAX_TAGS,
  sliceChars,
  SUMMARY_MAX,
  TITLE_MAX,
  TITLE_MIN,
  validatePublish,
} from './validate'
export type { PublishErrors, PublishField, PublishRule, PublishRules, RuleContext } from './validate'
export { extractImages, extractSummary, htmlToText } from './extract'
```

```powershell
pnpm install
```

预期：workspace 链接 `@editorx/publish`，`pnpm-lock.yaml` 新增 `packages/publish` importer。

- [ ] **Step 2: 写失败测试**

`packages/publish/src/logic.test.ts`：

```ts
import { zhCN, type EditorAdapters, type PublishSettings } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import { adapterState } from './adapter-state'
import { extractImages, extractSummary, htmlToText } from './extract'
import { defaultScheduleTime, formatScheduleTime, fromLocalInputValue, toLocalInputValue } from './schedule'
import {
  createSettings,
  DEFAULT_SETTINGS,
  normalizeCover,
  pickCover,
  placeCover,
  removeCover,
  setCoverMode,
  toPayload,
} from './settings'
import { countChars, firstError, sliceChars, validatePublish, type RuleContext } from './validate'

const NOW = new Date(2026, 9, 9, 12, 0).getTime()
const ctx = (extra: Partial<RuleContext> = {}): RuleContext => ({ messages: zhCN.publish, now: NOW, ...extra })
const valid = (patch: Partial<PublishSettings> = {}) => createSettings({ tags: ['React'], ...patch })

describe('settings', () => {
  it('默认值与 CSDN 初始态一致', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      tags: [],
      cover: { mode: 'single', urls: [] },
      summary: '',
      categories: [],
      articleType: 'original',
      declaration: 'none',
      backupToGitCode: false,
      visibility: 'public',
      template: 'default',
      multiPlatform: false,
    })
  })

  it('createSettings 合并并复制数组，不共享引用', () => {
    const tags = ['a']
    const s = createSettings({ tags, visibility: 'fans' })
    expect(s.visibility).toBe('fans')
    expect(s.tags).toEqual(['a'])
    expect(s.tags).not.toBe(tags)
    expect(createSettings().tags).not.toBe(DEFAULT_SETTINGS.tags)
  })

  it('封面：容量、去重、切换模式、点选、上传槽位、删除', () => {
    expect(normalizeCover({ mode: 'single', urls: ['a', 'b'] })).toEqual({ mode: 'single', urls: ['a'] })
    expect(normalizeCover({ mode: 'triple', urls: ['a', 'a', 'b', 'c', 'd'] })).toEqual({ mode: 'triple', urls: ['a', 'b', 'c'] })
    expect(setCoverMode({ mode: 'triple', urls: ['a', 'b'] }, 'none')).toEqual({ mode: 'none', urls: [] })
    expect(pickCover({ mode: 'single', urls: ['a'] }, 'b')).toEqual({ mode: 'single', urls: ['b'] })
    expect(pickCover({ mode: 'single', urls: ['a'] }, 'a')).toEqual({ mode: 'single', urls: [] })
    expect(pickCover({ mode: 'triple', urls: ['a'] }, 'b')).toEqual({ mode: 'triple', urls: ['a', 'b'] })
    expect(pickCover({ mode: 'triple', urls: ['a', 'b', 'c'] }, 'd')).toEqual({ mode: 'triple', urls: ['a', 'b', 'c'] })
    expect(placeCover({ mode: 'triple', urls: ['a', 'b'] }, 1, 'x')).toEqual({ mode: 'triple', urls: ['a', 'x'] })
    expect(placeCover({ mode: 'triple', urls: ['a'] }, 2, 'x')).toEqual({ mode: 'triple', urls: ['a', 'x'] })
    expect(removeCover({ mode: 'triple', urls: ['a', 'b', 'c'] }, 1)).toEqual({ mode: 'triple', urls: ['a', 'c'] })
  })

  it('toPayload：合并文档与设置，原创时丢弃 sourceUrl', () => {
    const doc = { editorType: 'markdown' as const, title: '标题标题标题', markdown: 'm', html: '<p>h</p>' }
    expect(toPayload(doc, valid({ sourceUrl: 'https://a.com' }))).not.toHaveProperty('sourceUrl')
    const payload = toPayload(doc, valid({ articleType: 'reprint', sourceUrl: ' https://a.com ' }))
    expect(payload).toMatchObject({ title: '标题标题标题', html: '<p>h</p>', tags: ['React'], sourceUrl: 'https://a.com' })
  })
})

describe('validatePublish', () => {
  it('合法设置无错误；按码点计数', () => {
    expect(validatePublish(valid(), ctx({ title: '一篇合格的标题' }))).toEqual({})
    expect(countChars('😀ab')).toBe(3)
    expect(sliceChars('😀ab', 2)).toBe('😀a')
  })

  it('标签必填且不超过 7 个', () => {
    expect(validatePublish(createSettings(), ctx()).tags).toBe('请至少添加 1 个文章标签')
    const many = valid({ tags: ['1', '2', '3', '4', '5', '6', '7', '8'] })
    expect(validatePublish(many, ctx()).tags).toBe('最多添加 7 个文章标签')
  })

  it('摘要 ≤256 字；三图封面需 3 张', () => {
    expect(validatePublish(valid({ summary: '字'.repeat(256) }), ctx()).summary).toBeUndefined()
    expect(validatePublish(valid({ summary: '字'.repeat(257) }), ctx()).summary).toBe('摘要不能超过 256 个字')
    expect(validatePublish(valid({ cover: { mode: 'triple', urls: ['a'] } }), ctx()).cover).toBe('三图封面需要选择 3 张图片')
    expect(validatePublish(valid({ cover: { mode: 'single', urls: [] } }), ctx()).cover).toBeUndefined()
  })

  it('转载/翻译需要 http(s) 原文链接', () => {
    expect(validatePublish(valid({ articleType: 'reprint' }), ctx()).sourceUrl).toBe('转载或翻译文章请填写原文链接')
    expect(validatePublish(valid({ articleType: 'translated', sourceUrl: 'ftp://x' }), ctx()).sourceUrl).toBe(
      '原文链接需以 http:// 或 https:// 开头',
    )
    expect(validatePublish(valid({ articleType: 'reprint', sourceUrl: 'https://x.com/a' }), ctx()).sourceUrl).toBeUndefined()
  })

  it('定时时间需有效且晚于当前', () => {
    expect(validatePublish(valid({ scheduledAt: 'abc' }), ctx()).scheduledAt).toBe('请选择有效的发布时间')
    expect(validatePublish(valid({ scheduledAt: new Date(NOW).toISOString() }), ctx()).scheduledAt).toBe('发布时间需晚于当前时间')
    expect(validatePublish(valid({ scheduledAt: new Date(NOW + 60_000).toISOString() }), ctx()).scheduledAt).toBeUndefined()
  })

  it('标题 5–100 字，仅在提供标题时校验', () => {
    expect(validatePublish(valid(), ctx()).title).toBeUndefined()
    expect(validatePublish(valid(), ctx({ title: '短标题' })).title).toBe('文章标题需为 5～100 个字')
    expect(validatePublish(valid(), ctx({ title: '字'.repeat(101) })).title).toBe('文章标题需为 5～100 个字')
  })

  it('rules：函数替换内置规则，false 关闭；firstError 按字段顺序', () => {
    const rules = { tags: false as const, summary: (s: PublishSettings) => (s.summary ? undefined : '摘要必填') }
    const errors = validatePublish(createSettings({ articleType: 'reprint' }), ctx({ title: '短' }), rules)
    expect(errors).toEqual({ title: '文章标题需为 5～100 个字', summary: '摘要必填', sourceUrl: '转载或翻译文章请填写原文链接' })
    expect(firstError(errors)).toEqual({ field: 'title', message: '文章标题需为 5～100 个字' })
    expect(firstError({})).toBeUndefined()
  })
})

describe('extract', () => {
  it('htmlToText：块级元素之间补空格，压缩空白，去掉 script/style', () => {
    expect(htmlToText('<h1>标题</h1><p>第一段&nbsp;<b>加粗</b></p><script>x()</script><p>第二段</p>')).toBe(
      '标题 第一段 加粗 第二段',
    )
    expect(htmlToText('')).toBe('')
  })

  it('extractSummary：取正文前 256 字', () => {
    expect(extractSummary({ html: `<p>${'字'.repeat(300)}</p>` })).toBe('字'.repeat(256))
    expect(extractSummary({ html: '<p>短</p>' })).toBe('短')
    expect(extractSummary(undefined)).toBe('')
  })

  it('extractImages：按出现顺序去重，跳过上传中占位与空地址', () => {
    const html =
      '<p><img src="/a.png" alt=""><img alt="" src=\'/b.png?x=1&amp;y=2\'></p><img src="/a.png"><img src="ex-uploading://1"><img src="">'
    expect(extractImages(html)).toEqual(['/a.png', '/b.png?x=1&y=2'])
  })
})

describe('schedule', () => {
  it('datetime-local 与 ISO 互转（本地时间）', () => {
    const date = new Date(2026, 9, 9, 8, 5)
    expect(toLocalInputValue(date)).toBe('2026-10-09T08:05')
    expect(fromLocalInputValue('2026-10-09T08:05')).toBe(date.toISOString())
    expect(fromLocalInputValue('')).toBeUndefined()
    expect(fromLocalInputValue('2026-10-09')).toBeUndefined()
    expect(formatScheduleTime(date.toISOString())).toBe('2026-10-09 08:05')
  })

  it('默认定时：一小时后向上取整到 5 分钟', () => {
    expect(defaultScheduleTime(new Date(2026, 9, 9, 8, 2, 30).getTime())).toEqual(new Date(2026, 9, 9, 9, 5))
    expect(defaultScheduleTime(new Date(2026, 9, 9, 8, 0).getTime())).toEqual(new Date(2026, 9, 9, 9, 0))
  })
})

describe('adapterState', () => {
  it('有函数为 enabled，缺失按策略 hidden / disabled', () => {
    const adapters: EditorAdapters = { getCategories: async () => [] }
    expect(adapterState(adapters, 'getCategories', 'hide')).toBe('enabled')
    expect(adapterState(adapters, 'onPublish', 'hide')).toBe('hidden')
    expect(adapterState(adapters, 'onPublish', 'disable')).toBe('disabled')
  })
})
```

- [ ] **Step 3: 运行确认失败**

```powershell
pnpm --filter @editorx/publish exec vitest run src/logic.test.ts
```

预期：找不到 `./adapter-state`、`./extract` 等模块。

- [ ] **Step 4: 实现**

`packages/publish/src/settings.ts`：

```ts
import type { CoverMode, EditorDocument, PublishCover, PublishPayload, PublishSettings } from '@editorx/toolbar'

export const COVER_CAPACITY: Record<CoverMode, number> = { single: 1, triple: 3, none: 0 }

export const DEFAULT_SETTINGS: Readonly<PublishSettings> = {
  tags: [],
  cover: { mode: 'single', urls: [] },
  summary: '',
  categories: [],
  articleType: 'original',
  declaration: 'none',
  backupToGitCode: false,
  visibility: 'public',
  template: 'default',
  multiPlatform: false,
}

export function normalizeCover(cover: PublishCover): PublishCover {
  const urls = [...new Set(cover.urls.filter(Boolean))].slice(0, COVER_CAPACITY[cover.mode])
  return { mode: cover.mode, urls }
}

export function createSettings(partial?: Partial<PublishSettings>): PublishSettings {
  const merged: PublishSettings = { ...DEFAULT_SETTINGS, ...partial }
  return {
    ...merged,
    tags: [...merged.tags],
    categories: [...merged.categories],
    cover: normalizeCover(merged.cover),
  }
}

export function setCoverMode(cover: PublishCover, mode: CoverMode): PublishCover {
  return normalizeCover({ mode, urls: cover.urls })
}

export function pickCover(cover: PublishCover, url: string): PublishCover {
  if (cover.urls.includes(url)) return { ...cover, urls: cover.urls.filter((u) => u !== url) }
  if (cover.mode === 'single') return { ...cover, urls: [url] }
  if (cover.urls.length >= COVER_CAPACITY[cover.mode]) return cover
  return { ...cover, urls: [...cover.urls, url] }
}

export function placeCover(cover: PublishCover, index: number, url: string): PublishCover {
  const urls = [...cover.urls]
  if (index < urls.length) urls[index] = url
  else urls.push(url)
  return normalizeCover({ mode: cover.mode, urls })
}

export function removeCover(cover: PublishCover, index: number): PublishCover {
  return { ...cover, urls: cover.urls.filter((_, i) => i !== index) }
}

export function toPayload(doc: EditorDocument, settings: PublishSettings): PublishPayload {
  const { sourceUrl, ...rest } = settings
  const url = settings.articleType === 'original' ? undefined : sourceUrl?.trim()
  return { ...doc, ...rest, ...(url ? { sourceUrl: url } : {}) }
}
```

`packages/publish/src/validate.ts`：

```ts
import { formatMessage, type Messages, type PublishSettings } from '@editorx/toolbar'
import { COVER_CAPACITY } from './settings'

export const MAX_TAGS = 7
export const SUMMARY_MAX = 256
export const TITLE_MIN = 5
export const TITLE_MAX = 100

export type PublishField = 'title' | 'tags' | 'cover' | 'summary' | 'sourceUrl' | 'scheduledAt'
export const FIELD_ORDER: readonly PublishField[] = ['title', 'tags', 'cover', 'summary', 'sourceUrl', 'scheduledAt']

export interface RuleContext {
  messages: Messages['publish']
  /** 当前时间（ms） */
  now: number
  /** 文章标题；未传文档时为 undefined，标题规则跳过 */
  title?: string
}

export type PublishRule = (settings: PublishSettings, ctx: RuleContext) => string | undefined
/** 函数替换内置规则，false 关闭；未列出的字段沿用内置规则 */
export type PublishRules = Partial<Record<PublishField, PublishRule | false>>
export type PublishErrors = Partial<Record<PublishField, string>>

export const countChars = (text: string): number => Array.from(text).length
export const sliceChars = (text: string, max: number): string => Array.from(text).slice(0, max).join('')

export const builtinRules: Record<PublishField, PublishRule> = {
  title: (_settings, { title, messages }) => {
    if (title === undefined) return undefined
    const n = countChars(title.trim())
    return n < TITLE_MIN || n > TITLE_MAX ? formatMessage(messages.errors.title, { min: TITLE_MIN, max: TITLE_MAX }) : undefined
  },
  tags: ({ tags }, { messages }) => {
    if (tags.length === 0) return messages.errors.tagsRequired
    return tags.length > MAX_TAGS ? formatMessage(messages.errors.tagsMax, { max: MAX_TAGS }) : undefined
  },
  cover: ({ cover }, { messages }) =>
    cover.mode === 'triple' && cover.urls.length !== COVER_CAPACITY.triple ? messages.errors.coverTriple : undefined,
  summary: ({ summary }, { messages }) =>
    countChars(summary) > SUMMARY_MAX ? formatMessage(messages.errors.summaryMax, { max: SUMMARY_MAX }) : undefined,
  sourceUrl: ({ articleType, sourceUrl }, { messages }) => {
    if (articleType === 'original') return undefined
    const url = sourceUrl?.trim() ?? ''
    if (!url) return messages.errors.sourceUrlRequired
    return /^https?:\/\/\S+$/i.test(url) ? undefined : messages.errors.sourceUrlInvalid
  },
  scheduledAt: ({ scheduledAt }, { messages, now }) => {
    if (scheduledAt === undefined) return undefined
    const time = Date.parse(scheduledAt)
    if (Number.isNaN(time)) return messages.errors.scheduledAtInvalid
    return time <= now ? messages.errors.scheduledAtPast : undefined
  },
}

export function validatePublish(settings: PublishSettings, ctx: RuleContext, rules?: PublishRules): PublishErrors {
  const errors: PublishErrors = {}
  for (const field of FIELD_ORDER) {
    const override = rules?.[field]
    if (override === false) continue
    const message = (override ?? builtinRules[field])(settings, ctx)
    if (message) errors[field] = message
  }
  return errors
}

export function firstError(errors: PublishErrors): { field: PublishField; message: string } | undefined {
  for (const field of FIELD_ORDER) {
    const message = errors[field]
    if (message) return { field, message }
  }
  return undefined
}
```

`packages/publish/src/extract.ts`：

```ts
import type { EditorDocument } from '@editorx/toolbar'
import { sliceChars, SUMMARY_MAX } from './validate'

const UPLOADING_PREFIX = 'ex-uploading://'
const BLOCK_END = /<\/(?:p|div|h[1-6]|li|blockquote|pre|tr|td|th|figcaption|section|article)>|<br\s*\/?>/gi
const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' }

export function htmlToText(html: string): string {
  if (!html) return ''
  const spaced = html.replace(BLOCK_END, '$& ')
  let text: string
  if (typeof DOMParser === 'undefined') {
    text = spaced
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(?:nbsp|lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity] ?? entity)
  } else {
    const doc = new DOMParser().parseFromString(spaced, 'text/html')
    doc.querySelectorAll('script, style').forEach((node) => node.remove())
    text = doc.body.textContent ?? ''
  }
  return text.replace(/\s+/g, ' ').trim()
}

export function extractSummary(doc: Pick<EditorDocument, 'html'> | undefined, max = SUMMARY_MAX): string {
  return doc ? sliceChars(htmlToText(doc.html), max) : ''
}

export function extractImages(html: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
    const src = (match[2] ?? '').replace(/&amp;/g, '&').trim()
    if (src && !src.startsWith(UPLOADING_PREFIX) && !urls.includes(src)) urls.push(src)
  }
  return urls
}
```

`packages/publish/src/schedule.ts`：

```ts
const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInputValue(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number]
  const date = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const STEP = 5 * 60 * 1000
const HOUR = 60 * 60 * 1000

export function defaultScheduleTime(now: number): Date {
  return new Date(Math.ceil((now + HOUR) / STEP) * STEP)
}

export function formatScheduleTime(iso: string): string {
  return toLocalInputValue(new Date(iso)).replace('T', ' ')
}
```

`packages/publish/src/adapter-state.ts`：

```ts
import type { AdapterName, EditorAdapters, MissingAdapterPolicy } from '@editorx/toolbar'

export type AdapterState = 'enabled' | 'disabled' | 'hidden'

export function adapterState(adapters: EditorAdapters, name: AdapterName, policy: MissingAdapterPolicy): AdapterState {
  if (typeof adapters[name] === 'function') return 'enabled'
  return policy === 'disable' ? 'disabled' : 'hidden'
}
```

- [ ] **Step 5: 运行确认通过**

```powershell
pnpm --filter @editorx/publish test; pnpm --filter @editorx/publish typecheck; pnpm --filter @editorx/publish build
```

预期：`logic.test.ts` 全部通过；typecheck 无错误；`dist/index.js` 首行 `'use client';`，`dist/styles.css` 存在。

- [ ] **Step 6: 提交**

```powershell
git add packages/publish/package.json
git add packages/publish/tsconfig.json
git add packages/publish/tsup.config.ts
git add packages/publish/vitest.config.ts
git add packages/publish/src/index.ts
git add packages/publish/src/cx.ts
git add packages/publish/src/use-latest.ts
git add packages/publish/src/styles.css
git add packages/publish/src/settings.ts
git add packages/publish/src/validate.ts
git add packages/publish/src/extract.ts
git add packages/publish/src/schedule.ts
git add packages/publish/src/adapter-state.ts
git add packages/publish/src/logic.test.ts
git add pnpm-lock.yaml
git commit -m "feat(publish): 新建发布面板包与表单纯逻辑" -m "新增 @editorx/publish（React 包，tsup 'use client' banner，peer 依赖 theme/ui/toolbar，不依赖 markdown）。" -m "纯函数覆盖默认设置与封面增删、可配置校验规则（标签 1–7、摘要 ≤256、三图封面、转载/翻译原文链接、定时时间、标题 5–100）、正文摘要与图片提取、datetime-local 换算和缺失 adapter 状态。"
```

---

### Task 7: `useAsyncList` + `usePublishController`

**Files:**
- Create: `packages/publish/src/use-async-list.ts`、`packages/publish/src/use-publish-controller.ts`、`packages/publish/src/controller.test.tsx`
- Modify: `packages/publish/src/index.ts`

**Interfaces:**
- Consumes：Task 6 全部纯函数；`ToastType`（`@editorx/ui`）；`errorMessage` / `formatMessage`。
- Produces：
  ```ts
  function useAsyncList<T>(load: (() => Promise<T[]>) | undefined, onError: (error: unknown) => void): T[] | null
  // 未启用为 []，加载中为 null；启用状态变化时重新加载
  type PublishBusy = 'publish' | 'draft' | null
  interface PublishControllerOptions {
    value?: PublishSettings; defaultValue?: Partial<PublishSettings>; onChange?(settings: PublishSettings): void
    document?: EditorDocument; adapters: EditorAdapters; rules?: PublishRules; messages: Messages['publish']
    notify(message: string, type?: ToastType): void; onPublished?(payload: PublishPayload): void; now?(): number
  }
  interface PublishController {
    settings: PublishSettings; errors: PublishErrors; busy: PublishBusy; failedAttempts: number
    update<K extends keyof PublishSettings>(key: K, value: PublishSettings[K]): void
    publish(scheduledAt?: string): Promise<boolean>   // 不传 = 立即发布（payload 不含 scheduledAt）
    saveDraft(): Promise<boolean>                     // adapters.onSaveDraft(doc, settings)
  }
  function usePublishController(options: PublishControllerOptions): PublishController
  ```
- 语义：
  - `update` 在受控模式只回调 `onChange`，非受控同时写内部状态；连续两次 `update` 基于上一次结果（同一事件内也不丢字段）；
  - `update('articleType', 'original')` 同时删除 `sourceUrl`；改动字段时清除该字段错误（`articleType` 清 `sourceUrl` 错误）；
  - 校验失败：写 `errors`、`failedAttempts + 1`、toast 第一条错误，不调用 adapter；
  - 发布成功：toast「发布成功」或「已设置定时发布：YYYY-MM-DD HH:mm」，回调 `onPublished(payload)`；失败 toast「发布失败：…」；
  - 进行中（`busy` 非 null）再次调用直接返回 false；缺 `onPublish` / `onSaveDraft` 返回 false。

- [ ] **Step 1: 写失败测试**

`packages/publish/src/controller.test.tsx`：

```tsx
import { zhCN, type EditorAdapters, type EditorDocument, type PublishSettings } from '@editorx/toolbar'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSettings } from './settings'
import { useAsyncList } from './use-async-list'
import { usePublishController, type PublishControllerOptions } from './use-publish-controller'

const NOW = new Date(2026, 9, 9, 12, 0).getTime()
const doc: EditorDocument = { editorType: 'markdown', title: '一篇测试文章', markdown: '正文', html: '<p>正文</p>' }

function setup(options: Partial<PublishControllerOptions> = {}) {
  const notify = vi.fn()
  const onPublish = vi.fn(async () => {})
  const onSaveDraft = vi.fn(async () => {})
  const adapters: EditorAdapters = { onPublish, onSaveDraft }
  const hook = renderHook((props: Partial<PublishControllerOptions>) =>
    usePublishController({ adapters, messages: zhCN.publish, notify, document: doc, now: () => NOW, ...options, ...props }),
  )
  return { ...hook, notify, onPublish, onSaveDraft }
}

describe('usePublishController', () => {
  it('非受控：defaultValue 合并默认值，update 写入并回调 onChange', () => {
    const onChange = vi.fn()
    const { result } = setup({ defaultValue: { visibility: 'fans' }, onChange })
    expect(result.current.settings).toEqual(createSettings({ visibility: 'fans' }))
    act(() => result.current.update('tags', ['Vue']))
    expect(result.current.settings.tags).toEqual(['Vue'])
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['Vue'], visibility: 'fans' }))
  })

  it('同一事件内连续 update 不丢字段；改回原创时删除 sourceUrl', () => {
    const { result } = setup()
    act(() => {
      result.current.update('articleType', 'reprint')
      result.current.update('sourceUrl', 'https://a.com')
    })
    expect(result.current.settings).toMatchObject({ articleType: 'reprint', sourceUrl: 'https://a.com' })
    act(() => result.current.update('articleType', 'original'))
    expect(result.current.settings).not.toHaveProperty('sourceUrl')
  })

  it('受控：settings 跟随 value，update 只回调 onChange', () => {
    const onChange = vi.fn()
    const value = createSettings({ tags: ['A'] })
    const { result, rerender } = setup({ value, onChange })
    act(() => result.current.update('tags', ['A', 'B']))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tags: ['A', 'B'] }))
    expect(result.current.settings.tags).toEqual(['A'])
    rerender({ value: createSettings({ tags: ['C'] }) })
    expect(result.current.settings.tags).toEqual(['C'])
  })

  it('校验失败：写 errors、计数、toast 首个错误，不调用 onPublish；改动字段清除错误', async () => {
    const { result, notify, onPublish } = setup()
    let ok = true
    await act(async () => {
      ok = await result.current.publish()
    })
    expect(ok).toBe(false)
    expect(result.current.errors.tags).toBe('请至少添加 1 个文章标签')
    expect(result.current.failedAttempts).toBe(1)
    expect(notify).toHaveBeenCalledWith('请至少添加 1 个文章标签', 'error')
    expect(onPublish).not.toHaveBeenCalled()
    act(() => result.current.update('tags', ['React']))
    expect(result.current.errors.tags).toBeUndefined()
  })

  it('立即发布：payload = 文档 + 设置（不含 scheduledAt），toast 成功并回调 onPublished', async () => {
    const onPublished = vi.fn()
    const { result, notify, onPublish } = setup({
      defaultValue: { tags: ['React'], scheduledAt: new Date(NOW + 3_600_000).toISOString() },
      onPublished,
    })
    await act(async () => {
      expect(await result.current.publish()).toBe(true)
    })
    const payload = onPublish.mock.lastCall![0]
    expect(payload).toMatchObject({ ...doc, tags: ['React'], visibility: 'public' })
    expect(payload).not.toHaveProperty('scheduledAt')
    expect(notify).toHaveBeenCalledWith('发布成功', 'success')
    expect(onPublished).toHaveBeenCalledWith(payload)
    expect(result.current.busy).toBeNull()
  })

  it('定时发布：payload 带 scheduledAt；过去时间报错', async () => {
    const { result, notify, onPublish } = setup({ defaultValue: { tags: ['React'] } })
    const future = new Date(2026, 9, 9, 13, 5).toISOString()
    await act(async () => {
      await result.current.publish(future)
    })
    expect(onPublish.mock.lastCall![0].scheduledAt).toBe(future)
    expect(notify).toHaveBeenCalledWith('已设置定时发布：2026-10-09 13:05', 'success')
    await act(async () => {
      await result.current.publish(new Date(NOW - 1).toISOString())
    })
    expect(result.current.errors.scheduledAt).toBe('发布时间需晚于当前时间')
    expect(onPublish).toHaveBeenCalledTimes(1)
  })

  it('onPublish 失败：toast 错误并返回 false；进行中重复调用被忽略', async () => {
    let reject!: (e: Error) => void
    const onPublish = vi.fn(() => new Promise<void>((_, r) => (reject = r)))
    const notify = vi.fn()
    const { result } = renderHook(() =>
      usePublishController({
        adapters: { onPublish },
        messages: zhCN.publish,
        notify,
        defaultValue: { tags: ['React'] },
        now: () => NOW,
      }),
    )
    let first!: Promise<boolean>
    act(() => {
      first = result.current.publish()
    })
    expect(result.current.busy).toBe('publish')
    await act(async () => {
      expect(await result.current.publish()).toBe(false)
    })
    await act(async () => {
      reject(new Error('boom'))
      expect(await first).toBe(false)
    })
    expect(onPublish).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('发布失败：boom', 'error')
  })

  it('rules 覆盖：关闭标签规则后可无标签发布；标题过短报错', async () => {
    const { result, onPublish } = setup({ rules: { tags: false } })
    await act(async () => {
      await result.current.publish()
    })
    expect(onPublish).toHaveBeenCalledTimes(1)
    const short = setup({ rules: { tags: false }, document: { ...doc, title: '短' } })
    await act(async () => {
      await short.result.current.publish()
    })
    expect(short.result.current.errors.title).toBe('文章标题需为 5～100 个字')
  })

  it('saveDraft：调用 onSaveDraft(doc, settings) 并提示；失败提示错误', async () => {
    const { result, notify, onSaveDraft } = setup({ defaultValue: { tags: ['X'] } })
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(true)
    })
    expect(onSaveDraft).toHaveBeenCalledWith(doc, expect.objectContaining({ tags: ['X'] }))
    expect(notify).toHaveBeenCalledWith('草稿已保存', 'success')
    onSaveDraft.mockRejectedValueOnce(new Error('网络错误'))
    await act(async () => {
      expect(await result.current.saveDraft()).toBe(false)
    })
    expect(notify).toHaveBeenCalledWith('保存草稿失败：网络错误', 'error')
  })

  it('缺少 adapter 时 publish / saveDraft 返回 false', async () => {
    const { result } = renderHook(() =>
      usePublishController({ adapters: {}, messages: zhCN.publish, notify: vi.fn(), defaultValue: { tags: ['A'] } }),
    )
    await act(async () => {
      expect(await result.current.publish()).toBe(false)
      expect(await result.current.saveDraft()).toBe(false)
    })
  })
})

describe('useAsyncList', () => {
  it('未启用为 []；启用后先 null 再得到结果；失败回调 onError 并置 []', async () => {
    const onError = vi.fn()
    const off = renderHook(() => useAsyncList<string>(undefined, onError))
    expect(off.result.current).toEqual([])
    const ok = renderHook(() => useAsyncList(async () => ['a'], onError))
    expect(ok.result.current).toBeNull()
    await waitFor(() => expect(ok.result.current).toEqual(['a']))
    const bad = renderHook(() => useAsyncList<string>(() => Promise.reject(new Error('x')), onError))
    await waitFor(() => expect(bad.result.current).toEqual([]))
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })
})

const _typeCheck: PublishSettings = createSettings()
void _typeCheck
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/publish exec vitest run src/controller.test.tsx
```

预期：找不到 `./use-async-list`、`./use-publish-controller`。

- [ ] **Step 3: 实现**

`packages/publish/src/use-async-list.ts`：

```ts
import { useEffect, useState } from 'react'
import { useLatest } from './use-latest'

/** 未启用（load 为 undefined）返回 []，加载中返回 null；启用状态变化时重新加载 */
export function useAsyncList<T>(load: (() => Promise<T[]>) | undefined, onError: (error: unknown) => void): T[] | null {
  const enabled = load !== undefined
  const [items, setItems] = useState<T[] | null>(enabled ? null : [])
  const loadRef = useLatest(load)
  const onErrorRef = useLatest(onError)

  useEffect(() => {
    const run = loadRef.current
    if (!run) {
      setItems([])
      return
    }
    let live = true
    setItems(null)
    run().then(
      (list) => {
        if (live) setItems(list)
      },
      (error: unknown) => {
        if (!live) return
        setItems([])
        onErrorRef.current(error)
      },
    )
    return () => {
      live = false
    }
  }, [enabled, loadRef, onErrorRef])

  return items
}
```

`packages/publish/src/use-publish-controller.ts`：

```ts
import {
  errorMessage,
  formatMessage,
  type EditorAdapters,
  type EditorDocument,
  type Messages,
  type PublishPayload,
  type PublishSettings,
} from '@editorx/toolbar'
import type { ToastType } from '@editorx/ui'
import { useCallback, useRef, useState } from 'react'
import { formatScheduleTime } from './schedule'
import { createSettings, toPayload } from './settings'
import { useLatest } from './use-latest'
import { firstError, validatePublish, type PublishErrors, type PublishField, type PublishRules } from './validate'

export type PublishBusy = 'publish' | 'draft' | null

export interface PublishControllerOptions {
  value?: PublishSettings
  defaultValue?: Partial<PublishSettings>
  onChange?: (settings: PublishSettings) => void
  document?: EditorDocument
  adapters: EditorAdapters
  rules?: PublishRules
  messages: Messages['publish']
  notify: (message: string, type?: ToastType) => void
  onPublished?: (payload: PublishPayload) => void
  /** 当前时间（ms），便于测试注入 */
  now?: () => number
}

export interface PublishController {
  settings: PublishSettings
  errors: PublishErrors
  busy: PublishBusy
  /** 每次校验失败 +1，表单据此把焦点移到第一个错误字段 */
  failedAttempts: number
  update<K extends keyof PublishSettings>(key: K, value: PublishSettings[K]): void
  publish(scheduledAt?: string): Promise<boolean>
  saveDraft(): Promise<boolean>
}

const EMPTY_DOC: EditorDocument = { editorType: 'markdown', title: '', html: '' }

const ERROR_FIELD: Partial<Record<keyof PublishSettings, PublishField>> = {
  tags: 'tags',
  cover: 'cover',
  summary: 'summary',
  sourceUrl: 'sourceUrl',
  articleType: 'sourceUrl',
  scheduledAt: 'scheduledAt',
}

export function usePublishController(options: PublishControllerOptions): PublishController {
  const { value, defaultValue } = options
  const [inner, setInner] = useState(() => createSettings(defaultValue))
  const controlled = value !== undefined
  const settings = controlled ? value : inner
  const [errors, setErrors] = useState<PublishErrors>({})
  const [busy, setBusy] = useState<PublishBusy>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const busyRef = useRef(false)
  const latest = useLatest({ ...options, settings, controlled })

  const update = useCallback(
    <K extends keyof PublishSettings>(key: K, next: PublishSettings[K]) => {
      const current = latest.current
      const patched: PublishSettings = { ...current.settings, [key]: next }
      if (key === 'articleType' && next === 'original') delete patched.sourceUrl
      // 同一事件内的下一次 update 基于本次结果
      current.settings = patched
      if (!current.controlled) setInner(patched)
      current.onChange?.(patched)
      const field = ERROR_FIELD[key]
      if (field) {
        setErrors((prev) => {
          if (!prev[field]) return prev
          const rest = { ...prev }
          delete rest[field]
          return rest
        })
      }
    },
    [latest],
  )

  const publish = useCallback(
    async (scheduledAt?: string) => {
      const { settings: current, adapters, document: doc, rules, messages, notify, now = Date.now } = latest.current
      if (busyRef.current || !adapters.onPublish) return false
      const target: PublishSettings = { ...current }
      if (scheduledAt === undefined) delete target.scheduledAt
      else target.scheduledAt = scheduledAt
      const found = validatePublish(target, { messages, now: now(), title: doc?.title }, rules)
      const first = firstError(found)
      if (first) {
        setErrors(found)
        setFailedAttempts((n) => n + 1)
        notify(first.message, 'error')
        return false
      }
      setErrors({})
      busyRef.current = true
      setBusy('publish')
      const payload = toPayload(doc ?? EMPTY_DOC, target)
      try {
        await adapters.onPublish(payload)
        notify(
          scheduledAt
            ? formatMessage(messages.status.scheduled, { time: formatScheduleTime(scheduledAt) })
            : messages.status.published,
          'success',
        )
        latest.current.onPublished?.(payload)
        return true
      } catch (error) {
        notify(formatMessage(messages.errors.publish, { message: errorMessage(error) }), 'error')
        return false
      } finally {
        busyRef.current = false
        setBusy(null)
      }
    },
    [latest],
  )

  const saveDraft = useCallback(async () => {
    const { settings: current, adapters, document: doc, messages, notify } = latest.current
    if (busyRef.current || !adapters.onSaveDraft) return false
    busyRef.current = true
    setBusy('draft')
    try {
      await adapters.onSaveDraft(doc ?? EMPTY_DOC, current)
      notify(messages.status.draftSaved, 'success')
      return true
    } catch (error) {
      notify(formatMessage(messages.errors.saveDraft, { message: errorMessage(error) }), 'error')
      return false
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }, [latest])

  return { settings, errors, busy, failedAttempts, update, publish, saveDraft }
}
```

`packages/publish/src/index.ts` 末尾追加：

```ts
export { usePublishController } from './use-publish-controller'
export type { PublishBusy, PublishController, PublishControllerOptions } from './use-publish-controller'
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/publish test; pnpm --filter @editorx/publish typecheck
```

预期：全部通过。

- [ ] **Step 5: 提交**

```powershell
git add packages/publish/src/use-async-list.ts
git add packages/publish/src/use-publish-controller.ts
git add packages/publish/src/controller.test.tsx
git add packages/publish/src/index.ts
git commit -m "feat(publish): 发布表单状态控制器" -m "usePublishController 支持受控/非受控，改动字段时清除对应错误，改回原创时移除原文链接；发布前按可配置规则校验，失败记录错误并提示首个错误。" -m "发布与保存草稿只经 adapters.onPublish / onSaveDraft(doc, settings)，进行中拒绝重复提交，结果以 toast 提示；useAsyncList 负责分类、活动、话题等列表的异步加载。"
```

---

### Task 8: 字段组件 —— FormItem / 标签 / 摘要 / 分类 / 选项字段

**Files:**
- Create: `packages/publish/src/types.ts`、`icons.tsx`、`test-utils.tsx`
- Create: `packages/publish/src/form/form-item.tsx`、`tag-field.tsx`、`summary-field.tsx`、`category-field.tsx`、`option-fields.tsx`、`fields.test.tsx`
- Modify: `packages/publish/src/index.ts`

**Interfaces:**
- Consumes：`Tag` / `Popover` / `Tooltip` / `Checkbox` / `RadioGroup` / `Select`（ui）、`useMessages` / `formatMessage`（toolbar）、Task 6 的 `MAX_TAGS` / `SUMMARY_MAX` / `countChars` / `AdapterState`。
- Produces：
  ```ts
  type PublishVariant = 'inline' | 'modal'
  interface AgreementLinks { terms?: string; privacy?: string }
  interface PublishBaseProps { value?; defaultValue?; onChange?; document?; adapters?; missingAdapter?; rules?; coverModes?; templates?; agreementLinks?; onPublished?; locale?; theme?; defaultTheme?; onThemeChange?; themeStorageKey?; className? }
  interface PublishPanelProps extends PublishBaseProps { slots?: { barStart?: ReactNode } }
  interface PublishModalProps extends PublishBaseProps { open: boolean; onClose(): void }
  const labelId: (id: string) => string   // `${id}-label`
  const errorId: (id: string) => string   // `${id}-error`
  function FormItem(props: { field; id; label; labelSuffix?; required?; help?; error?; children }): JSX.Element
  function TagField(props: { id; tags; onChange; searchTags?; invalid }): JSX.Element
  function SummaryField(props: { id; value; onChange; source; variant; invalid }): JSX.Element
  function CategoryField(props: { id; value; onChange; categories: Category[] | null; state: AdapterState; variant }): JSX.Element
  function ArticleTypeField(props: { id; value; sourceUrl; onType; onSourceUrl; sourceUrlInvalid }): JSX.Element
  function BackupField(props: { checked; onChange; links? }): JSX.Element
  function ActivityField(props: { id; activityId; topicId; onActivity; onTopic; activities; topics; activityState; topicState }): JSX.Element
  ```
- DOM 约定：每行 `div.ex-pub-item[data-field=<字段>](.is-error)` > `div.ex-pub-item__label`（`span.ex-pub-item__required` / `span.ex-pub-item__text#<id>-label` / `span.ex-pub-item__help` / `span.ex-pub-item__suffix`）+ `div.ex-pub-item__control`（控件 + `div.ex-pub-item__error#<id>-error`）。所有可失败控件带 `aria-invalid` 与 `aria-describedby=<id>-error`。

- [ ] **Step 1: 写失败测试**

`packages/publish/src/test-utils.tsx`：

```tsx
import { ThemeProvider } from '@editorx/theme'
import { ToastProvider } from '@editorx/ui'
import { render, type RenderResult } from '@testing-library/react'
import { StrictMode, type ReactElement, type ReactNode } from 'react'

function Providers({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: Providers })
}
```

`packages/publish/src/form/fields.test.tsx`：

```tsx
import type { ArticleType, Category } from '@editorx/toolbar'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { CategoryField } from './category-field'
import { FormItem } from './form-item'
import { ActivityField, ArticleTypeField, BackupField } from './option-fields'
import { SummaryField } from './summary-field'
import { TagField } from './tag-field'

function Tags({ initial = [], searchTags }: { initial?: string[]; searchTags?: (k: string) => Promise<string[]> }) {
  const [tags, setTags] = useState(initial)
  return (
    <>
      <span id="t-label">文章标签</span>
      <TagField id="t" tags={tags} onChange={setTags} searchTags={searchTags} invalid={false} />
      <output data-testid="tags">{tags.join(',')}</output>
    </>
  )
}

describe('FormItem', () => {
  it('标签、必填星号、帮助图标、错误信息与 data-field', () => {
    const { container } = renderWithProviders(
      <FormItem field="tags" id="f" label="文章标签" required help="帮助" error="请至少添加 1 个文章标签">
        <button aria-describedby="f-error">控件</button>
      </FormItem>,
    )
    const item = container.querySelector('[data-field="tags"]')!
    expect(item).toHaveClass('ex-pub-item', 'is-error')
    expect(item.querySelector('.ex-pub-item__required')).toHaveTextContent('*')
    expect(screen.getByRole('img', { name: '帮助' })).toHaveClass('ex-pub-item__help')
    expect(screen.getByRole('button', { name: '控件' })).toHaveAccessibleDescription('请至少添加 1 个文章标签')
  })
})

describe('TagField', () => {
  it('弹层：推荐标签、关键字防抖搜索、Enter 添加自定义、已选推荐禁用', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [`${k}1`, `${k}2`] : ['React', 'Vue']))
    renderWithProviders(<Tags searchTags={searchTags} />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    expect(screen.getByText('还可添加 7 个标签')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'React' }))
    expect(screen.getByTestId('tags')).toHaveTextContent('React')
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true')
    expect(searchTags).toHaveBeenCalledWith('')
    await userEvent.type(input, 'ts')
    expect(await screen.findByRole('button', { name: 'ts1' })).toBeInTheDocument()
    expect(searchTags).toHaveBeenLastCalledWith('ts')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent('React,ts')
    expect(input).toHaveValue('')
    await userEvent.type(input, 'React{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^React,ts$/)
  })

  it('删除标签；满 7 个隐藏添加按钮；无 searchTags 只有输入框', async () => {
    renderWithProviders(<Tags initial={['1', '2', '3', '4', '5', '6']} />)
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    const input = await screen.findByRole('searchbox', { name: '搜索标签' })
    expect(screen.queryByText('推荐标签')).toBeNull()
    await userEvent.type(input, '7{Enter}')
    expect(screen.queryByRole('button', { name: '添加文章标签' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '删除标签 3' }))
    expect(screen.getByTestId('tags')).toHaveTextContent('1,2,4,5,6,7')
    expect(screen.getByRole('button', { name: '添加文章标签' })).toBeInTheDocument()
  })
})

describe('SummaryField', () => {
  function Summary({ variant, source }: { variant: 'inline' | 'modal'; source: string }) {
    const [value, setValue] = useState('')
    return (
      <>
        <span id="s-label">文章摘要</span>
        <SummaryField id="s" value={value} onChange={setValue} source={source} variant={variant} invalid={false} />
      </>
    )
  }

  it('内联：占位与「0 / 256」计数，输入更新计数，AI提取摘要填入正文前 256 字', async () => {
    renderWithProviders(<Summary variant="inline" source={'字'.repeat(256)} />)
    const box = screen.getByRole('textbox', { name: '文章摘要' })
    expect(box).toHaveAttribute('placeholder', expect.stringContaining('支持一键将正文前 256 字符键入摘要文本框'))
    expect(screen.getByText('0 / 256')).toBeInTheDocument()
    await userEvent.type(box, '你好')
    expect(screen.getByText('2 / 256')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'AI提取摘要' }))
    expect(box).toHaveValue('字'.repeat(256))
    expect(screen.getByText('256 / 256')).toBeInTheDocument()
  })

  it('模态：「0/256」计数；超长标 is-over；无正文时提取按钮禁用', async () => {
    const { container } = renderWithProviders(<Summary variant="modal" source="" />)
    expect(screen.getByText('0/256')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI提取摘要' })).toBeDisabled()
    const box = screen.getByRole('textbox', { name: '文章摘要' })
    await userEvent.click(box)
    await userEvent.paste('字'.repeat(257))
    expect(container.querySelector('.ex-pub-summary__box')).toHaveClass('is-over')
  })
})

describe('CategoryField', () => {
  const list: Category[] = [
    { id: 'c1', name: '前端' },
    { id: 'c2', name: '后端' },
  ]
  function Categories({ categories, variant = 'inline' }: { categories: Category[] | null; variant?: 'inline' | 'modal' }) {
    const [value, setValue] = useState<string[]>([])
    return (
      <>
        <span id="c-label">分类专栏</span>
        <CategoryField id="c" value={value} onChange={setValue} categories={categories} state="enabled" variant={variant} />
        <output data-testid="cats">{value.join(',')}</output>
      </>
    )
  }

  it('加载中、空提示（按呈现区分）、勾选切换', async () => {
    const { unmount } = renderWithProviders(<Categories categories={null} />)
    expect(screen.getByText('加载中…')).toBeInTheDocument()
    unmount()
    const empty = renderWithProviders(<Categories categories={[]} />)
    expect(screen.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeInTheDocument()
    empty.unmount()
    const modal = renderWithProviders(<Categories categories={[]} variant="modal" />)
    expect(screen.getByText('您暂时不能添加分类专栏!')).toBeInTheDocument()
    modal.unmount()
    renderWithProviders(<Categories categories={list} />)
    expect(screen.getByRole('group', { name: '分类专栏' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: '后端' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '前端' }))
    expect(screen.getByTestId('cats')).toHaveTextContent('c2,c1')
    await userEvent.click(screen.getByRole('checkbox', { name: '后端' }))
    expect(screen.getByTestId('cats')).toHaveTextContent(/^c1$/)
  })
})

describe('选项字段', () => {
  it('文章类型：原创带认证图标；转载/翻译显示原文链接输入框', async () => {
    function Type() {
      const [type, setType] = useState<ArticleType>('original')
      const [url, setUrl] = useState<string | undefined>()
      return (
        <>
          <span id="a-label">文章类型</span>
          <ArticleTypeField id="a" value={type} sourceUrl={url} onType={setType} onSourceUrl={setUrl} sourceUrlInvalid={false} />
        </>
      )
    }
    const { container } = renderWithProviders(<Type />)
    expect(screen.getByRole('radiogroup', { name: '文章类型' })).toBeInTheDocument()
    expect(container.querySelector('.ex-pub-verified')).not.toBeNull()
    expect(screen.queryByRole('textbox', { name: '原文链接' })).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: '转载' }))
    const url = screen.getByRole('textbox', { name: '原文链接' })
    await userEvent.type(url, 'https://a.com')
    expect(url).toHaveValue('https://a.com')
  })

  it('文章备份：复选框与协议链接（有 href 渲染为链接）', async () => {
    const onChange = vi.fn()
    renderWithProviders(<BackupField checked={false} onChange={onChange} links={{ terms: 'https://gitcode.com/terms' }} />)
    await userEvent.click(screen.getByRole('checkbox', { name: '同时备份到GitCode' }))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('link', { name: '用户协议' })).toHaveAttribute('href', 'https://gitcode.com/terms')
    expect(screen.queryByRole('link', { name: '隐私政策' })).toBeNull()
    expect(screen.getByText('隐私政策')).toHaveClass('ex-pub-link')
  })

  it('参与活动/话题：按 adapter 状态隐藏或禁用子行', async () => {
    const onActivity = vi.fn()
    const { unmount } = renderWithProviders(
      <ActivityField
        id="act"
        activityId={undefined}
        topicId={undefined}
        onActivity={onActivity}
        onTopic={() => {}}
        activities={[{ id: 'a1', name: '征文活动' }]}
        topics={[]}
        activityState="enabled"
        topicState="disabled"
      />,
    )
    const activity = screen.getByRole('combobox', { name: '活动' })
    expect(activity).toHaveTextContent('请选择创作活动')
    expect(screen.getByRole('combobox', { name: '话题' })).toBeDisabled()
    await userEvent.click(activity)
    await userEvent.click(await screen.findByRole('option', { name: '征文活动' }))
    expect(onActivity).toHaveBeenCalledWith('a1')
    unmount()
    renderWithProviders(
      <ActivityField
        id="act"
        activityId={undefined}
        topicId={undefined}
        onActivity={() => {}}
        onTopic={() => {}}
        activities={[]}
        topics={[]}
        activityState="hidden"
        topicState="enabled"
      />,
    )
    expect(screen.queryByRole('combobox', { name: '活动' })).toBeNull()
    expect(screen.getByRole('combobox', { name: '话题' })).toHaveTextContent('请选择创作话题')
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/publish exec vitest run src/form/fields.test.tsx
```

预期：找不到 `./form-item` 等模块。

- [ ] **Step 3: 实现**

`packages/publish/src/types.ts`：

```ts
import type { ThemeMode } from '@editorx/theme'
import type {
  CoverMode,
  DeepPartial,
  EditorAdapters,
  EditorDocument,
  Messages,
  MissingAdapterPolicy,
  PublishOption,
  PublishPayload,
  PublishSettings,
} from '@editorx/toolbar'
import type { ReactNode } from 'react'
import type { PublishRules } from './validate'

export type PublishVariant = 'inline' | 'modal'

export interface AgreementLinks {
  terms?: string
  privacy?: string
}

export interface PublishBaseProps {
  value?: PublishSettings
  defaultValue?: Partial<PublishSettings>
  onChange?(settings: PublishSettings): void
  /** 当前文章：用于标题校验、摘要提取、正文图片封面与 payload */
  document?: EditorDocument
  adapters?: EditorAdapters
  /** 缺失 adapter 时隐藏还是禁用对应功能，默认 'hide' */
  missingAdapter?: MissingAdapterPolicy
  /** 覆盖内置校验规则：函数替换，false 关闭 */
  rules?: PublishRules
  /** 可选封面模式；默认 ['single']（CSDN 截图无模式切换），多于一项时显示单选 */
  coverModes?: readonly CoverMode[]
  /** 文章模板选项；默认 默认模板 / 简洁模板 / 墨衍模板（禁用） */
  templates?: readonly PublishOption[]
  /** GitCode 协议链接；未提供时渲染为纯文本 */
  agreementLinks?: AgreementLinks
  onPublished?(payload: PublishPayload): void
  locale?: DeepPartial<Messages>
  /**
   * 首次渲染时传入 theme 或 defaultTheme（或没有外层 ThemeProvider）则自建 ThemeProvider，否则复用外层。
   */
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  className?: string
}

export interface PublishPanelSlots {
  /** 内联操作栏左侧内容（CSDN：字数、回到顶部等） */
  barStart?: ReactNode
}

export interface PublishPanelProps extends PublishBaseProps {
  slots?: PublishPanelSlots
}

export interface PublishModalProps extends PublishBaseProps {
  open: boolean
  onClose(): void
}
```

`packages/publish/src/icons.tsx`：

```tsx
/** 「原创」后的绿色认证盾牌（参考图 9px 宽） */
export function VerifiedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
      <path d="M6 0 12 2.2V7c0 3.3-2.5 5.9-6 7C2.5 12.9 0 10.3 0 7V2.2z" fill="currentColor" />
      <path d="m3.2 7 2 2 3.6-3.8" fill="none" stroke="var(--ex-color-surface)" strokeWidth="1.4" />
    </svg>
  )
}

/** 「保存草稿」后的实心下三角 */
export function CaretDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M0 0h10L5 6z" fill="currentColor" />
    </svg>
  )
}

/** 上传框中的细「+」 */
export function PlusIcon({ size }: { size: number }) {
  return (
    <svg className="ex-pub-plus" width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
```

`packages/publish/src/form/form-item.tsx`：

```tsx
import { Tooltip } from '@editorx/ui'
import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../cx'

export const labelId = (id: string) => `${id}-label`
export const errorId = (id: string) => `${id}-error`

export interface FormItemProps {
  /** 根元素 data-field，供样式与测试定位 */
  field: string
  /** useId() 前缀：标签 id 为 `${id}-label`，错误 id 为 `${id}-error` */
  id: string
  label: ReactNode
  /** 帮助图标之后的标签文字（CSDN「参与活动 ⓘ /话题」） */
  labelSuffix?: ReactNode
  required?: boolean
  help?: string
  error?: string
  children: ReactNode
}

export function FormItem({ field, id, label, labelSuffix, required, help, error, children }: FormItemProps) {
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
            <span className="ex-pub-item__help" role="img" aria-label={help} tabIndex={0}>
              <CircleHelp size={14} aria-hidden="true" />
            </span>
          </Tooltip>
        )}
        {labelSuffix && <span className="ex-pub-item__suffix">{labelSuffix}</span>}
      </div>
      <div className="ex-pub-item__control">
        {children}
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

`packages/publish/src/form/tag-field.tsx`：

```tsx
import { formatMessage, useMessages } from '@editorx/toolbar'
import { Popover, Tag } from '@editorx/ui'
import { Plus } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { cx } from '../cx'
import { MAX_TAGS } from '../validate'
import { errorId } from './form-item'

export interface TagFieldProps {
  id: string
  tags: readonly string[]
  onChange(tags: string[]): void
  searchTags?: (keyword: string) => Promise<string[]>
  invalid: boolean
}

export function TagField({ id, tags, onChange, searchTags, invalid }: TagFieldProps) {
  const p = useMessages().publish
  const [open, setOpen] = useState(false)
  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    const next = [...tags, tag]
    onChange(next)
    if (next.length >= MAX_TAGS) setOpen(false)
  }
  return (
    <div className="ex-pub-line ex-pub-tags">
      {tags.map((tag) => (
        <Tag key={tag} className="ex-pub-tag" closable closeLabel={p.tags.remove} onClose={() => onChange(tags.filter((t) => t !== tag))}>
          {tag}
        </Tag>
      ))}
      {tags.length < MAX_TAGS && (
        <Popover
          open={open}
          onOpenChange={setOpen}
          className="ex-pub-tag-popover"
          content={() => <TagSearch selected={tags} onAdd={add} searchTags={searchTags} />}
        >
          <button
            type="button"
            className="ex-pub-tag-add"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId(id) : undefined}
          >
            <Plus size={12} aria-hidden="true" />
            {p.tags.add}
          </button>
        </Popover>
      )}
    </div>
  )
}

interface TagSearchProps {
  selected: readonly string[]
  onAdd(tag: string): void
  searchTags?: (keyword: string) => Promise<string[]>
}

function TagSearch({ selected, onAdd, searchTags }: TagSearchProps) {
  const p = useMessages().publish
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<string[] | null>(null)

  useEffect(() => {
    if (!searchTags) return
    let live = true
    const query = keyword.trim()
    const timer = window.setTimeout(
      () => {
        searchTags(query).then(
          (list) => {
            if (live) setResults(list)
          },
          () => {
            if (live) setResults([])
          },
        )
      },
      query ? 300 : 0,
    )
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [keyword, searchTags])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    onAdd(keyword)
    setKeyword('')
  }

  return (
    <div className="ex-pub-tag-search">
      <input
        className="ex-pub-input ex-pub-tag-search__input"
        type="search"
        value={keyword}
        placeholder={p.tags.searchPlaceholder}
        aria-label={p.tags.search}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="ex-pub-tag-search__meta">{formatMessage(p.tags.count, { count: MAX_TAGS - selected.length })}</div>
      {searchTags && (
        <div className="ex-pub-tag-search__section">
          <div className="ex-pub-tag-search__title">{p.tags.suggestions}</div>
          {results !== null &&
            (results.length === 0 ? (
              <div className="ex-pub-tag-search__empty">{p.tags.empty}</div>
            ) : (
              <ul className="ex-pub-tag-search__list" aria-label={p.tags.suggestions}>
                {results.map((tag) => {
                  const on = selected.includes(tag)
                  return (
                    <li key={tag}>
                      <button
                        type="button"
                        className={cx('ex-pub-tag-option', on && 'is-selected')}
                        aria-pressed={on}
                        disabled={on}
                        onClick={() => onAdd(tag)}
                      >
                        {tag}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ))}
        </div>
      )}
    </div>
  )
}
```

`packages/publish/src/form/summary-field.tsx`：

```tsx
import { formatMessage, useMessages } from '@editorx/toolbar'
import { cx } from '../cx'
import type { PublishVariant } from '../types'
import { countChars, SUMMARY_MAX } from '../validate'
import { errorId, labelId } from './form-item'

export interface SummaryFieldProps {
  id: string
  value: string
  onChange(value: string): void
  /** 「AI提取摘要」填入的内容：正文前 256 字 */
  source: string
  variant: PublishVariant
  invalid: boolean
}

export function SummaryField({ id, value, onChange, source, variant, invalid }: SummaryFieldProps) {
  const p = useMessages().publish
  const count = countChars(value)
  const modal = variant === 'modal'
  return (
    <div className="ex-pub-summary">
      <div className={cx('ex-pub-summary__box', count > SUMMARY_MAX && 'is-over')}>
        <textarea
          className="ex-pub-textarea"
          value={value}
          placeholder={modal ? p.summary.placeholderModal : p.summary.placeholderInline}
          aria-labelledby={labelId(id)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId(id) : `${id}-count`}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="ex-pub-summary__count" id={`${id}-count`}>
          {formatMessage(modal ? p.summary.counterModal : p.summary.counterInline, { count, max: SUMMARY_MAX })}
        </span>
      </div>
      <button type="button" className="ex-pub-summary__extract" disabled={!source} onClick={() => onChange(source)}>
        {p.summary.extract}
      </button>
    </div>
  )
}
```

`packages/publish/src/form/category-field.tsx`：

```tsx
import { useMessages, type Category } from '@editorx/toolbar'
import { Checkbox } from '@editorx/ui'
import type { AdapterState } from '../adapter-state'
import type { PublishVariant } from '../types'
import { labelId } from './form-item'

export interface CategoryFieldProps {
  id: string
  value: readonly string[]
  onChange(ids: string[]): void
  /** null 为加载中 */
  categories: Category[] | null
  state: AdapterState
  variant: PublishVariant
}

export function CategoryField({ id, value, onChange, categories, state, variant }: CategoryFieldProps) {
  const p = useMessages().publish
  if (categories === null) return <span className="ex-pub-hint">{p.categories.loading}</span>
  if (state !== 'enabled' || categories.length === 0) {
    return <span className="ex-pub-hint">{variant === 'modal' ? p.categories.emptyModal : p.categories.emptyInline}</span>
  }
  return (
    <div className="ex-pub-line ex-pub-categories" role="group" aria-labelledby={labelId(id)}>
      {categories.map((category) => (
        <Checkbox
          key={category.id}
          checked={value.includes(category.id)}
          onChange={(on) => onChange(on ? [...value, category.id] : value.filter((v) => v !== category.id))}
        >
          {category.name}
        </Checkbox>
      ))}
    </div>
  )
}
```

`packages/publish/src/form/option-fields.tsx`：

```tsx
import { useMessages, type ArticleType, type PublishOption } from '@editorx/toolbar'
import { Checkbox, RadioGroup, Select } from '@editorx/ui'
import type { AdapterState } from '../adapter-state'
import { VerifiedIcon } from '../icons'
import type { AgreementLinks } from '../types'
import { errorId, labelId } from './form-item'

export interface ArticleTypeFieldProps {
  id: string
  value: ArticleType
  sourceUrl: string | undefined
  onType(type: ArticleType): void
  onSourceUrl(url: string): void
  sourceUrlInvalid: boolean
}

export function ArticleTypeField({ id, value, sourceUrl, onType, onSourceUrl, sourceUrlInvalid }: ArticleTypeFieldProps) {
  const p = useMessages().publish
  return (
    <>
      <RadioGroup<ArticleType>
        className="ex-pub-line"
        labelledBy={labelId(id)}
        value={value}
        onChange={onType}
        options={[
          {
            value: 'original',
            label: (
              <>
                {p.articleType.original}
                <VerifiedIcon className="ex-pub-verified" />
              </>
            ),
          },
          { value: 'reprint', label: p.articleType.reprint },
          { value: 'translated', label: p.articleType.translated },
        ]}
      />
      {value !== 'original' && (
        <input
          type="url"
          className="ex-pub-input ex-pub-source-url"
          value={sourceUrl ?? ''}
          placeholder={p.articleType.sourceUrlPlaceholder}
          aria-label={p.fields.sourceUrl}
          aria-invalid={sourceUrlInvalid || undefined}
          aria-describedby={sourceUrlInvalid ? errorId(id) : undefined}
          onChange={(e) => onSourceUrl(e.target.value)}
        />
      )}
    </>
  )
}

export interface BackupFieldProps {
  checked: boolean
  onChange(checked: boolean): void
  links?: AgreementLinks
}

export function BackupField({ checked, onChange, links }: BackupFieldProps) {
  const b = useMessages().publish.backup
  const link = (href: string | undefined, text: string) =>
    href ? (
      <a className="ex-pub-link" href={href} target="_blank" rel="noreferrer">
        {text}
      </a>
    ) : (
      <span className="ex-pub-link">{text}</span>
    )
  return (
    <>
      <div className="ex-pub-line">
        <Checkbox className="ex-pub-checkbox" checked={checked} onChange={onChange}>
          {b.label}
        </Checkbox>
      </div>
      <p className="ex-pub-agreement">
        {b.agreementPrefix}
        {link(links?.terms, b.terms)}
        {b.and}
        {link(links?.privacy, b.privacy)}
        {b.agreementSuffix}
      </p>
    </>
  )
}

export interface ActivityFieldProps {
  id: string
  activityId: string | undefined
  topicId: string | undefined
  onActivity(id: string): void
  onTopic(id: string): void
  activities: PublishOption[] | null
  topics: PublishOption[] | null
  activityState: AdapterState
  topicState: AdapterState
}

const toOptions = (list: PublishOption[] | null) =>
  (list ?? []).map((option) => ({ value: option.id, label: option.name, disabled: option.disabled }))

export function ActivityField(props: ActivityFieldProps) {
  const { id, activityId, topicId, onActivity, onTopic, activities, topics, activityState, topicState } = props
  const p = useMessages().publish
  return (
    <div className="ex-pub-activity">
      {activityState !== 'hidden' && (
        <div className="ex-pub-activity__row">
          <span className="ex-pub-activity__sub" id={`${id}-activity`}>
            {p.fields.activitySub}
          </span>
          <Select
            className="ex-pub-select ex-pub-select--wide"
            labelledBy={`${id}-activity`}
            value={activityId}
            placeholder={p.activity.placeholder}
            options={toOptions(activities)}
            disabled={activityState === 'disabled'}
            onChange={onActivity}
          />
        </div>
      )}
      {topicState !== 'hidden' && (
        <div className="ex-pub-activity__row">
          <span className="ex-pub-activity__sub" id={`${id}-topic`}>
            {p.fields.topicSub}
          </span>
          <Select
            className="ex-pub-select ex-pub-select--wide"
            labelledBy={`${id}-topic`}
            value={topicId}
            placeholder={p.activity.topicPlaceholder}
            options={toOptions(topics)}
            disabled={topicState === 'disabled'}
            onChange={onTopic}
          />
        </div>
      )}
    </div>
  )
}
```

`packages/publish/src/index.ts` 末尾追加：

```ts
export type {
  AgreementLinks,
  PublishBaseProps,
  PublishModalProps,
  PublishPanelProps,
  PublishPanelSlots,
  PublishVariant,
} from './types'
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/publish test; pnpm --filter @editorx/publish typecheck
```

预期：全部通过。

- [ ] **Step 5: 提交**

```powershell
git add packages/publish/src/types.ts
git add packages/publish/src/icons.tsx
git add packages/publish/src/test-utils.tsx
git add packages/publish/src/form/form-item.tsx
git add packages/publish/src/form/tag-field.tsx
git add packages/publish/src/form/summary-field.tsx
git add packages/publish/src/form/category-field.tsx
git add packages/publish/src/form/option-fields.tsx
git add packages/publish/src/form/fields.test.tsx
git add packages/publish/src/index.ts
git commit -m "feat(publish): 发布表单字段组件" -m "FormItem 统一渲染标签、必填星号、帮助提示与错误信息；标签字段带搜索弹层（推荐、300ms 防抖搜索、Enter 自定义、最多 7 个）；摘要字段按呈现显示 CSDN 占位与计数，「AI提取摘要」填入正文前 256 字。" -m "分类专栏、文章类型（转载/翻译时出现原文链接）、文章备份协议、参与活动/话题等字段按 adapter 状态隐藏或禁用；新增 PublishPanel/PublishModal 的公开 props 类型。"
```

---

### Task 9: 封面字段 + 裁剪弹窗

**Files:**
- Create: `packages/publish/src/form/cover-field.tsx`、`packages/publish/src/form/cover-crop-dialog.tsx`、`packages/publish/src/form/cover-field.test.tsx`

**Interfaces:**
- Consumes：Task 5 的 `ImageCropper` / `cropImage` / `CropArea`、`Modal` / `Button` / `RadioGroup`；Task 6 的 `COVER_CAPACITY` / `pickCover` / `placeCover` / `removeCover` / `setCoverMode` / `AdapterState`；Task 8 的 `PlusIcon` / `labelId` / `errorId`；`useLatest`。
- Produces：
  ```ts
  interface CoverFieldProps {
    id: string; cover: PublishCover; onChange(cover: PublishCover): void
    bodyImages: readonly string[]; modes: readonly CoverMode[]
    uploadState: AdapterState; uploadImage?: (file: File) => Promise<{ url: string }>
    variant: PublishVariant; invalid: boolean; onError(message: string): void
  }
  function CoverField(props: CoverFieldProps): JSX.Element
  function CoverCropDialog(props: { src: string; onCancel(): void; onConfirm(blob: Blob): void; onError(message: string): void }): JSX.Element
  const COVER_ASPECT = 16 / 9; const COVER_OUTPUT = { width: 640, height: 360 }
  ```
- 行为：
  - 选本地文件 → `URL.createObjectURL` → 裁剪弹窗（16:9）→「确定」用 `cropImage` 导出 640×360 PNG → `uploadImage` → 写入当时点击的槽位；
  - 上传中槽位显示「上传中…」，失败 `onError('封面上传失败：…')`；
  - 正文图片缩略图（`aria-pressed`）点击即选为封面，再点取消；无正文图片时显示灰色提示块；
  - `modes` 多于一项时显示「单图 / 三图 / 无封面」单选，`none` 时不显示上传行；
  - 校验失败时根元素 `role=group` 带 `aria-invalid` 与 `tabIndex=-1`，便于表单聚焦。

- [ ] **Step 1: 写失败测试**

`packages/publish/src/form/cover-field.test.tsx`：

```tsx
import type { PublishCover } from '@editorx/toolbar'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { CoverField, type CoverFieldProps } from './cover-field'

vi.mock('@editorx/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@editorx/ui')>()),
  cropImage: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))

function Cover(props: Partial<Omit<CoverFieldProps, 'cover' | 'onChange'>>) {
  const [cover, setCover] = useState<PublishCover>({ mode: 'single', urls: [] })
  return (
    <>
      <span id="cv-label">添加封面</span>
      <CoverField
        id="cv"
        cover={cover}
        onChange={setCover}
        bodyImages={[]}
        modes={['single']}
        uploadState="enabled"
        uploadImage={async () => ({ url: '/uploaded.png' })}
        variant="inline"
        invalid={false}
        onError={() => {}}
        {...props}
      />
      <output data-testid="cover">{`${cover.mode}:${cover.urls.join(',')}`}</output>
    </>
  )
}

function chooseFile(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('.ex-pub-cover__file')!
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
}

function loadCropImage() {
  const img = document.querySelector<HTMLImageElement>('.ex-cropper__image')!
  Object.defineProperty(img, 'naturalWidth', { value: 1600 })
  Object.defineProperty(img, 'naturalHeight', { value: 900 })
  fireEvent.load(img)
}

describe('CoverField', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:cover') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })
  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('默认单图：上传框 + 无正文图片提示，不显示模式切换', () => {
    renderWithProviders(<Cover />)
    expect(screen.getByRole('group', { name: '添加封面' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '从本地上传' })).toBeEnabled()
    expect(screen.getByText('暂无内容图片，请在正文中添加图片')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: '封面类型' })).toBeNull()
  })

  it('正文图片：点选设为封面，再点取消', async () => {
    renderWithProviders(<Cover bodyImages={['/a.png', '/b.png']} />)
    const second = screen.getByRole('button', { name: '选择正文图片 2 作为封面' })
    await userEvent.click(second)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: '封面 1' })).toHaveAttribute('src', '/b.png')
    expect(screen.getByTestId('cover')).toHaveTextContent('single:/b.png')
    await userEvent.click(second)
    expect(screen.getByTestId('cover')).toHaveTextContent(/^single:$/)
  })

  it('本地上传：裁剪 → cropImage → uploadImage → 写入封面', async () => {
    const uploadImage = vi.fn(async (_file: File) => ({ url: '/uploaded.png' }))
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} />)
    chooseFile(container)
    const dialog = await screen.findByRole('dialog', { name: '裁剪封面' })
    const confirm = screen.getByRole('button', { name: '确定' })
    expect(confirm).toBeDisabled()
    loadCropImage()
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    await waitFor(() => expect(screen.getByTestId('cover')).toHaveTextContent('single:/uploaded.png'))
    expect(dialog).not.toBeInTheDocument()
    expect(uploadImage.mock.lastCall![0]).toBeInstanceOf(File)
    expect(uploadImage.mock.lastCall![0].type).toBe('image/png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cover')
  })

  it('上传失败回调 onError；取消裁剪不上传', async () => {
    const onError = vi.fn()
    const uploadImage = vi.fn(async () => {
      throw new Error('网络错误')
    })
    const { container } = renderWithProviders(<Cover uploadImage={uploadImage} onError={onError} />)
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(uploadImage).not.toHaveBeenCalled()
    chooseFile(container)
    await screen.findByRole('dialog', { name: '裁剪封面' })
    loadCropImage()
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith('封面上传失败：网络错误'))
  })

  it('缺 uploadImage：hidden 不渲染上传框，disabled 禁用', () => {
    const { unmount } = renderWithProviders(<Cover uploadState="hidden" uploadImage={undefined} />)
    expect(screen.queryByRole('button', { name: '从本地上传' })).toBeNull()
    unmount()
    renderWithProviders(<Cover uploadState="disabled" uploadImage={undefined} />)
    expect(screen.getByRole('button', { name: '从本地上传' })).toBeDisabled()
  })

  it('多模式：三图显示 3 个槽位，无封面隐藏上传行', async () => {
    renderWithProviders(<Cover modes={['single', 'triple', 'none']} bodyImages={['/a.png']} />)
    await userEvent.click(screen.getByRole('radio', { name: '三图' }))
    expect(screen.getAllByRole('button', { name: '从本地上传' })).toHaveLength(3)
    await userEvent.click(screen.getByRole('radio', { name: '无封面' }))
    expect(screen.queryByRole('button', { name: '从本地上传' })).toBeNull()
    expect(screen.getByTestId('cover')).toHaveTextContent(/^none:$/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/publish exec vitest run src/form/cover-field.test.tsx
```

预期：找不到 `./cover-field`。

- [ ] **Step 3: 实现**

`packages/publish/src/form/cover-crop-dialog.tsx`：

```tsx
import { errorMessage, formatMessage, useMessages } from '@editorx/toolbar'
import { Button, cropImage, ImageCropper, Modal, type CropArea } from '@editorx/ui'
import { useState } from 'react'

export const COVER_ASPECT = 16 / 9
export const COVER_OUTPUT = { width: 640, height: 360 } as const

export interface CoverCropDialogProps {
  src: string
  onCancel(): void
  onConfirm(blob: Blob): void
  onError(message: string): void
}

export function CoverCropDialog({ src, onCancel, onConfirm, onError }: CoverCropDialogProps) {
  const m = useMessages()
  const [area, setArea] = useState<CropArea | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    if (!area) return
    setBusy(true)
    try {
      onConfirm(await cropImage(src, area, COVER_OUTPUT))
    } catch (error) {
      setBusy(false)
      onError(formatMessage(m.publish.errors.upload, { message: errorMessage(error) }))
    }
  }
  return (
    <Modal
      open
      onClose={onCancel}
      title={m.publish.cover.cropTitle}
      width={528}
      className="ex-pub-crop"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button onClick={onCancel}>{m.publish.actions.cancel}</Button>
          <Button variant="primary" disabled={!area} loading={busy} onClick={() => void confirm()}>
            {m.dialog.confirm}
          </Button>
        </>
      }
    >
      <ImageCropper
        src={src}
        aspect={COVER_ASPECT}
        onChange={setArea}
        zoomLabel={m.publish.cover.cropZoom}
        areaLabel={m.publish.cover.cropArea}
      />
    </Modal>
  )
}
```

注意：`ImageCropper` 的 `areaLabel` 来自 `cropArea` 文案（「裁剪区域，可拖动或用方向键移动」）；Task 5 的组件测试使用组件默认值「裁剪区域」，两者不冲突。

`packages/publish/src/form/cover-field.tsx`：

```tsx
import {
  errorMessage,
  formatMessage,
  useMessages,
  type CoverMode,
  type PublishCover,
} from '@editorx/toolbar'
import { RadioGroup } from '@editorx/ui'
import { Trash2 } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import type { AdapterState } from '../adapter-state'
import { cx } from '../cx'
import { PlusIcon } from '../icons'
import { COVER_CAPACITY, pickCover, placeCover, removeCover, setCoverMode } from '../settings'
import type { PublishVariant } from '../types'
import { useLatest } from '../use-latest'
import { CoverCropDialog } from './cover-crop-dialog'
import { errorId, labelId } from './form-item'

export interface CoverFieldProps {
  id: string
  cover: PublishCover
  onChange(cover: PublishCover): void
  bodyImages: readonly string[]
  modes: readonly CoverMode[]
  uploadState: AdapterState
  uploadImage?: (file: File) => Promise<{ url: string }>
  variant: PublishVariant
  invalid: boolean
  onError(message: string): void
}

export function CoverField(props: CoverFieldProps) {
  const { id, cover, onChange, bodyImages, modes, uploadState, uploadImage, variant, invalid, onError } = props
  const p = useMessages().publish
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useLatest(cover)
  const [slot, setSlot] = useState(0)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const capacity = COVER_CAPACITY[cover.mode]

  const chooseFile = (index: number) => {
    setSlot(index)
    fileRef.current?.click()
  }
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCropSrc(URL.createObjectURL(file))
  }
  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }
  const onCropped = async (blob: Blob) => {
    closeCrop()
    if (!uploadImage) return
    setUploading(slot)
    try {
      const { url } = await uploadImage(new File([blob], 'cover.png', { type: blob.type || 'image/png' }))
      onChange(placeCover(coverRef.current, slot, url))
    } catch (error) {
      onError(formatMessage(p.errors.upload, { message: errorMessage(error) }))
    } finally {
      setUploading(null)
    }
  }

  const slots = Array.from({ length: capacity }, (_, index) => {
    const url = cover.urls[index]
    if (uploading === index) {
      return (
        <div key={index} className="ex-pub-cover__slot is-uploading" aria-busy="true">
          {p.cover.uploading}
        </div>
      )
    }
    if (url) {
      return (
        <div key={index} className="ex-pub-cover__slot is-filled">
          <img className="ex-pub-cover__img" src={url} alt={formatMessage(p.cover.slot, { index: index + 1 })} />
          <div className="ex-pub-cover__ops">
            {uploadState === 'enabled' && (
              <button type="button" className="ex-pub-cover__op" onClick={() => chooseFile(index)}>
                {p.cover.replace}
              </button>
            )}
            <button
              type="button"
              className="ex-pub-cover__op"
              aria-label={p.cover.remove}
              onClick={() => onChange(removeCover(cover, index))}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )
    }
    if (uploadState === 'hidden') return null
    return (
      <button
        key={index}
        type="button"
        className="ex-pub-cover__slot ex-pub-cover__upload"
        disabled={uploadState === 'disabled'}
        onClick={() => chooseFile(index)}
      >
        <PlusIcon size={variant === 'modal' ? 14 : 12} />
        <span className="ex-pub-cover__upload-text">{p.cover.upload}</span>
      </button>
    )
  })

  return (
    <div
      className="ex-pub-cover"
      role="group"
      aria-labelledby={labelId(id)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId(id) : undefined}
      tabIndex={invalid ? -1 : undefined}
      data-mode={cover.mode}
    >
      {modes.length > 1 && (
        <RadioGroup<CoverMode>
          className="ex-pub-line ex-pub-cover__modes"
          label={p.cover.modes}
          value={cover.mode}
          options={modes.map((mode) => ({ value: mode, label: p.cover[mode] }))}
          onChange={(mode) => onChange(setCoverMode(cover, mode))}
        />
      )}
      {capacity > 0 && (
        <div className="ex-pub-cover__row">
          <div className="ex-pub-cover__slots">{slots}</div>
          {bodyImages.length > 0 ? (
            <ul className="ex-pub-cover__images" aria-label={p.cover.bodyImages}>
              {bodyImages.map((src, index) => {
                const on = cover.urls.includes(src)
                return (
                  <li key={src}>
                    <button
                      type="button"
                      className={cx('ex-pub-cover__thumb', on && 'is-selected')}
                      aria-pressed={on}
                      aria-label={formatMessage(p.cover.pick, { index: index + 1 })}
                      onClick={() => onChange(pickCover(cover, src))}
                    >
                      <img src={src} alt="" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="ex-pub-cover__empty">{p.cover.noImages}</div>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        className="ex-pub-cover__file"
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />
      {cropSrc && <CoverCropDialog src={cropSrc} onCancel={closeCrop} onConfirm={(blob) => void onCropped(blob)} onError={onError} />}
    </div>
  )
}
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/publish test; pnpm --filter @editorx/publish typecheck
```

预期：全部通过。

- [ ] **Step 5: 提交**

```powershell
git add packages/publish/src/form/cover-field.tsx
git add packages/publish/src/form/cover-crop-dialog.tsx
git add packages/publish/src/form/cover-field.test.tsx
git commit -m "feat(publish): 封面字段与裁剪上传" -m "封面支持从正文图片点选与本地上传：选文件后按 16:9 裁剪并导出 640×360 PNG，经 adapters.uploadImage 上传后写入对应槽位，上传中与失败均有反馈。" -m "默认只用单图模式（与 CSDN 截图一致），传入多个 coverModes 时显示单图/三图/无封面切换；缺少 uploadImage 时按 missingAdapter 隐藏或禁用上传框。"
```

---

### Task 10: PublishForm / Actions / ScheduleDialog / PublishPanel / PublishModal + 样式 + SSR / dist

**Files:**
- Create: `packages/publish/src/form/publish-form.tsx`、`packages/publish/src/actions.tsx`、`packages/publish/src/schedule-dialog.tsx`、`packages/publish/src/publish-panel.tsx`
- Create: `packages/publish/src/publish-panel.test.tsx`、`packages/publish/src/styles.test.ts`、`packages/publish/src/ssr.test.tsx`、`packages/publish/src/dist.test.ts`
- Modify: `packages/publish/src/styles.css`（全文替换）、`packages/publish/src/index.ts`

**Interfaces:**
- Consumes：Task 6–9 全部产物；`ThemeProvider` / `useOptionalTheme`（theme）；`MessagesProvider` / `useMessages`（toolbar）；`Modal` / `Button` / `RadioGroup` / `Select` / `ToastProvider` / `useToast`（ui）。
- Produces：
  ```ts
  function PublishForm(props: { ctl; variant; document?; adapters; missingAdapter; coverModes; templates?; agreementLinks?; notify }): JSX.Element
  function PublishActions(props: { variant; busy; draftState; publishState; onSaveDraft(); onSchedule(); onPublish(); onCancel?() }): JSX.Element
  function ScheduleDialog(props: { error?: string; onCancel(): void; onConfirm(iso: string): void }): JSX.Element
  function PublishPanel(props: PublishPanelProps): JSX.Element   // 内联卡片 + 底部 sticky 操作栏
  function PublishModal(props: PublishModalProps): JSX.Element   // 740 宽模态框；成功发布后调用 onClose
  ```
- 结构：
  - `PublishRoot`：与 `MarkdownEditor` 相同的主题归属规则（首次渲染时无外层 ThemeProvider，或传了 `theme` / `defaultTheme` 才自建，类名 `ex-pub-theme`），外加 `MessagesProvider(locale)` 与 `ToastProvider(closeLabel)`。
  - 内联：`section.ex-pub[aria-label=发布设置] > div.ex-pub-card > div.ex-pub-form` + `div.ex-pub-bar > div.ex-pub-bar__inner > (div.ex-pub-bar__start + div.ex-pub-actions)`。
  - 模态：`Modal`（`className="ex-pub ex-pub--modal ex-pub-modal"`、`maskClassName="ex-pub-mask"`、`width=740`）的 body 为 `.ex-pub-form`，footer 为 `.ex-pub-actions`。控制器放在 Modal 外层，关闭再打开时非受控设置保留。
  - 定时发布弹窗嵌在发布表单内（模态时嵌在 Modal children 中，Esc 只关最内层）；确认后调用 `ctl.publish(iso)`，成功才关闭，失败时在弹窗内显示 `errors.scheduledAt`。
  - 校验失败后表单把焦点移到第一个 `[aria-invalid="true"]` 控件。

- [ ] **Step 1: 写失败测试**

`packages/publish/src/publish-panel.test.tsx`：

```tsx
import { zhCN, type EditorAdapters, type EditorDocument, type PublishSettings } from '@editorx/toolbar'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PublishModal, PublishPanel } from './publish-panel'
import { renderWithProviders } from './test-utils'

const doc: EditorDocument = {
  editorType: 'markdown',
  title: '一篇测试文章标题',
  markdown: '正文',
  html: '<p>正文内容</p><img src="/a.png">',
}

function adapters(extra: Partial<EditorAdapters> = {}): EditorAdapters {
  return {
    onPublish: vi.fn(async () => {}),
    onSaveDraft: vi.fn(async () => {}),
    searchTags: vi.fn(async () => ['React']),
    getCategories: vi.fn(async () => [{ id: 'c1', name: '前端' }]),
    getActivities: vi.fn(async () => [{ id: 'a1', name: '征文' }]),
    getTopics: vi.fn(async () => [{ id: 't1', name: '话题一' }]),
    uploadImage: vi.fn(async () => ({ url: '/u.png' })),
    ...extra,
  }
}

const LABELS = ['文章标签', '添加封面', '文章摘要', '分类专栏', '文章类型', '创作声明', '文章备份', '可见范围', '文章模板', '多平台发布', '参与活动']

describe('PublishPanel（内联）', () => {
  it('按 CSDN 顺序渲染全部字段与底部操作栏', async () => {
    const { container } = renderWithProviders(<PublishPanel document={doc} adapters={adapters()} />)
    expect(screen.getByRole('region', { name: '发布设置' })).toHaveClass('ex-pub')
    const labels = [...container.querySelectorAll('.ex-pub-item__text')].map((n) => n.textContent)
    expect(labels).toEqual(LABELS)
    expect(container.querySelector('[data-field="activity"] .ex-pub-item__suffix')).toHaveTextContent('/话题')
    expect(await screen.findByRole('checkbox', { name: '前端' })).toBeInTheDocument()
    const bar = within(container.querySelector('.ex-pub-bar')!)
    expect(bar.getAllByRole('button').map((b) => b.textContent)).toEqual(['保存草稿', '定时发布', '发布博客'])
    expect(screen.getByRole('textbox', { name: '文章摘要' })).toHaveAttribute(
      'placeholder',
      zhCN.publish.summary.placeholderInline,
    )
  })

  it('非受控：defaultValue 生效并回调 onChange；受控：跟随 value', async () => {
    const onChange = vi.fn()
    const { unmount } = renderWithProviders(
      <PublishPanel adapters={adapters()} defaultValue={{ visibility: 'fans' }} onChange={onChange} />,
    )
    expect(screen.getByRole('radio', { name: '粉丝可见' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: '仅我可见' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ visibility: 'private' }))
    expect(screen.getByRole('radio', { name: '仅我可见' })).toBeChecked()
    unmount()

    function Controlled() {
      const [value, setValue] = useState<PublishSettings>({
        tags: [],
        cover: { mode: 'single', urls: [] },
        summary: '',
        categories: [],
        articleType: 'original',
        declaration: 'none',
        backupToGitCode: false,
        visibility: 'public',
        template: 'default',
        multiPlatform: false,
      })
      return (
        <>
          <PublishPanel adapters={adapters()} value={value} onChange={setValue} />
          <button onClick={() => setValue({ ...value, multiPlatform: true })}>外部修改</button>
        </>
      )
    }
    renderWithProviders(<Controlled />)
    await userEvent.click(screen.getByRole('button', { name: '外部修改' }))
    expect(screen.getByRole('radio', { name: '是' })).toBeChecked()
  })

  it('校验失败：显示错误、焦点移到标签按钮、提示错误、不调用 onPublish', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} />)
    await userEvent.click(screen.getByRole('button', { name: '发布博客' }))
    const add = screen.getByRole('button', { name: '添加文章标签' })
    await waitFor(() => expect(add).toHaveFocus())
    expect(add).toHaveAttribute('aria-invalid', 'true')
    expect(add).toHaveAccessibleDescription('请至少添加 1 个文章标签')
    expect(await screen.findByRole('alert')).toHaveTextContent('请至少添加 1 个文章标签')
    expect(a.onPublish).not.toHaveBeenCalled()
  })

  it('发布成功：payload 含文档与设置，提示「发布成功」并回调 onPublished', async () => {
    const a = adapters()
    const onPublished = vi.fn()
    renderWithProviders(
      <PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} onPublished={onPublished} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '选择正文图片 1 作为封面' }))
    await userEvent.click(screen.getByRole('button', { name: 'AI提取摘要' }))
    await userEvent.click(screen.getByRole('button', { name: '发布博客' }))
    await waitFor(() => expect(a.onPublish).toHaveBeenCalledTimes(1))
    expect(a.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ ...doc, tags: ['React'], cover: { mode: 'single', urls: ['/a.png'] }, summary: '正文内容' }),
    )
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(onPublished).toHaveBeenCalledTimes(1)
  })

  it('保存草稿：onSaveDraft(doc, settings)', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['X'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '保存草稿' }))
    await waitFor(() => expect(a.onSaveDraft).toHaveBeenCalledWith(doc, expect.objectContaining({ tags: ['X'] })))
    expect(await screen.findByText('草稿已保存')).toBeInTheDocument()
  })

  it('定时发布：选择时间后发布，payload 带 scheduledAt', async () => {
    const a = adapters()
    renderWithProviders(<PublishPanel document={doc} adapters={a} defaultValue={{ tags: ['React'] }} />)
    await userEvent.click(screen.getByRole('button', { name: '定时发布' }))
    const dialog = await screen.findByRole('dialog', { name: '定时发布' })
    const input = screen.getByLabelText('发布时间')
    expect(input).toHaveAttribute('type', 'datetime-local')
    fireEvent.change(input, { target: { value: '2099-01-01T10:00' } })
    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    await waitFor(() =>
      expect(a.onPublish).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: new Date(2099, 0, 1, 10, 0).toISOString() }),
      ),
    )
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('缺失 adapter：hide 隐藏、disable 禁用', () => {
    const { container, unmount } = renderWithProviders(<PublishPanel document={doc} adapters={{}} />)
    expect(screen.queryByRole('button', { name: '保存草稿' })).toBeNull()
    expect(screen.queryByRole('button', { name: '定时发布' })).toBeNull()
    expect(screen.queryByRole('button', { name: '发布博客' })).toBeNull()
    expect(screen.queryByRole('button', { name: '从本地上传' })).toBeNull()
    expect(container.querySelector('[data-field="categories"]')).toBeNull()
    expect(container.querySelector('[data-field="activity"]')).toBeNull()
    expect(screen.getByRole('button', { name: '添加文章标签' })).toBeInTheDocument()
    unmount()
    renderWithProviders(<PublishPanel document={doc} adapters={{}} missingAdapter="disable" />)
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '定时发布' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发布博客' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '从本地上传' })).toBeDisabled()
    expect(screen.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '活动' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '话题' })).toBeDisabled()
  })

  it('locale 覆盖文案；无外层主题时自建 .ex-root', () => {
    const { container } = render(
      <PublishPanel adapters={adapters()} defaultTheme="dark" locale={{ publish: { actions: { publishInline: 'Publish' } } }} />,
    )
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
    const root = container.querySelector('.ex-root')!
    expect(root).toHaveClass('ex-pub-theme')
    expect(root).toHaveAttribute('data-ex-theme', 'dark')
  })
})

describe('PublishModal', () => {
  function Host({ a, onPublished }: { a: EditorAdapters; onPublished?: () => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>打开</button>
        <PublishModal open={open} onClose={() => setOpen(false)} document={doc} adapters={a} onPublished={onPublished} />
      </>
    )
  }

  it('模态呈现：标题、模态文案与按钮；取消关闭；重新打开保留设置', async () => {
    renderWithProviders(<Host a={adapters()} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    const dialog = await screen.findByRole('dialog', { name: '发布文章' })
    expect(dialog).toHaveClass('ex-modal', 'ex-pub', 'ex-pub--modal')
    expect(dialog.closest('.ex-modal-mask')).toHaveClass('ex-pub-mask')
    const footer = within(dialog.querySelector('.ex-modal__footer') as HTMLElement)
    expect(footer.getAllByRole('button').map((b) => b.textContent)).toEqual(['取消', '保存为草稿', '定时发布', '发布文章'])
    expect(screen.getByText('0/256')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '转载' }))
    await userEvent.click(footer.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '发布文章' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(await screen.findByRole('radio', { name: '转载' })).toBeChecked()
  })

  it('发布成功后关闭并回调 onPublished', async () => {
    const a = adapters()
    const onPublished = vi.fn()
    renderWithProviders(<Host a={a} onPublished={onPublished} />)
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await screen.findByRole('dialog', { name: '发布文章' })
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    await userEvent.type(await screen.findByRole('searchbox', { name: '搜索标签' }), 'React{Enter}')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '发布文章' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '发布文章' })).toBeNull())
    expect(a.onPublish).toHaveBeenCalledWith(expect.objectContaining({ tags: ['React'] }))
    expect(onPublished).toHaveBeenCalledTimes(1)
  })
})
```
`packages/publish/src/styles.test.ts`：

```ts
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('publish styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量（组件私有 --ex-pub-* 除外）', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(10)
    for (const name of used) {
      if (name.startsWith('--ex-pub-')) {
        expect(css, name).toContain(`${name}:`)
        continue
      }
      expect(themeCss, name).toContain(`${name}:`)
    }
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('类名以 ex- 开头（状态类 is-* 除外）', () => {
    for (const [, c] of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      expect(c!.startsWith('ex-') || c!.startsWith('is-'), c).toBe(true)
    }
  })

  it('参考几何：内联卡片、操作栏、模态框关键尺寸', () => {
    expect(css).toMatch(/\.ex-pub-card \{[^}]*width: 816px;[^}]*padding: 32px 40px 56px;/)
    expect(css).toMatch(/\.ex-pub \{[^}]*--ex-pub-label-width: 88px;[^}]*--ex-pub-control-width: 648px;[^}]*--ex-pub-row-gap: 32px;/)
    expect(css).toMatch(/\.ex-pub--modal \{[^}]*--ex-pub-label-width: 92px;[^}]*--ex-pub-control-width: 600px;[^}]*--ex-pub-row-gap: 16px;/)
    expect(css).toMatch(/\.ex-pub-bar \{[^}]*position: sticky;[^}]*height: 69px;[^}]*margin-top: 26px;/)
    expect(css).toMatch(/\.ex-pub-bar__inner \{[^}]*width: 1080px;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body \{[^}]*padding: 26px 28px 40px;/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__footer \{[^}]*height: 64px;[^}]*padding: 12px 34px 12px 28px;/)
    expect(css).toMatch(/\.ex-pub-mask \{[^}]*background: var\(--ex-color-pub-mask\);/)
  })

  it('组件中用到的每个 ex-pub-* 类名都有样式', () => {
    const dir = import.meta.dirname
    const sources = (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('test-utils'))
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
    const used = new Set([...sources.matchAll(/['"`\s](ex-pub-[\w-]*\w)(?![\w-]*\$)/g)].map((m) => m[1]!))
    const STRUCTURAL = new Set([
      'ex-pub-theme',
      'ex-pub-checkbox',
      'ex-pub-tags',
      'ex-pub-summary',
      'ex-pub-tag-search__section',
      'ex-pub-schedule',
    ])
    expect(used.size).toBeGreaterThan(30)
    for (const name of used) {
      if (STRUCTURAL.has(name)) continue
      expect(css, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`))
    }
  })
})
```

`packages/publish/src/ssr.test.tsx`：

```tsx
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublishModal, PublishPanel } from './publish-panel'

describe('SSR', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('无 window/document 时可 renderToString', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const html = renderToString(
      <PublishPanel
        defaultTheme="light"
        document={{ editorType: 'markdown', title: '服务端渲染标题', html: '<p>正文</p>' }}
        adapters={{ onPublish: async () => {} }}
      />,
    )
    expect(html).toContain('ex-pub-card')
    expect(html).toContain('文章标签')
    expect(html).toContain('发布博客')
    expect(renderToString(<PublishModal defaultTheme="light" open={false} onClose={() => {}} />)).not.toContain('ex-pub-form')
  })
})
```

`packages/publish/src/dist.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dist = path.join(import.meta.dirname, '..', 'dist', 'index.js')

describe.skipIf(!existsSync(dist))('构建产物（需先 build）', () => {
  it("dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })

  it('不依赖 @editorx/markdown', () => {
    expect(readFileSync(dist, 'utf8')).not.toMatch(/@editorx\/markdown/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
pnpm --filter @editorx/publish exec vitest run src/publish-panel.test.tsx src/styles.test.ts src/ssr.test.tsx
```

预期：找不到 `./publish-panel`；styles 用例因占位 CSS 失败。

- [ ] **Step 3: 实现**

`packages/publish/src/form/publish-form.tsx`：

```tsx
import {
  errorMessage,
  formatMessage,
  useMessages,
  type AdapterName,
  type CoverMode,
  type EditorAdapters,
  type EditorDocument,
  type MissingAdapterPolicy,
  type PublishOption,
} from '@editorx/toolbar'
import { RadioGroup, Select, type ToastType } from '@editorx/ui'
import { useEffect, useId, useMemo, useRef } from 'react'
import { adapterState } from '../adapter-state'
import { extractImages, extractSummary } from '../extract'
import type { AgreementLinks, PublishVariant } from '../types'
import { useAsyncList } from '../use-async-list'
import type { PublishController } from '../use-publish-controller'
import { CategoryField } from './category-field'
import { CoverField } from './cover-field'
import { FormItem, labelId } from './form-item'
import { ActivityField, ArticleTypeField, BackupField } from './option-fields'
import { SummaryField } from './summary-field'
import { TagField } from './tag-field'

export interface PublishFormProps {
  ctl: PublishController
  variant: PublishVariant
  document?: EditorDocument
  adapters: EditorAdapters
  missingAdapter: MissingAdapterPolicy
  coverModes: readonly CoverMode[]
  templates?: readonly PublishOption[]
  agreementLinks?: AgreementLinks
  notify(message: string, type?: ToastType): void
}

const VISIBILITIES = ['public', 'private', 'fans', 'vip'] as const
const DECLARATIONS = ['none', 'ai', 'network', 'personal'] as const

export function PublishForm(props: PublishFormProps) {
  const { ctl, variant, document: doc, adapters, missingAdapter, coverModes, templates, agreementLinks, notify } = props
  const p = useMessages().publish
  const { settings, errors, update, failedAttempts } = ctl
  const rootRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const fid = (name: string) => `${baseId}${name}`

  useEffect(() => {
    if (failedAttempts > 0) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [failedAttempts])

  const state = (name: AdapterName) => adapterState(adapters, name, missingAdapter)
  const categoriesState = state('getCategories')
  const activityState = state('getActivities')
  const topicState = state('getTopics')
  const uploadState = state('uploadImage')
  const loadError = (name: string) => (error: unknown) =>
    notify(formatMessage(p.errors.load, { name, message: errorMessage(error) }), 'error')
  const categories = useAsyncList(
    categoriesState === 'enabled' ? () => adapters.getCategories!() : undefined,
    loadError(p.fields.categories),
  )
  const activities = useAsyncList(
    activityState === 'enabled' ? () => adapters.getActivities!() : undefined,
    loadError(p.fields.activitySub),
  )
  const topics = useAsyncList(topicState === 'enabled' ? () => adapters.getTopics!() : undefined, loadError(p.fields.topicSub))
  const searchTags = useMemo(
    () => (adapters.searchTags ? (keyword: string) => adapters.searchTags!(keyword) : undefined),
    [adapters],
  )
  const uploadImage = useMemo(
    () => (adapters.uploadImage ? (file: File) => adapters.uploadImage!(file) : undefined),
    [adapters],
  )
  const html = doc?.html ?? ''
  const bodyImages = useMemo(() => extractImages(html), [html])
  const summarySource = useMemo(() => extractSummary({ html }), [html])
  const templateOptions = (
    templates ?? [
      { id: 'default', name: p.template.default },
      { id: 'simple', name: p.template.simple },
      { id: 'moyan', name: p.template.moyan, disabled: true },
    ]
  ).map((t) => ({ value: t.id, label: t.name, disabled: t.disabled }))

  return (
    <div ref={rootRef} className="ex-pub-form">
      <FormItem field="tags" id={fid('tags')} label={p.fields.tags} required help={p.help.tags} error={errors.tags}>
        <TagField
          id={fid('tags')}
          tags={settings.tags}
          onChange={(tags) => update('tags', tags)}
          searchTags={searchTags}
          invalid={!!errors.tags}
        />
      </FormItem>
      <FormItem field="cover" id={fid('cover')} label={p.fields.cover} help={p.help.cover} error={errors.cover}>
        <CoverField
          id={fid('cover')}
          cover={settings.cover}
          onChange={(cover) => update('cover', cover)}
          bodyImages={bodyImages}
          modes={coverModes}
          uploadState={uploadState}
          uploadImage={uploadImage}
          variant={variant}
          invalid={!!errors.cover}
          onError={(message) => notify(message, 'error')}
        />
      </FormItem>
      <FormItem field="summary" id={fid('summary')} label={p.fields.summary} help={p.help.summary} error={errors.summary}>
        <SummaryField
          id={fid('summary')}
          value={settings.summary}
          onChange={(summary) => update('summary', summary)}
          source={summarySource}
          variant={variant}
          invalid={!!errors.summary}
        />
      </FormItem>
      {categoriesState !== 'hidden' && (
        <FormItem field="categories" id={fid('cat')} label={p.fields.categories} help={p.help.categories}>
          <CategoryField
            id={fid('cat')}
            value={settings.categories}
            onChange={(ids) => update('categories', ids)}
            categories={categories}
            state={categoriesState}
            variant={variant}
          />
        </FormItem>
      )}
      <FormItem field="articleType" id={fid('type')} label={p.fields.articleType} help={p.help.articleType} error={errors.sourceUrl}>
        <ArticleTypeField
          id={fid('type')}
          value={settings.articleType}
          sourceUrl={settings.sourceUrl}
          onType={(type) => update('articleType', type)}
          onSourceUrl={(url) => update('sourceUrl', url)}
          sourceUrlInvalid={!!errors.sourceUrl}
        />
      </FormItem>
      <FormItem field="declaration" id={fid('decl')} label={p.fields.declaration}>
        <Select
          className="ex-pub-select ex-pub-select--declaration"
          labelledBy={labelId(fid('decl'))}
          value={settings.declaration}
          options={DECLARATIONS.map((value) => ({ value, label: p.declaration[value] }))}
          onChange={(value) => update('declaration', value)}
        />
      </FormItem>
      <FormItem field="backup" id={fid('backup')} label={p.fields.backup}>
        <BackupField
          checked={settings.backupToGitCode}
          onChange={(checked) => update('backupToGitCode', checked)}
          links={agreementLinks}
        />
      </FormItem>
      <FormItem field="visibility" id={fid('vis')} label={p.fields.visibility} help={p.help.visibility}>
        <RadioGroup
          className="ex-pub-line"
          labelledBy={labelId(fid('vis'))}
          value={settings.visibility}
          options={VISIBILITIES.map((value) => ({ value, label: p.visibility[value] }))}
          onChange={(value) => update('visibility', value)}
        />
      </FormItem>
      <FormItem field="template" id={fid('tpl')} label={p.fields.template} help={p.help.template}>
        <RadioGroup
          className="ex-pub-line"
          labelledBy={labelId(fid('tpl'))}
          value={settings.template}
          options={templateOptions}
          onChange={(value) => update('template', value)}
        />
      </FormItem>
      <FormItem field="multiPlatform" id={fid('multi')} label={p.fields.multiPlatform}>
        <RadioGroup<'no' | 'yes'>
          className="ex-pub-line"
          labelledBy={labelId(fid('multi'))}
          value={settings.multiPlatform ? 'yes' : 'no'}
          options={[
            { value: 'no', label: p.multiPlatform.no },
            { value: 'yes', label: p.multiPlatform.yes },
          ]}
          onChange={(value) => update('multiPlatform', value === 'yes')}
        />
      </FormItem>
      {(activityState !== 'hidden' || topicState !== 'hidden') && (
        <FormItem
          field="activity"
          id={fid('act')}
          label={p.fields.activity}
          labelSuffix={p.fields.activitySuffix}
          help={p.help.activity}
        >
          <ActivityField
            id={fid('act')}
            activityId={settings.activityId}
            topicId={settings.topicId}
            onActivity={(id) => update('activityId', id)}
            onTopic={(id) => update('topicId', id)}
            activities={activities}
            topics={topics}
            activityState={activityState}
            topicState={topicState}
          />
        </FormItem>
      )}
    </div>
  )
}
```

`packages/publish/src/actions.tsx`：

```tsx
import { useMessages } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { ChevronRight } from 'lucide-react'
import type { AdapterState } from './adapter-state'
import { CaretDownIcon } from './icons'
import type { PublishVariant } from './types'
import type { PublishBusy } from './use-publish-controller'

export interface PublishActionsProps {
  variant: PublishVariant
  busy: PublishBusy
  draftState: AdapterState
  publishState: AdapterState
  onSaveDraft(): void
  onSchedule(): void
  onPublish(): void
  /** 仅模态呈现 */
  onCancel?(): void
}

export function PublishActions(props: PublishActionsProps) {
  const { variant, busy, draftState, publishState, onSaveDraft, onSchedule, onPublish, onCancel } = props
  const a = useMessages().publish.actions
  const modal = variant === 'modal'
  return (
    <div className="ex-pub-actions" role="group" aria-label={a.label}>
      {modal && onCancel && (
        <Button className="ex-pub-action" data-action="cancel" onClick={onCancel}>
          {a.cancel}
        </Button>
      )}
      {draftState !== 'hidden' && (
        <Button
          className="ex-pub-action"
          data-action="draft"
          disabled={draftState === 'disabled' || busy === 'publish'}
          loading={busy === 'draft'}
          onClick={onSaveDraft}
        >
          {modal ? (
            a.saveDraftModal
          ) : (
            <>
              {a.saveDraft}
              <CaretDownIcon className="ex-pub-action__caret" />
            </>
          )}
        </Button>
      )}
      {publishState !== 'hidden' && (
        <>
          <Button
            className="ex-pub-action"
            data-action="schedule"
            disabled={publishState === 'disabled' || busy !== null}
            onClick={onSchedule}
          >
            {a.schedule}
            {!modal && <ChevronRight className="ex-pub-action__chevron" size={14} aria-hidden="true" />}
          </Button>
          <Button
            variant="primary"
            className="ex-pub-action"
            data-action="publish"
            disabled={publishState === 'disabled' || busy === 'draft'}
            loading={busy === 'publish'}
            onClick={onPublish}
          >
            {modal ? a.publish : a.publishInline}
          </Button>
        </>
      )}
    </div>
  )
}
```

`packages/publish/src/schedule-dialog.tsx`：

```tsx
import { useMessages } from '@editorx/toolbar'
import { Button, Modal } from '@editorx/ui'
import { useId, useState } from 'react'
import { defaultScheduleTime, fromLocalInputValue, toLocalInputValue } from './schedule'

export interface ScheduleDialogProps {
  error?: string
  onCancel(): void
  onConfirm(iso: string): void
}

/** 只在打开时挂载：初始时间在挂载时（客户端）计算 */
export function ScheduleDialog({ error, onCancel, onConfirm }: ScheduleDialogProps) {
  const m = useMessages()
  const s = m.publish.schedule
  const inputId = useId()
  const [value, setValue] = useState(() => toLocalInputValue(defaultScheduleTime(Date.now())))
  const [min] = useState(() => toLocalInputValue(new Date()))
  const iso = fromLocalInputValue(value)
  return (
    <Modal
      open
      onClose={onCancel}
      title={s.title}
      width={400}
      className="ex-pub-schedule"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button onClick={onCancel}>{m.publish.actions.cancel}</Button>
          <Button variant="primary" disabled={!iso} onClick={() => iso && onConfirm(iso)}>
            {s.confirm}
          </Button>
        </>
      }
    >
      <label className="ex-pub-schedule__label" htmlFor={inputId}>
        {s.label}
      </label>
      <input
        id={inputId}
        className="ex-pub-input ex-pub-schedule__input"
        type="datetime-local"
        value={value}
        min={min}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className={error ? 'ex-pub-schedule__error' : 'ex-pub-schedule__hint'}>{error ?? s.hint}</p>
    </Modal>
  )
}
```

`packages/publish/src/publish-panel.tsx`：

```tsx
import { ThemeProvider, useOptionalTheme } from '@editorx/theme'
import { MessagesProvider, useMessages, type CoverMode, type EditorAdapters } from '@editorx/toolbar'
import { Modal, ToastProvider, useToast, type ToastType } from '@editorx/ui'
import { useState, type ReactNode } from 'react'
import { PublishActions } from './actions'
import { adapterState } from './adapter-state'
import { cx } from './cx'
import { PublishForm } from './form/publish-form'
import { ScheduleDialog } from './schedule-dialog'
import type { PublishBaseProps, PublishModalProps, PublishPanelProps, PublishVariant } from './types'
import { usePublishController } from './use-publish-controller'

const EMPTY_ADAPTERS: EditorAdapters = {}
const DEFAULT_COVER_MODES: readonly CoverMode[] = ['single']

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

function PublishRoot({ props, children }: { props: PublishBaseProps; children: ReactNode }) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
  const [ownTheme] = useState(() => !outer || theme !== undefined || defaultTheme !== undefined)
  const content = (
    <MessagesProvider messages={locale}>
      <LocalizedToasts>{children}</LocalizedToasts>
    </MessagesProvider>
  )
  if (!ownTheme) return content
  return (
    <ThemeProvider
      theme={theme}
      defaultTheme={defaultTheme}
      onThemeChange={onThemeChange}
      storageKey={themeStorageKey}
      className="ex-pub-theme"
    >
      {content}
    </ThemeProvider>
  )
}

function usePublishParts(props: PublishBaseProps, variant: PublishVariant, onDone?: () => void, onCancel?: () => void) {
  const m = useMessages()
  const toast = useToast()
  const adapters = props.adapters ?? EMPTY_ADAPTERS
  const missing = props.missingAdapter ?? 'hide'
  const notify = (message: string, type?: ToastType) => toast.notify(message, type)
  const ctl = usePublishController({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    document: props.document,
    adapters,
    rules: props.rules,
    messages: m.publish,
    notify,
    onPublished: (payload) => {
      props.onPublished?.(payload)
      onDone?.()
    },
  })
  const [scheduling, setScheduling] = useState(false)
  const form = (
    <PublishForm
      ctl={ctl}
      variant={variant}
      document={props.document}
      adapters={adapters}
      missingAdapter={missing}
      coverModes={props.coverModes ?? DEFAULT_COVER_MODES}
      templates={props.templates}
      agreementLinks={props.agreementLinks}
      notify={notify}
    />
  )
  const actions = (
    <PublishActions
      variant={variant}
      busy={ctl.busy}
      draftState={adapterState(adapters, 'onSaveDraft', missing)}
      publishState={adapterState(adapters, 'onPublish', missing)}
      onSaveDraft={() => void ctl.saveDraft()}
      onSchedule={() => setScheduling(true)}
      onPublish={() => void ctl.publish()}
      onCancel={onCancel}
    />
  )
  const schedule = scheduling && (
    <ScheduleDialog
      error={ctl.errors.scheduledAt}
      onCancel={() => setScheduling(false)}
      onConfirm={(iso) => {
        void ctl.publish(iso).then((ok) => {
          if (ok) setScheduling(false)
        })
      }}
    />
  )
  return { form, actions, schedule }
}

function InlinePanel(props: PublishPanelProps) {
  const m = useMessages()
  const { form, actions, schedule } = usePublishParts(props, 'inline')
  return (
    <section className={cx('ex-pub', props.className)} aria-label={m.publish.label}>
      <div className="ex-pub-card">{form}</div>
      <div className="ex-pub-bar">
        <div className="ex-pub-bar__inner">
          <div className="ex-pub-bar__start">{props.slots?.barStart}</div>
          {actions}
        </div>
      </div>
      {schedule}
    </section>
  )
}

function ModalPanel(props: PublishModalProps) {
  const m = useMessages()
  const { open, onClose } = props
  const { form, actions, schedule } = usePublishParts(props, 'modal', onClose, onClose)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={m.publish.modalTitle}
      width={740}
      className={cx('ex-pub ex-pub--modal ex-pub-modal', props.className)}
      maskClassName="ex-pub-mask"
      closeLabel={m.dialog.close}
      footer={actions}
    >
      {form}
      {schedule}
    </Modal>
  )
}

export function PublishPanel(props: PublishPanelProps) {
  return (
    <PublishRoot props={props}>
      <InlinePanel {...props} />
    </PublishRoot>
  )
}

export function PublishModal(props: PublishModalProps) {
  return (
    <PublishRoot props={props}>
      <ModalPanel {...props} />
    </PublishRoot>
  )
}
```

`packages/publish/src/index.ts` 末尾追加：

```ts
export { PublishModal, PublishPanel } from './publish-panel'
export { PublishForm } from './form/publish-form'
export type { PublishFormProps } from './form/publish-form'
export { PublishActions } from './actions'
export type { PublishActionsProps } from './actions'
```

`packages/publish/src/styles.css`（全文替换；数值见「参考几何」）：

```css
/* 内联卡片（12-36-05）为默认值，模态框（12-36-37）在 .ex-pub--modal 上覆盖 */
.ex-pub {
  --ex-pub-label-width: 88px;
  --ex-pub-control-width: 648px;
  --ex-pub-row-gap: 32px;
  --ex-pub-radio-size: 16px;
  --ex-pub-radio-gap: 30px;
  --ex-pub-check: var(--ex-color-pub-check);
  --ex-pub-link: var(--ex-color-pub-link);
  --ex-pub-placeholder: var(--ex-color-pub-placeholder);
  --ex-pub-hint-color: var(--ex-color-pub-hint);
  --ex-pub-hint-size: 12px;
  --ex-pub-upload-border: var(--ex-color-pub-upload-border);
  --ex-pub-upload-icon: var(--ex-color-pub-upload-icon);
  --ex-pub-cover-gap: 16px;
  --ex-pub-summary-height: 108px;
  --ex-pub-extract-width: 120px;
  --ex-pub-extract-height: 32px;
  --ex-pub-select-text: var(--ex-color-pub-label);
  --ex-pub-select-arrow: var(--ex-color-pub-select-arrow);
  --ex-pub-select-placeholder: var(--ex-color-pub-sublabel);
  --ex-pub-declaration-width: 300px;
  --ex-pub-declaration-padding: 0 8px 0 11px;
  --ex-pub-activity-width: 612px;
  --ex-pub-activity-padding: 0 8px 0 11px;
  --ex-pub-agreement-color: var(--ex-color-pub-text);
  color: var(--ex-color-pub-text);
  font-family: var(--ex-font-family);
  font-size: 14px;
}
.ex-pub--modal {
  --ex-pub-label-width: 92px;
  --ex-pub-control-width: 600px;
  --ex-pub-row-gap: 16px;
  --ex-pub-radio-size: 14px;
  --ex-pub-radio-gap: 32px;
  --ex-pub-check: var(--ex-color-pub-check-modal);
  --ex-pub-link: var(--ex-color-pub-link-modal);
  --ex-pub-placeholder: var(--ex-color-pub-placeholder-modal);
  --ex-pub-hint-color: var(--ex-color-pub-hint-modal);
  --ex-pub-hint-size: 14px;
  --ex-pub-upload-border: var(--ex-color-pub-upload-border-modal);
  --ex-pub-upload-icon: var(--ex-color-pub-upload-icon-modal);
  --ex-pub-cover-gap: 20px;
  --ex-pub-summary-height: 58px;
  --ex-pub-extract-width: 121px;
  --ex-pub-extract-height: 30px;
  --ex-pub-select-text: var(--ex-color-pub-select-text-modal);
  --ex-pub-select-arrow: var(--ex-color-pub-select-arrow-modal);
  --ex-pub-select-placeholder: var(--ex-color-pub-placeholder-modal);
  --ex-pub-declaration-width: 200px;
  --ex-pub-declaration-padding: 0 7px 0 12px;
  --ex-pub-activity-width: 532px;
  --ex-pub-activity-padding: 0 6px 0 15px;
  --ex-pub-agreement-color: var(--ex-color-text-secondary);
}

.ex-pub-card {
  box-sizing: border-box;
  width: 816px;
  margin: 0 auto;
  padding: 32px 40px 56px;
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
}
.ex-pub-form { display: flex; flex-direction: column; gap: var(--ex-pub-row-gap); }

.ex-pub-item { display: flex; align-items: flex-start; }
.ex-pub-item__label {
  position: relative;
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 4px;
  width: var(--ex-pub-label-width);
  color: var(--ex-color-pub-label);
  font-size: 14px;
  line-height: 32px;
}
.ex-pub-item__text { order: 0; }
.ex-pub-item__required { order: 1; color: var(--ex-color-error); }
.ex-pub-item__help { order: 2; display: inline-flex; color: var(--ex-color-text-muted); cursor: help; }
.ex-pub-item__suffix { order: 3; }
.ex-pub--modal .ex-pub-item__required { position: absolute; left: -16px; }
.ex-pub--modal .ex-pub-item__help { color: var(--ex-color-pub-label); }
.ex-pub-item__control { flex: none; width: var(--ex-pub-control-width); min-width: 0; }
.ex-pub-item__error { margin-top: 4px; color: var(--ex-color-error); font-size: 12px; line-height: 18px; }
.ex-pub-card [data-field='categories'] { min-height: 34px; }
.ex-pub--modal [data-field='multiPlatform'] { min-height: 33px; }
.ex-pub--modal :is([data-field='declaration'], [data-field='backup']) .ex-pub-item__control { margin-left: -10px; }

.ex-pub-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 32px; }
.ex-pub-hint { display: block; color: var(--ex-pub-hint-color); font-size: var(--ex-pub-hint-size); line-height: 32px; }
.ex-pub-input {
  box-sizing: border-box;
  height: 32px;
  padding: 0 15px;
  border: 1px solid var(--ex-color-pub-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-pub-text);
  font: inherit;
  font-size: 14px;
}
.ex-pub-input::placeholder,
.ex-pub-textarea::placeholder { color: var(--ex-pub-placeholder); }
.ex-pub-input[aria-invalid='true'],
.ex-pub-textarea[aria-invalid='true'] { border-color: var(--ex-color-error); }
.ex-pub-source-url { display: block; width: 100%; margin-top: 8px; }
.ex-pub-link { color: var(--ex-pub-link); text-decoration: none; }
a.ex-pub-link:hover { text-decoration: underline; }

.ex-pub-tag { height: 28px; }
.ex-pub-tag-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  width: 120px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--ex-color-pub-tag-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text-secondary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.ex-pub-tag-add[aria-invalid='true'] { border-color: var(--ex-color-error); }
.ex-pub-tag-popover { box-sizing: border-box; width: 420px; padding: 16px; }
.ex-pub-tag-search { display: flex; flex-direction: column; gap: 8px; }
.ex-pub-tag-search__input { width: 100%; }
.ex-pub-tag-search__meta,
.ex-pub-tag-search__empty { color: var(--ex-color-text-muted); font-size: 12px; }
.ex-pub-tag-search__title { color: var(--ex-color-pub-label); font-size: 12px; }
.ex-pub-tag-search__list { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ex-pub-tag-option {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--ex-color-pub-tag-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ex-pub-tag-option:hover:not(:disabled) { border-color: var(--ex-color-primary); color: var(--ex-color-primary); }
.ex-pub-tag-option.is-selected { border-color: var(--ex-color-primary); color: var(--ex-color-primary); cursor: default; }

.ex-pub-cover__modes { margin-bottom: 8px; }
.ex-pub-cover__row { display: flex; gap: var(--ex-pub-cover-gap); }
.ex-pub-cover__slots { display: flex; flex: none; gap: 8px; }
.ex-pub-cover__slot {
  position: relative;
  box-sizing: border-box;
  width: 160px;
  height: 90px;
  overflow: hidden;
  border: 1px solid var(--ex-pub-upload-border);
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
}
.ex-pub-cover__upload { padding: 0; color: var(--ex-pub-upload-icon); font: inherit; cursor: pointer; }
.ex-pub-cover__upload:disabled { cursor: not-allowed; opacity: 0.6; }
.ex-pub-cover[aria-invalid='true'] .ex-pub-cover__upload { border-color: var(--ex-color-error); }
.ex-pub-plus { position: absolute; top: 27.5px; left: 50%; transform: translate(-50%, -50%); }
.ex-pub-cover__upload-text {
  position: absolute;
  top: 59px;
  right: 0;
  left: 0;
  color: var(--ex-color-pub-upload-text);
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  transform: translateY(-50%);
}
.ex-pub-cover__slot.is-uploading {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ex-color-pub-upload-text);
  font-size: 12px;
}
.ex-pub-cover__img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ex-pub-cover__ops {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px;
  opacity: 0;
  transition: opacity var(--ex-transition);
}
.ex-pub-cover__slot:hover .ex-pub-cover__ops,
.ex-pub-cover__slot:focus-within .ex-pub-cover__ops { opacity: 1; }
.ex-pub-cover__op {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-mask);
  color: var(--ex-color-on-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ex-pub-cover__empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 90px;
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-pub-fill);
  color: var(--ex-color-text-secondary);
  font-size: 12px;
}
.ex-pub-cover__images { display: flex; flex-wrap: wrap; align-self: center; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ex-pub-cover__thumb {
  display: block;
  box-sizing: border-box;
  width: 80px;
  height: 45px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--ex-color-pub-thumb-border);
  border-radius: var(--ex-radius-md);
  background: none;
  cursor: pointer;
}
.ex-pub-cover__thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ex-pub-cover__thumb.is-selected { box-shadow: 0 0 0 2px var(--ex-color-primary); }
.ex-pub-cover__file { display: none; }

.ex-pub-summary__box { position: relative; }
.ex-pub-textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: var(--ex-pub-summary-height);
  padding: 5px 15px;
  border: 1px solid var(--ex-color-pub-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-pub-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}
.ex-pub-summary__count {
  position: absolute;
  right: 10px;
  bottom: 5px;
  color: var(--ex-color-pub-counter);
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
}
.ex-pub-summary__box.is-over .ex-pub-summary__count { color: var(--ex-color-error); }
.ex-pub-summary__extract {
  display: block;
  box-sizing: border-box;
  width: var(--ex-pub-extract-width);
  height: var(--ex-pub-extract-height);
  margin-top: 8px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--ex-color-pub-fill);
  color: var(--ex-color-pub-text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.ex-pub--modal .ex-pub-summary__extract { margin-bottom: 1px; }
.ex-pub-summary__extract:disabled { cursor: not-allowed; opacity: 0.6; }

.ex-pub .ex-radio-group { gap: 0; }
.ex-pub .ex-radio { margin-right: var(--ex-pub-radio-gap); color: var(--ex-color-pub-text); }
.ex-pub .ex-radio:last-child { margin-right: 0; }
.ex-pub .ex-radio__dot { width: var(--ex-pub-radio-size); height: var(--ex-pub-radio-size); border-color: var(--ex-color-pub-border); }
.ex-pub .ex-radio.is-checked .ex-radio__dot { border: 4px solid var(--ex-pub-check); }
.ex-pub--modal .ex-radio.is-checked { color: var(--ex-color-pub-check-modal); }
.ex-pub .ex-radio.is-disabled { color: var(--ex-color-pub-placeholder); opacity: 1; }
.ex-pub .ex-radio.is-disabled .ex-radio__dot { border-color: var(--ex-color-pub-disabled-border); background: var(--ex-color-pub-disabled-bg); }
.ex-pub--modal [data-field='multiPlatform'] .ex-radio { min-width: 75px; }
.ex-pub-verified { width: 13px; height: 15px; margin-left: 9px; color: var(--ex-color-pub-verified); }
.ex-pub .ex-checkbox { color: var(--ex-color-pub-label); }
.ex-pub .ex-checkbox__box { border-color: var(--ex-color-pub-border); }
.ex-pub .ex-checkbox.is-checked .ex-checkbox__box { border-color: var(--ex-pub-check); background: var(--ex-pub-check); }
.ex-pub-categories { gap: 16px; }
.ex-pub-agreement { margin: 0; color: var(--ex-pub-agreement-color); font-size: 14px; line-height: 20px; }

.ex-pub .ex-pub-select { border-color: var(--ex-color-pub-border); color: var(--ex-pub-select-text); }
.ex-pub .ex-pub-select .ex-select__arrow { color: var(--ex-pub-select-arrow); }
.ex-pub .ex-pub-select.is-placeholder .ex-select__value { color: var(--ex-pub-select-placeholder); }
.ex-pub-select--declaration { width: var(--ex-pub-declaration-width); padding: var(--ex-pub-declaration-padding); }
.ex-pub-select--wide { width: var(--ex-pub-activity-width); padding: var(--ex-pub-activity-padding); }
.ex-pub-activity { display: flex; flex-direction: column; gap: 10px; }
.ex-pub-activity__row { display: flex; align-items: center; gap: 8px; }
.ex-pub-activity__sub { flex: none; width: 28px; color: var(--ex-color-pub-sublabel); line-height: 32px; }

.ex-pub-bar {
  position: sticky;
  bottom: 0;
  z-index: 1;
  box-sizing: border-box;
  height: 69px;
  margin-top: 26px;
  padding-bottom: 4px;
  border-top: 1px solid var(--ex-color-pub-bar-border);
  background: var(--ex-color-surface);
}
.ex-pub-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 1080px;
  max-width: 100%;
  height: 100%;
  margin: 0 auto;
}
.ex-pub-bar__start { display: flex; align-items: center; gap: 16px; color: var(--ex-color-text-secondary); font-size: 14px; }
.ex-pub-actions { display: flex; gap: 16px; margin-left: auto; }
.ex-pub-action .ex-btn__label { display: inline-flex; align-items: center; gap: 8px; }
.ex-pub-bar .ex-pub-action {
  height: 40px;
  padding: 0;
  border-color: var(--ex-color-pub-button-border);
  border-radius: 6px;
  color: var(--ex-color-pub-text);
  font-size: 16px;
  font-weight: 600;
}
.ex-pub-bar .ex-pub-action[data-action='draft'],
.ex-pub-bar .ex-pub-action[data-action='schedule'] { width: 116px; }
.ex-pub-bar .ex-pub-action[data-action='publish'] { width: 96px; }
.ex-pub .ex-pub-action.ex-btn--primary { border-color: var(--ex-color-primary); color: var(--ex-color-on-primary); }
.ex-pub-action__caret { flex: none; }
.ex-pub-action__chevron { color: var(--ex-color-pub-chevron); }

.ex-pub-mask { background: var(--ex-color-pub-mask); }
.ex-pub-modal.ex-modal { position: relative; border-radius: 0; }
.ex-pub-modal .ex-modal__header { padding: 20px 28px 0; }
.ex-pub-modal .ex-modal__title { color: var(--ex-color-pub-title); font-size: 18px; font-weight: 700; line-height: 27px; }
.ex-pub-modal .ex-modal__close {
  position: absolute;
  top: 16px;
  right: 24px;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--ex-color-pub-close);
}
.ex-pub-modal .ex-modal__body { padding: 26px 28px 40px; }
.ex-pub-modal .ex-modal__footer {
  box-sizing: border-box;
  height: 64px;
  padding: 12px 34px 12px 28px;
  gap: 16px;
  box-shadow: 0 -4px 8px var(--ex-color-pub-footer-shadow);
}
.ex-pub-modal .ex-pub-action {
  height: 40px;
  padding: 0;
  border-color: var(--ex-color-pub-button-border-modal);
  border-radius: var(--ex-radius-lg);
  color: var(--ex-color-text-secondary);
  font-size: 14px;
}
.ex-pub-modal .ex-pub-action[data-action='cancel'] { width: 70px; }
.ex-pub-modal .ex-pub-action[data-action='draft'] { width: 112px; }
.ex-pub-modal .ex-pub-action[data-action='schedule'] { width: 98px; }
.ex-pub-modal .ex-pub-action[data-action='publish'] { width: 96px; font-weight: 700; }

.ex-pub-schedule__label { display: block; margin-bottom: 8px; color: var(--ex-color-pub-label); }
.ex-pub-schedule__input { width: 100%; }
.ex-pub-schedule__hint { margin: 8px 0 0; color: var(--ex-color-text-muted); font-size: 12px; }
.ex-pub-schedule__error { margin: 8px 0 0; color: var(--ex-color-error); font-size: 12px; }
.ex-pub-crop .ex-modal__body { padding-top: 8px; }
```

- [ ] **Step 4: 运行确认通过**

```powershell
pnpm --filter @editorx/publish test; pnpm --filter @editorx/publish typecheck; pnpm --filter @editorx/publish build; pnpm --filter @editorx/publish exec vitest run src/dist.test.ts
```

预期：全部通过；`dist.test.ts` 两条在 build 之后执行而非跳过。若「组件中用到的每个 ex-pub-* 类名都有样式」报某个类缺样式，确认它是纯结构包裹（加入 `STRUCTURAL`）还是漏写样式（补 CSS）。

- [ ] **Step 5: 提交**

```powershell
git add packages/publish/src/form/publish-form.tsx
git add packages/publish/src/actions.tsx
git add packages/publish/src/schedule-dialog.tsx
git add packages/publish/src/publish-panel.tsx
git add packages/publish/src/publish-panel.test.tsx
git add packages/publish/src/styles.css
git add packages/publish/src/styles.test.ts
git add packages/publish/src/ssr.test.tsx
git add packages/publish/src/dist.test.ts
git add packages/publish/src/index.ts
git commit -m "feat(publish): 发布设置面板与发布弹窗" -m "PublishPanel 渲染 CSDN 内联卡片与底部 sticky 操作栏（保存草稿/定时发布/发布博客），PublishModal 渲染 740 宽发布弹窗（取消/保存为草稿/定时发布/发布文章），两者共用 PublishForm 与发布控制器，弹窗关闭后设置保留、发布成功自动关闭。" -m "定时发布使用 datetime-local 弹窗；校验失败聚焦首个错误字段；主题归属规则与 MarkdownEditor 一致。样式按参考截图实测尺寸以 --ex-pub-* 变量区分两种呈现，颜色只取 --ex-color-pub-* token。"
```

---

### Task 11: playground `/publish` + `/markdown` 接入

**Files:**
- Modify: `apps/playground/package.json`（依赖 `@editorx/publish`）、`pnpm-lock.yaml`
- Modify: `apps/playground/app/layout.tsx`（全局引入 `@editorx/publish/styles.css`）、`apps/playground/app/page.tsx`（首页链接）
- Create: `apps/playground/app/publish/page.tsx`、`publish-playground.tsx`、`publish.css`、`fixture.ts`、`mock-adapters.ts`
- Create: `apps/playground/public/publish/cover-a.svg`、`cover-b.svg`
- Modify: `apps/playground/app/markdown/page.tsx`、`apps/playground/app/markdown/markdown-playground.tsx`

**Interfaces:**
- Consumes：`PublishPanel` / `PublishModal`（Task 10）；`createMockAdapters`（`app/markdown/mock-adapters.ts`，保持不变）；`CSDN_TITLE`（`app/markdown/csdn-sample.ts`）。
- Produces（Task 12–14 依赖的页面契约）：
  - `/publish`：默认内联模式；`?mode=modal` 进入模态模式并默认打开弹窗（页头「打开发布弹窗」可再次打开）；`?missing=hide|disable` 只保留 `searchTags`，其余发布 adapter 全部缺失，并把参数作为 `missingAdapter`；`?categories=1` 时 `getCategories` 返回两个专栏（默认返回空数组，与参考截图一致显示空提示）。
  - 隐藏的 `<ol data-testid="publish-log">`：每次 `onPublish` / `onSaveDraft` 追加一条 `<li data-kind="publish|draft">`，内容是去掉 `markdown` / `html` 后的 payload JSON。
  - 标签含「发布失败」时 `onPublish` 抛错；封面文件名含 `fail` 时 `uploadImage` 抛错。
  - 内联模式正文没有图片（与参考截图一致显示「暂无内容图片」），模态模式正文含 `/publish/cover-a.svg`、`/publish/cover-b.svg` 两张图。
  - 页面布局按参考几何：sticky 页头高 105（含 1px 下边框，下边框位于 y=104），编辑纸面与卡片间距 25，`PublishPanel` 占满内容宽，`slots.barStart` 显示「共 N 字」和「回到顶部」。
  - `/markdown`：「发布文章」打开 `PublishModal`（文档取 `ref.current.getDocument()`），`?publish=1` 首屏自动打开；发布相关 adapter 来自 `/publish` 的 mock，`uploadImage` / `onSaveDraft` 仍用 markdown 的 mock（保存计数不变）。

本任务只有演示页面，没有单元测试；页面行为由 Task 12 的 e2e 覆盖（先建页面再写 e2e，与 3b Task 5/6 的顺序一致）。

- [ ] **Step 1: 加依赖与全局样式**

`apps/playground/package.json` 的 `dependencies` 中，在 `"@editorx/markdown-core": "workspace:*",` 之后插入一行：

```json
    "@editorx/publish": "workspace:*",
```

`apps/playground/app/layout.tsx` 把前两行改为三行（发布面板类名全部以 `ex-pub` 开头，全局引入不影响其他页面）：

```tsx
import '@editorx/theme/styles.css'
import '@editorx/ui/styles.css'
import '@editorx/publish/styles.css'
```

`apps/playground/app/page.tsx` 在 `/markdown` 那一行之后追加：

```tsx
        <li><Link href="/publish">发布设置 /publish</Link></li>
```

运行：

```powershell
pnpm install
```

预期：`pnpm-lock.yaml` 中 `apps/playground` importer 新增 `'@editorx/publish': link:../../packages/publish`。

- [ ] **Step 2: 正文 fixture 与封面图**

`apps/playground/public/publish/cover-a.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#3d7eff"/><circle cx="480" cy="110" r="64" fill="#ffd166"/><path d="M0 360 220 150l140 130 90-80 190 160z" fill="#1f4fbf"/></svg>
```

`apps/playground/public/publish/cover-b.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#fc5531"/><rect x="80" y="80" width="200" height="200" rx="24" fill="#ffffff" opacity="0.85"/><circle cx="460" cy="180" r="90" fill="#7a1f0b"/></svg>
```

`apps/playground/app/publish/fixture.ts`：

```ts
import type { EditorDocument } from '@editorx/toolbar'
import { CSDN_TITLE } from '../markdown/csdn-sample'

export const PARAGRAPHS = [
  '这是一份 Markdown 编辑器使用说明，介绍如何使用标题、列表、代码块、表格、公式和流程图等常用语法。',
  '编辑器支持实时预览与同步滚动，左侧书写、右侧即时渲染，并可通过工具栏快速插入图片、链接和代码片。',
  '文章写完后，在发布设置中补充标签、封面与摘要，选择文章类型和可见范围，即可一键发布或设置定时发布。',
  '摘要会在推荐和列表等场景外露，帮助读者快速了解内容；如果不填写，将默认提取正文前 256 个字作为摘要。',
] as const

const markdown = PARAGRAPHS.join('\n\n')
const html = PARAGRAPHS.map((p) => `<p>${p}</p>`).join('')

/** 内联模式：正文无图片（参考截图 12-36-05 显示「暂无内容图片」） */
export const INLINE_DOC: EditorDocument = { editorType: 'markdown', title: CSDN_TITLE, markdown, html }

/** 模态模式：正文两张图片（参考截图 12-36-37 封面行右侧有缩略图） */
export const MODAL_DOC: EditorDocument = {
  editorType: 'markdown',
  title: CSDN_TITLE,
  markdown: `${markdown}\n\n![封面一](/publish/cover-a.svg)\n\n![封面二](/publish/cover-b.svg)`,
  html: `${html}<p><img src="/publish/cover-a.svg" alt="封面一"></p><p><img src="/publish/cover-b.svg" alt="封面二"></p>`,
}

export const WORD_COUNT = PARAGRAPHS.join('').length
```

- [ ] **Step 3: 发布 mock adapters**

`apps/playground/app/publish/mock-adapters.ts`：

```ts
import type { Category, EditorAdapters, PublishOption } from '@editorx/toolbar'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TAGS = ['React', 'Next.js', 'TypeScript', 'JavaScript', '前端', 'CSS', 'Vite', '性能优化']
const CATEGORIES: Category[] = [
  { id: 'fe', name: '前端开发' },
  { id: 'notes', name: '学习笔记' },
]
const ACTIVITIES: PublishOption[] = [
  { id: 'essay-2026', name: '2026 年度征文' },
  { id: 'summer', name: '开源之夏' },
]
const TOPICS: PublishOption[] = [
  { id: 'ai-coding', name: 'AI 编程' },
  { id: 'fe-eng', name: '前端工程化' },
]

export type PublishLogKind = 'publish' | 'draft'

export type PublishMockAdapters = Required<
  Pick<EditorAdapters, 'onPublish' | 'onSaveDraft' | 'searchTags' | 'getCategories' | 'getActivities' | 'getTopics' | 'uploadImage'>
>

export interface PublishMockOptions {
  /** false 时 getCategories 返回空数组（与参考截图一致） */
  categories: boolean
  onLog(kind: PublishLogKind, data: object): void
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 演示用发布 adapters：标签含「发布失败」时发布失败；文件名含 fail 的封面上传失败 */
export function createPublishAdapters({ categories, onLog }: PublishMockOptions): PublishMockAdapters {
  return {
    async searchTags(keyword) {
      await delay(150)
      const query = keyword.trim().toLowerCase()
      return (query ? TAGS.filter((tag) => tag.toLowerCase().includes(query)) : TAGS).slice(0, 6)
    },
    async getCategories() {
      await delay(100)
      return categories ? CATEGORIES : []
    },
    async getActivities() {
      await delay(100)
      return ACTIVITIES
    },
    async getTopics() {
      await delay(100)
      return TOPICS
    },
    async uploadImage(file) {
      await delay(300)
      if (/fail/i.test(file.name)) throw new Error('模拟上传失败')
      return { url: await readAsDataUrl(file) }
    },
    async onPublish(payload) {
      await delay(300)
      if (payload.tags.includes('发布失败')) throw new Error('模拟发布失败')
      onLog('publish', { ...payload, markdown: undefined, html: undefined })
    },
    async onSaveDraft(doc, settings) {
      await delay(200)
      onLog('draft', { title: doc.title, ...settings })
    },
  }
}
```

- [ ] **Step 4: `/publish` 页面**

`apps/playground/app/publish/page.tsx`：

```tsx
import './publish.css'
import type { MissingAdapterPolicy } from '@editorx/toolbar'
import { PublishPlayground } from './publish-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const POLICIES: readonly MissingAdapterPolicy[] = ['hide', 'disable']
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function PublishPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  return (
    <PublishPlayground
      mode={first(params.mode) === 'modal' ? 'modal' : 'inline'}
      missing={POLICIES.find((p) => p === first(params.missing)) ?? null}
      categories={first(params.categories) === '1'}
    />
  )
}
```

`apps/playground/app/publish/publish-playground.tsx`：

```tsx
'use client'

import { PublishModal, PublishPanel } from '@editorx/publish'
import { ThemeProvider } from '@editorx/theme'
import type { EditorAdapters, MissingAdapterPolicy } from '@editorx/toolbar'
import { Button, ThemeToggle } from '@editorx/ui'
import { useMemo, useState } from 'react'
import { INLINE_DOC, MODAL_DOC, WORD_COUNT } from './fixture'
import { createPublishAdapters, type PublishLogKind } from './mock-adapters'

export interface PublishPlaygroundProps {
  mode: 'inline' | 'modal'
  /** null 为 adapter 齐全 */
  missing: MissingAdapterPolicy | null
  categories: boolean
}

interface LogEntry {
  kind: PublishLogKind
  data: object
}

function Playground({ mode, missing, categories }: PublishPlaygroundProps) {
  const [log, setLog] = useState<LogEntry[]>([])
  const [open, setOpen] = useState(mode === 'modal')
  const adapters = useMemo<EditorAdapters>(() => {
    const all = createPublishAdapters({ categories, onLog: (kind, data) => setLog((list) => [...list, { kind, data }]) })
    return missing ? { searchTags: all.searchTags } : all
  }, [categories, missing])
  const doc = mode === 'modal' ? MODAL_DOC : INLINE_DOC
  const policy = missing ?? 'hide'

  return (
    <div className="pg-pub">
      <header className="pg-pub__header">
        <strong className="pg-pub__brand">EditorX</strong>
        <span className="pg-pub__title">{doc.title}</span>
        <div className="pg-pub__controls">
          {mode === 'modal' && (
            <Button size="sm" onClick={() => setOpen(true)}>
              打开发布弹窗
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <article className="pg-pub__paper">
        <h1>{doc.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
      {mode === 'inline' ? (
        <PublishPanel
          document={doc}
          adapters={adapters}
          missingAdapter={policy}
          slots={{
            barStart: (
              <>
                <span>共 {WORD_COUNT} 字</span>
                <button type="button" className="pg-pub__top" onClick={() => window.scrollTo({ top: 0 })}>
                  回到顶部
                </button>
              </>
            ),
          }}
        />
      ) : (
        <PublishModal open={open} onClose={() => setOpen(false)} document={doc} adapters={adapters} missingAdapter={policy} />
      )}
      <ol data-testid="publish-log" hidden>
        {log.map((entry, index) => (
          <li key={index} data-kind={entry.kind}>
            {JSON.stringify(entry.data)}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function PublishPlayground(props: PublishPlaygroundProps) {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <Playground {...props} />
    </ThemeProvider>
  )
}
```

`apps/playground/app/publish/publish.css`：

```css
.pg-pub {
  min-height: 100vh;
  background: var(--ex-color-bg);
  color: var(--ex-color-text);
  font-family: var(--ex-font-family);
}
.pg-pub__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  height: 105px;
  padding: 0 24px;
  border-bottom: 1px solid var(--ex-color-border);
  background: var(--ex-color-surface);
}
.pg-pub__brand { font-size: 20px; }
.pg-pub__title { color: var(--ex-color-text-secondary); }
.pg-pub__controls { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.pg-pub__paper {
  box-sizing: border-box;
  width: 1080px;
  max-width: 100%;
  min-height: 1200px;
  margin: 0 auto 25px;
  padding: 40px 64px;
  background: var(--ex-color-surface);
  line-height: 1.75;
}
.pg-pub__paper img { width: 240px; height: auto; }
.pg-pub__top {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ex-color-primary);
  font: inherit;
  cursor: pointer;
}
```

几何核对：页面滚到底时文档末尾 = 操作栏底，所以操作栏顶 = 1310 − 69 = 1241、卡片底 = 1241 − 26 = 1215、卡片顶 = 1215 − 998 = 217、纸面底 = 217 − 25 = 192，与参考截图一致；纸面 `min-height: 1200px` 保证页面可滚动（参考截图是滚到底的状态）。

- [ ] **Step 5: `/markdown` 接入 `PublishModal`**

`apps/playground/app/markdown/page.tsx` 在 `autosave={…}` 之后追加一个属性：

```tsx
      publish={first(params.publish) === '1'}
```

`apps/playground/app/markdown/markdown-playground.tsx`：

1. import 区改为（新增 `PublishModal`、`EditorDocument`、`useEffect`、`createPublishAdapters`）：

```tsx
import { MarkdownEditor, type MarkdownEditorHandle, type ViewMode } from '@editorx/markdown'
import { PublishModal } from '@editorx/publish'
import { ThemeProvider } from '@editorx/theme'
import type { EditorAdapters, EditorDocument } from '@editorx/toolbar'
import { Button, ThemeToggle } from '@editorx/ui'
import { ArrowLeftRight, ChevronDown, CircleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from '../markdown-core/sample'
import { createPublishAdapters } from '../publish/mock-adapters'
import { csdnDemoExtensions } from './csdn-demo-extensions'
import { CSDN_SAMPLE, CSDN_TITLE } from './csdn-sample'
import { createMockAdapters } from './mock-adapters'
```

2. `MarkdownPlaygroundProps` 在 `autosave: number` 之后追加：

```ts
  /** 首屏自动打开发布弹窗（/compare 对照 12-36-37 用） */
  publish: boolean
```

3. `Playground` 的参数解构改为 `{ fixture, view, panel, autosave, publish }`，并把 `const adapters = useMemo(…)` 一行替换为：

```tsx
  const [publishDoc, setPublishDoc] = useState<EditorDocument | null>(null)
  const adapters = useMemo<EditorAdapters>(() => {
    const { onPublish, searchTags, getCategories, getActivities, getTopics } = createPublishAdapters({
      categories: false,
      onLog: (kind, data) => console.info(`[publish:${kind}] ${JSON.stringify(data)}`),
    })
    return {
      ...createMockAdapters(() => setSaves((n) => n + 1)),
      onPublish,
      searchTags,
      getCategories,
      getActivities,
      getTopics,
    }
  }, [])
  const openPublish = () => setPublishDoc(ref.current?.getDocument() ?? null)

  useEffect(() => {
    if (publish) setPublishDoc(ref.current?.getDocument() ?? null)
  }, [publish])
```

4. 「发布文章」按钮的 `onClick` 改为 `onClick={openPublish}`。

5. 在 `<div className="pg-mde__frame">…</div>` 之后、外层 `</div>` 之前插入：

```tsx
      <PublishModal
        open={publishDoc !== null}
        onClose={() => setPublishDoc(null)}
        document={publishDoc ?? undefined}
        adapters={adapters}
      />
```

`PublishModal` 常驻挂载：关闭后再次打开时非受控设置保留，发布成功的 toast 在弹窗关闭后仍可见。

- [ ] **Step 6: 构建与手动核对**

```powershell
pnpm build; pnpm --filter @editorx/playground typecheck; pnpm lint
```

预期：全部通过。然后：

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; pnpm --filter @editorx/playground start
```

浏览器逐一打开并核对：

- `http://localhost:3100/publish`：卡片字段顺序与参考截图一致，底部操作栏 sticky，「共 N 字 / 回到顶部」在左。
- `http://localhost:3100/publish?mode=modal`：弹窗自动打开，封面行右侧两张缩略图。
- `http://localhost:3100/publish?missing=disable`：按钮、上传框和活动/话题下拉全部禁用。
- `http://localhost:3100/markdown?fixture=csdn&publish=1`：发布弹窗自动打开；关闭后点「发布文章」重新打开。

核对完 `Ctrl+C` 停止服务。

- [ ] **Step 7: 提交**

```powershell
git add apps/playground/package.json
git add pnpm-lock.yaml
git add apps/playground/app/layout.tsx
git add apps/playground/app/page.tsx
git add apps/playground/app/publish/page.tsx
git add apps/playground/app/publish/publish-playground.tsx
git add apps/playground/app/publish/publish.css
git add apps/playground/app/publish/fixture.ts
git add apps/playground/app/publish/mock-adapters.ts
git add apps/playground/public/publish/cover-a.svg
git add apps/playground/public/publish/cover-b.svg
git add apps/playground/app/markdown/page.tsx
git add apps/playground/app/markdown/markdown-playground.tsx
git commit -m "feat(playground): 发布设置演示页与 Markdown 发布弹窗" -m "新增 /publish：默认内联卡片，?mode=modal 为发布弹窗，?missing=hide|disable 演示缺失 adapter，?categories=1 提供分类专栏；页面布局按参考截图（sticky 页头 105px、纸面与卡片间距 25px），隐藏日志记录 onPublish/onSaveDraft 调用供 e2e 断言。" -m "/markdown 的「发布文章」改为打开 PublishModal，?publish=1 首屏自动打开；发布相关 adapter 复用 /publish 的 mock，上传与保存草稿仍用原 mock。"
```

---

### Task 12: 功能 e2e（`e2e/publish.spec.ts`）

**Files:**
- Create: `apps/playground/e2e/publish.spec.ts`

**Interfaces:**
- Consumes：Task 11 的页面契约（`/publish` 查询参数、`data-testid="publish-log"`、「发布失败」标签、`/markdown?publish=1`、`[publish:<kind>] <json>` 控制台日志）；`PARAGRAPHS`（`app/publish/fixture.ts`）；`CSDN_TITLE`（`app/markdown/csdn-sample.ts`）。
- Produces：无（只有测试）。

用例覆盖：

- 内联：推荐标签与自定义标签、AI提取摘要、转载缺原文链接时校验并聚焦、下拉与单选、发布 payload。
- 未填标签时显示错误并聚焦，补齐后错误消失。
- 发布失败提示；保存草稿（带分类专栏）。
- 定时发布：过去时间报错且弹窗不关，未来时间成功。
- 模态：正文图片选封面、取消后重开设置保留、Esc 只关标签弹层、发布后关闭。
- 本地上传、16:9 裁剪并导出 640×360。
- 缺失 adapter 的 hide / disable。
- `/markdown` 接入与 `?publish=1`。

- [ ] **Step 1: 写测试**

`apps/playground/e2e/publish.spec.ts`：

```ts
import { expect, test, type Page } from '@playwright/test'
import { CSDN_TITLE } from '../app/markdown/csdn-sample'
import { PARAGRAPHS } from '../app/publish/fixture'

const card = (page: Page) => page.getByRole('region', { name: '发布设置' })
const bar = (page: Page) => page.locator('.ex-pub-bar')
const modal = (page: Page) => page.getByRole('dialog', { name: '发布文章' })
const tagButton = (page: Page) => page.getByRole('button', { name: '添加文章标签' })
const fieldError = (page: Page, field: string) => page.locator(`[data-field="${field}"] .ex-pub-item__error`)

async function open(page: Page, query = '') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/publish${query}`)
  await expect(tagButton(page)).toBeVisible()
}

/** 打开标签弹层，逐个输入并回车添加，最后 Esc 关闭弹层 */
async function addTags(page: Page, ...tags: string[]) {
  await tagButton(page).click()
  const search = page.getByRole('searchbox', { name: '搜索标签' })
  for (const tag of tags) {
    await search.fill(tag)
    await search.press('Enter')
  }
  await search.press('Escape')
  await expect(search).toBeHidden()
}

/** 读取 publish-log 中唯一一条指定类型的记录 */
async function logged(page: Page, kind: 'publish' | 'draft') {
  const entries = page.getByTestId('publish-log').locator(`li[data-kind="${kind}"]`)
  await expect(entries).toHaveCount(1)
  return JSON.parse((await entries.first().textContent())!) as Record<string, unknown>
}

async function select(page: Page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox }).click()
  await page.getByRole('option', { name: option }).click()
  await expect(page.getByRole('combobox', { name: combobox })).toContainText(option)
}

test.describe('/publish 内联', () => {
  test('标签、摘要、转载校验、下拉与单选，发布 payload 正确', async ({ page }) => {
    await open(page)

    await tagButton(page).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('rea')
    await page.getByRole('list', { name: '推荐标签' }).getByRole('button', { name: 'React' }).click()
    await search.fill('自定义标签')
    await search.press('Enter')
    await expect(page.getByText('还可添加 5 个标签')).toBeVisible()
    await search.press('Escape')
    await expect(card(page).locator('.ex-pub-tag')).toHaveText(['React', '自定义标签'])

    const summary = page.getByRole('textbox', { name: '文章摘要' })
    await page.getByRole('button', { name: 'AI提取摘要' }).click()
    const extracted = await summary.inputValue()
    expect(extracted.startsWith(PARAGRAPHS[0])).toBe(true)
    expect(extracted.length).toBeLessThanOrEqual(256)
    await expect(card(page).locator('.ex-pub-summary__count')).toHaveText(`${extracted.length} / 256`)

    await page.getByRole('radio', { name: '转载' }).click()
    const sourceUrl = page.getByRole('textbox', { name: '原文链接' })
    await expect(sourceUrl).toBeVisible()
    await bar(page).getByRole('button', { name: '发布博客' }).click()
    await expect(sourceUrl).toBeFocused()
    await expect(sourceUrl).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert')).toContainText('转载或翻译文章请填写原文链接')
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)

    await sourceUrl.fill('https://example.com/post')
    await expect(sourceUrl).not.toHaveAttribute('aria-invalid', 'true')
    await select(page, '创作声明', '部分内容由AI辅助生成')
    await page.getByRole('radio', { name: '粉丝可见' }).click()
    await page.getByRole('checkbox', { name: '同时备份到GitCode' }).click()
    await select(page, '活动', '开源之夏')
    await select(page, '话题', 'AI 编程')

    await bar(page).getByRole('button', { name: '发布博客' }).click()
    await expect(page.getByText('发布成功')).toBeVisible()
    const payload = await logged(page, 'publish')
    expect(payload).toMatchObject({
      editorType: 'markdown',
      title: CSDN_TITLE,
      tags: ['React', '自定义标签'],
      summary: extracted,
      articleType: 'reprint',
      sourceUrl: 'https://example.com/post',
      declaration: 'ai',
      backupToGitCode: true,
      visibility: 'fans',
      activityId: 'summer',
      topicId: 'ai-coding',
      cover: { mode: 'single', urls: [] },
    })
    expect(payload).not.toHaveProperty('scheduledAt')
    expect(payload).not.toHaveProperty('html')
  })

  test('未填标签：错误显示在字段下并聚焦，补齐后错误消失', async ({ page }) => {
    await open(page)
    await bar(page).getByRole('button', { name: '发布博客' }).click()
    await expect(tagButton(page)).toBeFocused()
    await expect(tagButton(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(fieldError(page, 'tags')).toHaveText('请至少添加 1 个文章标签')
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)

    await addTags(page, 'Vite')
    await expect(tagButton(page)).not.toHaveAttribute('aria-invalid', 'true')
    await expect(fieldError(page, 'tags')).toHaveCount(0)
  })

  test('发布失败：错误提示，按钮恢复可用', async ({ page }) => {
    await open(page)
    await addTags(page, '发布失败')
    const publish = bar(page).getByRole('button', { name: '发布博客' })
    await publish.click()
    await expect(page.getByRole('alert')).toContainText('发布失败：模拟发布失败')
    await expect(publish).toBeEnabled()
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)
  })

  test('保存草稿：带分类专栏与当前设置', async ({ page }) => {
    await open(page, '?categories=1')
    await page.getByRole('checkbox', { name: '学习笔记' }).click()
    await addTags(page, 'TypeScript')
    await bar(page).getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByText('草稿已保存')).toBeVisible()
    expect(await logged(page, 'draft')).toMatchObject({
      title: CSDN_TITLE,
      tags: ['TypeScript'],
      categories: ['notes'],
    })
  })

  test('定时发布：过去时间报错且弹窗不关，未来时间发布成功', async ({ page }) => {
    await open(page)
    await addTags(page, 'React')
    await bar(page).getByRole('button', { name: '定时发布', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '定时发布' })
    const input = dialog.getByLabel('发布时间')
    await expect(input).toHaveAttribute('type', 'datetime-local')

    await input.fill('2000-01-01T10:00')
    await dialog.getByRole('button', { name: '确定' }).click()
    await expect(dialog.locator('.ex-pub-schedule__error')).toHaveText('发布时间需晚于当前时间')
    await expect(dialog).toBeVisible()

    await input.fill('2099-01-01T10:00')
    await dialog.getByRole('button', { name: '确定' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('已设置定时发布：2099-01-01 10:00')).toBeVisible()
    const expected = await page.evaluate(() => new Date(2099, 0, 1, 10, 0).toISOString())
    expect(await logged(page, 'publish')).toMatchObject({ scheduledAt: expected })
  })
})

test.describe('/publish 模态', () => {
  test('正文图片选封面；取消后重开设置保留；Esc 只关标签弹层；发布后关闭', async ({ page }) => {
    await open(page, '?mode=modal')
    const dialog = modal(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.ex-modal__footer').getByRole('button')).toHaveText(['取消', '保存为草稿', '定时发布', '发布文章'])
    await expect(dialog.getByText('0/256')).toBeVisible()

    const second = dialog.getByRole('button', { name: '选择正文图片 2 作为封面' })
    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.locator('.ex-pub-cover__img')).toHaveAttribute('src', '/publish/cover-b.svg')
    await dialog.getByRole('radio', { name: '翻译' }).click()

    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: '打开发布弹窗' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('radio', { name: '翻译' })).toBeChecked()
    await expect(dialog.getByRole('button', { name: '选择正文图片 2 作为封面' })).toHaveAttribute('aria-pressed', 'true')

    await tagButton(page).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('React')
    await search.press('Enter')
    await page.keyboard.press('Escape')
    await expect(search).toBeHidden()
    await expect(dialog).toBeVisible()

    await dialog.getByRole('textbox', { name: '原文链接' }).fill('https://example.com/origin')
    await dialog.locator('.ex-modal__footer').getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('发布成功')).toBeVisible()
    expect(await logged(page, 'publish')).toMatchObject({
      tags: ['React'],
      articleType: 'translated',
      sourceUrl: 'https://example.com/origin',
      cover: { mode: 'single', urls: ['/publish/cover-b.svg'] },
    })
  })

  test('本地上传封面：16:9 裁剪后上传，导出 640×360', async ({ page }) => {
    await open(page, '?mode=modal')
    const dialog = modal(page)
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#3d7eff'
      ctx.fillRect(0, 0, 800, 600)
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(200, 150, 400, 300)
      return canvas.toDataURL('image/png').split(',')[1]!
    })
    const chooser = page.waitForEvent('filechooser')
    await dialog.getByRole('button', { name: '从本地上传' }).click()
    await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })

    const crop = page.getByRole('dialog', { name: '裁剪封面' })
    await expect(crop).toBeVisible()
    await crop.getByLabel('裁剪区域，可拖动或用方向键移动').focus()
    await page.keyboard.press('ArrowDown')
    await crop.getByRole('button', { name: '确定' }).click()
    await expect(crop).toBeHidden()
    await expect(dialog).toBeVisible()

    const img = dialog.locator('.ex-pub-cover__img')
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/)
    const size = await img.evaluate(async (el: HTMLImageElement) => {
      await el.decode()
      return [el.naturalWidth, el.naturalHeight]
    })
    expect(size).toEqual([640, 360])
  })
})

test.describe('/publish 缺失 adapter', () => {
  test('hide：不渲染按钮、上传框、分类专栏与活动行；标签仍可添加', async ({ page }) => {
    await open(page, '?missing=hide')
    await expect(bar(page).getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '从本地上传' })).toHaveCount(0)
    await expect(page.locator('[data-field="categories"]')).toHaveCount(0)
    await expect(page.locator('[data-field="activity"]')).toHaveCount(0)
    await addTags(page, 'React')
    await expect(card(page).locator('.ex-pub-tag')).toHaveText(['React'])
  })

  test('disable：按钮、上传框与活动/话题下拉禁用，分类专栏显示空提示', async ({ page }) => {
    await open(page, '?missing=disable')
    for (const name of ['保存草稿', '定时发布', '发布博客']) {
      await expect(bar(page).getByRole('button', { name, exact: true })).toBeDisabled()
    }
    await expect(page.getByRole('button', { name: '从本地上传' })).toBeDisabled()
    await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
    await expect(page.getByRole('combobox', { name: '活动' })).toBeDisabled()
    await expect(page.getByRole('combobox', { name: '话题' })).toBeDisabled()
  })
})

test.describe('/markdown 接入', () => {
  test('「发布文章」打开发布弹窗，以当前文档发布', async ({ page }) => {
    await page.goto('/markdown?fixture=csdn')
    await expect(page.locator('.ex-mde-status__html')).not.toHaveText('HTML 0 字数 0 段落', { timeout: 5000 })
    await page.getByRole('button', { name: '发布文章' }).click()
    const dialog = modal(page)
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'AI提取摘要' }).click()
    await expect(dialog.getByRole('textbox', { name: '文章摘要' })).not.toHaveValue('')
    await addTags(page, 'React')

    const published = page.waitForEvent('console', (msg) => msg.text().startsWith('[publish:publish] '))
    await dialog.locator('.ex-modal__footer').getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('发布成功')).toBeVisible()
    const payload = JSON.parse((await published).text().slice('[publish:publish] '.length)) as Record<string, unknown>
    expect(payload).toMatchObject({ editorType: 'markdown', title: CSDN_TITLE, tags: ['React'] })
    expect(String(payload.summary).length).toBeGreaterThan(0)
  })

  test('?publish=1 首屏自动打开；Esc 关闭后可再次打开', async ({ page }) => {
    await page.goto('/markdown?fixture=csdn&publish=1')
    const dialog = modal(page)
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: '发布文章' }).click()
    await expect(dialog).toBeVisible()
  })
})
```

- [ ] **Step 2: 运行**

```powershell
pnpm build; Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; pnpm --filter @editorx/playground exec playwright test e2e/publish.spec.ts --project chromium
```

预期：11 个用例全部通过。若失败，先确认是测试写错还是组件行为与 Task 10 契约不符：组件问题回到对应包修复，并补一条能复现的单元测试（同一提交）。

再跑既有 e2e，确认 `/markdown` 改动没有破坏 3b 用例：

```powershell
pnpm --filter @editorx/playground exec playwright test e2e/markdown.spec.ts e2e/showcase.spec.ts e2e/markdown-core.spec.ts --project chromium
```

预期：全部通过。

- [ ] **Step 3: 提交**

```powershell
git add apps/playground/e2e/publish.spec.ts
git commit -m "test(playground): 发布设置面板端到端用例" -m "覆盖内联卡片的标签推荐与自定义、AI 提取摘要、转载原文链接校验与聚焦、下拉与单选、发布 payload；未填标签报错、发布失败、保存草稿（含分类专栏）与定时发布（过去时间报错）。" -m "覆盖发布弹窗的正文图片选封面、关闭后设置保留、Esc 只关标签弹层、本地上传 16:9 裁剪导出 640×360；缺失 adapter 的 hide/disable；/markdown 的「发布文章」与 ?publish=1。"
```

---

### Task 13: 视觉基线 + 参考几何对照

**Files:**
- Create: `apps/playground/e2e/publish-visual.spec.ts`
- Create: `apps/playground/e2e/publish-parity.spec.ts`
- Create（生成）: `apps/playground/e2e/publish-visual.spec.ts-snapshots/` 下 7 张 `*-chromium-win32.png`

**Interfaces:**
- Consumes：Task 11 页面；「参考几何」一节的全部数值。
- Produces：基线 `publish-inline-light`、`publish-inline-dark`、`publish-modal-light`、`publish-modal-dark`、`publish-tags-popover-light`、`publish-schedule-light`、`publish-crop-light`。

要点：

- 视觉用例用 `page.clock.setFixedTime` 固定时间：定时发布弹窗的默认值由 `Date.now()` 推算，不固定会让基线每次不同。计时器照常运行，mock adapter 的延迟不受影响。
- 内联基线视口 1440×1310，滚到底后截视口：卡片和 sticky 操作栏完整入镜，与参考截图同一状态。
- 模态基线视口 1440×1000，等两张正文缩略图加载完成再截图。
- parity 用例与 3b 相同：恢复真实滚动条（`ignoreDefaultArgs: ['--hide-scrollbars']`），只在 Windows 上运行。内联用参考截图视口 2554×1310 的绝对坐标；模态框用相对左上角 (M, T) 的坐标，因为参考图 12-36-37 是 2560 宽画面裁切的。

- [ ] **Step 1: 视觉基线用例**

`apps/playground/e2e/publish-visual.spec.ts`：

```ts
import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'win32', 'Windows-only visual baselines')

type Scheme = 'light' | 'dark'

const FIXED_TIME = new Date('2026-10-09T10:00:00')
const INLINE_VIEWPORT = { width: 1440, height: 1310 }
const MODAL_VIEWPORT = { width: 1440, height: 1000 }

async function openInline(page: Page, scheme: Scheme) {
  await page.clock.setFixedTime(FIXED_TIME)
  await page.setViewportSize(INLINE_VIEWPORT)
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto('/publish')
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.mouse.move(0, 0)
}

async function openModal(page: Page, scheme: Scheme) {
  await page.clock.setFixedTime(FIXED_TIME)
  await page.setViewportSize(MODAL_VIEWPORT)
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto('/publish?mode=modal')
  const dialog = page.getByRole('dialog', { name: '发布文章' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(dialog.getByText('您暂时不能添加分类专栏!')).toBeVisible()
  const thumbs = dialog.locator('.ex-pub-cover__thumb img')
  await expect(thumbs).toHaveCount(2)
  for (const img of await thumbs.all()) await expect(img).toHaveJSProperty('complete', true)
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  return dialog
}

for (const scheme of ['light', 'dark'] as const) {
  test(`视觉基线：内联卡片 / ${scheme}`, async ({ page }) => {
    await openInline(page, scheme)
    await expect(page).toHaveScreenshot(`publish-inline-${scheme}.png`)
  })

  test(`视觉基线：发布弹窗 / ${scheme}`, async ({ page }) => {
    await openModal(page, scheme)
    await expect(page).toHaveScreenshot(`publish-modal-${scheme}.png`)
  })
}

test('视觉基线：标签弹层', async ({ page }) => {
  await openInline(page, 'light')
  await page.getByRole('button', { name: '添加文章标签' }).click()
  await expect(page.getByRole('list', { name: '推荐标签' }).getByRole('button')).toHaveCount(6)
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('publish-tags-popover-light.png')
})

test('视觉基线：定时发布弹窗', async ({ page }) => {
  await openInline(page, 'light')
  await page.locator('.ex-pub-bar').getByRole('button', { name: '定时发布', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '定时发布' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('publish-schedule-light.png')
})

test('视觉基线：封面裁剪弹窗', async ({ page }) => {
  const dialog = await openModal(page, 'light')
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3d7eff'
    ctx.fillRect(0, 0, 800, 600)
    ctx.fillStyle = '#ffd166'
    ctx.fillRect(200, 150, 400, 300)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  const chooser = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: '从本地上传' }).click()
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
  const crop = page.getByRole('dialog', { name: '裁剪封面' })
  await expect(crop.getByRole('button', { name: '确定' })).toBeEnabled()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('publish-crop-light.png')
})
```

- [ ] **Step 2: 参考几何对照用例**

`apps/playground/e2e/publish-parity.spec.ts`：

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'

test.skip(process.platform !== 'win32', 'Windows-only geometry')

// 参考图显示常驻滚动条；Playwright 无头模式默认 --hide-scrollbars，这里恢复真实滚动条
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  expect(b, '元素不可见').not.toBeNull()
  return b!
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: 实际 ${actual}，期望 ${expected}±${tolerance}`).toBeLessThanOrEqual(tolerance)
}

const row = (page: Page, field: string) => page.locator(`[data-field="${field}"]`)

/** [字段, 顶 y, 高]：内联为页面绝对坐标，模态为相对模态框顶 T */
const INLINE_ROWS: Array<[field: string, top: number, height: number]> = [
  ['tags', 249, 32],
  ['cover', 313, 90],
  ['summary', 435, 148],
  ['categories', 615, 34],
  ['articleType', 681, 32],
  ['declaration', 745, 32],
  ['backup', 809, 52],
  ['visibility', 893, 32],
  ['template', 957, 32],
  ['multiPlatform', 1021, 32],
  ['activity', 1085, 74],
]

const MODAL_ROWS: Array<[field: string, top: number, height: number]> = [
  ['tags', 73, 32],
  ['cover', 121, 90],
  ['summary', 227, 97],
  ['categories', 340, 32],
  ['articleType', 388, 32],
  ['declaration', 436, 32],
  ['backup', 484, 52],
  ['visibility', 552, 32],
  ['template', 600, 32],
  ['multiPlatform', 648, 33],
  ['activity', 697, 74],
]

async function dotsX(page: Page, field: string) {
  const dots = row(page, field).locator('.ex-radio__dot')
  return Promise.all((await dots.all()).map(async (dot) => (await box(dot)).x))
}

test.describe('内联卡片（12-36-05，2554×1310，滚到底）', () => {
  test.use({ viewport: { width: 2554, height: 1310 } })

  test('卡片、各行、控件与底部操作栏位置', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish')
    await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.clientWidth), '常驻滚动条 15px').toBe(2539)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect
      .poll(() => page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight))
      .toBe(true)

    near((await box(page.locator('.pg-pub__header'))).height, 105, 0.5, '页头高（下边框 y=104）')
    const paper = await box(page.locator('.pg-pub__paper'))
    near(paper.y + paper.height, 192, 1, '纸面底')

    const card = await box(page.locator('.ex-pub-card'))
    near(card.x, 861.5, 1, 'card.x')
    near(card.y, 217, 1, 'card.y')
    near(card.width, 816, 0.5, 'card.width')
    near(card.height, 998, 2, 'card.height')
    const L = card.x

    for (const [field, top, height] of INLINE_ROWS) {
      const r = await box(row(page, field))
      near(r.y, top, 1, `${field}.y`)
      near(r.height, height, 2, `${field}.height`)
    }

    const label = await box(row(page, 'tags').locator('.ex-pub-item__label'))
    near(label.x, L + 40, 1, '标签列 x')
    near(label.width, 88, 1, '标签列宽')
    const control = await box(row(page, 'tags').locator('.ex-pub-item__control'))
    near(control.x, L + 128, 1, '控件列 x')
    near(control.width, 648, 1, '控件列宽')

    const add = await box(page.locator('.ex-pub-tag-add'))
    near(add.y, 251, 1, '添加标签 y')
    near(add.width, 120, 1, '添加标签宽')
    near(add.height, 28, 0.5, '添加标签高')

    const upload = await box(page.locator('.ex-pub-cover__upload'))
    near(upload.x, L + 128, 1, '上传框 x')
    near(upload.width, 160, 0.5, '上传框宽')
    near(upload.height, 90, 0.5, '上传框高')
    const empty = await box(page.locator('.ex-pub-cover__empty'))
    near(empty.x, L + 304, 1, '无图提示 x')
    near(empty.width, 472, 1, '无图提示宽')

    const textarea = await box(row(page, 'summary').locator('textarea'))
    near(textarea.width, 648, 0.5, '摘要框宽')
    near(textarea.height, 108, 0.5, '摘要框高')
    const extract = await box(page.locator('.ex-pub-summary__extract'))
    near(extract.y, 551, 1, 'AI提取摘要 y')
    near(extract.width, 120, 1, 'AI提取摘要宽')
    near(extract.height, 32, 0.5, 'AI提取摘要高')

    const expectDots = async (field: string, offsets: number[]) => {
      const xs = await dotsX(page, field)
      expect(xs).toHaveLength(offsets.length)
      xs.forEach((x, i) => near(x, L + offsets[i]!, 2, `${field} 单选${i}.x`))
    }
    await expectDots('articleType', [128, 231, 313])
    await expectDots('visibility', [128, 238, 348, 458])
    await expectDots('multiPlatform', [128, 196])

    const declaration = await box(row(page, 'declaration').locator('.ex-select'))
    near(declaration.x, L + 128, 1, '创作声明 x')
    near(declaration.width, 300, 0.5, '创作声明宽')
    near(declaration.height, 32, 0.5, '创作声明高')

    near((await box(row(page, 'backup').locator('.ex-checkbox__box'))).y, 818, 1, '复选框 y')

    const selects = row(page, 'activity').locator('.ex-select')
    const activity = await box(selects.nth(0))
    const topic = await box(selects.nth(1))
    near(activity.x, L + 164, 1, '活动 x')
    near(activity.width, 612, 1, '活动宽')
    near(activity.y, 1085, 1, '活动 y')
    near(topic.y, 1127, 1, '话题 y')

    const bar = await box(page.locator('.ex-pub-bar'))
    near(bar.y, 1241, 1, '操作栏顶')
    near(bar.height, 69, 0.5, '操作栏高')
    const actions: Array<[action: string, offset: number, width: number]> = [
      ['draft', 588, 116],
      ['schedule', 720, 116],
      ['publish', 852, 96],
    ]
    for (const [action, offset, width] of actions) {
      const b = await box(page.locator(`.ex-pub-bar [data-action="${action}"]`))
      near(b.x, L + offset, 1, `${action}.x`)
      near(b.width, width, 1, `${action}.width`)
      near(b.y, 1254, 1, `${action}.y`)
      near(b.height, 40, 0.5, `${action}.height`)
    }
  })
})

test.describe('发布弹窗（12-36-37，2554×1312）', () => {
  test.use({ viewport: { width: 2554, height: 1312 } })

  test('模态框尺寸、各行、控件与 footer 按钮位置', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish?mode=modal')
    const dialog = page.getByRole('dialog', { name: '发布文章' })
    await expect(dialog.getByText('您暂时不能添加分类专栏!')).toBeVisible()
    await expect(dialog.locator('.ex-pub-cover__thumb')).toHaveCount(2)
    await page.evaluate(() => document.fonts.ready)

    await expect(page.locator('.ex-pub-mask')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.19)')
    const d = await box(dialog)
    near(d.width, 740, 0.5, '模态框宽')
    near(d.height, 875, 1, '模态框高')
    near(d.y, 218.5, 2, '模态框 y')
    await expect(dialog).toHaveCSS('border-radius', '0px')
    const M = d.x
    const T = d.y

    near((await box(dialog.locator('.ex-modal__title'))).x, M + 28, 1, '标题 x')
    const close = await box(dialog.locator('.ex-modal__close'))
    near(close.x + close.width / 2, M + 704, 1, '关闭按钮中心 x')
    near(close.y + close.height / 2, T + 28, 1, '关闭按钮中心 y')

    for (const [field, top, height] of MODAL_ROWS) {
      const r = await box(row(page, field))
      near(r.y - T, top, 1, `${field}.top`)
      near(r.height, height, 2, `${field}.height`)
    }

    near((await box(row(page, 'tags').locator('.ex-pub-item__label'))).x, M + 28, 1, '标签列 x')
    const control = await box(row(page, 'tags').locator('.ex-pub-item__control'))
    near(control.x, M + 120, 1, '控件列 x')
    near(control.width, 600, 1, '控件列宽')

    const upload = await box(dialog.locator('.ex-pub-cover__upload'))
    near(upload.x, M + 120, 1, '上传框 x')
    near(upload.width, 160, 0.5, '上传框宽')
    const thumb = await box(dialog.locator('.ex-pub-cover__thumb').first())
    near(thumb.x, M + 300, 1, '缩略图 x')
    near(thumb.y, T + 144, 1, '缩略图 y')
    near(thumb.width, 80, 0.5, '缩略图宽')
    near(thumb.height, 45, 0.5, '缩略图高')

    const textarea = await box(row(page, 'summary').locator('textarea'))
    near(textarea.width, 600, 0.5, '摘要框宽')
    near(textarea.height, 58, 0.5, '摘要框高')

    const declaration = await box(row(page, 'declaration').locator('.ex-select'))
    near(declaration.x, M + 110, 1, '创作声明 x')
    near(declaration.width, 200, 0.5, '创作声明宽')

    const selects = row(page, 'activity').locator('.ex-select')
    const activity = await box(selects.nth(0))
    near(activity.x, M + 156, 1, '活动 x')
    near(activity.width, 532, 1, '活动宽')
    near((await box(selects.nth(1))).y - T, 739, 1, '话题 top')

    const footer = await box(dialog.locator('.ex-modal__footer'))
    near(footer.y - T, 811, 1, 'footer top')
    near(footer.height, 64, 0.5, 'footer 高')
    const actions: Array<[action: string, offset: number, width: number]> = [
      ['cancel', 282, 70],
      ['draft', 368, 112],
      ['schedule', 496, 98],
      ['publish', 610, 96],
    ]
    for (const [action, offset, width] of actions) {
      const b = await box(dialog.locator(`.ex-modal__footer [data-action="${action}"]`))
      near(b.x, M + offset, 1, `${action}.x`)
      near(b.width, width, 1, `${action}.width`)
      near(b.height, 40, 0.5, `${action}.height`)
    }
  })
})
```

- [ ] **Step 3: 先跑 parity（不生成基线）**

```powershell
pnpm build; Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; pnpm --filter @editorx/playground exec playwright test e2e/publish-parity.spec.ts --project chromium
```

预期：2 个用例通过。若某项超出容差，回到 `packages/publish/src/styles.css`（或 `apps/playground/app/publish/publish.css` 的页面布局）修正尺寸，**不要放宽容差**；修正后重跑 `pnpm --filter @editorx/publish test` 与本命令。

- [ ] **Step 4: 生成视觉基线并复核**

只对 `publish-visual.spec.ts` 使用 `--update-snapshots`：

```powershell
pnpm --filter @editorx/playground exec playwright test e2e/publish-visual.spec.ts --project chromium --update-snapshots
```

预期：生成 7 张 PNG。用图片查看工具逐张打开 `apps/playground/e2e/publish-visual.spec.ts-snapshots/` 下的文件，与 `public/reference/screenshot_2026-10-09_12-36-05.png`、`12-36-37.png` 对比字段顺序、文案、颜色与间距；深色两张检查没有浅色残留（白底卡片、白色操作栏）。

稳定性复核（不带 `--update-snapshots`，每个用例跑两遍）：

```powershell
pnpm --filter @editorx/playground exec playwright test e2e/publish-visual.spec.ts e2e/publish-parity.spec.ts --project chromium --repeat-each 2
```

预期：18 次全部通过（视觉 7 + parity 2，各两遍）。

确认既有基线没变：

```powershell
git status --short apps/playground/e2e
```

预期：只有 `publish-visual.spec.ts`、`publish-parity.spec.ts` 和 `publish-visual.spec.ts-snapshots/` 下 7 个新文件；`showcase-*`、`markdown-core-*`、`markdown-*` 基线没有出现在列表中。

- [ ] **Step 5: 提交**

```powershell
git add apps/playground/e2e/publish-visual.spec.ts
git add apps/playground/e2e/publish-parity.spec.ts
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-inline-light-chromium-win32.png
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-inline-dark-chromium-win32.png
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-modal-light-chromium-win32.png
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-modal-dark-chromium-win32.png
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-tags-popover-light-chromium-win32.png
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-schedule-light-chromium-win32.png
git add apps/playground/e2e/publish-visual.spec.ts-snapshots/publish-crop-light-chromium-win32.png
git commit -m "test(playground): 发布面板视觉基线与参考几何对照" -m "新增 7 张 Windows 视觉基线：内联卡片与发布弹窗的浅色/深色，以及标签弹层、定时发布弹窗、封面裁剪弹窗；固定时钟保证定时发布默认时间稳定。" -m "parity 用例恢复真实滚动条，按参考截图 12-36-05 校验内联卡片各行、控件与 sticky 操作栏的绝对坐标，按 12-36-37 校验发布弹窗尺寸、各行、缩略图与 footer 按钮相对模态框左上角的坐标。"
```

---

### Task 14: 全量验证 + `/compare` 核对 + phase 5 交接笔记

**Files:**
- Create: `.superpowers/phase5-notes-from-4.md`（`.superpowers/` 在 `.git/info/exclude` 中，**不提交**）
- 其他文件只在发现问题时修改，每个修复单独提交。

- [ ] **Step 1: 全量构建、单测、类型检查、lint**

```powershell
pnpm build; pnpm test; pnpm typecheck; pnpm lint
```

预期：
- 全部成功；
- `packages/publish/src/dist.test.ts`：`dist/index.js` 首行为 `'use client';`，`dist/styles.css` 存在；
- `packages/theme/src/styles.test.ts`：36 个新 token 在主块与三个兜底块中一致；
- 无新增 exhaustive-deps 警告。

- [ ] **Step 2: 全量 e2e，再单独跑性能**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @editorx/playground exec playwright test --project chromium
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @editorx/playground exec playwright test --project chromium-perf --no-deps
```

预期：
- `chromium`：所有 spec 通过（showcase、compare、markdown-core、markdown、markdown-visual、markdown-parity、publish、publish-visual、publish-parity），截图无差异；
- `chromium-perf`：4 个 `@perf` 通过。`/markdown` 现在常驻挂载一个关闭的 `PublishModal`，在 Step 4 的笔记中记录 annotation 数值，并与 3b 笔记中的数值对比（应在同一量级）。

- [ ] **Step 3: `/compare` 人工核对**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @editorx/playground start
```

把浏览器窗口内容区调到 2554×1310（或缩放到同等 CSS 像素），用「叠加」模式、50% 透明度逐一打开：

- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-36-05.png&target=%2Fpublish`（先把 iframe 滚到底，与参考截图状态一致）
- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-36-37.png&target=%2Fpublish%3Fmode%3Dmodal`（参考图是 2560 宽画面裁切，模态框水平位置会整体偏移，只看相对位置）
- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-36-37.png&target=%2Fmarkdown%3Ffixture%3Dcsdn%26publish%3D1`

核对清单（偏差写入 Step 4 的笔记，不阻塞）：
- [ ] 卡片、各行、操作栏边缘重合（±2px）；
- [ ] 标签列文字、帮助图标、必填星号的位置与颜色；
- [ ] 上传框、无图提示、摘要框与计数、AI提取摘要按钮；
- [ ] 单选/复选框/下拉的尺寸、颜色与选中态；「原创」后的绿色盾牌；
- [ ] 操作栏按钮文字、三角与箭头；模态框标题、关闭按钮、footer 阴影与按钮。

完成后 `Ctrl+C` 停止服务。

- [ ] **Step 4: 写 phase 5 交接笔记（不提交）**

`.superpowers/phase5-notes-from-4.md`：

```markdown
# Notes for phase 5 from phase 4 (binding unless superseded)

Phase 4 HEAD: <填写 git rev-parse --short HEAD>.

## 可直接复用的 API
- `@editorx/publish`：<PublishPanel />（内联卡片 + sticky 操作栏，slots.barStart）与 <PublishModal open onClose />（740 宽）。
  共用 props：value/defaultValue/onChange、document、adapters、missingAdapter、rules、coverModes、templates、
  agreementLinks、onPublished、locale、theme/defaultTheme/onThemeChange/themeStorageKey、className。
  只依赖 theme/ui/toolbar，可直接接到 <RichTextEditor /> 宿主（传 editorType: 'richtext' 的 EditorDocument）。
- 纯函数：createSettings / validatePublish / PublishRules（函数替换、false 关闭）/ extractSummary / extractImages /
  htmlToText / toLocalInputValue / fromLocalInputValue。extractImages 跳过 ex-uploading:// 占位，富文本 HTML 同样适用。
- `@editorx/ui` 新组件：RadioGroup、Checkbox、Select（button + listbox）、ImageCropper + cropImage（16:9 等任意比例）、
  Modal maskClassName。富文本的图片/视频/链接对话框可直接复用。
- `@editorx/toolbar`：EditorAdapters 新增 getActivities / getTopics，onSaveDraft(doc, settings?)；zhCN.publish 文案桶。
- 主题 token：--ex-color-on-primary（主色按钮文字），--ex-color-pub-*（35 个，仅发布面板使用）。

## 性能实测（chromium-perf，/markdown，挂载关闭的 PublishModal 之后）
- burst / paused / lines median、p95：<填写 annotation>
- 顶部插入标题长任务：<填写>

## 遗留与已知差距
- 封面模式切换（单图/三图/无封面）默认隐藏，coverModes 传多项才显示；CSDN 截图中没有该控件。
- 创作声明选项、帮助提示、GitCode 协议文案与链接、原文链接输入框、定时发布弹窗都没有参考截图，是推断的。
- 「保存草稿 ▾」的三角没有菜单；「AI提取摘要」只做本地前 256 字提取，未接 aiAssist（phase 7 的 AI 扩展可替换）。
- 标题校验（5–100 字）在发布面板内完成；phase 6 的 <CsdnEditor /> 若自己校验标题，可传 rules={{ title: false }}。
- /markdown 现在有两个 ToastProvider（编辑器与发布弹窗），多编辑器页面的 toast 合并仍是 3a 遗留项。
- 深色 token 是自定值，深色基线只保证稳定，没有参考。
- /compare 核对记录：<填写>
```

把 `<填写 …>` 换成 Step 2–3 的实际结果。这个文件不提交（`.superpowers/` 在 `.git/info/exclude` 中）。

- [ ] **Step 5: 工作区检查**

```powershell
git status --short
```

预期：工作区干净（`.superpowers/` 被排除，不会出现）；没有误提交的 `dist/`、`.next/`、`test-results/`、`playwright-report/`。

如果 Step 1–3 中有修复，每个修复单独提交：

```powershell
git add <修复的文件，逐个>
git commit -m "fix(<scope>): <修复内容>" -m "<原因与影响>"
```

---

## 假设与风险（执行前确认）

1. **`onSaveDraft` 签名扩展**：spec §5.1 是 `onSaveDraft(doc)`，无法带上发布设置。本计划改为 `onSaveDraft(doc, settings?)`，第二个参数可选，`MarkdownEditor` 的自动保存仍只传 `doc`，所以向后兼容。
2. **新增 adapter**：「参与活动 / 话题」两个下拉需要数据源，spec §5.1 没有对应 adapter，本计划新增 `getActivities` / `getTopics`。缺失时按 §7 策略隐藏或禁用。
3. **标题校验在面板内**：spec §6.4 把标题放在 `<CsdnEditor />` 里，但发布前必须校验标题。本计划在 `validatePublish` 中加入 `title` 规则（5–100 字，读 `document.title`），宿主可用 `rules={{ title: false }}` 关闭。
4. **主按钮文案**：参考截图内联卡片的主按钮是「发布博客」，spec 写的是「发布文章」。本计划内联用 `publishInline`（发布博客），模态用 `publish`（发布文章），都可通过 `locale` 覆盖。
5. **封面模式**：spec §6.3 的 `cover.mode`（single / triple / none）在 CSDN 截图中不可见。类型保留，默认 `coverModes = ['single']` 不渲染切换；传入多项时显示单选。
6. **推断内容**：
   - 创作声明四个选项的文案；
   - 帮助图标的提示文字；
   - GitCode 协议文案与链接（`agreementLinks` 不传时渲染为纯文本）；
   - 转载/翻译时出现的原文链接输入框的样式；
   - 定时发布弹窗（原生 `datetime-local`，没有参考截图）。
7. **几何**：
   - 模态框圆角 0、遮罩 `rgba(0,0,0,0.19)` 是实测值，与 ui 默认 Modal 不同，通过 `.ex-pub-modal` / `.ex-pub-mask` 覆盖；
   - 模态框 x 坐标只能相对断言（参考图是裁切的）；模态的单选 x 偏移不做断言；
   - 操作栏是 `position: sticky`，不是 fixed，只有在页面滚到底时与参考截图重合；
   - 像素尺寸写在 `packages/publish/src/styles.css`（3b 先例），颜色只在 token 中。
8. **必填星号位置**：内联在标签文字后（参考截图），模态在标签左侧（绝对定位 left −16）。同一个 DOM，CSS `order` 与定位区分。
9. **空分类专栏提示**：内联与模态文案不同（「专栏已达到上限…」/「您暂时不能添加分类专栏!」），分别取自两张截图。
10. **深色主题**：CSDN 没有深色发布面板，`--ex-color-pub-*` 的暗色值是自定的。
11. **/markdown 示例没有图片**，所以从 `/markdown` 打开的发布弹窗显示「暂无内容图片」。`/publish?mode=modal` 使用带两张图片的 fixture，覆盖缩略图选封面。
12. **几何依赖字体**：标签宽度、单选文字宽度取决于 Windows 上的 Microsoft YaHei，parity 与视觉基线只在 Windows 上运行。

## Open questions / defaults chosen

| 问题 | 默认选择 |
| --- | --- |
| 封面模式切换是否显示 | 隐藏（`coverModes` 默认 `['single']`） |
| 创作声明选项 | 无声明 / 部分内容由AI辅助生成 / 内容来源网络，进行整合/再创作 / 个人观点，仅供参考 |
| 帮助图标提示文字 | 自拟，见 `zhCN.publish.help` |
| GitCode 协议链接 | 默认无链接（纯文本），宿主经 `agreementLinks` 传入 |
| 原文链接输入框 | 选「转载 / 翻译」后在文章类型行下方出现，宽 648（模态 600），必填且需 http(s) |
| 定时发布 UI | 400 宽小弹窗 + 原生 `datetime-local`，默认值为当前时间一小时后按 `schedule.ts` 的步长向上取整 |
| 「保存草稿 ▾」三角 | 只是装饰，没有菜单 |
| 「AI提取摘要」 | 本地提取正文前 256 字，不调用 `aiAssist` |
| 主按钮与草稿按钮文案 | 内联「发布博客」「保存草稿」，模态「发布文章」「保存为草稿」 |
| 模态框圆角 / 遮罩 | 0 / `rgba(0,0,0,0.19)`（实测） |
| 空分类专栏提示 | 内联、模态各用截图原文 |
| 深色配色 | 自定 |
| 操作栏定位 | sticky bottom，不是 fixed |
| 标题校验位置 | 发布面板内，5–100 字，可用 `rules.title = false` 关闭 |
| 模态单选 x 偏移 | 不断言，只断言行的 y 与高 |

## Spec 冲突

1. §5.1 `onSaveDraft(doc)` 无法携带发布设置 → 扩展为 `onSaveDraft(doc, settings?)`（可选参数，兼容）。
2. §5.1 没有「参与活动 / 话题」的数据源 → 新增 `getActivities`、`getTopics`。
3. §6.3 的 `cover.mode`（三种封面模式）在 CSDN 参考截图中不可见 → 保留类型，默认不渲染切换。
4. §6.3 的字段列表缺少截图中的创作声明、文章备份、文章模板、多平台发布、参与活动/话题 → 全部加入 `PublishSettings`。
5. §6.4 把标题放在 `<CsdnEditor />`，但发布校验需要标题 → 面板内校验，可关闭。
6. 参考索引中内联主按钮为「发布博客」，spec 写「发布文章」→ 两个文案键并存，按呈现方式选择。

## Self-Review

- **Spec 覆盖**：
  - §6.3 字段：标签（Task 8）、封面（Task 9，含 `cover.mode`）、摘要（Task 8）、分类专栏（Task 8）、文章类型与原文链接（Task 8）、可见范围（Task 8）、定时发布（Task 10 ScheduleDialog + Task 6 `schedule.ts`）。
  - CSDN 额外字段：创作声明、文章备份、文章模板、多平台发布、参与活动/话题 —— Task 1 类型与文案，Task 8 字段组件。
  - 两种呈现：内联 `PublishPanel` 与模态 `PublishModal` —— Task 10；关闭后设置保留、发布成功自动关闭 —— Task 10 用例。
  - 受控/非受控 —— Task 7 控制器与 Task 10 用例；可配置校验规则 —— Task 6 `PublishRules` 与 Task 7 用例。
  - §6.5 i18n：全部文案来自 `zhCN.publish`（Task 1），`locale` 覆盖用例在 Task 10。
  - §6.6 主题：主题归属规则与 `MarkdownEditor` 一致（Task 10），颜色只在 token 中（Task 2，Task 3/10 的 styles 测试守护）。
  - §7 缺失 adapter：Global Constraints 中的表格，`adapter-state.ts`（Task 6），Task 10 单测与 Task 12 e2e。
  - §8 视觉回归 0.1%：Task 13 的 7 张基线与 parity。§9 发布表单校验单测：Task 6 `logic.test.ts`、Task 7 `controller.test.tsx`。
  - playground `/publish` 与 `/markdown` 接入 —— Task 11；e2e —— Task 12；全量验证与交接笔记 —— Task 14。
- **占位符扫描**：所有步骤都给出了完整代码、精确的修改片段和命令。仅有两处尖括号占位是有意的：Task 14 笔记模板里的 `<填写 …>`（执行时填入实测数据，步骤中已要求替换），以及 Task 14 Step 5 中「如有修复」的提交模板。
- **类型一致性**：
  - `PublishSettings` / `PublishOption` / `CoverMode` 等在 Task 1 定义，被 Task 6–11 使用；`EditorAdapters.getActivities` / `getTopics` / `onSaveDraft(doc, settings?)` 在 Task 1 加入，被 Task 7 控制器与 Task 11 mock 使用。
  - `PublishField`、`FIELD_ORDER`、`RuleContext`、`PublishRules`（Task 6）被 Task 7 的 `ERROR_FIELD` 映射与 Task 10 的聚焦逻辑使用。
  - `PublishBaseProps` / `PublishPanelProps` / `PublishModalProps`（Task 8 `types.ts`）与 Task 10 实现、Task 11 页面的用法一致（`slots.barStart`、`open` / `onClose`、`missingAdapter`、`document`）。
  - `data-field`、`data-action`、`.ex-pub-*` 类名在 Task 8–10 组件中定义，Task 10 `styles.test.ts` 保证每个类都有样式，Task 12–13 的 e2e 与 parity 只使用这些类名和属性。
  - Task 11 的 `PublishMockAdapters` 是 `Required<Pick<EditorAdapters, …>>`，因此 `/markdown` 解构出的方法签名与 `EditorAdapters` 一致。
