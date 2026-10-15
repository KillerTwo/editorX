# 阶段 3b：CSDN 外壳像素级还原 + playground + e2e/性能/视觉基线 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **拆分说明**：阶段 3 拆为两份计划。**3a** 见 `docs/superpowers/plans/2026-10-09-phase3a-toolbar-markdown-editor.md`（扩展 API + React 包装核心，10 个任务）。本文件为 **3b**（8 个任务），**依赖 3a 全部完成**：直接修改 3a 产出的 `EditorShell`（`packages/markdown/src/markdown-editor.tsx`）、`store.ts`、`context.ts`、`internals.ts`、`core-extensions/index.ts`、`styles.css`。

**Goal:** 在 `<MarkdownEditor />` 上补齐 spec §6.1 的剩余 UI，包括状态栏（含保存状态）、`autoSaveInterval`、目录/语法面板与右侧图标栏、可拖动分隔条。然后按 CSDN 参考截图把外壳像素级还原，搭建 `/markdown` playground，并用 Playwright 覆盖功能 e2e、经组件测量的 `@perf` 门槛、Windows 视觉基线和参考截图几何对照。

**Architecture:** 所有新 UI 都是 `EditorShell` 内部的小组件，通过 3a 的 `EditorStore`（`useSyncExternalStore`）订阅各自字段，按键路径仍只有 rAF 合批的 store 更新。面板是扩展：`PanelDef` 经 `resolvePanels` 解析后，由 `PanelHost`（内容）和 `SideRail`（图标栏）渲染，内置的目录、语法面板与宿主的 `csdn:*` 演示面板地位相同。保存草稿由框架无关的 `createDraftSaver` 负责：只在内容变化时保存，同一时刻只有一次保存在进行。CSDN 外观只靠 `styles.css` 和新增的 `--ex-color-mde-*` token 实现，不在组件里写尺寸。

**Tech Stack:** React 19、`@geekx/toolbar`/`@geekx/markdown`（3a）、lucide-react 1.53、Vitest + jsdom + Testing Library、Next 16 playground、Playwright 1.64（`chromium` / `chromium-perf` 两个 project，截图基线 `*-chromium-win32.png`）。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md` §6.1（状态栏、分隔条、目录/语法面板、`autoSaveInterval`）、§8（视觉还原）、§9（测试）。绑定输入：
- `.superpowers/phase3-notes-from-2.md`：性能门槛与视觉差距清单；
- `.superpowers/reference-index.md`；
- `apps/playground/public/reference/screenshot_2026-10-09_12-35-{10,21,32}.png`、`12-36-59.png`、`12-37-24.png`；
- `.superpowers/verify/p3crops/*.png`。

---

## Global Constraints

- 继承 3a 的全部 Global Constraints：
  - `'use client'` 只加在 React 包；
  - SSR 安全；
  - StrictMode 生命周期；
  - onChange 语义；
  - peer 依赖；
  - 只用 `var(--ex-*)`；
  - 浮层挂 `.ex-portal`；
  - i18n；
  - 扩展隔离；
  - `restoreMocks`；
  - PowerShell 用 `;` 串联；
  - 逐文件 `git add`。
- **参考几何（2558×1308 视口，`/markdown?fixture=csdn&view=edit&panel=csdn:ai`）**：Task 7 的 parity 用例按下表断言（容差见用例）：
  - 顶栏高 61。
  - 外框 padding `16px 16px 14px 14px`。
  - `.ex-mde-main`：x14 y77 w2050 h1217，圆角 8。
  - 模式页签：x 为 26/157/243，y89，高 32，宽 119/74/74，页签间距 12，字重 600，圆角 8（执行期按参考像素复核修正；原表 158/244、间距 14 有误）。
  - `headerEnd` 右缘 2052（边缘坐标；原表 2051 为末像素下标）。
  - 工具栏：上外边距 17（原表 16 与底边 177 自相矛盾），高 39（含 1px 下边框），底边 177，左右 padding 10；「加粗」中心 (38, 157)。
  - 状态栏：顶 1230，padding `9px 24px 12px 25px`，字号 12px，行高 21px；两行中心 y 为 1250.5 和 1271.5，文字 x≈40。
  - 面板：x2080 w390，上下 padding 10。
  - 图标栏：x2486 w56，间距 16。
  - Markdown 模式内容左右 padding 20%（410px）。
  - 比对模式：编辑区宽≈1025（±16），编辑区 padding `16px 24px`，预览 padding `16px 40px`，预览背景 `#f9f9f9`，滚动条 8px、颜色 `#bbb`。
- **颜色**：CSDN 实测色只出现在 `packages/theme/src/styles.css` 的 `--ex-color-mde-*` token 中，并同时写入 `light-dark()` 主块和三个兜底块。暗色值是自定的，CSDN 没有暗色主题。
- **性能红线**：`@perf` 两个用例（10k 行按键延迟 median/p95 < 50ms；顶部插入标题无 > 50ms 长任务）在 `/markdown`（经 `<MarkdownEditor />`）上也必须通过，`/markdown-core` 上的原用例保留不变。
- **视觉基线**：
  - 新基线为 `markdown-{edit,split,preview}-{light,dark}`、`markdown-menu-list-light`、`markdown-dialog-link-light`，只在 Windows 上生成（`*-chromium-win32.png`）。
  - 生成时只对 `e2e/markdown-visual.spec.ts` 使用 `--update-snapshots`，绝不对其他文件使用。
  - 既有基线 `showcase-*`、`markdown-core-*` 必须保持不变。
- **e2e 前**：先 `pnpm build`（playground `pnpm start` 依赖构建产物），并释放 3100 端口：
  `Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

---

## File Structure

```text
packages/theme/src/
  styles.css                      # 修改：16 个 --ex-color-mde-* token（主块 + 3 个兜底块）
  styles.test.ts                  # 修改：断言 mde token 存在
packages/markdown/src/
  autosave.ts                     # 新增：createDraftSaver
  autosave.test.ts                # 新增
  status-bar.tsx                  # 新增：StatusBar、formatSavedTime
  status-bar.test.tsx             # 新增（含 autoSaveInterval 组件用例）
  panels/scroll-to-heading.ts     # 新增：目录跳转（预览/编辑区）
  panels/scroll-to-heading.test.ts
  panels/panel-host.tsx           # 新增：PanelHost
  panels/side-rail.tsx            # 新增：SideRail（收起/展开 + 面板按钮）
  panels/toc-panel.tsx            # 新增：TocPanel
  panels/syntax-panel.tsx         # 新增：SyntaxPanel
  panels/panels.test.tsx          # 新增
  core-extensions/panels.tsx      # 新增：tocPanelExtension、syntaxPanelExtension
  core-extensions/index.ts        # 修改：注册面板扩展
  splitter.tsx                    # 新增：Splitter、clampSplit、splitFromPointer
  splitter.test.tsx               # 新增
  context.ts / internals.ts       # 修改：scrollToHeading
  types.ts                        # 修改：autoSaveInterval/defaultPanel/showRail/defaultSplit/slots/saveDraft
  markdown-editor.tsx             # 修改（Task 1、2），Task 3 全文替换为最终版
  index.ts                        # 修改：导出面板扩展
  styles.css                      # Task 4 全文替换为 CSDN 外壳
  styles.test.ts                  # 修改：关键尺寸断言
apps/playground/
  package.json                    # 修改：@geekx/markdown、@geekx/toolbar
  app/page.tsx                    # 修改：/markdown 链接
  app/markdown/page.tsx           # 新增：解析 fixture/view/panel/autosave
  app/markdown/markdown-playground.tsx
  app/markdown/markdown.css
  app/markdown/csdn-sample.ts     # CSDN 默认欢迎文档（目录与参考截图一致）
  app/markdown/mock-adapters.ts
  app/markdown/csdn-demo-extensions.tsx
  e2e/support/latency.ts          # 新增：从 markdown-core.spec.ts 抽出的延迟探针
  e2e/markdown-core.spec.ts       # 修改：改为 import 探针（行为不变）
  e2e/markdown.spec.ts            # 新增：功能 + @perf
  e2e/markdown-visual.spec.ts     # 新增：视觉基线
  e2e/markdown-visual.spec.ts-snapshots/*.png   # 新增（Windows）
  e2e/markdown-parity.spec.ts     # 新增：参考截图几何对照
.superpowers/phase4-notes-from-3.md   # 新增：遗留项交接
```

---

## Tasks

1. 状态栏（统计、光标、保存状态、插槽）+ `autoSaveInterval` / `ref.saveDraft`
2. 面板：`PanelHost`、`SideRail`、目录面板（自定义标题、层级、跳转）、语法面板
3. 可拖动分隔条 + `EditorShell` 最终版
4. CSDN 外壳样式：`--ex-color-mde-*` token + `styles.css` 全文替换
5. playground `/markdown`：CSDN 示例文档、模拟 adapters、演示扩展、顶栏与控件
6. e2e：延迟探针抽取 + `markdown.spec.ts`（功能 + `@perf`）
7. 视觉基线 + 参考截图几何对照
8. 3b 全量验证 + `/compare` 人工核对 + phase 4 交接笔记

---

### Task 1: 状态栏 + `autoSaveInterval` / `ref.saveDraft`

**Files:**
- Create: `packages/markdown/src/autosave.ts`、`packages/markdown/src/autosave.test.ts`、`packages/markdown/src/status-bar.tsx`、`packages/markdown/src/status-bar.test.tsx`
- Modify: `packages/markdown/src/types.ts`、`packages/markdown/src/markdown-editor.tsx`

**Interfaces:**
- Consumes：
  - `EditorStore`（`stats`、`cursor`、`save`）；
  - `ExtensionContext.getDocument()`；
  - `EditorAdapters.onSaveDraft`；
  - `Messages.status.*`、`Messages.errors.save`。
- Produces：
  ```ts
  interface DraftSaver { save(force?: boolean): Promise<boolean>; markSaved(markdown: string): void; isDirty(): boolean }
  function createDraftSaver(deps: DraftSaverDeps): DraftSaver
  function StatusBar(props: { store; viewMode; center?: ReactNode; end?: ReactNode }): JSX.Element
  function formatSavedTime(timestamp: number): string   // HH:mm:ss
  // MarkdownEditorProps.autoSaveInterval?: number（ms，0/未设置 = 关闭）
  // MarkdownEditorSlots.statusCenter? / statusEnd?
  // MarkdownEditorHandle.saveDraft(): Promise<boolean>
  ```

- [ ] **Step 1: 写失败测试**

`packages/markdown/src/autosave.test.ts`：

```ts
import type { EditorDocument } from '@geekx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { createDraftSaver } from './autosave'
import { createEditorStore } from './store'

type SaveDraft = (doc: EditorDocument) => Promise<void>

function setup(adapter?: SaveDraft) {
  let value = 'a'
  const store = createEditorStore()
  const onError = vi.fn()
  const saver = createDraftSaver({
    store,
    getDocument: () => ({ editorType: 'markdown', title: 't', markdown: value, html: '' }),
    getAdapter: () => adapter,
    onError,
    now: () => 1000,
  })
  saver.markSaved('a')
  return {
    store,
    saver,
    onError,
    setValue: (next: string) => {
      value = next
    },
  }
}

describe('createDraftSaver', () => {
  it('未改动不保存；改动后保存并记录时间；force 时无改动也保存', async () => {
    const adapter = vi.fn<SaveDraft>(async () => {})
    const { saver, store, setValue } = setup(adapter)
    expect(saver.isDirty()).toBe(false)
    expect(await saver.save()).toBe(false)
    setValue('b')
    expect(saver.isDirty()).toBe(true)
    const pending = saver.save()
    expect(store.get().save.status).toBe('saving')
    expect(await pending).toBe(true)
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ markdown: 'b', title: 't' }))
    expect(store.get().save).toEqual({ status: 'saved', savedAt: 1000 })
    expect(saver.isDirty()).toBe(false)
    expect(await saver.save()).toBe(false)
    expect(await saver.save(true)).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('保存进行中再次调用复用同一次保存', async () => {
    let resolve!: () => void
    const adapter = vi.fn<SaveDraft>(() => new Promise<void>((r) => (resolve = r)))
    const { saver, setValue } = setup(adapter)
    setValue('b')
    const first = saver.save()
    const second = saver.save()
    resolve()
    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('失败：状态为 error、上报错误、内容仍视为未保存', async () => {
    const adapter = vi.fn<SaveDraft>().mockRejectedValueOnce(new Error('网络')).mockResolvedValueOnce(undefined)
    const { saver, store, onError, setValue } = setup(adapter)
    setValue('b')
    expect(await saver.save()).toBe(false)
    expect(store.get().save).toEqual({ status: 'error', savedAt: null })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: '网络' }))
    expect(saver.isDirty()).toBe(true)
    expect(await saver.save()).toBe(true)
  })

  it('没有 onSaveDraft 时什么都不做', async () => {
    const { saver, store, setValue } = setup(undefined)
    setValue('b')
    expect(await saver.save(true)).toBe(false)
    expect(store.get().save.status).toBe('idle')
  })
})
```

`packages/markdown/src/status-bar.test.tsx`：

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatSavedTime } from './status-bar'
import { renderEditor } from './test-utils'

const statusMd = () => document.querySelector<HTMLElement>('.ex-mde-status__md')
const statusHtml = () => document.querySelector<HTMLElement>('.ex-mde-status__html')
const saveText = () => document.querySelector<HTMLElement>('.ex-mde-status__save')!
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('StatusBar', () => {
  it('formatSavedTime 输出 HH:mm:ss', () => {
    expect(formatSavedTime(new Date(2026, 9, 9, 8, 5, 3).getTime())).toBe('08:05:03')
  })

  it('显示 Markdown/HTML 统计与光标行列；预览模式只显示 HTML 行', async () => {
    const { handle } = renderEditor({ defaultValue: '# 标题\n\n正文 hello' })
    await waitFor(() => expect(statusMd()).toHaveTextContent(/^Markdown \d+ 字数 3 行数 当前行 1, 当前列 0$/), {
      timeout: 3000,
    })
    expect(statusHtml()).toHaveTextContent(/^HTML \d+ 字数 \d+ 段落$/)
    act(() => {
      handle().focus()
      handle().getEngine().setSelection(8, 8)
    })
    await waitFor(() => expect(statusMd()).toHaveTextContent('当前行 3, 当前列 2'))
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(statusMd()).toBeNull()
    expect(statusHtml()).not.toBeNull()
  })

  it('statusCenter / statusEnd 插槽', () => {
    renderEditor({ slots: { statusCenter: <span>额度提示</span>, statusEnd: <button type="button">发布文章</button> } })
    const bar = screen.getByRole('group', { name: '状态栏' })
    expect(within(bar).getByText('额度提示')).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: '发布文章' })).toBeInTheDocument()
  })
})

describe('autoSaveInterval', () => {
  it('只在内容变化后调用 onSaveDraft，状态栏显示「文章已保存HH:mm:ss」', async () => {
    const onSaveDraft = vi.fn(async () => {})
    const { handle } = renderEditor({ defaultValue: 'a', title: '标题', autoSaveInterval: 30, adapters: { onSaveDraft } })
    await sleep(100)
    expect(onSaveDraft).not.toHaveBeenCalled()
    act(() => handle().getEngine().replace(1, 1, 'b'))
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({ title: '标题', markdown: 'ab' }))
    await waitFor(() => expect(saveText()).toHaveTextContent(/^文章已保存\d{2}:\d{2}:\d{2}$/))
    await sleep(100)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })

  it('保存失败：toast 提示并在状态栏显示「保存失败」', async () => {
    const onSaveDraft = vi.fn(async () => {
      throw new Error('网络')
    })
    const { handle } = renderEditor({ defaultValue: 'a', autoSaveInterval: 30, adapters: { onSaveDraft } })
    act(() => handle().getEngine().replace(1, 1, 'b'))
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败：网络')
    expect(saveText()).toHaveTextContent('保存失败')
  })

  it('ref.saveDraft 无改动也保存；ref.setValue 写入的内容视为已保存', async () => {
    const onSaveDraft = vi.fn(async () => {})
    const { handle } = renderEditor({ defaultValue: 'a', autoSaveInterval: 30, adapters: { onSaveDraft } })
    let saved = false
    await act(async () => {
      saved = await handle().saveDraft()
    })
    expect(saved).toBe(true)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
    act(() => handle().setValue('载入的文档'))
    await sleep(100)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @geekx/markdown exec vitest run src/autosave.test.ts src/status-bar.test.tsx`
Expected: FAIL —— `./autosave`、`./status-bar` 不存在。

- [ ] **Step 3: 实现**

`packages/markdown/src/autosave.ts`：

```ts
import type { EditorAdapters, EditorDocument } from '@geekx/toolbar'
import type { EditorStore } from './store'

export interface DraftSaverDeps {
  store: EditorStore
  getDocument(): EditorDocument
  getAdapter(): EditorAdapters['onSaveDraft']
  onError(error: unknown): void
  now?: () => number
}

export interface DraftSaver {
  /** 有改动（或 force）且配置了 onSaveDraft 时保存；返回是否保存成功 */
  save(force?: boolean): Promise<boolean>
  /** 把当前内容记为已保存（挂载、ref.setValue 后调用） */
  markSaved(markdown: string): void
  isDirty(): boolean
}

