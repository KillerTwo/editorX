# Reference alignment (phase 3/4 corrections from owner macOS screenshots) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按业主 2026-10-10 提供的 macOS 2× 截图（`apps/playground/public/reference/mac_2026-10-10_19-*.png`，原图 `docs/images/截屏2026-10-10 *.png`）修正阶段 3（`<MarkdownEditor />` + `/markdown`）与阶段 4（`<PublishPanel />` / `<PublishModal />` + `/publish`）的样式、文案与行为，使 darwin 几何断言与视觉基线以 mac 参考图为准。

**Architecture:** 生产者 → 消费者顺序：theme（token / 字体）→ markdown-core（计数、同步滚动 API）→ toolbar（文案、类型）→ ui（Select 气泡箭头、Tag 变体、DatePicker / TimePicker）→ markdown → publish → playground → e2e。各包通过 `dist` 互相消费，下游测试前必须先构建上游（见 Global Constraints）。

**Tech Stack:** pnpm + turbo；tsup（`'use client'` banner）；React 19 / Next 16（playground 端口 3100，`pnpm start` 跑预构建产物）；原生 CSS（`.ex-` 前缀、`--ex-*` 变量、`light-dark()`）；Vitest 5（pool forks）+ Testing Library + user-event；Playwright 1.64；floating-ui。

**Spec / 依据（按优先级）:**
1. `.superpowers/sdd/2026-10-10-reference-alignment/progress.md`（业主裁定，约束力最高）
2. `audit-A-markdown.md`（G01–G32）、`audit-B-publish.md`（B01–B37）、`audit-C-richtext-spec.md`（仅 §bar 两项在范围内）、`platform-addendum.md`
3. 设计文档 `docs/superpowers/specs/2026-10-09-csdn-editor-design.md`；阶段 4 计划 `docs/superpowers/plans/2026-10-09-phase4-publish-panel.md`

**不在本计划范围（明确排除）：**
- AI 助手面板内容（G22）——阶段 7。
- CSDN 顶栏内容（G20 标题「【无标题】」/计数、G21 logo / 返回按钮 / 标题样式）——阶段 6。
- 「反馈」悬浮页签（G25）——阶段 6。
- Audit C 其余全部内容——阶段 5。Audit C 只做两项：① PublishPanel 底部操作栏固定在视口底部（`barPosition="fixed"`，Task 14/16）；② 宿主 `barStart` 中「发文设置 / 回到顶部」样式为 **#1a1a1a 粗体 + 细 ^ 箭头，不是红色**（宿主内容，Task 16）。

---

## Global Constraints

### 依赖与构建
- 包依赖方向（只允许向左依赖）：`theme` ← `ui` ← `toolbar` ← {`markdown`, `publish`}；`markdown-core` 无内部依赖，只被 `markdown` 使用；`apps/playground` 依赖全部包。禁止反向或横向依赖（`markdown` ↔ `publish` 互不引用）。
- 包之间通过 `dist` 消费：改了上游包后，跑下游测试前先 `pnpm --filter <上游> build`（或 `pnpm build`）。任务内给出的命令已按此排序。
- 不 `pnpm install` / `playwright install`；本计划不新增任何依赖。
- 包 CSS 改动后、跑 e2e 之前必须 `pnpm build --force`（playground 用预构建的 Next 产物，turbo 缓存可能给出旧产物）。

### macOS 命令（zsh）
- 每个新 shell：`export COREPACK_INTEGRITY_KEYS=0`。
- 跑 Playwright 前杀端口：`lsof -ti tcp:3100 | xargs kill -9 2>/dev/null`。
- e2e：`pnpm --filter @editorx/playground exec playwright test --project=chromium [spec]`（包名用全称 `@editorx/playground`）。
- 每条命令检查退出码（`echo $?`），失败即停。

### 提交
- 中文 Conventional Commits，必须带正文（为什么 + 影响）；只 `git add <明确路径>`，不用 `git add .` / `-A`。
- 分支 `develop`，不 push / merge。

### 测试
- 组件测试一律在 `<StrictMode>` 下渲染：ui 用 `render(<StrictMode>…</StrictMode>)`（或 `renderWithTheme` 包 StrictMode）；publish 用 `renderWithProviders`（已含 StrictMode + ThemeProvider）；markdown 用 `renderEditor`（已含 StrictMode、`defaultTheme light`、`themeStorageKey false`）。
- `eslint-plugin-react-hooks` v7：effect 内不同步 `setState`；用派生状态，只在 Promise 回调里 `setState`。

### 颜色与字体
- 包 CSS 与 playground CSS 中**颜色只用 token**（`var(--ex-color-*)`），不写色值；新增 token 必须同时写入 `packages/theme/src/styles.css` 的 `light-dark()` 主块与全部 3 个 `@supports not (color: light-dark(#000, #fff))` 回退块（亮 / 暗 / `@media (prefers-color-scheme: dark)` 内的 system），并加入 `packages/theme/src/styles.test.ts` 的 token 列表。
- 字体 token 只放在主 `.ex-root` 块；主题级字体 token 不能用 `--ex-pub-` 前缀（publish 测试要求每个 `--ex-pub-*` 在 publish 自己的 CSS 中定义）。
- 暗色值为自定（参考图只有亮色），每个新增 token 的暗色值标注「inferred default」。

### 平台与基线
- darwin 几何以 mac 参考图为准（约束性）。win32 只修正截图裁切造成的偏差（顶栏 56、四周 16px 内边距），其余 win32 期望值保持不变（将变陈旧的列在 Task 18/19）。
- 视觉基线：只在 darwin 上重生成，`--update-snapshots` 每次只针对一个 spec 文件，之后不带 update 再连跑两遍必须全绿；**永不新建、修改或删除 win32 PNG**。

### 参考几何（darwin，CSS px，DSF 2；图内坐标 ÷2）

**Markdown（1728×932，参考 19-12-09 / 12-19 / 12-27 / 12-39 / 12-48）** —— 每张图的页面原点偏移（设备像素）：12-09 (−10, +2)、12-19 (−6, +2)、12-27 (−10, +4)、12-39 (−4, 0)、12-48 (0, +2)。正文内容已替换为 `test`。

| 元素 | 值 | 依据 |
|---|---|---|
| 顶栏 | 高 56，无下边框 | G01 |
| 卡片 `.ex-mde-main` | (16, 72, 1218, 844) | G01/G02 |
| 页签 x / 宽 / y | 28 / 155.5 / 241.5；115.5 / 74 / 74；y 84，高 32 | G05 |
| 工具栏底边 | 172；分隔线 1×17，y 143.5..160.5，`#d9d9d9` | G13 |
| 正文左内边距 | 101（卡片宽 1218） | G03 |
| 首行文字顶 | 工具栏底边下 11px 的 padding（四种视图一致） | G04 |
| 状态栏 | 顶 852，高 64（含 1px 上边框），左内边距 26.5 | G06/G09 |
| 保存草稿 / 发布文章 | 草稿 x 990 宽 114 高 ≈41（卡片底 −52.5..−11.5）；发布 x 1120 宽 98 高 ≈43（−53.5..−10.5）；两者中心 = 卡片底 −32；圆角 6 | G07 |
| 额度提示 | 320×38（卡片底 −51..−13，中心 −32），图标 18 在 +13，文字墨迹起点 +39.5 | G06/G08/G32 |
| 右侧面板 | x 1250，宽 390 | — |
| 面板拖柄 | x 1240..1244，y 510..534（相对面板 −10..−6 / 438..462） | G23 |
| 图标栏 | x 1656，宽 56；分隔线 y 135；AI 项 144..195；目录 199..250（项距 55） | G10 |
| NEW 角标 | x 1686..1708，y 310..321（相对图标栏 30..52 / 238..249） | G12 |
| 比对同步按钮 | x 617（预览区左 + 5）；定位 y 801..817；同步滚动墨迹 830.5..845.5 | G24 |
| 目录空状态 | 无标题条；「暂无目录」行框顶 ≈ 面板顶 + 49；第二行 ≈ +86 | G19/G26 |

**发布弹窗（1714×932，R-1431 / R-0804 / R-0901）**：模态框 740×868 位于 (487, 32)。R-1431 视口从图内 y 4 开始、body scrollTop 5；R-0804 顶部裁掉 3 CSS px、scrollTop 5；R-0901 页面原点在图内 (−6, +2)、scrollTop 0。

| 行（相对模态框顶，scrollTop 0） | 顶 / 高 |
|---|---|
| tags | 73 / 32 |
| cover | 121 / 90 |
| summary | 227 / 95（textarea 589×57） |
| categories | 338 / 32 |
| articleType | 386 / 32 |
| declaration | 434 / 32 |
| backup | 482 / 52 |
| visibility | 550 / 32 |
| template | 598 / 32 |
| multiPlatform | 646 / 32 |
| activity | 694 / 74（话题子行 736） |
| footer 顶 | 804 |

控件列 x 120（相对模态框）宽 589（止于 709，B01）；活动下拉 x 156 宽 521（右缘 677，B12）；标签 chip 60×28 在 x 120，添加按钮 x 192（B10）；帮助图标 x 90（B05）；必填星号中心 y ≈ 76.5（B06）。

**内联发布（1705×932，R-1337，overlay 滚动条）**：卡片在 (444.5, 156.5)，视口从图内 y 8 开始；行相对卡片顶 = Windows 绝对值 − 217；单选点 → 文字间距 8（label.x − dot.x = 24）；操作栏贴视口底。

---

## Review Focus

审查者重点核对以下高风险点，每项都对应拥有它的任务中的测试：

1. **定时发布区间边界 × 时区 / 夏令时**（Task 10）：`now + 4h` 与 `now + 7d` 均为闭区间，±1 ms 越界报错；`America/New_York` 下跨春令时（2026-03-08 02:00–02:59 不存在）与秋令时（2026-11-01 01:30 两次出现）时，`scheduleTimeSlots` 不产生不存在的时刻、`combineLocal` 对不存在的时刻返回 `undefined`；最大值按绝对毫秒（`now + 7×24h`）计算，跨 DST 时本地时刻会偏 1 小时（测试锁定该行为）。测试：`schedule.test.ts`、`schedule-dst.test.ts`、`logic.test.ts`。
2. **DatePicker 的 min / max**（Task 5、11）：越界日期 `disabled`；键盘移动焦点夹在 [min, max]；PageUp/PageDown 跨月后焦点日期越界时夹回；打开时焦点日 = clamp(value ?? today)；跨年翻页按钮在完全越界时禁用。测试：`date-picker.test.tsx`、`schedule-dialog.test.tsx`。
3. **标签面板**（Task 12）：`getTagCategories` 返回 0 个分类 → 回退「推荐」（`searchTags('')`）；adapter 抛错 → toast 一次 + 回退；两者都缺 → 只有输入框；7 个上限时面板关闭、添加按钮消失；输入法组合中的 Enter（`isComposing` / `keyCode 229`）不添加。测试：`tag-picker.test.tsx`、`fields.test.tsx`。
3a. **Esc 分层**（Task 5 `InlineLayer`、Task 12）：标签面板登记为浮层树子节点（`useDismiss` `bubbles.escapeKey: false`），PublishModal 内按 Esc 只关面板、不关弹窗。不能靠 React `stopPropagation`——Next 下 React 根在 `document`，与 floating-ui 的 document 监听同层，阻止不了。测试：`inline-layer.test.tsx`、`fields.test.tsx`（真实 `Modal`）、e2e `publish.spec.ts`「弹窗内浮层」用例与 Task 18 darwin 弹窗用例。
3b. **定时发布确认按钮常亮**（Task 11，controller 裁定）：未选日期 / 时间或越界时点击不提交，提示行变为错误色并 `role="alert"`；输入框边框 / 禁用 / 占位与图标颜色只在 `.ex-pub-schedule` 下用 publish token 覆盖，ui 默认值不变。测试：`schedule-dialog.test.tsx`、`publish-panel.test.tsx`、publish `styles.test.ts`、e2e `publish.spec.ts`。
3c. **每个任务的「全量测试通过」**：Task 3 改文案后同步改 publish 既有用例（`确定` → `定时发布`、计数去空格），Task 10 临时默认值 now+5h 并改 `2099-01-01T10:00` 那条用例的期望；Task 14 只改 publish-parity 的操作栏高断言、不在本任务跑该 spec（验证在 Task 18 Step 5）；其余任务的验证步骤不得依赖后续任务修复。
4. **`barPosition="fixed"` 遮挡页面内容**（Task 14、18）：固定栏下方必须有等高占位（26 + 68），滚到底时卡片最后一行底边 + 26 ≤ 操作栏顶。测试：`publish-panel.test.tsx`（结构）、`publish-parity.spec.ts` darwin 内联用例（几何）。
5. **状态栏计数**（Task 6）：CRLF（运行时规范化为 LF，计数与 LF 相同）、空文档（2 行，0 字）、末尾换行（不额外 +1）。测试：`stats-counter.test.ts`、`status-bar.test.tsx`。
6. 同步滚动暂停期间 `refresh()` 不移动任一侧、恢复时从最后滚动的一侧对齐（Task 2）。
7. 新 token 是否四个块都写了、暗色值是否都标注 inferred（Task 1）。

---

## File Structure

```text
packages/theme/src/
  styles.css                      修改：新增 mde / pub / tag / quota token、--ex-font-family-helvetica
  styles.test.ts                  修改：新增 token 期望
packages/markdown-core/src/
  utils/count.ts                  修改：HtmlCount.chars
  utils/utils.test.ts, index.test.ts 修改：countHtml 期望含 chars
  scroll-sync/scroll-sync.ts      修改：syncFrom / setPaused
  scroll-sync/scroll-sync.test.ts 修改：新用例
packages/toolbar/src/
  messages.ts                     修改：panels / editor / publish.tags / publish.schedule / errors 文案
  types.ts                        修改：TagCategory、getTagCategories / getTagsByCategory
  index.ts                        修改：导出 TagCategory
  messages.test.tsx, publish-types.test.ts 修改：文案 / 类型断言
packages/ui/src/
  select.tsx, select.test.tsx     修改：offset / popperArrow / prefix / showArrow、气泡箭头结构
  tag.tsx, tag.test.tsx           修改：variant
  calendar.ts, calendar.test.ts   新建：日期纯函数
  date-picker.tsx, date-picker.test.tsx  新建
  time-picker.tsx, time-picker.test.tsx  新建
  inline-layer.tsx, inline-layer.test.tsx  新建：正常流中的浮层树子节点（Esc 只关最内层）
  styles.css, index.ts            修改
packages/markdown/src/
  pipeline/stats-counter.ts(.test.ts)    修改：mdChars / htmlChars / 行数规则
  status-bar.tsx(.test.tsx)              修改：分组 span、计数
  mode-tabs.tsx                          修改：自绘页签图标（Task 7）
  icons.tsx                              新建：页签 / 工具栏 / 图标栏 / 同步按钮自绘 SVG
  core-extensions/format.tsx, insert.tsx 修改：删除线图标、图片/链接描边
  panels/toc-panel.tsx                   修改：空状态
  panels/side-rail.tsx                   修改：自绘图标、toggle 类名、data-panel
  panels/panel-grip.tsx(.test.tsx)       新建：面板宽度拖柄
  panels/panel-host.tsx                  修改：id
  panels/panels.test.tsx                 修改
  sync-controls.tsx(.test.tsx)           新建：比对模式定位 / 同步滚动按钮
  runtime.ts                             修改：locate / setSyncEnabled
  markdown-editor.tsx                    修改：拖柄、同步按钮、面板宽度变量
  styles.css, styles.test.ts             修改
packages/publish/src/
  schedule.ts                     修改：区间常量与工具函数，删除 defaultScheduleTime
  schedule.test.ts                新建；schedule-dst.test.ts 新建
  validate.ts                     修改：scheduleRange、tooSoon / tooLate
  logic.test.ts, controller.test.tsx 修改
  use-publish-controller.ts       修改：scheduleRange 选项
  schedule-dialog.tsx(.test.tsx)  重写 / 新建
  form/tag-picker.tsx(.test.tsx)  新建
  form/tag-field.tsx              修改：改用 TagPicker、primary chip
  form/fields.test.tsx            修改
  form/form-item.tsx, icons.tsx   修改：帮助图标、PlusIcon className
  form/publish-form.tsx, option-fields.tsx  修改：Select 新属性、标签分类 adapter
  publish-panel.tsx(.test.tsx)    修改：scheduleRange、barPosition
  types.ts, index.ts              修改
  styles.css, styles.test.ts      修改
apps/playground/
  app/quota-notice.tsx, app/quota-notice.css   新建：共享额度提示
  app/markdown/markdown-playground.tsx, markdown.css, csdn-demo-extensions.tsx  修改
  app/publish/publish-playground.tsx, publish.css, mock-adapters.ts             修改
  e2e/markdown.spec.ts, publish.spec.ts        修改
  e2e/markdown-parity.spec.ts, publish-parity.spec.ts  修改：按平台拆分
  e2e/publish-visual.spec.ts                   修改
  e2e/reference-acceptance.spec.ts             新建
  e2e/*-snapshots/*-darwin.png                 重生成（只 darwin）
docs/superpowers/handoff/
  RESUME.md, reference-index.md, phase5-notes-from-4.md  修改
```

## Tasks

| # | 标题 | 包 | 依赖 |
|---|---|---|---|
| 1 | theme：新增颜色 token 与 Helvetica 字体栈 | theme | — |
| 2 | markdown-core：`countHtml().chars` 与 ScrollSync 暂停 / 定位 | markdown-core | — |
| 3 | toolbar：文案修正与标签分类 adapter 类型 | toolbar | 1 |
| 4 | ui：Select 气泡箭头 / 前缀 / 偏移，Tag primary 变体 | ui | 1 |
| 5 | ui：calendar 工具函数、DatePicker、TimePicker、InlineLayer | ui | 4 |
| 6 | markdown：状态栏计数规则与分组布局 | markdown | 2, 3 |
| 7 | markdown：外壳几何（内容内边距、页签、工具栏分隔线、图标） | markdown | 1, 6 |
| 8 | markdown：目录空状态、图标栏节奏与图标、面板宽度拖柄 | markdown | 3, 7 |
| 9 | markdown：比对模式「定位 / 同步滚动」按钮 | markdown | 2, 3, 8 |
| 10 | publish：定时发布时间区间逻辑与校验规则 | publish | 3 |
| 11 | publish：定时发布弹窗（日期 + 时间选择器） | publish | 5, 10 |
| 12 | publish：标签面板 TagPicker 与 primary 标签 | publish | 3, 4, 5 |
| 13 | publish：弹窗 / 内联表单样式（B01–B19、B35、B36、字体） | publish | 1, 4, 12 |
| 14 | publish：`barPosition` 固定底栏 | publish | 13 |
| 15 | playground /markdown：外框、额度提示、按钮、图标、角标 | playground | 6–9 |
| 16 | playground /publish：固定底栏、barStart、标签分类 mock | playground | 11–15 |
| 17 | e2e 功能用例更新 | playground | 15, 16 |
| 18 | parity 规格按平台拆分（darwin 用 mac 参考值） | playground | 17 |
| 19 | darwin 视觉基线重生成与陈旧 win32 基线清单 | playground | 18 |
| 20 | 最终验证、参考图比对验收、交接文档 | 全部 | 19 |

---

### Task 1: theme：新增颜色 token 与 Helvetica 字体栈

**Files:**
- Modify: `packages/theme/src/styles.css`
- Modify: `packages/theme/src/styles.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（CSS 自定义属性，亮 / 暗；暗色全部为 inferred default）：

```ts
// --ex-color-mde-*（G13/G14/G17/G19/G23/G24/G07/G31）
'--ex-color-mde-toolbar-divider'  // #d9d9d9 / #3a3b41
'--ex-color-mde-rail-label'       // #999999 / #7d7e8a
'--ex-color-mde-rail-ai-label'    // #9a9a9a / #7d7e8a（G14：未激活的「AI」标签单独实测为 #9a9a9a）
'--ex-color-mde-badge'            // #d9011c / #e5323f
'--ex-color-mde-toc-empty'        // #616266 / #9a9ba6
'--ex-color-mde-toc-empty-link'   // #277dcc / #5aa0ff
'--ex-color-mde-grip'             // #cccccc / #4a4b52
'--ex-color-mde-sync-locate'      // #9f9f9f / #7d7e8a
'--ex-color-mde-sync-scroll'      // #555666 / #b8b9c4
'--ex-color-mde-draft-bg'         // #f2f2f2 / #2a2b30
'--ex-color-mde-ai-from'          // #6660ff / #8580ff
'--ex-color-mde-ai-to'            // #bc7bf7 / #c993fa
// 宿主额度提示（G15/B37）
'--ex-color-quota-border'         // #ffd9ca / #5c3326
'--ex-color-quota-bg'             // #fff6f0 / #2e211c
// --ex-color-tag-primary-*（B09）
'--ex-color-tag-primary-bg'       // #f4f8fc / #1d2a38
'--ex-color-tag-primary-border'   // #cee0f4 / #2b4058
'--ex-color-tag-primary-text'     // #277dcc / #6cb6ea
'--ex-color-tag-primary-close'    // #3585cf / #6cb6ea
// --ex-color-pub-* 新增（B01/B13/B16/B17/B19/B30/B31/B33、§3.2/§3.3）
'--ex-color-pub-select-border-modal' // #e0e0e0 / #4c4d4f
'--ex-color-pub-option-selected'     // #409eff / #409eff
'--ex-color-pub-dropdown-border'     // #e4e7ed / #363637
'--ex-color-pub-dropdown-shadow'     // rgba(0, 0, 0, 0.1) / rgba(0, 0, 0, 0.5)
'--ex-color-pub-scrollbar-thumb'     // #cfcfcf / #4a4b52
'--ex-color-pub-schedule-mask'       // rgba(0, 0, 0, 0.5) / rgba(0, 0, 0, 0.7)
'--ex-color-pub-dialog-text'         // #222226 / #e8e8ed
'--ex-color-pub-dialog-close'        // #909399 / #8d9095
'--ex-color-pub-picker-border'       // #e2e2e2 / #3a3b41
'--ex-color-pub-picker-title'        // #404040 / #dcdde3
// --ex-color-pub-* 修改（B12）
'--ex-color-pub-select-arrow'        // #bec0c5 → #a9abb3（暗色不变 #6c6e72）
'--ex-color-pub-select-arrow-modal'  // #cdd0d7 → #c0c4cc（暗色不变 #6c6e72）
// 字体（B04；只在主 .ex-root 块）
'--ex-font-family-helvetica' // 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif
```

既有 token 复用（不新增）：必填星号 = `--ex-color-primary`（B07）；帮助图标 = `--ex-color-pub-label`（B08）；输入框图标 / 占位 = `--ex-color-pub-placeholder-modal`；禁用 = `--ex-color-pub-disabled-bg` / `-border`；剩余标签数 = `--ex-color-pub-hint`（B23）；面板 × = `--ex-color-pub-close`。

- [ ] **Step 1: 写失败测试**

在 `packages/theme/src/styles.test.ts` 中：`MDE_TOKENS` 末尾追加 12 个新 mde token 名；`PUB_TOKENS` 中把 `--ex-color-pub-select-arrow` 改为 `['--ex-color-pub-select-arrow', '#a9abb3', '#6c6e72']`、`--ex-color-pub-select-arrow-modal` 改为 `['--ex-color-pub-select-arrow-modal', '#c0c4cc', '#6c6e72']`，并在末尾追加：

```ts
  ['--ex-color-pub-select-border-modal', '#e0e0e0', '#4c4d4f'],
  ['--ex-color-pub-option-selected', '#409eff', '#409eff'],
  ['--ex-color-pub-dropdown-border', '#e4e7ed', '#363637'],
  ['--ex-color-pub-dropdown-shadow', 'rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.5)'],
  ['--ex-color-pub-scrollbar-thumb', '#cfcfcf', '#4a4b52'],
  ['--ex-color-pub-schedule-mask', 'rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.7)'],
  ['--ex-color-pub-dialog-text', '#222226', '#e8e8ed'],
  ['--ex-color-pub-dialog-close', '#909399', '#8d9095'],
  ['--ex-color-pub-picker-border', '#e2e2e2', '#3a3b41'],
  ['--ex-color-pub-picker-title', '#404040', '#dcdde3'],
```

文件末尾追加：

```ts
const MDE_NEW: Array<[name: string, light: string, dark: string]> = [
  ['--ex-color-mde-toolbar-divider', '#d9d9d9', '#3a3b41'],
  ['--ex-color-mde-rail-label', '#999999', '#7d7e8a'],
  ['--ex-color-mde-rail-ai-label', '#9a9a9a', '#7d7e8a'],
  ['--ex-color-mde-badge', '#d9011c', '#e5323f'],
  ['--ex-color-mde-toc-empty', '#616266', '#9a9ba6'],
  ['--ex-color-mde-toc-empty-link', '#277dcc', '#5aa0ff'],
  ['--ex-color-mde-grip', '#cccccc', '#4a4b52'],
  ['--ex-color-mde-sync-locate', '#9f9f9f', '#7d7e8a'],
  ['--ex-color-mde-sync-scroll', '#555666', '#b8b9c4'],
  ['--ex-color-mde-draft-bg', '#f2f2f2', '#2a2b30'],
  ['--ex-color-mde-ai-from', '#6660ff', '#8580ff'],
  ['--ex-color-mde-ai-to', '#bc7bf7', '#c993fa'],
  ['--ex-color-quota-border', '#ffd9ca', '#5c3326'],
  ['--ex-color-quota-bg', '#fff6f0', '#2e211c'],
  ['--ex-color-tag-primary-bg', '#f4f8fc', '#1d2a38'],
  ['--ex-color-tag-primary-border', '#cee0f4', '#2b4058'],
  ['--ex-color-tag-primary-text', '#277dcc', '#6cb6ea'],
  ['--ex-color-tag-primary-close', '#3585cf', '#6cb6ea'],
]

