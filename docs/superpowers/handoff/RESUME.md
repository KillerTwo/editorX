# 续作说明（换机继续开发）

## 当前进度（2026-10-12）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | 基础设施：monorepo、theme、ui、playground | 已完成 |
| 2 | markdown-core：渲染链、cledit 移植、命令、同步滚动 | 已完成 |
| 3 | toolbar 扩展 API + `<MarkdownEditor />` + CSDN 外观 | 已完成，浏览器验证通过（`4ac6969`）；mac 参考图对齐已完成 |
| 4 | `<PublishPanel />` / `<PublishModal />`（`@editorx/publish`） | 已完成（develop，09154c1..36196eb，未 push），浏览器验证通过（macOS）；mac 参考图对齐已完成 |
| 5 | 富文本（CKEditor 5 GPL）：`<RichTextEditor />` | 已完成（develop，代码 HEAD `c17676f`），见 `phase6-notes-from-5.md` |
| 6–8 | CsdnEditor 组合、csdn-extensions、发布准备 | 未开始 |

阶段 3/4 参考图对齐（业主 2026-10-10 macOS 2× 截图）已完成。代码止于 `9770135`；交接提交补上可选验收 spec 与本文档。未 push。

设计文档：`docs/superpowers/specs/2026-10-09-csdn-editor-design.md`（第 10 节为阶段划分）。

## 新机器准备

1. Node 24、pnpm 10（原机 node v24.5.0 / pnpm 10.33.4）。Windows + PowerShell 或 macOS + zsh 都是正式验收平台：
   阶段 1–3 的视觉基线有 win32 与 darwin 两版；阶段 4 的 `publish-visual` 基线只有 darwin 版，首次在 Windows 上运行时用
   `--update-snapshots` 只针对 `e2e/publish-visual.spec.ts` 生成 win32 版，`publish-parity` 失败按测量校正处理。
   macOS 上 corepack 报 “Cannot find matching keyid” 时，每个 shell 先 `export COREPACK_INTEGRITY_KEYS=0`。