export function createDraftSaver(deps: DraftSaverDeps): DraftSaver {
  const now = deps.now ?? Date.now
  let saved: string | null = null
  let inFlight: Promise<boolean> | null = null

  return {
    markSaved(markdown) {
      saved = markdown
    },
    isDirty: () => (deps.getDocument().markdown ?? '') !== saved,
    save(force = false) {
      if (inFlight) return inFlight
      const adapter = deps.getAdapter()
      if (!adapter) return Promise.resolve(false)
      const doc = deps.getDocument()
      const markdown = doc.markdown ?? ''
      if (!force && markdown === saved) return Promise.resolve(false)
      const { savedAt } = deps.store.get().save
      deps.store.set({ save: { status: 'saving', savedAt } })
      inFlight = adapter(doc)
        .then(
          () => {
            saved = markdown
            deps.store.set({ save: { status: 'saved', savedAt: now() } })
            return true
          },
          (error: unknown) => {
            deps.store.set({ save: { status: 'error', savedAt } })
            deps.onError(error)
            return false
          },
        )
        .finally(() => {
          inFlight = null
        })
      return inFlight
    },
  }
}
```

`packages/markdown/src/status-bar.tsx`：

```tsx
import { useMessages } from '@geekx/toolbar'
import type { ReactNode } from 'react'
import { useEditorState, type EditorStore } from './store'
import type { ViewMode } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function formatSavedTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function StatusBar({
  store,
  viewMode,
  center,
  end,
}: {
  store: EditorStore
  viewMode: ViewMode
  center?: ReactNode
  end?: ReactNode
}) {
  const { status: s } = useMessages()
  const stats = useEditorState(store, (x) => x.stats)
  const cursor = useEditorState(store, (x) => x.cursor)
  const save = useEditorState(store, (x) => x.save)

  const md = `${s.markdown} ${stats?.mdWords ?? 0} ${s.words} ${stats?.lines ?? 1} ${s.lines} ${s.line} ${cursor.line}, ${s.column} ${cursor.column}`
  const html = `${s.html} ${stats?.htmlWords ?? 0} ${s.words} ${stats?.paragraphs ?? 0} ${s.paragraphs}`
  const saveText =
    save.status === 'saving'
      ? s.saving
      : save.status === 'error'
        ? s.saveFailed
        : save.status === 'saved' && save.savedAt !== null
          ? `${s.saved}${formatSavedTime(save.savedAt)}`
          : ''

  return (
    <div className="ex-mde-status" role="group" aria-label={s.label}>
      <div className="ex-mde-status__stats">
        {viewMode !== 'preview' && <div className="ex-mde-status__md">{md}</div>}
        <div className="ex-mde-status__html">{html}</div>
      </div>
      {center !== undefined && <div className="ex-mde-status__center">{center}</div>}
      <div className="ex-mde-status__end">
        <span className="ex-mde-status__save" aria-live="polite">
          {saveText}
        </span>
        {end}
      </div>
    </div>
  )
}
```

`packages/markdown/src/types.ts` 修改：

1. `MarkdownEditorHandle` 中 `getEngine(): EditorEngine` 之前加入：

```ts
  /** 立即保存草稿（无改动也保存）；未配置 onSaveDraft 或失败时返回 false */
  saveDraft(): Promise<boolean>
```

2. `MarkdownEditorSlots` 中 `headerEnd?: ReactNode` 之后加入：

```ts
  /** 状态栏中部（CSDN：发文额度提示） */
  statusCenter?: ReactNode
  /** 状态栏右侧（CSDN：保存草稿、发布文章） */
  statusEnd?: ReactNode
```

3. `MarkdownEditorProps` 中 `missingAdapter?: MissingAdapterPolicy` 之后加入：

```ts
  /** 自动保存间隔（ms），需 adapters.onSaveDraft；0 或不设置为关闭。只在内容变化后保存 */
  autoSaveInterval?: number
```

`packages/markdown/src/markdown-editor.tsx` 修改（基于 3a Task 9 的全文）：

1. import 区：在 `import { createMarkdownContext } from './context'` 之前加入 `import { createDraftSaver } from './autosave'`；在 `import { useEditorRuntime } from './runtime'` 之后加入 `import { StatusBar } from './status-bar'`。
2. `EditorShell` 参数解构中 `missingAdapter = 'hide',` 之后加入 `autoSaveInterval = 0,`。
3. 在 `useExtensionSetup(allExtensions, ctx, reportError)` 之后加入：

```tsx
  const [saver] = useState(() =>
    createDraftSaver({
      store,
      getDocument: () => ctx.getDocument(),
      getAdapter: () => live.current.adapters.onSaveDraft,
      onError: (error) => {
        const m = live.current.messages
        live.current.notify(formatMessage(m.errors.save, { message: errorMessage(error) }), 'error')
      },
    }),
  )

  // 声明在 useEditorRuntime 之后：引擎已挂载，初始内容视为已保存
  useEffect(() => {
    saver.markSaved(engine.getValue())
  }, [saver, engine])

  useEffect(() => {
    if (!(autoSaveInterval > 0)) return
    const timer = setInterval(() => void saver.save(), autoSaveInterval)
    return () => clearInterval(timer)
  }, [saver, autoSaveInterval])
```

4. `useImperativeHandle` 中：
   - `setValue: (markdown) => runtime.setValue(markdown),` 替换为：

```tsx
      setValue: (markdown) => {
        runtime.setValue(markdown)
        saver.markSaved(engine.getValue())
      },
```

   - `getEngine: () => engine,` 之前加入 `saveDraft: () => saver.save(true),`；
   - 依赖数组 `[engine, runtime, ctx]` 改为 `[engine, runtime, ctx, saver]`。
5. JSX 中 `<UploadFailures ... />` 之后加入：

```tsx
        <StatusBar store={store} viewMode={viewMode} center={slots?.statusCenter} end={slots?.statusEnd} />
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @geekx/markdown exec vitest run; pnpm --filter @geekx/markdown typecheck; pnpm lint`
Expected: 全部 PASS（含 3a 既有用例）；类型检查与 lint 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/markdown/src/autosave.ts
git add packages/markdown/src/autosave.test.ts
git add packages/markdown/src/status-bar.tsx
git add packages/markdown/src/status-bar.test.tsx
git add packages/markdown/src/types.ts
git add packages/markdown/src/markdown-editor.tsx
git commit -m "feat(markdown): 状态栏与自动保存草稿" -m "StatusBar 订阅 store 显示 Markdown 字数/行数/当前行列与 HTML 字数/段落（与 CSDN 文案一致），预览模式只显示 HTML 行；提供 statusCenter/statusEnd 插槽并显示保存状态「文章已保存HH:mm:ss」。" -m "createDraftSaver 只在内容变化后调用 onSaveDraft，保存中复用同一 Promise，失败时 toast 提示且保持未保存；新增 autoSaveInterval 与 ref.saveDraft，ref.setValue 写入的内容视为已保存。"
```

---

### Task 2: 面板——`PanelHost`、`SideRail`、目录面板、语法面板

**Files:**
- Create: `packages/markdown/src/panels/scroll-to-heading.ts`、`panels/scroll-to-heading.test.ts`、`panels/panel-host.tsx`、`panels/side-rail.tsx`、`panels/toc-panel.tsx`、`panels/syntax-panel.tsx`、`panels/panels.test.tsx`、`core-extensions/panels.tsx`
- Modify: `packages/markdown/src/internals.ts`、`context.ts`、`core-extensions/index.ts`、`types.ts`、`index.ts`、`markdown-editor.tsx`

**Interfaces:**
- Consumes：
  - `resolvePanels`、`ResolvedPanel`、`resolveText`、`ExtensionErrorBoundary`（toolbar）；
  - `EditorStore.panel/toc/tocTitle`；
  - `EditorEngine.getSectionOffsets()`；
  - `Messages.panels.*`、`Messages.syntax.items`。
- Produces：
  ```ts
  function scrollToHeading(target: ScrollToHeadingTarget): boolean
  function PanelHost(props: { position: 'right' | 'bottom'; panels; ctx; store; onError }): JSX.Element | null
  function SideRail(props: { panels; store }): JSX.Element
  const tocPanelExtension: EditorExtension     // panel id 'toc'，order 20
  const syntaxPanelExtension: EditorExtension  // panel id 'syntax'，order 30
  // MarkdownInternals.scrollToHeading(id): boolean
  // MarkdownContextDeps.scrollToHeading?(id): boolean
  // MarkdownEditorProps.defaultPanel?: string | null；showRail?: boolean
  ```

- [ ] **Step 1: 写失败测试**

`packages/markdown/src/panels/scroll-to-heading.test.ts`：

```ts
import type { EditorEngine, SectionOffset } from '@geekx/markdown-core'
import { describe, expect, it, vi } from 'vitest'
import { scrollToHeading } from './scroll-to-heading'

function trackScrollTop(el: HTMLElement, initial: number) {
  const state = { top: initial }
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => state.top,
    set: (v: number) => {
      state.top = v
    },
  })
  return state
}

const rect = (top: number) => ({ top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20, x: 0, y: top, toJSON() {} }) as DOMRect

function setup() {
  const previewScroller = document.createElement('div')
  const previewEl = document.createElement('div')
  previewEl.innerHTML =
    '<div class="ex-preview-section" data-section-index="0"><h1 id="a">A</h1></div>' +
    '<div class="ex-preview-section" data-section-index="1"><h2 id="b">B</h2></div>'
  previewScroller.append(previewEl)
  const editorHost = document.createElement('div')
  const offsets: SectionOffset[] = [
    { start: 0, end: 3, top: 0, height: 20 },
    { start: 4, end: 8, top: 240, height: 20 },
  ]
  const engine = { getSectionOffsets: () => offsets } as unknown as EditorEngine
  return { previewScroller, previewEl, editorHost, engine }
}

describe('scrollToHeading', () => {
  it('预览可见时按标题位置滚动预览区', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    const preview = trackScrollTop(previewScroller, 50)
    vi.spyOn(previewScroller, 'getBoundingClientRect').mockReturnValue(rect(100))
    vi.spyOn(previewEl.querySelector('#b')!, 'getBoundingClientRect').mockReturnValue(rect(400))
    expect(scrollToHeading({ id: 'b', viewMode: 'split', engine, editorHost, previewEl, previewScroller })).toBe(true)
    expect(preview.top).toBe(350)
  })

  it('Markdown 模式按标题所在段滚动编辑区', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    const editor = trackScrollTop(editorHost, 0)
    expect(scrollToHeading({ id: 'b', viewMode: 'edit', engine, editorHost, previewEl, previewScroller })).toBe(true)
    expect(editor.top).toBe(240)
  })

  it('找不到标题时返回 false', () => {
    const { previewScroller, previewEl, editorHost, engine } = setup()
    expect(scrollToHeading({ id: 'nope', viewMode: 'preview', engine, editorHost, previewEl, previewScroller })).toBe(false)
  })
})
```

`packages/markdown/src/panels/panels.test.tsx`：

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resolvePanels, type EditorExtension } from '@geekx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { markdownCoreExtensions } from '../core-extensions'
import { renderEditor } from '../test-utils'

const rail = () => screen.getByRole('navigation', { name: '侧边栏' })
const railButtons = () => within(rail()).getAllByRole('button').map((b) => b.textContent)