describe('参考图对齐新增 token（mac 参考图实测亮色；暗色为推断值）', () => {
  it.each(MDE_NEW)('%s 亮色 %s / 暗色 %s', (name, light, dark) => {
    expect(expected.get(name)).toEqual([light, dark])
  })

  it('Helvetica 字体栈只定义在主 .ex-root 块', () => {
    expect(mainCss).toContain(
      "--ex-font-family-helvetica: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;",
    )
    expect(fallbackCss).not.toContain('--ex-font-family-helvetica')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `export COREPACK_INTEGRITY_KEYS=0; pnpm --filter @editorx/theme test`
Expected: FAIL（新 token 未定义；select-arrow 亮色不符）。

- [ ] **Step 3: 实现**

`packages/theme/src/styles.css`：
1. 主块：把 `--ex-color-pub-select-arrow` 改为 `light-dark(#a9abb3, #6c6e72)`、`--ex-color-pub-select-arrow-modal` 改为 `light-dark(#c0c4cc, #6c6e72)`；在 `--ex-color-pub-footer-shadow` 之后、`--ex-font-family` 之前插入：

```css
  /* 参考图对齐（mac 2026-10-10）：亮色为截图实测，暗色为推断值 */
  --ex-color-mde-toolbar-divider: light-dark(#d9d9d9, #3a3b41);
  --ex-color-mde-rail-label: light-dark(#999999, #7d7e8a);
  --ex-color-mde-rail-ai-label: light-dark(#9a9a9a, #7d7e8a);
  --ex-color-mde-badge: light-dark(#d9011c, #e5323f);
  --ex-color-mde-toc-empty: light-dark(#616266, #9a9ba6);
  --ex-color-mde-toc-empty-link: light-dark(#277dcc, #5aa0ff);
  --ex-color-mde-grip: light-dark(#cccccc, #4a4b52);
  --ex-color-mde-sync-locate: light-dark(#9f9f9f, #7d7e8a);
  --ex-color-mde-sync-scroll: light-dark(#555666, #b8b9c4);
  --ex-color-mde-draft-bg: light-dark(#f2f2f2, #2a2b30);
  --ex-color-mde-ai-from: light-dark(#6660ff, #8580ff);
  --ex-color-mde-ai-to: light-dark(#bc7bf7, #c993fa);
  --ex-color-quota-border: light-dark(#ffd9ca, #5c3326);
  --ex-color-quota-bg: light-dark(#fff6f0, #2e211c);
  --ex-color-tag-primary-bg: light-dark(#f4f8fc, #1d2a38);
  --ex-color-tag-primary-border: light-dark(#cee0f4, #2b4058);
  --ex-color-tag-primary-text: light-dark(#277dcc, #6cb6ea);
  --ex-color-tag-primary-close: light-dark(#3585cf, #6cb6ea);
  --ex-color-pub-select-border-modal: light-dark(#e0e0e0, #4c4d4f);
  --ex-color-pub-option-selected: light-dark(#409eff, #409eff);
  --ex-color-pub-dropdown-border: light-dark(#e4e7ed, #363637);
  --ex-color-pub-dropdown-shadow: light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.5));
  --ex-color-pub-scrollbar-thumb: light-dark(#cfcfcf, #4a4b52);
  --ex-color-pub-schedule-mask: light-dark(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7));
  --ex-color-pub-dialog-text: light-dark(#222226, #e8e8ed);
  --ex-color-pub-dialog-close: light-dark(#909399, #8d9095);
  --ex-color-pub-picker-border: light-dark(#e2e2e2, #3a3b41);
  --ex-color-pub-picker-title: light-dark(#404040, #dcdde3);
```

   并在 `--ex-font-family-mono` 之后插入：

```css
  /* 发布面板（CSDN Element 栈）：西文与数字走 Helvetica Neue（B04） */
  --ex-font-family-helvetica: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
```

2. 三个 `@supports not` 回退块：亮色块（`.ex-root,\n  .ex-root[data-ex-theme='light']`）写同名 token 的亮色值，暗色块与 `@media (prefers-color-scheme: dark)` 内 system 块写暗色值；select-arrow 两个 token 的亮色值同步改为 `#a9abb3` / `#c0c4cc`。三块插入位置都放在各自 `--ex-color-pub-footer-shadow` 之后，缩进与所在块一致。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @editorx/theme test && pnpm --filter @editorx/theme build`
Expected: PASS（92 + 新增用例）；回退块一致性用例自动覆盖新 token。

- [ ] **Step 5: 提交**

```bash
git add packages/theme/src/styles.css packages/theme/src/styles.test.ts
git commit -m "feat(theme): 新增参考图对齐所需的颜色 token 与 Helvetica 字体栈" -m "按 2026-10-10 mac 参考图实测补充 Markdown 外壳、标签、额度提示、发布面板下拉/定时弹窗的颜色 token，四个主题块同步定义；暗色值为推断。下拉箭头颜色按 B12 修正。"
```

---

### Task 2: markdown-core：`countHtml().chars` 与 ScrollSync 暂停 / 定位

**Files:**
- Modify: `packages/markdown-core/src/utils/count.ts`
- Modify: `packages/markdown-core/src/utils/utils.test.ts`（第 7–42 行 `countHtml` 期望）、`packages/markdown-core/src/index.test.ts:35`
- Modify: `packages/markdown-core/src/scroll-sync/scroll-sync.ts`
- Modify: `packages/markdown-core/src/scroll-sync/scroll-sync.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:

```ts
export interface HtmlCount {
  words: number
  /** 渲染文本中的非空白字符数（码点），G18「HTML n 字数」 */
  chars: number
  paragraphs: number
}

export interface ScrollSync {
  destroy(): void
  /** 暂停时只重新测量，不对齐 */
  refresh(): void
  /** 立即以 source 为基准对齐另一侧（暂停时也生效）；destroy 后为空操作 */
  syncFrom(source: ScrollSide): void
  /** 暂停 / 恢复同步滚动；恢复时从最后滚动的一侧重新对齐；destroy 后为空操作 */
  setPaused(paused: boolean): void
}
```

- [ ] **Step 1: 写失败测试（计数）**

`packages/markdown-core/src/utils/utils.test.ts` 的 `describe('countHtml')` 中期望改为含 `chars`（渲染文本去掉空白后的码点数）：

| 位置 | 新期望 |
|---|---|
| `it.each` 第 1 行 `''` | `{ words: 0, chars: 0, paragraphs: 0 }` |
| 第 2 行（标题 / 你好 world / a） | `{ words: 6, chars: 10, paragraphs: 3 }` |
| 第 3 行（abc / def） | `{ words: 2, chars: 6, paragraphs: 2 }` |
| 第 4 行（引用 / x = 1） | `{ words: 4, chars: 5, paragraphs: 3 }` |
| 第 5 行（表格 1 / 2） | `{ words: 2, chars: 2, paragraphs: 1 }` |
| 第 6 行（只有 div + script/style） | `{ words: 3, chars: 5, paragraphs: 0 }` |
| KaTeX `$x$`（第 21 行） | 改为 `toMatchObject({ words: 1, paragraphs: 1 })`（KaTeX HTML 结构不在本任务锁定范围） |
| 渲染文档（第 26 行） | `{ words: 10, chars: 13, paragraphs: 4 }` |
| TOC / 脚注（第 34 行） | `{ words: 9, chars: 12, paragraphs: 5 }` |
| 第 38–40 行 | `{ words: 1, chars: 6, … }`、`{ words: 1, chars: 3, … }`、`{ words: 4, chars: 4, … }`（paragraphs 不变） |

并追加：

```ts
  it('chars：渲染文本的非空白字符数，忽略脚注引用与目录', () => {
    expect(countHtml('<p>test</p>').chars).toBe(4)
    expect(countHtml('<p>中文 ab</p><ul><li>c d</li></ul>').chars).toBe(6)
    expect(countHtml('<p>a<sup class="footnote-ref">1</sup></p><div class="ex-toc"><a>目录</a></div>').chars).toBe(1)
  })
```

`index.test.ts:35` 改为 `expect(api.countHtml(result.html)).toEqual({ words: 4, chars: 4, paragraphs: 2 })`。

- [ ] **Step 2: 写失败测试（同步滚动）**

`scroll-sync.test.ts` 的 `describe('createScrollSync')` 内追加：

```ts
  it('setPaused(true)：滚动不再同步；syncFrom 立即对齐；恢复时从最后滚动的一侧对齐', () => {
    const { editor, preview, sync } = setup()
    sync.setPaused(true)
    scrollTo(editor, 50)
    vi.advanceTimersByTime(20)
    expect(preview.scrollTop).toBe(0)
    sync.syncFrom('editor')
    expect(preview.scrollTop).toBe(150)
    vi.advanceTimersByTime(60)
    scrollTo(editor, 20)
    vi.advanceTimersByTime(20)
    expect(preview.scrollTop).toBe(150)
    sync.setPaused(false)
    expect(preview.scrollTop).toBe(60)
  })

  it('暂停时 refresh 只重新测量，不移动任一侧', () => {
    const { editor, preview, engine, sync } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(60)
    expect(preview.scrollTop).toBe(150)
    sync.setPaused(true)
    editor.scrollTop = 0
    const calls = vi.mocked(engine.getSectionOffsets).mock.calls.length
    sync.refresh()
    expect(vi.mocked(engine.getSectionOffsets).mock.calls.length).toBe(calls + 1)
    expect(preview.scrollTop).toBe(150)
    expect(editor.scrollTop).toBe(0)
  })

  it('暂停时 ResizeObserver 回调不对齐', () => {
    const observers = stubResizeObserver()
    const { editor, preview, sync } = setup()
    sync.setPaused(true)
    editor.scrollTop = 50
    observers[0]!.cb()
    vi.advanceTimersByTime(20)
    expect(preview.scrollTop).toBe(0)
  })

  it('destroy 后 syncFrom / setPaused 为空操作', () => {
    const { editor, preview, sync } = setup()
    sync.destroy()
    editor.scrollTop = 50
    sync.syncFrom('editor')
    sync.setPaused(true)
    sync.setPaused(false)
    expect(preview.scrollTop).toBe(0)
  })

  it('setPaused 重复传入相同值不触发对齐', () => {
    const { editor, preview, sync } = setup()
    editor.scrollTop = 50
    sync.setPaused(false)
    expect(preview.scrollTop).toBe(0)
  })
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @editorx/markdown-core test -- utils/utils index scroll-sync`
Expected: FAIL（`chars` 未定义；`setPaused` / `syncFrom` 不是函数）。

- [ ] **Step 4: 实现计数**

`count.ts`：

```ts
export interface HtmlCount {
  words: number
  /** 渲染文本中的非空白字符数（码点） */
  chars: number
  paragraphs: number
}
```

`countHtml` 末尾改为：

```ts
  doc.body.querySelectorAll(WORD_BOUNDARIES).forEach((el) => {
    el.before(' ')
    el.after(' ')
  })
  const text = doc.body.textContent
  return {
    words: text.match(WORD)?.length ?? 0,
    chars: Array.from(text.replace(WHITESPACE, '')).length,
    paragraphs,
  }
```

- [ ] **Step 5: 实现同步滚动 API**

`scroll-sync.ts`：
1. 在 `ScrollSync` 接口中加入上方 Interfaces 的 `syncFrom` / `setPaused` 两个方法与注释，`refresh` 注释补「Paused: re-measures only.」。
2. 在 `let destroyed = false` 后加 `let paused = false`。
3. 把现有 `const doSync = (source: ScrollSide) => { … }` 整体改名为 `const align = (source: ScrollSide) => { … }`（函数体不变），其后新增：

```ts
  const doSync = (source: ScrollSide) => {
    if (!paused) align(source)
  }
```

   `scheduleSync = debounce(doSync, …)` 与锁过期回调中的 `scheduleSync(target)` 保持不变（暂停时经 `doSync` 被跳过）。
4. 返回对象：

```ts
  return {
    refresh() {
      if (destroyed) return
      scheduleSync.cancel()
      measure()
      doSync(lastSource)
    },
    syncFrom(source) {
      if (destroyed) return
      scheduleSync.cancel()
      lastSource = source
      measure()
      align(source)
    },
    setPaused(next) {
      if (destroyed || next === paused) return
      paused = next
      scheduleSync.cancel()
      if (paused) return
      measure()
      align(lastSource)
    },
    destroy() {
      // 原实现不变
    },
  }
```

   文件顶部 JSDoc 追加一句：`setPaused(true)` 期间 scroll / resize / visibility 事件只更新 `lastSource` 与缓存失效，不写 scrollTop。

- [ ] **Step 6: 运行确认通过并构建**

Run: `pnpm --filter @editorx/markdown-core test && pnpm --filter @editorx/markdown-core typecheck && pnpm --filter @editorx/markdown-core build`
Expected: PASS（479 + 新增，+1 skip 不变）。

- [ ] **Step 7: 提交**

```bash
git add packages/markdown-core/src/utils/count.ts packages/markdown-core/src/utils/utils.test.ts packages/markdown-core/src/index.test.ts packages/markdown-core/src/scroll-sync/scroll-sync.ts packages/markdown-core/src/scroll-sync/scroll-sync.test.ts
git commit -m "feat(markdown-core): countHtml 统计字符数，同步滚动支持暂停与立即定位" -m "CSDN 状态栏「字数」按非空白字符计（G18），countHtml 新增 chars。比对模式新增「定位 / 同步滚动」按钮（G24）需要 ScrollSync.syncFrom 与 setPaused；暂停期间 refresh 只测量不对齐。"
```

---

### Task 3: toolbar：文案修正与标签分类 adapter 类型

**Files:**
- Modify: `packages/toolbar/src/messages.ts`
- Modify: `packages/toolbar/src/types.ts`
- Modify: `packages/toolbar/src/index.ts`
- Modify: `packages/toolbar/src/messages.test.tsx`
- Modify: `packages/toolbar/src/publish-types.test.ts`
- Modify: `packages/publish/src/publish-panel.test.tsx`（第 215、231、243、310、323 行：按钮「确定」→「定时发布」）、`packages/publish/src/form/fields.test.tsx`（第 45 行计数文案）

**Interfaces:**
- Consumes: 无
- Produces:

```ts
// types.ts
export interface TagCategory {
  id: string
  name: string
  /** 已知时直接给出；缺省时按需调用 getTagsByCategory(id) */
  tags?: string[]
}
export interface EditorAdapters {
  // …既有字段不变
  /** 标签面板左栏分类；缺省、返回空数组或抛错时回退为单个「推荐」分类（searchTags('')） */
  getTagCategories?: () => Promise<TagCategory[]>
  /** 分类未内联 tags 时按需加载 */
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
}

// messages.ts（zhCN 新增 / 修改的键，类型由 zhCN 推导）
panels: {
  // 既有 rail / collapse / expand / toc / tocEmpty / syntax 不变
  tocEmptyTitle: '暂无目录'
  tocEmptyBefore: '文章内'
  tocEmptyAction: '添加'
  tocEmptyAfter: '@[TOC]自动根据文章标题生成目录'
  resize: '调整面板宽度'
}
editor: {
  // 既有 ariaLabel / previewLabel / splitter 不变
  syncLocate: '定位到编辑位置'
  syncScroll: '同步滚动'
}
publish.tags: {
  add, search, suggestions('推荐标签'), empty, remove  // 不变
  searchPlaceholder: '请输入文字搜索，Enter键入可添加自定义标签'   // B22
  count: '还可添加{count}个标签'                                   // B23
  title: '标签'                                                    // B24
  section: '添加标签'                                              // B24
  categories: '标签分类'
  recommended: '推荐'
  close: '关闭标签面板'
}
publish.schedule: {
  title: '定时发布'
  hint: '请选择当前时间后 {min} 至 {max} 进行定时发布'             // B27
  label: '发布时间'                                                // 时间选择器的无障碍名
  dateLabel: '发布日期'
  datePlaceholder: '选择日期'
  timePlaceholder: '选择时间'
  cancel: '取 消'                                                  // B28
  confirm: '定时发布'                                              // B28
  units: { minutes: '{count}分钟', hours: '{count}小时', days: '{count}天' }
  calendar: {
    prevYear: '前一年', prevMonth: '上个月', nextMonth: '下个月', nextYear: '后一年',
    monthTitle: '{year} 年 {month} 月', weekdays: '日,一,二,三,四,五,六',
  }
}
publish.errors: {
  scheduledAtTooSoon: '请选择当前时间后 {min} 至 {max} 进行定时发布'  // inferred default：与提示同文案
  scheduledAtTooLate: '请选择当前时间后 {min} 至 {max} 进行定时发布'  // inferred default
  // scheduledAtInvalid / scheduledAtPast 不变
}
```

- [ ] **Step 1: 写失败测试**

`messages.test.tsx` 追加：

```tsx
// zhCN 已在文件顶部从 './messages' 导入
describe('参考图对齐文案', () => {
  it('标签面板文案无多余空格（B22/B23/B24）', () => {
    expect(zhCN.publish.tags.searchPlaceholder).toBe('请输入文字搜索，Enter键入可添加自定义标签')
    expect(zhCN.publish.tags.count).toBe('还可添加{count}个标签')
    expect(zhCN.publish.tags.title).toBe('标签')
    expect(zhCN.publish.tags.section).toBe('添加标签')
    expect(zhCN.publish.tags.recommended).toBe('推荐')
  })

  it('定时发布文案（B27/B28）', () => {
    expect(zhCN.publish.schedule.hint).toBe('请选择当前时间后 {min} 至 {max} 进行定时发布')
    expect(zhCN.publish.schedule.cancel).toBe('取 消')
    expect(zhCN.publish.schedule.confirm).toBe('定时发布')
    expect(zhCN.publish.schedule.units.hours).toBe('{count}小时')
    expect(zhCN.publish.schedule.calendar.weekdays.split(',')).toHaveLength(7)
  })

  it('目录空状态与比对按钮文案（G19/G24）', () => {
    expect(zhCN.panels.tocEmptyTitle).toBe('暂无目录')
    expect(`${zhCN.panels.tocEmptyBefore}${zhCN.panels.tocEmptyAction}${zhCN.panels.tocEmptyAfter}`).toBe(
      '文章内添加@[TOC]自动根据文章标题生成目录',
    )
    expect(zhCN.editor.syncScroll).toBe('同步滚动')
  })
})
```

`publish-types.test.ts`：在顶部 `import type { … }` 列表中加入 `TagCategory`（`EditorAdapters` 若未导入也加入），并在已有 `describe` 内追加：

```ts
it('标签分类 adapter 可选', () => {
  const category: TagCategory = { id: 'py', name: 'Python', tags: ['Django'] }
  const adapters: EditorAdapters = {
    getTagCategories: async () => [category],
    getTagsByCategory: async () => ['Flask'],
  }
  expectTypeOf(adapters.getTagCategories).toEqualTypeOf<(() => Promise<TagCategory[]>) | undefined>()
})
```

（`expectTypeOf` 已从 `vitest` 导入。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/toolbar test && pnpm --filter @editorx/toolbar typecheck`
Expected: FAIL / 类型错误（键不存在）。

- [ ] **Step 3: 实现**

`messages.ts` 中按 Interfaces 修改 `zhCN`（`schedule.label` 保留 `'发布时间'`，删除旧 `schedule.hint '文章将在设定时间自动发布'`、旧 `confirm '确定'`）；`types.ts` 加 `TagCategory` 与两个可选 adapter；`index.ts` 的类型导出列表加 `TagCategory`。若有英文或其他 locale 对象，同步补齐键（值用对应语言；无其他 locale 则跳过）。`AdapterName` 自动包含新键，不改 `adapter-state` 逻辑（两新 adapter 不参与 hide/disable 策略，见 Task 12）。

- [ ] **Step 4: 运行确认通过并构建**

Run: `pnpm --filter @editorx/toolbar test && pnpm --filter @editorx/toolbar typecheck && pnpm --filter @editorx/toolbar build`
Expected: PASS。

- [ ] **Step 5: 同步下游既有用例（publish 消费 toolbar 的 dist，文案变化会让它们失败）**

`packages/publish/src/publish-panel.test.tsx`（定时确认按钮改名后，页面上同时有操作栏与弹窗两个「定时发布」按钮，弹窗内查询必须限定在 `dialog` 内）：
1. 第 215 行 `await userEvent.click(screen.getByRole('button', { name: '确定' }))` → `await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))`。
2. 第 231、243 行 `within(dialog).getByRole('button', { name: '确定' })` → `within(dialog).getByRole('button', { name: '定时发布' })`。
3. 第 310 行用例名 `'定时发布请求进行中：「确定」显示加载态，完成后关闭弹窗'` → `'定时发布请求进行中：确认按钮显示加载态，完成后关闭弹窗'`；第 323 行 `{ name: '确定' }` → `{ name: '定时发布' }`。
4. 第 210、227、241、321 行打开弹窗的 `screen.getByRole('button', { name: '定时发布' })` 不改：此时弹窗未打开，只有操作栏一个按钮（name 为字符串时是整串精确匹配）。

`packages/publish/src/form/fields.test.tsx` 第 45 行 `'还可添加 7 个标签'` → `'还可添加7个标签'`。

（`schedule-dialog.tsx` 此时把新提示 `s.hint` 原样显示为「请选择当前时间后 {min} 至 {max} …」，没有用例断言提示文字；Task 11 重写弹窗时填入区间。）

Run: `pnpm --filter @editorx/publish test && pnpm --filter @editorx/publish typecheck && pnpm --filter @editorx/markdown test`
Expected: PASS（markdown 只新增键，既有用例不受影响）。

- [ ] **Step 6: 提交**

```bash
git add packages/toolbar/src/messages.ts packages/toolbar/src/types.ts packages/toolbar/src/index.ts packages/toolbar/src/messages.test.tsx packages/toolbar/src/publish-types.test.ts packages/publish/src/publish-panel.test.tsx packages/publish/src/form/fields.test.tsx
git commit -m "feat(toolbar): 按 mac 参考图修正标签/定时发布/目录文案，新增标签分类 adapter" -m "B22–B24、B27、B28、G19、G24：去掉多余空格、定时发布提示改为区间说明、按钮改为「取 消 / 定时发布」、新增目录空状态与比对按钮文案。新增可选的 getTagCategories / getTagsByCategory 供两栏标签面板使用。publish 既有用例随文案同步：确认按钮名改为「定时发布」并限定在弹窗内查询，剩余标签数去空格。"
```

---

### Task 4: ui：Select 气泡箭头 / 前缀 / 偏移，Tag primary 变体

**Files:**
- Modify: `packages/ui/src/select.tsx`、`packages/ui/src/select.test.tsx`
- Modify: `packages/ui/src/tag.tsx`、`packages/ui/src/tag.test.tsx`
- Modify: `packages/ui/src/styles.css`、`packages/ui/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `--ex-color-tag-primary-*`
- Produces:

```ts
export interface SelectProps<V extends string = string> {
  // …既有字段不变
  /** 弹出列表与触发器的间距，默认 4（publish 传 12，B14） */
  offset?: number
  /** 列表上方显示指向触发器的小三角（Element 风格，B15） */
  popperArrow?: boolean
  /** 值之前的图标（TimePicker 的时钟） */
  prefix?: ReactNode
  /** 是否显示右侧下拉箭头，默认 true */
  showArrow?: boolean
}
// DOM：button.ex-select > [span.ex-select__prefix] + span.ex-select__value + [svg.ex-select__arrow 10×6]
// 浮层：div.ex-popover.ex-select__list[role=listbox][data-placement][.has-arrow]
//        > [span.ex-select__caret] + ul.ex-select__options[role=presentation] > li[role=none] > button[role=option]

export interface TagProps {
  // …既有字段不变
  /** 'primary'：蓝色描边标签（B09） */
  variant?: 'default' | 'primary'
}
```

- [ ] **Step 1: 写失败测试**

`select.test.tsx` 顶部 import 补 `within`（来自 `@testing-library/react`），追加：

```tsx
describe('Select 外观选项', () => {
  const plain = { label: '声明', value: undefined, options, onChange: () => {} }

  it('popperArrow + offset：列表带气泡箭头与 data-placement，选项仍是 listbox 的后代', async () => {
    renderWithTheme(
      <StrictMode>
        <Select {...plain} popperArrow offset={12} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('combobox', { name: '声明' }))
    const list = await screen.findByRole('listbox', { name: '声明' })
    expect(list).toHaveClass('ex-popover', 'ex-select__list', 'has-arrow')
    expect(list).toHaveAttribute('data-placement', 'bottom-start')
    expect(list.querySelector(':scope > .ex-select__caret')).not.toBeNull()
    expect(list.querySelector(':scope > ul.ex-select__options')).toHaveAttribute('role', 'presentation')
    expect(within(list).getAllByRole('option')).toHaveLength(4)
  })

  it('默认无气泡箭头；箭头是 10×6 自绘 chevron', async () => {
    const { container } = renderWithTheme(
      <StrictMode>
        <Select {...plain} />
      </StrictMode>,
    )
    const arrow = container.querySelector('svg.ex-select__arrow')!
    expect(arrow).toHaveAttribute('width', '10')
    expect(arrow).toHaveAttribute('height', '6')
    await userEvent.click(screen.getByRole('combobox', { name: '声明' }))
    const list = await screen.findByRole('listbox')
    expect(list).not.toHaveClass('has-arrow')
    expect(list.querySelector('.ex-select__caret')).toBeNull()
  })

  it('prefix 渲染在值之前；showArrow={false} 不渲染箭头', () => {
    const { container } = renderWithTheme(
      <StrictMode>
        <Select {...plain} prefix={<i data-testid="prefix" />} showArrow={false} />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '声明' })
    expect(trigger.firstElementChild).toHaveClass('ex-select__prefix')
    expect(trigger.firstElementChild).toContainElement(screen.getByTestId('prefix'))
    expect(container.querySelector('.ex-select__arrow')).toBeNull()
  })

  it('键盘导航在新结构下仍可用', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Select {...plain} onChange={onChange} popperArrow />
      </StrictMode>,
    )
    screen.getByRole('combobox', { name: '声明' }).focus()
    await userEvent.keyboard('{Enter}')
    await screen.findByRole('listbox')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
```

`tag.test.tsx` 追加（顶部补 `import { StrictMode } from 'react'`）：

```tsx
  it('variant="primary" 加 ex-tag--primary；默认无该类', () => {
    const { container } = renderWithTheme(
      <StrictMode>
        <Tag variant="primary" closable>jvm</Tag>
        <Tag>React</Tag>
      </StrictMode>,
    )
    const [primary, plain] = container.querySelectorAll('.ex-tag')
    expect(primary).toHaveClass('ex-tag--primary')
    expect(plain).not.toHaveClass('ex-tag--primary')
    expect(screen.getByRole('button', { name: '删除标签 jvm' })).toBeInTheDocument()
  })
```

`styles.test.ts` 在「单选、复选、下拉、裁剪控件有样式」的类名列表中追加 `'ex-select__options'`、`'ex-select__caret'`、`'ex-select__prefix'`、`'ex-tag--primary'`。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/ui test -- select tag styles`
Expected: FAIL。

- [ ] **Step 3: 实现 Select**

`select.tsx`：
1. import 改为 `offset as offsetMiddleware`，删除 `lucide-react` 的 `ChevronDown` 导入。
2. `SelectProps` 加入 Interfaces 中 4 个字段；解构 `offset: gap = 4, popperArrow = false, prefix, showArrow = true`。
3. `useFloating` 取出 `placement`，middleware 第一项改为 `offsetMiddleware(gap)`。
4. 触发按钮内容：

```tsx
        {prefix !== undefined && (
          <span className="ex-select__prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <span className="ex-select__value">{selected ? selected.label : placeholder}</span>
        {showArrow && <SelectChevron />}
```

5. 浮层：原 `<ul ref={refs.setFloating} …>` 改为：

```tsx
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-select__list', popperArrow && 'has-arrow', layerClass, listClassName)}
                data-placement={placement}
                aria-label={label}
                aria-labelledby={label ? undefined : labelledBy}
                {...getFloatingProps()}
              >
                {popperArrow && <span className="ex-select__caret" aria-hidden="true" />}
                <ul className="ex-select__options" role="presentation">
                  {/* 原 options.map(...) 不变 */}
                </ul>
              </div>
```

6. 文件末尾：

```tsx
/** 10×5.5 细线 chevron（B12） */
function SelectChevron() {
  return (
    <svg
      className="ex-select__arrow"
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M0.5 0.5 5 5 9.5 0.5" />
    </svg>
  )
}
```

`styles.css`：把 `.ex-select__list { … }` 一行替换为：

```css
.ex-select__list { box-sizing: border-box; padding: 0; }
.ex-select__options { box-sizing: border-box; max-height: 274px; margin: 0; padding: 6px 0; overflow: auto; list-style: none; }
.ex-select__prefix { display: inline-flex; flex: none; color: var(--ex-color-text-muted); }
/* Element 风格气泡箭头：外层三角取列表边框色，::after 取表面色（B15） */
.ex-select__caret {
  position: absolute;
  top: -6px;
  left: 35px;
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-top-width: 0;
  border-bottom-color: inherit;
}
.ex-select__caret::after {
  content: '';
  position: absolute;
  top: 1px;
  left: -6px;
  border: 6px solid transparent;
  border-top-width: 0;
  border-bottom-color: var(--ex-color-surface);
}
.ex-select__list[data-placement^='top'] .ex-select__caret {
  top: auto;
  bottom: -6px;
  border-top-width: 6px;
  border-bottom-width: 0;
  border-top-color: inherit;
  border-bottom-color: transparent;
}
.ex-select__list[data-placement^='top'] .ex-select__caret::after {
  top: auto;
  bottom: 1px;
  border-top-width: 6px;
  border-bottom-width: 0;
  border-top-color: var(--ex-color-surface);
  border-bottom-color: transparent;
}
```

- [ ] **Step 4: 实现 Tag**

`tag.tsx`：`TagProps` 加 `variant?: 'default' | 'primary'`，解构 `variant = 'default'`，根元素 `className={cx('ex-tag', variant === 'primary' && 'ex-tag--primary', className)}`。`styles.css` 在 `.ex-tag__close:hover` 之后追加：

```css
.ex-tag--primary {
  border: 1px solid var(--ex-color-tag-primary-border);
  background: var(--ex-color-tag-primary-bg);
  color: var(--ex-color-tag-primary-text);
}
.ex-tag--primary .ex-tag__close { color: var(--ex-color-tag-primary-close); }
/* lucide X 在 15px 盒内墨迹 7.5px（B10）；负外边距让占位仍为 7.5px */
.ex-tag--primary .ex-tag__close svg { width: 15px; height: 15px; margin: -3.75px; }
```

- [ ] **Step 5: 运行确认通过并构建**

Run: `pnpm --filter @editorx/ui test && pnpm --filter @editorx/ui typecheck && pnpm --filter @editorx/ui build`
Expected: PASS（含既有 `select.test.tsx` 中「listbox 有 `ex-popover ex-select__list` 且在 `.ex-portal` 内」用例）。

- [ ] **Step 6: 提交**

```bash
git add packages/ui/src/select.tsx packages/ui/src/select.test.tsx packages/ui/src/tag.tsx packages/ui/src/tag.test.tsx packages/ui/src/styles.css packages/ui/src/styles.test.ts
git commit -m "feat(ui): Select 支持气泡箭头、前缀图标与间距，Tag 新增 primary 变体" -m "CSDN 下拉为 Element 风格：列表距触发器 12px、带指向三角、箭头为 10×5.5 细线（B12/B14/B15）。浮层改为 div 包裹 ul 以容纳三角。已选标签为蓝色描边样式（B09/B10）。"
```

---

### Task 5: ui：calendar 工具函数、DatePicker、TimePicker、InlineLayer

**Files:**
- Create: `packages/ui/src/calendar.ts`、`packages/ui/src/calendar.test.ts`
- Create: `packages/ui/src/date-picker.tsx`、`packages/ui/src/date-picker.test.tsx`
- Create: `packages/ui/src/time-picker.tsx`、`packages/ui/src/time-picker.test.tsx`
- Create: `packages/ui/src/inline-layer.tsx`、`packages/ui/src/inline-layer.test.tsx`
- Modify: `packages/ui/src/index.ts`、`packages/ui/src/styles.css`、`packages/ui/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `Select`（`prefix` / `showArrow` / `offset`）
- Produces:

```ts
// calendar.ts —— 日历日运算全部用 UTC 算术，与本地时区 / DST 无关
export type DateKey = string // 'YYYY-MM-DD'
export function toDateKey(date: Date): DateKey // 本地日期
export function parseDateKey(key: string): { year: number; month: number; day: number } | undefined
export function addDays(key: DateKey, days: number): DateKey
export function addMonths(key: DateKey, months: number): DateKey // 日期夹到目标月最后一天
export function monthGrid(year: number, month: number): DateKey[] // 42 天，周日开头
export function isDateDisabled(key: DateKey, min?: DateKey, max?: DateKey): boolean
export function clampDateKey(key: DateKey, min?: DateKey, max?: DateKey): DateKey
export function todayKey(now?: Date): DateKey

// date-picker.tsx
export interface DatePickerLabels {
  prevYear: string; prevMonth: string; nextMonth: string; nextYear: string
  monthTitle: string // '{year}' '{month}' 占位
  weekdays: string // 7 项，逗号分隔，周日开头
}
export const DATE_PICKER_LABELS: DatePickerLabels
export interface DatePickerProps {
  value: DateKey | undefined
  onChange(value: DateKey): void
  min?: DateKey
  max?: DateKey
  placeholder?: string
  disabled?: boolean
  /** 触发按钮与日历对话框的无障碍名称 */
  label: string
  labels?: Partial<DatePickerLabels>
  className?: string
}
export const DatePicker: ComponentType<DatePickerProps>
// DOM：button.ex-picker-input.ex-date-picker > svg.ex-picker-input__icon + span.ex-picker-input__value
// 浮层：div.ex-popover.ex-date-picker__panel[role=dialog] > header + table[role=grid]；日期按钮 aria-label = DateKey

// time-picker.tsx
export interface TimeOption { value: string; disabled?: boolean } // 'HH:mm'
export interface TimePickerProps {
  value: string | undefined
  onChange(value: string): void
  options: readonly TimeOption[]
  placeholder?: string
  disabled?: boolean
  label: string
  className?: string
  listClassName?: string
}
export function TimePicker(props: TimePickerProps): ReactElement // Select + 时钟前缀，无箭头，offset 12
export function timeSlots(stepMinutes?: number): string[] // 默认 30 → 00:00 … 23:30

// inline-layer.tsx —— 在正常流中渲染（不走 portal）、登记为当前浮层树子节点的容器
export interface InlineLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** 按 Esc 时调用；点击外部不调用 */
  onDismiss(): void
}
export const InlineLayer: ComponentType<InlineLayerProps>
```

`InlineLayer` 供 Task 12 标签面板使用：publish 不直接依赖 `@floating-ui/react`（本计划不新增依赖），由 ui 提供与 DatePicker 相同的子节点模式——`useFloating({ nodeId, open: true })` + `useDismiss(context, { outsidePress: false, bubbles: { escapeKey: false } })`。外层 Modal 的 `useDismiss` 在 Esc 时检查浮层树中仍打开、且不冒泡 Esc 的子节点，有则跳过关闭；子节点自己的 `useDismiss` 关闭内层。两者都监听 `document`，与 React 根的位置无关（Next 下 React 根是 `document`，React 事件里的 `stopPropagation` 拦不住同层的 floating-ui 监听）。

外观（Element 风格面板）整体为 **inferred default**（参考图只有输入框，B26）；输入框几何 155×40、图标、`padding-left 10.5`、`gap 8` 来自 §3.3 实测。

- [ ] **Step 1: 写失败测试（calendar）**

`calendar.test.ts`：

```ts
process.env.TZ = 'America/New_York'

import { describe, expect, it } from 'vitest'
import { addDays, addMonths, clampDateKey, isDateDisabled, monthGrid, parseDateKey, toDateKey, todayKey } from './calendar'

describe('calendar', () => {
  it('toDateKey 取本地日期；parseDateKey 拒绝不存在的日期', () => {
    expect(toDateKey(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
    expect(parseDateKey('2026-02-29')).toBeUndefined()
    expect(parseDateKey('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseDateKey('2026-1-1')).toBeUndefined()
  })

  it('addDays 跨 DST 与跨年仍按日历日', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-09', -7)).toBe('2026-10-02')
  })

  it('addMonths 夹到目标月最后一天', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-10-09', -12)).toBe('2025-10-09')
  })

  it('monthGrid：42 天，周日开头', () => {
    const grid = monthGrid(2026, 10)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-27')
    expect(grid[4]).toBe('2026-10-01')
    expect(grid[41]).toBe('2026-11-07')
  })

  it('isDateDisabled / clampDateKey 为闭区间', () => {
    expect(isDateDisabled('2026-10-09', '2026-10-09', '2026-10-16')).toBe(false)
    expect(isDateDisabled('2026-10-16', '2026-10-09', '2026-10-16')).toBe(false)
    expect(isDateDisabled('2026-10-08', '2026-10-09', '2026-10-16')).toBe(true)
    expect(isDateDisabled('2026-10-17', '2026-10-09', '2026-10-16')).toBe(true)
    expect(clampDateKey('2026-10-01', '2026-10-09', '2026-10-16')).toBe('2026-10-09')
    expect(clampDateKey('2026-11-01', '2026-10-09', '2026-10-16')).toBe('2026-10-16')
    expect(clampDateKey('2026-10-12')).toBe('2026-10-12')
  })

  it('todayKey 默认取当前本地日期', () => {
    expect(todayKey(new Date(2026, 9, 10, 0, 0))).toBe('2026-10-10')
  })
})
```

- [ ] **Step 2: 写失败测试（DatePicker）**

`date-picker.test.tsx`：

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatePicker, type DatePickerProps } from './date-picker'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

function Harness({ onChange, value: initial, ...props }: Partial<DatePickerProps>) {
  const [value, setValue] = useState(initial)
  return (
    <DatePicker
      label="发布日期"
      placeholder="选择日期"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const day = (name: string) => within(screen.getByRole('dialog', { name: '发布日期' })).getByRole('button', { name })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
})
afterEach(() => vi.useRealTimers())

describe('DatePicker', () => {
  it('打开：焦点在今天，今天 aria-current，区间外日期禁用', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-10-16" />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    expect(trigger).toHaveTextContent('选择日期')
    expect(trigger).toHaveClass('ex-picker-input', 'ex-date-picker', 'is-placeholder')
    await userEvent.click(trigger)
    await waitFor(() => expect(day('2026-10-09')).toHaveFocus())
    expect(day('2026-10-09')).toHaveAttribute('aria-current', 'date')
    expect(day('2026-10-08')).toBeDisabled()
    expect(day('2026-10-17')).toBeDisabled()
    expect(day('2026-10-16')).toBeEnabled()
    expect(screen.getByText('2026 年 10 月')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['日', '一', '二', '三', '四', '五', '六'])
  })

  it('键盘：方向键 / Home / End / PageDown 移动焦点并夹在 [min, max]；Enter 选中并关闭、焦点回到触发器', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-10-16" onChange={onChange} />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    await userEvent.click(trigger)
    await waitFor(() => expect(day('2026-10-09')).toHaveFocus())
    await userEvent.keyboard('{ArrowRight}')
    expect(day('2026-10-10')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(day('2026-10-16')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(day('2026-10-09')).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(day('2026-10-10')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(day('2026-10-09')).toHaveFocus()
    await userEvent.keyboard('{PageDown}')
    expect(day('2026-10-16')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('2026-10-16')
    expect(screen.queryByRole('dialog', { name: '发布日期' })).toBeNull()
    expect(trigger).toHaveTextContent('2026-10-16')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('点击禁用日期无效；点击可用日期选中', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-10-16" onChange={onChange} />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await userEvent.click(day('2026-10-08'))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(day('2026-10-12'))
    expect(onChange).toHaveBeenCalledWith('2026-10-12')
  })

  it('翻页按钮：目标月整体越界时禁用；翻到下月焦点夹到 max', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness min="2026-10-09" max="2026-11-02" />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    const dialog = await screen.findByRole('dialog', { name: '发布日期' })
    expect(within(dialog).getByRole('button', { name: '上个月' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '前一年' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '后一年' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: '下个月' }))
    expect(within(dialog).getByText('2026 年 11 月')).toBeInTheDocument()
    expect(day('2026-11-02')).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: '下个月' })).toBeDisabled()
  })

  it('已有值越界时打开焦点夹回区间内', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness value="2026-12-01" min="2026-10-09" max="2026-10-16" />
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await waitFor(() => expect(day('2026-10-16')).toHaveFocus())
  })

  it('Esc 只关闭日历，不关闭外层 Modal', async () => {
    const onClose = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Modal open onClose={onClose} title="外层">
          <Harness />
        </Modal>
      </StrictMode>,
    )
    await userEvent.click(screen.getByRole('button', { name: '发布日期' }))
    await screen.findByRole('dialog', { name: '发布日期' })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '发布日期' })).toBeNull()
    expect(screen.getByRole('dialog', { name: '外层' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disabled：不可打开', async () => {
    renderWithTheme(
      <StrictMode>
        <Harness disabled />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: '发布日期' })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(screen.queryByRole('dialog', { name: '发布日期' })).toBeNull()
  })
})
```

- [ ] **Step 3: 写失败测试（TimePicker）**

`time-picker.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from './test-utils'
import { TimePicker, timeSlots } from './time-picker'

describe('TimePicker', () => {
  it('timeSlots：默认 30 分钟一档，共 48 个', () => {
    const slots = timeSlots()
    expect(slots).toHaveLength(48)
    expect(slots[0]).toBe('00:00')
    expect(slots[1]).toBe('00:30')
    expect(slots.at(-1)).toBe('23:30')
    expect(timeSlots(60)).toHaveLength(24)
  })

  it('时钟前缀、无下拉箭头；禁用选项不可选；选择后回调', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <StrictMode>
        <TimePicker
          label="发布时间"
          placeholder="选择时间"
          value={undefined}
          onChange={onChange}
          options={[{ value: '15:30', disabled: true }, { value: '16:00' }]}
        />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '发布时间' })
    expect(trigger).toHaveClass('ex-select', 'ex-picker-input', 'ex-time-picker')
    expect(trigger.querySelector('.ex-select__prefix svg')).not.toBeNull()
    expect(trigger.querySelector('.ex-select__arrow')).toBeNull()
    expect(trigger).toHaveTextContent('选择时间')
    await userEvent.click(trigger)
    expect(screen.getByRole('option', { name: '15:30' })).toBeDisabled()
    await userEvent.click(screen.getByRole('option', { name: '16:00' }))
    expect(onChange).toHaveBeenCalledWith('16:00')
  })

  it('disabled：不可打开', async () => {
    renderWithTheme(
      <StrictMode>
        <TimePicker label="发布时间" value={undefined} onChange={() => {}} options={[{ value: '16:00' }]} disabled />
      </StrictMode>,
    )
    const trigger = screen.getByRole('combobox', { name: '发布时间' })
    expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
```

`styles.test.ts` 类名列表追加 `'ex-picker-input'`、`'ex-date-picker__panel'`、`'ex-date-picker__day'`。

- [ ] **Step 4: 运行确认失败**

Run: `pnpm --filter @editorx/ui test -- calendar date-picker time-picker styles`
Expected: FAIL（模块不存在）。

- [ ] **Step 5: 实现 calendar.ts**

```ts
/** 'YYYY-MM-DD'。日历日运算一律用 UTC 算术，不受本地时区与夏令时影响 */
export type DateKey = string

const pad = (n: number) => String(n).padStart(2, '0')
const fromUtc = (d: Date): DateKey => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key: string): { year: number; month: number; day: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return undefined
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number]
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? { year, month, day }
    : undefined
}

function toUtc(key: DateKey): Date {
  const parts = parseDateKey(key)
  if (!parts) throw new RangeError(`无效日期：${key}`)
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = toUtc(key)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

export function addMonths(key: DateKey, months: number): DateKey {
  const d = toUtc(key)
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return fromUtc(target)
}

export function monthGrid(year: number, month: number): DateKey[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const start = Date.UTC(year, month - 1, 1 - first.getUTCDay())
  return Array.from({ length: 42 }, (_, i) => fromUtc(new Date(start + i * 86_400_000)))
}

export function isDateDisabled(key: DateKey, min?: DateKey, max?: DateKey): boolean {
  return (min !== undefined && key < min) || (max !== undefined && key > max)
}

export function clampDateKey(key: DateKey, min?: DateKey, max?: DateKey): DateKey {
  if (min !== undefined && key < min) return min
  if (max !== undefined && key > max) return max
  return key
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now)
}
```

- [ ] **Step 6: 实现 date-picker.tsx**

```tsx
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { addDays, addMonths, clampDateKey, isDateDisabled, monthGrid, parseDateKey, todayKey, type DateKey } from './calendar'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'
import { useModalLayerClass } from './layer'