2. `pnpm install`，`pnpm exec playwright install chromium`（在 `apps/playground` 下）。
3. 恢复本地工作目录（`.superpowers/` 被 `.git/info/exclude` 排除，不进 git）：
   ```powershell
   New-Item -ItemType Directory -Force .superpowers | Out-Null
   Copy-Item docs\superpowers\handoff\*.md, docs\superpowers\handoff\*.ps1 .superpowers\ -Exclude RESUME.md
   Add-Content .git\info\exclude ".superpowers/`n.playwright-mcp/"
   ```
   macOS：`mkdir -p .superpowers && cp docs/superpowers/handoff/*.md docs/superpowers/handoff/*.sh .superpowers/ && rm .superpowers/RESUME.md`，
   再把 `.superpowers/` 与 `.playwright-mcp/` 两行追加到 `.git/info/exclude`。
4. 验证：`pnpm build --force; pnpm test; pnpm typecheck; pnpm lint`（PowerShell 中 `;` 失败也会继续，逐条看 `$LASTEXITCODE`），
   然后 `pnpm --filter playground exec playwright test --project=chromium`，性能 `--project=chromium-perf --no-deps`。
   macOS：杀端口用 `lsof -ti tcp:3100 | xargs kill -9 2>/dev/null`，每条命令检查退出码。
   基线状态（阶段 3/4 参考图对齐完成，macOS，2026-10-12）：单元 theme 136 / ui 121 / toolbar 102 / markdown-core 488(+1 skip) / markdown 284 / publish 174；
   e2e chromium 79 passed、12 skipped（7 个 win32 describe 在 darwin 上 skipped，另 5 个参考图比对在未设 `EX_ACCEPTANCE=1` 时 skipped）；perf 4/4。
   验收（`EX_ACCEPTANCE=1`，darwin）5/5，不一致比例见下文。改了包的 CSS 后要完整 `pnpm build` 再跑 e2e（playground 用的是预构建的 Next 产物）。

## 交接材料（本目录）

- `phase6-notes-from-5.md`：阶段 6 必读，含富文本公开 API、滚动与底栏宿主、字数口径、darwin 基线。
- `phase5-notes-from-4.md`：阶段 5 必读，含发布面板公开 API、性能实测、/compare 结论、遗留项、phase 8 清单。
- `phase4-notes-from-3.md`：阶段 3 → 4 的笔记（仍有效，除非被 phase5 笔记取代）。
- `reference-index.md`：CSDN 参考截图（`apps/playground/public/reference/`）内容与所属阶段。
- `phase2-contract.md`、`phase2b-notes-from-2a.md`、`phase3-notes-from-2.md`：前序阶段的约束（仍有效，除非被后续笔记取代）。
- `task-brief.ps1 -Plan <plan> -N <n>`：从计划生成任务简报；`review-package.ps1 -Plan <plan> -Base X -Head Y -Label L`：生成审查 diff 包。输出写在 `.superpowers/sdd/<plan名>/`。
  macOS 用同目录的 bash 版：`bash .superpowers/task-brief.sh <plan名> <n>`、`bash .superpowers/review-package.sh <plan名> <BASE> <HEAD> <LABEL>`。

## 工作流程与约定（用户已确认）

- 按阶段推进：逐任务派子代理实现 → 任务审查 → 修复轮 → 复审；全部任务完成后做整分支终审 + 一轮修复；
  每个阶段完成后用浏览器（2558×1308，与参考截图比对）验证，通过后再进入下一阶段。用户不参与，只有需要用户操作或决策时才停下确认。
- 每个阶段结束向用户汇报「我做出的裁定」（裁定记录格式：做了什么 — 为什么 — 代价），台账在 `.superpowers/sdd/<plan>/progress.md`。
- 依赖：直接使用已安装的 node_modules，任务中不要 `pnpm install` / `playwright install`。只有 package.json 依赖确实变化时才装，
  且用 `pnpm install --offline`（只用本地 store）；本地 store 没有的新依赖（如阶段 5 的 CKEditor 5）由控制方一次性联网安装后再派任务。
- 参考截图：`apps/playground/public/reference/`（Windows 1× 的 `screenshot_*` 与 macOS 2× 的 `mac_*`），索引见 `reference-index.md`；
  必须严格还原截图中的样式与布局，没有截图的状态才允许推断并记为裁定。
- 分支 `develop`；不经询问不 push / merge。
- 提交：中文 Conventional Commits + 正文；只 `git add <明确路径>`，不用 `git add .` / `-A`。
- 技术决定：pnpm monorepo 发布 `@editorx/*`；React 19 + Next.js 16 App Router；不耦合后端（全部经 adapters 回调）；
  内容模型 `{ editorType, markdown?, html }`；原生 CSS，`.ex-` 前缀 + `--ex-*` 变量，亮/暗主题；CSDN 功能全部以工具栏扩展实现；CKEditor 5 用 GPL。
- 经验：杀掉 3100 端口后再跑 Playwright（`Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | % { Stop-Process -Id $_.OwningProcess -Force }`）；
  turbo 缓存可能给出过期产物，最终验证用 `pnpm build --force`；同一工作树不要两个写入者并行；像素比对用直接截图 `/markdown?fixture=csdn&view=...&panel=csdn:ai` 与参考图做墨迹行/列比对。

## 参考图验收比例（darwin，`EX_ACCEPTANCE=1`）

`apps/playground/e2e/reference-acceptance.spec.ts`：通道差 > 48 计为不一致，阈值 0.03（inferred default）。五例均 ≤ 0.03，没有 Open question。

| 参考图 | 不一致比例 |
|---|---|
| `mac_2026-10-10_19-12-09.png` | 0.005558165822302119 |
| `mac_2026-10-10_19-12-19.png` | 0.005635257861928886 |
| `mac_2026-10-10_19-12-27.png` | 0.004704316765111013 |
| `mac_2026-10-10_19-12-39.png` | 0.0035282375738332596 |
| `mac_2026-10-10_19-12-48.png` | 0.003800917225036771 |

## 陈旧 win32 基线

以下 8 张 markdown-visual win32 PNG 在参考图对齐之后已过期。未修改、未删除，需在 Windows 上重生成。`publish-visual` 没有 win32 基线（首次在 Windows 上运行才会生成）。showcase / markdown-core 的 win32 基线不受影响。

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

发布弹窗的 darwin 视觉 PNG 不是经典滚动条的证据（`publish-visual` 仍使用 Playwright 的 `--hide-scrollbars`）。11px 槽宽在 `publish-parity` 中断言。

## win32 待复测

Task 18 里标成「共享 CSS 推算，待 Windows 复测」的值，以及字体度量相关的 fixme。darwin 上这些 describe 整体 skipped（含 fixme）。裁切修正（顶栏 56、四周 16px 带来的平移）不在此列。

`markdown-parity.spec.ts`，describe `win32（12-35-10，2558×1308）`：

- 页签字重 `'500'`（G16）
- 状态栏 `padding` `'9px 16px 12px 26.5px'`（G06/G09）；状态栏文字 x `42.5`（16 + 26.5）
- 比对模式编辑区 padding `'11px 16px 16px'`、预览 padding `'11px 24px 16px 42px'`（G04）
- `test.fixme`：页签宽度与第 2/3 个页签 x（字重 500、无字距，需在 Windows 上按 12-35-10 重新实测）。期望仍是 tab0 宽 119、tab1.x 159、tab2.x 245

`publish-parity.spec.ts`（Task 18 Step 3 整表都标了共享 CSS 推算）：

- 内联单选点 x（相对控件列，B36 点→字 8，每个前置选项 +1）：articleType `[128, 232, 315]`、visibility `[128, 239, 350, 461]`、multiPlatform `[128, 197]`
- `MODAL_ROWS`（相对模态框顶）：tags 73/32、cover 121/90、summary 227/95、categories 338/32、articleType 386/32、declaration 434/32、backup 482/52、visibility 550/32、template 598/32、multiPlatform 646/32、activity 694/74
- 模态框高 872、y 220（B02，高 / y −3）
- 控件列宽 589；摘要框 589×57；活动宽 521；话题 top 736；footer top 808
- 内联操作栏高 68（共享 CSS，mac 实测 68，Audit C §bar）

## 西文字体实测

照抄 `92c79c7`（Task 7 Step 5a）。19-12-09，墨迹宽 CSS px，Playwright Chromium DSF 2。参考：状态栏 Markdown 53.5 / 状态栏 HTML 31.5（计划写的 24 只量到 HTM，L 在 x 128–138）/ 页签 Markdown 67.5。

```text
current（-apple-system, 'SF UI Text', Arial…；Chromium 不认 -apple-system，实际为 Arial）：54 / 31.5 / 63
helvetica（--ex-font-family-helvetica）：55.5 / 32 / 67
pingfang（'PingFang SC'）：56.5 / 33 / 67.5
```

结论：按区域选定，不把整个 Markdown 外壳改成 `--ex-font-family-helvetica`。状态栏用 Markdown 字体栈，页签字重 500。

## 变更说明

- **宿主行为变化：定时发布提前量不足 4 小时（或超过 7 天）现在会校验失败；可用 `scheduleRange` 覆盖。**

## 下一步

阶段 6（顶栏与 `<CsdnEditor />`）：先读 `phase6-notes-from-5.md`。顶栏放在编辑器外面，页面继续在 `.ex-rte__scroll` 里滚，不要改回 window 滚动。编辑器切换、反馈 tab、AI 面板内容仍未做。
创作声明下拉与定时发布弹窗已按 2026-10-10 mac 参考图落地，不再是待截图的推断实现。
