# Notes for phase 5 from phase 4 (binding unless superseded)

Phase 4 代码 HEAD: c23fbda（最终评审修正轮的最后一个代码提交；plan `docs/superpowers/plans/2026-10-09-phase4-publish-panel.md`，
develop 分支，09154c1..c23fbda）。本笔记的修订是其后的 docs(handoff) 提交，不含代码改动。
验证平台：macOS arm64（darwin）。最终修正轮全量验证：build --force 7/7、unit 全绿（publish 98、ui 84）、typecheck、lint 0 warning、
e2e chromium 74/74（基线无改动）、perf 4/4。

## 可直接复用的 API
- `@editorx/publish`：<PublishPanel />（内联卡片 + sticky 操作栏，slots.barStart）与 <PublishModal open onClose />（740 宽）。
  共用 props：value/defaultValue/onChange、document、adapters、missingAdapter、rules、coverModes、templates、
  agreementLinks、onPublished、locale、theme/defaultTheme/onThemeChange/themeStorageKey、className。
  只依赖 theme/ui/toolbar，可直接接到 <RichTextEditor /> 宿主（传 editorType: 'richtext' 的 EditorDocument）。
  公开面只有 PublishPanel / PublishModal 两个外壳、usePublishController 与下面的纯函数（最终评审 I1 裁定）。
  PublishForm / PublishActions 及其属性类型不再导出：它们依赖内部属性与未导出的 AdapterState / ScheduleDialog，拼不出可用外壳。
  phase 5 宿主只能用两个外壳；自定义外壳推迟到 phase 6 出现真实使用方时再设计导出（新增导出不算破坏性变更）。
- 选项列表（分类专栏/活动/话题）由常驻层加载：内联立即加载，弹窗首次打开时加载，之后关闭再打开沿用已加载列表，不重新请求、
  不闪「加载中…」、不重复「…加载失败」提示（与设置的归属一致）。代价：加载失败后不会自动重试（以前重开弹窗会重新加载），
  需要时由 phase 5/6 宿主或后续的重试入口解决；弹窗关闭时仍在进行的加载会完成，失败提示照常出现。
- 自建主题根 `.ex-pub-theme` 与 `.ex-mde-theme` 一样是 `display: contents`（S9 孪生代码，改一处须同步另一处）。
- 「文章模板」默认列表随 `document.editorType`：'markdown' → 墨衍模板可选；其他（含 'richtext'、未传 document）→ 墨衍禁用
  （12-36-05 是 CSDN 富文本编辑器的内联卡片 → 禁用；12-36-37 是 Markdown 编辑器的发布弹窗 → 可选）。显式 `templates` 仍覆盖默认。
  因此 phase 5 富文本宿主不用配置即与 12-36-05 一致。
- 纯函数：createSettings / validatePublish / PublishRules（函数替换、false 关闭）/ extractSummary / extractImages /
  htmlToText / toLocalInputValue / fromLocalInputValue（S8：已从包入口导出）。extractImages 跳过 ex-uploading:// 占位，富文本 HTML 同样适用。
- `controller.publish()` 只在宿主 `onPublished` 抛错时 reject（文章已发布成功），调用方不要把它当成发布失败。
- `@editorx/ui` 新组件：RadioGroup、Checkbox、Select（button + listbox）、ImageCropper + cropImage（16:9 等任意比例）、
  Modal maskClassName；弹窗内的浮层（Popover / Tooltip / Dropdown / Select listbox）通过 useModalLayerClass 画在遮罩之上。
  裁剪相关类型与常量已改名为 `CropSize` / `CROP_MAX_ZOOM`（原 `Size` / `MAX_ZOOM`）。
  富文本的图片/视频/链接对话框可直接复用。
- `@editorx/toolbar`：EditorAdapters 新增 getActivities / getTopics，onSaveDraft(doc, settings?)（「不并发」只对同一调用方成立）；
  zhCN.publish 文案桶。GitCode 备份协议文案已按参考截图逐字对齐：
  「您已同意GitCode 用户协议 和 隐私政策，我们会为您自动创建账号并备份文章至我的项目。」（用户协议/隐私政策在传 agreementLinks 时为链接，否则纯文本）。
- 主题 token：--ex-color-on-primary（主色按钮文字），--ex-color-pub-*（36 个，仅发布面板使用；Task 13 修正轮新增
  --ex-color-pub-option-modal）。每个 token 在 light-dark() 主块与三个 @supports not 兜底块中一致（theme styles.test.ts 守卫）。
- dist：`packages/publish/dist/index.js` 首行 `'use client';`，`dist/styles.css` 存在（S7：dist.test.ts 两项都断言）。