export interface DatePickerLabels {
  prevYear: string
  prevMonth: string
  nextMonth: string
  nextYear: string
  /** '{year}'、'{month}' 占位 */
  monthTitle: string
  /** 7 项，逗号分隔，周日开头 */
  weekdays: string
}

export const DATE_PICKER_LABELS: DatePickerLabels = {
  prevYear: '前一年',
  prevMonth: '上个月',
  nextMonth: '下个月',
  nextYear: '后一年',
  monthTitle: '{year} 年 {month} 月',
  weekdays: '日,一,二,三,四,五,六',
}

export interface DatePickerProps {
  value: DateKey | undefined
  onChange(value: DateKey): void
  min?: DateKey
  max?: DateKey
  placeholder?: string
  disabled?: boolean
  /** 触发按钮与日历对话框的无障碍名称 */
  label: string
  labels?: Partial<DatePickerLabels>
  className?: string
}

const monthStart = (key: DateKey) => `${key.slice(0, 7)}-01`

function DatePickerInner({ value, onChange, min, max, placeholder, disabled = false, label, labels: overrides, className }: DatePickerProps) {
  const labels = { ...DATE_PICKER_LABELS, ...overrides }
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState<DateKey>(() => clampDateKey(value ?? todayKey(), min, max))
  const { portalRoot } = useTheme()
  const layerClass = useModalLayerClass()
  const nodeId = useFloatingNodeId()
  const dayRef = useRef<HTMLButtonElement | null>(null)
  const titleId = useId()
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: (next) => {
      if (next && disabled) return
      if (next) setFocused(clampDateKey(value ?? todayKey(), min, max))
      setOpen(next)
    },
    placement: 'bottom-start',
    middleware: [offset(12), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context, { enabled: !disabled }),
    useDismiss(context, { bubbles: { escapeKey: false } }),
    useRole(context, { role: 'dialog' }),
  ])

  // 焦点跟随 focused（roving tabindex）；只操作 DOM，不 setState
  useEffect(() => {
    if (open) dayRef.current?.focus()
  }, [open, focused])

  const move = (next: DateKey) => setFocused(clampDateKey(next, min, max))
  const select = (key: DateKey) => {
    if (isDateDisabled(key, min, max)) return
    onChange(key)
    setOpen(false)
  }
  /** 翻 months 个月后的整月是否与 [min, max] 有交集 */
  const canPage = (months: number) => {
    const first = addMonths(monthStart(focused), months)
    const last = addDays(addMonths(first, 1), -1)
    return !(min !== undefined && last < min) && !(max !== undefined && first > max)
  }
  const onGridKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const parts = parseDateKey(focused)!
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    const steps: Record<string, () => DateKey> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, e.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -weekday),
      End: () => addDays(focused, 6 - weekday),
    }
    const step = steps[e.key]
    if (!step) return
    e.preventDefault()
    move(step())
  }

  const view = parseDateKey(focused)!
  const grid = monthGrid(view.year, view.month)
  const today = todayKey()
  const title = labels.monthTitle.replace('{year}', String(view.year)).replace('{month}', String(view.month))
  const nav = (months: number, name: string, glyph: string) => (
    <button
      type="button"
      className="ex-date-picker__nav"
      aria-label={name}
      disabled={!canPage(months)}
      onClick={() => move(addMonths(focused, months))}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={cx('ex-picker-input ex-date-picker', open && 'is-open', !value && 'is-placeholder', className)}
        disabled={disabled}
        aria-label={label}
        {...getReferenceProps()}
      >
        <CalendarIcon />
        <span className="ex-picker-input__value">{value ?? placeholder}</span>
      </button>
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false} initialFocus={dayRef}>
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-date-picker__panel', layerClass)}
                aria-label={label}
                {...getFloatingProps()}
              >
                <div className="ex-date-picker__header">
                  {nav(-12, labels.prevYear, '«')}
                  {nav(-1, labels.prevMonth, '‹')}
                  <span id={titleId} className="ex-date-picker__title" aria-live="polite">
                    {title}
                  </span>
                  {nav(1, labels.nextMonth, '›')}
                  {nav(12, labels.nextYear, '»')}
                </div>
                <table role="grid" className="ex-date-picker__grid" aria-labelledby={titleId} onKeyDown={onGridKeyDown}>
                  <thead>
                    <tr>
                      {labels.weekdays.split(',').map((name) => (
                        <th key={name} scope="col">
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, row) => (
                      <tr key={row}>
                        {grid.slice(row * 7, row * 7 + 7).map((key) => (
                          <td key={key} role="gridcell" aria-selected={key === value}>
                            <button
                              ref={key === focused ? dayRef : undefined}
                              type="button"
                              className={cx(
                                'ex-date-picker__day',
                                key.slice(0, 7) !== focused.slice(0, 7) && 'is-outside',
                                key === today && 'is-today',
                                key === value && 'is-selected',
                              )}
                              tabIndex={key === focused ? 0 : -1}
                              disabled={isDateDisabled(key, min, max)}
                              aria-label={key}
                              aria-current={key === today ? 'date' : undefined}
                              onClick={() => select(key)}
                            >
                              {Number(key.slice(8))}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

/** 12×12.5 日历图标（§3.3） */
function CalendarIcon() {
  return (
    <svg className="ex-picker-input__icon" width="12" height="13" viewBox="0 0 12 13" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <rect x="0.5" y="1.5" width="11" height="11" rx="1" />
      <path d="M0.5 4.5h11M3.5 0v3M8.5 0v3" />
    </svg>
  )
}

export const DatePicker = withFloatingTree(DatePickerInner, 'DatePicker')
```

- [ ] **Step 7: 实现 time-picker.tsx**

```tsx
import type { ReactElement } from 'react'
import { cx } from './cx'
import { Select } from './select'

export interface TimeOption {
  /** 'HH:mm' */
  value: string
  disabled?: boolean
}

export interface TimePickerProps {
  value: string | undefined
  onChange(value: string): void
  options: readonly TimeOption[]
  placeholder?: string
  disabled?: boolean
  label: string
  className?: string
  listClassName?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function timeSlots(stepMinutes = 30): string[] {
  const slots: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) slots.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  return slots
}

export function TimePicker({ options, className, ...rest }: TimePickerProps): ReactElement {
  return (
    <Select
      {...rest}
      options={options.map((option) => ({ value: option.value, label: option.value, disabled: option.disabled }))}
      className={cx('ex-picker-input ex-time-picker', className)}
      prefix={<ClockIcon />}
      showArrow={false}
      offset={12}
    />
  )
}

function ClockIcon() {
  return (
    <svg className="ex-picker-input__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" />
      <path d="M6 3v3l2 1.5" />
    </svg>
  )
}
```

- [ ] **Step 8: 样式与导出**

`styles.css` 在 Select 样式之后追加（颜色只用 token；面板外观 inferred default）：

```css
/* ---------- 日期 / 时间选择器（输入框几何按 CSDN §3.3；面板为 Element 风格推断） ---------- */
.ex-date-picker {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  font: inherit;
  font-size: var(--ex-font-size-md);
  text-align: left;
  cursor: pointer;
}
.ex-picker-input { justify-content: flex-start; gap: 8px; height: 40px; padding: 0 10px 0 10.5px; }
.ex-picker-input:disabled { background: var(--ex-color-surface-hover); cursor: not-allowed; opacity: 1; }
.ex-picker-input__icon { flex: none; color: var(--ex-color-text-muted); }
.ex-picker-input__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-date-picker.is-placeholder .ex-picker-input__value { color: var(--ex-color-text-muted); }
.ex-date-picker__panel { box-sizing: border-box; width: 296px; padding: 12px; }
.ex-date-picker__header { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
.ex-date-picker__title { flex: 1; color: var(--ex-color-text); font-size: var(--ex-font-size-md); text-align: center; }
.ex-date-picker__nav {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-text-muted);
  font: inherit;
  cursor: pointer;
}
.ex-date-picker__nav:hover:not(:disabled) { color: var(--ex-color-primary); }
.ex-date-picker__nav:disabled { cursor: not-allowed; opacity: 0.4; }
.ex-date-picker__grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ex-date-picker__grid th { padding: 4px 0; color: var(--ex-color-text-secondary); font-size: var(--ex-font-size-sm); font-weight: 400; }
.ex-date-picker__grid td { padding: 2px 0; text-align: center; }
.ex-date-picker__day {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ex-color-text);
  font: inherit;
  font-size: var(--ex-font-size-sm);
  cursor: pointer;
}
.ex-date-picker__day.is-outside { color: var(--ex-color-text-muted); }
.ex-date-picker__day.is-today { color: var(--ex-color-primary); font-weight: 700; }
.ex-date-picker__day.is-selected { background: var(--ex-color-primary); color: var(--ex-color-on-primary); }
.ex-date-picker__day:hover:not(:disabled, .is-selected) { color: var(--ex-color-primary); }
.ex-date-picker__day:disabled { border-radius: 0; background: var(--ex-color-surface-hover); color: var(--ex-color-text-muted); cursor: not-allowed; }
.ex-date-picker__day:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 1px; }
```

`index.ts` 追加：

```ts
export { DatePicker, DATE_PICKER_LABELS } from './date-picker'
export type { DatePickerLabels, DatePickerProps } from './date-picker'
export { TimePicker, timeSlots } from './time-picker'
export type { TimeOption, TimePickerProps } from './time-picker'
export { addDays, addMonths, clampDateKey, isDateDisabled, monthGrid, parseDateKey, toDateKey, todayKey } from './calendar'
export type { DateKey } from './calendar'
export { InlineLayer } from './inline-layer'
export type { InlineLayerProps } from './inline-layer'
```

- [ ] **Step 8a: InlineLayer（先写失败测试，再实现）**

`inline-layer.test.tsx`（新建）：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { InlineLayer } from './inline-layer'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

function Harness({ onModalClose }: { onModalClose(): void }) {
  const [open, setOpen] = useState(true)
  return (
    <Modal open onClose={onModalClose} title="外层">
      <button type="button">外部</button>
      {open && (
        <InlineLayer role="dialog" aria-label="内层" className="probe" onDismiss={() => setOpen(false)}>
          <input aria-label="输入" />
        </InlineLayer>
      )}
    </Modal>
  )
}

describe('InlineLayer', () => {
  it('Modal 内：正常流渲染；点击外部不关闭；Esc 只关内层，内层关闭后 Esc 才关 Modal', async () => {
    const onModalClose = vi.fn()
    renderWithTheme(
      <StrictMode>
        <Harness onModalClose={onModalClose} />
      </StrictMode>,
    )
    const layer = screen.getByRole('dialog', { name: '内层' })
    expect(layer).toHaveClass('probe')
    expect(layer.closest('.ex-modal')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '外部' }))
    expect(screen.getByRole('dialog', { name: '内层' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('textbox', { name: '输入' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '内层' })).toBeNull()
    expect(onModalClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onModalClose).toHaveBeenCalledTimes(1)
  })

  it('没有外层浮层时自建浮层树；StrictMode 下 Esc 只调用一次 onDismiss', async () => {
    const onDismiss = vi.fn()
    renderWithTheme(
      <StrictMode>
        <InlineLayer aria-label="内层" onDismiss={onDismiss}>
          内容
        </InlineLayer>
      </StrictMode>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
```

Run: `pnpm --filter @editorx/ui test -- inline-layer`
Expected: FAIL（模块不存在）。

`inline-layer.tsx`（新建）：

```tsx
import { FloatingNode, useDismiss, useFloating, useFloatingNodeId, useInteractions } from '@floating-ui/react'
import type { HTMLAttributes } from 'react'
import { withFloatingTree } from './floating-tree'

export interface InlineLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** 按 Esc 时调用；点击外部不调用 */
  onDismiss(): void
}

/**
 * 在正常流中渲染、登记为当前浮层树子节点的容器：外层 Modal 等浮层按 Esc 时
 * 发现它仍打开就不关闭自己，由它先关闭（与 DatePicker 面板同一机制）。
 */
function InlineLayerInner({ onDismiss, children, ...rest }: InlineLayerProps) {
  const nodeId = useFloatingNodeId()
  const { refs, context } = useFloating({
    nodeId,
    open: true,
    onOpenChange: (next) => {
      if (!next) onDismiss()
    },
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: false, bubbles: { escapeKey: false } }),
  ])
  return (
    <FloatingNode id={nodeId}>
      <div ref={refs.setFloating} {...getFloatingProps(rest)}>
        {children}
      </div>
    </FloatingNode>
  )
}

export const InlineLayer = withFloatingTree(InlineLayerInner, 'InlineLayer')
```

- [ ] **Step 9: 运行确认通过并构建**

Run: `pnpm --filter @editorx/ui test && pnpm --filter @editorx/ui typecheck && pnpm --filter @editorx/ui build && pnpm lint`
Expected: PASS；lint 无 `react-hooks` 报错（`setFocused` 只在事件回调中调用）。

- [ ] **Step 10: 提交**

```bash
git add packages/ui/src/calendar.ts packages/ui/src/calendar.test.ts packages/ui/src/date-picker.tsx packages/ui/src/date-picker.test.tsx packages/ui/src/time-picker.tsx packages/ui/src/time-picker.test.tsx packages/ui/src/inline-layer.tsx packages/ui/src/inline-layer.test.tsx packages/ui/src/index.ts packages/ui/src/styles.css packages/ui/src/styles.test.ts
git commit -m "feat(ui): 新增 DatePicker / TimePicker、日历工具函数与 InlineLayer" -m "定时发布弹窗按参考图拆为日期与时间两个输入框（B26）。DatePicker 支持 min/max、网格键盘导航与焦点夹取，日历日运算用 UTC 算术避开夏令时；TimePicker 基于 Select。面板外观为 Element 风格推断。InlineLayer 把正常流中的面板登记为浮层树子节点，Esc 只关最内层：Next 下 React 根在 document，React 事件里的 stopPropagation 拦不住 floating-ui 的 document 监听，标签面板（B20–B24）因此改走浮层树。"
```

---

### Task 6: markdown：状态栏计数规则与分组布局

**Files:**
- Modify: `packages/markdown/src/pipeline/stats-counter.ts`、`packages/markdown/src/pipeline/stats-counter.test.ts`
- Modify: `packages/markdown/src/status-bar.tsx`、`packages/markdown/src/status-bar.test.tsx`
- Modify: `packages/markdown/src/styles.css`、`packages/markdown/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 2 `HtmlCount.chars`；Task 3 无新键（沿用 `status.*`）
- Produces:

```ts
export interface PreviewStats {
  /** Markdown 源码非空白字符数（G18：「test」→ 4） */
  mdChars: number
  /** 编辑器行数：换行数 + 1；文本不以 '\n' 结尾时再 + 1（cledit getTextContent 语义；空文档为 2） */
  lines: number
  /** 渲染文本非空白字符数 */
  htmlChars: number
  paragraphs: number
}
// DOM：.ex-mde-status__md > span×4（「Markdown」「n 字数」「n 行数」「当前行 x, 当前列 y」），组间为 ' ' 文本节点
//      .ex-mde-status__html > span×3（「HTML」「n 字数」「n 段落」）
```

`mdWords` / `htmlWords` 改名为 `mdChars` / `htmlChars`；仓库内引用只有 `stats-counter.ts`、`stats-counter.test.ts`、`status-bar.tsx`（`store.ts`、`preview-pipeline.ts` 只引用类型名）。`apps/playground/app/markdown-core/markdown-core-demo.tsx` 有自己的 `Stats` 类型，**不改**（保持 markdown-core 基线）。

- [ ] **Step 1: 写失败测试**

`stats-counter.test.ts`：第 13 行 `stats!.mdWords` 改为 `stats!.mdChars`；追加：

```ts
  it('计数规则（G18）：字数按非空白字符；行数末尾无换行时 +1；空文档 2 行', () => {
    const counter = createStatsCounter()
    const count = (md: string) => counter.count(createRenderer().render(md).sections, () => true)!
    expect(count('test')).toEqual({ mdChars: 4, lines: 2, htmlChars: 4, paragraphs: 1 })
    expect(count('')).toEqual({ mdChars: 0, lines: 2, htmlChars: 0, paragraphs: 0 })
    expect(count('a\nb')).toMatchObject({ lines: 3 })
    expect(count('a\nb\n')).toMatchObject({ lines: 3 })
    expect(count('# 标题\n\n正文 hello')).toMatchObject({ mdChars: 10, lines: 4 })
  })
```

`status-bar.test.tsx`：第 20 行正则中的 `3 行数` 改为 `4 行数`（`'# 标题\n\n正文 hello'` 无末尾换行）；追加：

```tsx
  it('参考图计数：test → Markdown 4 字数 2 行数 / HTML 4 字数 1 段落；空文档 2 行；CRLF 与 LF 相同', async () => {
    const { handle } = renderEditor({ defaultValue: 'test' })
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown 4 字数 2 行数 当前行 1, 当前列 0$/), { timeout: 3000 })
    expect(statusHtml()).toHaveTextContent(/^HTML 4 字数 1 段落$/)
    act(() => handle().setValue(''))
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown 0 字数 2 行数/))
    expect(statusHtml()).toHaveTextContent(/^HTML 0 字数 0 段落$/)
    act(() => handle().setValue('第一行\r\n第二行\r\n'))
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown 6 字数 3 行数/))
    expect(statusHtml()).toHaveTextContent(/^HTML 6 字数 1 段落$/)
  })

  it('分组：每组一个 span，组间为空格文本节点（G09）', async () => {
    renderEditor({ defaultValue: 'test' })
    await waitFor(() => expect(statusMd()).toHaveTextContent('2 行数'), { timeout: 3000 })
    expect([...statusMd()!.children].map((el) => el.textContent)).toEqual(['Markdown', '4 字数', '2 行数', '当前行 1, 当前列 0'])
    expect([...statusHtml()!.children].map((el) => el.textContent)).toEqual(['HTML', '4 字数', '1 段落'])
    expect(statusMd()!.textContent).toBe('Markdown 4 字数 2 行数 当前行 1, 当前列 0')
  })
```

`styles.test.ts` 第 54 行替换为：

```ts
    expect(css).toMatch(
      /\.ex-mde-status \{[^}]*gap: 24px;[^}]*box-sizing: border-box;[^}]*height: 64px;[^}]*padding: 9px 16px 12px 26\.5px;[^}]*font-size: 12px;[^}]*line-height: 21px;/,
    )
    expect(css).toMatch(/\.ex-mde-status__stats \{ flex: none; white-space: nowrap; \}/)
    expect(css).toMatch(/\.ex-mde-status__md,\n\.ex-mde-status__html \{ display: flex; gap: 8px; \}/)
    expect(css).toMatch(/\.ex-mde-status__end \{[^}]*gap: 16px;/)
    expect(css).toMatch(/\.ex-mde-status__center,\n\.ex-mde-status__end \{ margin-top: 2px; \}/)
```

并把 `STRUCTURAL` 集合中的 `'ex-mde-status__md', 'ex-mde-status__html'` 删除（它们现在有样式）。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/markdown test -- stats-counter status-bar styles`
Expected: FAIL。

- [ ] **Step 3: 实现计数**

`stats-counter.ts`：接口按 Interfaces 改名并加注释；`count` 中：

```ts
      const stats: PreviewStats = { mdChars: 0, lines: 1, htmlChars: 0, paragraphs: 0 }
      for (const section of sections) {
        // …缓存逻辑不变
        stats.mdChars += words.chars
        stats.lines += words.lines - 1
        stats.htmlChars += markup.chars
        stats.paragraphs += markup.paragraphs
      }
      // cledit 在内容末尾不是换行时补一个换行，编辑器因此多出一行（空文档也是 2 行）
      if (!(sections.at(-1)?.text ?? '').endsWith('\n')) stats.lines += 1
```

- [ ] **Step 4: 实现状态栏**

`status-bar.tsx`：import 加 `Fragment`；删除 `md` / `html` 模板字符串，改为：

```tsx
  const md = [
    s.markdown,
    `${stats?.mdChars ?? 0} ${s.words}`,
    `${stats?.lines ?? 2} ${s.lines}`,
    `${s.line} ${cursor.line}, ${s.column} ${cursor.column}`,
  ]
  const html = [s.html, `${stats?.htmlChars ?? 0} ${s.words}`, `${stats?.paragraphs ?? 0} ${s.paragraphs}`]
```

渲染处：

```tsx
      <div className="ex-mde-status__stats">
        {viewMode !== 'preview' && <StatGroups className="ex-mde-status__md" items={md} />}
        <StatGroups className="ex-mde-status__html" items={html} />
      </div>
```

文件末尾：

```tsx
/** 组间留空格文本节点（textContent 与读屏不变）；flex 容器不渲染纯空白文本，组距由 gap 给出（G09） */
function StatGroups({ className, items }: { className: string; items: readonly string[] }) {
  return (
    <div className={className}>
      {items.map((text, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          <span>{text}</span>
        </Fragment>
      ))}
    </div>
  )
}
```

`styles.css` 状态栏段替换为：

```css
/* CSDN：状态栏总高 64（含上边框），左内边距 26.5、右 16；组距约 8px（两个空格），组内为普通空格（G06/G07/G09） */
.ex-mde-status {
  display: flex;
  flex: none;
  align-items: center;
  gap: 24px;
  box-sizing: border-box;
  height: 64px;
  padding: 9px 16px 12px 26.5px;
  border-top: 1px solid var(--ex-color-mde-status-border);
  color: var(--ex-color-mde-status-text);
  font-size: 12px;
  line-height: 21px;
}

.ex-mde-status__stats { flex: none; white-space: nowrap; }
.ex-mde-status__md,
.ex-mde-status__html { display: flex; gap: 8px; }
.ex-mde-status__center { flex: 1; min-width: 0; }
.ex-mde-status__end { display: flex; align-items: center; gap: 16px; margin-left: auto; }
/* 额度提示与按钮中心在卡片底 −32（G06/G07/G08）；统计文字仍按 9/12 内边距居中，所以只把这两组下移 1px */
.ex-mde-status__center,
.ex-mde-status__end { margin-top: 2px; }
```

（`.ex-mde-status__save:empty` 规则保留。）

- [ ] **Step 5: 运行确认通过**

Run: `pnpm --filter @editorx/markdown test && pnpm --filter @editorx/markdown typecheck`
Expected: PASS（234 + 新增）。

- [ ] **Step 6: 提交**

```bash
git add packages/markdown/src/pipeline/stats-counter.ts packages/markdown/src/pipeline/stats-counter.test.ts packages/markdown/src/status-bar.tsx packages/markdown/src/status-bar.test.tsx packages/markdown/src/styles.css packages/markdown/src/styles.test.ts
git commit -m "fix(markdown): 状态栏按 CSDN 规则计数并分组排版" -m "参考图「test」显示 4 字数 2 行数（G18）：字数改为非空白字符数，行数沿用 cledit 末尾补换行的语义。统计项按组渲染、组距 8px（审计 G09 的双空格），状态栏固定 64px 高，左右内边距按 mac 参考图；额度提示与按钮组中心对齐卡片底 −32（G06/G07/G09）。"
```

---

### Task 7: markdown：外壳几何（内容内边距、页签、工具栏分隔线、图标）

**Files:**
- Create: `packages/markdown/src/icons.tsx`
- Modify: `packages/markdown/src/mode-tabs.tsx`
- Modify: `packages/markdown/src/core-extensions/format.tsx`、`packages/markdown/src/core-extensions/insert.tsx`
- Modify: `packages/markdown/src/styles.css`、`packages/markdown/src/styles.test.ts`
- Modify: `packages/markdown/src/markdown-editor.test.tsx`

**Interfaces:**
- Consumes: Task 1 `--ex-color-mde-toolbar-divider`
- Produces（`icons.tsx`，包内使用，不导出到 `index.ts`）：

```ts
export function MarkdownModeIcon(): ReactElement // 16×16 圆角方框 + <>（G27）
export function SplitModeIcon(): ReactElement // 粗线双栏框，墨迹 15.5×14（G27）
export function PreviewModeIcon(): ReactElement // 实心显示器 14×14（G27）
export function StrikeIcon(): ReactElement // S + 删除线，墨迹 10.5×14（G29）
export function PanelToggleIcon(): ReactElement // 20 盒，方框 + 右侧短横（G31），墨迹顶 +1（G10）
export function TocIcon(): ReactElement // 20 盒，粗列表条（G31）
export function SyntaxIcon(): ReactElement // 20 盒，16×16 方框 + 两个对角箭头（G31）
export function LocateIcon(): ReactElement // 16 盒，准星（G24）
export function SyncScrollIcon(): ReactElement // 16 盒，上下箭头 + 横条，墨迹高 15（G24）
```

几何值：页签 `padding: 0 12px`、`font-weight: 500`、无字距（G05/G16）；正文 `padding-inline: max(16px, min(20cqi, calc((100cqi - 1016px) / 2)))`（G03，16px 下限为 inferred default）；四种视图首行 `padding-top: 11px`（G04）；工具栏分隔线 1×17（G13）；图片 / 链接描边 `strokeWidth={1.5}`（16px 下渲染 1px，G30）。

- [ ] **Step 1: 写失败测试**

`styles.test.ts`「CSDN 外壳关键尺寸」中：第 50–52 行（`.ex-mde-mode` 正则）、第 58 行（split 编辑区 `padding: 16px`）、第 59 行（`padding: 16px 20cqi`）、第 61 行（split 预览 `19px 24px 16px 42px`）、第 62 行（分隔线 `margin: 0 16px`）替换为：

```ts
    expect(css).toMatch(
      /\.ex-mde-mode \{[^}]*gap: 6px;[^}]*height: 32px;[^}]*padding: 0 12px;[^}]*border-radius: var\(--ex-radius-lg\);[^}]*font-family: var\(--ex-mde-font-family\);[^}]*font-weight: 500;/,
    )
    expect(css).not.toMatch(/\.ex-mde-mode \{[^}]*letter-spacing/)
    const inset = 'max(16px, min(20cqi, calc((100cqi - 1016px) / 2)))'
    expect(css).toContain(`.ex-mde .ex-editor-content {\n  padding: 11px ${inset} 16px;`)
    expect(css).toContain(`.ex-mde-preview {\n  box-sizing: border-box;\n  padding: 11px ${inset} 16px;\n}`)
    expect(css).toMatch(/\.ex-mde\[data-view='split'\] \.ex-editor-content \{ padding: 11px 16px 16px; \}/)
    expect(css).toMatch(/\.ex-mde\[data-view='split'\] \.ex-mde-preview \{ padding: 11px 24px 16px 42px; \}/)
    expect(css).toMatch(
      /\.ex-mde-toolbar \.ex-toolbar__divider \{ height: 17px; margin: 0 16px; background: var\(--ex-color-mde-toolbar-divider\); \}/,
    )
```

`markdown-editor.test.tsx` 追加：

```tsx
describe('自绘图标（G27/G29/G30）', () => {
  it('页签图标为自绘 16px SVG，不是 lucide', () => {
    renderEditor()
    for (const name of ['Markdown', '比对', '预览']) {
      const svg = screen.getByRole('tab', { name }).querySelector('svg')!
      expect(svg).not.toHaveClass('lucide')
      expect(svg).toHaveAttribute('width', '16')
    }
  })

  it('删除线为自绘图标；图片、链接描边 1.5', () => {
    renderEditor()
    const toolbar = screen.getByRole('toolbar', { name: '编辑工具栏' })
    expect(within(toolbar).getByRole('button', { name: '删除线' }).querySelector('svg')).not.toHaveClass('lucide')
    for (const name of ['图片', '链接']) {
      expect(within(toolbar).getByRole('button', { name }).querySelector('svg')).toHaveAttribute('stroke-width', '1.5')
    }
  })
})
```

（`screen`、`within`、`renderEditor` 若未导入则补齐。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/markdown test -- styles markdown-editor`
Expected: FAIL。

- [ ] **Step 3: 新建 `icons.tsx`**

```tsx
/** CSDN Markdown 外壳的自绘图标（墨迹尺寸按 mac 参考图实测，路径形状为推断） */

export function MarkdownModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="0.6" y="0.6" width="14.8" height="14.8" rx="3" />
      <path d="M6.5 5.5 4 8l2.5 2.5M9.5 5.5 12 8l-2.5 2.5" />
    </svg>
  )
}

export function SplitModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1.75" width="14" height="12.5" rx="1.5" />
      <path d="M8 1.75v12.5" />
    </svg>
  )
}

export function PreviewModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="10" rx="1.5" fill="currentColor" />
      <path d="M5 14.4h6M8 11v3.4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function StrikeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <path d="M11.4 3.6C10.9 2.4 9.6 1.6 8 1.6c-2 0-3.3 1.1-3.3 2.6 0 1.3.9 2.1 3 2.7" strokeLinecap="round" />
      <path d="M2.75 8h10.5" />
      <path d="M10.9 9.9c.4.4.6 1 .6 1.6 0 1.7-1.5 2.9-3.6 2.9-1.8 0-3.2-.8-3.8-2.2" strokeLinecap="round" />
    </svg>
  )
}

export function PanelToggleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <rect x="1.6" y="1.6" width="16.8" height="16.8" rx="2" />
      <path d="M13 1.6v16.8" />
      <path d="M15 6.5h1.4M15 10h1.4M15 13.5h1.4" strokeLinecap="round" />
    </svg>
  )
}

export function TocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="2" y="3.5" width="3" height="2.5" rx="0.5" />
      <rect x="7" y="3.5" width="11" height="2.5" rx="0.5" />
      <rect x="2" y="8.75" width="3" height="2.5" rx="0.5" />
      <rect x="7" y="8.75" width="11" height="2.5" rx="0.5" />
      <rect x="2" y="14" width="3" height="2.5" rx="0.5" />
      <rect x="7" y="14" width="11" height="2.5" rx="0.5" />
    </svg>
  )
}

export function SyntaxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="2" />
      <path d="M8.5 11.5l-3 3M5.5 11.5v3h3M11.5 8.5l3-3M11.5 5.5h3v3" />
    </svg>
  )
}

export function LocateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <path d="M8 0.6V3M8 13v2.4M0.6 8H3M13 8h2.4" />
    </svg>
  )
}

export function SyncScrollIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 1.1h12M2 14.9h12" />
      <path d="M8 3.5v9M5.5 6 8 3.5 10.5 6M5.5 10 8 12.5 10.5 10" />
    </svg>
  )
}
```

- [ ] **Step 4: 接入图标**

`mode-tabs.tsx`：删除 lucide 导入，改为：

```tsx
import type { ComponentType } from 'react'
import { MarkdownModeIcon, PreviewModeIcon, SplitModeIcon } from './icons'

const MODES: ReadonlyArray<{ mode: ViewMode; Icon: ComponentType }> = [
  { mode: 'edit', Icon: MarkdownModeIcon },
  { mode: 'split', Icon: SplitModeIcon },
  { mode: 'preview', Icon: PreviewModeIcon },
]
```

渲染处 `<Icon size={16} aria-hidden="true" />` 改为 `<Icon />`（`type KeyboardEvent` 等其余导入保留）。

`format.tsx`：删除 `Strikethrough` 导入，`import { StrikeIcon } from '../icons'`，删除线按钮 `icon: <StrikeIcon />`。
`insert.tsx`：`icon: <Image size={ICON_SIZE} strokeWidth={1.5} />`、`icon: <Link size={ICON_SIZE} strokeWidth={1.5} />`。

- [ ] **Step 5: 样式**

`styles.css`：
1. `.ex-mde-mode` 规则上方注释改为 `/* 参考页签宽 115.5/74/74（mac，G05）：左右 12px，字重 500（G16） */`；规则内 `padding: 0 11.5px 0 12px;` → `padding: 0 12px;`，`font-weight: 600;` → `font-weight: 500;`，删除 `letter-spacing: 0.5px;`。
2. `.ex-mde-toolbar .ex-toolbar__divider { margin: 0 16px; }` → `.ex-mde-toolbar .ex-toolbar__divider { height: 17px; margin: 0 16px; background: var(--ex-color-mde-toolbar-divider); }`，上方注释补「分隔线 1×17 #d9d9d9（G13）」。
3. `.ex-mde .ex-editor-content` 的 `padding: 16px 20cqi;` → `padding: 11px max(16px, min(20cqi, calc((100cqi - 1016px) / 2))) 16px;`，上方加注释 `/* 正文宽上限 1016px、两侧最多 20%（G03，下限 16px 为推断）；首行距工具栏 11px（G04） */`。
4. `.ex-mde[data-view='split'] .ex-editor-content { padding: 16px; }` → `{ padding: 11px 16px 16px; }`。
5. `.ex-mde-preview { box-sizing: border-box; padding: 16px 20cqi; }` → `padding: 11px max(16px, min(20cqi, calc((100cqi - 1016px) / 2))) 16px;`。
6. `.ex-mde[data-view='split'] .ex-mde-preview { padding: 19px 24px 16px 42px; }` → `{ padding: 11px 24px 16px 42px; }`，注释改为「首行与编辑区同高（G04）」。

- [ ] **Step 5a: 实测 Markdown 外壳的西文 / 数字字体（progress.md 裁定：发布面板已确认用 Helvetica Neue，Markdown 外壳需实测后决定）**

参考值（已从 `apps/playground/public/reference/mac_2026-10-10_19-12-09.png` 量出，设备像素 ÷ 2；页面原点在图内 (−10, +2)）：

| 样本 | 字号 / 字重 / 颜色 | 参考图区域（设备 px） | 墨迹宽（CSS px） |
|---|---|---|---|
| 状态栏「Markdown」 | 12px / 400 / `#666666` 于白底 | x 76–182，y 1737–1759 | 53.5 |
| 状态栏「HTML」 | 12px / 400 / `#666666` 于白底 | x 76–123，y 1779–1801 | 24 |
| 页签「Markdown」 | 14px / 500 / 白字于 `#1a1a1a` | x 116–250，y 186–217 | 67.5 |

先复核上表（暗字取亮度 < 200 的列，页签白字取亮度 > 110 的列），再用同一阈值量三种字体栈的渲染结果。脚本放在仓库外，不提交：

```bash
mkdir -p /tmp/glyph-check
```

`/tmp/glyph-check/measure.mjs`：

