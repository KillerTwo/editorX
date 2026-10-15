# 阶段 6 交给阶段 7 的笔记

阶段 6 代码 HEAD：`f4845cb`（分支 `develop`）。本笔记是其后的 docs(handoff) 提交。范围是 `@geekx/csdn` 的 `<CsdnEditor />`。阶段 7 做 `csdn-extensions` 时以本文为准。

## 代码范围

`<CsdnEditor />` 组合顶栏、一个编辑器、发布设置、确认切换和自动保存。`extensions` 默认是空数组。`@geekx/csdn-extensions` 尚未创建。

## 顶栏

顶栏类名 `.ex-csdn__bar`。高度 56px，无下边框。数字来自 `reference-index.md` G01「顶栏高 56，无下边框」。阶段 5 的 `/rich-text` 把参考坐标减 48，是因为那一页没有画顶栏。阶段 6 画的是 56。

按钮：返回（`onBack`）、保存草稿、主题切换（`showThemeToggle`，默认显示）、切换编辑器、发布。图标用 lucide，没有 CSDN logo。

文章标题只有一处。Markdown 的输入在顶栏，计数沿用 `titleCounter`（含空格的码点：`还需输入5个字`、`5 / 100`、`101/100`）。富文本的输入仍在稿纸上，顶栏不再放第二个输入框。

## 编辑器

`defaultEditor` 优先于 `initialDocument.editorType`，都没有则是 `markdown`。同一时刻只挂载 `MarkdownEditor` 或 `RichTextEditor`。外壳不把 `autoSaveInterval` 传给 `MarkdownEditor`。

切换始终先打开标题为「切换编辑器」的确认框。取消留在当前编辑器。Markdown 确认后把当前 `html` 作为富文本的 `defaultValue`。富文本确认后 `htmlToMarkdown(html)` 成为 Markdown 的 `defaultValue`。标题保留。切换用 remount 的 `defaultValue`，不在 effect 里调用 `setValue`（`setValue` 不触发 `onChange`）。

`onEditorTypeChange` 在确认切换和恢复备份时调用。playground `/csdn` 用它更换 extensions。富文本页不挂 `csdnSwitchEditorExtension`（那颗按钮会 toast「阶段 6 接入」）。历史、资源、视频、模板、AI 仍 toast「阶段 7 接入」或渲染占位。

## 滚动与发布栏

`.ex-csdn` 与 playground 的 `html:has(.pg-csdn)` / `body` 都是 `overflow: hidden`。不要改回 `window` 滚动。富文本仍滚在 `.ex-rte__scroll`。`PublishPanel` 用 `barPosition="fixed"`，固定栏挂到 `.ex-rte-bar-host.ex-pub`。`.ex-csdn` 与 `.ex-csdn__editor` 没有 `transform`。Markdown 编辑区 padding 16px，卡片顶在顶栏下 16px（56 + 16 = 72，G01）。`/csdn` 不像 `/rich-text` 那样给 `html` 加 `overflow-y: scroll`，不预留 15px 窗口槽。

字数：富文本正文用 `countRichTextChars`（非空白）。`a b` 是 2，`你好 世界` 是 4。标题计数不算进这套去空格的规则。

## 发布

顶栏「发布」调用与 `usePublishController.publish` 相同的顺序：没有 `onPublish` 则直接返回；`countChars(title.trim()) === 0` 提示「文章标题需为 5～100 个字」；`htmlToText(html) === ''` 提示「正文不能为空」；其后 `validatePublish`。成功时 `onPublish` 收到 `toPayload(document, settings)`。富文本且模板为墨衍时，`resolveTemplate` 把模板改回 `default`。

富文本的 `PublishPanel` 在 `afterPaper`。Markdown 不在编辑器下面再叠一张内联卡片，设置来自 `initialSettings` 和富文本面板写回的同一份 state。

## 自动保存

`autoSaveInterval` 属于外壳。`0`、缺省、非有限、大于 `2147483647` 都关闭。脏文档会先写 localStorage，键默认 `editorx-csdn-draft`，形状 `{ document, settings, updatedAt }`。然后调用 `adapters.onSaveDraft(document, settings)`。失败提示「保存草稿失败：{message}」，`data-dirty` 保持 `true`，不删除备份。连续自动保存失败只提示一次。手动保存成功提示「草稿已保存」。

加载时 `updatedAt > initialUpdatedAt`（默认 0）且指纹不同，才打开「恢复本地草稿」。取消保留初始文档，也保留备份。恢复对话框打开时不自动保存。

## 不做的事

阶段 7 仍要做：AI 助手、投票、视频、资源绑定、InsCode、模板的真实行为，以及反馈 tab。本阶段没有 changesets、README 或 npm 发布。

## 视觉

darwin 基线：

- `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-markdown-light-chromium-darwin.png`
- `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-richtext-light-chromium-darwin.png`

`csdn-visual.spec.ts` 在非 darwin 上整文件 skip，注释是「待 Windows 复测」。没有新增 win32 PNG，也没有改既有基线。参考图仍用 `apps/playground/public/reference/` 里已有的 mac 图（含顶栏的 `mac_2026-10-10_19-12-09` 与 `mac_2026-10-10_19-13-05`），本阶段没有下载新图。
