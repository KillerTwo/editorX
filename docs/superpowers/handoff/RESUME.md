# 续作说明（换机继续开发）

## 当前进度（2026-10-10）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | 基础设施：monorepo、theme、ui、playground | 已完成 |
| 2 | markdown-core：渲染链、cledit 移植、命令、同步滚动 | 已完成 |
| 3 | toolbar 扩展 API + `<MarkdownEditor />` + CSDN 外观 | 已完成，浏览器验证通过（`4ac6969`） |
| 4 | `<PublishPanel />`（`@editorx/publish`） | 实施计划已写好（`05f85fe`，14 个任务）：`docs/superpowers/plans/2026-10-09-phase4-publish-panel.md`，尚未开始实现 |
| 5–8 | 富文本（CKEditor 5 GPL）、CsdnEditor 组合、csdn-extensions、发布准备 | 未开始 |

设计文档：`docs/superpowers/specs/2026-10-09-csdn-editor-design.md`（第 10 节为阶段划分）。

## 新机器准备

1. Node 24、pnpm 10（原机 node v24.5.0 / pnpm 10.33.4），Windows + PowerShell（Playwright 视觉基线只有 win32 版本）。
2. `pnpm install`，`pnpm exec playwright install chromium`（在 `apps/playground` 下）。
3. 恢复本地工作目录（`.superpowers/` 被 `.git/info/exclude` 排除，不进 git）：
   ```powershell
   New-Item -ItemType Directory -Force .superpowers | Out-Null
   Copy-Item docs\superpowers\handoff\*.md, docs\superpowers\handoff\*.ps1 .superpowers\ -Exclude RESUME.md
   Add-Content .git\info\exclude ".superpowers/`n.playwright-mcp/"
   ```
4. 验证：`pnpm build --force; pnpm test; pnpm typecheck; pnpm lint`（PowerShell 中 `;` 失败也会继续，逐条看 `$LASTEXITCODE`），
   然后 `pnpm --filter playground exec playwright test --project=chromium`，性能 `--project=chromium-perf --no-deps`。
   基线状态：单元 theme 55 / markdown-core 479(+1 skip) / ui 53 / toolbar 94 / markdown 234；e2e chromium 53/53；perf 4/4。

## 交接材料（本目录）

- `phase4-notes-from-3.md`：阶段 4 必读，含可复用 API、性能实测、/compare 结论、全部遗留项。
- `reference-index.md`：CSDN 参考截图（`apps/playground/public/reference/`）内容与所属阶段。
- `phase2-contract.md`、`phase2b-notes-from-2a.md`、`phase3-notes-from-2.md`：前序阶段的约束（仍有效，除非被后续笔记取代）。
- `task-brief.ps1 -Plan <plan> -N <n>`：从计划生成任务简报；`review-package.ps1 -Plan <plan> -Base X -Head Y -Label L`：生成审查 diff 包。输出写在 `.superpowers/sdd/<plan名>/`。

## 工作流程与约定（用户已确认）

- 按阶段推进：逐任务派子代理实现 → 任务审查 → 修复轮 → 复审；全部任务完成后做整分支终审 + 一轮修复；
  每个阶段完成后用浏览器（2558×1308，与参考截图比对）验证，通过后再进入下一阶段。用户不参与，只有需要用户操作或决策时才停下确认。
- 每个阶段结束向用户汇报「我做出的裁定」（裁定记录格式：做了什么 — 为什么 — 代价），台账在 `.superpowers/sdd/<plan>/progress.md`。
- 分支 `develop`；不经询问不 push / merge。
- 提交：中文 Conventional Commits + 正文；只 `git add <明确路径>`，不用 `git add .` / `-A`。
- 技术决定：pnpm monorepo 发布 `@editorx/*`；React 19 + Next.js 16 App Router；不耦合后端（全部经 adapters 回调）；
  内容模型 `{ editorType, markdown?, html }`；原生 CSS，`.ex-` 前缀 + `--ex-*` 变量，亮/暗主题；CSDN 功能全部以工具栏扩展实现；CKEditor 5 用 GPL。
- 经验：杀掉 3100 端口后再跑 Playwright（`Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | % { Stop-Process -Id $_.OwningProcess -Force }`）；
  turbo 缓存可能给出过期产物，最终验证用 `pnpm build --force`；同一工作树不要两个写入者并行；像素比对用直接截图 `/markdown?fixture=csdn&view=...&panel=csdn:ai` 与参考图做墨迹行/列比对。

## 下一步

执行阶段 4 计划：先通读计划并对照设计文档 §6.3 与 `phase4-notes-from-3.md` 审一遍，然后从 Task 1 开始按上述流程执行。
计划末尾的「Open questions / defaults chosen」尚未经控制方审阅：逐条判断，可逆的按默认执行并记为裁定，涉及产品取舍的再问用户。