```js
import { createRequire } from 'node:module'

const ROOT = '/Users/dove/code/GithubProject/OpenSourceProject/editorX'
const { chromium } = createRequire(`${ROOT}/apps/playground/package.json`)('@playwright/test')
const sharp = createRequire(import.meta.url)(
  `${ROOT}/node_modules/.pnpm/sharp@0.35.5_@types+node@22.20.5/node_modules/sharp`,
)

const STACKS = {
  current: "-apple-system, 'SF UI Text', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  helvetica: "'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif",
  pingfang: "'PingFang SC', sans-serif",
}
// [名称, 文本, 字号, 字重, 前景, 背景, 参考墨迹宽, 白字?]
const SAMPLES = [
  ['状态栏 Markdown', 'Markdown', 12, 400, '#666666', '#ffffff', 53.5, false],
  ['状态栏 HTML', 'HTML', 12, 400, '#666666', '#ffffff', 24, false],
  ['页签 Markdown', 'Markdown', 14, 500, '#ffffff', '#1a1a1a', 67.5, true],
]

async function inkWidth(png, light) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  let min = Infinity
  let max = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (light ? lum > 110 : lum < 200) {
        min = Math.min(min, x)
        max = Math.max(max, x)
      }
    }
  }
  return (max - min + 1) / 2
}

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 200, height: 40 } })
for (const [name, text, size, weight, fg, bg, ref, light] of SAMPLES) {
  const row = [name, `参考 ${ref}`]
  for (const [stack, family] of Object.entries(STACKS)) {
    await page.setContent(
      `<body style="margin:0;background:${bg}"><span style="position:absolute;left:10px;top:10px;font:${weight} ${size}px ${family};color:${fg}">${text}</span></body>`,
    )
    await page.evaluate(() => document.fonts.ready)
    row.push(`${stack} ${await inkWidth(await page.screenshot(), light)}`)
  }
  console.log(row.join(' | '))
}
await browser.close()
```

```bash
node /tmp/glyph-check/measure.mjs
```

判定（三个样本都要满足）：某个字体栈的墨迹宽与参考值相差 ≤ 0.5 CSS px，且比另外两个更接近，则选它。

- 选 `helvetica`：`styles.css` 中 `.ex-mde { --ex-mde-font-family: -apple-system, 'SF UI Text', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; }` 一行改为 `.ex-mde { --ex-mde-font-family: var(--ex-font-family-helvetica); }`（Task 1 已定义该 token）；`styles.test.ts` 中断言 `--ex-mde-font-family: -apple-system, 'SF UI Text', Arial,` 的那一行改为 `expect(css).toMatch(/\.ex-mde \{ --ex-mde-font-family: var\(--ex-font-family-helvetica\); \}/)`。页签宽度依赖字体，Task 18 darwin 页签断言以参考图为准，不随之放宽。
- 选 `current`：不改 CSS 与测试。
- 选 `pingfang`，或没有字体栈满足判定：不改 CSS，在提交正文和 RESUME 里写明三个样本的实测值，并列为待业主确认。

把三种字体栈 × 三个样本的实测表与结论写进本任务的提交正文（Step 7）；Task 20 再抄进 RESUME。

- [ ] **Step 6: 运行确认通过**

Run: `pnpm --filter @editorx/markdown test && pnpm --filter @editorx/markdown typecheck`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/markdown/src/icons.tsx packages/markdown/src/mode-tabs.tsx packages/markdown/src/core-extensions/format.tsx packages/markdown/src/core-extensions/insert.tsx packages/markdown/src/styles.css packages/markdown/src/styles.test.ts packages/markdown/src/markdown-editor.test.tsx
git commit -m "fix(markdown): 按 mac 参考图修正正文内边距、页签、工具栏分隔线与图标" -m "正文宽度上限 1016px（G03），四种视图首行统一距工具栏 11px（G04）；页签去掉为 Windows 调的字距、字重 500（G05/G16）；分隔线 1×17 #d9d9d9（G13）；页签、删除线改为自绘图标，图片/链接描边 1px（G27/G29/G30）。" -m "西文字体实测（19-12-09，墨迹宽 CSS px；参考 状态栏 Markdown 53.5 / HTML 24 / 页签 Markdown 67.5）：<粘贴 Step 5a 输出的三行>。结论：<current | helvetica | 待业主确认>。"
```

（第二个 `-m` 里的两处尖括号由执行者用 Step 5a 的真实输出替换后再提交。）

---

### Task 8: markdown：目录空状态、图标栏节奏与图标、面板宽度拖柄

**Files:**
- Modify: `packages/markdown/src/panels/toc-panel.tsx`
- Modify: `packages/markdown/src/panels/side-rail.tsx`
- Modify: `packages/markdown/src/core-extensions/panels.tsx`
- Create: `packages/markdown/src/panels/panel-grip.tsx`、`packages/markdown/src/panels/panel-grip.test.tsx`
- Modify: `packages/markdown/src/panels/panel-host.tsx`
- Modify: `packages/markdown/src/markdown-editor.tsx`
- Modify: `packages/markdown/src/panels/panels.test.tsx`
- Modify: `packages/markdown/src/styles.css`、`packages/markdown/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 3 `panels.tocEmptyTitle / tocEmptyBefore / tocEmptyAction / tocEmptyAfter / resize`；Task 7 `PanelToggleIcon / TocIcon / SyntaxIcon`
- Produces:

```ts
// panels/panel-grip.tsx
export const PANEL_MIN_WIDTH = 300 // inferred default
export const PANEL_MAX_WIDTH = 600 // inferred default
export const PANEL_DEFAULT_WIDTH = 390
export const PANEL_WIDTH_VAR = '--ex-mde-panel-width'
export function clampPanelWidth(value: number): number
export function PanelGrip(props: {
  width: number
  onChange(width: number): void
  /** 写入 --ex-mde-panel-width 的元素（.ex-mde 根） */
  rootRef: RefObject<HTMLDivElement | null>
  /** 右侧面板 aside 的 id */
  controls: string
}): ReactElement
// panels/panel-host.tsx：新增可选 id?: string，写到 <aside id>
// DOM：.ex-mde-rail 的第一个按钮加类 ex-mde-rail__toggle；面板按钮加 data-panel={panel.id}（宿主可按面板定制样式，G14 的 AI 标签色用到）
// 目录空态：div.ex-mde-toc.ex-mde-toc--empty > p.ex-mde-toc__empty-title + p.ex-mde-toc__empty（含 button.ex-mde-toc__add）
```

目录空态：**无标题条**（G26）；非空时保留标题条 `tocTitle ?? '目录'`（是否也去掉见 Open questions）。「添加」执行 `ctx.commands.run('toc')`，`ctx.readOnly` 时禁用（inferred default）。注意：`ctx.readOnly` 只在 TocPanel 渲染时读取，面板打开期间切换只读不会立即更新按钮状态（下次重渲染才生效）；只在宿主于面板打开时切换 `readOnly` 才有影响，本计划不处理。行高 22px（inferred default）。图标栏：项高 51、标签 10px / 14px 行高、分隔线下 4px（G10/G11）；标签色未激活 `#999`、激活 `#1a1a1a` 粗体；收起态（`aria-expanded=false`）图标与文字都是 `#999`（G14）。拖柄 4×24 胶囊，位于面板左侧 16px 间隙中央（x −10..−6），顶 438px（G23；固定像素还是按比例为 inferred default）。

- [ ] **Step 1: 写失败测试（目录 / 图标栏）**

`panels.test.tsx`：顶部 import 补 `act`；「目录：显示 @[TOC] 自定义标题；无标题时显示空态」用例整体替换为：

```tsx
  it('目录：显示 @[TOC] 自定义标题；无标题时显示空态（无标题条，「添加」插入目录标记）', async () => {
    const { handle } = renderEditor({ defaultValue: '@[TOC](自定义目录)\n\n# 一', defaultPanel: 'toc' })
    const panel = screen.getByRole('complementary', { name: '目录' })
    await waitFor(() => expect(within(panel).getByText('自定义目录')).toBeInTheDocument())
    act(() => handle().setValue('只有正文'))
    await waitFor(() => expect(within(panel).getByText('暂无目录')).toBeInTheDocument())
    expect(within(panel).queryByRole('heading')).toBeNull()
    expect(panel.querySelector('.ex-mde-toc__empty')).toHaveTextContent('文章内添加@[TOC]自动根据文章标题生成目录')
    await userEvent.click(within(panel).getByRole('button', { name: '添加' }))
    expect(handle().getValue()).toContain('@[TOC]')
  })

  it('目录空态：只读时「添加」禁用', () => {
    renderEditor({ defaultValue: '正文', defaultPanel: 'toc', readOnly: true })
    const panel = screen.getByRole('complementary', { name: '目录' })
    expect(within(panel).getByRole('button', { name: '添加' })).toBeDisabled()
  })

  it('图标栏：第一个按钮为收起/展开开关；激活项 is-active', async () => {
    renderEditor({ defaultValue: '# 一' })
    const toggle = within(rail()).getByRole('button', { name: '展开' })
    expect(toggle).toHaveClass('ex-mde-rail__item', 'ex-mde-rail__toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.querySelector('svg')).not.toHaveClass('lucide')
    await userEvent.click(within(rail()).getByRole('button', { name: '目录' }))
    expect(within(rail()).getByRole('button', { name: '收起' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(rail()).getByRole('button', { name: '目录' })).toHaveClass('is-active')
    expect(within(rail()).getByRole('button', { name: '目录' }).querySelector('svg')).not.toHaveClass('lucide')
    expect(within(rail()).getByRole('button', { name: '目录' })).toHaveAttribute('data-panel', 'toc')
    expect(toggle).not.toHaveAttribute('data-panel')
  })
```

`styles.test.ts`：第 55 行面板正则改为 `/\.ex-mde-panel \{[^}]*width: var\(--ex-mde-panel-width, 390px\);[^}]*padding: 10px 0;/`；「CSDN 外壳关键尺寸」末尾追加：

```ts
    expect(css).toMatch(/\.ex-mde-rail__item \{[^}]*height: 51px;[^}]*font-size: 10px;[^}]*line-height: 14px;/)
    expect(css).toMatch(/\.ex-mde-rail__label \{ color: var\(--ex-color-mde-rail-label\); \}/)
    expect(css).toMatch(/\.ex-mde-rail__item\.is-active \.ex-mde-rail__label \{ color: var\(--ex-color-mde-chrome-text\); font-weight: 700; \}/)
    expect(css).toMatch(/\.ex-mde-rail__toggle\[aria-expanded='false'\] \{ color: var\(--ex-color-mde-rail-label\); \}/)
    expect(css).toMatch(/\.ex-mde-rail__divider \{[^}]*margin: 0 0 4px;/)
    expect(css).toMatch(/\.ex-mde-toc--empty \{ padding: 39px 20px 0; text-align: center; \}/)
    expect(css).toMatch(/\.ex-mde-toc__add \{[^}]*color: var\(--ex-color-mde-toc-empty-link\);/)
    expect(css).toMatch(/\.ex-mde-panel-grip::after \{[^}]*top: 438px;[^}]*width: 4px;[^}]*height: 24px;[^}]*background: var\(--ex-color-mde-grip\);/)
```

- [ ] **Step 2: 写失败测试（拖柄）**

`panel-grip.test.tsx`：

```tsx
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { editorRoot, renderEditor } from '../test-utils'
import { clampPanelWidth } from './panel-grip'

const grip = () => screen.getByRole('separator', { name: '调整面板宽度' })
const width = () => editorRoot().style.getPropertyValue('--ex-mde-panel-width')

describe('面板宽度拖柄（G23）', () => {
  it('clampPanelWidth：夹在 300–600 并取整，非有限值回到 390', () => {
    expect(clampPanelWidth(10)).toBe(300)
    expect(clampPanelWidth(999)).toBe(600)
    expect(clampPanelWidth(412.6)).toBe(413)
    expect(clampPanelWidth(Number.NaN)).toBe(390)
  })

  it('只在右侧面板打开时渲染；aria-controls 指向面板', async () => {
    renderEditor({ defaultValue: '# 一' })
    expect(screen.queryByRole('separator', { name: '调整面板宽度' })).toBeNull()
    const rail = screen.getByRole('navigation', { name: '侧边栏' })
    await userEvent.click(within(rail).getByRole('button', { name: '目录' }))
    const panel = screen.getByRole('complementary', { name: '目录' })
    expect(grip()).toHaveAttribute('aria-controls', panel.id)
    expect(grip()).toHaveAttribute('aria-valuenow', '390')
    expect(width()).toBe('390px')
    await userEvent.click(within(rail).getByRole('button', { name: '收起' }))
    expect(screen.queryByRole('separator', { name: '调整面板宽度' })).toBeNull()
  })

  it('键盘：← 加宽 10、→ 收窄 10、Home / End 到最小 / 最大', async () => {
    renderEditor({ defaultPanel: 'toc' })
    grip().focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(grip()).toHaveAttribute('aria-valuenow', '400')
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(grip()).toHaveAttribute('aria-valuenow', '380')
    await userEvent.keyboard('{End}{ArrowLeft}')
    expect(grip()).toHaveAttribute('aria-valuenow', '600')
    await userEvent.keyboard('{Home}')
    expect(grip()).toHaveAttribute('aria-valuenow', '300')
    expect(width()).toBe('300px')
  })

  it('指针拖动：向左拖加宽，拖动中只写 CSS 变量；松开提交；pointercancel 与 Esc 恢复', () => {
    renderEditor({ defaultPanel: 'toc' })
    fireEvent.pointerDown(grip(), { button: 0, pointerId: 1, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 950 })
    expect(width()).toBe('440px')
    expect(grip()).toHaveAttribute('aria-valuenow', '440')
    fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 500 })
    expect(grip()).toHaveAttribute('aria-valuenow', '600')
    fireEvent.pointerUp(grip(), { pointerId: 1 })
    expect(width()).toBe('600px')

    fireEvent.pointerDown(grip(), { button: 0, pointerId: 2, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 2, clientX: 1200 })
    expect(grip()).toHaveAttribute('aria-valuenow', '400')
    fireEvent.pointerCancel(grip(), { pointerId: 2 })
    expect(grip()).toHaveAttribute('aria-valuenow', '600')
    expect(width()).toBe('600px')

    fireEvent.pointerDown(grip(), { button: 0, pointerId: 3, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 3, clientX: 1100 })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(width()).toBe('600px')
  })

  it('非主键按下不开始拖动', () => {
    renderEditor({ defaultPanel: 'toc' })
    fireEvent.pointerDown(grip(), { button: 2, pointerId: 1, clientX: 1000 })
    fireEvent.pointerMove(grip(), { pointerId: 1, clientX: 900 })
    expect(width()).toBe('390px')
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @editorx/markdown test -- panels panel-grip styles`
Expected: FAIL。

- [ ] **Step 4: 实现目录空态**

`toc-panel.tsx` 的 `return` 改为：

```tsx
  if (toc.length === 0) {
    return (
      <div className="ex-mde-toc ex-mde-toc--empty">
        <p className="ex-mde-toc__empty-title">{m.panels.tocEmptyTitle}</p>
        <p className="ex-mde-toc__empty">
          {m.panels.tocEmptyBefore}
          <button type="button" className="ex-mde-toc__add" disabled={ctx.readOnly} onClick={() => ctx.commands.run('toc')}>
            {m.panels.tocEmptyAction}
          </button>
          {m.panels.tocEmptyAfter}
        </p>
      </div>
    )
  }
  return (
    <div className="ex-mde-toc">
      <div className="ex-mde-panel__title" role="heading" aria-level={2}>
        {title ?? m.panels.toc}
      </div>
      <ul className="ex-mde-toc__list">{/* 原 toc.map(...) 不变 */}</ul>
    </div>
  )
```

- [ ] **Step 5: 实现图标栏**

`side-rail.tsx`：删除 lucide 导入，`import { PanelToggleIcon } from '../icons'`；开关按钮 `className="ex-mde-rail__item ex-mde-rail__toggle"`，图标 `<PanelToggleIcon />`（收起 / 展开同一图标）；面板按钮加 `data-panel={panel.id}`。
`core-extensions/panels.tsx`：删除 lucide 导入，`import { SyntaxIcon, TocIcon } from '../icons'`，`icon: <TocIcon />`、`icon: <SyntaxIcon />`。

`styles.css` 图标栏段：
- `.ex-mde-rail__item` 中 `height: 50px;` → `height: 51px;`，`font-size: 12px;` → `font-size: 10px;`，`line-height: 16px;` → `line-height: 14px;`。
- `.ex-mde-rail__label { color: var(--ex-color-mde-status-text); }` → `.ex-mde-rail__label { color: var(--ex-color-mde-rail-label); }`。
- `.ex-mde-rail__item.is-active .ex-mde-rail__label { … }` → `.ex-mde-rail__item.is-active .ex-mde-rail__label { color: var(--ex-color-mde-chrome-text); font-weight: 700; }`。
- 追加 `.ex-mde-rail__toggle[aria-expanded='false'] { color: var(--ex-color-mde-rail-label); }` 与 `.ex-mde-rail__toggle[aria-expanded='true'] .ex-mde-rail__label { color: var(--ex-color-mde-chrome-text); }`。
- `.ex-mde-rail__divider` 的 `margin: 4px 0;` → `margin: 0 0 4px;`。
- 段前注释：`/* 项高 51、间距 4、分隔线下 4px → 分隔线 y 63、首项 72、项距 55（G10）；标签 10px（G11），颜色（G14） */`。

- [ ] **Step 6: 实现拖柄**

`panels/panel-grip.tsx`：

```tsx
import { useMessages } from '@editorx/toolbar'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

export const PANEL_MIN_WIDTH = 300
export const PANEL_MAX_WIDTH = 600
export const PANEL_DEFAULT_WIDTH = 390
export const PANEL_WIDTH_VAR = '--ex-mde-panel-width'
const STEP = 10

export function clampPanelWidth(value: number): number {
  if (!Number.isFinite(value)) return PANEL_DEFAULT_WIDTH
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(value)))
}

/**
 * 右侧面板左缘的宽度拖柄。面板在右侧，向左拖为加宽。拖动中只改 rootRef 上的 CSS 变量与 aria-valuenow
 * （不触发重渲染），松开时 onChange 提交一次；键盘调整立即提交。
 */
export function PanelGrip({
  width,
  onChange,
  rootRef,
  controls,
}: {
  width: number
  onChange(width: number): void
  rootRef: RefObject<HTMLDivElement | null>
  controls: string
}) {
  const m = useMessages()
  const abortRef = useRef<(() => void) | null>(null)

  useEffect(() => () => abortRef.current?.(), [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (abortRef.current) return
    const next =
      e.key === 'ArrowLeft'
        ? width + STEP
        : e.key === 'ArrowRight'
          ? width - STEP
          : e.key === 'Home'
            ? PANEL_MIN_WIDTH
            : e.key === 'End'
              ? PANEL_MAX_WIDTH
              : null
    if (next === null) return
    e.preventDefault()
    onChange(clampPanelWidth(next))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (e.button !== 0 || !root || abortRef.current) return
    e.preventDefault()
    const handle = e.currentTarget
    const pointerId = e.pointerId
    handle.setPointerCapture?.(pointerId)
    const startX = e.clientX
    const start = width
    let current = width
    const apply = (next: number) => {
      current = next
      root.style.setProperty(PANEL_WIDTH_VAR, `${next}px`)
      handle.setAttribute('aria-valuenow', String(next))
    }
    const move = (ev: globalThis.PointerEvent) => {
      const next = clampPanelWidth(start + startX - ev.clientX)
      if (next !== current) apply(next)
    }
    const doc = handle.ownerDocument
    // 捕获阶段先于编辑器的 Esc（退出全屏）：拖动中 Esc 只取消拖动
    const onDocKeyDown = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      ev.stopPropagation()
      cancel()
    }
    const detach = () => {
      abortRef.current = null
      doc.removeEventListener('keydown', onDocKeyDown, true)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', commit)
      handle.removeEventListener('pointercancel', cancel)
      handle.removeEventListener('lostpointercapture', commit)
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId)
    }
    function commit() {
      detach()
      if (current !== start) onChange(current)
    }
    function cancel() {
      detach()
      apply(start)
    }
    abortRef.current = cancel
    doc.addEventListener('keydown', onDocKeyDown, true)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', commit)
    handle.addEventListener('pointercancel', cancel)
    handle.addEventListener('lostpointercapture', commit)
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={m.panels.resize}
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuenow={width}
      aria-controls={controls}
      className="ex-mde-panel-grip"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  )
}
```

`panel-host.tsx`：props 加 `id?: string`，`<aside id={id} className=…>`。

`markdown-editor.tsx`：
1. import `{ PANEL_DEFAULT_WIDTH, PANEL_WIDTH_VAR, PanelGrip } from './panels/panel-grip'`。
2. 在 `const panel = useEditorState(store, (s) => s.panel)` 之后：

```tsx
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH)
  const rightPanelId = `${editorId}-panel`
  const rightOpen = rightPanels.some((p) => p.panel.id === panel)
```

3. `style` 改为 `{ '--ex-mde-height': …, [PANEL_WIDTH_VAR]: `${panelWidth}px` } as CSSProperties`。
4. 右侧面板处：

```tsx
      {rightOpen && <PanelGrip width={panelWidth} onChange={setPanelWidth} rootRef={rootRef} controls={rightPanelId} />}
      <PanelHost id={rightPanelId} position="right" panels={rightPanels} ctx={ctx} store={store} onError={reportError} />
```

   （`editorId`、`rootRef`、`useState` 已存在于组件内；若 `useState` 未导入则补齐。）

`styles.css`：
- `.ex-mde-panel` 的 `width: 390px;` → `width: var(--ex-mde-panel-width, 390px);`。
- 面板段末尾追加：

```css
/* 面板宽度拖柄：零宽 flex 项，负外边距使其位于卡片与面板的 16px 间隙正中；胶囊 4×24 顶 438px（G23） */
.ex-mde-panel-grip {
  position: relative;
  flex: none;
  width: 0;
  margin: 0 -8px;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}
.ex-mde-panel-grip::before { content: ''; position: absolute; top: 0; bottom: 0; left: -8px; width: 16px; }
.ex-mde-panel-grip::after {
  content: '';
  position: absolute;
  top: 438px;
  left: -2px;
  width: 4px;
  height: 24px;
  border-radius: 2px;
  background: var(--ex-color-mde-grip);
}
.ex-mde-panel-grip:focus-visible::after { background: var(--ex-color-primary); }
```

- `.ex-mde-toc__empty { … }` 一行替换为：

```css
/* 目录空态：无标题条，两行 14px 居中（G19/G26；行高 22 为推断） */
.ex-mde-toc--empty { padding: 39px 20px 0; text-align: center; }
.ex-mde-toc__empty-title,
.ex-mde-toc__empty { margin: 0; color: var(--ex-color-mde-toc-empty); font-size: 14px; line-height: 22px; }
.ex-mde-toc__empty { margin-top: 15px; }
.ex-mde-toc__add {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-mde-toc-empty-link);
  font: inherit;
  cursor: pointer;
}
.ex-mde-toc__add:disabled { color: inherit; cursor: default; }
.ex-mde-toc__add:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }
```

- [ ] **Step 7: 运行确认通过**

Run: `pnpm --filter @editorx/markdown test && pnpm --filter @editorx/markdown typecheck && pnpm lint`
Expected: PASS（`panels.test.tsx` 中「侧栏」用例的按钮文字 `['展开', '目录', '语法']` 不变）。

- [ ] **Step 8: 提交**

```bash
git add packages/markdown/src/panels/toc-panel.tsx packages/markdown/src/panels/side-rail.tsx packages/markdown/src/core-extensions/panels.tsx packages/markdown/src/panels/panel-grip.tsx packages/markdown/src/panels/panel-grip.test.tsx packages/markdown/src/panels/panel-host.tsx packages/markdown/src/markdown-editor.tsx packages/markdown/src/panels/panels.test.tsx packages/markdown/src/styles.css packages/markdown/src/styles.test.ts
git commit -m "feat(markdown): 目录空态、图标栏样式与面板宽度拖柄按参考图实现" -m "目录为空时不显示标题条，显示「暂无目录」与可点击的「添加」（G19/G26）；图标栏项高、标签字号与颜色按 mac 参考图（G10/G11/G14/G31），面板按钮带 data-panel 供宿主按面板定制；面板与卡片间新增可拖动、可键盘调整的宽度拖柄（G23，宽度范围为推断）。"
```

---

### Task 9: markdown：比对模式「定位 / 同步滚动」按钮

**Files:**
- Create: `packages/markdown/src/sync-controls.tsx`、`packages/markdown/src/sync-controls.test.tsx`
- Modify: `packages/markdown/src/runtime.ts`
- Modify: `packages/markdown/src/markdown-editor.tsx`
- Modify: `packages/markdown/src/styles.css`、`packages/markdown/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 2 `ScrollSync.syncFrom / setPaused`；Task 3 `editor.syncLocate / syncScroll`；Task 7 `LocateIcon / SyncScrollIcon`
- Produces:

```ts
export interface EditorRuntime {
  // …既有
  /** 比对模式：以编辑区为基准立即对齐预览（同步关闭时也生效） */
  locate(): void
  /** 比对模式同步滚动开关；切换视图重建同步实例后保持 */
  setSyncEnabled(enabled: boolean): void
}
export function SyncControls(props: { enabled: boolean; onLocate(): void; onToggle(): void }): ReactElement
// DOM（仅 data-view=split）：.ex-mde-body > div.ex-mde-sync > button.ex-mde-sync__locate + button.ex-mde-sync__scroll[aria-pressed]
```

位置（G24）：按钮 16×16，`left: calc(var(--ex-mde-split, .5) * 100% - 8px)`（预览区左 + 5），`bottom: 6px`，纵向间距 13；定位 `#9f9f9f`，同步滚动 `#555666`；关闭态颜色与定位相同（inferred default）。默认开启。

- [ ] **Step 1: 写失败测试**

`sync-controls.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderEditor } from './test-utils'

const spies = vi.hoisted(() => ({ syncFrom: [] as string[], paused: [] as boolean[] }))
vi.mock('@editorx/markdown-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@editorx/markdown-core')>()
  return {
    ...actual,
    createScrollSync: (...args: Parameters<typeof actual.createScrollSync>) => {
      const sync = actual.createScrollSync(...args)
      return {
        ...sync,
        syncFrom: (side: 'editor' | 'preview') => {
          spies.syncFrom.push(side)
          sync.syncFrom(side)
        },
        setPaused: (paused: boolean) => {
          spies.paused.push(paused)
          sync.setPaused(paused)
        },
      }
    },
  }
})

beforeEach(() => {
  spies.syncFrom.length = 0
  spies.paused.length = 0
})

describe('比对模式同步按钮（G24）', () => {
  it('只在比对模式渲染；同步滚动默认开启', async () => {
    renderEditor({ defaultViewMode: 'edit' })
    expect(screen.queryByRole('button', { name: '同步滚动' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '定位到编辑位置' })).toBeInTheDocument()
  })

  it('定位：以编辑区为基准立即对齐', async () => {
    renderEditor({ defaultViewMode: 'split' })
    await userEvent.click(screen.getByRole('button', { name: '定位到编辑位置' }))
    expect(spies.syncFrom).toEqual(['editor'])
  })

  it('关闭同步后切换视图再回到比对仍保持关闭；再次点击恢复', async () => {
    renderEditor({ defaultViewMode: 'split' })
    await userEvent.click(screen.getByRole('button', { name: '同步滚动' }))
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'false')
    expect(spies.paused.at(-1)).toBe(true)
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    spies.paused.length = 0
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    expect(screen.getByRole('button', { name: '同步滚动' })).toHaveAttribute('aria-pressed', 'false')
    expect(spies.paused).toContain(true)
    await userEvent.click(screen.getByRole('button', { name: '同步滚动' }))
    expect(spies.paused.at(-1)).toBe(false)
  })
})
```

`styles.test.ts` 追加：

```ts
  it('比对模式同步按钮位于预览区左下（G24）', () => {
    expect(css).toMatch(
      /\.ex-mde-sync \{[^}]*position: absolute;[^}]*bottom: 6px;[^}]*left: calc\(var\(--ex-mde-split, 0\.5\) \* 100% - 8px\);[^}]*gap: 13px;/,
    )
    expect(css).toMatch(/\.ex-mde-sync__locate \{ color: var\(--ex-color-mde-sync-locate\); \}/)
    expect(css).toMatch(/\.ex-mde-sync__scroll \{ color: var\(--ex-color-mde-sync-scroll\); \}/)
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/markdown test -- sync-controls styles`
Expected: FAIL。

- [ ] **Step 3: 实现运行时**

`runtime.ts`：
1. `EditorRuntime` 加入 Interfaces 中两个方法。
2. `const syncRef = …` 之后加 `const syncPaused = useRef(false)`。
3. `runtime` 对象加：

```ts
      locate: () => syncRef.current?.syncFrom('editor'),
      setSyncEnabled(enabled) {
        syncPaused.current = !enabled
        syncRef.current?.setPaused(!enabled)
      },
```

4. 比对模式 effect 中 `syncRef.current = sync` 之后、`sync.refresh()` 之前加 `if (syncPaused.current) sync.setPaused(true)`。

- [ ] **Step 4: 实现按钮**

`sync-controls.tsx`：

```tsx
import { useMessages } from '@editorx/toolbar'
import { LocateIcon, SyncScrollIcon } from './icons'

export function SyncControls({ enabled, onLocate, onToggle }: { enabled: boolean; onLocate(): void; onToggle(): void }) {
  const m = useMessages()
  return (
    <div className="ex-mde-sync">
      <button type="button" className="ex-mde-sync__locate" aria-label={m.editor.syncLocate} title={m.editor.syncLocate} onClick={onLocate}>
        <LocateIcon />
      </button>
      <button
        type="button"
        className="ex-mde-sync__scroll"
        aria-label={m.editor.syncScroll}
        title={m.editor.syncScroll}
        aria-pressed={enabled}
        onClick={onToggle}
      >
        <SyncScrollIcon />
      </button>
    </div>
  )
}
```

`markdown-editor.tsx`：import `SyncControls`；组件内加 `const [syncEnabled, setSyncEnabled] = useState(true)`；`.ex-mde-body` 中 Splitter 之后加：

```tsx
          {viewMode === 'split' && (
            <SyncControls
              enabled={syncEnabled}
              onLocate={() => runtime.locate()}
              onToggle={() => {
                const next = !syncEnabled
                setSyncEnabled(next)
                runtime.setSyncEnabled(next)
              }}
            />
          )}
```

`styles.css`（编辑区 / 预览区段末尾）：

```css
/* 比对模式「定位 / 同步滚动」：预览区左缘 + 5px、距底 6px，纵向间距 13（G24） */
.ex-mde-sync {
  position: absolute;
  bottom: 6px;
  left: calc(var(--ex-mde-split, 0.5) * 100% - 8px);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.ex-mde-sync button {
  display: inline-flex;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.ex-mde-sync button:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }
.ex-mde-sync__locate { color: var(--ex-color-mde-sync-locate); }
.ex-mde-sync__scroll { color: var(--ex-color-mde-sync-scroll); }
.ex-mde-sync__scroll[aria-pressed='false'] { color: var(--ex-color-mde-sync-locate); }
```

- [ ] **Step 5: 运行确认通过并构建**

Run: `pnpm --filter @editorx/markdown test && pnpm --filter @editorx/markdown typecheck && pnpm --filter @editorx/markdown build && pnpm lint`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add packages/markdown/src/sync-controls.tsx packages/markdown/src/sync-controls.test.tsx packages/markdown/src/runtime.ts packages/markdown/src/markdown-editor.tsx packages/markdown/src/styles.css packages/markdown/src/styles.test.ts
git commit -m "feat(markdown): 比对模式新增「定位」与「同步滚动」开关" -m "参考图比对模式预览区左下有两个按钮（G24）：定位立即把预览对齐到编辑位置，同步滚动可关闭；关闭状态在切换视图后保持。关闭态外观为推断。"
```

### Task 10: publish：定时发布时间区间逻辑与校验规则

**Files:**
- Modify: `packages/publish/src/schedule.ts`
- Create: `packages/publish/src/schedule.test.ts`、`packages/publish/src/schedule-dst.test.ts`
- Modify: `packages/publish/src/validate.ts`、`packages/publish/src/logic.test.ts`
- Modify: `packages/publish/src/use-publish-controller.ts`、`packages/publish/src/controller.test.tsx`
- Modify: `packages/publish/src/types.ts`、`packages/publish/src/index.ts`
- Modify: `packages/publish/src/publish-panel.tsx`、`packages/publish/src/schedule-dialog.tsx`、`packages/publish/src/publish-panel.test.tsx`（Step 6：临时默认值 now+5h 与第 214、218 行期望）

**Interfaces:**
- Consumes: Task 3 的 `publish.schedule.units`、`publish.errors.scheduledAtTooSoon / scheduledAtTooLate`；Task 5 的 `timeSlots`、`toDateKey`、`addDays`、`TimeOption`、`DateKey`（`@editorx/ui` dist）
- Produces:

```ts
// schedule.ts
export const SCHEDULE_MIN_OFFSET_MS: number // 4h（B34）
export const SCHEDULE_MAX_OFFSET_MS: number // 7d（B34）
export interface ScheduleRange {
  /** 距当前时间的最小提前量（ms），闭区间 */
  minOffsetMs: number
  /** 最大提前量（ms），闭区间；按绝对毫秒计 */
  maxOffsetMs: number
}
export const DEFAULT_SCHEDULE_RANGE: ScheduleRange
export function scheduleBounds(now: number, range?: ScheduleRange): { min: number; max: number }
export function combineLocal(date: string, time: string): number | undefined
export function scheduleTimeSlots(date: string, now: number, range?: ScheduleRange, stepMinutes?: number): TimeOption[]
export function scheduleDateLimits(now: number, range?: ScheduleRange, stepMinutes?: number): { min: DateKey; max: DateKey } | undefined
export function formatOffset(ms: number, units: Messages['publish']['schedule']['units']): string
// 保留：toLocalInputValue / fromLocalInputValue / formatScheduleTime；删除：defaultScheduleTime

// validate.ts
export interface RuleContext {
  messages: Messages['publish']
  now: number
  title?: string
  /** 定时发布允许区间，默认 DEFAULT_SCHEDULE_RANGE */
  scheduleRange?: ScheduleRange
}

// types.ts —— PublishBaseProps 新增
/** 定时发布允许的提前量区间，默认 4 小时 ～ 7 天（CSDN） */
scheduleRange?: ScheduleRange

// use-publish-controller.ts —— PublishControllerOptions 新增
scheduleRange?: ScheduleRange
```

- [ ] **Step 1: 写失败测试（区间工具，固定时区）**

`schedule.test.ts`（新建）：

```ts
process.env.TZ = 'Asia/Shanghai'

import { zhCN } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import {
  combineLocal,
  DEFAULT_SCHEDULE_RANGE,
  formatOffset,
  scheduleBounds,
  scheduleDateLimits,
  scheduleTimeSlots,
} from './schedule'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = new Date(2026, 9, 9, 12, 0).getTime()
const slot = (date: string, value: string, now = NOW) => scheduleTimeSlots(date, now).find((s) => s.value === value)

