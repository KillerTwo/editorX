# Notes for phase 4 from phase 3 (binding unless superseded)

Phase 3 = plans 3a + 3b. 3b HEAD: 4ac6969 (3a 08127fc..6af69b6; 3b b24770b..4ac6969).

## 可直接复用的 API
- `@geekx/toolbar`：EditorExtension / ToolbarItem / PanelDef / ExtensionContext、resolveToolbar / resolvePanels、
  collectShortcuts / handleShortcut、<Toolbar>（ToolbarHandle.openDialog(id, extension?) → ToolbarDialogResult `'opened'|'disabled'|'missing'`）、
  MessagesProvider / useMessages、zhCN、EditorAdapters / PublishSettings（暂定形状）、ExtensionErrorBoundary / safeResolveText。
- `@geekx/markdown`：<MarkdownEditor />（props：value/defaultValue/onChange/adapters/extensions/coreExtensions/
  toolbarLayout/missingAdapter/autoSaveInterval/viewMode/defaultPanel/showRail/defaultSplit/theme/locale/readOnly/
  placeholder/height/slots{headerEnd,statusCenter,statusEnd}）；ref：focus/getValue/setValue/getHtml/getDocument/
  runCommand/insert/saveDraft/getEngine。
- 契约：受控 `value` 的外部变化不视为已保存（会被自动保存）；宿主载入草稿应使用 `ref.setValue`（会 markSaved 并清除「保存失败」）。
  onSaveDraft 不会并发调用、请求合并、强制保存可能在卸载后完成（见 JSDoc）。
- 发布弹窗（phase 4）应作为宿主 UI 放在 slots.statusEnd，或作为 csdn:* 扩展的 modal；PublishSettings 字段可在 phase 4 调整。

## 性能实测（chromium-perf，/markdown，10k 行，autosave=0）
- burst median 14.9ms / p95 20.8ms；paused 15.7 / 20.8；lines（回车/退格）16.0 / 20.1。
- 顶部插入标题长任务：无（[]）。

## /compare 核对结论（2558×1308，直接截图 /markdown 与参考图做墨迹列/行比对）
- edit（12-35-10）：编辑区文本行 x/y 完全一致；工具栏墨迹 ±1px。
- split（12-35-21，参考图相对裁切 1px 左 / 6px 上）：编辑区文本 x、分界线 1026、预览文本 x/顶部、右换行边 2030 均一致；整体差异 4.3%。
- preview（12-35-32）：正文行 1–3px 内。
- toc（12-36-59）：目录行与参考图 ±1px。
- 剩余可见差异：AI 面板中 playground 占位文字（phase 7 接 aiAssist adapter）；状态栏字数因 fixture 比 CSDN 文档短而不同（1378 vs 4102 字）。
- `/compare` 页 iframe 现按参考图原始尺寸渲染（4ac6969），叠加模式可用。
- 比对模式布局值（编辑区 `split×100% − 13px`、预览 padding `19px 24px 16px 42px`）只在参考尺寸实测，其他宽度未验证。

## 遗留与已知差距
- 模板、历史版本只是 playground 演示扩展；真正的 csdn-extensions 在 phase 7 实现。
- onChange 经过防抖：受控模式下回写会丢弃约 200ms 内的输入（3a 风险 1）。
- 拖放图片插在光标处，而不是指针落点。
- 上传失败的占位只在失败条中标红，编辑区文本不着色。
- 目录面板不高亮当前标题；编辑模式下脚注标题跳转为 no-op。
- 查找/替换（CSDN Ctrl+F/G）不在阶段 3 范围内。
- 卸载时不保存未保存内容（产品决策待定）。
- mermaid 首次渲染把容器挂到 <body>，约 250–500ms 内页面出现竖向滚动条、布局偏移 15px；建议在 markdown-core/src/renderer/diagrams.ts 给 mermaid.render 传离屏容器。修复前比对模式视觉基线可能偶发不稳。
- 分隔条拖动每帧重新测量；目录重新对齐窗口固定 5s；导出 HTML 未带 flowchart 样式。
- 排版像素尾项：编辑区 h4 17 vs 预览 16；`[^1]` 上标、`@[TOC]` +4px、`[^1]:` −4px；TOC 语法在多行段落内的高亮。
- 无障碍尾项：实心三角下拉箭头在 Windows 高对比（forced-colors）下不可见；勾选项只靠颜色（与 CSDN 一致，aria-checked 已有）；分隔条无 aria-valuetext；
  面板在焦点在内时关闭的焦点回退；程序化回焦时 Tooltip 弹出导致全屏需 3 次 Esc（@geekx/ui Tooltip 待复查）。
- 可配置性：比对模式 13px 偏移硬编码，建议 `--ex-mde-split-offset` 变量并更新 defaultSplit JSDoc；仅文字按钮的 6px 缩进应限定到下拉触发器。
- 测试尾项：save-status 非 display:none 的断言应放进 styles.test.ts；styles.test.ts 类名守卫只允许 `has-label`；autosave 精确计数；perf 预热等待图表；性能用例标题区分。
- Phase 5 提示：Messages 扩展分桶（extension-scoped messages）。