## Task 13 修正轮之后的视觉事实（以参考截图为准，覆盖计划表格）
- 单选文字颜色：内联未选 #606266 / 选中 #1a1a1a；弹窗未选 #555666 / 选中 #409eff（均走 --ex-color-pub-* token）。
- 「AI提取摘要」带魔杖图标（内联 SVG，currentColor）；「定时发布 ›」细箭头与文字间距 8px（按钮宽仍 116）。
- 必填「*」紧贴标签文字后 1px（内联；弹窗在标签左侧）；帮助图标位置与参考一致。
- 弹窗「多平台发布」选项位置 M+124 / M+231 与参考一致；弹窗摘要 textarea `resize: none`（内联保留拖拽角）。
- 弹窗视觉基线通过「关闭 → 鼠标点击『打开发布弹窗』」打开，避免加载即打开时关闭按钮的 :focus-visible 环被烘进基线；Modal 焦点行为未改。

## 视觉基线（重要）
- 发布面板基线只有 darwin：`publish-{inline,modal}-{light,dark}`、`publish-tags-popover-light`、`publish-schedule-light`、
  `publish-crop-light` 的 `*-chromium-darwin.png`。在 Windows 上首次运行时必须补 win32 基线：
  `--update-snapshots` 只能限定在 `e2e/publish-visual.spec.ts`，其他 spec 的 win32 基线不得变动。
- publish-parity.spec.ts 中 win32 的期望值是按 Windows 渲染的参考截图测得的，但从未在 Windows 上跑过（未验证）。
  文字宽度相关的 x 用 fontTol(win, darwin)；darwin 上内联 clientWidth 实测同样是 2539（恢复真实滚动条）。
- publish-schedule-light 只是稳定性基线（无 CSDN 参考）；publish-visual 固定 `locale: 'en-US'`（基线显示 10/09/2026, 11:00 AM）。
- 改了包 CSS 之后，跑 e2e 前必须完整 `pnpm build`（playground 用 `next start` 服务预构建产物；最终验证用 `pnpm build --force`）。

## 性能实测（chromium-perf，darwin，Task 14，/markdown 常驻挂载关闭的 PublishModal）
| 用例 | burst median / p95 | paused median / p95 | lines median / p95 | 顶部插入标题长任务 |
| --- | --- | --- | --- | --- |
| /markdown（MarkdownEditor） | 18.2 / 19.1 ms | 11.6 / 21.0 ms | 17.1 / 18.9 ms | 无（[]） |
| /markdown-core | 17.7 / 18.9 ms | 11.5 / 18.4 ms | 16.9 / 19.1 ms | 无（[]） |
| 3b 笔记（/markdown） | 14.9 / 20.8 ms | 15.7 / 20.8 ms | 16.0 / 20.1 ms | 无（[]） |
- 同一量级（全部 < 22ms，阈值 50ms）；p95 均在 3b 的 +0.2ms 以内（唯一高于 3b 的是 /markdown paused p95 21.0 vs 20.8，属噪声；其余都低于 3b）。median 差异主要是帧对齐（样本集中在 11–12 与 16–19ms 两档），
  且 3b 数值不是在这台机器上测的，不能视为回退。挂载关闭的 PublishModal 无可见开销。

## 遗留与已知差距
- 封面模式切换（单图/三图/无封面）默认隐藏，coverModes 传多项才显示；CSDN 截图中没有该控件。
- 等待负责人提供参考截图（awaiting owner reference screenshots）：创作声明的选项列表（现为 无声明 / 部分内容由AI辅助生成 /
  内容来源网络，进行整合/再创作 / 个人观点，仅供参考，值在共享类型 union 中，若 CSDN 实际列表不同需改 union）；
  定时发布弹窗（现为 400px + 原生 datetime-local，基线只保证稳定）。
- 帮助提示文案、原文链接输入框（「转载」时出现）也是推断的，没有参考截图。GitCode 协议文案已按参考截图对齐（见上）；链接地址由宿主 agreementLinks 提供。
- 「保存草稿 ▾」的三角没有菜单；「AI提取摘要」只做本地前 256 字提取，未接 aiAssist（phase 7 的 AI 扩展可替换）。
- 标题校验（5–100 字）在发布面板内完成；phase 6 的 <CsdnEditor /> 若自己校验标题，可传 rules={{ title: false }}。标题错误目前只有 toast（无字段）。
- /markdown 现在有两个 ToastProvider（编辑器与发布弹窗），多编辑器页面的 toast 合并仍是 3a 遗留项；
  PublishRoot 的 toast/主题归属代码与 markdown-editor.tsx 是孪生代码（S9，phase 6 宿主外壳统一）。
  e2e 里不要用裸 `getByRole('alert')`（Next 路由播报器也是 role=alert），一律 `.filter({ hasText })`。