describe('面板', () => {
  it('内置扩展提供目录（order 20）与语法（order 30）面板', () => {
    const panels = resolvePanels(markdownCoreExtensions, { editorType: 'markdown', adapters: {} })
    expect(panels.map((p) => p.panel.id)).toEqual(['toc', 'syntax'])
  })

  it('侧栏：点击打开/再次点击关闭；收起后展开恢复上一个面板', async () => {
    renderEditor({ defaultValue: '# 一\n\n## 二\n\n### 三' })
    expect(railButtons()).toEqual(['展开', '目录', '语法'])
    await userEvent.click(within(rail()).getByRole('button', { name: '目录' }))
    expect(within(rail()).getByRole('button', { name: '目录' })).toHaveAttribute('aria-pressed', 'true')
    const panel = screen.getByRole('complementary', { name: '目录' })
    await waitFor(() => expect(within(panel).getAllByRole('button').map((b) => b.textContent)).toEqual(['一', '二', '三']))
    expect(
      within(panel)
        .getAllByRole('listitem')
        .map((li) => li.getAttribute('data-depth')),
    ).toEqual(['0', '1', '2'])

    await userEvent.click(within(rail()).getByRole('button', { name: '收起' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    await userEvent.click(within(rail()).getByRole('button', { name: '展开' }))
    expect(screen.getByRole('complementary', { name: '目录' })).toBeInTheDocument()
    await userEvent.click(within(rail()).getByRole('button', { name: '目录' }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('目录：显示 @[TOC] 自定义标题；无标题时显示空态', async () => {
    const { handle } = renderEditor({ defaultValue: '@[TOC](自定义目录)\n\n# 一', defaultPanel: 'toc' })
    const panel = screen.getByRole('complementary', { name: '目录' })
    await waitFor(() => expect(within(panel).getByText('自定义目录')).toBeInTheDocument())
    handle().setValue('只有正文')
    await waitFor(() => expect(within(panel).getByText('为文内增加标题，这里将生成目录')).toBeInTheDocument())
  })

  it('目录项点击不抛错（跳转逻辑见 scroll-to-heading.test）', async () => {
    renderEditor({ defaultValue: '# 一\n\n## 二', defaultPanel: 'toc', defaultViewMode: 'preview' })
    const panel = screen.getByRole('complementary', { name: '目录' })
    await userEvent.click(await within(panel).findByRole('button', { name: '二' }))
    expect(panel).toBeInTheDocument()
  })

  it('语法面板：defaultPanel 打开；「更多操作 → 语法说明」切换', async () => {
    renderEditor({ defaultPanel: 'syntax' })
    const panel = screen.getByRole('complementary', { name: '语法' })
    expect(within(panel).getByText('@[TOC](目录标题)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '语法说明' }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('showRail=false 隐藏图标栏，面板仍可由工具栏打开', async () => {
    renderEditor({ showRail: false })
    expect(screen.queryByRole('navigation', { name: '侧边栏' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '语法说明' }))
    expect(screen.getByRole('complementary', { name: '语法' })).toBeInTheDocument()
  })

  it('宿主面板按 order 排序；render 抛错被隔离并提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const demo: EditorExtension = {
      name: 'demo:panel',
      panels: [{ id: 'demo', title: '演示', position: 'right', order: 5, render: () => <p>演示内容</p> }],
    }
    const boom: EditorExtension = {
      name: 'demo:boom',
      panels: [
        {
          id: 'boom',
          title: '炸',
          position: 'right',
          order: 50,
          render: () => {
            throw new Error('boom')
          },
        },
      ],
    }
    renderEditor({ extensions: [demo, boom], defaultPanel: 'boom' })
    expect(railButtons()).toEqual(['收起', '演示', '目录', '语法', '炸'])
    expect(await screen.findByRole('alert')).toHaveTextContent('扩展 demo:boom 出错：boom')
    await userEvent.click(within(rail()).getByRole('button', { name: '演示' }))
    expect(screen.getByRole('complementary', { name: '演示' })).toHaveTextContent('演示内容')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @geekx/markdown exec vitest run src/panels`
Expected: FAIL —— `./scroll-to-heading` 不存在；侧边栏 navigation 不存在。

- [ ] **Step 3: 实现**

`packages/markdown/src/panels/scroll-to-heading.ts`：

```ts
import type { EditorEngine } from '@geekx/markdown-core'
import type { ViewMode } from '../types'

export interface ScrollToHeadingTarget {
  id: string
  viewMode: ViewMode
  engine: Pick<EditorEngine, 'getSectionOffsets'>
  editorHost: HTMLElement | null
  previewEl: HTMLElement | null
  previewScroller: HTMLElement | null
}

/**
 * 预览可见时滚动预览区（比对模式由同步滚动带动编辑区）；
 * Markdown 模式预览隐藏但仍渲染，按标题所在段的序号滚动编辑区。
 */
export function scrollToHeading({ id, viewMode, engine, editorHost, previewEl, previewScroller }: ScrollToHeadingTarget): boolean {
  if (!previewEl) return false
  const target = Array.from(previewEl.querySelectorAll<HTMLElement>('[id]')).find((el) => el.id === id)
  if (!target) return false
  if (viewMode !== 'edit') {
    if (!previewScroller) return false
    previewScroller.scrollTop += target.getBoundingClientRect().top - previewScroller.getBoundingClientRect().top
    return true
  }
  const section = target.closest<HTMLElement>('.ex-preview-section')
  const offset = engine.getSectionOffsets()[Number(section?.dataset.sectionIndex ?? -1)]
  if (!editorHost || !offset) return false
  editorHost.scrollTop = offset.top
  return true
}
```

`packages/markdown/src/internals.ts`：`MarkdownInternals` 中 `toggleFullscreen(): void` 之后加入：

```ts
  /** 目录跳转；找不到标题返回 false */
  scrollToHeading(id: string): boolean
```

`packages/markdown/src/context.ts` 修改：
1. `MarkdownContextDeps` 中 `getLiveHtml(): string` 之后加入 `scrollToHeading?(id: string): boolean`。
2. `registerMarkdownInternals(ctx, { ... })` 对象中 `toggleFullscreen: ...,` 之后加入：

```ts
    scrollToHeading: (id) => deps.scrollToHeading?.(id) ?? false,
```

`packages/markdown/src/panels/panel-host.tsx`：

```tsx
import { ExtensionErrorBoundary, safeResolveText, useMessages, type ExtensionContext, type ResolvedPanel } from '@geekx/toolbar'
import { cx } from '../cx'
import { useEditorState, type EditorStore } from '../store'

export function PanelHost({
  position,
  panels,
  ctx,
  store,
  onError,
}: {
  position: 'right' | 'bottom'
  panels: readonly ResolvedPanel[]
  ctx: ExtensionContext
  store: EditorStore
  onError(name: string, error: unknown): void
}) {
  const m = useMessages()
  const active = useEditorState(store, (s) => s.panel)
  const current = panels.find((p) => p.panel.id === active)
  if (!current) return null
  return (
    <aside
      className={cx('ex-mde-panel', `ex-mde-panel--${position}`)}
      aria-label={safeResolveText(current.panel.title, m, ctx, current.extension, current.panel.id)}
      data-panel={current.panel.id}
    >
      <ExtensionErrorBoundary
        key={current.panel.id}
        name={current.extension}
        onError={onError}
        render={() => current.panel.render(ctx)}
      />
    </aside>
  )
}
```

`packages/markdown/src/panels/side-rail.tsx`：

```tsx
import { safeResolveText, useMessages, type ResolvedPanel } from '@geekx/toolbar'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cx } from '../cx'
import { useEditorState, type EditorStore } from '../store'

export function SideRail({ panels, store }: { panels: readonly ResolvedPanel[]; store: EditorStore }) {
  const m = useMessages()
  const active = useEditorState(store, (s) => s.panel)
  const open = active !== null && panels.some((p) => p.panel.id === active)
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (open) last.current = active
  }, [open, active])

  const toggleAll = () => {
    if (open) {
      store.set({ panel: null })
      return
    }
    const target = panels.find((p) => p.panel.id === last.current) ?? panels[0]
    if (target) store.set({ panel: target.panel.id })
  }

  return (
    <nav className="ex-mde-rail" aria-label={m.panels.rail}>
      <button type="button" className="ex-mde-rail__item" onClick={toggleAll}>
        <span className="ex-mde-rail__icon" aria-hidden="true">
          {open ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </span>
        <span className="ex-mde-rail__label">{open ? m.panels.collapse : m.panels.expand}</span>
      </button>
      <span className="ex-mde-rail__divider" aria-hidden="true" />
      {panels.map(({ panel, extension }) => {
        const pressed = panel.id === active
        return (
          <button
            key={panel.id}
            type="button"
            aria-pressed={pressed}
            className={cx('ex-mde-rail__item', pressed && 'is-active')}
            onClick={() => store.set({ panel: pressed ? null : panel.id })}
          >
            {panel.icon && (
              <span className="ex-mde-rail__icon" aria-hidden="true">
                {panel.icon}
              </span>
            )}
            <span className="ex-mde-rail__label">{safeResolveText(panel.title, m, undefined, extension, panel.id)}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

（若 lucide-react 1.53 中图标名为 `PanelRightClose`/`PanelRightOpen` 的别名不存在，改用 `PanelRightDashed`/`PanelRight`；只影响图标。）

`packages/markdown/src/panels/toc-panel.tsx`：

```tsx
import { useMessages, type ExtensionContext } from '@geekx/toolbar'
import { getMarkdownInternals } from '../internals'
import { createEditorStore, useEditorState } from '../store'

const FALLBACK_STORE = createEditorStore()

export function TocPanel({ ctx }: { ctx: ExtensionContext }) {
  const m = useMessages()
  const internals = getMarkdownInternals(ctx)
  const store = internals?.store ?? FALLBACK_STORE
  const toc = useEditorState(store, (s) => s.toc)
  const title = useEditorState(store, (s) => s.tocTitle)
  const minLevel = toc.reduce((min, item) => Math.min(min, item.level), 6)

  return (
    <div className="ex-mde-toc">
      <div className="ex-mde-panel__title">{title ?? m.panels.toc}</div>
      {toc.length === 0 ? (
        <p className="ex-mde-toc__empty">{m.panels.tocEmpty}</p>
      ) : (
        <ul className="ex-mde-toc__list">
          {toc.map((item, index) => (
            <li key={`${item.id}:${index}`} className="ex-mde-toc__item" data-depth={Math.min(item.level - minLevel, 2)}>
              <button type="button" className="ex-mde-toc__link" title={item.text} onClick={() => internals?.scrollToHeading(item.id)}>
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

`packages/markdown/src/panels/syntax-panel.tsx`：

```tsx
import { useMessages } from '@geekx/toolbar'

export function SyntaxPanel() {
  const m = useMessages()
  return (
    <div className="ex-mde-syntax">
      <div className="ex-mde-panel__title">{m.panels.syntax}</div>
      <dl className="ex-mde-syntax__list">
        {m.syntax.items.map(([title, example]) => (
          <div key={title} className="ex-mde-syntax__item">
            <dt>{title}</dt>
            <dd>
              <pre>{example}</pre>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
```

`packages/markdown/src/core-extensions/panels.tsx`：

```tsx
import type { EditorExtension } from '@geekx/toolbar'
import { BookOpen, ListTree } from 'lucide-react'
import { SyntaxPanel } from '../panels/syntax-panel'
import { TocPanel } from '../panels/toc-panel'

export const tocPanelExtension: EditorExtension = {
  name: 'core:toc-panel',
  editors: ['markdown'],
  panels: [
    {
      id: 'toc',
      title: (m) => m.panels.toc,
      icon: <ListTree size={20} />,
      position: 'right',
      order: 20,
      render: (ctx) => <TocPanel ctx={ctx} />,
    },
  ],
}

export const syntaxPanelExtension: EditorExtension = {
  name: 'core:syntax-panel',
  editors: ['markdown'],
  panels: [
    {
      id: 'syntax',
      title: (m) => m.panels.syntax,
      icon: <BookOpen size={20} />,
      position: 'right',
      order: 30,
      render: () => <SyntaxPanel />,
    },
  ],
}
```

`packages/markdown/src/core-extensions/index.ts` 修改：
1. 在 `import { imageExtension, linkExtension, moreInsertExtension } from './insert'` 之后加入 `import { syntaxPanelExtension, tocPanelExtension } from './panels'`。
2. `markdownCoreExtensions` 数组末尾（`moreActionsExtension,` 之后）加入 `tocPanelExtension,` 与 `syntaxPanelExtension,`。
3. 末尾 `export { ... }` 中加入 `syntaxPanelExtension,` 与 `tocPanelExtension,`。

`packages/markdown/src/index.ts`：`from './core-extensions'` 的导出列表加入 `syntaxPanelExtension,` 与 `tocPanelExtension,`。

`packages/markdown/src/types.ts`：`MarkdownEditorProps` 中 `onViewModeChange?(mode: ViewMode): void` 之后加入：

```ts
  /** 初始打开的面板 id（如 'toc'），默认不打开 */
  defaultPanel?: string | null
  /** 是否显示右侧面板图标栏，默认 true */
  showRail?: boolean
```

`packages/markdown/src/markdown-editor.tsx` 修改：
1. toolbar import 列表加入 `resolvePanels,`（位于 `MessagesProvider,` 与 `resolveToolbar,` 之间）。
2. 加入 import：`import { PanelHost } from './panels/panel-host'`、`import { scrollToHeading } from './panels/scroll-to-heading'`、`import { SideRail } from './panels/side-rail'`（放在 `./mode-tabs` 之后）。
3. 参数解构中 `onViewModeChange,` 之后加入 `defaultPanel = null,` 与 `showRail = true,`。
4. `const [store] = useState(() => createEditorStore())` 改为 `const [store] = useState(() => createEditorStore({ panel: defaultPanel }))`。
5. `const live = useLatest({ adapters, messages, notify, title, readOnly, theme: resolved })` 改为 `const live = useLatest({ adapters, messages, notify, title, readOnly, theme: resolved, viewMode })`。
6. `createMarkdownContext({ ... })` 的参数对象中 `getLiveHtml: ...,` 之后加入：

```tsx
      scrollToHeading: (id) =>
        scrollToHeading({
          id,
          viewMode: live.current.viewMode,
          engine,
          editorHost: hostRef.current,
          previewEl: previewRef.current,
          previewScroller: previewScrollRef.current,
        }),
```

7. `const shortcuts = useMemo(...)` 之前加入：

```tsx
  const panels = useMemo(() => resolvePanels(allExtensions, resolveOptions), [allExtensions, resolveOptions])
  const rightPanels = useMemo(() => panels.filter((p) => p.panel.position === 'right'), [panels])
  const bottomPanels = useMemo(() => panels.filter((p) => p.panel.position === 'bottom'), [panels])
```

8. JSX：
   - `.ex-mde-body` 闭合 `</div>` 之后、`<UploadFailures` 之前加入 `<PanelHost position="bottom" panels={bottomPanels} ctx={ctx} store={store} onError={reportError} />`；
   - `.ex-mde-main` 闭合 `</div>` 之后、根 `</div>` 之前加入：

```tsx
      <PanelHost position="right" panels={rightPanels} ctx={ctx} store={store} onError={reportError} />
      {showRail && rightPanels.length > 0 && <SideRail panels={rightPanels} store={store} />}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @geekx/markdown exec vitest run; pnpm --filter @geekx/markdown typecheck; pnpm lint`
Expected:
- 全部 PASS，包括 3a 的 `core-extensions.test.tsx`：工具栏分组断言只在 `role=toolbar` 内查询，不受图标栏影响；
- 类型检查与 lint 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/markdown/src/panels/scroll-to-heading.ts
git add packages/markdown/src/panels/scroll-to-heading.test.ts
git add packages/markdown/src/panels/panel-host.tsx
git add packages/markdown/src/panels/side-rail.tsx
git add packages/markdown/src/panels/toc-panel.tsx
git add packages/markdown/src/panels/syntax-panel.tsx
git add packages/markdown/src/panels/panels.test.tsx
git add packages/markdown/src/core-extensions/panels.tsx
git add packages/markdown/src/core-extensions/index.ts
git add packages/markdown/src/internals.ts
git add packages/markdown/src/context.ts
git add packages/markdown/src/types.ts
git add packages/markdown/src/index.ts
git add packages/markdown/src/markdown-editor.tsx
git commit -m "feat(markdown): 目录/语法面板与右侧图标栏" -m "面板由扩展的 PanelDef 提供，经 resolvePanels 排序后由 PanelHost 渲染（ExtensionErrorBoundary 隔离），SideRail 提供收起/展开与各面板开关（aria-pressed）。" -m "目录面板显示 @[TOC] 自定义标题，按相对层级 18/16/13px 排版；点击时预览可见则滚动预览区，Markdown 模式按段序号滚动编辑区。新增 defaultPanel/showRail。"
```

---

### Task 3: 可拖动分隔条 + `EditorShell` 最终版

**Files:**
- Create: `packages/markdown/src/splitter.tsx`、`packages/markdown/src/splitter.test.tsx`
- Modify: `packages/markdown/src/types.ts`；`packages/markdown/src/markdown-editor.tsx`（全文替换为最终版）

> **执行注意（3a 完成后补充，基于 3a 最终代码 6af69b6）：** 下文"最终版"全文写于 3a 各修复轮之前，**不得整体粘贴**。以当前 `markdown-editor.tsx` 为底稿，只合入本任务新增的部分（分隔条、面板、状态栏、草稿保存等），并逐项确认以下现有行为仍在：
> 1. 导入：toolbar 用 `useIsMacPlatform`（`const mac = useIsMacPlatform()`，不是 `useMemo(isMacPlatform, [])`）并导入 `activeExtensions`；导出相关用 `./export-html` 的 `drawDiagramsForExport`（不是 markdown-core 的 `renderDiagrams`）；上传相关导入 `observeFailedPlaceholders`。
> 2. `MarkdownEditor`：是否自建 `ThemeProvider` 由首渲染时的 `ownTheme`（`useState`）决定，之后不再改变树形；`themeIgnored` 开发态警告；模块级 `isDev()`。
> 3. `EditorShell`：`active = useMemo(() => activeExtensions(allExtensions, 'markdown'), [allExtensions])`，`embeds`、`useExtensionSetup`、`resolveToolbar`、`collectShortcuts` 都用 `active`；`resolvePanels` 也传 `active`。
> 4. `mountedRef` + `createMarkdownContext({ ..., renderExportHtml, isMounted: () => mountedRef.current })`；`renderExportHtml` 体保持 `await runtime.flush(); … drawDiagramsForExport(html, live.current.theme)`。
> 5. 全屏 `isolateFullscreen` effect（锁 `<html>`/`<body>` overflow、兄弟节点 `inert`、退出/卸载恢复）与 `--ex-z-fullscreen` 层级。
> 6. 上传接线：uploader `isReadOnly`；effect 内 `attach/detach`、`observeFailedPlaceholders`、粘贴时 `text/plain` 非空不拦截；`<UploadFailures readOnly onRetry onRemove onEmptied />`。
> 7. runtime 行为（卸载同步 flush `onChange`、`ref.setValue` 挂载前生效、CRLF 归一比较）位于 `runtime.ts`，合入时不要改动。
>
> 其他 3a 产出差异：上传失败条按钮名称为 `重试 <文件名>` / `删除 <文件名>`（`Messages.upload.retryItem/removeItem`）；带 `active` 的菜单项角色为 `menuitemcheckbox`（如「语法说明」「全屏」），测试按此查询；面板/图标栏标题用 `safeResolveText`。

**Interfaces:**
- Consumes：`Messages.editor.splitter`。
- Produces：
  ```ts
  const SPLIT_MIN = 0.2, SPLIT_MAX = 0.8
  function clampSplit(value: number): number
  function splitFromPointer(clientX: number, rect: { left: number; width: number }): number | null
  function Splitter(props: { value; onChange(next: number): void; bodyRef }): JSX.Element
  // MarkdownEditorProps.defaultSplit?: number（默认 0.5）
  // .ex-mde-body 上的 CSS 变量 --ex-mde-split
  ```

- [ ] **Step 1: 写失败测试**

`packages/markdown/src/splitter.test.tsx`：

```tsx
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { clampSplit, splitFromPointer } from './splitter'
import { renderEditor } from './test-utils'

const body = () => document.querySelector<HTMLElement>('.ex-mde-body')!

describe('clampSplit / splitFromPointer', () => {
  it('限制在 0.2–0.8，非有限值回到 0.5', () => {
    expect(clampSplit(0.1)).toBe(0.2)
    expect(clampSplit(0.95)).toBe(0.8)
    expect(clampSplit(0.5 + 0.02)).toBe(0.52)
    expect(clampSplit(Number.NaN)).toBe(0.5)
  })

  it('按指针位置换算比例；容器宽度为 0 时返回 null', () => {
    expect(splitFromPointer(400, { left: 100, width: 1000 })).toBe(0.3)
    expect(splitFromPointer(2000, { left: 100, width: 1000 })).toBe(0.8)
    expect(splitFromPointer(400, { left: 0, width: 0 })).toBeNull()
  })
})

describe('分隔条', () => {
  it('只在比对模式渲染；方向键/Home/End 调整比例并写入 --ex-mde-split', async () => {
    renderEditor({ defaultViewMode: 'edit' })
    expect(screen.queryByRole('separator')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: '比对' }))
    const sep = screen.getByRole('separator', { name: '调整编辑区与预览区宽度' })
    expect(sep).toHaveAttribute('aria-valuenow', '50')
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
    act(() => sep.focus())
    await userEvent.keyboard('{ArrowRight}')
    expect(sep).toHaveAttribute('aria-valuenow', '52')
    expect(body().style.getPropertyValue('--ex-mde-split')).toBe('0.52')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(sep).toHaveAttribute('aria-valuenow', '48')
    await userEvent.keyboard('{Home}')
    expect(sep).toHaveAttribute('aria-valuenow', '20')
    await userEvent.keyboard('{End}{ArrowRight}')
    expect(sep).toHaveAttribute('aria-valuenow', '80')
  })

  it('defaultSplit 超出范围时被限制', () => {
    renderEditor({ defaultSplit: 0.95 })
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '80')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @geekx/markdown exec vitest run src/splitter.test.tsx`
Expected: FAIL —— `./splitter` 不存在。

- [ ] **Step 3: 实现**

`packages/markdown/src/splitter.tsx`：

```tsx
import { useMessages } from '@geekx/toolbar'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'

export const SPLIT_MIN = 0.2
export const SPLIT_MAX = 0.8
const STEP = 0.02

export function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(value * 1000) / 1000))
}

export function splitFromPointer(clientX: number, rect: { left: number; width: number }): number | null {
  return rect.width > 0 ? clampSplit((clientX - rect.left) / rect.width) : null
}

export function Splitter({
  value,
  onChange,
  bodyRef,
}: {
  value: number
  onChange(next: number): void
  bodyRef: RefObject<HTMLDivElement | null>
}) {
  const m = useMessages()

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? value - STEP
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? value + STEP
          : e.key === 'Home'
            ? SPLIT_MIN
            : e.key === 'End'
              ? SPLIT_MAX
              : null
    if (next === null) return
    e.preventDefault()
    onChange(clampSplit(next))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current
    if (e.button !== 0 || !body) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture?.(e.pointerId)
    const rect = body.getBoundingClientRect()
    const move = (ev: globalThis.PointerEvent) => {
      const next = splitFromPointer(ev.clientX, rect)
      if (next !== null) onChange(next)
    }
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={m.editor.splitter}
      aria-valuemin={SPLIT_MIN * 100}
      aria-valuemax={SPLIT_MAX * 100}
      aria-valuenow={Math.round(value * 100)}
      className="ex-mde-splitter"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  )
}
```

`packages/markdown/src/types.ts`：`MarkdownEditorProps` 中 `showRail?: boolean` 之后加入：

```ts
  /** 比对模式编辑区所占比例（0.2–0.8），默认 0.5 */
  defaultSplit?: number
```

`packages/markdown/src/markdown-editor.tsx` 全文替换为（包含 3a 与本计划 Task 1–3 的全部改动）：

```tsx
import { ClEditEngine, type EditorEngine, type RendererOptions } from '@geekx/markdown-core'
import { ThemeProvider, useOptionalTheme, useTheme } from '@geekx/theme'
import {
  collectShortcuts,
  errorMessage,
  formatMessage,
  handleShortcut,
  isMacPlatform,
  MessagesProvider,
  resolvePanels,
  resolveToolbar,
  Toolbar,
  useExtensionSetup,
  useMessages,
  useStableArray,
  type EditorAdapters,
  type EditorExtension,
} from '@geekx/toolbar'
import { ToastProvider, useToast } from '@geekx/ui'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createDraftSaver } from './autosave'
import { createMarkdownContext } from './context'
import { MARKDOWN_TOOLBAR_LAYOUT, markdownCoreExtensions } from './core-extensions'
import { cx } from './cx'
import { ModeTabs } from './mode-tabs'
import { PanelHost } from './panels/panel-host'
import { scrollToHeading } from './panels/scroll-to-heading'
import { SideRail } from './panels/side-rail'
import { useEditorRuntime } from './runtime'
import { clampSplit, Splitter } from './splitter'
import { StatusBar } from './status-bar'
import { createEditorStore, useEditorState } from './store'
import type { MarkdownEditorProps } from './types'
import { observeFailedPlaceholders } from './uploads/failed-marker'
import { UploadFailures } from './uploads/upload-failures'
import { createUploader, imageFiles } from './uploads/uploader'
import { useControllableState } from './use-controllable'
import { useLatest } from './use-latest'

const createDefaultEngine = (): EditorEngine => new ClEditEngine()
const NO_ADAPTERS: EditorAdapters = {}
const NO_EXTENSIONS: readonly EditorExtension[] = []

function LocalizedToasts({ children }: { children: ReactNode }) {
  const m = useMessages()
  return <ToastProvider closeLabel={m.dialog.close}>{children}</ToastProvider>
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const outer = useOptionalTheme()
  const { theme, defaultTheme, onThemeChange, themeStorageKey, locale } = props
  const content = (
    <MessagesProvider messages={locale}>
      <LocalizedToasts>
        <EditorShell {...props} />
      </LocalizedToasts>
    </MessagesProvider>
  )
  if (outer && theme === undefined && defaultTheme === undefined) return content
  return (
    <ThemeProvider
      theme={theme}
      defaultTheme={defaultTheme}
      onThemeChange={onThemeChange}
      storageKey={themeStorageKey}
      className="ex-mde-theme"
    >
      {content}
    </ThemeProvider>
  )
}

function EditorShell({
  value,
  defaultValue = '',
  onChange,
  title = '',
  adapters = NO_ADAPTERS,
  extensions = NO_EXTENSIONS,
  coreExtensions = markdownCoreExtensions,
  toolbarLayout = MARKDOWN_TOOLBAR_LAYOUT,
  missingAdapter = 'hide',
  autoSaveInterval = 0,
  viewMode: viewModeProp,
  defaultViewMode = 'split',
  onViewModeChange,
  defaultPanel = null,
  showRail = true,
  defaultSplit = 0.5,
  readOnly = false,
  placeholder,
  ariaLabel,
  height = '100%',
  engine: engineFactory,
  slots,
  className,
  ref,
}: MarkdownEditorProps) {
  const messages = useMessages()
  const { resolved, ready } = useTheme()
  const { notify } = useToast()
  const [engine] = useState(() => (engineFactory ?? createDefaultEngine)())
  const [store] = useState(() => createEditorStore({ panel: defaultPanel }))
  const [viewMode, setViewMode] = useControllableState(viewModeProp, defaultViewMode, onViewModeChange)
  const [split, setSplit] = useState(() => clampSplit(defaultSplit))
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const live = useLatest({ adapters, messages, notify, title, readOnly, theme: resolved, viewMode })

  const allExtensions = useStableArray(useMemo(() => [...coreExtensions, ...extensions], [coreExtensions, extensions]))
  const embeds = useMemo(() => allExtensions.flatMap((ext) => ext.embeds ?? []), [allExtensions])
  const rendererOptions = useMemo<RendererOptions>(() => ({ embeds }), [embeds])

  const runtime = useEditorRuntime({
    engine,
    store,
    hostRef,
    previewScrollRef,
    previewRef,
    initialValue: defaultValue,
    value,
    readOnly,
    placeholder,
    ariaLabel: ariaLabel ?? messages.editor.ariaLabel,
    viewMode,
    theme: resolved,
    themeReady: ready,
    rendererOptions,
    onChange,
  })

  const [uploader] = useState(() =>
    createUploader({
      engine,
      store,
      getAdapters: () => live.current.adapters,
      getMessages: () => live.current.messages,
      notify: (message, type) => live.current.notify(message, type),
      isReadOnly: () => live.current.readOnly,
    }),
  )

  const [ctx] = useState(() =>
    createMarkdownContext({
      engine,
      store,
      getRenderer: () => runtime.getRenderer(),
      getAdapters: () => live.current.adapters,
      getTitle: () => live.current.title,
      getTheme: () => live.current.theme,
      getMessages: () => live.current.messages,
      isReadOnly: () => live.current.readOnly,
      notify: (message, type) => live.current.notify(message, type),
      uploadImages: (files) => uploader.upload(files),
      getLiveHtml: () => previewRef.current?.innerHTML || runtime.getRenderer().render(engine.getValue()).html,
      scrollToHeading: (id) =>
        scrollToHeading({
          id,
          viewMode: live.current.viewMode,
          engine,
          editorHost: hostRef.current,
          previewEl: previewRef.current,
          previewScroller: previewScrollRef.current,
        }),
    }),
  )

  const reportError = useCallback(
    (name: string, error: unknown) => {
      console.error(error)
      const m = live.current.messages
      live.current.notify(formatMessage(m.errors.extension, { name, message: errorMessage(error) }), 'error')
    },
    [live],
  )
  useExtensionSetup(allExtensions, ctx, reportError)

  const [saver] = useState(() =>
    createDraftSaver({
      store,
      getDocument: () => ctx.getDocument(),
      getAdapter: () => live.current.adapters.onSaveDraft,
      onError: (error) => {
        const m = live.current.messages
        live.current.notify(formatMessage(m.errors.save, { message: errorMessage(error) }), 'error')
      },
    }),
  )

  // 声明在 useEditorRuntime 之后：引擎已挂载，初始内容视为已保存
  useEffect(() => {
    saver.markSaved(engine.getValue())
  }, [saver, engine])

  useEffect(() => {
    if (!(autoSaveInterval > 0)) return
    const timer = setInterval(() => void saver.save(), autoSaveInterval)
    return () => clearInterval(timer)
  }, [saver, autoSaveInterval])

  const resolveOptions = useMemo(
    () => ({ editorType: 'markdown' as const, adapters, missingAdapter }),
    [adapters, missingAdapter],
  )
  const groups = useMemo(
    () => resolveToolbar(allExtensions, toolbarLayout, resolveOptions),
    [allExtensions, toolbarLayout, resolveOptions],
  )
  const panels = useMemo(() => resolvePanels(allExtensions, resolveOptions), [allExtensions, resolveOptions])
  const rightPanels = useMemo(() => panels.filter((p) => p.panel.position === 'right'), [panels])
  const bottomPanels = useMemo(() => panels.filter((p) => p.panel.position === 'bottom'), [panels])
  const shortcuts = useMemo(() => collectShortcuts(allExtensions, resolveOptions), [allExtensions, resolveOptions])
  const mac = useMemo(isMacPlatform, [])

  const formatsKey = useEditorState(store, (s) => s.formatsKey)
  const panel = useEditorState(store, (s) => s.panel)
  const fullscreen = useEditorState(store, (s) => s.fullscreen)

  useEffect(() => {
    const detach = uploader.attach(hostRef.current)
    const unmark = previewRef.current
      ? observeFailedPlaceholders(previewRef.current, () => live.current.messages.upload.failed)
      : () => {}
    const take = (files: FileList | null | undefined, e: Event) => {
      const images = imageFiles(files)
      if (images.length === 0 || !live.current.adapters.uploadImage) return
      e.preventDefault()
      void uploader.upload(images)
    }
    const offPaste = engine.on('paste', (e) => {
      // Office 复制会在文本之外附带整块截图：有文本时按文本粘贴
      if ((e.clipboardData?.getData('text/plain') ?? '').trim() !== '') return
      take(e.clipboardData?.files, e)
    })
    const offDrop = engine.on('drop', (e) => take(e.dataTransfer?.files, e))
    return () => {
      offPaste()
      offDrop()
      unmark()
      detach()
    }
  }, [engine, uploader, live])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => engine.focus(),
      getValue: () => engine.getValue(),
      setValue: (markdown) => {
        runtime.setValue(markdown)
        saver.markSaved(engine.getValue())
      },
      getHtml: () => runtime.getRenderer().render(engine.getValue()).html,
      getDocument: () => ctx.getDocument(),
      runCommand: (name, args) => ctx.commands.run(name, args),
      insert: (content) => ctx.insert(content),
      saveDraft: () => saver.save(true),
      getEngine: () => engine,
    }),
    [engine, runtime, ctx, saver],
  )

  // React 合成事件会穿过 portal 冒泡；只处理 DOM 上位于编辑器内部的按键
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as Node
    if (!rootRef.current?.contains(target)) return
    if (e.key === 'Escape' && store.get().fullscreen && !e.nativeEvent.isComposing) {
      store.set({ fullscreen: false })
      return
    }
    if (!hostRef.current?.contains(target)) return
    handleShortcut(e.nativeEvent, shortcuts, ctx, mac, reportError)
  }

  const style = { '--ex-mde-height': typeof height === 'number' ? `${height}px` : height } as CSSProperties
  const bodyStyle = { '--ex-mde-split': String(split) } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={cx('ex-mde', className)}
      data-view={viewMode}
      data-readonly={readOnly || undefined}
      data-fullscreen={fullscreen || undefined}
      style={style}
      onKeyDown={onKeyDown}
    >
      <div className="ex-mde-main">
        <div className="ex-mde-header">
          <ModeTabs value={viewMode} onChange={setViewMode} />
          {slots?.headerEnd && <div className="ex-mde-header__end">{slots.headerEnd}</div>}
        </div>
        <Toolbar
          className="ex-mde-toolbar"
          groups={groups}
          ctx={ctx}
          readOnly={readOnly}
          stateKey={`${formatsKey}|${panel ?? ''}|${fullscreen}`}
          onError={reportError}
        />
        <div ref={bodyRef} className="ex-mde-body" style={bodyStyle}>
          <div ref={hostRef} className="ex-mde-editor" hidden={viewMode === 'preview'} />
          {viewMode === 'split' && <Splitter value={split} onChange={setSplit} bodyRef={bodyRef} />}
          <div ref={previewScrollRef} className="ex-mde-preview-pane" hidden={viewMode === 'edit'}>
            <div ref={previewRef} className="ex-preview ex-mde-preview" aria-label={messages.editor.previewLabel} />
          </div>
        </div>
        <PanelHost position="bottom" panels={bottomPanels} ctx={ctx} store={store} onError={reportError} />
        <UploadFailures
          store={store}
          readOnly={readOnly}
          onRetry={(id) => void uploader.retry(id)}
          onRemove={uploader.remove}
          onEmptied={() => engine.focus()}
        />
        <StatusBar store={store} viewMode={viewMode} center={slots?.statusCenter} end={slots?.statusEnd} />
      </div>
      <PanelHost position="right" panels={rightPanels} ctx={ctx} store={store} onError={reportError} />
      {showRail && rightPanels.length > 0 && <SideRail panels={rightPanels} store={store} />}
    </div>
  )
}
```

（`{viewMode === 'split' && <Splitter />}` 在 `hostRef` 与预览之间占固定的子节点位置，切换模式不会重新挂载编辑区宿主。分隔条宽度变化后，3a 的同步滚动通过其 `ResizeObserver` 自行刷新。）

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @geekx/markdown exec vitest run; pnpm --filter @geekx/markdown typecheck; pnpm lint`
Expected: 全部 PASS（包括 3a 的 StrictMode、SSR、受控用例以及 Task 1–2 的用例）；类型检查与 lint 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/markdown/src/splitter.tsx
git add packages/markdown/src/splitter.test.tsx
git add packages/markdown/src/types.ts
git add packages/markdown/src/markdown-editor.tsx
git commit -m "feat(markdown): 比对模式可拖动分隔条" -m "Splitter 为 role=separator，支持指针拖动（setPointerCapture）与方向键/Home/End 以 2% 步长调整，比例限制在 20%–80%，经 --ex-mde-split 驱动编辑区宽度；新增 defaultSplit。" -m "分隔条只在比对模式渲染且占固定子节点位置，切换模式不重建编辑区宿主。"
```

---

### Task 4: CSDN 外壳样式——`--ex-color-mde-*` token + `styles.css` 全文替换

**Files:**
- Modify: `packages/theme/src/styles.css`、`packages/theme/src/styles.test.ts`
- Modify: `packages/markdown/src/styles.css`（全文替换）、`packages/markdown/src/styles.test.ts`

**Interfaces:**
- Produces：16 个颜色 token，`.ex-mde-*` 外壳样式（尺寸见 Global Constraints「参考几何」）。

Token 取值如下。亮色为参考截图实测，暗色为自定：

| token | 亮 | 暗 | 用途 |
|---|---|---|---|
| `--ex-color-mde-canvas` | `#f2f2f2` | `#111214` | 页面底色、全屏底色 |
| `--ex-color-mde-chrome-text` | `#1a1a1a` | `#e8e8ed` | 页签、工具栏、图标栏文字 |
| `--ex-color-mde-tab-bg` | `#f2f2f2` | `#2a2b30` | 未选中页签 |
| `--ex-color-mde-tab-active-bg` | `#1a1a1a` | `#e8e8ed` | 选中页签 |
| `--ex-color-mde-tab-active-text` | `#ffffff` | `#1a1a1a` | 选中页签文字 |
| `--ex-color-mde-divider` | `#f2f2f2` | `#2a2b30` | 工具栏下边框 |
| `--ex-color-mde-status-border` | `#e8e8ef` | `#2a2b30` | 状态栏上边框 |
| `--ex-color-mde-status-text` | `#666666` | `#9a9ba6` | 状态栏、图标栏未选中文字 |
| `--ex-color-mde-split-preview-bg` | `#f9f9f9` | `#1d1e22` | 比对模式预览背景 |
| `--ex-color-mde-scrollbar` | `#bbbbbb` | `#4a4b52` | 滚动条滑块 |
| `--ex-color-mde-panel-title-bg` | `#e5e6e7` | `#2e2f34` | 面板标题条、图标栏分隔线 |
| `--ex-color-mde-rail-active-bg` | `#e5f1ff` | `#1f2a3a` | 图标栏选中项 |
| `--ex-color-mde-toc-link` | `#333333` | `#c8c9d1` | 目录项 |
| `--ex-color-mde-body-text` | `#4d4d4d` | `#c8c9d1` | 编辑区正文 |
| `--ex-color-mde-body-marker` | `#999999` | `#6b6c76` | 编辑区 Markdown 标记 |
| `--ex-color-mde-disabled-text` | `#bbbbbb` | `#5a5b63` | 禁用工具栏项（历史版本） |

- [ ] **Step 1: 写失败测试**

`packages/theme/src/styles.test.ts` 末尾追加：

```ts
const MDE_TOKENS = [
  '--ex-color-mde-canvas',
  '--ex-color-mde-chrome-text',
  '--ex-color-mde-tab-bg',
  '--ex-color-mde-tab-active-bg',
  '--ex-color-mde-tab-active-text',
  '--ex-color-mde-divider',
  '--ex-color-mde-status-border',
  '--ex-color-mde-status-text',
  '--ex-color-mde-split-preview-bg',
  '--ex-color-mde-scrollbar',
  '--ex-color-mde-panel-title-bg',
  '--ex-color-mde-rail-active-bg',
  '--ex-color-mde-toc-link',
  '--ex-color-mde-body-text',
  '--ex-color-mde-body-marker',
  '--ex-color-mde-disabled-text',
]

describe('CSDN 外壳 token', () => {
  it.each(MDE_TOKENS)('%s 定义在主块（兜底块一致性由上方用例校验）', (name) => {
    expect(mainTokens.has(name)).toBe(true)
  })

  it('亮色值与参考截图实测一致', () => {
    expect(expected.get('--ex-color-mde-canvas')?.[0]).toBe('#f2f2f2')
    expect(expected.get('--ex-color-mde-tab-active-bg')?.[0]).toBe('#1a1a1a')
    expect(expected.get('--ex-color-mde-split-preview-bg')?.[0]).toBe('#f9f9f9')
    expect(expected.get('--ex-color-mde-rail-active-bg')?.[0]).toBe('#e5f1ff')
  })
})
```

`packages/markdown/src/styles.test.ts` 的 `describe('markdown styles.css', ...)` 内末尾追加：

```ts
  it('CSDN 外壳关键尺寸', () => {
    expect(css).toMatch(/\.ex-mde-main \{[^}]*border-radius: var\(--ex-radius-lg\);/)
    expect(css).toMatch(/\.ex-mde-header \{[^}]*padding: 12px 12px 0;/)
    expect(css).toMatch(/\.ex-mde-modes \{[^}]*gap: 14px;/)
    expect(css).toMatch(/\.ex-mde-mode \{[^}]*height: 32px;[^}]*font-weight: 600;/)
    expect(css).toMatch(/\.ex-mde-toolbar \{[^}]*height: 39px;[^}]*margin-top: 16px;[^}]*padding: 0 10px;/)
    expect(css).toMatch(/\.ex-mde-status \{[^}]*padding: 9px 24px 12px 25px;[^}]*font-size: 12px;[^}]*line-height: 21px;/)
    expect(css).toMatch(/\.ex-mde-panel \{[^}]*width: 390px;[^}]*padding: 10px 0;/)
    expect(css).toMatch(/\.ex-mde-rail \{[^}]*width: 56px;/)
    expect(css).toContain('calc(var(--ex-mde-split, 0.5) * 100%)')
    expect(css).toMatch(/\.ex-mde \.ex-editor-content \{[^}]*padding: 16px 20%;[^}]*font-size: 15px;/)
    expect(css).toMatch(/\.ex-mde\[data-view='split'\] \.ex-mde-preview \{[^}]*padding: 16px 40px;/)
    expect(css).toMatch(/::-webkit-scrollbar \{[^}]*width: 8px;/)
  })

  it('目录层级字号 18/16/13px', () => {
    expect(css).toMatch(/data-depth='0'\] \.ex-mde-toc__link \{[^}]*font-size: 18px;/)
    expect(css).toMatch(/data-depth='1'\] \.ex-mde-toc__link \{[^}]*font-size: 16px;/)
    expect(css).toMatch(/data-depth='2'\] \.ex-mde-toc__link \{[^}]*font-size: 13px;/)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @geekx/theme exec vitest run src/styles.test.ts; pnpm --filter @geekx/markdown exec vitest run src/styles.test.ts`
Expected: FAIL —— token 未定义；外壳尺寸断言不匹配。

- [ ] **Step 3: 实现**

`packages/theme/src/styles.css`，四处插入（每处都放在 `--ex-color-code-tag` 行之后，缩进与所在块一致）：

1. `.ex-root { ... }` 主块中 `--ex-color-code-tag: light-dark(#22863a, #7ee787);` 之后：

```css
  --ex-color-mde-canvas: light-dark(#f2f2f2, #111214);
  --ex-color-mde-chrome-text: light-dark(#1a1a1a, #e8e8ed);
  --ex-color-mde-tab-bg: light-dark(#f2f2f2, #2a2b30);
  --ex-color-mde-tab-active-bg: light-dark(#1a1a1a, #e8e8ed);
  --ex-color-mde-tab-active-text: light-dark(#ffffff, #1a1a1a);
  --ex-color-mde-divider: light-dark(#f2f2f2, #2a2b30);
  --ex-color-mde-status-border: light-dark(#e8e8ef, #2a2b30);
  --ex-color-mde-status-text: light-dark(#666666, #9a9ba6);
  --ex-color-mde-split-preview-bg: light-dark(#f9f9f9, #1d1e22);
  --ex-color-mde-scrollbar: light-dark(#bbbbbb, #4a4b52);
  --ex-color-mde-panel-title-bg: light-dark(#e5e6e7, #2e2f34);
  --ex-color-mde-rail-active-bg: light-dark(#e5f1ff, #1f2a3a);
  --ex-color-mde-toc-link: light-dark(#333333, #c8c9d1);
  --ex-color-mde-body-text: light-dark(#4d4d4d, #c8c9d1);
  --ex-color-mde-body-marker: light-dark(#999999, #6b6c76);
  --ex-color-mde-disabled-text: light-dark(#bbbbbb, #5a5b63);
```

2. 兜底块 `.ex-root,\n  .ex-root[data-ex-theme='light'] { ... }` 中 `--ex-color-code-tag: #22863a;` 之后：

```css
    --ex-color-mde-canvas: #f2f2f2;
    --ex-color-mde-chrome-text: #1a1a1a;
    --ex-color-mde-tab-bg: #f2f2f2;
    --ex-color-mde-tab-active-bg: #1a1a1a;
    --ex-color-mde-tab-active-text: #ffffff;
    --ex-color-mde-divider: #f2f2f2;
    --ex-color-mde-status-border: #e8e8ef;
    --ex-color-mde-status-text: #666666;
    --ex-color-mde-split-preview-bg: #f9f9f9;
    --ex-color-mde-scrollbar: #bbbbbb;
    --ex-color-mde-panel-title-bg: #e5e6e7;
    --ex-color-mde-rail-active-bg: #e5f1ff;
    --ex-color-mde-toc-link: #333333;
    --ex-color-mde-body-text: #4d4d4d;
    --ex-color-mde-body-marker: #999999;
    --ex-color-mde-disabled-text: #bbbbbb;
```

3. 兜底块 `.ex-root[data-ex-theme='dark'] { ... }` 中 `--ex-color-code-tag: #7ee787;` 之后：

```css
    --ex-color-mde-canvas: #111214;
    --ex-color-mde-chrome-text: #e8e8ed;
    --ex-color-mde-tab-bg: #2a2b30;
    --ex-color-mde-tab-active-bg: #e8e8ed;
    --ex-color-mde-tab-active-text: #1a1a1a;
    --ex-color-mde-divider: #2a2b30;
    --ex-color-mde-status-border: #2a2b30;
    --ex-color-mde-status-text: #9a9ba6;
    --ex-color-mde-split-preview-bg: #1d1e22;
    --ex-color-mde-scrollbar: #4a4b52;
    --ex-color-mde-panel-title-bg: #2e2f34;
    --ex-color-mde-rail-active-bg: #1f2a3a;
    --ex-color-mde-toc-link: #c8c9d1;
    --ex-color-mde-body-text: #c8c9d1;
    --ex-color-mde-body-marker: #6b6c76;
    --ex-color-mde-disabled-text: #5a5b63;
```

4. `@media (prefers-color-scheme: dark) { .ex-root[data-ex-theme='system'] { ... } }` 中 `--ex-color-code-tag: #7ee787;` 之后：与第 3 处相同的 16 行，缩进 6 个空格。

`packages/markdown/src/styles.css` 全文替换为：

```css
/* @geekx/markdown：CSDN Markdown 编辑器外壳（尺寸按 2558×1308 参考截图实测） */
.ex-mde-theme { display: contents; }

.ex-mde {
  display: flex;
  gap: 16px;
  box-sizing: border-box;
  height: var(--ex-mde-height, 100%);
  min-height: 0;
  color: var(--ex-color-mde-chrome-text);
}

.ex-mde-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
}

/* ---------- 顶部：模式页签 ---------- */
.ex-mde-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px 0;
}

.ex-mde-header__end { display: flex; align-items: center; gap: var(--ex-space-2); }

.ex-mde-modes {
  display: flex;
  gap: 14px;
}

.ex-mde-mode {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-mde-tab-bg);
  color: var(--ex-color-mde-chrome-text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ex-mde-mode.is-active { background: var(--ex-color-mde-tab-active-bg); color: var(--ex-color-mde-tab-active-text); }
.ex-mde-mode:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }

/* ---------- 工具栏 ---------- */
.ex-mde-toolbar {
  flex: none;
  box-sizing: border-box;
  height: 39px;
  margin-top: 16px;
  padding: 0 10px;
  border-bottom: 1px solid var(--ex-color-mde-divider);
}

.ex-mde-toolbar .ex-toolbar__item { color: var(--ex-color-mde-chrome-text); font-size: 13px; }
.ex-mde-toolbar .ex-toolbar__item:disabled { color: var(--ex-color-mde-disabled-text); }
.ex-mde-toolbar .ex-toolbar__item.is-active { color: var(--ex-color-primary); }

/* ---------- 编辑区 / 预览区 ---------- */
.ex-mde-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.ex-mde-editor,
.ex-mde-preview-pane {
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.ex-mde-editor[hidden],
.ex-mde-preview-pane[hidden] {
  display: none;
}

.ex-mde[data-view='split'] .ex-mde-editor { flex: 0 0 calc(var(--ex-mde-split, 0.5) * 100%); }
.ex-mde[data-view='split'] .ex-mde-preview-pane { background: var(--ex-color-mde-split-preview-bg); }

.ex-mde .ex-editor-content {
  padding: 16px 20%;
  font-family: var(--ex-font-family);
  font-size: 15px;
  line-height: 1.65;
  color: var(--ex-color-mde-body-text);
}

.ex-mde[data-view='split'] .ex-editor-content { padding: 16px 24px; }

.ex-mde .ex-md-heading { color: var(--ex-color-mde-body-text); }

.ex-mde .ex-md-marker,
.ex-mde .ex-md-list > .ex-md-marker,
.ex-mde .ex-md-task,
.ex-mde .ex-md-hr,
.ex-mde .ex-md-url {
  color: var(--ex-color-mde-body-marker);
}

.ex-mde-preview {
  box-sizing: border-box;
  padding: 16px 20%;
}

.ex-mde[data-view='split'] .ex-mde-preview { padding: 16px 40px; }

.ex-mde-editor::-webkit-scrollbar,
.ex-mde-preview-pane::-webkit-scrollbar,
.ex-mde-panel::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ex-mde-editor::-webkit-scrollbar-thumb,
.ex-mde-preview-pane::-webkit-scrollbar-thumb,
.ex-mde-panel::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: var(--ex-color-mde-scrollbar);
}

.ex-mde-editor::-webkit-scrollbar-track,
.ex-mde-preview-pane::-webkit-scrollbar-track,
.ex-mde-panel::-webkit-scrollbar-track {
  background: transparent;
}

@supports not selector(::-webkit-scrollbar) {
  .ex-mde-editor,
  .ex-mde-preview-pane,
  .ex-mde-panel {
    scrollbar-width: thin;
    scrollbar-color: var(--ex-color-mde-scrollbar) transparent;
  }
}

/* 分隔条不占布局宽度，命中区域覆盖在预览区左缘 */
.ex-mde-splitter {
  position: relative;
  z-index: 1;
  flex: none;
  width: 0;
  outline: none;
}

.ex-mde-splitter::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 6px;
  content: '';
  cursor: col-resize;
}

.ex-mde-splitter:focus-visible::before { background: var(--ex-color-primary); }

/* ---------- 上传失败条 ---------- */
.ex-mde-uploads {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--ex-space-1);
  margin: 0;
  padding: var(--ex-space-2) var(--ex-space-6);
  border-top: 1px solid var(--ex-color-mde-status-border);
  list-style: none;
  color: var(--ex-color-error);
  font-size: var(--ex-font-size-sm);
}

.ex-mde-uploads__item { display: flex; align-items: center; gap: var(--ex-space-2); }
.ex-mde-uploads__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ex-mde-uploads__action {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-primary);
  font: inherit;
  cursor: pointer;
}

/* ---------- 状态栏 ---------- */
.ex-mde-status {
  display: flex;
  flex: none;
  align-items: center;
  gap: 24px;
  padding: 9px 24px 12px 25px;
  border-top: 1px solid var(--ex-color-mde-status-border);
  color: var(--ex-color-mde-status-text);
  font-size: 12px;
  line-height: 21px;
}

.ex-mde-status__stats { flex: none; white-space: nowrap; word-spacing: 2px; }
.ex-mde-status__center { flex: 1; min-width: 0; }
.ex-mde-status__end { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.ex-mde-status__save:empty { display: none; }

/* ---------- 面板与图标栏 ---------- */
.ex-mde-panel {
  box-sizing: border-box;
  flex: none;
  width: 390px;
  min-height: 0;
  padding: 10px 0;
  overflow: auto;
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
}

.ex-mde-panel--bottom {
  width: auto;
  max-height: 40%;
  border-top: 1px solid var(--ex-color-mde-divider);
  border-radius: 0;
}

.ex-mde-panel__title {
  height: 30px;
  padding: 0 36px;
  overflow: hidden;
  background: var(--ex-color-mde-panel-title-bg);
  font-size: 13px;
  line-height: 30px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ex-mde-toc__list { margin: 0; padding: 8px 0; list-style: none; }

.ex-mde-toc__link {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: 0 20px;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--ex-color-mde-toc-link);
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.ex-mde-toc__link:hover { color: var(--ex-color-primary); }
.ex-mde-toc__link:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: -2px; }
.ex-mde-toc__item[data-depth='0'] .ex-mde-toc__link { font-size: 18px; line-height: 35px; }
.ex-mde-toc__item[data-depth='1'] .ex-mde-toc__link { padding-left: 28px; font-size: 16px; line-height: 35px; }
.ex-mde-toc__item[data-depth='2'] .ex-mde-toc__link { padding-left: 36px; font-size: 13px; line-height: 26px; }
.ex-mde-toc__empty { margin: 0; padding: 24px 20px; color: var(--ex-color-text-muted); font-size: 13px; text-align: center; }

.ex-mde-syntax__list { margin: 0; padding: 8px 20px; }
.ex-mde-syntax__item { padding: 8px 0; border-bottom: 1px solid var(--ex-color-mde-divider); }
.ex-mde-syntax__item dt { margin-bottom: 4px; color: var(--ex-color-mde-chrome-text); font-size: 13px; font-weight: 600; }
.ex-mde-syntax__item dd { margin: 0; }

.ex-mde-syntax__item pre {
  margin: 0;
  color: var(--ex-color-mde-body-text);
  font-family: var(--ex-font-family-mono);
  font-size: 12px;
  white-space: pre-wrap;
}

.ex-mde-rail {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: 56px;
  padding: 8px 4px;
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
}

.ex-mde-rail__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 48px;
  height: 50px;
  padding: 0;
  border: 0;
  border-radius: var(--ex-radius-lg);
  background: transparent;
  color: var(--ex-color-mde-chrome-text);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}

.ex-mde-rail__item.is-active { background: var(--ex-color-mde-rail-active-bg); }
.ex-mde-rail__item:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: -2px; }
.ex-mde-rail__icon { display: inline-flex; }
.ex-mde-rail__label { color: var(--ex-color-mde-status-text); }
.ex-mde-rail__item.is-active .ex-mde-rail__label { color: var(--ex-color-mde-chrome-text); }
.ex-mde-rail__divider { width: 32px; height: 1px; margin: 4px 0; background: var(--ex-color-mde-panel-title-bg); }

/* ---------- 全屏 ---------- */
.ex-mde[data-fullscreen] {
  position: fixed;
  inset: 0;
  z-index: var(--ex-z-modal);
  height: auto;
  padding: 16px;
  background: var(--ex-color-mde-canvas);
}

/* ---------- 内置对话框 ---------- */
.ex-mde-dialog { display: flex; flex-direction: column; gap: var(--ex-space-3); }
.ex-mde-dialog__row { display: flex; gap: var(--ex-space-3); }
.ex-mde-dialog__actions { display: flex; justify-content: flex-end; gap: var(--ex-space-3); margin-top: var(--ex-space-2); }
.ex-mde-field { display: flex; flex: 1; flex-direction: column; gap: var(--ex-space-1); }
.ex-mde-field__label { color: var(--ex-color-text-secondary); font-size: var(--ex-font-size-sm); }

.ex-mde-input {
  box-sizing: border-box;
  height: 32px;
  padding: 0 var(--ex-space-3);
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  font: inherit;
}

.ex-mde-input:focus { border-color: var(--ex-color-primary); outline: none; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @geekx/theme exec vitest run; pnpm --filter @geekx/markdown exec vitest run`
Expected: 全部 PASS。theme 的兜底块一致性用例会自动覆盖新 token（三个兜底块各 16 项，值与 `light-dark()` 一致）；markdown 样式用例中，「只引用已定义变量」「不写死颜色」「类名前缀」以及新增的尺寸断言均通过。

Run: `pnpm build; Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; pnpm --filter @geekx/playground exec playwright test e2e/showcase.spec.ts e2e/markdown-core.spec.ts --project chromium`
Expected: 既有截图 `showcase-*`、`markdown-core-*` 无差异（只新增了 token，没有改动已有选择器）。

- [ ] **Step 5: 提交**

```powershell
git add packages/theme/src/styles.css
git add packages/theme/src/styles.test.ts
git add packages/markdown/src/styles.css
git add packages/markdown/src/styles.test.ts
git commit -m "style(markdown): 按 CSDN 参考截图还原编辑器外壳" -m "theme 新增 16 个 --ex-color-mde-* token（亮色为参考截图实测，暗色自定），同步写入 light-dark() 主块与三个兜底块。" -m "markdown styles.css 全文替换：页签 32px/600、工具栏 39px（上距 16、左右 10）、状态栏 9/24/12/25 两行 21px、面板 390px、图标栏 56px、间距 16；Markdown 模式内容左右 20%，比对模式编辑区 16/24、预览 16/40 与 #f9f9f9 底色；编辑区比例字体 15px、灰色标记；8px 滚动条。"
```

---

### Task 5: playground `/markdown`

**Files:**
- Modify: `apps/playground/package.json`、`apps/playground/app/page.tsx`
- Create: `apps/playground/app/markdown/page.tsx`、`markdown-playground.tsx`、`markdown.css`、`csdn-sample.ts`、`mock-adapters.ts`、`csdn-demo-extensions.tsx`

**Interfaces:**
- Consumes：
  - `MarkdownEditor`、`MarkdownEditorHandle`、`ViewMode`（`@geekx/markdown`）；
  - `EditorExtension`、`EditorAdapters`、`Template`（`@geekx/toolbar`）；
  - `generateLargeDoc`、`SAMPLE`（`../markdown-core/sample`）。
- Produces：
  - 路由 `/markdown?fixture=sample|csdn&view=edit|split|preview&panel=<id>&autosave=<ms>`，默认依次为 `sample`、`split`、无面板、`30000`。
  - e2e 依赖的稳定钩子：
    - 按钮「加载 10k 行文档」；
    - 复选框「只读」；
    - `data-testid="change-count"`（「变更 N」）；
    - `data-testid="save-count"`（「保存 N」）；
    - 主题按钮「切换到暗黑模式/明亮模式」。
  - 演示扩展：
    - `csdn:template`：modal，需要 `getTemplates`，带红点；
    - `csdn:history`：始终禁用，带文字；
    - `csdn:ai` 面板（order 10）；
    - `csdn:marketing` 面板（order 40）。
  - 模拟 adapters：
    - `uploadImage`：读为 data URL；文件名含 `fail` 时 300ms 后拒绝；
    - `onSaveDraft`：200ms 后完成；
    - `getTemplates`。

- [ ] **Step 1: 依赖与首页链接**

`apps/playground/package.json` 的 `dependencies` 中，在 `"@geekx/markdown-core": "workspace:*",` 之前加入 `"@geekx/markdown": "workspace:*",`；在 `"@geekx/theme": "workspace:*",` 之后加入 `"@geekx/toolbar": "workspace:*",`。

Run: `pnpm install`
Expected: lockfile 更新，`apps/playground/node_modules/@geekx/{markdown,toolbar}` 链接到工作区。

`apps/playground/app/page.tsx` 中 `<li><Link href="/markdown-core">编辑引擎 /markdown-core</Link></li>` 之后加入：

```tsx
        <li><Link href="/markdown">Markdown 编辑器 /markdown</Link></li>
```

- [ ] **Step 2: 示例文档与模拟数据**

`apps/playground/app/markdown/csdn-sample.ts`：

```ts
/** CSDN Markdown 编辑器默认欢迎文档（目录结构与参考截图 12-36-59 一致；去掉外链图片以免网络请求） */
export const CSDN_TITLE = 'Markdown 编辑器使用说明'

export const CSDN_SAMPLE = [
  '@[TOC](这里写自定义目录标题)',
  '',
  '# 欢迎使用Markdown编辑器',
  '',
  '你好！ 这是你第一次使用 **Markdown编辑器** 所展示的欢迎页。如果你想学习如何使用Markdown编辑器, 可以仔细阅读这篇文章，了解一下Markdown的基本语法知识。',
  '',
  '## 新的改变',
  '',
  '我们对Markdown编辑器进行了一些功能拓展与语法支持，除了标准的Markdown编辑器功能，我们增加了如下几点新功能，帮助你用它写博客：',
  '',
  '1. **全新的界面设计** ，将会带来全新的写作体验；',
  '2. 在创作中心设置你喜爱的代码高亮样式，Markdown **将代码片显示选择的高亮样式** 进行展示；',
  '3. 增加了 **图片拖拽** 功能，你可以将本地的图片直接拖拽到编辑区域直接展示；',
  '4. 全新的 **KaTeX数学公式** 语法；',
  '5. 增加了支持**甘特图的mermaid语法[^1]** 功能；',
  '6. 增加了 **多屏幕编辑** Markdown文章功能；',
  '7. 增加了 **焦点写作模式、预览模式、简洁写作模式、左右区域同步滚轮设置** 等功能；',
  '8. 增加了 **检查列表** 功能。',
  '',
  '## 功能快捷键',
  '',
  '撤销：<kbd>Ctrl/Command</kbd> + <kbd>Z</kbd>',
  '重做：<kbd>Ctrl/Command</kbd> + <kbd>Y</kbd>',
  '加粗：<kbd>Ctrl/Command</kbd> + <kbd>B</kbd>',
  '斜体：<kbd>Ctrl/Command</kbd> + <kbd>I</kbd>',
  '标题：<kbd>Ctrl/Command</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd>',
  '无序列表：<kbd>Ctrl/Command</kbd> + <kbd>Shift</kbd> + <kbd>U</kbd>',
  '有序列表：<kbd>Ctrl/Command</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>',
  '检查列表：<kbd>Ctrl/Command</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>',
  '插入代码：<kbd>Ctrl/Command</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd>',
  '插入链接：<kbd>Ctrl/Command</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd>',
  '',
  '## 合理的创建标题，有助于目录的生成',
  '',
  '直接输入1次<kbd>#</kbd>，并按下<kbd>space</kbd>后，将生成1级标题。',
  '输入2次<kbd>#</kbd>，并按下<kbd>space</kbd>后，将生成2级标题。',
  '以此类推，我们支持6级标题。有助于使用`TOC`语法后生成一个完美的目录。',
  '',
  '## 如何改变文本的样式',
  '',
  '*强调文本* _强调文本_',
  '',
  '**加粗文本** __加粗文本__',
  '',
  '==标记文本==',
  '',
  '~~删除文本~~',
  '',
  '> 引用文本',
  '',
  'H~2~O is是液体。',
  '',
  '2^10^ 运算结果是 1024.',
  '',
  '## 插入链接与图片',
  '',
  '链接: [link](https://www.csdn.net/).',
  '',
  '图片示例在演示中省略，避免外链请求。',
  '',
  '## 如何插入一段漂亮的代码片',
  '',
  '去[博客设置](https://mp.csdn.net/console/configBlog)页面，选择一款你喜欢的代码片高亮样式，下面展示同样高亮的 `代码片`.',
  '```javascript',
  '// An highlighted block',
  "var foo = 'bar';",
  '```',
  '',
  '## 生成一个适合你的列表',
  '',
  '- 项目',
  '  - 项目',
  '    - 项目',
  '',
  '1. 项目1',
  '2. 项目2',
  '3. 项目3',
  '',
  '- [ ] 计划任务',
  '- [x] 完成任务',
  '',
  '## 创建一个表格',
  '',
  '一个简单的表格是这么创建的：',
  '',
  '项目     | Value',
  '-------- | -----',
  '电脑  | ¥1600',
  '手机  | ¥12',
  '导管  | ¥1',
  '',
  '### 设定内容居中、居左、居右',
  '',
  '使用`:---------:`居中，使用`:----------`居左，使用`----------:`居右。',
  '',
  '| 第一列       | 第二列         | 第三列        |',
  '|:-----------:| -------------:|:-------------|',
  '| 第一列文本居中 | 第二列文本居右  | 第三列文本居左 |',
  '',
  '### SmartyPants',
  '',
  'SmartyPants将ASCII标点字符转换为“智能”印刷标点HTML实体。',
  '',
  '## 创建一个自定义列表',
  '',
  'Markdown',
  ':  Text-to-HTML conversion tool',
  '',
  '## 如何创建一个注脚',
  '',
  '一个具有注脚的文本。[^2]',
  '',
  '## 注释也是必不可少的',
  '',
  'Markdown将文本转换为 HTML。',
  '',
  '## KaTeX数学公式',
  '',
  '您可以使用渲染LaTeX数学表达式 KaTeX:',
  '',
  'Gamma公式展示 $\\Gamma(n) = (n-1)!\\quad\\forall n\\in\\mathbb N$ 是通过欧拉积分',
  '',
  '$$',
  '\\Gamma(z) = \\int_0^\\infty t^{z-1}e^{-t}dt\\,.',
  '$$',
  '',
  '## 新的甘特图功能，丰富你的文章',
  '',
  '```mermaid',
  'gantt',
  '        dateFormat  YYYY-MM-DD',
  '        title Adding GANTT diagram functionality to mermaid',
  '        section 现有任务',
  '        已完成               :done,    des1, 2014-01-06,2014-01-08',
  '        进行中               :active,  des2, 2014-01-09, 3d',
  '        计划一               :         des3, after des2, 5d',
  '        计划二               :         des4, after des3, 5d',
  '```',
  '',
  '## UML图表',
  '',
  '```mermaid',
  'sequenceDiagram',
  '张三 ->> 李四: 你好！李四, 最近怎么样?',
  '李四-->>王五: 你最近怎么样，王五？',
  '李四--x 张三: 我很好，谢谢!',
  '```',
  '',
  '## 流程图',
  '',
  '```mermaid',
  'graph LR',
  'A[长方形] -- 链接 --> B((圆))',
  'A --> C(圆角长方形)',
  'B --> D{菱形}',
  'C --> D',
  '```',
  '',
  '## FLowchart流程图',
  '',
  '```flowchart',
  'st=>start: 开始',
  'e=>end: 结束',
  'op=>operation: 我的操作',
  'cond=>condition: 确认？',
  'st->op->cond',
  'cond(yes)->e',
  'cond(no)->op',
  '```',
  '',
  '## 导出与导入',
  '',
  '### 导出',
  '',
  '如果你想尝试使用此编辑器, 你可以在此篇文章任意编辑。当你完成了一篇文章的写作, 在上方工具栏找到 **文章导出** ，生成一个.md文件或者.html文件进行本地保存。',
  '',
  '### 导入',
  '',
  '如果你想加载一篇你写过的.md文件，在上方工具栏可以选择导入功能进行对应扩展名的文件导入，继续你的创作。',
  '',
  '[^1]: [mermaid语法说明](https://mermaidjs.github.io/)',
  '',
  '[^2]: 注脚的解释',
  '',
].join('\n')
```

`apps/playground/app/markdown/mock-adapters.ts`：

```ts
import type { EditorAdapters, EditorDocument, Template } from '@geekx/toolbar'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TEMPLATES: Template[] = [
  { id: 'weekly', name: '周报模板', markdown: '# 本周工作\n\n- \n\n# 下周计划\n\n- \n' },
  { id: 'tech', name: '技术文章模板', markdown: '@[TOC](目录)\n\n# 背景\n\n# 方案\n\n# 总结\n' },
]

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 演示用 adapters：文件名含 fail 的图片上传失败；保存草稿 200ms 后完成 */
export function createMockAdapters(onSaved: (doc: EditorDocument) => void): EditorAdapters {
  return {
    async uploadImage(file) {
      if (/fail/i.test(file.name)) {
        await delay(300)
        throw new Error('模拟上传失败')
      }
      return { url: await readAsDataUrl(file) }
    },
    async onSaveDraft(doc) {
      await delay(200)
      onSaved(doc)
    },
    async getTemplates() {
      await delay(100)
      return TEMPLATES
    },
  }
}
```

- [ ] **Step 3: 演示扩展**

`apps/playground/app/markdown/csdn-demo-extensions.tsx`：

```tsx
import { errorMessage, type EditorExtension, type ExtensionContext, type Template } from '@geekx/toolbar'
import { Button } from '@geekx/ui'
import { Bot, History, LayoutTemplate, Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'

function TemplatePicker({ ctx, close }: { ctx: ExtensionContext; close(): void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null)

  useEffect(() => {
    let alive = true
    ctx.adapters.getTemplates?.().then(
      (list) => {
        if (alive) setTemplates(list)
      },
      (error: unknown) => ctx.notify(errorMessage(error), 'error'),
    )
    return () => {
      alive = false
    }
  }, [ctx])

  if (!templates) return <p className="pg-mde-muted">加载中…</p>
  return (
    <ul className="pg-mde-templates">
      {templates.map((template) => (
        <li key={template.id}>
          <Button
            variant="text"
            onClick={() => {
              ctx.replaceDocument({ markdown: template.markdown, html: template.html })
              close()
            }}
          >
            {template.name}
          </Button>
        </li>
      ))}
    </ul>
  )
}

function AiPanel() {
  return (
    <div className="pg-mde-panel">
      <div className="ex-mde-panel__title">AI 助手</div>
      <p className="pg-mde-muted">AI 写作助手在阶段 7 接入 aiAssist adapter，此处为占位。</p>
    </div>
  )
}

export const csdnTemplateExtension: EditorExtension = {
  name: 'csdn:template',
  editors: ['markdown'],
  requires: ['getTemplates'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:template',
      title: '模板',
      icon: (
        <span className="pg-mde-badge-icon">
          <LayoutTemplate size={16} />
          <span className="pg-mde-dot" />
        </span>
      ),
      width: 420,
      render: (ctx, close) => <TemplatePicker ctx={ctx} close={close} />,
    },
  ],
}

export const csdnHistoryExtension: EditorExtension = {
  name: 'csdn:history',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:history',
      title: '历史版本',
      label: '历史版本',
      icon: <History size={16} />,
      disabled: () => true,
      run: () => {},
    },
  ],
}

export const csdnAiPanelExtension: EditorExtension = {
  name: 'csdn:ai',
  panels: [{ id: 'csdn:ai', title: 'AI', icon: <Bot size={20} />, position: 'right', order: 10, render: () => <AiPanel /> }],
}

export const csdnMarketingExtension: EditorExtension = {
  name: 'csdn:marketing',
  panels: [
    {
      id: 'csdn:marketing',
      title: '营销组件',
      icon: (
        <span className="pg-mde-badge-icon">
          <Megaphone size={20} />
          <span className="pg-mde-new">NEW</span>
        </span>
      ),
      position: 'right',
      order: 40,
      render: () => (
        <div className="pg-mde-panel">
          <div className="ex-mde-panel__title">营销组件</div>
          <p className="pg-mde-muted">营销组件演示面板。</p>
        </div>
      ),
    },
  ],
}

export const csdnDemoExtensions: readonly EditorExtension[] = [
  csdnTemplateExtension,
  csdnHistoryExtension,
  csdnAiPanelExtension,
  csdnMarketingExtension,
]
```

- [ ] **Step 4: 页面与样式**

`apps/playground/app/markdown/markdown-playground.tsx`：

```tsx
'use client'

import { MarkdownEditor, type MarkdownEditorHandle, type ViewMode } from '@geekx/markdown'
import { ThemeProvider } from '@geekx/theme'
import { Button, ThemeToggle } from '@geekx/ui'
import { ArrowLeftRight, ChevronDown, CircleAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from '../markdown-core/sample'
import { csdnDemoExtensions } from './csdn-demo-extensions'
import { CSDN_SAMPLE, CSDN_TITLE } from './csdn-sample'
import { createMockAdapters } from './mock-adapters'

export interface MarkdownPlaygroundProps {
  fixture: 'sample' | 'csdn'
  view: ViewMode
  panel: string | null
  autosave: number
}

function Playground({ fixture, view, panel, autosave }: MarkdownPlaygroundProps) {
  const ref = useRef<MarkdownEditorHandle>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [changes, setChanges] = useState(0)
  const [saves, setSaves] = useState(0)
  const adapters = useMemo(() => createMockAdapters(() => setSaves((n) => n + 1)), [])
  const title = fixture === 'csdn' ? CSDN_TITLE : 'EditorX 示例文档'

  return (
    <div className="pg-mde">
      <header className="pg-mde__topbar">
        <strong className="pg-mde__brand">EditorX</strong>
        <span className="pg-mde__title">{title}</span>
        <div className="pg-mde__controls">
          <label className="pg-mde__check">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            只读
          </label>
          <Button size="sm" onClick={() => ref.current?.setValue(generateLargeDoc(10000))}>
            加载 10k 行文档
          </Button>
          <span data-testid="change-count">变更 {changes}</span>
          <span data-testid="save-count">保存 {saves}</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="pg-mde__frame">
        <MarkdownEditor
          ref={ref}
          defaultValue={fixture === 'csdn' ? CSDN_SAMPLE : SAMPLE}
          title={title}
          defaultViewMode={view}
          defaultPanel={panel}
          readOnly={readOnly}
          adapters={adapters}
          extensions={csdnDemoExtensions}
          autoSaveInterval={autosave}
          onChange={() => setChanges((n) => n + 1)}
          slots={{
            headerEnd: (
              <button type="button" className="pg-mde-switch">
                <ArrowLeftRight size={14} aria-hidden="true" />
                使用富文本编辑器
              </button>
            ),
            statusCenter: (
              <span className="pg-mde-quota">
                <CircleAlert size={16} aria-hidden="true" />
                今日发文额度还有 <em>5</em> 篇，<a href="#quota">可去这里提升额度</a>
              </span>
            ),
            statusEnd: (
              <>
                <button type="button" className="pg-mde-draft" onClick={() => void ref.current?.saveDraft()}>
                  保存草稿
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                <Button variant="primary" className="pg-mde-publish" onClick={() => console.info(ref.current?.getDocument())}>
                  发布文章
                </Button>
              </>
            ),
          }}
        />
      </div>
    </div>
  )
}

export function MarkdownPlayground(props: MarkdownPlaygroundProps) {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <Playground {...props} />
    </ThemeProvider>
  )
}
```

`apps/playground/app/markdown/page.tsx`：

```tsx
import '@geekx/markdown-core/styles.css'
import '@geekx/toolbar/styles.css'
import '@geekx/markdown/styles.css'
import 'katex/dist/katex.min.css'
import './markdown.css'
import type { ViewMode } from '@geekx/markdown'
import { MarkdownPlayground } from './markdown-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const VIEWS: readonly ViewMode[] = ['edit', 'split', 'preview']
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function MarkdownPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const view = VIEWS.find((v) => v === first(params.view)) ?? 'split'
  const autosave = Number(first(params.autosave) ?? 30000)
  return (
    <MarkdownPlayground
      fixture={first(params.fixture) === 'csdn' ? 'csdn' : 'sample'}
      view={view}
      panel={first(params.panel) ?? null}
      autosave={Number.isFinite(autosave) && autosave > 0 ? autosave : 0}
    />
  )
}
```

`apps/playground/app/markdown/markdown.css`：

```css
/* /markdown 演示页：顶栏 61px + 外框 padding 16/16/14/14（与 CSDN 参考截图一致） */
.pg-mde {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--ex-color-mde-canvas);
}

.pg-mde__topbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  height: 61px;
  padding: 0 24px;
  border-bottom: 1px solid var(--ex-color-mde-divider);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
}

.pg-mde__brand { color: var(--ex-color-primary); font-size: 18px; }
.pg-mde__title { flex: 1; min-width: 0; overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.pg-mde__controls { display: flex; align-items: center; gap: 12px; color: var(--ex-color-text-secondary); font-size: 12px; }
.pg-mde__check { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }

.pg-mde__frame {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 16px 16px 14px 14px;
}

.pg-mde-switch,
.pg-mde-draft {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-mde-tab-bg);
  color: var(--ex-color-mde-chrome-text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.pg-mde-draft { height: 36px; padding: 0 16px; }
.pg-mde-publish { height: 36px; padding: 0 16px; }

.pg-mde-quota {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--ex-color-primary) 25%, transparent);
  border-radius: var(--ex-radius-md);
  background: color-mix(in srgb, var(--ex-color-primary) 6%, transparent);
  color: var(--ex-color-text-secondary);
  font-size: 14px;
}

.pg-mde-quota svg { color: var(--ex-color-primary); }
.pg-mde-quota em { color: var(--ex-color-primary); font-style: normal; }
.pg-mde-quota a { color: var(--ex-color-primary); text-decoration: none; }

.pg-mde-badge-icon { position: relative; display: inline-flex; }

.pg-mde-dot {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ex-color-error);
}

.pg-mde-new {
  position: absolute;
  top: -8px;
  right: -14px;
  padding: 0 3px;
  border-radius: var(--ex-radius-pill);
  background: var(--ex-color-error);
  color: var(--ex-color-surface);
  font-size: 8px;
  line-height: 12px;
}

.pg-mde-panel { display: flex; flex-direction: column; }
.pg-mde-muted { margin: 16px 20px; color: var(--ex-color-text-muted); font-size: 13px; }
.pg-mde-templates { margin: 0; padding: 0; list-style: none; }
```

- [ ] **Step 5: 构建与人工冒烟**

Run: `pnpm build; pnpm --filter @geekx/playground typecheck; pnpm lint`
Expected: 构建成功（`/markdown` 为动态路由）；类型检查与 lint 无错误。

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground start
```

在浏览器打开 `http://localhost:3100/markdown?fixture=csdn&view=edit&panel=csdn:ai`，确认以下各项（之后 Ctrl+C 停止服务）：
- 页签、工具栏、状态栏、AI 面板和图标栏都已渲染；
- 「模板」图标带红点，「历史版本」为禁用状态；
- 浏览器控制台无错误。

- [ ] **Step 6: 提交**

```powershell
git add apps/playground/package.json
git add pnpm-lock.yaml
git add apps/playground/app/page.tsx
git add apps/playground/app/markdown/page.tsx
git add apps/playground/app/markdown/markdown-playground.tsx
git add apps/playground/app/markdown/markdown.css
git add apps/playground/app/markdown/csdn-sample.ts
git add apps/playground/app/markdown/mock-adapters.ts
git add apps/playground/app/markdown/csdn-demo-extensions.tsx
git commit -m "feat(playground): /markdown 演示页还原 CSDN 编辑器外壳" -m "页面通过 fixture/view/panel/autosave 查询参数控制初始状态，提供只读开关、10k 行文档、onChange/保存计数与主题切换，供 e2e 与视觉基线使用。" -m "演示扩展 csdn:template（需 getTemplates、红点）、csdn:history（禁用）及 AI/营销组件面板；模拟 adapters 支持图片上传成功/失败、保存草稿与模板。"
```

---

### Task 6: e2e——延迟探针抽取 + `markdown.spec.ts`（功能 + `@perf`）

**Files:**
- Create: `apps/playground/e2e/support/latency.ts`、`apps/playground/e2e/markdown.spec.ts`
- Modify: `apps/playground/e2e/markdown-core.spec.ts`

**Interfaces:**
- Produces（`e2e/support/latency.ts`）：
  ```ts
  type LatencyWindow = Window & { __exLatency: number[] }
  function installKeyLatencyProbe(page: Page, selector?: string): Promise<void>
  function typeAndMeasure(page: Page, keys: string, delay: number): Promise<LatencyStats>
  function pressAndMeasure(page: Page, keys: string[], gap: number): Promise<LatencyStats>
  function latencyStats(page: Page): Promise<LatencyStats>
  ```

- [ ] **Step 1: 抽取延迟探针（行为不变）**

`apps/playground/e2e/support/latency.ts`：

```ts
import { expect, type Page } from '@playwright/test'

export type LatencyWindow = Window & { __exLatency: number[] }

export interface LatencyStats {
  median: number
  p95: number
  max: number
  samples: number[]
}

/** 从事件创建时刻（e.timeStamp，与 performance.now 同一时钟）到下一帧之后的任务 */
export async function installKeyLatencyProbe(page: Page, selector = '.ex-editor-content') {
  await page.evaluate((sel) => {
    const w = window as unknown as LatencyWindow
    w.__exLatency = []
    document.querySelector(sel)!.addEventListener(
      'keydown',
      (e) => {
        const t0 = e.timeStamp
        requestAnimationFrame(() => {
          setTimeout(() => w.__exLatency.push(performance.now() - t0), 0)
        })
      },
      { capture: true },
    )
  }, selector)
}

export async function typeAndMeasure(page: Page, keys: string, delay: number): Promise<LatencyStats> {
  await page.evaluate(() => {
    ;(window as unknown as LatencyWindow).__exLatency = []
  })
  await page.keyboard.type(keys, { delay })
  await expect.poll(() => page.evaluate(() => (window as unknown as LatencyWindow).__exLatency.length)).toBe(keys.length)
  return latencyStats(page)
}

export async function pressAndMeasure(page: Page, keys: string[], gap: number): Promise<LatencyStats> {
  await page.evaluate(() => {
    ;(window as unknown as LatencyWindow).__exLatency = []
  })
  for (const key of keys) {
    await page.keyboard.press(key)
    await page.waitForTimeout(gap)
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as LatencyWindow).__exLatency.length)).toBe(keys.length)
  return latencyStats(page)
}

export async function latencyStats(page: Page): Promise<LatencyStats> {
  const samples = await page.evaluate(() => (window as unknown as LatencyWindow).__exLatency)
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    median: sorted[Math.floor(sorted.length / 2)]!,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    max: sorted.at(-1)!,
    samples: samples.map((s) => Math.round(s)),
  }
}
```

`apps/playground/e2e/markdown-core.spec.ts` 修改：
1. 第 2 行之后加入 `import { installKeyLatencyProbe, pressAndMeasure, typeAndMeasure } from './support/latency'`。
2. 删除 `type LatencyWindow = ...` 到 `async function latencyStats(...) { ... }` 的整段（原第 286–319 行，含两行注释）。
3. 在 `10k 行文档单次按键延迟` 用例中，把 `await page.evaluate(() => { const w = window as unknown as LatencyWindow ... { capture: true }, ) })`（原第 329–341 行）整段替换为 `await installKeyLatencyProbe(page)`。

Run: `pnpm --filter @geekx/playground typecheck`
Expected: 无错误（`markdown-core.spec.ts` 中不再引用 `LatencyWindow`）。

- [ ] **Step 2: 写 `markdown.spec.ts`**

`apps/playground/e2e/markdown.spec.ts`：

```ts
import { expect, test, type Page } from '@playwright/test'
import { SAMPLE } from '../app/markdown-core/sample'
import { installKeyLatencyProbe, pressAndMeasure, typeAndMeasure } from './support/latency'

const content = (page: Page) => page.locator('.ex-editor-content')
const editorScroller = (page: Page) => page.locator('.ex-mde-editor')
const previewPane = (page: Page) => page.locator('.ex-mde-preview-pane')
const preview = (page: Page) => page.locator('.ex-mde-preview')
const previewSections = (page: Page) => preview(page).locator(':scope > .ex-preview-section')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: '编辑工具栏' })
const rail = (page: Page) => page.getByRole('navigation', { name: '侧边栏' })
const statusMd = (page: Page) => page.locator('.ex-mde-status__md')
const statusHtml = (page: Page) => page.locator('.ex-mde-status__html')
const editorValue = (page: Page) => content(page).evaluate((el) => el.textContent ?? '')

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function open(page: Page, query = '') {
  await page.goto(`/markdown${query}`)
  await expect(content(page)).toBeAttached()
  await expect(previewSections(page).first()).toBeAttached()
  await expect(statusHtml(page)).not.toHaveText('HTML 0 字数 0 段落', { timeout: 5000 })
}

async function appendLine(page: Page, text: string) {
  await content(page).click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(text)
}

async function loadLargeDoc(page: Page) {
  await page.getByRole('button', { name: '加载 10k 行文档' }).click()
  await expect(statusMd(page)).toContainText('10000 行数', { timeout: 15_000 })
}

async function pasteImage(page: Page, name: string) {
  await content(page).evaluate(
    (el, { fileName, b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], fileName, { type: 'image/png' }))
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    },
    { fileName: name, b64: PNG_BASE64 },
  )
}

function topSections(page: Page) {
  return page.evaluate(() => {
    const first = (container: Element, selector: string) => {
      const top = container.getBoundingClientRect().top
      for (const el of container.querySelectorAll<HTMLElement>(selector)) {
        if (el.getBoundingClientRect().bottom > top + 1) return Number(el.dataset.sectionIndex)
      }
      return -1
    }
    return {
      editor: first(document.querySelector('.ex-mde-editor')!, '.ex-editor-section'),
      preview: first(document.querySelector('.ex-mde-preview-pane')!, '.ex-preview-section'),
    }
  })
}

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test('工具栏「加粗」与 Ctrl+B，撤销恢复', async ({ page }) => {
  await open(page, '?view=edit')
  await appendLine(page, '甲乙')
  await page.keyboard.press('Shift+Home')
  await toolbar(page).getByRole('button', { name: '加粗' }).click()
  await expect.poll(() => editorValue(page)).toContain('**甲乙**')
  await page.keyboard.press('Control+z')
  await expect.poll(() => editorValue(page)).not.toContain('**甲乙**')
  await page.keyboard.press('Enter')
  await page.keyboard.type('丙丁')
  await page.keyboard.press('Shift+Home')
  await page.keyboard.press('Control+b')
  await expect.poll(() => editorValue(page)).toContain('**丙丁**')
  await expect(toolbar(page).getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true')
})

test('视图模式：Markdown / 比对 / 预览', async ({ page }) => {
  await open(page, '?view=split')
  await expect(page.getByRole('separator', { name: '调整编辑区与预览区宽度' })).toBeVisible()
  await page.getByRole('tab', { name: 'Markdown' }).click()
  await expect(page.getByRole('tab', { name: 'Markdown' })).toHaveAttribute('aria-selected', 'true')
  await expect(editorScroller(page)).toBeVisible()
  await expect(previewPane(page)).toBeHidden()
  await page.getByRole('tab', { name: '预览' }).click()
  await expect(editorScroller(page)).toBeHidden()
  await expect(previewPane(page)).toBeVisible()
  await expect(statusMd(page)).toHaveCount(0)
  await page.getByRole('tab', { name: '比对' }).click()
  await expect(editorScroller(page)).toBeVisible()
  await expect(previewPane(page)).toBeVisible()
})

test('状态栏：格式与 CSDN 一致，随输入与光标更新', async ({ page }) => {
  await open(page, '?view=split')
  await expect(statusMd(page)).toHaveText(/^Markdown \d+ 字数 \d+ 行数 当前行 \d+, 当前列 \d+$/)
  await expect(statusMd(page)).toContainText(`${SAMPLE.split('\n').length} 行数`)
  await expect(statusHtml(page)).toHaveText(/^HTML \d+ 字数 \d+ 段落$/)
  await appendLine(page, '新增')
  await expect(statusMd(page)).toContainText(`当前行 ${SAMPLE.split('\n').length + 1}, 当前列 2`)
})

test('目录面板：自定义标题、层级字号、点击跳转预览', async ({ page }) => {
  await open(page, '?fixture=csdn&view=preview')
  await rail(page).getByRole('button', { name: '目录' }).click()
  const panel = page.getByRole('complementary', { name: '目录' })
  await expect(panel.locator('.ex-mde-panel__title')).toHaveText('这里写自定义目录标题')
  await expect(panel.getByRole('button', { name: '欢迎使用Markdown编辑器' })).toHaveCSS('font-size', '18px')
  await expect(panel.getByRole('button', { name: '新的改变' })).toHaveCSS('font-size', '16px')
  await expect(panel.getByRole('button', { name: 'SmartyPants' })).toHaveCSS('font-size', '13px')
  const target = preview(page).getByRole('heading', { name: '导入', exact: true })
  await expect(target).not.toBeInViewport()
  await panel.getByRole('button', { name: '导入', exact: true }).click()
  await expect(target).toBeInViewport()
})

test('目录面板：Markdown 模式跳转编辑区', async ({ page }) => {
  await open(page, '?fixture=csdn&view=edit&panel=toc')
  const panel = page.getByRole('complementary', { name: '目录' })
  const line = content(page).locator('.ex-md-heading', { hasText: '导入' }).last()
  await expect(line).not.toBeInViewport()
  await panel.getByRole('button', { name: '导入', exact: true }).click()
  await expect(line).toBeInViewport()
})

test('语法面板：「更多操作 → 语法说明」与图标栏同步', async ({ page }) => {
  await open(page, '?view=split')
  await toolbar(page).getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('menuitemcheckbox', { name: '语法说明' }).click()
  await expect(page.getByRole('complementary', { name: '语法' })).toContainText('@[TOC](目录标题)')
  await expect(rail(page).getByRole('button', { name: '语法' })).toHaveAttribute('aria-pressed', 'true')
  await rail(page).getByRole('button', { name: '收起' }).click()
  await expect(page.getByRole('complementary')).toHaveCount(0)
})

test('窄屏：放不下的分组折叠进「更多」', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 })
  await open(page, '?view=edit')
  await expect(toolbar(page).getByRole('button', { name: '加粗' })).toBeVisible()
  const more = toolbar(page).getByRole('button', { name: '更多', exact: true })
  await expect(more).toBeVisible()
  await more.click()
  await expect(page.getByRole('menuitem', { name: '导入文件' })).toBeVisible()
})

test('分隔条：拖动调整宽度，键盘 End 到 80%', async ({ page }) => {
  await open(page, '?view=split')
  const sep = page.getByRole('separator', { name: '调整编辑区与预览区宽度' })
  const body = (await page.locator('.ex-mde-body').boundingBox())!
  const handle = (await sep.boundingBox())!
  const y = body.y + body.height / 2
  await page.mouse.move(handle.x + 2, y)
  await page.mouse.down()
  await page.mouse.move(body.x + body.width * 0.3, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => Number(await sep.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(29)
  expect(Number(await sep.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(31)
  const editorWidth = (await editorScroller(page).boundingBox())!.width
  expect(Math.abs(editorWidth - body.width * 0.3)).toBeLessThan(body.width * 0.012)
  await sep.focus()
  await page.keyboard.press('End')
  await expect(sep).toHaveAttribute('aria-valuenow', '80')
})

test('粘贴图片：上传成功替换为图片地址', async ({ page }) => {
  await open(page, '?view=edit')
  await appendLine(page, '')
  await pasteImage(page, 'shot.png')
  await expect.poll(() => editorValue(page)).toContain('![shot](data:image/png;base64,')
  expect(await editorValue(page)).not.toContain('ex-uploading://')
})

test('粘贴图片：上传失败提示，失败条可删除占位', async ({ page }) => {
  await open(page, '?view=edit')
  await appendLine(page, '')
  await pasteImage(page, 'fail.png')
  await expect(page.getByRole('alert').filter({ hasText: '图片 fail.png 上传失败：模拟上传失败' })).toBeVisible()
  const strip = page.getByRole('list', { name: '上传失败的图片' })
  await expect(strip).toContainText('fail.png 上传失败')
  await expect.poll(() => editorValue(page)).toContain('ex-upload-failed://')
  await strip.getByRole('button', { name: '删除 fail.png' }).click()
  await expect.poll(() => editorValue(page)).not.toContain('ex-upload-failed://')
  await expect(strip).toHaveCount(0)
})

test('自动保存：编辑后按间隔保存，状态栏显示保存时间', async ({ page }) => {
  await open(page, '?view=edit&autosave=500')
  await page.waitForTimeout(700)
  await expect(page.getByTestId('save-count')).toHaveText('保存 0')
  await appendLine(page, '自动保存')
  await expect(page.locator('.ex-mde-status__save')).toHaveText(/^文章已保存\d{2}:\d{2}:\d{2}$/)
  await expect(page.getByTestId('save-count')).toHaveText('保存 1')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByTestId('save-count')).toHaveText('保存 2')
})

test('只读：编辑区只读，格式按钮禁用，导出仍可用', async ({ page }) => {
  await open(page, '?view=edit')
  await page.getByLabel('只读').check()
  await expect(content(page)).toHaveAttribute('aria-readonly', 'true')
  await expect(toolbar(page).getByRole('button', { name: '加粗' })).toBeDisabled()
  await expect(toolbar(page).getByRole('button', { name: '更多操作' })).toBeEnabled()
  const before = await editorValue(page)
  await content(page).click()
  await page.keyboard.type('x')
  expect(await editorValue(page)).toBe(before)
})

test('主题切换：外壳与浮层跟随暗色', async ({ page }) => {
  await open(page, '?view=split')
  await page.getByRole('button', { name: '切换到暗黑模式' }).click()
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect(page.locator('.ex-mde-main')).toHaveCSS('background-color', 'rgb(35, 36, 40)')
  await expect(page.locator('.pg-mde')).toHaveCSS('background-color', 'rgb(17, 18, 20)')
})

test('同步滚动：10k 行文档编辑区 → 预览', async ({ page }) => {
  await open(page, '?view=split')
  await loadLargeDoc(page)
  await editorScroller(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.4
  })
  await expect.poll(() => previewPane(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect
    .poll(async () => {
      const s = await topSections(page)
      return Math.abs(s.editor - s.preview)
    })
    .toBeLessThanOrEqual(1)
})

test('10k 行文档：Ctrl+End 后仍可输入，状态栏行号正确', async ({ page }) => {
  await open(page, '?view=split')
  await loadLargeDoc(page)
  await content(page).click({ position: { x: 60, y: 30 } })
  await page.keyboard.press('Control+End')
  await page.keyboard.type('Z')
  await expect.poll(() => editorValue(page)).toMatch(/Z\n$/)
  await expect(statusMd(page)).toContainText('当前行 10000,')
})

test.describe('性能（MarkdownEditor）', () => {
  test.describe.configure({ mode: 'serial' })

  test('10k 行文档单次按键延迟 < 50ms（连续输入、停顿输入与回车/退格）', { tag: '@perf' }, async ({ page }) => {
    test.setTimeout(90_000)
    await open(page, '?view=split')
    await loadLargeDoc(page)
    await content(page).click({ position: { x: 60, y: 30 } })
    await page.keyboard.press('End')
    await installKeyLatencyProbe(page)

    const burstKeys = 'abcdefghijklmnopqrstuvwxyz0123'
    const burst = await typeAndMeasure(page, burstKeys, 80)
    const pausedKeys = '456789abcdefghijklmnopqrstuvwx'
    const paused = await typeAndMeasure(page, pausedKeys, 260)
    const before = await editorValue(page)
    const lines = await pressAndMeasure(page, [...Array<string>(10).fill('Enter'), ...Array<string>(10).fill('Backspace')], 260)
    test.info().annotations.push({ type: 'latency-ms', description: JSON.stringify({ burst, paused, lines }) })

    expect(before).toContain(burstKeys + pausedKeys)
    await expect.poll(() => editorValue(page)).toBe(before)
    expect(burst.median).toBeLessThan(50)
    expect(burst.p95).toBeLessThan(50)
    expect(paused.median).toBeLessThan(50)
    expect(paused.p95).toBeLessThan(50)
    expect(lines.median).toBeLessThan(50)
    expect(lines.p95).toBeLessThan(50)
  })

  test('10k 行文档顶部插入标题：预览更新无 > 50ms 的长任务', { tag: '@perf' }, async ({ page }) => {
    await open(page, '?view=split')
    await loadLargeDoc(page)
    const sections = await previewSections(page).count()
    await content(page).click({ position: { x: 60, y: 30 } })
    await page.keyboard.press('End')
    await page.evaluate(() => {
      const w = window as unknown as { __exLongTasks: number[] }
      w.__exLongTasks = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__exLongTasks.push(entry.duration)
      }).observe({ type: 'longtask' })
    })
    await page.keyboard.press('Enter')
    await page.keyboard.type('# H')
    await expect(previewSections(page)).toHaveCount(sections + 1)
    await expect(preview(page).locator('h1', { hasText: /^H$/ })).toHaveCount(1)
    await page.waitForTimeout(500)
    const longTasks = await page.evaluate(() => (window as unknown as { __exLongTasks: number[] }).__exLongTasks)
    test.info().annotations.push({ type: 'long-tasks-ms', description: JSON.stringify(longTasks) })
    expect(longTasks).toEqual([])
  })
})
```

- [ ] **Step 3: 运行 e2e**

```powershell
pnpm build
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test e2e/markdown.spec.ts e2e/markdown-core.spec.ts --project chromium
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test --project chromium-perf --no-deps
```

Expected：
- `chromium`：`markdown.spec.ts` 的 15 个功能用例与 `markdown-core.spec.ts` 的全部用例通过（后者的截图无差异）。
- `chromium-perf`：共 4 个 `@perf` 用例通过（`/markdown-core` 两个 + `/markdown` 两个），annotation 中 `/markdown` 的 median/p95 与 `/markdown-core` 处于同一量级（约 15–25ms）。

若 `/markdown` 延迟超标，先查 React Profiler 中按键是否引发了 `EditorShell` 重渲染。正常情况下按键只应更新 `StatusBar` 与 `Toolbar`（stateKey 变化时），**不得放宽门槛**。

- [ ] **Step 4: 提交**

```powershell
git add apps/playground/e2e/support/latency.ts
git add apps/playground/e2e/markdown-core.spec.ts
git add apps/playground/e2e/markdown.spec.ts
git commit -m "test(playground): MarkdownEditor 端到端与性能门槛" -m "把按键延迟探针抽到 e2e/support/latency.ts，markdown-core.spec.ts 改为导入（测量方式不变）。" -m "markdown.spec.ts 覆盖格式按钮与快捷键、视图模式、状态栏、目录/语法面板、溢出菜单、分隔条、图片粘贴上传成功/失败、自动保存、只读、主题、同步滚动与 10k 行文档；@perf 门槛经 MarkdownEditor 测量（<50ms、无长任务）。"
```

---

### Task 7: 视觉基线 + 参考截图几何对照

**Files:**
- Create: `apps/playground/e2e/markdown-visual.spec.ts`、`apps/playground/e2e/markdown-parity.spec.ts`
- Create（生成）：`apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-{edit,split,preview}-{light,dark}-chromium-win32.png`、`markdown-menu-list-light-chromium-win32.png`、`markdown-dialog-link-light-chromium-win32.png`

**Interfaces:**
- Consumes：Task 5 的查询参数、Task 4 的尺寸、Global Constraints「参考几何」。

- [ ] **Step 1: 写视觉基线用例**

`apps/playground/e2e/markdown-visual.spec.ts`：

```ts
import { expect, test, type Page } from '@playwright/test'

type Scheme = 'light' | 'dark'
type View = 'edit' | 'split' | 'preview'

const preview = (page: Page) => page.locator('.ex-mde-preview')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: '编辑工具栏' })

async function ready(page: Page, view: View, scheme: Scheme) {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto(`/markdown?view=${view}`)
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', scheme)
  await expect(preview(page).locator('.ex-preview-section').first()).toBeAttached()
  if (view !== 'edit') {
    await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
    await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
  }
  await expect(page.locator('.ex-mde-status__html')).not.toHaveText('HTML 0 字数 0 段落', { timeout: 5000 })
  await page.evaluate(() => document.fonts.ready)
}

for (const scheme of ['light', 'dark'] as const) {
  for (const view of ['edit', 'split', 'preview'] as const) {
    test(`视觉基线：${view} / ${scheme}`, async ({ page }) => {
      await ready(page, view, scheme)
      await expect(page).toHaveScreenshot(`markdown-${view}-${scheme}.png`)
    })
  }
}

test('视觉基线：「列表」下拉菜单', async ({ page }) => {
  await ready(page, 'split', 'light')
  await toolbar(page).getByRole('button', { name: '列表' }).click()
  await expect(page.getByRole('menu', { name: '列表' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('markdown-menu-list-light.png')
})

test('视觉基线：链接对话框', async ({ page }) => {
  await ready(page, 'split', 'light')
  await toolbar(page).getByRole('button', { name: '链接' }).click()
  await expect(page.getByRole('dialog', { name: '链接' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot('markdown-dialog-link-light.png')
})
```

- [ ] **Step 2: 写参考几何对照用例**

`apps/playground/e2e/markdown-parity.spec.ts`：

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'

// 数值实测自 apps/playground/public/reference/screenshot_2026-10-09_12-35-10.png（2558×1308，Markdown 模式 + AI 面板）
test.use({ viewport: { width: 2558, height: 1308 } })

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  expect(b, '元素不可见').not.toBeNull()
  return b!
}

function near(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: 实际 ${actual}，期望 ${expected}±${tolerance}`).toBeLessThanOrEqual(tolerance)
}

async function open(page: Page, view: 'edit' | 'split') {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto(`/markdown?fixture=csdn&view=${view}&panel=csdn:ai`)
  await expect(page.getByRole('complementary', { name: 'AI' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('外框、页签、工具栏、状态栏、面板与图标栏位置', async ({ page }) => {
  await open(page, 'edit')

  const main = await box(page.locator('.ex-mde-main'))
  near(main.x, 14, 1, 'main.x')
  near(main.y, 77, 1, 'main.y')
  near(main.width, 2050, 2, 'main.width')
  near(main.height, 1217, 2, 'main.height')

  const tabs = page.getByRole('tab')
  const expectedX = [26, 158, 244]
  for (let i = 0; i < 3; i++) {
    const t = await box(tabs.nth(i))
    near(t.x, expectedX[i]!, 3, `tab${i}.x`)
    near(t.y, 89, 1, `tab${i}.y`)
    near(t.height, 32, 1, `tab${i}.height`)
  }
  near((await box(tabs.nth(0))).width, 119, 4, 'Markdown 页签宽')

  const headerEnd = await box(page.locator('.ex-mde-header__end'))
  near(headerEnd.x + headerEnd.width, 2051, 3, 'headerEnd 右缘')

  const bar = await box(page.locator('.ex-mde-toolbar'))
  near(bar.y + bar.height, 177, 1, '工具栏底边')
  const bold = await box(page.getByRole('toolbar', { name: '编辑工具栏' }).getByRole('button', { name: '加粗' }))
  near(bold.x + bold.width / 2, 38, 2, '加粗 中心 x')
  near(bold.y + bold.height / 2, 156.5, 2, '加粗 中心 y')

  const status = await box(page.locator('.ex-mde-status'))
  near(status.y, 1230, 1, '状态栏顶')
  const md = await box(page.locator('.ex-mde-status__md'))
  const html = await box(page.locator('.ex-mde-status__html'))
  near(md.y + md.height / 2, 1250.5, 1.5, '状态栏第一行中心')
  near(html.y + html.height / 2, 1271.5, 1.5, '状态栏第二行中心')
  near(md.x, 40, 3, '状态栏文字 x')

  const panel = await box(page.locator('.ex-mde-panel'))
  near(panel.x, 2080, 2, 'panel.x')
  near(panel.width, 390, 1, 'panel.width')
  const rail = await box(page.getByRole('navigation', { name: '侧边栏' }))
  near(rail.x, 2486, 2, 'rail.x')
  near(rail.width, 56, 1, 'rail.width')

  const paddingLeft = await page.locator('.ex-editor-content').evaluate((el) => getComputedStyle(el).paddingLeft)
  near(Number.parseFloat(paddingLeft), 410, 1, 'Markdown 模式内容左 padding')
})

test('比对模式：编辑区宽度与预览底色', async ({ page }) => {
  await open(page, 'split')
  const editor = await box(page.locator('.ex-mde-editor'))
  near(editor.width, 1025, 16, '比对模式编辑区宽')
  await expect(page.locator('.ex-mde-preview-pane')).toHaveCSS('background-color', 'rgb(249, 249, 249)')
  await expect(page.locator('.ex-mde-preview')).toHaveCSS('padding-left', '40px')
})
```

- [ ] **Step 3: 生成视觉基线（仅本文件），再复跑确认稳定**

```powershell
pnpm build
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test e2e/markdown-visual.spec.ts --project chromium --update-snapshots
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test e2e/markdown-visual.spec.ts e2e/markdown-parity.spec.ts --project chromium --repeat-each 2
```

Expected：
- 第一条命令只在 `e2e/markdown-visual.spec.ts-snapshots/` 下生成 8 张 `*-chromium-win32.png`。
- 第二条命令全部通过，包括两次重复：截图稳定，几何对照全部在容差内。
- 若几何对照失败，按失败信息调整 Task 4 的 `styles.css`，或 Task 5 的 `markdown.css` 中顶栏与外框尺寸，然后重新生成基线；不得放宽 parity 容差。

人工核对：打开生成的 `markdown-edit-light-chromium-win32.png`、`markdown-split-light-chromium-win32.png`，与参考截图 `12-35-10`、`12-35-21` 的页签、工具栏和状态栏区域对比。确认以下各项，有不一致就修样式后重新生成：
- 圆角、灰底与分隔线位置一致；
- 编辑区使用比例字体、灰色标记；
- 比对预览为浅灰底。

Run: `git status --short`
Expected：新增的只有 `markdown-visual.spec.ts-snapshots/` 下 8 张 png；`showcase.spec.ts-snapshots/`、`markdown-core.spec.ts-snapshots/` 无改动。

- [ ] **Step 4: 提交**

```powershell
git add apps/playground/e2e/markdown-visual.spec.ts
git add apps/playground/e2e/markdown-parity.spec.ts
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-edit-light-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-edit-dark-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-split-light-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-split-dark-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-preview-light-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-preview-dark-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-menu-list-light-chromium-win32.png
git add apps/playground/e2e/markdown-visual.spec.ts-snapshots/markdown-dialog-link-light-chromium-win32.png
git commit -m "test(playground): MarkdownEditor 视觉基线与 CSDN 几何对照" -m "新增三种视图 × 亮/暗主题、「列表」菜单与链接对话框共 8 张 Windows 基线（仅对 markdown-visual.spec.ts 生成）。" -m "markdown-parity.spec.ts 在 2558×1308 视口下，按参考截图实测值断言外框、页签、工具栏、加粗按钮、状态栏两行、面板与图标栏位置，以及 Markdown 模式 20% 内边距与比对模式编辑区宽度。"
```

---

### Task 8: 3b 全量验证 + `/compare` 人工核对 + phase 4 交接笔记

**Files:**
- Create: `.superpowers/phase4-notes-from-3.md`
- 其他文件只在发现问题时修改，修复单独提交。

- [ ] **Step 1: 全量构建、单测、类型检查、lint**

Run: `pnpm build; pnpm test; pnpm typecheck; pnpm lint`
Expected:
- 全部成功；
- `dist.test.ts`：toolbar/markdown 首行为 `'use client';`，markdown-core 不含；
- 无新增 exhaustive-deps 警告。

- [ ] **Step 2: 全量 e2e（功能 + 截图），再单独跑性能**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test --project chromium
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test --project chromium-perf --no-deps
```

Expected：
- `chromium`：所有 spec 通过（showcase、compare、markdown-core、markdown、markdown-visual、markdown-parity），截图无差异。
- `chromium-perf`：4 个 `@perf` 通过；在下方 Step 4 的笔记中记录 `/markdown` 的 annotation 数值。

- [ ] **Step 3: `/compare` 人工核对**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground start
```

把浏览器窗口内容区调到 2558×1308（或缩放到同等 CSS 像素），逐一打开以下页面，用「叠加」模式、50% 透明度对比：
- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-35-10.png&target=%2Fmarkdown%3Ffixture%3Dcsdn%26view%3Dedit%26panel%3Dcsdn%3Aai`
- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-35-21.png&target=%2Fmarkdown%3Ffixture%3Dcsdn%26view%3Dsplit%26panel%3Dcsdn%3Aai`
- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-35-32.png&target=%2Fmarkdown%3Ffixture%3Dcsdn%26view%3Dpreview%26panel%3Dcsdn%3Aai`
- `http://localhost:3100/compare?ref=screenshot_2026-10-09_12-36-59.png&target=%2Fmarkdown%3Ffixture%3Dcsdn%26view%3Dpreview%26panel%3Dtoc`

核对清单（偏差写入下方 Step 4 的笔记，不阻塞）：
- [ ] 外框、页签、工具栏、状态栏的边缘重合（±2px）；
- [ ] 工具栏图标与文字的位置、间距，下拉箭头；
- [ ] 状态栏两行文字基线、额度提示与右侧按钮的位置；
- [ ] 目录面板标题条、层级缩进与字号；图标栏选中态底色；
- [ ] 编辑区字体、字号、行高与标记颜色；预览区标题、正文字号（已知差距：phase3-notes「preview type larger/bolder」）。

完成后 Ctrl+C 停止服务。

- [ ] **Step 4: 写 phase 4 交接笔记**

`.superpowers/phase4-notes-from-3.md`：

```markdown
# Notes for phase 4 from phase 3 (binding unless superseded)

Phase 3 = plans 3a + 3b. 3b HEAD: <填写 git rev-parse --short HEAD>.

## 可直接复用的 API
- `@geekx/toolbar`：EditorExtension / ToolbarItem / PanelDef / ExtensionContext、resolveToolbar / resolvePanels、
  collectShortcuts / handleShortcut、<Toolbar>、MessagesProvider / useMessages、zhCN、EditorAdapters / PublishSettings（暂定形状）。
- `@geekx/markdown`：<MarkdownEditor />（props：value/defaultValue/onChange/adapters/extensions/coreExtensions/
  toolbarLayout/missingAdapter/autoSaveInterval/viewMode/defaultPanel/showRail/defaultSplit/theme/locale/readOnly/
  placeholder/height/slots{headerEnd,statusCenter,statusEnd}）；ref：focus/getValue/setValue/getHtml/getDocument/
  runCommand/insert/saveDraft/getEngine。
- 发布弹窗（phase 4）应作为宿主 UI 放在 slots.statusEnd，或作为 csdn:* 扩展的 modal；PublishSettings 字段可在 phase 4 调整。

## 性能实测（chromium-perf，/markdown）
- burst / paused / lines median、p95：<填写 annotation>
- 顶部插入标题长任务：<填写>

## 遗留与已知差距
- 模板、历史版本只是 playground 演示扩展；真正的 csdn-extensions 在 phase 7 实现。
- onChange 经过防抖：受控模式下回写会丢弃约 200ms 内的输入（3a 风险 1）。
- 拖放图片插在光标处，而不是指针落点。
- 上传失败的占位只在失败条中标红，编辑区文本不着色。
- 目录面板不高亮当前标题；预览中 `@[TOC]` 大标题行的样式未单独调整。
- 预览区排版与 CSDN 仍有差距（字号/字重），具体见 /compare 核对记录：<填写>。
- 查找/替换（CSDN Ctrl+F/G）不在阶段 3 范围内。
- 分隔条默认 50%，CSDN 实测约 49.4%（±16px 容差内）。
```

把 `<填写 …>` 换成 Step 2–3 的实际结果后提交。

- [ ] **Step 5: 工作区检查并提交**

Run: `git status --short`
Expected：除 `.superpowers/phase4-notes-from-3.md` 外没有未提交改动；没有误提交的 `dist/`、`.next/`、`test-results/`。

```powershell
git add .superpowers/phase4-notes-from-3.md
git commit -m "docs(superpowers): 阶段 3 交接笔记" -m "记录 toolbar/markdown 可复用 API、/markdown 性能实测值、/compare 人工核对结论与遗留差距，作为 phase 4（发布设置）的输入。"
```

如果 Step 1–3 中有修复，每个修复单独提交：

```powershell
git add <修复的文件，逐个>
git commit -m "fix(<scope>): <修复内容>" -m "<原因与影响>"
```

---

## 假设与风险（执行前确认）

1. **页签文案用「比对」而非「对照」**：参考截图裁切（`p3crops/toolbar-left.png`）显示为「比对」，而 `reference-index.md` 写的是「对照」。以截图为准，可通过 `locale.modes.split` 覆盖。
2. **`autoSaveInterval` 默认关闭（0）**：spec 只说「按间隔调用 onSaveDraft」，没有给出默认值。playground 用 30s。localStorage 兜底与「本地版本更新时提示恢复」属于 phase 6 的 App 层，不在 `<MarkdownEditor />` 内实现。受控模式下父组件写入新 `value`，会被视为未保存的改动。
3. **状态栏在预览模式只显示 HTML 行**，这是根据 CSDN 预览模式截图推断的，会导致状态栏高度在模式间变化（两行变一行）。如需固定高度，可改成占位隐藏。
4. **目录跳转**：
   - Markdown 模式按段滚动编辑区，定位到段首，不是标题的精确行；
   - 不移动光标；
   - 不高亮当前标题。
5. **分隔条**：
   - 命中区域 6px，覆盖在预览区左缘，不占布局宽度，也不与编辑区滚动条重叠；
   - 默认 50%；
   - 拖动时不节流（每次 pointermove 都 setState，只重渲染 `EditorShell` 外壳）。
6. **暗色 token 是自定值**，CSDN 没有暗色主题。暗色视觉基线只保证稳定，不代表与参考截图对照过。
7. **几何对照依赖字体**：「Markdown」页签宽 119 取决于 Windows 上的 Microsoft YaHei，因此 parity 用例和视觉基线一样只在 Windows 上可信。其他平台可以用 `test.skip(process.platform !== 'win32')` 跳过（执行时如遇非 Windows CI 再加）。
8. **演示扩展推断的内容**：
   - 「模板」图标和红点、「历史版本」恒禁用、AI/营销面板内容都只是占位；
   - 工具栏 dropdown 子项沿用 3a，是由截图推断的，没有展开态截图。
9. **粘贴上传 e2e** 用 `new ClipboardEvent('paste', { clipboardData })` 合成事件，验证的是引擎转发和上传流程，不是系统剪贴板本身。
10. **`PanelRightClose`/`PanelRightOpen` 图标名**：若 lucide-react 1.53 中缺失，就换成等价图标，只影响图标不影响行为。
11. **预览排版**：本计划只调整了外壳和编辑区字体，预览区字号、字重沿用 markdown-core 的 `.ex-preview`，与 CSDN 的差距留给 Step 3 人工核对记录。如果 parity 或人工核对要求修改，应在 `packages/markdown/src/styles.css` 中用 `.ex-mde .ex-preview ...` 覆盖，不改 markdown-core，避免 `markdown-core-*` 基线变化。

## Self-Review

- **Spec 覆盖**：
  - §6.1 UI：
    - 状态栏（字数、行数、光标、保存状态）—— Task 1；
    - 可拖动分隔条 —— Task 3；
    - 目录面板、语法说明面板 —— Task 2；
    - 全屏在 3a 完成，本计划在 Task 4 补全屏底色；
    - `autoSaveInterval` —— Task 1。
  - §8 视觉还原：Task 4 的 token 与样式、Task 7 的几何对照与基线。
  - §9 测试：Task 1–3 的 Vitest/RTL，Task 6 的 e2e 与 `@perf`，Task 7 的视觉回归，Task 8 的全量验证。
- **用户要求**：
  - 受控/非受控、三种视图、ref、SSR、StrictMode 已在 3a 完成；本计划新增的 ref 方法 `saveDraft` 与 `setValue` 的「已保存」语义有用例覆盖。
  - playground 为 Task 5；`@perf` 经新组件保持通过为 Task 6；视觉基线只在 Windows 上生成、对照参考截图为 Task 7；最终全量验证为 Task 8。
- **phase3-notes**：
  - 规则 7：同步滚动所需的预览 patch 与 refresh 由 3a 运行时负责；分隔条宽度变化时由同步滚动的 ResizeObserver 刷新。
  - 「Perf gates」：已在 `/markdown` 复测。
  - 「Visual gaps」：顶栏、页签、工具栏、侧栏由 Task 4/5 解决；编辑区比例字体与灰色标记由 Task 4 解决；状态栏保存/发布区域由 Task 1 插槽和 Task 5 解决；预览排版差距在 Task 8 记录。
- **类型一致性**：
  - `EditorSnapshot.save` 由 3a 定义，被 `createDraftSaver` 和 `StatusBar` 使用。
  - `MarkdownInternals.scrollToHeading` 与 `MarkdownContextDeps.scrollToHeading?` 在 Task 2 同时加入；3a 的 `context.test.ts` 不传该参数，回落为 `false`。
  - `MarkdownEditorHandle.saveDraft` 在 Task 1 同时加入类型与实现。
  - `defaultPanel`、`showRail`、`defaultSplit` 都在使用它们的任务中加入 `types.ts`。
  - Task 3 的全文是 3a Task 9 全文叠加 Task 1–3 的全部修改。
- **占位符扫描**：所有步骤都给出了完整代码或精确的修改片段。唯一的 `<填写 …>` 位于 Task 8 交接笔记模板中，有意留给执行时填入实测数据，并在该步骤中明确要求替换。