describe('定时发布区间（B34：now+4h … now+7d，闭区间）', () => {
  it('默认区间与边界', () => {
    expect(DEFAULT_SCHEDULE_RANGE).toEqual({ minOffsetMs: 4 * HOUR, maxOffsetMs: 7 * DAY })
    expect(scheduleBounds(NOW)).toEqual({ min: NOW + 4 * HOUR, max: NOW + 7 * DAY })
  })

  it('combineLocal：本地日期 + HH:mm；格式无效为 undefined', () => {
    expect(combineLocal('2026-10-10', '10:00')).toBe(new Date(2026, 9, 10, 10, 0).getTime())
    expect(combineLocal('2026-10-10', '24:00')).toBeUndefined()
    expect(combineLocal('2026-02-30', '10:00')).toBeUndefined()
    expect(combineLocal('20261010', '10:00')).toBeUndefined()
    expect(combineLocal('2026-10-10', '9:00')).toBeUndefined()
  })

  it('时间档：起止档含边界，越界禁用（30 分钟一档）', () => {
    expect(scheduleTimeSlots('2026-10-09', NOW)).toHaveLength(48)
    expect(slot('2026-10-09', '15:30')).toEqual({ value: '15:30', disabled: true })
    expect(slot('2026-10-09', '16:00')).toEqual({ value: '16:00', disabled: false })
    expect(slot('2026-10-16', '12:00')).toEqual({ value: '12:00', disabled: false })
    expect(slot('2026-10-16', '12:30')).toEqual({ value: '12:30', disabled: true })
    expect(scheduleTimeSlots('2026-10-17', NOW).every((s) => s.disabled)).toBe(true)
  })

  it('可选日期：首末日至少有一个可用时间档', () => {
    expect(scheduleDateLimits(NOW)).toEqual({ min: '2026-10-09', max: '2026-10-16' })
    // 20:10 → 最早 00:10 次日，首档 00:30
    expect(scheduleDateLimits(new Date(2026, 9, 9, 20, 10).getTime())).toEqual({ min: '2026-10-10', max: '2026-10-16' })
    // 19:50 → 最早 23:50 当天，当天已无可用档（23:30 < 23:50）
    expect(scheduleDateLimits(new Date(2026, 9, 9, 19, 50).getTime())?.min).toBe('2026-10-10')
    // 区间内没有任何整档 → undefined
    expect(scheduleDateLimits(NOW + 60_000, { minOffsetMs: 0, maxOffsetMs: 60_000 })).toBeUndefined()
  })

  it('formatOffset：整天用天，整小时用小时，否则分钟', () => {
    const units = zhCN.publish.schedule.units
    expect(formatOffset(4 * HOUR, units)).toBe('4小时')
    expect(formatOffset(7 * DAY, units)).toBe('7天')
    expect(formatOffset(90 * 60_000, units)).toBe('90分钟')
    expect(formatOffset(0, units)).toBe('0分钟')
  })
})
```

`schedule-dst.test.ts`（新建）：

```ts
process.env.TZ = 'America/New_York'

import { describe, expect, it } from 'vitest'
import { combineLocal, scheduleTimeSlots } from './schedule'

const slot = (date: string, value: string, now: number) => scheduleTimeSlots(date, now).find((s) => s.value === value)

describe('定时发布 × 夏令时（America/New_York）', () => {
  it('春令时：2026-03-08 02:00–02:59 不存在，对应时间档禁用，combineLocal 为 undefined', () => {
    const now = new Date(2026, 2, 7, 12, 0).getTime()
    expect(combineLocal('2026-03-08', '02:30')).toBeUndefined()
    expect(slot('2026-03-08', '02:00', now)?.disabled).toBe(true)
    expect(slot('2026-03-08', '02:30', now)?.disabled).toBe(true)
    expect(slot('2026-03-08', '03:00', now)?.disabled).toBe(false)
  })

  it('最大值按绝对毫秒：now + 7×24h 跨春令时后本地时刻晚 1 小时', () => {
    const now = new Date(2026, 2, 7, 12, 0).getTime()
    expect(slot('2026-03-14', '13:00', now)?.disabled).toBe(false)
    expect(slot('2026-03-14', '13:30', now)?.disabled).toBe(true)
  })

  it('最小值跨春令时：23:00 EST + 4h = 04:00 EDT', () => {
    const now = new Date(2026, 2, 7, 23, 0).getTime()
    expect(slot('2026-03-08', '03:30', now)?.disabled).toBe(true)
    expect(slot('2026-03-08', '04:00', now)?.disabled).toBe(false)
  })

  it('秋令时：2026-11-01 01:30 出现两次，取第一次（EDT），仍可选', () => {
    const now = new Date(2026, 9, 30, 12, 0).getTime()
    expect(combineLocal('2026-11-01', '01:30')).toBe(new Date(2026, 10, 1, 1, 30).getTime())
    expect(slot('2026-11-01', '01:30', now)?.disabled).toBe(false)
  })
})
```

- [ ] **Step 2: 写失败测试（校验规则与控制器）**

`logic.test.ts`：
1. 第 5 行 import 改为 `import { formatScheduleTime, fromLocalInputValue, toLocalInputValue } from './schedule'`。
2. 第 18 行后加 `const HOUR = 3_600_000` 与 `const DAY = 24 * HOUR`。
3. 「定时时间需有效且晚于当前」用例（第 96–100 行）整体替换为：

```ts
  it('定时时间：有效、晚于当前，且在 now+4h … now+7d 闭区间内（B34，文案 B27）', () => {
    const at = (ms: number) => valid({ scheduledAt: new Date(ms).toISOString() })
    const hint = '请选择当前时间后 4小时 至 7天 进行定时发布'
    expect(validatePublish(valid({ scheduledAt: 'abc' }), ctx()).scheduledAt).toBe('请选择有效的发布时间')
    expect(validatePublish(at(NOW), ctx()).scheduledAt).toBe('发布时间需晚于当前时间')
    expect(validatePublish(at(NOW + 60_000), ctx()).scheduledAt).toBe(hint)
    expect(validatePublish(at(NOW + 4 * HOUR - 1), ctx()).scheduledAt).toBe(hint)
    expect(validatePublish(at(NOW + 4 * HOUR), ctx()).scheduledAt).toBeUndefined()
    expect(validatePublish(at(NOW + 7 * DAY), ctx()).scheduledAt).toBeUndefined()
    expect(validatePublish(at(NOW + 7 * DAY + 1), ctx()).scheduledAt).toBe(hint)
  })

  it('scheduleRange 覆盖默认区间，错误文案随之变化', () => {
    const range = { minOffsetMs: 30 * 60_000, maxOffsetMs: DAY }
    const at = (ms: number) => valid({ scheduledAt: new Date(ms).toISOString() })
    expect(validatePublish(at(NOW + 60_000), ctx({ scheduleRange: range })).scheduledAt).toBe(
      '请选择当前时间后 30分钟 至 1天 进行定时发布',
    )
    expect(validatePublish(at(NOW + 30 * 60_000), ctx({ scheduleRange: range })).scheduledAt).toBeUndefined()
  })
```

4. 删除 `describe('schedule')` 中「默认定时：一小时后向上取整到 5 分钟」用例（第 148–151 行）。

`controller.test.tsx`：
1. 「定时发布：payload 带 scheduledAt；过去时间报错」中 `new Date(2026, 9, 9, 13, 5)` 改为 `new Date(2026, 9, 9, 17, 5)`，toast 期望改为 `'已设置定时发布：2026-10-09 17:05'`。
2. 其后追加：

```tsx
  it('scheduleRange 选项参与校验', async () => {
    const { result, onPublish } = setup({
      defaultValue: { tags: ['React'] },
      scheduleRange: { minOffsetMs: 0, maxOffsetMs: 24 * 3_600_000 },
    })
    await act(async () => {
      await result.current.publish(new Date(NOW + 60_000).toISOString())
    })
    expect(onPublish).toHaveBeenCalledTimes(1)
    await act(async () => {
      await result.current.publish(new Date(NOW + 25 * 3_600_000).toISOString())
    })
    expect(result.current.errors.scheduledAt).toBe('请选择当前时间后 0分钟 至 1天 进行定时发布')
    expect(onPublish).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @editorx/publish test -- schedule logic controller`
Expected: FAIL（导出不存在、区间错误未产生）。

- [ ] **Step 4: 实现 schedule.ts**

删除 `defaultScheduleTime` 与其常量；文件顶部补 import 并追加：

```ts
import { formatMessage, type Messages } from '@editorx/toolbar'
import { addDays, timeSlots, toDateKey, type DateKey, type TimeOption } from '@editorx/ui'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const SCHEDULE_MIN_OFFSET_MS = 4 * HOUR
export const SCHEDULE_MAX_OFFSET_MS = 7 * DAY

export interface ScheduleRange {
  /** 距当前时间的最小提前量（ms），闭区间 */
  minOffsetMs: number
  /** 最大提前量（ms），闭区间；按绝对毫秒计，跨夏令时本地时刻可能偏 1 小时 */
  maxOffsetMs: number
}

export const DEFAULT_SCHEDULE_RANGE: ScheduleRange = {
  minOffsetMs: SCHEDULE_MIN_OFFSET_MS,
  maxOffsetMs: SCHEDULE_MAX_OFFSET_MS,
}

export function scheduleBounds(now: number, range: ScheduleRange = DEFAULT_SCHEDULE_RANGE) {
  return { min: now + range.minOffsetMs, max: now + range.maxOffsetMs }
}

/** 本地日期 + 'HH:mm' → 时间戳；格式无效或该本地时刻不存在（夏令时跳过的时段）时为 undefined */
export function combineLocal(date: string, time: string): number | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return undefined
  const [year, month, day] = [Number(d[1]), Number(d[2]) - 1, Number(d[3])]
  const [hours, minutes] = [Number(t[1]), Number(t[2])]
  const value = new Date(year, month, day, hours, minutes)
  const same =
    value.getFullYear() === year &&
    value.getMonth() === month &&
    value.getDate() === day &&
    value.getHours() === hours &&
    value.getMinutes() === minutes
  return same ? value.getTime() : undefined
}

/** 某本地日期的全部时间档；不存在的时刻与区间外的时刻禁用 */
export function scheduleTimeSlots(
  date: string,
  now: number,
  range: ScheduleRange = DEFAULT_SCHEDULE_RANGE,
  stepMinutes = 30,
): TimeOption[] {
  const { min, max } = scheduleBounds(now, range)
  return timeSlots(stepMinutes).map((value) => {
    const at = combineLocal(date, value)
    return { value, disabled: at === undefined || at < min || at > max }
  })
}

/** 可选日期区间：首末日都至少有一个可用时间档；区间内没有整档时为 undefined */
export function scheduleDateLimits(
  now: number,
  range: ScheduleRange = DEFAULT_SCHEDULE_RANGE,
  stepMinutes = 30,
): { min: DateKey; max: DateKey } | undefined {
  const { min, max } = scheduleBounds(now, range)
  const usable = (date: DateKey) => scheduleTimeSlots(date, now, range, stepMinutes).some((s) => !s.disabled)
  let first = toDateKey(new Date(min))
  let last = toDateKey(new Date(max))
  if (!usable(first)) first = addDays(first, 1)
  if (!usable(last)) last = addDays(last, -1)
  return first <= last && usable(first) ? { min: first, max: last } : undefined
}

export function formatOffset(ms: number, units: Messages['publish']['schedule']['units']): string {
  if (ms > 0 && ms % DAY === 0) return formatMessage(units.days, { count: ms / DAY })
  if (ms > 0 && ms % HOUR === 0) return formatMessage(units.hours, { count: ms / HOUR })
  return formatMessage(units.minutes, { count: Math.round(ms / MINUTE) })
}
```

- [ ] **Step 5: 实现校验与透传**

`validate.ts`：
1. import 加 `formatMessage`（若未导入）与 `import { DEFAULT_SCHEDULE_RANGE, formatOffset, scheduleBounds, type ScheduleRange } from './schedule'`。
2. `RuleContext` 加 `scheduleRange?: ScheduleRange`（含 Interfaces 中的注释）。
3. `builtinRules.scheduledAt` 改为：

```ts
  scheduledAt: ({ scheduledAt }, { messages, now, scheduleRange = DEFAULT_SCHEDULE_RANGE }) => {
    if (scheduledAt === undefined) return undefined
    const time = Date.parse(scheduledAt)
    if (Number.isNaN(time)) return messages.errors.scheduledAtInvalid
    if (time <= now) return messages.errors.scheduledAtPast
    const { min, max } = scheduleBounds(now, scheduleRange)
    const vars = {
      min: formatOffset(scheduleRange.minOffsetMs, messages.schedule.units),
      max: formatOffset(scheduleRange.maxOffsetMs, messages.schedule.units),
    }
    if (time < min) return formatMessage(messages.errors.scheduledAtTooSoon, vars)
    if (time > max) return formatMessage(messages.errors.scheduledAtTooLate, vars)
    return undefined
  },
```

`use-publish-controller.ts`：`PublishControllerOptions` 加 `scheduleRange?: ScheduleRange`（import type 自 `./schedule`），解构后在校验调用中传入：`validatePublish(target, { messages, now: now(), title: doc?.title, scheduleRange }, rules)`。

`types.ts`：`PublishBaseProps` 在 `rules` 之后加 Interfaces 中的 `scheduleRange?: ScheduleRange`（`import type { ScheduleRange } from './schedule'`）。

`publish-panel.tsx` 的 `usePublishController({ … })` 调用加一行 `scheduleRange: props.scheduleRange,`。

`index.ts`：

```ts
export {
  DEFAULT_SCHEDULE_RANGE,
  fromLocalInputValue,
  SCHEDULE_MAX_OFFSET_MS,
  SCHEDULE_MIN_OFFSET_MS,
  toLocalInputValue,
} from './schedule'
export type { ScheduleRange } from './schedule'
```

- [ ] **Step 6: 运行确认通过**

先做两处临时改动，保证全量 publish 测试与 typecheck 通过（Task 11 会整体重写弹窗与这些用例）：

1. `schedule-dialog.tsx`：import 删去 `defaultScheduleTime`；初始值 `useState(() => toLocalInputValue(defaultScheduleTime(Date.now())))` 改为 `useState(() => toLocalInputValue(new Date(Date.now() + 5 * 3_600_000)))`。用 +5h 而不是 +4h：`toLocalInputValue` 截掉秒与毫秒，now+4h 截断后会落在最小值之前，触发 tooSoon。
2. `publish-panel.test.tsx`「定时发布：选择时间后发布」用例：`'2099-01-01T10:00'` 只出现在第 214 行，2099 年超出 7 天上限。第 214 行与第 218 行的期望改为：

```tsx
    const value = toLocalInputValue(new Date(Date.now() + 5 * 3_600_000))
    fireEvent.change(input, { target: { value } })
```

```tsx
        expect.objectContaining({ scheduledAt: fromLocalInputValue(value) }),
```

   文件顶部加 `import { fromLocalInputValue, toLocalInputValue } from './schedule'`。第 224–236 行「时间早于当前」用例的 `'2000-01-01T10:00'` 不改（仍先命中 `scheduledAtPast`）；第 310 行 busy 用例直接用弹窗初始值（now+5h，区间内）。

Run: `pnpm --filter @editorx/publish test && pnpm --filter @editorx/publish typecheck`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/publish/src/schedule.ts packages/publish/src/schedule.test.ts packages/publish/src/schedule-dst.test.ts packages/publish/src/validate.ts packages/publish/src/logic.test.ts packages/publish/src/use-publish-controller.ts packages/publish/src/controller.test.tsx packages/publish/src/types.ts packages/publish/src/index.ts packages/publish/src/publish-panel.tsx packages/publish/src/schedule-dialog.tsx packages/publish/src/publish-panel.test.tsx
git commit -m "feat(publish): 定时发布限定在当前时间后 4 小时至 7 天" -m "CSDN 定时发布提示「请选择当前时间后 4小时 至 7天 进行定时发布」（B27/B34），校验新增 tooSoon / tooLate，边界为闭区间并按绝对毫秒计算；宿主可用 scheduleRange 覆盖。时间档跳过夏令时不存在的本地时刻。破坏性：提前不足 4 小时的定时发布现在会校验失败。"
```

---

### Task 11: publish：定时发布弹窗（日期 + 时间选择器）

**Files:**
- Modify（重写）: `packages/publish/src/schedule-dialog.tsx`
- Create: `packages/publish/src/schedule-dialog.test.tsx`
- Modify: `packages/publish/src/publish-panel.tsx`、`packages/publish/src/publish-panel.test.tsx`（第 207–249、310–331 行定时用例）
- Modify: `packages/publish/src/styles.css`、`packages/publish/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 5 `DatePicker` / `TimePicker`；Task 10 `scheduleDateLimits` / `scheduleTimeSlots` / `combineLocal` / `formatOffset` / `DEFAULT_SCHEDULE_RANGE`；Task 1 `--ex-color-pub-schedule-mask` / `pub-dialog-text` / `pub-dialog-close`；既有 `--ex-color-pub-border` / `pub-disabled-bg` / `pub-disabled-border` / `pub-placeholder-modal` / `--ex-color-text-secondary`
- Produces:

```ts
export interface ScheduleDialogProps {
  range?: ScheduleRange // 默认 DEFAULT_SCHEDULE_RANGE
  /** 发布时间校验失败的文案；有值时替换提示行并 role="alert" */
  error?: string
  busy?: boolean
  onCancel(): void
  onConfirm(iso: string): void
}
// DOM：Modal.ex-pub-schedule（366 宽，mask .ex-pub-schedule-mask）
//   body > p.ex-pub-schedule__hint|__error + div.ex-pub-schedule__fields > DatePicker.ex-pub-schedule__date + TimePicker.ex-pub-schedule__time
//   footer > Button.ex-pub-schedule__cancel「取 消」 + Button.ex-pub-schedule__confirm「定时发布」
// 确认按钮始终可点（R-0901 为实心 #fc5531）：未选日期 / 时间或越界时不调用 onConfirm，提示行改为 .ex-pub-schedule__error[role=alert]（文案同提示）
```

确认按钮（controller 裁定，inferred default）：与 R-0901 一致始终可点；点击时若未选日期 / 时间，或所选时刻按点击当时的 `Date.now()` 已越出区间，则不提交，提示行以错误色显示区间提示并 `role="alert"`；改选日期 / 时间后恢复为普通提示。输入框颜色（§3.3）：边框 `--ex-color-pub-border`（#dcdfe6）；禁用的时间框底色 `--ex-color-pub-disabled-bg`（#f5f7fa）、边框 `--ex-color-pub-disabled-border`（#e4e7ed）；图标与占位 `--ex-color-pub-placeholder-modal`（#c0c4cc）。这些覆盖写在 publish 的 `styles.css`（`.ex-pub-schedule .ex-picker-input…`），ui 保留通用默认值。取消按钮文字 `--ex-color-text-secondary`（#555666，B29）。

几何（B25–B33，弹窗 366×218）：标题行 padding `20px 20px 0`、标题 18/24 粗体；关闭按钮 24×24 于 top 20.5 / right 16，X 墨迹 10×10（20px 图标、描边 1.2）；提示 14/20，`margin: 10px 0 12px`；输入框 155×40、间距 12；footer `padding: 40px 20px 20px`、按钮间距 20.5；取消 74.5×30，确认 96×32；遮罩 `rgba(0,0,0,.5)`。高度核算：44 + 42 + 40 + 92 = 218。日期面板外观为 inferred default（B26）。

- [ ] **Step 1: 写失败测试（弹窗组件）**

`schedule-dialog.test.tsx`（新建）：

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleDialog, type ScheduleDialogProps } from './schedule-dialog'
import { renderWithProviders } from './test-utils'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
})
afterEach(() => vi.useRealTimers())

function open(props: Partial<ScheduleDialogProps> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  renderWithProviders(<ScheduleDialog onConfirm={onConfirm} onCancel={onCancel} {...props} />)
  return { onConfirm, onCancel, dialog: screen.getByRole('dialog', { name: '定时发布' }) }
}

async function openCalendar(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: '发布日期' }))
  return screen.findByRole('dialog', { name: '发布日期' })
}

async function pick(dialog: HTMLElement, date: string, time: string) {
  await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: date }))
  await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
  await userEvent.click(await screen.findByRole('option', { name: time }))
}

describe('ScheduleDialog', () => {
  it('提示、按钮文案、遮罩；未选日期时时间框禁用，确认按钮仍可点（B25–B28）', () => {
    const { dialog } = open()
    expect(dialog).toHaveClass('ex-pub-schedule')
    expect(document.querySelector('.ex-pub-schedule-mask')).not.toBeNull()
    expect(within(dialog).getByText('请选择当前时间后 4小时 至 7天 进行定时发布')).toHaveClass('ex-pub-schedule__hint')
    expect(within(dialog).getByRole('button', { name: '取 消' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: '定时发布' })).toBeEnabled()
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '发布日期' })).toHaveTextContent('选择日期')
  })

  it('未选日期 / 时间时点确认：不提交，提示行变为错误并 role=alert；选择后恢复普通提示', async () => {
    const { dialog, onConfirm } = open()
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveClass('ex-pub-schedule__error')
    expect(alert).toHaveTextContent('请选择当前时间后 4小时 至 7天 进行定时发布')
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-10' }))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(within(dialog).getByText('请选择当前时间后 4小时 至 7天 进行定时发布')).toHaveClass('ex-pub-schedule__hint')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('所选时刻在点击时已越界（时间流逝）：不提交并显示错误', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-09', '16:00')
    vi.setSystemTime(new Date(2026, 9, 9, 12, 1))
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('请选择当前时间后 4小时 至 7天 进行定时发布')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('日期 min / max：今天到 7 天后可选，之外禁用', async () => {
    const { dialog } = open()
    const calendar = await openCalendar(dialog)
    expect(within(calendar).getByRole('button', { name: '2026-10-08' })).toBeDisabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-09' })).toBeEnabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-16' })).toBeEnabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-17' })).toBeDisabled()
  })

  it('时间档按所选日期禁用：当天 16:00 起，第 7 天 12:00 止', async () => {
    const { dialog } = open()
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-09' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
    expect(await screen.findByRole('option', { name: '15:30' })).toBeDisabled()
    expect(screen.getByRole('option', { name: '16:00' })).toBeEnabled()
  })

  it('选择日期与时间后确认，回传 ISO', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-10', '10:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(onConfirm).toHaveBeenCalledWith(new Date(2026, 9, 10, 10, 0).toISOString())
  })

  it('改选日期后原时间越界：时间视为未选，点确认不提交', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-09', '16:00')
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-16' }))
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toHaveTextContent('选择时间')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('error 替换提示并 role=alert；busy 时确认 loading', () => {
    const { dialog } = open({ error: '请选择当前时间后 4小时 至 7天 进行定时发布', busy: true })
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveClass('ex-pub-schedule__error')
    expect(dialog.querySelector('.ex-pub-schedule__hint')).toBeNull()
    expect(within(dialog).getByRole('button', { name: '定时发布' })).toHaveAttribute('aria-busy', 'true')
  })

  it('range 覆盖提示；取消回调', async () => {
    const { dialog, onCancel } = open({ range: { minOffsetMs: 0, maxOffsetMs: 24 * 3_600_000 } })
    expect(within(dialog).getByText('请选择当前时间后 0分钟 至 1天 进行定时发布')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '取 消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

（ui `Select` 选项用原生 `disabled`；`Button` 的 `loading` 输出 `aria-busy="true"` 且 `disabled`。）

`publish-panel.test.tsx`：
1. 第 5 行 vitest import 补 `afterEach, beforeEach`；文件顶部加辅助函数：

```tsx
async function pickSchedule(dialog: HTMLElement, date: string, time: string) {
  await userEvent.click(within(dialog).getByRole('button', { name: '发布日期' }))
  const calendar = await screen.findByRole('dialog', { name: '发布日期' })
  await userEvent.click(within(calendar).getByRole('button', { name: date }))
  await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
  await userEvent.click(await screen.findByRole('option', { name: time }))
}
```

2. 把第 207–249 行与第 310–331 行的四个定时用例移入新的 `describe('定时发布', () => { … })`，其内：

```tsx
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
  })
  afterEach(() => vi.useRealTimers())
