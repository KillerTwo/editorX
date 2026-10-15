# 阶段 7 交给阶段 8 的笔记

阶段 7 代码 HEAD：`ffadfd0`（分支 `develop`）。本笔记是其后的 docs(handoff) 提交。范围是 `@geekx/csdn-extensions`。阶段 8 做 Changesets、README 和 npm 发布时以本文为准。

## 包

`csdnExtensions` 顺序是 `csdn:ai`、`csdn:vote`、`csdn:video`、`csdn:resource`、`csdn:inscode`、`csdn:template`。各项都不设置 `editors`，所以 Markdown 和富文本都适用。运行时依赖是 toolbar、ui、theme、lucide-react。这个包不依赖 csdn、markdown、rich-text、markdown-core、publish。markdown 和 rich-text 也不依赖它。csdn 依赖它。

`CsdnEditor` 省略 `extensions` 时用这份列表。`extensions={[]}` 仍是空的。外壳把 `adapters` 传给 `MarkdownEditor` 和 `RichTextEditor`。没有新增 `missingAdapter` 属性，编辑器默认仍是 `hide`。

## 行为

没有后端。`getTemplates` 弹出模板：`替换全文` 走 `replaceDocument`，`插入` 走 `insert`。富文本遇到只有 `markdown` 的模板会提示「这个模板没有 HTML，不能写入富文本」，不改文档。工具栏按钮读 `toolbar.template`，文案是「模版」。`toolbar.undo` 仍是「撤消」。

`createVote`、`uploadVideo`、`searchResources`、`runCode` 成功后调用 `ctx.insertEmbed`。失败只 `notify`，不插入。空地址和 `javascript:` 地址不插入。`aiAssist` 的流写进右侧面板 `csdn:ai`。没有 `aiAssist` 时面板隐藏，`missingAdapter: 'disable'` 也隐藏。扩展不调用 `fetch`。

## 嵌入

Markdown 仍是 `ex-embed:<type>` 围栏。渲染器仍把原文放进 `data-ex-payload`（base64）。富文本仍写 `data-payload`（JSON 文本）。`htmlToMarkdown` 在没有 `data-ex-payload` 时读 `data-payload`。富文本 upcast 在没有 `data-payload` 时解码 `data-ex-payload`。没有第三种属性。

## 不做的事

反馈 tab 不在规格第 10 节第 7 项里，没有做。历史（历史 / 历史版本）仍是 playground 占位：Markdown 上禁用，富文本上 toast「阶段 7 接入」。切换编辑器仍是 `CsdnEditor` 顶栏按钮，没有「阶段 6 接入」的工具栏按钮。`/markdown` 和 `/rich-text` 的占位文件还在。本阶段没有 changesets、README 或 npm 发布。

## 视觉

`csdn-visual.spec.ts` 在非 darwin 上整文件 skip，注释是「待 Windows 复测」。本阶段只可能更新这两张 darwin 图：

- `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-markdown-light-chromium-darwin.png`
- `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-richtext-light-chromium-darwin.png`

没有新增 win32 PNG，也没有改 `RESUME.md` 里那份陈旧 win32 文件名列表。参考图仍用 `apps/playground/public/reference/` 里已有的 mac 图。没有下载新图。没有改 `packages/theme/src/styles.css`。

## 阶段 8

发布准备仍是未开始：Changesets、文档/README、npm 发布流程。