- 深色 token 是自定值，深色基线只保证稳定，没有参考。
- 内联「参与活动/话题」标签换成两行是有意的（参考 12-36-05 同样换行），不要加 nowrap。
- /compare 核对记录（Task 14，headless 2554×1310/1312，叠加 50%，截图在 `.superpowers/sdd/2026-10-09-phase4-publish-panel/shots/t14-compare-*.png`）：
  - 内联（/publish 滚到底，clientWidth 2539）：卡片、各行、操作栏边缘与按钮重合；标签列文字、帮助图标、必填星号重合；
    上传框、无图提示、摘要框、AI提取摘要按钮重合。差异仅来自字体（PingFang vs 微软雅黑）：摘要占位符尾部、计数「0 / 256」字形、
    GitCode 协议链接之后的文字、可见范围第 3/4 个单选（≤3px，已在 fontTol 内）、「/话题」斜杠字形。
    创作声明/活动 Select 的下拉箭头比参考偏右约 1–2px、形状略小（非阻塞）。
    操作栏左侧是 playground 的 barStart 内容：参考里「回到顶部」为红色带上箭头，并有「今日发文额度还有 5 篇，可去这里提升额度」提示条，
    playground 只有纯文字「共 N 字 回到顶部」（宿主插槽内容，不属于包）。
  - 弹窗（/publish?mode=modal 与 /markdown?fixture=csdn&publish=1）：参考是 2560 宽画面裁切，参考模态框 x=910、y=220，
    我们 x=907、y=218.5（2554 视口居中），整体左移 3px、上移 1.5px；相对位置（标题、关闭按钮、各行、单选选中色 #409eff、
    墨衍模板可选、footer 阴影与按钮）重合，仅字体宽度差异。两种「加载即打开」状态下关闭按钮有 :focus-visible 环
    （已知，鼠标打开时没有；ruling 不改 Modal）。/markdown 的 csdn fixture 没有图片，所以显示「暂无内容图片」灰块而不是参考中的两张缩略图。

## Deferred minors（已经过 phase 4 最终评审分诊；phase 5 应知晓）
- Task 0：darwin 基线编码了 Windows UA 的快捷键提示（Ctrl+B），换 device UA 需重生成 12 张基线；测试标题仍写 "Ctrl+End"（darwin 实按 Cmd+ArrowDown）。
- Task 1：help.tags / help.summary 写死 7 / 256（错误文案用 {max}）；publish-types.test.ts 未断言 topicId/declaration/visibility/articleType/summary 字段类型。
- Task 3：z-index 规则只点名 `.ex-popover/.ex-tooltip`，新的浮层根若无这两个类会留在遮罩下；嵌套 Modal 时外层弹窗的 popover 会盖在内层遮罩上；
  MODAL_LAYER_CLASS / ModalLayer / useModalLayerClass 公开导出；layer.test openAll 可能断言到已脱离的 popover 节点。
- Task 4：Select 触发器 role=combobox 且焦点移入弹层（SR 审核时再看）；键盘测试缺 ArrowUp 打开、循环、打开时定位已选、焦点归还；同时传 label 与 labelledBy 时命名不一致。
- Task 5：新 src 加载时 area/natural 短暂为旧值；无 onError / naturalWidth 0 防护；展示 img 无 crossOrigin，CORS 失败到确认时才暴露；
  pointermove 未按 pointerId 过滤、右键可拖；裁剪区键盘操作未向读屏说明；clampCrop 对超大输入不保持比例。
- Task 6：htmlToText 服务端回退只解码 6 个实体；extractImages 的 `\bsrc` 会匹配 `data-src=`；fromLocalInputValue 接受越界值/拒绝 HH:mm:ss，
  formatScheduleTime 对无效 ISO 输出 "NaN-…"；边界测试缺口；DEFAULT_SETTINGS 数组运行期可变。
- Task 7：测试缺口（articleType 清除 sourceUrl 错误、草稿与发布互斥 busy、接受型受控父组件、loader 禁用/卸载后的 useAsyncList）。
- Task 8：摘要 textarea 的 aria-describedby 出错时替换计数而非并列；无字段测试覆盖 invalid 态；搜索防抖测试未证明等待；
  必填 `*` aria-hidden 且控件无 aria-required；标签去重区分大小写。（Safari IME Enter / keyCode 229 已在最终修正轮修复。）
- Task 9：三图模式一次只跟踪一个上传；裁剪导出失败复用「封面上传失败」；上传框变成「上传中…」时焦点落到 body、aria-busy 不播报；
  卸载后回调；测试缺口；未传 uploadImage 却启用时静默无操作；closeCrop 与卸载同批时可能重复 revoke（无害）；卸载中的上传结果仍经 onChange 应用。
