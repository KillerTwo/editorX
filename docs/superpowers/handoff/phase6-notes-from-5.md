# 阶段 5 交给阶段 6 的笔记

阶段 5 代码 HEAD：`c17676f`（分支 `develop`）。本笔记是其后的 docs(handoff) 提交，不含代码改动。范围是 `@editorx/rich-text` 的 `<RichTextEditor />`。阶段 6 做顶栏和 `<CsdnEditor />` 时以本文为准。

## 代码范围

`@editorx/rich-text` 交付 `<RichTextEditor />`。代码止于 `c17676f`，分支 `develop`。

## 公开 API

包入口导出：

- `RichTextEditor`
- `richTextCoreExtensions`
- `RICH_TEXT_TOOLBAR_LAYOUT`
- `countRichTextChars`
- 类型 `RichTextEditorHandle`、`RichTextEditorProps`、`RichTextEditorSlots`

ref：`focus` / `getValue` / `setValue` / `getDocument` / `insert`。`setValue` 替换 HTML，不触发 `onChange`。`getDocument()` 的 `editorType` 为 `'richtext'`，`markdown` 为 `undefined`。

插槽：`titleActions`、`afterPaper`、`rightCollapsed`。`afterPaper` 在稿纸下方、滚动容器内部，playground 在这里放 `PublishPanel`。`rightCollapsed` 是右侧抽屉收起后的浮层；playground 放 104×159 占位，阶段 7 再放 AI 菜单。

`onWordCount` 是非空白字数，由 `countRichTextChars` 计算：去掉 `script` / `style` / `noscript`，去掉不可见字符与全部空白，再按码点计数。首次挂载和每次 HTML 变化时调用。

## 滚动

`.ex-rte` 仍有 `overflow: hidden` 与 `transform: translate(0)`。固定发布栏若留在 `.ex-rte` 里，`position: fixed` 的包含块是这个有 transform 的根，画出内容区的部分会被 overflow 裁掉。

固定栏已移到 `.ex-rte` 外面的同级节点 `.ex-rte-bar-host.ex-pub`。宿主是 `display: contents`，栏的包含块回到视口，overflow 和 transform 不再裁切它。宿主带 `.ex-pub`，主按钮与 Helvetica 仍匹配 `.ex-pub` 的后代选择器。栏宽取 `window.innerWidth`（darwin 视口 1727 时为 1727），不写死 `+15px`。

稿纸和发布卡片仍在 `.ex-rte__scroll`（`overflow: auto`，`overscroll-behavior: contain`）里滚。滚到卡片时 `window.scrollY` 为 0。阶段 6 的顶栏放在编辑器外面。页面继续用这个内部滚动容器，不要改回 `window` 滚动。

## 发布

playground 的 `/rich-text` 传入 `document={{ editorType: 'richtext', title, html }}`，并设 `barPosition="fixed"`。未传 `templates` 时，`resolveTemplate` 只在 `editorType === 'markdown'` 时保留墨衍（`moyan`）；`'richtext'` 下墨衍禁用，当前值若是墨衍则回到 `'default'`。

未传 document 时，发布控制器用 `FALLBACK_DOC`：`{ editorType: 'markdown', title: '', html: '' }`。

标题 `trim` 后字数为 0，或 `htmlToText(doc.html)` 为空，都会 toast 错误并返回，不调用 `onPublish`。

## 目录

富文本目录来自 `extractHeadings`：非空的 `h1`–`h6`。正文里的 `@[TOC]` 不是标题，不会变成目录项。Markdown 的 `zhCN.panels.tocEmptyAfter` 仍含 `@[TOC]`，这条文案未改。

## 不做的事

本阶段没有顶栏、反馈 tab、`<CsdnEditor />`、编辑器切换的真实行为、AI 面板内容。

playground 占位扩展：`csdn:history`、`csdn:resource`、`csdn:video`、`csdn:template` 点击 toast「阶段 7 接入」；`csdn:switch-editor`（文案「使用 MD 编辑器」）点击 toast「阶段 6 接入」。图标是 lucide 的 `ArrowLeftRight`，单色 SVG。`csdn:ai` 右侧面板只渲染「AI 助手占位」。

## 视觉

darwin 基线四个文件，都在 `apps/playground/e2e/rich-text-visual.spec.ts-snapshots/`：

- `rich-text-empty-light-chromium-darwin.png`
- `rich-text-collapsed-light-chromium-darwin.png`
- `rich-text-scrolled-light-chromium-darwin.png`
- `rich-text-empty-dark-chromium-darwin.png`

深色没有参考图，基线只保证稳定。`rich-text-visual.spec.ts` 在非 darwin 上整文件 skip，原因是「待 Windows 复测」。`rich-text-parity.spec.ts` 的 win32 describe 已 skip，注释是「待 Windows 复测」。没有新增 `EX_ACCEPTANCE` 像素检索，`reference-acceptance.spec.ts` 未改。

## 参考图

- `mac_2026-10-10_19-13-05`：空文档，抽屉展开
- `mac_2026-10-10_19-13-15`：抽屉收起
- `mac_2026-10-10_19-13-37`：滚到发布卡片

编辑器坐标 = 参考页面坐标减 48（参考图顶栏高度）。本阶段不画顶栏，几何断言用编辑器坐标。darwin 视口 1727×932（内容宽 1712 + 15px 滚动条）。