```

   四个用例改写为：
   - 成功：打开后 `pickSchedule(dialog, '2026-10-10', '10:00')`，点 `within(dialog).getByRole('button', { name: '定时发布' })`，断言 `onPublish` 收到 `scheduledAt: new Date(2026, 9, 10, 10, 0).toISOString()`，弹窗关闭。
   - 时间流逝越界：`pickSchedule(dialog, '2026-10-09', '16:00')` → `vi.setSystemTime(new Date(2026, 9, 9, 12, 1))` → 点确认 → `expect(await within(dialog).findByRole('alert')).toHaveTextContent('请选择当前时间后 4小时 至 7天 进行定时发布')`，弹窗仍在，`onPublish` 未调用（弹窗在点击时按当前时间本地拦截）。
   - 新增「未选日期直接确认」：打开后直接点 `within(dialog).getByRole('button', { name: '定时发布' })`，断言 `within(dialog).getByRole('alert')` 文案为区间提示、弹窗仍在、`onPublish` 未调用。
   - 其他字段失败：先 `pickSchedule(dialog, '2026-10-10', '10:00')` 再确认，其余断言（弹窗关闭、聚焦首个错误字段）不变。
   - busy：先 `pickSchedule` 再确认，`within(dialog).getByRole('button', { name: '定时发布' })` 断言 `aria-busy="true"`。
3. 删除 Task 10 Step 6 加入的 `fromLocalInputValue` / `toLocalInputValue` 导入与临时值。

`styles.test.ts`（publish）追加：

```ts
  it('定时发布弹窗几何（B25–B33）', () => {
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__header \{[^}]*padding: 20px 20px 0;/)
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__body \{[^}]*padding: 0 24px 0 20px;/)
    expect(css).toMatch(/\.ex-pub-schedule__fields \{[^}]*gap: 12px;/)
    expect(css).toMatch(/\.ex-pub-schedule \.ex-modal__footer \{[^}]*padding: 40px 20px 20px;/)
    expect(css).toMatch(/\.ex-pub-schedule-mask \{[^}]*background: var\(--ex-color-pub-schedule-mask\);/)
  })

  it('定时发布输入框与取消按钮颜色（B29、§3.3）', () => {
    expect(css).toMatch(/\.ex-pub-schedule \.ex-picker-input \{ border-color: var\(--ex-color-pub-border\); \}/)
    expect(css).toMatch(
      /\.ex-pub-schedule \.ex-picker-input:disabled \{ background: var\(--ex-color-pub-disabled-bg\); border-color: var\(--ex-color-pub-disabled-border\); \}/,
    )
    expect(css).toMatch(
      /\.ex-pub-schedule \.ex-picker-input__icon,\n\.ex-pub-schedule \.ex-picker-input\.is-placeholder \.ex-picker-input__value,\n\.ex-pub-schedule \.ex-picker-input\.is-placeholder \.ex-select__value \{ color: var\(--ex-color-pub-placeholder-modal\); \}/,
    )
    expect(css).toMatch(/\.ex-pub-schedule__cancel \{[^}]*color: var\(--ex-color-text-secondary\);/)
    expect(css).not.toMatch(/\.ex-pub-schedule__(date|time)[^{]*\{[^}]*pub-picker-border/)
  })
```

（`css` 是该文件第 6 行已读入并去掉注释的 `styles.css`。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/publish test -- schedule-dialog publish-panel styles`
Expected: FAIL。

- [ ] **Step 3: 重写 `schedule-dialog.tsx`**

```tsx
import { formatMessage, useMessages } from '@editorx/toolbar'
import { Button, DatePicker, Modal, TimePicker } from '@editorx/ui'
import { useState } from 'react'
import {
  combineLocal,
  DEFAULT_SCHEDULE_RANGE,
  formatOffset,
  scheduleBounds,
  scheduleDateLimits,
  scheduleTimeSlots,
  type ScheduleRange,
} from './schedule'

export interface ScheduleDialogProps {
  range?: ScheduleRange
  /** 发布时间校验失败的文案；有值时替换提示行 */
  error?: string
  busy?: boolean
  onCancel(): void
  onConfirm(iso: string): void
}

/** 只在打开时挂载：可选区间按挂载时（客户端）的当前时间计算 */
export function ScheduleDialog({ range = DEFAULT_SCHEDULE_RANGE, error, busy = false, onCancel, onConfirm }: ScheduleDialogProps) {
  const m = useMessages()
  const s = m.publish.schedule
  const [now] = useState(() => Date.now())
  const [date, setDate] = useState<string>()
  const [time, setTime] = useState<string>()
  const [invalid, setInvalid] = useState(false)
  const limits = scheduleDateLimits(now, range)
  const slots = date ? scheduleTimeSlots(date, now, range) : []
  // 改选日期后原时间不可用则视为未选（派生，不在 effect 里清空）
  const validTime = slots.some((slot) => slot.value === time && !slot.disabled) ? time : undefined
  const at = date && validTime ? combineLocal(date, validTime) : undefined
  const hint = formatMessage(s.hint, {
    min: formatOffset(range.minOffsetMs, s.units),
    max: formatOffset(range.maxOffsetMs, s.units),
  })
  const message = error ?? (invalid ? hint : undefined)
  const confirm = () => {
    // 区间按点击时的当前时间判断：弹窗开着时时间仍在流逝
    const { min, max } = scheduleBounds(Date.now(), range)
    if (at === undefined || at < min || at > max) {
      setInvalid(true)
      return
    }
    onConfirm(new Date(at).toISOString())
  }
  return (
    <Modal
      open
      onClose={onCancel}
      title={s.title}
      width={366}
      className="ex-pub-schedule"
      maskClassName="ex-pub-schedule-mask"
      closeLabel={m.dialog.close}
      footer={
        <>
          <Button className="ex-pub-schedule__cancel" onClick={onCancel}>
            {s.cancel}
          </Button>
          <Button className="ex-pub-schedule__confirm" variant="primary" loading={busy} onClick={confirm}>
            {s.confirm}
          </Button>
        </>
      }
    >
      {message ? (
        <p className="ex-pub-schedule__error" role="alert">
          {message}
        </p>
      ) : (
        <p className="ex-pub-schedule__hint">{hint}</p>
      )}
      <div className="ex-pub-schedule__fields">
        <DatePicker
          className="ex-pub-schedule__date"
          label={s.dateLabel}
          placeholder={s.datePlaceholder}
          value={date}
          onChange={(next) => {
            setDate(next)
            setInvalid(false)
          }}
          min={limits?.min}
          max={limits?.max}
          disabled={!limits}
          labels={s.calendar}
        />
        <TimePicker
          className="ex-pub-schedule__time"
          listClassName="ex-pub-select-list"
          label={s.label}
          placeholder={s.timePlaceholder}
          value={validTime}
          onChange={(next) => {
            setTime(next)
            setInvalid(false)
          }}
          options={slots}
          disabled={!date}
        />
      </div>
    </Modal>
  )
}
```

`publish-panel.tsx` 的 `<ScheduleDialog … />` 加 `range={props.scheduleRange}`。

- [ ] **Step 4: 样式**

`styles.css`（publish）删除第 413–416 行旧 `.ex-pub-schedule__label/__input/__hint/__error` 规则，追加：

```css
/* ---------- 定时发布弹窗（B25–B33，366×218；日期面板外观 inferred default） ---------- */
.ex-pub-schedule-mask { background: var(--ex-color-pub-schedule-mask); }
.ex-pub-schedule.ex-modal {
  border-radius: var(--ex-radius-sm);
  color: var(--ex-color-pub-dialog-text);
  font-family: var(--ex-font-family-helvetica);
}
.ex-pub-schedule .ex-modal__header { position: relative; padding: 20px 20px 0; }
.ex-pub-schedule .ex-modal__title { color: var(--ex-color-pub-dialog-text); font-size: 18px; font-weight: 700; line-height: 24px; }
.ex-pub-schedule .ex-modal__close {
  position: absolute;
  top: 20.5px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--ex-color-pub-dialog-close);
}
.ex-pub-schedule .ex-modal__close svg { width: 20px; height: 20px; stroke-width: 1.2; }
.ex-pub-schedule .ex-modal__body { padding: 0 24px 0 20px; overflow: visible; }
.ex-pub-schedule__hint,
.ex-pub-schedule__error { margin: 10px 0 12px; font-size: 14px; line-height: 20px; }
.ex-pub-schedule__hint { color: var(--ex-color-pub-dialog-text); }
.ex-pub-schedule__error { color: var(--ex-color-error); }
.ex-pub-schedule__fields { display: flex; gap: 12px; }
.ex-pub-schedule__date,
.ex-pub-schedule__time { width: 155px; }
/* 输入框颜色按参考图 §3.3 覆盖 ui 的通用默认值 */
.ex-pub-schedule .ex-picker-input { border-color: var(--ex-color-pub-border); }
.ex-pub-schedule .ex-picker-input:disabled { background: var(--ex-color-pub-disabled-bg); border-color: var(--ex-color-pub-disabled-border); }
.ex-pub-schedule .ex-picker-input__icon,
.ex-pub-schedule .ex-picker-input.is-placeholder .ex-picker-input__value,
.ex-pub-schedule .ex-picker-input.is-placeholder .ex-select__value { color: var(--ex-color-pub-placeholder-modal); }
.ex-pub-schedule .ex-modal__footer { padding: 40px 20px 20px; gap: 20.5px; }
.ex-pub-schedule__cancel { width: 74.5px; height: 30px; color: var(--ex-color-text-secondary); }
.ex-pub-schedule__confirm { width: 96px; height: 32px; }

/* ---------- 发布面板下拉列表（B16–B19；时间选择器与表单下拉共用，Task 13 接入表单） ---------- */
.ex-pub-select-list {
  border: 1px solid var(--ex-color-pub-dropdown-border);
  border-radius: var(--ex-radius-md);
  box-shadow: 0 2px 12px var(--ex-color-pub-dropdown-shadow);
  font-family: var(--ex-font-family-helvetica);
}
.ex-pub-select-list .ex-select__option { color: var(--ex-color-pub-label); }
.ex-pub-select-list .ex-select__option.is-selected { color: var(--ex-color-pub-option-selected); font-weight: 700; }
.ex-pub-select-list .ex-select__option:disabled { color: var(--ex-color-pub-placeholder-modal); }
```

- [ ] **Step 5: 运行确认通过并构建**

Run: `pnpm --filter @editorx/publish test && pnpm --filter @editorx/publish typecheck && pnpm --filter @editorx/publish build`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add packages/publish/src/schedule-dialog.tsx packages/publish/src/schedule-dialog.test.tsx packages/publish/src/publish-panel.tsx packages/publish/src/publish-panel.test.tsx packages/publish/src/styles.css packages/publish/src/styles.test.ts
git commit -m "feat(publish): 定时发布弹窗改为日期 + 时间选择器" -m "按 CSDN 参考图（B25–B33）重做定时发布弹窗：366 宽、区间提示、日期与时间两个选择器，时间在选定日期前禁用，越界日期 / 时间档禁用；按钮为「取 消」「定时发布」。替换原 datetime-local 输入，校验失败时提示行显示错误。确认按钮与参考图一致始终可点，未选或越界时不提交并把提示行改为错误（controller 裁定，推断行为）；输入框边框 / 禁用 / 占位颜色按 §3.3 在 publish 内覆盖，「取 消」文字 #555666（B29）。"
```

---

### Task 12: publish：标签面板 TagPicker 与 primary 标签

**Files:**
- Create: `packages/publish/src/form/tag-picker.tsx`、`packages/publish/src/form/tag-picker.test.tsx`
- Modify: `packages/publish/src/form/tag-field.tsx`、`packages/publish/src/form/fields.test.tsx`（第 39–95 行 TagField 用例；文件头导入 `Modal`）
- Modify: `packages/publish/src/form/publish-form.tsx`、`packages/publish/src/icons.tsx`
- Modify: `packages/publish/src/styles.css`、`packages/publish/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 3 `TagCategory`、`getTagCategories` / `getTagsByCategory`、`publish.tags.*`；Task 4 `Tag variant="primary"`；Task 5 `InlineLayer`；Task 1 `--ex-color-pub-picker-title` / `pub-picker-border` / `pub-option-selected` / `pub-dialog-text`、`--ex-color-tag-primary-*`；既有 `--ex-color-pub-close`（#8c8c8c，§3.2 面板 ×）
- Produces:

```ts
export interface TagPickerProps {
  selected: readonly string[]
  onAdd(tag: string): void
  onClose(): void
  searchTags?: (keyword: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
  /** getTagCategories 失败时调用一次（StrictMode 下也只一次） */
  onLoadError?(error: unknown): void
}
// DOM：InlineLayer → div.ex-popover.ex-pub-tag-picker[role=dialog][aria-labelledby → 「标签」]（浮层树子节点）
//   > header（.ex-pub-tag-picker__title + button.ex-pub-tag-picker__close「关闭标签面板」）
//   + input[type=search].ex-pub-tag-picker__search「搜索标签」
//   + [div.ex-pub-tag-picker__body > ul「标签分类」(button[aria-pressed]) + div.ex-pub-tag-picker__main > 「添加标签」 + ul「推荐标签」]
//   + div.ex-pub-tag-picker__count「还可添加N个标签」
// TagFieldProps 新增 getTagCategories? / getTagsByCategory? / onLoadError?
// PlusIcon({ size, className = 'ex-pub-plus' })
```

行为：面板在 `.ex-pub-tags` 内正常流定位（不走 portal），`top: calc(100% + 7px); left: 0`；只在 ×、Esc 或满 7 个时关闭，点击外部不关闭（B21，CSDN 行为）。Esc 分层靠浮层树：面板根是 Task 5 的 `InlineLayer`（`useDismiss` `outsidePress: false`、`bubbles.escapeKey: false`），PublishModal 的 `useDismiss` 看到打开的子节点就不关闭自己。不用 React `e.stopPropagation()`：Next 下 React 根在 `document`，floating-ui 也在 `document` 上监听，React 合成事件的 stopPropagation 拦不住；也不加 `e.nativeEvent.stopImmediatePropagation()` 兜底——它的效果取决于监听器注册顺序，可能连面板自己的 `useDismiss` 和宿主的 document 监听一起拦掉，并不无害。打开时聚焦搜索框，关闭后焦点回到添加按钮。分类：`getTagCategories` 结果非空则用之；为空或抛错回退为单个「推荐」分类（数据 = `searchTags('')`）；两个 adapter 都缺 → 只有输入框。输入关键字时右侧显示 300ms 防抖的 `searchTags(keyword)` 结果（失败静默为空）。新 adapter 不参与 hide / disable 策略。

几何（B20–B24、§3.2）：面板 581 宽、直角、1px 边框 `--ex-color-pub-picker-border`（≈#e2e2e2）；标题行高 43（padding-top 14）、标题 16/24 粗体**居中**；关闭按钮 24 于 top 19 / right 26，颜色 `--ex-color-pub-close`（× ≈#8c8c8c）；搜索框 548×36、margin-left 16；主体紧接搜索框（margin-top 0）高 222，总高 43 + 36 + 222 + 33 = 334；左栏 164 宽（padding-top 10、项高 35、padding-left 32、无分隔线），选中分类 `--ex-color-pub-option-selected`（≈#409eff）；右栏 padding `17px 17px 0 32px`，「添加标签」14px 粗体 `--ex-color-pub-dialog-text`（#222226）；计数 right 17 / bottom 18；面板 padding-bottom 33。已选 chip（B10）：60×28，× 墨迹 7.5，右缘内距 8.5（= 边框 1 + padding 7.5）。阴影 `2px 2px 8px`、选项 chip 样式、chip 行距 8 为 inferred default。

- [ ] **Step 1: 写失败测试（TagPicker）**

`tag-picker.test.tsx`（新建）：

```tsx
import type { TagCategory } from '@editorx/toolbar'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils'
import { TagPicker, type TagPickerProps } from './tag-picker'

function Harness(props: Partial<TagPickerProps> & { initial?: string[] }) {
  const [tags, setTags] = useState(props.initial ?? [])
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button">外部</button>
      {open && <TagPicker selected={tags} onAdd={(t) => setTags([...tags, t])} onClose={() => setOpen(false)} {...props} />}
      <output data-testid="tags">{tags.join(',')}</output>
    </>
  )
}

const panel = () => screen.getByRole('dialog', { name: '标签' })

describe('TagPicker', () => {
  it('只有 searchTags：回退为「推荐」分类，点击推荐标签添加并标记已选', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [] : ['React', 'Vue']))
    renderWithProviders(<Harness searchTags={searchTags} />)
    const categories = await screen.findByRole('list', { name: '标签分类' })
    expect(within(categories).getByRole('button', { name: '推荐' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(await screen.findByRole('button', { name: 'React' }))
    expect(screen.getByTestId('tags')).toHaveTextContent('React')
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(panel()).getByText('添加标签')).toBeInTheDocument()
    expect(within(panel()).getByText('还可添加6个标签')).toBeInTheDocument()
    expect(searchTags).toHaveBeenCalledWith('')
  })

  it('分类：内联 tags 直接显示，未内联的按需 getTagsByCategory', async () => {
    const categories: TagCategory[] = [
      { id: 'py', name: 'Python', tags: ['Django'] },
      { id: 'java', name: 'Java' },
    ]
    const getTagsByCategory = vi.fn(async () => ['Spring'])
    renderWithProviders(<Harness getTagCategories={async () => categories} getTagsByCategory={getTagsByCategory} />)
    expect(await screen.findByRole('button', { name: 'Django' })).toBeInTheDocument()
    expect(getTagsByCategory).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Java' }))
    expect(await screen.findByRole('button', { name: 'Spring' })).toBeInTheDocument()
    expect(getTagsByCategory).toHaveBeenCalledWith('java')
    expect(screen.getByRole('button', { name: 'Java' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('getTagCategories 返回空数组：回退「推荐」', async () => {
    renderWithProviders(<Harness getTagCategories={async () => []} searchTags={async () => ['Vite']} />)
    expect(await screen.findByRole('button', { name: '推荐' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
  })

  it('getTagCategories 抛错：onLoadError 只调用一次（StrictMode）并回退「推荐」', async () => {
    const onLoadError = vi.fn()
    renderWithProviders(
      <Harness getTagCategories={() => Promise.reject(new Error('网络错误'))} searchTags={async () => ['Vite']} onLoadError={onLoadError} />,
    )
    expect(await screen.findByRole('button', { name: 'Vite' })).toBeInTheDocument()
    await waitFor(() => expect(onLoadError).toHaveBeenCalledTimes(1))
    expect(onLoadError.mock.calls[0]![0]).toEqual(new Error('网络错误'))
  })

  it('两个 adapter 都缺：只有搜索框，Enter 添加自定义标签', async () => {
    renderWithProviders(<Harness />)
    const input = screen.getByRole('searchbox', { name: '搜索标签' })
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('placeholder', '请输入文字搜索，Enter键入可添加自定义标签')
    expect(screen.queryByRole('list', { name: '标签分类' })).toBeNull()
    await userEvent.type(input, 'Rust{Enter}')
    expect(screen.getByTestId('tags')).toHaveTextContent(/^Rust$/)
    expect(input).toHaveValue('')
  })

  it('关键字：300ms 防抖搜索结果替换右栏', async () => {
    const searchTags = vi.fn(async (k: string) => (k ? [`${k}1`, `${k}2`] : ['React']))
    renderWithProviders(<Harness searchTags={searchTags} />)
    await screen.findByRole('button', { name: 'React' })
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索标签' }), 'ts')
    expect(await screen.findByRole('button', { name: 'ts1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'React' })).toBeNull()
    expect(searchTags).toHaveBeenLastCalledWith('ts')
  })

  it('输入法组合中的 Enter 不添加', () => {
    renderWithProviders(<Harness />)
    const input = screen.getByRole('searchbox', { name: '搜索标签' })
    fireEvent.change(input, { target: { value: 'pinyin' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(screen.getByTestId('tags')).toHaveTextContent(/^$/)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    expect(screen.getByTestId('tags')).toHaveTextContent(/^pinyin$/)
  })

  it('点击外部不关闭；× 与 Esc 关闭', async () => {
    const { unmount } = renderWithProviders(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: '外部' }))
    expect(panel()).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '关闭标签面板' }))
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
    unmount()
    renderWithProviders(<Harness />)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
  })
})
```

`fields.test.tsx` TagField 用例（第 39–95 行）改写：
1. `Tags` 测试组件加 `getTagCategories?` 透传；文件头从 `@editorx/ui` 导入 `Modal`。
2. 第一个用例：计数文案已在 Task 3 Step 5 改为 `'还可添加7个标签'`，这里不再改；其余步骤不变（推荐分类回退后行为相同）。
3. 第二个用例末尾追加：打开面板后点 `关闭标签面板`，断言 `screen.getByRole('button', { name: '添加文章标签' })` 获得焦点且 `aria-expanded="false"`。
4. 第三个用例：`.ex-pub-tag-search__section` → `.ex-pub-tag-picker__body`，`.ex-pub-tag-search :disabled` → `.ex-pub-tag-picker :disabled`。
5. 追加：

```tsx
  it('已选标签为 primary chip；添加按钮切换面板并带 aria-expanded（B09/B11）', async () => {
    const { container } = renderWithProviders(<Tags initial={['jvm']} />)
    expect(container.querySelector('.ex-pub-tag')).toHaveClass('ex-tag--primary')
    const add = screen.getByRole('button', { name: '添加文章标签' })
    expect(add).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(add)
    expect(add).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: '标签' }).closest('.ex-pub-tags')).not.toBeNull()
    await userEvent.click(add)
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
  })

  it('弹窗内 Esc 只关闭标签面板，第二次 Esc 才关闭弹窗（浮层树子节点）', async () => {
    const onModalClose = vi.fn()
    renderWithProviders(
      <Modal open onClose={onModalClose} title="发布文章">
        <Tags />
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: '添加文章标签' }))
    expect(screen.getByRole('dialog', { name: '标签' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '标签' })).toBeNull()
    expect(onModalClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onModalClose).toHaveBeenCalledTimes(1)
  })
```

jsdom 里 React 根是测试容器而不是 `document`，这个用例证明的是浮层树分层本身；Next 下 React 根就是 `document` 的真实场景由 e2e 覆盖：`publish.spec.ts` 第 244–254 行（PublishModal 内打开面板 → Esc → 面板关闭、弹窗仍在）与 Task 18 的 darwin 弹窗用例（Esc 后断言弹窗可见）。`publish-panel.test.tsx:384`（面板打开时 Esc，随后点「发布文章」）依赖同一分层，不改即应通过。

`styles.test.ts`（publish）追加：

```ts
  it('标签面板与 chip 几何（B09–B11、B20–B24）', () => {
    expect(css).toMatch(/\.ex-pub-tag-picker \{[^}]*width: 581px;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__search \{[^}]*width: 548px;[^}]*height: 36px;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__categories \{[^}]*width: 164px;/)
    expect(css).toMatch(/\.ex-pub-tag \{[^}]*height: 28px;[^}]*padding: 0 7\.5px 0 8px;/)
    expect(css).not.toContain('.ex-pub-tag-popover')
  })

  it('标签面板总高 334 与颜色（B20–B24、§3.2）', () => {
    expect(css).toMatch(/\.ex-pub-tag-picker \{[^}]*border-color: var\(--ex-color-pub-picker-border\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__header \{[^}]*height: 43px;[^}]*padding: 14px 0 0;[^}]*text-align: center;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__body \{[^}]*height: 222px;[^}]*margin-top: 0;/)
    expect(css).toMatch(/\.ex-pub-tag-picker__close \{[^}]*color: var\(--ex-color-pub-close\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__category\.is-active \{[^}]*color: var\(--ex-color-pub-option-selected\);/)
    expect(css).toMatch(/\.ex-pub-tag-picker__section \{[^}]*color: var\(--ex-color-pub-dialog-text\);[^}]*font-weight: 700;/)
    expect(css).not.toMatch(/\.ex-pub-tag-picker__categories \{[^}]*border-right/)
    expect(css).not.toContain('.ex-pub-tag-option:hover')
    expect(css).toMatch(/\.ex-pub-tag-option\.is-selected \{ opacity: 0\.5; cursor: default; \}/)
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/publish test -- tag-picker fields styles`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `tag-picker.tsx`**

```tsx
import { formatMessage, useMessages, type TagCategory } from '@editorx/toolbar'
import { InlineLayer } from '@editorx/ui'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../cx'
import { MAX_TAGS } from '../validate'

const RECOMMENDED = '__recommended__'

export interface TagPickerProps {
  selected: readonly string[]
  onAdd(tag: string): void
  onClose(): void
  searchTags?: (keyword: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
  /** getTagCategories 失败时调用一次（StrictMode 下也只一次） */
  onLoadError?(error: unknown): void
}

export function TagPicker({ selected, onAdd, onClose, searchTags, getTagCategories, getTagsByCategory, onLoadError }: TagPickerProps) {
  const p = useMessages().publish
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const onLoadErrorRef = useRef(onLoadError)
  useEffect(() => {
    onLoadErrorRef.current = onLoadError
  })
  const [keyword, setKeyword] = useState('')
  const [categories, setCategories] = useState<TagCategory[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Record<string, string[]>>({})
  const [results, setResults] = useState<{ query: string; list: string[] } | null>(null)
  const recommendedName = p.tags.recommended

  useEffect(() => inputRef.current?.focus(), [])

  useEffect(() => {
    let live = true
    const fallback = (): TagCategory[] => (searchTags ? [{ id: RECOMMENDED, name: recommendedName }] : [])
    const load = getTagCategories
      ? getTagCategories().then(
          (list) => (list.length > 0 ? list : fallback()),
          (error: unknown) => {
            if (live) onLoadErrorRef.current?.(error)
            return fallback()
          },
        )
      : Promise.resolve(fallback())
    void load.then((list) => {
      if (live) setCategories(list)
    })
    return () => {
      live = false
    }
  }, [getTagCategories, searchTags, recommendedName])

  const active = categories?.find((c) => c.id === activeId) ?? categories?.[0]
  const activeTags = active ? (active.tags ?? loaded[active.id]) : undefined

  useEffect(() => {
    if (!active || active.tags || loaded[active.id]) return
    const id = active.id
    const fetchTags = id === RECOMMENDED ? searchTags && (() => searchTags('')) : getTagsByCategory && (() => getTagsByCategory(id))
    let live = true
    void (fetchTags ? fetchTags() : Promise.resolve<string[]>([])).then(
      (list) => {
        if (live) setLoaded((prev) => ({ ...prev, [id]: list }))
      },
      () => {
        if (live) setLoaded((prev) => ({ ...prev, [id]: [] }))
      },
    )
    return () => {
      live = false
    }
  }, [active, loaded, searchTags, getTagsByCategory])

  const query = keyword.trim()
  const searching = query !== '' && !!searchTags
  useEffect(() => {
    if (!searching) return
    let live = true
    const timer = window.setTimeout(() => {
      searchTags!(query).then(
        (list) => {
          if (live) setResults({ query, list })
        },
        () => {
          if (live) setResults({ query, list: [] })
        },
      )
    }, 300)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [query, searching, searchTags])

  const list = searching ? (results?.query === query ? results.list : undefined) : activeTags

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    onAdd(keyword)
    setKeyword('')
  }

  return (
    <InlineLayer className="ex-popover ex-pub-tag-picker" role="dialog" aria-labelledby={titleId} onDismiss={onClose}>
      <div className="ex-pub-tag-picker__header">
        <span className="ex-pub-tag-picker__title" id={titleId}>
          {p.tags.title}
        </span>
        <button type="button" className="ex-pub-tag-picker__close" aria-label={p.tags.close} onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <input
        ref={inputRef}
        className="ex-pub-input ex-pub-tag-picker__search"
        type="search"
        value={keyword}
        placeholder={p.tags.searchPlaceholder}
        aria-label={p.tags.search}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={onInputKeyDown}
      />
      {categories && categories.length > 0 && (
        <div className="ex-pub-tag-picker__body">
          <ul className="ex-pub-tag-picker__categories" aria-label={p.tags.categories}>
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cx('ex-pub-tag-picker__category', c.id === active?.id && 'is-active')}
                  aria-pressed={c.id === active?.id}
                  onClick={() => setActiveId(c.id)}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="ex-pub-tag-picker__main">
            <div className="ex-pub-tag-picker__section">{p.tags.section}</div>
            {list !== undefined &&
              (list.length === 0 ? (
                <div className="ex-pub-tag-picker__empty">{p.tags.empty}</div>
              ) : (
                <ul className="ex-pub-tag-picker__list" aria-label={p.tags.suggestions}>
                  {list.map((tag) => {
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
        </div>
      )}
      <div className="ex-pub-tag-picker__count">{formatMessage(p.tags.count, { count: MAX_TAGS - selected.length })}</div>
    </InlineLayer>
  )
}
```

注：Esc 由 `InlineLayer` 内的 `useDismiss` 处理，组件不再自己监听根节点 keydown。用例「点击推荐标签后 `aria-pressed=true`」依赖 `disabled` 按钮仍可通过 `getByRole('button', { name })` 查到（Testing Library 默认包含 disabled 元素）。

- [ ] **Step 4: 改 `tag-field.tsx`、`publish-form.tsx`、`icons.tsx`**

`icons.tsx`：

```tsx
export function PlusIcon({ size, className = 'ex-pub-plus' }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
```

`tag-field.tsx` 整体替换为：

```tsx
import { useMessages, type TagCategory } from '@editorx/toolbar'
import { Tag } from '@editorx/ui'
import { useRef, useState } from 'react'
import { PlusIcon } from '../icons'
import { MAX_TAGS } from '../validate'
import { errorId } from './form-item'
import { TagPicker } from './tag-picker'

export interface TagFieldProps {
  id: string
  tags: readonly string[]
  onChange(tags: string[]): void
  /** 缺失时（无论 hide 还是 disable 策略）推荐分类不出现；两个分类 adapter 也缺时面板只有输入框 */
  searchTags?: (keyword: string) => Promise<string[]>
  getTagCategories?: () => Promise<TagCategory[]>
  getTagsByCategory?: (categoryId: string) => Promise<string[]>
  onLoadError?(error: unknown): void
  invalid: boolean
}

export function TagField({ id, tags, onChange, searchTags, getTagCategories, getTagsByCategory, onLoadError, invalid }: TagFieldProps) {
  const p = useMessages().publish
  const [open, setOpen] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    addRef.current?.focus()
  }
  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return
    const next = [...tags, tag]
    onChange(next)
    if (next.length >= MAX_TAGS) setOpen(false)
  }
  const canAdd = tags.length < MAX_TAGS
  return (
    <div className="ex-pub-line ex-pub-tags">
      {tags.map((tag) => (
        <Tag
          key={tag}
          variant="primary"
          className="ex-pub-tag"
          closable
          closeLabel={p.tags.remove}
          onClose={() => onChange(tags.filter((t) => t !== tag))}
        >
          {tag}
        </Tag>
      ))}
      {canAdd && (
        <button
          ref={addRef}
          type="button"
          className="ex-pub-tag-add"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId(id) : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <PlusIcon size={10} className="ex-pub-tag-add__plus" />
          {p.tags.add}
        </button>
      )}
      {open && canAdd && (
        <TagPicker
          selected={tags}
          onAdd={add}
          onClose={close}
          searchTags={searchTags}
          getTagCategories={getTagCategories}
          getTagsByCategory={getTagsByCategory}
          onLoadError={onLoadError}
        />
      )}
    </div>
  )
}
```

`publish-form.tsx`：
1. `searchTags` 的 `useMemo` 之后追加同样写法的 `getTagCategories` 与 `getTagsByCategory`：

```tsx
  const getTagCategories = useMemo(
    () => (adapters.getTagCategories ? () => adapters.getTagCategories!() : undefined),
    [adapters],
  )
  const getTagsByCategory = useMemo(
    () => (adapters.getTagsByCategory ? (categoryId: string) => adapters.getTagsByCategory!(categoryId) : undefined),
    [adapters],
  )
```

2. `<TagField … />` 加：

```tsx
          getTagCategories={getTagCategories}
          getTagsByCategory={getTagsByCategory}
          onLoadError={(error) =>
            notify(formatMessage(p.errors.load, { name: p.fields.tags, message: errorMessage(error) }), 'error')
          }
```

   并从 `@editorx/toolbar` 补导入 `formatMessage`、`errorMessage`（`publish-panel.tsx` 已从同处导入 `errorMessage`）。

- [ ] **Step 5: 样式**

`styles.css`（publish）删除 `.ex-pub-tag-popover`、`.ex-pub-tag-search*` 全部规则（现第 149–155 行），并删除旧的 `.ex-pub-tag-option` 三条规则：第 156 行起的基础规则、第 167 行 `.ex-pub-tag-option:hover:not(:disabled)`、第 168 行 `.ex-pub-tag-option.is-selected`（由下方新规则取代，hover 不再变色）。`.ex-pub-tag` / `.ex-pub-tag-add` / `.ex-pub-tags` 改为并追加：

```css
.ex-pub-tags { position: relative; column-gap: 12px; row-gap: 8px; } /* row-gap：inferred default */
/* B10：chip 右缘到 × 墨迹 8.5 = 边框 1 + padding 7.5 */
.ex-pub-tag {
  box-sizing: border-box;
  height: 28px;
  padding: 0 7.5px 0 8px;
  gap: 13px;
  font-size: 14px;
}
.ex-pub-tag-add { gap: 6px; }
.ex-pub-tag-add__plus { flex: none; }

/* ---------- 标签面板（B20–B24；阴影 / 选项 chip 为 inferred default） ---------- */
.ex-pub-tag-picker {
  position: absolute;
  z-index: 10;
  top: calc(100% + 7px);
  left: 0;
  box-sizing: border-box;
  width: 581px;
  padding: 0 0 33px;
  border-color: var(--ex-color-pub-picker-border);
  border-radius: 0;
  box-shadow: 2px 2px 8px var(--ex-color-pub-dropdown-shadow);
  font-family: var(--ex-font-family-helvetica);
}
.ex-pub-tag-picker__header { position: relative; box-sizing: border-box; height: 43px; padding: 14px 0 0; text-align: center; }
.ex-pub-tag-picker__title { color: var(--ex-color-pub-picker-title); font-size: 16px; font-weight: 700; line-height: 24px; }
.ex-pub-tag-picker__close {
  position: absolute;
  top: 19px;
  right: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-pub-close);
  cursor: pointer;
}
.ex-pub-tag-picker__search { box-sizing: border-box; width: 548px; height: 36px; margin-left: 16px; }
.ex-pub-tag-picker__body { display: flex; height: 222px; margin-top: 0; }
.ex-pub-tag-picker__categories {
  box-sizing: border-box;
  flex: none;
  width: 164px;
  margin: 0;
  padding: 10px 0 0;
  overflow-y: auto;
  list-style: none;
}
.ex-pub-tag-picker__categories::-webkit-scrollbar { width: 8px; }
.ex-pub-tag-picker__category {
  box-sizing: border-box;
  width: 100%;
  height: 35px;
  padding: 0 0 0 32px;
  border: 0;
  background: transparent;
  color: var(--ex-color-pub-label);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.ex-pub-tag-picker__category.is-active { color: var(--ex-color-pub-option-selected); font-weight: 700; }
.ex-pub-tag-picker__main { flex: 1; min-width: 0; padding: 17px 17px 0 32px; overflow-y: auto; }
.ex-pub-tag-picker__section { margin-bottom: 6px; color: var(--ex-color-pub-dialog-text); font-size: 14px; font-weight: 700; line-height: 22px; }
.ex-pub-tag-picker__list { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ex-pub-tag-picker__empty { color: var(--ex-color-text-muted); font-size: 12px; }
.ex-pub-tag-picker__count { position: absolute; right: 17px; bottom: 18px; color: var(--ex-color-text-muted); font-size: 12px; line-height: 15px; }
.ex-pub-tag-option {
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--ex-color-tag-primary-border);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-tag-primary-bg);
  color: var(--ex-color-tag-primary-text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ex-pub-tag-option.is-selected { opacity: 0.5; cursor: default; }
```

（`--ex-color-text-muted` / `--ex-color-pub-label` / `--ex-color-pub-close` 已存在；`pub-option-selected` / `pub-picker-border` / `pub-dialog-text` / `pub-picker-title` 来自 Task 1。）`styles.test.ts` 第 74–80 行 `STRUCTURAL` 中删除 `'ex-pub-tag-search__section'`。

- [ ] **Step 6: 运行确认通过并构建**

Run: `pnpm --filter @editorx/publish test && pnpm --filter @editorx/publish typecheck && pnpm --filter @editorx/publish build`
Expected: PASS（`publish-panel.test.tsx:271`「缺失 searchTags：disable 策略下标签弹层同样只有输入框」不改即通过：无 adapter 时没有「推荐标签」文本）。

- [ ] **Step 7: 提交**

```bash
git add packages/publish/src/form/tag-picker.tsx packages/publish/src/form/tag-picker.test.tsx packages/publish/src/form/tag-field.tsx packages/publish/src/form/fields.test.tsx packages/publish/src/form/publish-form.tsx packages/publish/src/icons.tsx packages/publish/src/styles.css packages/publish/src/styles.test.ts
git commit -m "feat(publish): 标签面板改为分类 + 推荐的 CSDN 样式" -m "按参考图（B20–B24、§3.2）把标签弹层改为 581×334 的面板：居中标题、搜索框、左侧分类、右侧标签与剩余数量，只在 × / Esc / 满 7 个时关闭。面板根用 ui 的 InlineLayer 登记为浮层树子节点，弹窗内 Esc 只关面板，第二次 Esc 才关弹窗。新增可选 adapter getTagCategories / getTagsByCategory，缺失、为空或失败时回退为「推荐」（searchTags('')）。已选标签改为蓝色 primary chip，× 右内距 8.5（B09–B11）。"
```

---

### Task 13: publish：弹窗 / 内联表单样式（B01–B08、B12–B19、B35、B36、字体）

**Files:**
- Modify: `packages/publish/src/styles.css`、`packages/publish/src/styles.test.ts`
- Modify: `packages/publish/src/form/form-item.tsx`、`packages/publish/src/icons.tsx`
- Modify: `packages/publish/src/form/publish-form.tsx`（第 152 行声明下拉）、`packages/publish/src/form/option-fields.tsx`（第 117、133 行活动 / 话题下拉）
- Modify: `packages/publish/src/form/fields.test.tsx`、`packages/publish/src/publish-panel.test.tsx`

**Interfaces:**
- Consumes: Task 1 `--ex-font-family-helvetica`、`--ex-color-pub-select-border-modal`、`--ex-color-pub-scrollbar-thumb`；Task 4 `Select` 的 `offset` / `popperArrow` / `listClassName`；Task 11 `.ex-pub-select-list`
- Produces:

```tsx
// icons.tsx
/** 13.5×13.5 圆圈问号，描边 1.3（B08） */
export function HelpIcon(): ReactElement // svg.ex-pub-help-icon 14×14
// 发布面板内 3 个下拉统一：<Select offset={12} popperArrow listClassName="ex-pub-select-list" … />
```

尺寸依据：弹窗内容列 = 740 − 左 28 − 右 20 − 滚动条 11 = 681，标签 92 → 控件列 589，止于 709（B01）；活动下拉 = 589 − 子标签 28 − 间距 8 − 右留白 32 = 521，右缘 677（B12）；摘要框 57 高、抽取按钮下边距 0 使「分类专栏」及以下各行上移 2（B02）。

- [ ] **Step 1: 写失败测试**

`styles.test.ts`（publish）：
1. 第 35 行 `--ex-pub-control-width: 600px` 断言保留（变量仍定义，弹窗用 `flex: 1` 覆盖）。
2. 第 38 行改为 `expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body \{[^}]*padding: 26px 20px 40px 28px;[^}]*scrollbar-gutter: stable;/)`。
3. 第 46 行改为 `expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__required \{[^}]*position: absolute;[^}]*top: 3\.5px;[^}]*left: -16px;/)`。
4. 追加：

```ts
  it('mac 参考图修正（B01–B08、B12、B13、B35、B36）', () => {
    expect(css).toMatch(/\.ex-pub \{[^}]*font-family: var\(--ex-font-family-helvetica\);/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__body::-webkit-scrollbar \{ width: 11px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__control \{[^}]*flex: 1;[^}]*width: auto;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-select--wide \{[^}]*flex: 1;[^}]*width: auto;[^}]*margin-right: 32px;/)
    expect(css).toMatch(/\.ex-pub--modal \{[^}]*--ex-pub-summary-height: 57px;/)
    expect(css).not.toMatch(/\.ex-pub--modal \.ex-pub-summary__extract \{ margin-bottom: 1px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \[data-field='multiPlatform'\] \{ min-height: 32px; \}/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-textarea \{[^}]*padding: 7px 8px;/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-item__label \{ letter-spacing: 0\.5px; \}/)
    expect(css).toMatch(/\.ex-pub-item__required \{[^}]*color: var\(--ex-color-primary\);/)
    expect(css).toMatch(/\.ex-pub-item__help \{[^}]*color: var\(--ex-color-pub-label\);/)
    expect(css).toMatch(/\.ex-pub--modal \.ex-pub-select--declaration \{ border-color: var\(--ex-color-pub-select-border-modal\); \}/)
    expect(css).toMatch(/\.ex-pub-modal \.ex-modal__footer \{[^}]*box-shadow: 0 -3px 3px var\(--ex-color-pub-footer-shadow\);/)
    expect(css).toMatch(/\.ex-pub-card \.ex-radio \{ gap: 8px; \}/)
    expect(css).toMatch(/\.ex-pub-bar__start \{[^}]*color: var\(--ex-color-pub-text\);/)
  })
```

`fields.test.tsx` 的 FormItem 用例追加：

```tsx
    expect(screen.getByRole('img', { name: '帮助' }).querySelector('svg.ex-pub-help-icon')).toHaveAttribute('width', '14')
```

`publish-panel.test.tsx` 在「按 CSDN 顺序渲染全部字段与底部操作栏」后追加：

```tsx
  it('发布面板下拉：offset 12、气泡箭头、ex-pub-select-list（B14–B19）', async () => {
    renderWithProviders(<PublishPanel document={doc} adapters={adapters()} />)
    await userEvent.click(screen.getByRole('combobox', { name: '创作声明' }))
    const list = await screen.findByRole('listbox')
    expect(list).toHaveClass('ex-pub-select-list', 'has-arrow')
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/publish test -- styles fields publish-panel`
Expected: FAIL。

- [ ] **Step 3: 组件改动**

`icons.tsx` 追加：

```tsx
/** 13.5×13.5 圆圈问号，描边 1.3（B08） */
export function HelpIcon() {
  return (
    <svg
      className="ex-pub-help-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="6.1" />
      <path d="M5.3 5.4a1.75 1.75 0 1 1 2.5 1.6c-.5.25-.8.6-.8 1.1v.4" />
      <circle cx="7" cy="10.3" r="0.35" fill="currentColor" stroke="none" />
    </svg>
  )
}
```

`form-item.tsx`：删除 `lucide-react` 的 `CircleHelp` 导入，改 `import { HelpIcon } from '../icons'`，`<CircleHelp size={14} aria-hidden="true" />` → `<HelpIcon />`。

`publish-form.tsx` 声明下拉与 `option-fields.tsx` 两个下拉的 `<Select` 各加三行：

```tsx
            offset={12}
            popperArrow
            listClassName="ex-pub-select-list"
```

- [ ] **Step 4: 样式**

`styles.css`（publish），逐条修改：

| 位置 | 改为 | 依据 |
|---|---|---|
| `.ex-pub { … font-family: var(--ex-font-family); … }` | `font-family: var(--ex-font-family-helvetica);` | B04 |
| `.ex-pub--modal` 块 `--ex-pub-summary-height: 58px;` | `57px` | B02 |
| `.ex-pub--modal` 块 `--ex-pub-declaration-padding: 0 7px 0 12px;` | `0 12px 0 12px` | B12（箭头右内距 12） |
| `.ex-pub--modal` 块 `--ex-pub-activity-padding: 0 6px 0 15px;` | `0 12px 0 15px` | B12 |
| `.ex-pub` 块 `--ex-pub-declaration-padding` / `--ex-pub-activity-padding: 0 8px 0 11px;` | `0 13px 0 11px` | B12（内联右内距 13） |
| `.ex-pub-item__required { order: 1; color: var(--ex-color-error); }` | `color: var(--ex-color-primary)` | B07 |
| `.ex-pub-item__help { … color: var(--ex-color-text-muted); … }` | `color: var(--ex-color-pub-label)`；删除 `.ex-pub--modal .ex-pub-item__help` 一行 | B08 |
| `.ex-pub--modal .ex-pub-item__required { position: absolute; left: -16px; }` | `{ position: absolute; top: 3.5px; left: -16px; line-height: 14px; }` | B06 |
| `.ex-pub--modal [data-field='multiPlatform'] { min-height: 33px; }` | `min-height: 32px` | B02 |
| `.ex-pub--modal .ex-pub-summary__extract { margin-bottom: 1px; }` | 删除 | B02 |
| `.ex-pub-bar__start { … color: var(--ex-color-text-secondary); … }` | `color: var(--ex-color-pub-text)` | B37 |
| `.ex-pub-modal .ex-modal__body { padding: 26px 28px 40px; }` | 见下方代码块 | B01 |
| `.ex-pub-modal .ex-modal__footer` 的 `box-shadow: 0 -4px 8px …` | `box-shadow: 0 -3px 3px var(--ex-color-pub-footer-shadow);` | B35 |

并追加：

```css
/* ---------- mac 参考图修正（B01–B05、B12、B13、B36） ---------- */
.ex-pub-modal .ex-modal__body { padding: 26px 20px 40px 28px; scrollbar-gutter: stable; }
.ex-pub-modal .ex-modal__body::-webkit-scrollbar { width: 11px; }
.ex-pub-modal .ex-modal__body::-webkit-scrollbar-track { background: var(--ex-color-surface); }
.ex-pub-modal .ex-modal__body::-webkit-scrollbar-thumb {
  border: solid transparent;
  border-width: 0 2px 0 3px;
  border-radius: 5px;
  background: var(--ex-color-pub-scrollbar-thumb);
  background-clip: padding-box;
}
.ex-pub--modal .ex-pub-item__control { flex: 1; width: auto; }
.ex-pub--modal .ex-pub-item__label { letter-spacing: 0.5px; }
.ex-pub--modal .ex-pub-textarea { padding: 7px 8px; }
.ex-pub--modal .ex-pub-select--wide { flex: 1; width: auto; margin-right: 32px; }
.ex-pub--modal .ex-pub-select--declaration { border-color: var(--ex-color-pub-select-border-modal); }
.ex-pub-card .ex-radio { gap: 8px; }
.ex-pub-help-icon { display: block; }
```

（原 `.ex-pub-modal .ex-modal__body { padding: 26px 28px 40px; }` 一行删除，由上面的规则取代。）

- [ ] **Step 5: 运行确认通过并构建**

Run: `pnpm --filter @editorx/publish test && pnpm --filter @editorx/publish typecheck && pnpm --filter @editorx/publish build`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add packages/publish/src/styles.css packages/publish/src/styles.test.ts packages/publish/src/form/form-item.tsx packages/publish/src/icons.tsx packages/publish/src/form/publish-form.tsx packages/publish/src/form/option-fields.tsx packages/publish/src/form/fields.test.tsx packages/publish/src/publish-panel.test.tsx
git commit -m "style(publish): 按 mac 参考图修正发布弹窗与内联表单细节" -m "弹窗内容列止于 709、自绘 11px 滚动条（B01），摘要框 57 高使下方各行回到参考位置（B02），Helvetica 字体栈（B04），标签字距、必填星号位置与颜色、帮助图标（B05–B08），下拉箭头内距与边框、列表 12px 间距与气泡箭头（B12–B19），底部阴影（B35）与单选间距（B36）。"
```

---

### Task 14: publish：`barPosition` 固定底栏

**Files:**
- Modify: `packages/publish/src/types.ts`、`packages/publish/src/publish-panel.tsx`、`packages/publish/src/publish-panel.test.tsx`
- Modify: `packages/publish/src/styles.css`、`packages/publish/src/styles.test.ts`
- Modify: `apps/playground/e2e/publish-parity.spec.ts`（操作栏高 69 → 68）

**Interfaces:**
- Consumes: 无
- Produces:

```ts
export interface PublishPanelProps extends PublishBaseProps {
  slots?: PublishPanelSlots
  /**
   * 'sticky'（默认）：操作栏随卡片滚动并吸附在滚动容器底部。
   * 'fixed'：操作栏固定在视口底部（CSDN 发文设置页，Audit C §bar），并在卡片后放等高占位，避免遮挡最后一行。
   */
  barPosition?: 'sticky' | 'fixed'
}
// DOM（fixed）：section.ex-pub.ex-pub--bar-fixed > .ex-pub-card + div.ex-pub-bar-spacer[aria-hidden] + div.ex-pub-bar.is-fixed
```

- [ ] **Step 1: 写失败测试**

`publish-panel.test.tsx`（「PublishPanel（内联）」describe 内）追加：

```tsx
  it('barPosition 默认 sticky：无占位、无 is-fixed', () => {
    const { container } = renderWithProviders(<PublishPanel document={doc} adapters={adapters()} />)
    expect(container.querySelector('.ex-pub')).not.toHaveClass('ex-pub--bar-fixed')
    expect(container.querySelector('.ex-pub-bar')).not.toHaveClass('is-fixed')
    expect(container.querySelector('.ex-pub-bar-spacer')).toBeNull()
  })

  it('barPosition="fixed"：操作栏 is-fixed，卡片后有 aria-hidden 占位', () => {
    const { container } = renderWithProviders(<PublishPanel document={doc} adapters={adapters()} barPosition="fixed" />)
    const section = container.querySelector('.ex-pub')!
    expect(section).toHaveClass('ex-pub--bar-fixed')
    const spacer = section.querySelector('.ex-pub-card + .ex-pub-bar-spacer')
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer!.nextElementSibling).toHaveClass('ex-pub-bar', 'is-fixed')
    expect(within(spacer!.nextElementSibling as HTMLElement).getByRole('button', { name: '发布博客' })).toBeInTheDocument()
  })