- Task 10：M5 弹窗中的标签弹层 portal 在 `.ex-pub--modal` 之外 → 用内联占位色（无参考）；publish() 辅助函数应在设置 autoClose 前做 busy 守卫；
  rAF stub 注释措辞；packages/publish/package.json 缺 private/publishConfig（phase 8 发布检查）。
  （PublishFormProps 的 focusedFailures/onFailuresFocused 随 I1 不再公开，保持必填。）
- Task 11：?publish=1 的 F9 e2e 证据弱（样例无图片，代码路径已评审）。
- Task 12：「未填标签」的 "nothing logged" 检查无法失败；/markdown 用例未证明传的是当前文档（打开前追加文字）；
  emulateMedia 一致性、summary not.toHaveValue('')；markdown-parity.spec.ts 仍有自带的 box/near 副本。
  （hide 用例已断言「发布操作」组存在且操作栏按钮恰为 ['回到顶部']；publish.spec.ts 已加 console-error/pageerror 守卫，均在最终修正轮完成。）
- Task 13：token 重复（--ex-color-pub-option-modal 与 text-secondary 同值，见 Phase 8 清单）；没有 e2e 断言 /markdown 上墨衍模板可选
  （单测覆盖）；宿主恢复的设置里已选但被禁用的模板（如富文本宿主恢复 Markdown 草稿的 `template: 'moyan'`）不会被清除，发布时照样发送；
  `templates` 的 JSDoc 应写明该属性替换默认列表（并入 Phase 8 的命名检查）。
- Task 14 观察：未传 `document` 时表单把墨衍视为非 Markdown（禁用），而 controller 的 payload/草稿回退文档 EMPTY_DOC 是 editorType 'markdown'——两处默认不一致（宿主正常都会传 document）。
  另外未传 `document` 时标题规则被跳过，发布会发出空标题/空 html。
- 最终评审 M6：帮助图标是可聚焦的 `role="img"` 又是 Tooltip 触发器，读屏会把帮助文字读两遍（名称 + aria-describedby）。

## Phase 5 需带上的事项（最终评审 Recommendation 3）
- 裁剪器加固（phase 5 图片对话框会复用 ImageCropper）：图片 onError / naturalWidth 为 0 时给出提示而不是只禁用「确定」；
  远程图片需要 `crossOrigin`；pointermove 按 pointerId 过滤，非主键（右键）不开始拖动。
- `extractImages` 的 `\bsrc` 会匹配 `data-src=`：富文本粘贴的 HTML 常带 data-src，改为 `[\s"']src\s*=`。
- 封面上传时焦点保持：上传框变为「上传中…」后焦点落到 body、aria-busy 不播报，键盘用户确认裁剪后丢失位置。
- 无障碍一并处理：必填 `*` 与 `aria-required`、帮助图标语义（M6，改为 `<button aria-label>` 或 span + 「帮助」名称由 Tooltip 提供描述）。
- 清除「已选但被禁用」的模板（见 Task 13）。
- 未传 `document` 的发布行为（见 Task 14 观察：空标题/空 html、墨衍默认与 EMPTY_DOC 不一致）。

## Phase 8 清单
- Token 重复规则（最终评审 M2）：#555666 分散在 --ex-color-text-secondary 与 --ex-color-pub-option-modal；--ex-color-pub-text =
  --ex-color-mde-chrome-text、--ex-color-pub-link-modal = --ex-color-mde-preview-link、--ex-color-pub-button-border-modal = --ex-color-border。
  定一条规则：发布面板颜色全部走 --ex-color-pub-*，或重复项改为别名。
- Changelog 记录破坏性变更（M7）：`PublishSettings` 新增必填 declaration / backupToGitCode / template / multiPlatform，手工构造
  PublishSettings / PublishPayload 的宿主需补字段。
- `templates` 命名（M8）：PublishBaseProps.templates（展示模板）与 toolbar 的 `Template`（插入内容模板）同名不同义，props 冻结前考虑改为
  `articleTemplates`，JSDoc 写明替换默认列表。
- 所有包的 package.json 补 `private` / `publishConfig`（发布检查）。
- 复核 `MODAL_LAYER_CLASS` / `ModalLayer` / `useModalLayerClass` 是否继续公开导出。
- 首次在 Windows 上运行（Recommendation 5）：补 win32 发布面板基线，`--update-snapshots` 只限 `e2e/publish-visual.spec.ts`；
  `publish-parity.spec.ts` 若失败按测量值修正处理，不视为回退。