```

`styles.test.ts`（publish）追加：

```ts
  it('固定底栏与占位（Audit C §bar）', () => {
    expect(css).toMatch(/\.ex-pub-bar\.is-fixed \{[^}]*position: fixed;[^}]*right: 0;[^}]*bottom: 0;[^}]*left: 0;[^}]*margin-top: 0;/)
    expect(css).toMatch(/\.ex-pub-bar-spacer \{[^}]*height: 68px;[^}]*margin-top: 26px;/)
    expect(css).toMatch(/\.ex-pub-bar \{[^}]*height: 68px;[^}]*padding-bottom: 3px;/)
  })
```

第 36 行既有断言 `/\.ex-pub-bar \{[^}]*position: sticky;[^}]*height: 69px;[^}]*margin-top: 26px;/` 中的 `69px` 改为 `68px`。并把 `'ex-pub--bar-fixed'` 加入第 74 行 `STRUCTURAL`。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @editorx/publish test -- publish-panel styles`
Expected: FAIL。

- [ ] **Step 3: 实现**

`types.ts`：`PublishPanelProps` 按 Interfaces 加 `barPosition`。

`publish-panel.tsx` 的 `InlinePanel` return 改为：

```tsx
  const fixed = props.barPosition === 'fixed'
  return (
    <section className={cx('ex-pub', fixed && 'ex-pub--bar-fixed', props.className)} aria-label={m.publish.label}>
      <div className="ex-pub-card">{form}</div>
      {fixed && <div className="ex-pub-bar-spacer" aria-hidden="true" />}
      <div className={cx('ex-pub-bar', fixed && 'is-fixed')}>
        <div className="ex-pub-bar__inner">
          <div className="ex-pub-bar__start">{props.slots?.barStart}</div>
          {actions}
        </div>
      </div>
      {schedule}
    </section>
  )
```

`styles.css` 在 `.ex-pub-bar { … }` 之后追加：

```css
.ex-pub-bar.is-fixed { position: fixed; z-index: 10; right: 0; bottom: 0; left: 0; margin-top: 0; }
/* 固定底栏的等高占位：卡片最后一行底边 + 26 ≤ 操作栏顶 */
.ex-pub-bar-spacer { flex: none; height: 68px; margin-top: 26px; }
```

并把既有 `.ex-pub-bar { … height: 69px; … padding-bottom: 4px; … }`（styles.css 第 342、344 行）改为 `height: 68px;`、`padding-bottom: 3px;`（Audit C §bar、B 审计 §2：mac 参考操作栏高 68，按钮上缘在边框下 13；业主要求严格还原，2026-10-10 裁定不再推迟）。按钮 40 高、栏内容区 68 − 1 − 3 = 64，居中后上缘 = 1 + 12 = 13，与参考一致，两个值都是确定值。

同时把 `apps/playground/e2e/publish-parity.spec.ts` 现有 `near(bar.height, 69, 0.5, '操作栏高')` 改为 68（共享 CSS；Task 18 拆分时 win32 分支保留 68 并标注「待 Windows 复测」）。这里只改这一处断言、不跑 publish-parity：该 spec 的内联用例同时断言 Task 12 / 13 改过的行位置与标签面板几何，要等 Task 18 按平台拆分后才能整体通过，验证留到 Task 18 Step 5。

- [ ] **Step 4: 运行确认通过并构建**

Run: `pnpm --filter @editorx/publish test && pnpm --filter @editorx/publish typecheck && pnpm --filter @editorx/publish build`
Expected: PASS（98 + Task 10–14 新增）。

- [ ] **Step 5: 提交**

```bash
git add packages/publish/src/types.ts packages/publish/src/publish-panel.tsx packages/publish/src/publish-panel.test.tsx packages/publish/src/styles.css packages/publish/src/styles.test.ts apps/playground/e2e/publish-parity.spec.ts
git commit -m "feat(publish): PublishPanel 新增 barPosition，支持操作栏固定在视口底部" -m "CSDN 发文设置页的操作栏固定在视口底部（Audit C §bar），参考图 R-1337 中操作栏贴视口底。barPosition='fixed' 时操作栏 position: fixed，并在卡片后插入 26 + 68 的占位，滚到底时不遮挡最后一行；默认 'sticky' 行为不变。操作栏高 69 → 68、padding-bottom 4 → 3，按钮上缘仍在边框下 13，与 mac 参考一致；publish-parity 只同步了操作栏高的断言，整体验证在 parity 按平台拆分后进行。"
```

---

### Task 15: playground /markdown：外框、额度提示、按钮、图标、角标

**Files:**
- Create: `apps/playground/app/quota-notice.tsx`、`apps/playground/app/quota-notice.css`
- Modify: `apps/playground/app/markdown/markdown-playground.tsx`、`apps/playground/app/markdown/markdown.css`、`apps/playground/app/markdown/csdn-demo-extensions.tsx`、`apps/playground/app/markdown/page.tsx`
- Modify: `apps/playground/e2e/markdown.spec.ts`

**Interfaces:**
- Consumes: Task 1 `--ex-color-quota-*`、`--ex-color-mde-draft-bg`、`--ex-color-mde-badge`、`--ex-color-mde-ai-from/to`、`--ex-color-mde-rail-ai-label`；Task 8 面板按钮的 `data-panel`；Task 6–9 的 markdown 包（dist）；Task 16 之前 `createPublishAdapters` 尚无分类 mock（本任务只透传已有的 4 个 adapter）
- Produces:

```tsx
// app/quota-notice.tsx（/markdown 状态栏与 /publish 操作栏共用，G08/G15/G32、B37）
export function QuotaNotice(props: { remaining?: number; href?: string }): ReactElement
// DOM：span.pg-quota > svg.pg-quota__icon(18×18) + span（「今日发文额度还有 <em>5</em> 篇，<a>可去这里提升额度</a>」）
// MarkdownPlaygroundProps.fixture: 'sample' | 'csdn' | 'test'   // 'test'：正文为 "test"，与 mac 参考图一致
```

- [ ] **Step 1: 写失败的 e2e 断言**

`markdown.spec.ts` 末尾追加：

```ts
test('演示页外壳：额度提示、切换按钮、AI 标签色与 test 夹具（G08/G14/G18/G28/G32）', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/markdown?fixture=test&view=edit')
  const quota = page.locator('.pg-quota')
  await expect(quota).toHaveText('今日发文额度还有 5 篇，可去这里提升额度')
  await expect(quota.getByRole('link', { name: '可去这里提升额度' })).toBeVisible()
  await expect(quota.locator('svg.pg-quota__icon')).toHaveAttribute('width', '18')
  await expect(page.getByRole('button', { name: '使用富文本编辑器' })).toBeVisible()
  await expect(statusMd(page)).toHaveText('Markdown 4 字数 2 行数 当前行 1, 当前列 0')
  await expect(statusHtml(page)).toHaveText('HTML 4 字数 1 段落')
  const aiLabel = page.locator(".ex-mde-rail__item[data-panel='csdn:ai'] .ex-mde-rail__label")
  await expect(aiLabel).toHaveText('AI')
  await expect(aiLabel).toHaveCSS('color', 'rgb(154, 154, 154)')
})
```

- [ ] **Step 2: 运行确认失败**

Run（先构建上游）：

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/markdown.spec.ts -g "演示页外壳"
```

Expected: FAIL（`.pg-quota` 不存在，`fixture=test` 未支持）。

- [ ] **Step 3: 共享额度提示**

`app/quota-notice.tsx`：

```tsx
/** CSDN 发文额度提示：填充圆形「i」图标 18×18 + 单行文字（G08/G15/G32、B37） */
export function QuotaNotice({ remaining = 5, href = '#quota' }: { remaining?: number; href?: string }) {
  return (
    <span className="pg-quota">
      <svg className="pg-quota__icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="9" fill="currentColor" />
        <path d="M9 8v5" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: 'var(--ex-color-on-primary)' }} />
        <circle cx="9" cy="5.2" r="1" style={{ fill: 'var(--ex-color-on-primary)' }} />
      </svg>
      <span>
        今日发文额度还有 <em>{remaining}</em> 篇，<a href={href}>可去这里提升额度</a>
      </span>
    </span>
  )
}
```

`app/quota-notice.css`：

```css
/* 320×38；图标在 +13，文字墨迹起点 +39.5（G08） */
.pg-quota {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 320px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--ex-color-quota-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-quota-bg);
  color: var(--ex-color-text-secondary);
  font-size: 14px;
  white-space: nowrap;
}
.pg-quota__icon { flex: none; color: var(--ex-color-primary); }
.pg-quota em { color: var(--ex-color-primary); font-style: normal; }
.pg-quota a { color: var(--ex-color-primary); text-decoration: none; }
```

`app/markdown/page.tsx`：在 `import './markdown.css'` 前加 `import '../quota-notice.css'`；`fixture` 解析改为：

```tsx
const FIXTURES = ['sample', 'csdn', 'test'] as const
// …
      fixture={FIXTURES.find((f) => f === first(params.fixture)) ?? 'sample'}
```

- [ ] **Step 4: 演示页组件**

`markdown-playground.tsx`：
1. `fixture` 类型改为 `'sample' | 'csdn' | 'test'`；`defaultValue` 改为 `fixture === 'csdn' ? CSDN_SAMPLE : fixture === 'test' ? 'test' : SAMPLE`；`title` 改为 `fixture === 'sample' ? 'EditorX 示例文档' : CSDN_TITLE`。
2. lucide 导入改为只剩 `ChevronDown`；`import { QuotaNotice } from '../quota-notice'`。
3. `headerEnd` 按钮内 `<ArrowLeftRight size={14} aria-hidden="true" />` → `<SwitchIcon />`；`statusCenter` 整段改为 `<QuotaNotice />`。
4. 文件末尾：

```tsx
/** ⇄ 13×13：上箭头向右、下箭头向左（G28） */
function SwitchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 4h11M9 1l3 3-3 3" />
      <path d="M12 9H1M4 6 1 9l3 3" />
    </svg>
  )
}
```

`csdn-demo-extensions.tsx`：
1. lucide 导入改为只剩 `History`。
2. `DraftIcon` 改为 12×12 墨迹（G30）：

```tsx
/** CSDN 模板按钮的草稿（软盘）图标：16 盒内墨迹 12×12（G30） */
function DraftIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1} aria-hidden="true">
      <path d="M2.5 2.5h11v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M5 2.5v4h6v-4M9 3.75v1.5" />
    </svg>
  )
}
```

3. 新增 AI 与营销图标（G31）：

```tsx
/** 紫色渐变「AI」字标（G31）；渐变 id 固定，页面上只渲染一次 */
function AiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pg-mde-ai-gradient" x1="2" y1="10" x2="18" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--ex-color-mde-ai-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ex-color-mde-ai-to)' }} />
        </linearGradient>
      </defs>
      <path
        d="M2.5 16 7 4h2l4.5 12M4.4 11.5h7.2M16.5 4v12"
        stroke="url(#pg-mde-ai-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 营销组件：票券轮廓 + 虚线（G31） */
function MarketingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 5.5h15v3a1.5 1.5 0 0 0 0 3v3h-15v-3a1.5 1.5 0 0 0 0-3z" />
      <path d="M12.5 6.5v7" strokeDasharray="1.5 1.5" />
    </svg>
  )
}
```

4. `csdnAiPanelExtension` 的 `icon: <Bot size={20} />` → `icon: <AiIcon />`；`csdnMarketingExtension` 的 `<Megaphone size={20} />` → `<MarketingIcon />`。

`markdown-playground.tsx` 的 adapters `useMemo` 暂不改（Task 16 加分类 mock 后再透传）。

- [ ] **Step 5: 样式**

`markdown.css`：

| 位置 | 改为 | 依据 |
|---|---|---|
| 文件首行注释 | `/* /markdown 演示页：顶栏 56px 无下边框 + 外框四周 16px（mac 参考图 2026-10-10） */` | G01/G02 |
| `.pg-mde__topbar` 的 `height: 61px;` 与 `border-bottom: …;` | `height: 56px;`，删除 `border-bottom` | G01 |
| `.pg-mde__frame` 的 `padding: 16px 16px 14px 14px;` | `padding: 16px;` | G02 |
| `.pg-mde-quota` 及其 3 条子规则 | 删除（由 `.pg-quota` 取代） | G15 |
| `.pg-mde-draft { height: 36px; padding: 0 16px; }` 与 `.pg-mde-publish { … }` | 见下方代码块 | G07 |
| `.pg-mde-new { … }` | 见下方代码块 | G12/G17 |
| 追加 AI 标签色 | 见下方代码块 | G14 |

```css
.pg-mde-switch { justify-content: center; width: 158px; padding: 0; }
/* G07：草稿 ≈41、发布 ≈43 高；垂直中心由状态栏分组的 margin-top 定在主区底边上方 32 */
.pg-mde-draft {
  justify-content: center;
  width: 114px;
  height: 41px;
  padding: 0;
  border-radius: 6px;
  background: var(--ex-color-mde-draft-bg);
}
.ex-btn.pg-mde-publish { width: 98px; height: 43px; padding: 0; border-radius: 6px; }

/* G14：未激活的「AI」标签单独实测为 #9a9a9a，比其他标签浅 */
.pg-mde .ex-mde-rail__item[data-panel='csdn:ai']:not(.is-active) .ex-mde-rail__label { color: var(--ex-color-mde-rail-ai-label); }

/* NEW 角标 22×11，相对图标左上 (12, -6.5)（G12/G17） */
.pg-mde-new {
  position: absolute;
  top: -6.5px;
  left: 12px;
  box-sizing: border-box;
  width: 22px;
  height: 11px;
  border-radius: var(--ex-radius-pill);
  background: var(--ex-color-mde-badge);
  color: var(--ex-color-on-primary);
  font-size: 8px;
  line-height: 11px;
  text-align: center;
}
```

- [ ] **Step 6: 运行确认通过**

```bash
pnpm --filter @editorx/playground typecheck
pnpm --filter @editorx/playground build
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/markdown.spec.ts
```

Expected: 全部 PASS（`SAMPLE` 以换行结尾、10k 文档最后一行为空串，Task 6 的行数规则下 `SAMPLE.split('\n').length` 与「10000 行数」两处断言数值不变）。

- [ ] **Step 7: 提交**

```bash
git add apps/playground/app/quota-notice.tsx apps/playground/app/quota-notice.css apps/playground/app/markdown/markdown-playground.tsx apps/playground/app/markdown/markdown.css apps/playground/app/markdown/csdn-demo-extensions.tsx apps/playground/app/markdown/page.tsx apps/playground/e2e/markdown.spec.ts
git commit -m "style(playground): /markdown 演示页按 mac 参考图调整外框、额度提示与图标" -m "顶栏 56 无边框、外框四周 16（G01/G02）；保存草稿 114×41 / 发布文章 98×43、圆角 6（G07）；未激活的 AI 标签 #9a9a9a（G14）；额度提示改为共享 QuotaNotice（320×38、填充 i 图标，G08/G15/G32）；切换按钮 ⇄ 图标与 158 宽（G28）、模板软盘 12×12（G30）、AI 渐变字标与营销票券图标（G31）、NEW 角标（G12/G17）。新增 fixture=test 夹具供 mac 参考图比对。"
```

---

### Task 16: playground /publish：固定底栏、barStart、标签分类 mock

**Files:**
- Modify: `apps/playground/app/publish/publish-playground.tsx`、`apps/playground/app/publish/publish.css`、`apps/playground/app/publish/mock-adapters.ts`、`apps/playground/app/publish/page.tsx`
- Modify: `apps/playground/app/markdown/markdown-playground.tsx`（透传分类 mock）
- Modify: `apps/playground/e2e/publish.spec.ts`

**Interfaces:**
- Consumes: Task 12 `getTagCategories` / `getTagsByCategory`；Task 14 `barPosition`；Task 15 `QuotaNotice`
- Produces:

```ts
export type PublishMockAdapters = Required<
  Pick<
    EditorAdapters,
    | 'onPublish' | 'onSaveDraft' | 'searchTags' | 'getCategories' | 'getActivities' | 'getTopics' | 'uploadImage'
    | 'getTagCategories' | 'getTagsByCategory'
  >
>
// 分类：推荐（内联 TAGS 前 6 个）、Python、Java（按需加载）、编程语言、开发工具、数据库
```

- [ ] **Step 1: 写失败的 e2e 断言**

`publish.spec.ts` 的 `test.describe('/publish 内联')` 内追加：

```ts
  test('标签面板：分类切换、按需加载；操作栏固定在视口底部且有占位（B20–B24、B37）', async ({ page }) => {
    await open(page)
    await tagButton(page).click()
    const picker = page.getByRole('dialog', { name: '标签' })
    await expect(picker.getByRole('list', { name: '推荐标签' }).getByRole('button')).toHaveCount(6)
    await picker.getByRole('list', { name: '标签分类' }).getByRole('button', { name: 'Java' }).click()
    await picker.getByRole('button', { name: 'Spring', exact: true }).click()
    await expect(card(page).locator('.ex-pub-tag')).toHaveText(['Spring'])
    await page.locator('.pg-pub__paper').click()
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: '关闭标签面板' }).click()
    await expect(picker).toBeHidden()

    await expect(bar(page)).toHaveCSS('position', 'fixed')
    await expect(page.locator('.ex-pub-bar-spacer')).toHaveCount(1)
    await expect(bar(page).locator('.pg-pub__count')).toHaveText(/^共 \d+ 字$/)
    await expect(bar(page).getByRole('button', { name: '回到顶部' })).toHaveCSS('font-weight', '700')
    await expect(bar(page).locator('.pg-quota')).toBeVisible()
  })
```

- [ ] **Step 2: 运行确认失败**

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/publish.spec.ts -g "标签面板：分类切换"
```

Expected: FAIL（无分类 mock、未固定底栏）。

- [ ] **Step 3: mock 分类**

`mock-adapters.ts`：
1. import 加 `TagCategory`。
2. `TOPICS` 之后加：

```ts
const TAG_CATEGORIES: TagCategory[] = [
  { id: 'recommended', name: '推荐', tags: TAGS.slice(0, 6) },
  { id: 'python', name: 'Python', tags: ['Python', 'Django', 'Flask', 'pandas', 'NumPy'] },
  { id: 'java', name: 'Java' },
  { id: 'lang', name: '编程语言', tags: ['Go', 'Rust', 'C++', 'Kotlin'] },
  { id: 'tools', name: '开发工具', tags: ['VS Code', 'Git', 'Docker', 'Vim'] },
  { id: 'db', name: '数据库', tags: ['MySQL', 'Redis', 'PostgreSQL', 'MongoDB'] },
]
/** 未内联 tags 的分类，演示 getTagsByCategory 按需加载 */
const CATEGORY_TAGS: Record<string, string[]> = { java: ['Java', 'Spring', 'Spring Boot', 'JVM', 'Maven'] }
```

3. `PublishMockAdapters` 按 Interfaces 加两个键；`createPublishAdapters` 返回对象中 `searchTags` 之后加：

```ts
    async getTagCategories() {
      await delay(100)
      return TAG_CATEGORIES
    },
    async getTagsByCategory(categoryId) {
      await delay(150)
      return CATEGORY_TAGS[categoryId] ?? []
    },
```

`markdown-playground.tsx` 的 adapters `useMemo`：解构与返回对象都加上 `getTagCategories, getTagsByCategory`。

- [ ] **Step 4: 内联演示页**

`publish-playground.tsx`：
1. `import { QuotaNotice } from '../quota-notice'`。
2. `<PublishPanel` 加 `barPosition="fixed"`；`barStart` 改为：

```tsx
            barStart: (
              <>
                <span className="pg-pub__count">共 {WORD_COUNT} 字</span>
                <button type="button" className="pg-pub__top" onClick={() => window.scrollTo({ top: 0 })}>
                  回到顶部
                  <svg className="pg-pub__top-icon" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
                    <path d="M.5 5.5 5 1l4.5 4.5" />
                  </svg>
                </button>
                <QuotaNotice />
              </>
            ),
```

`page.tsx`（publish）：`import './publish.css'` 前加 `import '../quota-notice.css'`。

`publish.css` 的 `.pg-pub__top { … }` 替换为：

```css
/* 宿主 barStart（B37）：「共 N 字」与「回到顶部」都是 #1a1a1a，后者粗体 + 细 ^；不是红色 */
.pg-pub__count { color: var(--ex-color-pub-text); font-size: 14px; }
.pg-pub__top {
  display: inline-flex;
  align-items: center;
  gap: 4px; /* inferred default */
  padding: 0;
  border: 0;
  background: none;
  color: var(--ex-color-pub-text);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.pg-pub__top-icon { flex: none; }
```

- [ ] **Step 5: 运行确认通过**

```bash
pnpm --filter @editorx/playground typecheck
pnpm --filter @editorx/playground build
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/publish.spec.ts -g "标签面板：分类切换"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/playground/app/publish/publish-playground.tsx apps/playground/app/publish/publish.css apps/playground/app/publish/mock-adapters.ts apps/playground/app/publish/page.tsx apps/playground/app/markdown/markdown-playground.tsx apps/playground/e2e/publish.spec.ts
git commit -m "feat(playground): /publish 固定底栏、宿主 barStart 样式与标签分类 mock" -m "按 R-1337 把操作栏固定在视口底部（barPosition='fixed'），barStart 为「共 N 字」+ 粗体「回到顶部 ^」+ 额度提示，颜色 #1a1a1a 而非红色（B37 / Audit C §bar）。mock adapters 新增标签分类与按需加载，演示两栏标签面板（B20–B24）。"
```

---

### Task 17: e2e 功能用例更新

**Files:**
- Modify: `apps/playground/e2e/markdown.spec.ts`、`apps/playground/e2e/publish.spec.ts`

**Interfaces:**
- Consumes: Task 6–16 的全部行为
- Produces: 无（只改测试）

只改编码了旧文案 / 旧交互的断言，并为新功能补功能用例；几何断言留给 Task 18。

- [ ] **Step 1: 改旧断言**

`markdown.spec.ts`：
1. 第 123 行改为（行数规则显式化，数值不变）：

```ts
  const lineCount = SAMPLE.split('\n').length + (SAMPLE.endsWith('\n') ? 0 : 1)
  await expect(statusMd(page)).toContainText(`${lineCount} 行数`)
```

2. 第 37 行「10000 行数」保留（10k 文档末行为空串，行数仍为 10000）。

`publish.spec.ts`：
1. 第 80 行 `'还可添加 5 个标签'` → `'还可添加5个标签'`。
2. 第 166–186 行「定时发布：过去时间报错且弹窗不关，未来时间发布成功」整体替换为：

```ts
  test('定时发布：日期 / 时间选择，越界日期禁用，未选或时间流逝后报区间错误，区间内发布成功', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-09T12:00:00'))
    await open(page)
    await addTags(page, 'React')
    await bar(page).getByRole('button', { name: '定时发布', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '定时发布' })
    await expect(dialog.getByText('请选择当前时间后 4小时 至 7天 进行定时发布')).toBeVisible()
    const confirm = dialog.getByRole('button', { name: '定时发布', exact: true })
    const time = dialog.getByRole('combobox', { name: '发布时间' })
    await expect(time).toBeDisabled()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(dialog.locator('.ex-pub-schedule__error')).toHaveText('请选择当前时间后 4小时 至 7天 进行定时发布')
    await expect(dialog).toBeVisible()

    const pick = async (date: string, value: string) => {
      await dialog.getByRole('button', { name: '发布日期' }).click()
      const calendar = page.getByRole('dialog', { name: '发布日期' })
      await calendar.getByRole('button', { name: date, exact: true }).click()
      await expect(calendar).toBeHidden()
      await time.click()
      await page.getByRole('option', { name: value, exact: true }).click()
    }

    await dialog.getByRole('button', { name: '发布日期' }).click()
    const calendar = page.getByRole('dialog', { name: '发布日期' })
    await expect(calendar.getByRole('button', { name: '2026-10-08', exact: true })).toBeDisabled()
    await expect(calendar.getByRole('button', { name: '2026-10-17', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(calendar).toBeHidden()
    await expect(dialog).toBeVisible()

    await pick('2026-10-09', '16:00')
    await page.clock.setFixedTime(new Date('2026-10-09T12:01:00'))
    await confirm.click()
    await expect(dialog.locator('.ex-pub-schedule__error')).toHaveText('请选择当前时间后 4小时 至 7天 进行定时发布')
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('publish-log').locator('li')).toHaveCount(0)

    await pick('2026-10-10', '10:00')
    await confirm.click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('已设置定时发布：2026-10-10 10:00')).toBeVisible()
    const expected = await page.evaluate(() => new Date(2026, 9, 10, 10, 0).toISOString())
    expect(await logged(page, 'publish')).toMatchObject({ scheduledAt: expected })
  })
```

- [ ] **Step 2: 补新功能用例**

`markdown.spec.ts` 末尾追加：

```ts
test('目录空状态：点击「添加」插入 @[TOC]（G19/G26）', async ({ page }) => {
  await page.goto('/markdown?fixture=test&view=split&panel=toc')
  const panel = page.getByRole('complementary', { name: '目录' })
  await expect(panel.getByText('暂无目录')).toBeVisible()
  await expect(panel.getByRole('heading')).toHaveCount(0)
  await panel.getByRole('button', { name: '添加' }).click()
  await expect(content(page)).toContainText('@[TOC](这里写目录标题)')
})

test('面板宽度拖柄：键盘与拖拽调整右侧面板宽度（G23）', async ({ page }) => {
  await page.goto('/markdown?fixture=test&view=edit&panel=toc')
  const grip = page.getByRole('separator', { name: '调整面板宽度' })
  const panel = page.getByRole('complementary', { name: '目录' })
  await expect(grip).toHaveAttribute('aria-valuenow', '390')
  await grip.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(grip).toHaveAttribute('aria-valuenow', '400')
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(400)
  const g = (await grip.boundingBox())!
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2)
  await page.mouse.down()
  await page.mouse.move(g.x + g.width / 2 + 50, g.y + g.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(grip).toHaveAttribute('aria-valuenow', '350')
})

test('比对模式：同步滚动开关与定位（G24）', async ({ page }) => {
  await page.goto('/markdown?view=split')
  const scroll = page.getByRole('button', { name: '同步滚动' })
  await expect(scroll).toHaveAttribute('aria-pressed', 'true')
  await scroll.click()
  await expect(scroll).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '定位到编辑位置' }).click()
  await page.goto('/markdown?view=edit')
  await expect(page.getByRole('button', { name: '同步滚动' })).toHaveCount(0)
})
```

（`content(page)` 是该文件第 6 行已有的 `.ex-editor-content` 定位器。拖柄元素宽为 0，`g.x` 即拖柄中心；向右拖 50px 使面板变窄 50。）

- [ ] **Step 3: 运行**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/markdown.spec.ts e2e/publish.spec.ts
```

Expected: 全部 PASS。失败时先判断是旧文案 / 旧几何断言（按本任务原则改写）还是行为回归（回到对应包任务修复）。

- [ ] **Step 4: 提交**

```bash
git add apps/playground/e2e/markdown.spec.ts apps/playground/e2e/publish.spec.ts
git commit -m "test(playground): 功能 e2e 跟随定时发布、标签面板与状态栏新行为" -m "定时发布改用日期 / 时间选择器并覆盖区间边界与时间流逝，确认按钮始终可点、未选时报区间提示；标签剩余数量文案去空格；状态栏行数断言显式化末尾换行规则。新增目录空状态「添加」、面板宽度拖柄、比对同步按钮的功能用例。"
```

---

### Task 18: parity 规格按平台拆分（darwin 用 mac 参考值）

**Files:**
- Modify: `apps/playground/e2e/markdown-parity.spec.ts`、`apps/playground/e2e/publish-parity.spec.ts`

**Interfaces:**
- Consumes: Global Constraints 的「参考几何（darwin）」表；`e2e/helpers.ts` 的 `box` / `near` / `scrollToBottom`
- Produces: 每个 spec 两个 `test.describe`：`win32 …`（`test.skip(process.platform !== 'win32')`）与 `darwin …`（`test.skip(process.platform !== 'darwin')`）。本任务取代 `platform-addendum.md` 中「Windows 几何用例也在 darwin 上跑」的规则（见 Spec conflicts）。

win32 期望只做两类修改：① 截图裁切修正（顶栏 61→56、外框 16/16/14/14→16 带来的 +2 / −5 平移）；② 共享 CSS 改动后与平台无关的计算值（`toHaveCSS` 字符串、由 CSS 固定尺寸直接推出的宽高与累计位移，标注「共享 CSS 推算，待 Windows 复测」）。依赖字体度量且 CSS 输入已变的值放进 `test.fixme`。

- [ ] **Step 1: markdown-parity — win32 describe**

1. 删除文件内自带的 `box` / `near`，改为 `import { box, near } from './helpers'`；把顶层 `test.use({ viewport: …, launchOptions: … })` 拆为：顶层只保留 `launchOptions`，viewport 移入 win32 describe。
2. 现有 4 个用例整体移入 `test.describe('win32（12-35-10，2558×1308）', () => { test.skip(process.platform !== 'win32', 'Windows 参考图'); test.use({ viewport: { width: 2558, height: 1308 } }); … })`，并按下表改值：

| 原行 | 原值 | 新值 | 类别 |
|---|---|---|---|
| 30–33 | main (14, 77, 2050, 1217) | (16, 72, 2048, 1220) | 裁切 |
| 37 | `expectedX = [26, 157, 243]` | 只断言第 1 个页签 x = 28；第 2/3 个移入 fixme | 裁切 / fixme |
| 38, 44 | 宽 [119, 74, 74] | 移入 fixme | fixme |
| 42 | y 89 | 84 | 裁切 |
| 46 | `'600'` | `'500'` | 共享 CSS（G16） |
| 53 | 177 | 172 | 裁切 |
| 58–59 | (38, 157) | (40, 152) | 裁切 |
| 63–75 | x 24, 58, 92, 126, 187, 277, 379, 504, 538, 572, 697, 731, 827 | 各 +2：26, 60, 94, 128, 189, 279, 381, 506, 540, 574, 699, 733, 829 | 裁切 |
| 84 | [170, 487, 680] | [172, 489, 682] | 裁切 |
| 91 | 1230 | 1228 | 裁切 |
| 92 | `'9px 24px 12px 25px'` | `'9px 16px 12px 26.5px'` | 共享 CSS（G06/G09） |
| 97–98 | 1250.5 / 1271.5 | 1248.5 / 1269.5 | 裁切 |
| 99 | md.x 40 | 42.5（16 + 26.5） | 裁切 + 共享 CSS |
| 122–123 | editor x 14、宽 1012 | x 16、宽 1011（容差 1.5） | 裁切 |
| 125 | pane.x 1026 | 1027（容差 1.5） | 裁切 |
| 126 | `'16px'` | `'11px 16px 16px'` | 共享 CSS（G04） |
| 128 | `'19px 24px 16px 42px'` | `'11px 24px 16px 42px'` | 共享 CSS（G04） |
| 137 | 87 | 82 | 裁切 |
| 140–141 | 120 / 155 | 115 / 150 | 裁切 |

3. win32 describe 内追加：

```ts
  test.fixme('页签宽度与第 2/3 个页签 x（共享 CSS 改为字重 500、无字距，需在 Windows 上按 12-35-10 重新实测）', async ({ page }) => {
    await open(page, 'edit')
    const tabs = page.getByRole('tab')
    near((await box(tabs.nth(0))).width, 119, 4, 'tab0.width')
    near((await box(tabs.nth(1))).x, 159, 3, 'tab1.x')
    near((await box(tabs.nth(2))).x, 245, 3, 'tab2.x')
  })
```

- [ ] **Step 2: markdown-parity — darwin describe**

```ts
test.describe('darwin（mac 参考图 2026-10-10，1728×932，DSF 2）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1728, height: 932 }, deviceScaleFactor: 2 })

  async function openMac(page: Page, view: 'edit' | 'split' | 'preview', panel: string) {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`/markdown?fixture=test&view=${view}&panel=${panel}`)
    await expect(page.locator('.ex-mde-status__html')).toHaveText('HTML 4 字数 1 段落', { timeout: 5000 })
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0)
  }

  test('外框、页签、工具栏、状态栏、按钮、面板、拖柄、图标栏（19-12-09）', async ({ page }) => {
    await openMac(page, 'edit', 'csdn:ai')
    const topbar = page.locator('.pg-mde__topbar')
    await expect(topbar).toHaveCSS('height', '56px')
    await expect(topbar).toHaveCSS('border-bottom-width', '0px')
    const main = await box(page.locator('.ex-mde-main'))
    near(main.x, 16, 0.5, 'main.x')
    near(main.y, 72, 0.5, 'main.y')
    near(main.width, 1218, 1, 'main.width')
    near(main.height, 844, 1, 'main.height')

    const tabs = page.getByRole('tab')
    const tabX = [28, 155.5, 241.5]
    const tabW = [115.5, 74, 74]
    for (let i = 0; i < 3; i++) {
      const t = await box(tabs.nth(i))
      near(t.x, tabX[i]!, 1.5, `tab${i}.x`)
      near(t.width, tabW[i]!, 1.5, `tab${i}.width`)
      near(t.y, 84, 1, `tab${i}.y`)
      near(t.height, 32, 0.5, `tab${i}.height`)
    }
    await expect(tabs.first()).toHaveCSS('font-weight', '500')

    const toolbar = await box(page.locator('.ex-mde-toolbar'))
    near(toolbar.y + toolbar.height, 172, 1, '工具栏底边')
    const divider = page.locator('.ex-mde-toolbar .ex-toolbar__divider').first()
    const d = await box(divider)
    near(d.height, 17, 0.5, '分隔线高')
    near(d.y, 143.5, 1, '分隔线 y')
    await expect(divider).toHaveCSS('background-color', 'rgb(217, 217, 217)')

    const content = page.locator('.ex-editor-content')
    near(Number.parseFloat(await content.evaluate((el) => getComputedStyle(el).paddingLeft)), 101, 1, '正文左内边距（G03）')
    await expect(content).toHaveCSS('padding-top', '11px')

    const statusBar = page.locator('.ex-mde-status')
    const status = await box(statusBar)
    near(status.y, 852, 1, '状态栏顶')
    near(status.height, 64, 0.5, '状态栏高')
    await expect(statusBar).toHaveCSS('padding', '9px 16px 12px 26.5px')

    const centerY = main.y + main.height - 32
    const draft = await box(page.locator('.pg-mde-draft'))
    near(draft.x, 990, 1, '保存草稿 x')
    near(draft.width, 114, 0.5, '保存草稿宽')
    near(draft.height, 41, 1, '保存草稿高（G07）')
    near(draft.y + draft.height / 2, centerY, 1, '保存草稿中心 y（G07：主区底 −32）')
    const publish = await box(page.locator('.pg-mde-publish'))
    near(publish.x, 1120, 1, '发布文章 x')
    near(publish.width, 98, 0.5, '发布文章宽')
    near(publish.height, 43, 1, '发布文章高（G07）')
    near(publish.y + publish.height / 2, centerY, 1, '发布文章中心 y')
    await expect(page.locator('.pg-mde-publish')).toHaveCSS('border-radius', '6px')

    const quota = await box(page.locator('.pg-quota'))
    near(quota.width, 320, 0.5, '额度提示宽')
    near(quota.height, 38, 0.5, '额度提示高')
    near(quota.y + quota.height / 2, centerY, 1, '额度提示中心 y（G08）')
    near((await box(page.locator('.pg-quota__icon'))).x - quota.x, 13, 1, '额度图标偏移')

    const panel = await box(page.locator('.ex-mde-panel'))
    near(panel.x, 1250, 1, 'panel.x')
    near(panel.width, 390, 1, 'panel.width')
    const grip = page.locator('.ex-mde-panel-grip')
    const g = await box(grip)
    near(g.x + g.width / 2, 1242, 1, '拖柄中心 x（G23）')
    const after = await grip.evaluate((el) => {
      const s = getComputedStyle(el, '::after')
      return [s.top, s.width, s.height]
    })
    expect(after).toEqual(['438px', '4px', '24px'])

    const rail = page.getByRole('navigation', { name: '侧边栏' })
    const r = await box(rail)
    near(r.x, 1656, 1, 'rail.x')
    near(r.width, 56, 0.5, 'rail.width')
    near((await box(rail.locator('.ex-mde-rail__divider'))).y, 135, 1, '图标栏分隔线 y（G10）')
    const items = rail.locator('.ex-mde-rail__item:not(.ex-mde-rail__toggle)')
    near((await box(items.nth(0))).y, 144, 1, 'AI 项 y')
    near((await box(items.nth(0))).height, 51, 0.5, 'AI 项高')
    near((await box(items.nth(1))).y, 199, 1, '目录项 y')
    const badge = await box(page.locator('.pg-mde-new'))
    near(badge.x, 1686, 1, 'NEW x（G12）')
    near(badge.y, 310, 1, 'NEW y')
    near(badge.width, 22, 0.5, 'NEW 宽')
    near(badge.height, 11, 0.5, 'NEW 高')
  })

  test('比对模式：内容内边距与同步按钮（19-12-19）', async ({ page }) => {
    await openMac(page, 'split', 'csdn:ai')
    const pane = await box(page.locator('.ex-mde-preview-pane'))
    near(pane.x, 612, 1.5, '预览区 x')
    await expect(page.locator('.ex-editor-content')).toHaveCSS('padding', '11px 16px 16px')
    await expect(page.locator('.ex-mde-preview')).toHaveCSS('padding', '11px 24px 16px 42px')
    const locate = await box(page.getByRole('button', { name: '定位到编辑位置' }))
    near(locate.x, 617, 1, '定位 x（G24）')
    near(locate.y, 801, 1, '定位 y')
    near(locate.height, 16, 0.5, '定位高')
    near((await box(page.getByRole('button', { name: '同步滚动' }))).y, 830, 1.5, '同步滚动 y')
  })

  test('目录空状态（19-12-48）', async ({ page }) => {
    await openMac(page, 'preview', 'toc')
    const panel = page.getByRole('complementary', { name: '目录' })
    await expect(panel.getByRole('heading')).toHaveCount(0)
    const p = await box(panel)
    near((await box(panel.locator('.ex-mde-toc__empty-title'))).y - p.y, 49, 2, '暂无目录 行框顶')
    near((await box(panel.locator('.ex-mde-toc__empty'))).y - p.y, 86, 2, '第二行 行框顶')
    await expect(panel.getByRole('button', { name: '添加' })).toHaveCSS('color', 'rgb(39, 125, 204)')
  })

  test('编辑区与预览滚动条宽 8px', async ({ page }) => {
    await openMac(page, 'split', 'csdn:ai')
    const width = (selector: string) => page.locator(selector).evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
    expect(await width('.ex-mde-editor')).toBe(8)
    expect(await width('.ex-mde-preview-pane')).toBe(8)
  })
})
```

- [ ] **Step 3: publish-parity — win32 describe**

把现有两个 `test.describe` 改名为 `win32 内联卡片（12-36-05，2554×1310）` / `win32 发布弹窗（12-36-37，2554×1312）`，各加 `test.skip(process.platform !== 'win32', 'Windows 参考图')`，并改值（全部为「共享 CSS 推算，待 Windows 复测」）：

| 位置 | 原值 | 新值 | 依据 |
|---|---|---|---|
| 内联 `expectDots('articleType', …)` | [128, 231, 313] | [128, 232, 315] | B36 点→字 8（每个前置选项 +1） |
| 内联 `expectDots('visibility', …)` | [128, 238, 348, 458] | [128, 239, 350, 461] | B36 |
| 内联 `expectDots('multiPlatform', …)` | [128, 196] | [128, 197] | B36 |
| `MODAL_ROWS` | summary 227/97、categories 340 … multiPlatform 648/33、activity 697 | summary 227/95、categories 338、articleType 386、declaration 434、backup 482、visibility 550、template 598、multiPlatform 646/32、activity 694 | B02 |
| 模态框高 / y | 875 / 218.5 | 872 / 220 | B02（−3） |
| 控件列宽 | 600 | 589 | B01 |
| 摘要框宽 / 高 | 600 / 58 | 589 / 57 | B01/B02 |
| 活动宽 | 532 | 521 | B12 |
| 话题 top | 739 | 736 | B02 |
| footer top | 811 | 808 | B02 |
| 内联 `near(bar.height, …)`（第 141 行） | 69（Task 14 已改为 68） | 保持 68 | Audit C §bar（共享 CSS，mac 实测 68） |

`fontTol` 导入保留（内联单选仍用）。

- [ ] **Step 4: publish-parity — darwin describe**

```ts
// INLINE_ROWS 是 Windows 12-36-05 的绝对 y；217 = 该图卡片顶 y（win32 用例的 near(card.y, 217, …)）。
// mac 19-13-37 各行相对卡片顶的距离与 Windows 相同，减去 217 即得相对值。
const MAC_INLINE_ROWS = INLINE_ROWS.map(([field, top, height]) => [field, top - 217, height] as const)

test.describe('darwin 发布弹窗（19-09-01 / 19-14-31，1714×932，DSF 2）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1714, height: 932 }, deviceScaleFactor: 2 })

  test('模态框、各行、控件列、帮助图标、星号、滚动条、footer、标签 chip', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish?mode=modal')
    const dialog = page.getByRole('dialog', { name: '发布文章' })
    await expect(dialog.getByText('您暂时不能添加分类专栏!')).toBeVisible()
    await expect(dialog.locator('.ex-pub-cover__thumb')).toHaveCount(2)
    await page.evaluate(() => document.fonts.ready)

    const d = await box(dialog)
    near(d.width, 740, 0.5, '模态框宽')
    near(d.height, 868, 1, '模态框高')
    near(d.x, 487, 1, '模态框 x')
    near(d.y, 32, 1, '模态框 y')
    const M = d.x
    const T = d.y
    for (const [field, top, height] of MODAL_ROWS) {
      const r = await box(row(page, field))
      near(r.y - T, top, 1, `${field}.top`)
      near(r.height, height, 1, `${field}.height`)
    }
    const control = await box(row(page, 'tags').locator('.ex-pub-item__control'))
    near(control.x - M, 120, 1, '控件列 x')
    near(control.width, 589, 1, '控件列宽（B01）')
    const textarea = await box(row(page, 'summary').locator('textarea'))
    near(textarea.width, 589, 0.5, '摘要框宽')
    near(textarea.height, 57, 0.5, '摘要框高（B02）')
    const activity = await box(row(page, 'activity').locator('.ex-select').first())
    near(activity.x - M, 156, 1, '活动 x')
    near(activity.width, 521, 1, '活动宽（B12）')
    near((await box(row(page, 'tags').locator('.ex-pub-item__help'))).x - M, 90, 1.5, '帮助图标 x（B05）')
    const star = await box(row(page, 'tags').locator('.ex-pub-item__required'))
    near(star.y + star.height / 2 - T, 76.5, 1.5, '必填星号中心 y（B06）')
    await expect(row(page, 'tags').locator('.ex-pub-item__required')).toHaveCSS('color', 'rgb(252, 85, 49)')
    const scrollbar = await dialog.locator('.ex-modal__body').evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)
    expect(scrollbar, '弹窗滚动条宽（B01）').toBe(11)
    near((await box(dialog.locator('.ex-modal__footer'))).y - T, 804, 1, 'footer top')

    await page.getByRole('button', { name: '添加文章标签' }).click()
    const search = page.getByRole('searchbox', { name: '搜索标签' })
    await search.fill('jvm')
    await search.press('Enter')
    await search.press('Escape')
    await expect(search).toBeHidden()
    await expect(dialog, '标签面板内 Esc 不关闭发布弹窗').toBeVisible()
    const chipEl = dialog.locator('.ex-pub-tag')
    const chip = await box(chipEl)
    near(chip.x - M, 120, 1, 'chip x')
    near(chip.width, 60, 1.5, 'chip 宽（B10）')
    near(chip.height, 28, 0.5, 'chip 高')
    const close = await box(chipEl.locator('.ex-tag__close'))
    near(chip.x + chip.width - (close.x + close.width), 8.5, 1, 'chip × 右内距（B10）')
    near((await box(dialog.locator('.ex-pub-tag-add'))).x - M, 192, 1.5, '添加按钮 x（B10）')

    await dialog.getByRole('combobox', { name: '创作声明' }).click()
    const list = page.getByRole('listbox')
    near((await box(list)).width, 242, 1, '声明下拉列表宽（B18）')
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    await expect(dialog).toBeVisible()
  })
})

test.describe('darwin 内联卡片（19-13-37，1705×932，overlay 滚动条）', () => {
  test.skip(process.platform !== 'darwin', 'mac 参考图')
  test.use({ viewport: { width: 1705, height: 932 }, deviceScaleFactor: 2 })

  test('各行相对卡片、单选点到文字 24、固定操作栏贴底且不遮挡卡片', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/publish')
    await expect(page.getByText('专栏已达到上限，暂不可创建新专栏，请选择已有专栏')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const L = (await page.evaluate(() => document.documentElement.clientWidth) - 816) / 2
    const card = await box(page.locator('.ex-pub-card'))
    near(card.x, L, 1, 'card.x')
    for (const [field, top, height] of MAC_INLINE_ROWS) {
      const r = await box(row(page, field))
      near(r.y - card.y, top, 1, `${field}.top`)
      near(r.height, height, 2, `${field}.height`)
    }
    for (const field of ['articleType', 'visibility']) {
      const radios = row(page, field).locator('.ex-radio')
      for (let i = 0; i < (await radios.count()); i++) {
        const dot = await box(radios.nth(i).locator('.ex-radio__dot'))
        const label = await box(radios.nth(i).locator('.ex-radio__label'))
        near(label.x - dot.x, 24, 0.5, `${field} 单选${i} 点→字（B36）`)
      }
    }
    const bar = await box(page.locator('.ex-pub-bar'))
    near(bar.y + bar.height, 932, 0.5, '操作栏贴视口底')
    near(bar.height, 68, 0.5, '操作栏高')
    await scrollToBottom(page)
    const cardEnd = await box(page.locator('.ex-pub-card'))
    const barEnd = await box(page.locator('.ex-pub-bar'))
    expect(cardEnd.y + cardEnd.height + 26, '卡片底 + 26 ≤ 操作栏顶').toBeLessThanOrEqual(barEnd.y + 0.5)
  })
})
```

（`rgb(252, 85, 49)` = `#fc5531`，即 `--ex-color-primary` 亮色值，B07。）

- [ ] **Step 5: 运行**

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/markdown-parity.spec.ts e2e/publish-parity.spec.ts
```

Expected（darwin）：darwin describe 全部 PASS，win32 describe 全部 skipped（含 fixme）。这一步同时是 Task 14 操作栏 68 的验证点（Task 14 只改了断言、没有跑 publish-parity）。若 darwin 断言超差：先对照参考图复核期望值（期望来自 Global Constraints 表，约束性），再回到对应包任务修 CSS；不得为通过而放宽容差。

- [ ] **Step 6: 提交**

```bash
git add apps/playground/e2e/markdown-parity.spec.ts apps/playground/e2e/publish-parity.spec.ts
git commit -m "test(playground): parity 几何按平台拆分，darwin 以 mac 参考图为准" -m "darwin 用 2026-10-10 mac 2× 参考图的实测几何（Markdown 外壳、状态栏、按钮、拖柄、图标栏、同步按钮、目录空态；发布弹窗各行、控件列、滚动条、chip 与 × 内距、声明下拉列表宽 242、标签面板 Esc 不关弹窗；内联卡片固定操作栏 68）。win32 只修正截图裁切与共享 CSS 推算值，字体度量相关且无法在 mac 复测的页签宽度标为 fixme。取代「Windows 几何也在 darwin 上跑」的旧规则。"
```

---

### Task 19: darwin 视觉基线重生成与陈旧 win32 基线清单

**Files:**
- Modify: `apps/playground/e2e/publish-visual.spec.ts`
- Regenerate（只 darwin）: `apps/playground/e2e/markdown-visual.spec.ts-snapshots/*-chromium-darwin.png`（8 张）、`apps/playground/e2e/publish-visual.spec.ts-snapshots/*-chromium-darwin.png`（7 张）

**Interfaces:**
- Consumes: Task 1–18 的全部改动（构建产物）
- Produces: 新 darwin 基线；陈旧 win32 基线清单（写入 Task 20 的交接文档）

- [ ] **Step 1: 调整 publish-visual**

1. 删除第 6–7 行（en-US locale 注释与 `test.use({ locale: 'en-US' })`）——定时发布弹窗不再用 `datetime-local`。
2. `FIXED_TIME` 上方注释改为：`// 定时发布弹窗的可选日期 / 时间档由 Date.now() 推算，固定时钟才能得到稳定基线；计时器照常运行`。
3. 「视觉基线：标签弹层」保留 6 个按钮断言（mock「推荐」分类内联 6 个标签），把 `page.getByRole('list', { name: '推荐标签' })` 前加 `page.getByRole('dialog', { name: '标签' })` 作用域。
4. 「视觉基线：定时发布弹窗」注释改为 `// 参考 19-09-01（弹窗本体；日期面板外观为 inferred default）`。

- [ ] **Step 2: 构建并逐个 spec 重生成**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/markdown-visual.spec.ts --update-snapshots
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/publish-visual.spec.ts --update-snapshots
```

- [ ] **Step 3: 确认只改了 darwin PNG**

```bash
git status --porcelain -- apps/playground/e2e | rg -- '-snapshots/' | rg -v -- '-darwin\.png$'
```

Expected: 无输出（退出码 1）。有任何 win32 PNG 出现在列表里：`git checkout -- <该文件>` 还原，并检查是否误在非 darwin 平台运行。

人工逐张打开新 darwin 基线，对照对应 mac 参考图确认：顶栏 56、状态栏分组与计数、额度提示、按钮、图标栏图标与 NEW 角标、发布弹窗滚动条与行距、标签 chip、标签面板、定时发布弹窗、固定操作栏。

- [ ] **Step 4: 不带 update 连跑两遍**

```bash
for i in 1 2; do
  lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
  pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/markdown-visual.spec.ts e2e/publish-visual.spec.ts e2e/showcase.spec.ts e2e/markdown-core.spec.ts || break
done
```

Expected: 两遍全部 PASS。`showcase` / `markdown-core` 基线不更新。showcase 用到 ui 的 Button / Dropdown / Modal / Popover / Tabs / Tag / ThemeToggle / Toast / Tooltip，不用 Select；Task 4 / 5 在 ui 中只改 `.ex-select__*`、新增 `.ex-tag--primary`、`.ex-picker-input*`、`.ex-date-picker*` 与 Select 箭头 token，`InlineLayer` 没有样式，`.ex-tag` / `.ex-btn` / `.ex-modal*` / `.ex-popover` / `.ex-dropdown*` / `.ex-tabs*` / `.ex-tooltip` 等共享规则一条未动；Task 1 改值的既有 token 只有 `--ex-color-pub-select-arrow(-modal)`（发布面板专用），其余均为新增。若失败，停下排查原因，不得更新这两个 spec 的基线。

- [ ] **Step 5: 记录陈旧 win32 基线**

以下 win32 PNG 在本计划后已过期（不修改、不删除，需业主在 Windows 上重生成）：

```text
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-dialog-link-light-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-edit-dark-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-edit-light-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-menu-list-light-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-preview-dark-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-preview-light-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-split-dark-chromium-win32.png
apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-split-light-chromium-win32.png
```

publish-visual 没有 win32 基线（在 Windows 首次运行会新建）；showcase / markdown-core 的 win32 基线不受影响。

- [ ] **Step 6: 提交**

```bash
git add apps/playground/e2e/publish-visual.spec.ts apps/playground/e2e/markdown-visual.spec.ts-snapshots/*-chromium-darwin.png apps/playground/e2e/publish-visual.spec.ts-snapshots/*-chromium-darwin.png
git commit -m "test(playground): 按 mac 参考图对齐后重生成 darwin 视觉基线" -m "Markdown 外壳、状态栏、图标栏，发布弹窗 / 内联卡片 / 标签面板 / 定时发布弹窗样式均已改变，darwin 基线逐个 spec 用 --update-snapshots 重生成并连跑两遍通过。定时发布弹窗不再依赖浏览器 locale，去掉 en-US 固定。8 张 markdown-visual win32 基线已过期，留待 Windows 重生成。"
```

---

### Task 20: 最终验证、参考图比对验收、交接文档

**Files:**
- Create: `apps/playground/e2e/reference-acceptance.spec.ts`
- Modify: `docs/superpowers/handoff/RESUME.md`、`docs/superpowers/handoff/reference-index.md`、`docs/superpowers/handoff/phase5-notes-from-4.md`

**Interfaces:**
- Consumes: 全部任务
- Produces: 可选验收 spec（`EX_ACCEPTANCE=1` 且 darwin 才运行）；交接文档更新

- [ ] **Step 1: 参考图比对验收 spec**

`reference-acceptance.spec.ts`：

```ts
import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'darwin' || process.env.EX_ACCEPTANCE !== '1', '仅 darwin 且 EX_ACCEPTANCE=1 时运行')
test.use({ viewport: { width: 1728, height: 932 }, deviceScaleFactor: 2 })

/** 每像素 RGB 最大通道差 > 48 计为不一致；不一致比例阈值 0.03（inferred default） */
const CHANNEL_TOL = 48
const MAX_MISMATCH = 0.03

interface Case {
  ref: string
  query: string
  /** 页面原点在参考图中的设备像素坐标（Global Constraints「参考几何」） */
  origin: [x: number, y: number]
  /** 比较区域（CSS px）：只比卡片 / 面板，排除顶栏（阶段 6）与 AI 面板内容（阶段 7） */
  clip: { x: number; y: number; width: number; height: number }
}

const MAIN = { x: 16, y: 72, width: 1218, height: 844 }
const MAIN_WIDE = { x: 16, y: 72, width: 1624, height: 844 }

const CASES: Case[] = [
  { ref: 'mac_2026-10-10_19-12-09.png', query: 'view=edit&panel=csdn:ai', origin: [-10, 2], clip: MAIN },
  { ref: 'mac_2026-10-10_19-12-19.png', query: 'view=split&panel=csdn:ai', origin: [-6, 2], clip: MAIN },
  { ref: 'mac_2026-10-10_19-12-27.png', query: 'view=preview&panel=csdn:ai', origin: [-10, 4], clip: MAIN },
  { ref: 'mac_2026-10-10_19-12-39.png', query: 'view=preview&panel=', origin: [-4, 0], clip: MAIN_WIDE },
  { ref: 'mac_2026-10-10_19-12-48.png', query: 'view=preview&panel=toc', origin: [0, 2], clip: MAIN_WIDE },
]

async function mismatch(page: Page, actual: Buffer, ref: string, sx: number, sy: number): Promise<number> {
  return page.evaluate(
    async ({ a, src, sx, sy, tol }) => {
      const load = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`无法加载 ${url.slice(0, 64)}`))
          img.src = url
        })
      const [ai, ri] = await Promise.all([load(`data:image/png;base64,${a}`), load(src)])
      const pixels = (img: HTMLImageElement, x: number, y: number) => {
        const canvas = document.createElement('canvas')
        canvas.width = ai.width
        canvas.height = ai.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, -x, -y)
        return ctx.getImageData(0, 0, ai.width, ai.height).data
      }
      const pa = pixels(ai, 0, 0)
      const pr = pixels(ri, sx, sy)
      let bad = 0
      for (let i = 0; i < pa.length; i += 4) {
        const diff = Math.max(Math.abs(pa[i]! - pr[i]!), Math.abs(pa[i + 1]! - pr[i + 1]!), Math.abs(pa[i + 2]! - pr[i + 2]!))
        if (diff > tol) bad++
      }
      return bad / (ai.width * ai.height)
    },
    { a: actual.toString('base64'), src: `/reference/${ref}`, sx, sy, tol: CHANNEL_TOL },
  )
}

for (const c of CASES) {
  test(`参考图比对：${c.ref}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`/markdown?fixture=test&${c.query}`)
    await expect(page.locator('.ex-mde-status__html')).toHaveText('HTML 4 字数 1 段落', { timeout: 5000 })
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(0, 0)
    const shot = await page.screenshot({ clip: c.clip, scale: 'device', caret: 'hide', animations: 'disabled' })
    const ratio = await mismatch(page, shot, c.ref, c.origin[0] + c.clip.x * 2, c.origin[1] + c.clip.y * 2)
    expect.soft(ratio, `${c.ref} 不一致像素比例`).toBeLessThanOrEqual(MAX_MISMATCH)
  })
}
```

- [ ] **Step 2: 全量验证**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force && pnpm test && pnpm typecheck && pnpm lint
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
pnpm --filter @editorx/playground exec playwright test --project=chromium-perf
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null
EX_ACCEPTANCE=1 pnpm --filter @editorx/playground exec playwright test --project=chromium e2e/reference-acceptance.spec.ts
```

Expected：单测 theme / ui / toolbar / markdown-core / markdown / publish 均 ≥ RESUME 基线（92 / 84 / 98 / 479+1 skip / 234 / 98）且全绿；typecheck / lint 0 错误；e2e chromium 全绿（74 + 新增，win32 describe 在 darwin 上 skipped）；perf 4/4；验收 spec 5 例的不一致比例逐一记录到 RESUME（超过 0.03 的列为 Open question，不阻塞）。

- [ ] **Step 3: 交接文档**

`RESUME.md`：更新当前进度（阶段 3/4 参考图对齐完成）、新单测数量、e2e 数量、验收比例；新增「陈旧 win32 基线」小节（Task 19 Step 5 清单）与「win32 待复测」小节（Task 18 中标注「共享 CSS 推算」的值与 fixme 用例）；变更说明加一条：**宿主行为变化：定时发布提前量不足 4 小时（或超过 7 天）现在会校验失败；可用 `scheduleRange` 覆盖**；新增「西文字体实测」小节，照抄 Task 7 Step 5a 的三行输出（current / helvetica / pingfang 各自的墨迹宽与参考差值）和结论（Markdown 外壳是否改用 `--ex-font-family-helvetica`，或「待业主确认」）。

`reference-index.md`：
1. macOS 表格中「对照」改为「比对」；19-12-09 行「当前行 1, 当前列 4」保持参考图原样（逗号后有空格）。
2. 表头说明补一句：PNG 位于 `apps/playground/public/reference/mac_2026-10-10_*.png`，原件文件名为 `docs/images/截屏2026-10-10 *.png`。
3. 末尾追加「参考几何（darwin）」一节，内容复制本计划 Global Constraints 的三张表与页面原点偏移。

`phase5-notes-from-4.md` 追加：
- `PublishPanel` 新增 `barPosition`（富文本页用 `'fixed'`）；`barStart` 宿主内容样式见 `/publish` 演示页（`共 N 字` + 粗体「回到顶部 ^」+ `QuotaNotice`，#1a1a1a 非红色）。
- 新 adapter `getTagCategories` / `getTagsByCategory`；`scheduleRange` 属性。
- ui 新增 `DatePicker` / `TimePicker` / `Select` 的 `popperArrow` / `offset` / `prefix`、`Tag variant="primary"`，富文本阶段可直接复用。
- 仍未做：Audit C 其余项、G20/G21/G22/G25。

- [ ] **Step 4: 提交**

```bash
git add apps/playground/e2e/reference-acceptance.spec.ts docs/superpowers/handoff/RESUME.md docs/superpowers/handoff/reference-index.md docs/superpowers/handoff/phase5-notes-from-4.md
git commit -m "docs(handoff): 参考图对齐完成，补充验收 spec 与交接说明" -m "新增可选的 mac 参考图像素比对验收（EX_ACCEPTANCE=1，darwin），记录各参考图不一致比例。交接文档写明陈旧 win32 基线、待 Windows 复测的推算值、定时发布区间带来的宿主行为变化，以及阶段 5 可复用的新组件与 adapter。"
```

---

## Open questions / defaults chosen

| # | 问题 | 采用的默认 | 可逆？ | 理由 |
|---|---|---|---|---|
| 1 | 目录非空时是否保留标题条？参考图只有空态（无标题条，G26） | 只有空态去掉标题条；非空仍显示 `@[TOC](标题)` 的标题条 | 是（CSS + 一处条件渲染） | 既有 e2e 依赖标题文字；参考图未覆盖非空态 |
| 2 | 面板拖柄纵向位置：固定 top 438 还是按面板高度比例？可调宽度范围？ | 固定 `top: 438px`；宽度 300–600，默认 390，键盘步长 10 | 是 | 参考图只有一个面板高度（G23）；范围为 inferred default |
| 3 | 页签字重：mac 约 500，win32 旧断言 600 | 共享 CSS 用 500；win32 页签宽度用例 fixme 待复测 | 是 | darwin 参考约束性（G16） |
| 4 | 内联操作栏高 69 → 68 | **控制方改判**：在 Task 14 改为 68（严格还原） | 是 | 业主要求严格还原；win32 基线本就因本计划变陈旧 |
| 5 | 定时发布「过早 / 过晚」错误文案 | 与提示同文案「请选择当前时间后 4小时 至 7天 进行定时发布」 | 是（文案键独立） | 参考图无错误态 |
| 6 | 日期选择面板外观 | Element 风格月历（inferred default） | 是 | 参考图只有输入框（B26） |
| 7 | 关闭同步滚动后的按钮外观 | 图标改为定位按钮的浅灰色，`aria-pressed=false` | 是 | 参考图只有开启态（G24） |
| 8 | 只读时目录空态「添加」是否可点 | 禁用（`ctx.readOnly`）；面板打开期间切换只读不实时刷新按钮（TocPanel 下次重渲染才生效），本计划不处理 | 是 | 只读不应改文档；实时刷新需给面板上下文加订阅，超出本阶段 |
| 9 | 标签 chip 换行行距、面板内选项 chip 样式 | 行距 8；选项 chip 24 高、primary 配色 | 是 | 参考图只有单行 / 单个 chip（B09、B20） |
| 10 | 暗色 token 值 | 全部自定，标注 inferred default | 是 | 参考图只有亮色 |
| 11 | 状态栏 / 正文内边距下限 | `max(16px, …)` 保底 16 | 是 | 参考图卡片最窄 1218，窄屏行为未定义（G03） |
| 12 | 参考图像素比对阈值 | 通道差 48、不一致比例 0.03，`expect.soft` | 是 | 无既定标准；只作验收参考，不阻塞 |
| 13 | 标签面板点击外部是否关闭 | 不关闭，只 × / Esc / 满 7 个关闭 | 是 | 19-09-01 中面板在定时弹窗遮罩下仍打开（B21，推断） |
| 14 | 定时区间是否可配置 | 默认 4h–7d，`scheduleRange` 属性可覆盖 | 是 | 宿主业务规则可能不同 |
| 15 | 发布页像素比对 | spec 内不做；**控制方改判**：阶段验收时由控制方用 ±4px 对齐搜索脚本对 R-1337 / R-1431 / R-0804 / R-0901 做像素比对 | 是 | 发布参考图的页面原点与滚动位置不确定 |
| 16 | 定时发布确认按钮在未选 / 越界时的行为 | **控制方裁定**：始终可点（与 R-0901 实心按钮一致）；点击时未选或越界则不提交，提示行改为错误色（文案同提示）；「取 消」颜色 `--ex-color-text-secondary`（实测 #555666） | 是 | 参考图只有初始态，点击后的反馈为推断 |
| 17 | 未激活「AI」图标栏标签色 #9a9a9a（比其他标签 #999 略浅）放在哪里 | 新 token `--ex-color-mde-rail-ai-label`，由 playground 通过 `data-panel='csdn:ai'` 覆盖；markdown 包不认识具体面板 | 是 | AI 面板是宿主扩展（G14） |
| 18 | 已选标签 chip 的 × 右内距与文字到 × 的距离 | padding-right 7.5（加 1px 边框 = 墨迹右内距 8.5）、gap 13；以 R-1431 的 60 宽 chip 为准 | 是 | 只有一个 chip 样本（B10），多字标签未实测 |
| 19 | 状态栏按钮 / 额度提示中心 −32 的实现 | 状态栏仍按 9/12 内边距排统计文字，额度提示与按钮两组加 `margin-top: 2px`（盒子下移 1px） | 是 | 统计文字位置与按钮中心在参考图中差 1px，单一 align 无法同时满足 |
| 20 | Markdown 外壳西文 / 数字字体 | Task 7 Step 5a 实测三种字体栈的墨迹宽，取与参考差 ≤ 0.5px 且最接近者；都不满足则保持现状并标「待业主确认」 | 是（一行 CSS） | 发布面板已确认 Helvetica Neue，Markdown 外壳无文字证据 |

## Spec conflicts

1. **`reference-index.md` 与实际文件**：索引写作「对照」模式，CSDN 界面与本计划用语为「比对」；索引中「当前行1,当前列0」（12-35-10 行）无空格，而 mac 参考图与实现为「当前行 1, 当前列 0」；索引称原件在 `docs/images/`，实际文件名为 `截屏2026-10-10 *.png`，playground 副本为 `mac_2026-10-10_*.png`。处理：以截图为准，Task 20 修正索引。
2. **阶段 4 已作废的裁定**：模态摘要框 58 / 抽取按钮下边距 1 / 多平台行 33（B02 改为 57 / 0 / 32）；「回到顶部」红色（B37 改为 #1a1a1a 粗体）；Select 箭头差异「不阻塞」（B12 改为必修）；定时发布基线依赖 en-US locale 与默认 now+1h（改为日期 / 时间选择器与 4h–7d 区间）；标签弹层「搜索 + 推荐」单栏结构（改为两栏面板）。处理：以 2026-10-10 业主裁定（progress.md）为准。
3. **`platform-addendum.md`「Windows 几何用例也在 darwin 上运行」**：与「darwin 以 mac 参考图为准」冲突。处理：Task 18 按平台拆分，取代该规则。
4. **「macOS 只用苹方」的假设**：B04 显示 CSDN 发布面板用 Element 字体栈，西文 / 数字走 Helvetica Neue。处理：新增 `--ex-font-family-helvetica`，只用于发布面板。
5. **阶段 3 的 /markdown 外框**：顶栏 61 + 外框 16/16/14/14 来自 Windows 截图裁切（G01/G02），mac 参考为 56 + 四周 16。处理：改为 56 / 16，win32 期望做裁切修正。
6. **「内容区左右 20%」规则不完整**：mac 1218 宽卡片上实测 101 = (1218 − 1016) / 2，不是 20%（G03）。处理：`max(16px, min(20cqi, (100cqi − 1016px) / 2))`。
7. **页签字重 600（阶段 3）vs 500（G16）**：以 mac 参考为准，win32 宽度待复测。
