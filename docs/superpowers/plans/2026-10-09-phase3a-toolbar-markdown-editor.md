# 阶段 3a：toolbar 扩展 API + `<MarkdownEditor />` 核心 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **拆分说明**：阶段 3 超过 10 个任务，拆为两份计划。本文件为 **3a**（扩展 API + React 包装核心，10 个任务）；**3b** 见 `docs/superpowers/plans/2026-10-09-phase3b-markdown-csdn-chrome.md`（CSDN 外壳像素级还原、playground、e2e/性能/视觉基线，8 个任务）。3b 依赖 3a 全部完成。用户指定的单文件名 `2026-10-09-phase3-markdown-editor.md` 因拆分不再使用。

**Goal:** 交付 `@editorx/toolbar`（扩展协议、布局解析、快捷键、溢出、i18n、`<Toolbar>`）与 `@editorx/markdown`（`<MarkdownEditor />`：受控/非受控、三种视图、预览流水线、命令/扩展、图片上传、命令式 ref），并补齐阶段 1 遗留的浮层/主题/Toast 能力。

**Architecture:** `@editorx/toolbar` 是与编辑器无关的纯 React 层：扩展定义 → `resolveToolbar` 解析为分组 → `<Toolbar>` 渲染（`@editorx/ui` 的 Dropdown/Popover/Modal/Tooltip，浮层挂 `.ex-portal`）。`@editorx/markdown` 把 `markdown-core` 的 `ClEditEngine` + 渲染器 + `patchPreview` + `createScrollSync` 包进一个 StrictMode 安全的 React 组件：引擎由 `useState` 工厂创建一次、在 effect 中 mount/destroy；预览流水线（200ms 防抖 → `yieldToMain` → `patchPreview` → rAF 刷新同步滚动 → 图表 → 空闲统计，带代次丢弃）从 playground demo 移植为框架无关模块；UI 状态（光标、格式、统计、目录、面板、上传失败）放在 `useSyncExternalStore` 小 store 中，按键路径不触发整树渲染。内置功能全部以 `markdownCoreExtensions` 实现，与第三方扩展同等地位。

**Tech Stack:** React 19（`ref` 作为 prop）、`@floating-ui/react` 0.27（FloatingTree/useListNavigation）、lucide-react 1.53、tsup（ESM + d.ts，React 包首行 `'use client';`）、Vitest 5 + jsdom + Testing Library、Playwright（仅回归既有用例）。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md` §5、§6.1、§6.5、§6.6、§7、§9；绑定输入：`.superpowers/phase3-notes-from-2.md`（规则 1–11）、`.superpowers/phase2-contract.md`（含 Addendum A/B）、`.superpowers/sdd/2026-10-09-phase1-foundation/progress.md`（阶段 1 遗留裁决）。

---

## Global Constraints

- **只在 React 包加 `'use client'`**：`@editorx/theme`（已有）、`@editorx/ui`（已有）、`@editorx/toolbar`、`@editorx/markdown` 的 `dist/index.js` 首行为 `'use client';`（tsup `banner`）；`@editorx/markdown-core` 永不加。源码文件不写 `'use client'`。
- **SSR 安全**：模块顶层与 render 期间不访问 `window`/`document`/`navigator`（`isMacPlatform` 内部判空）；引擎、渲染器、图表只在 effect 中创建/调用；`ThemeProvider` 首帧 `ready=false`，图表在 `ready` 后才绘制。
- **StrictMode 生命周期（phase3-notes 规则）**：引擎由 `useState(() => factory())` 创建一次；mount effect 首次用 `value ?? defaultValue`，之后的 remount 用 `engine.getValue()`（保留撤销历史）；cleanup 先退订全部监听再 `engine.destroy()`；滚动同步在独立 effect 中创建，声明在 mount effect 之后；`readOnly`/`placeholder`/`ariaLabel` 用引擎的原地 setter，绝不重建引擎。
- **onChange 语义**：`onChange(markdown, html)` 在防抖渲染完成后调用（与预览同一次渲染，html 即该次 `RenderResult.html`）；挂载、`ref.setValue`、受控 `value` 写入都不触发；受控 `value` 仅在与最后一次发出/写入的值不同时写入引擎。
- **context 拥有者包是 peerDependency**：`@editorx/toolbar` peer `@editorx/theme`、`@editorx/ui`、`react`、`react-dom`；`@editorx/markdown` peer `@editorx/theme`、`@editorx/ui`、`@editorx/toolbar`、`react`、`react-dom`，`dependencies` 只有 `@editorx/markdown-core`（`workspace:*`）与 `lucide-react`。devDependencies 用 `workspace:*` 镜像 peer。
- **样式**：原生 CSS，类名前缀 `.ex-`；新外壳类统一 `ex-mde-*`（`ex-md-*` 已被语法高亮 token 占用），工具栏 `ex-toolbar*`；只用 `var(--ex-*)`，不写颜色字面量；组件私有变量用 `--ex-mde-*`。新增颜色 token 必须同时写入 `light-dark()` 主块和三个 `@supports not` 兜底块（`packages/theme/src/styles.test.ts` 校验）。
- **浮层**：所有 Dropdown/Popover/Modal 渲染到 `useTheme().portalRoot`（`.ex-portal`）；嵌套浮层通过 FloatingTree 共享父子关系（Esc 只关最内层、子浮层内点击不算父浮层外部点击）。
- **i18n**：所有可见文案来自 `Messages`（默认 `zhCN`），组件经 `useMessages()` 读取；扩展的 `title`/`label` 可为字符串或 `(m: Messages) => string`。
- **扩展隔离**：扩展的 `run`/快捷键/`setup` 抛错 → `console.error` + `notify(errors.extension, 'error')`，编辑器继续工作；`render` 抛错由 `ExtensionErrorBoundary` 截获；`active`/`disabled` 在 render 期间求值，出错只 `console.error` 并按 `false` 处理。
- **测试**：`restoreMocks: true` 加入所有 jsdom 包的 vitest 配置；SSR 文本断言使用单个模板字符串文本节点；不新增依赖（Testing Library、jsdom、user-event 已在根）。
- **性能红线不变**：`@perf` 门槛（10k 行按键延迟 median/p95 < 50ms、无 > 50ms 长任务）在 3b 中改为通过 `<MarkdownEditor />` 测量；3a 不得引入每次按键的 React 整树渲染（按键路径只做 rAF 合批的 store 更新）。
- **Windows / PowerShell**：命令用 `;` 串联（不用 `&&`）；e2e 前先释放 3100 端口：
  `Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- **提交**：Conventional Commits，中文标题 + 正文（多个 `-m`）；逐个文件 `git add <path>`，禁止 `git add .` / `-A`；不 push、不切分支。
- **既有基线不变**：`showcase-{light,dark}`、`markdown-core-{light,dark}` 截图在 3a 结束时必须仍然通过（不得 `--update-snapshots` 它们）。

---

## File Structure

```text
packages/theme/src/
  theme-provider.tsx          # 修改：ready、bodyPortalRoot、useOptionalTheme、切换主题时禁用 transition
  theme-provider.test.tsx     # 修改：新增用例
  index.ts                    # 修改：导出 useOptionalTheme
  styles.css                  # 修改：[data-ex-theme-switching] 规则
packages/theme/vitest.config.ts   # 修改：restoreMocks
packages/ui/src/
  floating-tree.tsx           # 新增：withFloatingTree HOC
  popover.tsx / modal.tsx     # 修改：FloatingNode；Modal ariaLabel
  dropdown.tsx                # 重写：role=menu + 方向键 + 分隔线 + extra
  toast.tsx                   # 修改：error→role=alert、关闭按钮
  styles.css                  # 修改：dropdown/toast 新类
  *.test.tsx                  # 修改：新增用例
packages/ui/vitest.config.ts      # 修改：restoreMocks
packages/markdown-core/src/
  commands/inline.ts          # 修改：mark / superscript / subscript
  commands/registry.ts        # 修改：注册上述命令
  commands/commands.test.ts   # 修改
packages/markdown-core/vitest.config.ts  # 修改：restoreMocks
packages/toolbar/             # 新包 @editorx/toolbar
  package.json  tsconfig.json  tsup.config.ts  vitest.config.ts
  src/index.ts
  src/types.ts                # EditorType/EditorDocument/EditorAdapters/PublishSettings…
  src/messages.ts             # zhCN、Messages、DeepPartial、mergeMessages、formatMessage
  src/messages-context.tsx    # MessagesProvider、useMessages
  src/extension.ts            # EditorExtension/ToolbarItem/PanelDef/ExtensionContext…
  src/layout.ts               # activeExtensions/resolveToolbar/resolvePanels/flattenChildren/overflowChildren/fitGroups
  src/shortcuts.ts            # parse/match/format/collect/handle
  src/item-state.ts           # isItemActive/isItemDisabled
  src/error-boundary.tsx      # ExtensionErrorBoundary
  src/use-extension-setup.ts  # useExtensionSetup、useStableArray
  src/toolbar.tsx             # <Toolbar>
  src/cx.ts
  src/styles.css
  src/*.test.ts(x)
packages/markdown/            # 新包 @editorx/markdown
  package.json  tsconfig.json  tsup.config.ts  vitest.config.ts
  src/index.ts
  src/types.ts                # MarkdownEditorProps/Handle/ViewMode
  src/markdown-editor.tsx     # <MarkdownEditor />
  src/runtime.ts              # useEditorRuntime（引擎 + 流水线 + 同步滚动生命周期）
  src/pipeline/scheduler.ts  stats-counter.ts  preview-pipeline.ts
  src/store.ts                # createEditorStore、useEditorState
  src/formats.ts              # detectFormats、formatsKey
  src/toc.ts                  # extractTocTitle
  src/commands.ts             # createCommandRegistry
  src/context.ts              # createMarkdownContext
  src/internals.ts            # 包内私有 internals（WeakMap）
  src/mode-tabs.tsx
  src/use-controllable.ts  use-latest.ts  cx.ts
  src/uploads/placeholders.ts  uploader.ts  upload-failures.tsx
  src/core-extensions/format.tsx  blocks.tsx  insert.tsx  actions.tsx  dialogs.tsx  index.ts
  src/test-utils.tsx
  src/styles.css
  src/*.test.ts(x)
```

---

## Tasks

1. 主题：`useOptionalTheme`、`ready`、body 级 portal、切换时禁用 transition、`restoreMocks`
2. ui：FloatingTree 嵌套浮层、Dropdown 菜单语义与方向键、Modal `ariaLabel`、Toast `alert`/关闭按钮
3. `@editorx/toolbar` 脚手架：共享类型、`Messages` 字典、`MessagesProvider`
4. 扩展协议与纯逻辑：布局解析、面板解析、快捷键、溢出计算
5. `<Toolbar>` 组件：分组/分隔、tooltip+快捷键、状态、溢出「更多」、弹层插槽、错误隔离、`useExtensionSetup`
6. markdown-core 新命令 + `@editorx/markdown` 脚手架 + 预览流水线
7. `<MarkdownEditor />` 核心：store、格式检测、运行时生命周期、视图模式、受控/非受控、ref、SSR
8. 图片上传：占位符、上传器、粘贴/拖拽、失败重试/删除
9. 扩展接入：`ExtensionContext`、内置扩展（CSDN 工具栏布局）、对话框、快捷键、全屏
10. 3a 全量验证

---

### Task 1: 主题：`useOptionalTheme`、`ready`、body 级 portal、切换时禁用 transition

**Files:**
- Modify: `packages/theme/src/theme-provider.tsx`
- Modify: `packages/theme/src/index.ts`
- Modify: `packages/theme/src/styles.css`
- Modify: `packages/theme/src/theme-provider.test.tsx`
- Modify: `packages/theme/vitest.config.ts`、`packages/ui/vitest.config.ts`、`packages/markdown-core/vitest.config.ts`

**Interfaces:**
- Consumes: 现有 `ThemeProvider`/`useTheme`。
- Produces:
  ```ts
  interface ThemeContextValue {
    mode: ThemeMode; resolved: ResolvedTheme; setMode(mode: ThemeMode): void
    portalRoot: HTMLElement | null          // .ex-root 内的 .ex-portal（不变）
    bodyPortalRoot: HTMLElement | null      // document.body 下的 div.ex-root.ex-body-portal，data-ex-theme 同步（供 CKEditor 等 body 级浮层）
    ready: boolean                          // 挂载后为 true；SSR/首帧为 false
  }
  function useOptionalTheme(): ThemeContextValue | null
  ```
  切换主题时根节点与 body portal 带 `data-ex-theme-switching` 两帧，CSS 在此期间禁用 transition。

- [ ] **Step 1: 写失败测试**

在 `packages/theme/src/theme-provider.test.tsx` 顶部 import 改为：

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useOptionalTheme, useTheme } from './theme-provider'
```

在文件末尾追加：

```tsx
function ReadyProbe() {
  const { ready } = useTheme()
  return <span data-testid="ready">{`ready:${ready}`}</span>
}

function OptionalProbe() {
  const theme = useOptionalTheme()
  return <span data-testid="optional">{`optional:${theme ? theme.resolved : 'none'}`}</span>
}

const bodyPortals = () => document.querySelectorAll<HTMLElement>('body > .ex-root.ex-body-portal')

describe('ThemeProvider（阶段 3 补充）', () => {
  it('useOptionalTheme：Provider 外返回 null，内部返回上下文', () => {
    const { unmount } = render(<OptionalProbe />)
    expect(screen.getByTestId('optional')).toHaveTextContent('optional:none')
    unmount()
    render(<ThemeProvider defaultTheme="dark" storageKey={false}><OptionalProbe /></ThemeProvider>)
    expect(screen.getByTestId('optional')).toHaveTextContent('optional:dark')
  })

  it('ready：SSR 输出为 false，客户端挂载后为 true', () => {
    expect(renderToString(<ThemeProvider defaultTheme="light"><ReadyProbe /></ThemeProvider>)).toContain('ready:false')
    render(<ThemeProvider defaultTheme="light" storageKey={false}><ReadyProbe /></ThemeProvider>)
    expect(screen.getByTestId('ready')).toHaveTextContent('ready:true')
  })

  it('bodyPortalRoot：挂在 body 下、同步主题、卸载时移除；StrictMode 下只有一个', async () => {
    let captured: HTMLElement | null = null
    function Capture() {
      captured = useTheme().bodyPortalRoot
      return null
    }
    const { unmount } = render(
      <StrictMode>
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <Capture />
          <Probe />
        </ThemeProvider>
      </StrictMode>,
    )
    expect(bodyPortals()).toHaveLength(1)
    expect(captured).toBe(bodyPortals()[0])
    expect(bodyPortals()[0]).toHaveAttribute('data-ex-theme', 'light')
    await userEvent.click(screen.getByText('to-dark'))
    expect(bodyPortals()[0]).toHaveAttribute('data-ex-theme', 'dark')
    unmount()
    expect(bodyPortals()).toHaveLength(0)
  })

  it('切换主题时在两帧内标记 data-ex-theme-switching，随后移除', async () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    render(<ThemeProvider defaultTheme="light" storageKey={false}><Probe /></ThemeProvider>)
    frames.splice(0).forEach((cb) => cb(0))
    await userEvent.click(screen.getByText('to-dark'))
    expect(root()).toHaveAttribute('data-ex-theme-switching')
    expect(bodyPortals()[0]).toHaveAttribute('data-ex-theme-switching')
    act(() => frames.splice(0).forEach((cb) => cb(0)))
    expect(root()).toHaveAttribute('data-ex-theme-switching')
    act(() => frames.splice(0).forEach((cb) => cb(0)))
    expect(root()).not.toHaveAttribute('data-ex-theme-switching')
    expect(bodyPortals()[0]).not.toHaveAttribute('data-ex-theme-switching')
  })
})
```

（`Probe` 与 `root` 是文件中已有的辅助函数。）

在 `packages/theme/src/styles.test.ts` 末尾追加：

```ts
describe('styles.css 主题切换', () => {
  it('切换期间禁用 transition', () => {
    expect(css).toContain('.ex-root[data-ex-theme-switching] *')
    expect(css).toMatch(/\[data-ex-theme-switching\][^{]*\{\s*transition: none !important;/)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @editorx/theme exec vitest run`
Expected: FAIL —— `useOptionalTheme` 未导出、`bodyPortalRoot`/`ready` 为 undefined、样式断言失败。

- [ ] **Step 3: 实现**

`packages/theme/src/theme-provider.tsx` 全文替换为：

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from './resolve-theme'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode(mode: ThemeMode): void
  /** `.ex-root` 内的浮层容器 */
  portalRoot: HTMLElement | null
  /** `document.body` 下带同一主题的浮层容器，供无法渲染进 `.ex-root` 的第三方浮层使用 */
  bodyPortalRoot: HTMLElement | null
  /** 客户端挂载完成（系统主题已解析）后为 true */
  ready: boolean
}

export interface ThemeProviderProps {
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?: (mode: ThemeMode) => void
  storageKey?: string | false
  className?: string
  children: ReactNode
}

const DARK_QUERY = '(prefers-color-scheme: dark)'
const SWITCHING_ATTR = 'data-ex-theme-switching'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(key: string): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(key)
    return isThemeMode(stored) ? stored : null
  } catch {
    return null
  }
}

function writeStoredMode(key: string, mode: ThemeMode): void {
  try {
    window.localStorage.setItem(key, mode)
  } catch {
    // storage unavailable (private mode, quota): keep the in-memory theme only
  }
}

export function ThemeProvider({
  theme,
  defaultTheme = 'system',
  onThemeChange,
  storageKey = 'editorx-theme',
  className,
  children,
}: ThemeProviderProps) {
  const isControlled = theme !== undefined
  const [innerMode, setInnerMode] = useState<ThemeMode>(defaultTheme)
  const [systemDark, setSystemDark] = useState(false)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const [bodyPortalRoot, setBodyPortalRoot] = useState<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const mode = isControlled ? theme : innerMode
  const resolved = resolveTheme(mode, systemDark)
  const appliedTheme = !mounted && mode === 'system' ? 'system' : resolved
  const previousTheme = useRef(appliedTheme)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isControlled || !storageKey) return
    const stored = readStoredMode(storageKey)
    if (stored) setInnerMode(stored)
  }, [isControlled, storageKey])

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY)
    setSystemDark(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'ex-root ex-body-portal'
    document.body.appendChild(el)
    setBodyPortalRoot(el)
    return () => {
      el.remove()
      setBodyPortalRoot(null)
    }
  }, [])

  useEffect(() => {
    bodyPortalRoot?.setAttribute('data-ex-theme', appliedTheme)
  }, [bodyPortalRoot, appliedTheme])

  // Colours would otherwise animate through every `transition` declared on themed elements.
  useEffect(() => {
    if (previousTheme.current === appliedTheme) return
    previousTheme.current = appliedTheme
    const targets = [rootRef.current, bodyPortalRoot].filter((el): el is HTMLElement => el !== null)
    for (const el of targets) el.setAttribute(SWITCHING_ATTR, '')
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        for (const el of targets) el.removeAttribute(SWITCHING_ATTR)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      for (const el of targets) el.removeAttribute(SWITCHING_ATTR)
    }
  }, [appliedTheme, bodyPortalRoot])

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (!isControlled) {
        setInnerMode(next)
        if (storageKey) writeStoredMode(storageKey, next)
      }
      onThemeChange?.(next)
    },
    [isControlled, storageKey, onThemeChange],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, portalRoot, bodyPortalRoot, ready: mounted }),
    [mode, resolved, setMode, portalRoot, bodyPortalRoot, mounted],
  )

  return (
    <ThemeContext.Provider value={value}>
      <div ref={rootRef} className={className ? `ex-root ${className}` : 'ex-root'} data-ex-theme={appliedTheme}>
        {children}
        <div className="ex-portal" ref={setPortalRoot} />
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}

/** 与 useTheme 相同，但在 Provider 外返回 null（用于「有外层主题就复用」的组件） */
export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext)
}
```

`packages/theme/src/index.ts` 第 3 行改为：

```ts
export { ThemeProvider, useOptionalTheme, useTheme } from './theme-provider'
```

在 `packages/theme/src/styles.css` 中 `.ex-root { font-family: ... }`（第二个 `.ex-root` 块）之后、`/* Static values must mirror ... */` 之前插入：

```css
.ex-root[data-ex-theme-switching],
.ex-root[data-ex-theme-switching] *,
.ex-root[data-ex-theme-switching] *::before,
.ex-root[data-ex-theme-switching] *::after {
  transition: none !important;
}
```

三个 vitest 配置（`packages/theme/vitest.config.ts`、`packages/ui/vitest.config.ts`、`packages/markdown-core/vitest.config.ts`）的 `test` 对象内加一行 `restoreMocks: true,`。以 ui 为例全文：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
    restoreMocks: true,
  },
})
```

（theme 与 markdown-core 的配置保留各自已有字段，只增加 `restoreMocks: true,`。）

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @editorx/theme exec vitest run; pnpm --filter @editorx/ui exec vitest run; pnpm --filter @editorx/markdown-core exec vitest run`
Expected: 三个包全部 PASS（`restoreMocks` 不应使既有用例失败；若某个用例依赖跨用例保留的 mock，改为在该用例内重新 mock）。

- [ ] **Step 5: 类型检查**

Run: `pnpm --filter @editorx/theme typecheck`
Expected: 无错误。

- [ ] **Step 6: 提交**

```powershell
git add packages/theme/src/theme-provider.tsx
git add packages/theme/src/index.ts
git add packages/theme/src/styles.css
git add packages/theme/src/theme-provider.test.tsx
git add packages/theme/src/styles.test.ts
git add packages/theme/vitest.config.ts
git add packages/ui/vitest.config.ts
git add packages/markdown-core/vitest.config.ts
git commit -m "feat(theme): 增加 ready、body 级主题 portal 与 useOptionalTheme" -m "ThemeContext 新增 ready（挂载后为 true）与 bodyPortalRoot（document.body 下同步 data-ex-theme 的 .ex-root 容器），新增 useOptionalTheme 供组件复用外层主题。" -m "主题切换时根节点与 body portal 标记 data-ex-theme-switching 两帧，CSS 期间禁用 transition，避免颜色渐变闪烁。" -m "theme/ui/markdown-core 的 vitest 开启 restoreMocks。"
```

---

### Task 2: ui：FloatingTree 嵌套浮层、Dropdown 菜单语义与方向键、Modal `ariaLabel`、Toast `alert`/关闭按钮

**Files:**
- Create: `packages/ui/src/floating-tree.tsx`
- Modify: `packages/ui/src/popover.tsx`
- Modify: `packages/ui/src/modal.tsx`
- Rewrite: `packages/ui/src/dropdown.tsx`
- Modify: `packages/ui/src/toast.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/dropdown.test.tsx`、`packages/ui/src/modal.test.tsx`、`packages/ui/src/toast.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `useTheme().portalRoot`。
- Produces:
  ```ts
  interface DropdownItem { key: string; label: ReactNode; icon?: ReactNode; extra?: ReactNode; disabled?: boolean; separator?: boolean }
  interface DropdownProps { items: DropdownItem[]; onSelect(key: string): void; children: ReactElement; placement?: Placement; label?: string; className?: string }
  interface ModalProps { /* 既有字段 */ ariaLabel?: string }   // 无 title 时作为 aria-label
  interface ToastProviderProps { duration?: number; closeLabel?: string; children: ReactNode }
  ```
  Dropdown：浮层本身是 `ul[role=menu].ex-popover.ex-dropdown`；ArrowDown 打开并聚焦首项，上下键循环并跳过分隔线/禁用项，Enter 选择；Popover/Modal/Dropdown 都注册 FloatingNode，嵌套时 Esc 先关子层。Toast：`error` 为 `role=alert`，其余 `role=status`；每条有关闭按钮。

- [ ] **Step 1: 写失败测试**

`packages/ui/src/dropdown.test.tsx` 顶部 import 改为：

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown } from './dropdown'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'
import { Tooltip } from './tooltip'
```

在 `describe('Dropdown', ...)` 内末尾追加：

```tsx
  const navItems = [
    { key: 'a', label: '甲', extra: 'Ctrl+A' },
    { key: 'sep', label: '', separator: true },
    { key: 'b', label: '乙' },
    { key: 'c', label: '丙', disabled: true },
  ]

  it('菜单有无障碍名称，分隔线渲染为 separator，extra 显示在项内', async () => {
    renderWithTheme(
      <Dropdown label="标题菜单" items={navItems} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    const menu = await screen.findByRole('menu', { name: '标题菜单' })
    expect(menu).toHaveClass('ex-popover', 'ex-dropdown')
    expect(menu.closest('.ex-portal')).not.toBeNull()
    expect(screen.getByRole('separator')).toHaveClass('ex-dropdown__sep')
    expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveTextContent('Ctrl+A')
  })

  it('ArrowDown 打开并聚焦首项，方向键循环且跳过分隔线与禁用项，Enter 选择', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Dropdown label="标题菜单" items={navItems} onSelect={onSelect}>
        <button>标题</button>
      </Dropdown>,
    )
    screen.getByRole('button', { name: '标题' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: '乙' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: /甲/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: '乙' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Modal 内的 Dropdown：点菜单项不关 Modal；Esc 先关菜单，再关 Modal', async () => {
    const onClose = vi.fn()
    const onSelect = vi.fn()
    renderWithTheme(
      <Modal open onClose={onClose} title="设置">
        <Dropdown items={navItems} onSelect={onSelect}>
          <button>标题</button>
        </Dropdown>
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '乙' }))
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
```

在 `packages/ui/src/modal.test.tsx` 的 `describe` 内追加（沿用该文件已有的 import；若缺少 `screen`/`renderWithTheme` 则补上）：

```tsx
  it('无 title 时使用 ariaLabel 作为无障碍名称', () => {
    renderWithTheme(
      <Modal open onClose={() => {}} ariaLabel="插入表格">
        内容
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: '插入表格' })).toBeInTheDocument()
  })
```

在 `packages/ui/src/toast.test.tsx` 的 `describe('Toast', ...)` 内追加：

```tsx
  it('error 类型使用 role=alert，其余为 status', () => {
    setup(
      <>
        <Trigger type="error" />
      </>,
    )
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getByRole('alert')).toHaveClass('ex-toast--error')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('关闭按钮立即移除提示，按钮名可配置', () => {
    render(
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <ToastProvider closeLabel="Close">
          <Trigger />
        </ToastProvider>
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByText('notify'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('提示栈不再设置 aria-live（由各条 role 决定播报方式）', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    expect(document.querySelector('.ex-toast-stack')).not.toHaveAttribute('aria-live')
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @editorx/ui exec vitest run`
Expected: FAIL —— 菜单没有名称/分隔线、方向键无效、Modal 内 Esc 同时关闭两层（或点菜单项关闭 Modal）、无 `ariaLabel`、Toast 无 alert/关闭按钮。

- [ ] **Step 3: 实现**

`packages/ui/src/floating-tree.tsx`：

```tsx
import { FloatingTree, useFloatingParentNodeId } from '@floating-ui/react'
import type { ComponentType } from 'react'

/**
 * 没有外层浮层时自建一棵 FloatingTree，让嵌套在其中的浮层（如 Modal 里的 Dropdown）
 * 共享父子关系：Esc 只关最内层，子浮层内的点击不算父浮层的外部点击。
 */
export function withFloatingTree<P extends object>(Inner: ComponentType<P>, displayName: string): ComponentType<P> {
  function WithFloatingTree(props: P) {
    const parentId = useFloatingParentNodeId()
    if (parentId === null) {
      return (
        <FloatingTree>
          <Inner {...props} />
        </FloatingTree>
      )
    }
    return <Inner {...props} />
  }
  WithFloatingTree.displayName = displayName
  return WithFloatingTree
}
```

`packages/ui/src/popover.tsx` 全文替换为：

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
  useMergeRefs,
  useRole,
  type OpenChangeReason,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'

export interface PopoverProps {
  content: (close: () => void) => ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
  className?: string
}

function PopoverInner({
  content,
  children,
  placement = 'bottom-start',
  open: openProp,
  onOpenChange,
  className,
}: PopoverProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const { portalRoot } = useTheme()
  const nodeId = useFloatingNodeId()

  const setOpen = (next: boolean, event?: Event, reason?: OpenChangeReason) => {
    if (openProp === undefined) setInnerOpen(next)
    onOpenChange?.(next, event, reason)
  }

  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  const childRef = (children.props as { ref?: Ref<Element> }).ref
  const ref = useMergeRefs([refs.setReference, childRef])

  return (
    <>
      {cloneElement(children, getReferenceProps({ ...children.props, ref }))}
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false}>
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover', className)}
                {...getFloatingProps()}
              >
                {content(() => setOpen(false))}
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

export const Popover = withFloatingTree(PopoverInner, 'Popover')
```

`packages/ui/src/modal.tsx` 全文替换为：

```tsx
import {
  FloatingFocusManager,
  FloatingNode,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** 无 title 时的无障碍名称 */
  ariaLabel?: string
  footer?: ReactNode
  width?: number | string
  closeOnMaskClick?: boolean
  closeLabel?: string
  className?: string
  children: ReactNode
}

function ModalInner({
  open,
  onClose,
  title,
  ariaLabel,
  footer,
  width = 520,
  closeOnMaskClick = true,
  closeLabel = '关闭',
  className,
  children,
}: ModalProps) {
  const { portalRoot } = useTheme()
  const titleId = useId()
  const nodeId = useFloatingNodeId()
  const { refs, context } = useFloating({
    nodeId,
    open,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: closeOnMaskClick, outsidePressEvent: 'mousedown' }),
    useRole(context, { role: 'dialog' }),
  ])

  return (
    <FloatingNode id={nodeId}>
      {open && (
        <FloatingPortal root={portalRoot}>
          <FloatingOverlay className="ex-modal-mask" lockScroll>
            <FloatingFocusManager context={context}>
              <div
                ref={refs.setFloating}
                className={cx('ex-modal', className)}
                style={{ width }}
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : ariaLabel}
                {...getFloatingProps()}
              >
                <div className="ex-modal__header">
                  {title && <h2 id={titleId} className="ex-modal__title">{title}</h2>}
                  <button type="button" className="ex-modal__close" aria-label={closeLabel} onClick={onClose}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="ex-modal__body">{children}</div>
                {footer && <div className="ex-modal__footer">{footer}</div>}
              </div>
            </FloatingFocusManager>
          </FloatingOverlay>
        </FloatingPortal>
      )}
    </FloatingNode>
  )
}

export const Modal = withFloatingTree(ModalInner, 'Modal')
```

`packages/ui/src/dropdown.tsx` 全文替换为：

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
  useListNavigation,
  useMergeRefs,
  useRole,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { cx } from './cx'
import { withFloatingTree } from './floating-tree'

export interface DropdownItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  /** 右侧附加信息，如快捷键 */
  extra?: ReactNode
  disabled?: boolean
  /** 为 true 时渲染分隔线，其余字段忽略 */
  separator?: boolean
}

export interface DropdownProps {
  items: DropdownItem[]
  onSelect: (key: string) => void
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  /** 菜单的无障碍名称 */
  label?: string
  className?: string
}

function DropdownInner({ items, onSelect, children, placement = 'bottom-start', label, className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const { portalRoot } = useTheme()
  const nodeId = useFloatingNodeId()
  const listRef = useRef<Array<HTMLElement | null>>([])
  const { refs, floatingStyles, context } = useFloating({
    nodeId,
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const disabledIndices = items.flatMap((item, index) => (item.disabled || item.separator ? [index] : []))
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'menu' }),
    useListNavigation(context, { listRef, activeIndex, onNavigate: setActiveIndex, loop: true, disabledIndices }),
  ])
  const childRef = (children.props as { ref?: Ref<Element> }).ref
  const ref = useMergeRefs([refs.setReference, childRef])

  return (
    <>
      {cloneElement(children, getReferenceProps({ ...children.props, ref }))}
      <FloatingNode id={nodeId}>
        {open && (
          <FloatingPortal root={portalRoot}>
            <FloatingFocusManager context={context} modal={false}>
              <ul
                ref={refs.setFloating}
                style={floatingStyles}
                className={cx('ex-popover ex-dropdown', className)}
                aria-label={label}
                {...getFloatingProps()}
              >
                {items.map((item, index) =>
                  item.separator ? (
                    <li key={item.key} role="separator" className="ex-dropdown__sep" />
                  ) : (
                    <li key={item.key} role="none">
                      <button
                        ref={(node) => {
                          listRef.current[index] = node
                        }}
                        type="button"
                        role="menuitem"
                        className="ex-dropdown__item"
                        tabIndex={activeIndex === index ? 0 : -1}
                        disabled={item.disabled}
                        {...getItemProps({
                          onClick: () => {
                            onSelect(item.key)
                            setOpen(false)
                          },
                        })}
                      >
                        {item.icon && <span className="ex-dropdown__icon" aria-hidden="true">{item.icon}</span>}
                        <span className="ex-dropdown__label">{item.label}</span>
                        {item.extra && <span className="ex-dropdown__extra">{item.extra}</span>}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </FloatingNode>
    </>
  )
}

export const Dropdown = withFloatingTree(DropdownInner, 'Dropdown')
```

`packages/ui/src/toast.tsx` 全文替换为：

```tsx
import { useTheme } from '@editorx/theme'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastApi {
  notify(message: ReactNode, type?: ToastType, duration?: number): void
}

export interface ToastProviderProps {
  duration?: number
  closeLabel?: string
  children: ReactNode
}

interface ToastItem {
  id: number
  message: ReactNode
  type: ToastType
  duration: number
}

const ToastContext = createContext<ToastApi | null>(null)

function ToastView({ item, closeLabel, onDone }: { item: ToastItem; closeLabel: string; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(item.id), item.duration)
    return () => window.clearTimeout(timer)
  }, [item.id, item.duration, onDone])

  return (
    <div role={item.type === 'error' ? 'alert' : 'status'} className={`ex-toast ex-toast--${item.type}`}>
      <span className="ex-toast__message">{item.message}</span>
      <button type="button" className="ex-toast__close" aria-label={closeLabel} onClick={() => onDone(item.id)}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ duration = 3000, closeLabel = '关闭', children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const { portalRoot } = useTheme()

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (message: ReactNode, type: ToastType = 'info', itemDuration: number = duration) => {
      const id = ++nextId.current
      setItems((list) => [...list, { id, message, type, duration: itemDuration }])
    },
    [duration],
  )

  const api = useMemo<ToastApi>(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portalRoot &&
        createPortal(
          <div className="ex-toast-stack">
            {items.map((item) => (
              <ToastView key={item.id} item={item} closeLabel={closeLabel} onDone={remove} />
            ))}
          </div>,
          portalRoot,
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
```

`packages/ui/src/styles.css`：把

```css
.ex-dropdown { padding: var(--ex-space-1) 0; }
.ex-dropdown__menu { margin: 0; padding: 0; list-style: none; }
```

替换为：

```css
.ex-dropdown { margin: 0; padding: var(--ex-space-1) 0; list-style: none; }
.ex-dropdown__sep { height: 1px; margin: var(--ex-space-1) 0; background: var(--ex-color-border); }
.ex-dropdown__label { flex: 1; }
.ex-dropdown__extra { margin-left: var(--ex-space-4); color: var(--ex-color-text-muted); font-size: var(--ex-font-size-sm); }
```

并把 `.ex-toast { ... }` 块替换为：

```css
.ex-toast {
  display: flex;
  align-items: center;
  gap: var(--ex-space-2);
  padding: var(--ex-space-2) var(--ex-space-2) var(--ex-space-2) var(--ex-space-4);
  border-left: 3px solid var(--ex-color-info);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  box-shadow: var(--ex-shadow-popover);
  pointer-events: auto;
}
.ex-toast__close {
  display: inline-flex;
  padding: var(--ex-space-1);
  border: 0;
  border-radius: var(--ex-radius-sm);
  background: transparent;
  color: var(--ex-color-text-muted);
  cursor: pointer;
}
.ex-toast__close:hover { background: var(--ex-color-surface-hover); color: var(--ex-color-text); }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @editorx/ui exec vitest run`
Expected: 全部 PASS（含原有 Dropdown/Popover/Modal/Toast/Tooltip 用例）。

- [ ] **Step 5: 类型检查 + 展示页基线回归**

Run: `pnpm --filter @editorx/ui typecheck; pnpm --filter @editorx/ui build`
Expected: 无错误。

Run（先释放端口）:
```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @editorx/playground build; pnpm --filter @editorx/playground exec playwright test e2e/showcase.spec.ts --project chromium
```
Expected: showcase 全部通过，`showcase-{light,dark}` 截图无差异（展示页默认不展开菜单/Toast；若失败说明默认态样式被改动，回到 Step 3 修正而不是更新基线）。

- [ ] **Step 6: 提交**

```powershell
git add packages/ui/src/floating-tree.tsx
git add packages/ui/src/popover.tsx
git add packages/ui/src/modal.tsx
git add packages/ui/src/dropdown.tsx
git add packages/ui/src/toast.tsx
git add packages/ui/src/styles.css
git add packages/ui/src/dropdown.test.tsx
git add packages/ui/src/modal.test.tsx
git add packages/ui/src/toast.test.tsx
git commit -m "feat(ui): 嵌套浮层 FloatingTree、菜单键盘导航与 Toast 无障碍" -m "Popover/Modal/Dropdown 注册 FloatingNode，无外层时自建 FloatingTree：Esc 只关最内层，子浮层内点击不触发父浮层外部关闭。" -m "Dropdown 改为 ul[role=menu] 浮层本体，支持 label、分隔线、extra（快捷键提示）、方向键循环并跳过禁用项。" -m "Modal 新增 ariaLabel；Toast 的 error 使用 role=alert，每条带可配置名称的关闭按钮，提示栈去掉 aria-live。"
```

---

### Task 3: `@editorx/toolbar` 脚手架：共享类型、`Messages` 字典、`MessagesProvider`

**Files:**
- Create: `packages/toolbar/package.json`、`packages/toolbar/tsconfig.json`、`packages/toolbar/tsup.config.ts`、`packages/toolbar/vitest.config.ts`
- Create: `packages/toolbar/src/index.ts`、`src/types.ts`、`src/messages.ts`、`src/messages-context.tsx`、`src/cx.ts`、`src/styles.css`
- Test: `packages/toolbar/src/messages.test.tsx`、`packages/toolbar/src/dist.test.ts`

**Interfaces:**
- Consumes: 无（仅 React）。
- Produces:
  ```ts
  type EditorType = 'markdown' | 'richtext'
  interface EditorDocument { editorType: EditorType; title: string; markdown?: string; html: string }
  interface EditorAdapters { uploadImage?; onSaveDraft?; onPublish?; searchTags?; getCategories?; aiAssist?; createVote?; uploadVideo?; searchResources?; runCode?; getTemplates? }  // 签名同 spec §5.1
  type AdapterName = keyof EditorAdapters
  interface PublishSettings { tags; cover; summary; categories; articleType; sourceUrl?; visibility; scheduledAt? }  // spec §6.3
  type PublishPayload = EditorDocument & PublishSettings
  interface Category { id: string; name: string }
  interface VoteInput { title: string; options: string[]; multiple: boolean; deadline?: string }
  interface Resource { id: string; title: string; url: string; description?: string }
  interface Template { id: string; name: string; markdown?: string; html?: string }
  const zhCN; type Messages = typeof zhCN; type DeepPartial<T>
  function mergeMessages(base: Messages, override?: DeepPartial<Messages>): Messages
  function formatMessage(template: string, vars: Record<string, string | number>): string
  function MessagesProvider(props: { messages?: DeepPartial<Messages>; children: ReactNode }): JSX.Element  // 叠加在父 Provider 之上
  function useMessages(): Messages
  ```

- [ ] **Step 1: 创建包配置**

`packages/toolbar/package.json`：

```json
{
  "name": "@editorx/toolbar",
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
    "@editorx/ui": "workspace:^",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@editorx/theme": "workspace:*",
    "@editorx/ui": "workspace:*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "dependencies": {
    "lucide-react": "^1.53.0"
  }
}
```

`packages/toolbar/tsconfig.json`：

```json
{
  "extends": "../../tooling/tsconfig.base.json",
  "include": ["src", "vitest.config.ts", "tsup.config.ts", "../../tooling/test/setup-dom.ts"]
}
```

`packages/toolbar/tsup.config.ts`（与 ui 相同）：

```ts
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

const packageDir = fileURLToPath(new URL('.', import.meta.url))
const copyCssScript = fileURLToPath(new URL('../../tooling/copy-css.mjs', import.meta.url))

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: "'use client';" },
  // tsup's string onSuccess cannot pass arguments on Windows, so spawn node directly
  onSuccess: async () => {
    execFileSync(process.execPath, [copyCssScript], { cwd: packageDir, stdio: 'inherit' })
  },
})
```

`packages/toolbar/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
    restoreMocks: true,
  },
})
```

`packages/toolbar/src/cx.ts`：

```ts
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}
```

`packages/toolbar/src/styles.css`（Task 5 填充）：

```css
/* @editorx/toolbar：工具栏样式（Task 5） */
```

Run: `pnpm install`
Expected: 成功，`packages/toolbar/node_modules/@editorx/{theme,ui}` 为工作区链接。

- [ ] **Step 2: 写失败测试**

`packages/toolbar/src/messages.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatMessage, mergeMessages, zhCN } from './messages'
import { MessagesProvider, useMessages } from './messages-context'

function Probe() {
  const m = useMessages()
  return <span data-testid="probe">{`${m.toolbar.bold}|${m.modes.split}|${m.status.saved}`}</span>
}

describe('Messages', () => {
  it('默认中文文案', () => {
    expect(zhCN.toolbar.bold).toBe('加粗')
    expect(zhCN.modes).toMatchObject({ edit: 'Markdown', split: '比对', preview: '预览' })
    expect(zhCN.syntax.items.length).toBeGreaterThan(5)
  })

  it('mergeMessages 深合并，未覆盖的键保留默认，数组整体替换', () => {
    const merged = mergeMessages(zhCN, { toolbar: { bold: 'Bold' }, syntax: { items: [['A', 'a']] } })
    expect(merged.toolbar.bold).toBe('Bold')
    expect(merged.toolbar.italic).toBe('斜体')
    expect(merged.syntax.items).toEqual([['A', 'a']])
    expect(zhCN.toolbar.bold).toBe('加粗')
  })

  it('formatMessage 替换 {name} 占位，未知占位保持原样', () => {
    expect(formatMessage('扩展 {name} 出错：{message}', { name: 'demo', message: 'boom' })).toBe('扩展 demo 出错：boom')
    expect(formatMessage('{a}-{b}', { a: 1 })).toBe('1-{b}')
  })

  it('无 Provider 时 useMessages 返回 zhCN；嵌套 Provider 逐层叠加', () => {
    const { unmount } = render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('加粗|比对|文章已保存')
    unmount()
    render(
      <MessagesProvider messages={{ toolbar: { bold: 'Bold' } }}>
        <MessagesProvider messages={{ modes: { split: 'Split' } }}>
          <Probe />
        </MessagesProvider>
      </MessagesProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('Bold|Split|文章已保存')
  })
})
```

`packages/toolbar/src/dist.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dist = path.join(import.meta.dirname, '..', 'dist', 'index.js')

// 需要先执行 build；turbo 的 test 任务依赖自身 build，直接运行 vitest 且无 dist 时跳过
describe.skipIf(!existsSync(dist))('构建产物 directive（需先 build）', () => {
  it("dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })
})
```

Run: `pnpm --filter @editorx/toolbar exec vitest run`
Expected: FAIL —— `./messages`、`./messages-context` 不存在。

- [ ] **Step 3: 实现**

`packages/toolbar/src/types.ts`：

```ts
export type EditorType = 'markdown' | 'richtext'

export interface EditorDocument {
  editorType: EditorType
  title: string
  markdown?: string
  html: string
}

export interface Category {
  id: string
  name: string
}

export interface VoteInput {
  title: string
  options: string[]
  multiple: boolean
  /** ISO 时间 */
  deadline?: string
}

export interface Resource {
  id: string
  title: string
  url: string
  description?: string
}

export interface Template {
  id: string
  name: string
  markdown?: string
  html?: string
}

/** 字段对应 CSDN「发布文章」表单（spec §6.3）；校验规则在阶段 4 定义 */
export interface PublishSettings {
  tags: string[]
  cover: { mode: 'single' | 'triple' | 'none'; urls: string[] }
  summary: string
  categories: string[]
  articleType: 'original' | 'reprint' | 'translated'
  sourceUrl?: string
  visibility: 'public' | 'private' | 'fans' | 'vip'
  scheduledAt?: string
}

export type PublishPayload = EditorDocument & PublishSettings

export interface EditorAdapters {
  uploadImage?(file: File, onProgress?: (p: number) => void): Promise<{ url: string }>
  onSaveDraft?(doc: EditorDocument): Promise<void>
  onPublish?(payload: PublishPayload): Promise<void>
  searchTags?(keyword: string): Promise<string[]>
  getCategories?(): Promise<Category[]>
  aiAssist?(prompt: string, ctx: { selection: string; document: EditorDocument }): AsyncIterable<string>
  createVote?(data: VoteInput): Promise<{ id: string }>
  uploadVideo?(file: File, onProgress?: (p: number) => void): Promise<{ url: string; cover?: string }>
  searchResources?(keyword: string): Promise<Resource[]>
  runCode?(lang: string, code: string): Promise<{ url: string }>
  getTemplates?(): Promise<Template[]>
}

export type AdapterName = keyof EditorAdapters
```

`packages/toolbar/src/messages.ts`：

```ts
type SyntaxItem = [title: string, example: string]

const syntaxItems: SyntaxItem[] = [
  ['标题', '# 一级标题\n## 二级标题'],
  ['加粗 / 斜体', '**加粗** *斜体*'],
  ['删除线 / 高亮', '~~删除~~ ==高亮=='],
  ['上标 / 下标', 'x^2^ H~2~O'],
  ['链接 / 图片', '[链接](https://)\n![图片](https://)'],
  ['列表', '- 无序\n1. 有序\n- [ ] 待办'],
  ['引用', '> 引用内容'],
  ['代码', '`行内代码`\n```js\nconsole.log(1)\n```'],
  ['表格', '| 列1 | 列2 |\n| --- | --- |\n| a | b |'],
  ['公式', '$E=mc^2$\n$$\n\\sum_{i=1}^n i\n$$'],
  ['目录', '@[TOC](目录标题)'],
  ['脚注', '正文[^1]\n[^1]: 脚注内容'],
  ['流程图', '```mermaid\nflowchart LR\n  A --> B\n```'],
]

export const zhCN = {
  toolbar: {
    label: '编辑工具栏',
    more: '更多',
    bold: '加粗',
    italic: '斜体',
    heading: '标题',
    heading1: '一级标题',
    heading2: '二级标题',
    heading3: '三级标题',
    heading4: '四级标题',
    heading5: '五级标题',
    heading6: '六级标题',
    strikethrough: '删除线',
    list: '列表',
    unorderedList: '无序列表',
    orderedList: '有序列表',
    taskList: '待办列表',
    code: '代码块',
    codeBlock: '代码块',
    inlineCode: '行内代码',
    moreFormat: '更多格式',
    quote: '引用',
    hr: '分割线',
    mark: '高亮',
    superscript: '上标',
    subscript: '下标',
    image: '图片',
    link: '链接',
    moreInsert: '更多插入',
    table: '表格',
    mathBlock: '公式',
    mathInline: '行内公式',
    toc: '目录',
    mermaidFlowchart: '流程图',
    mermaidSequence: '时序图',
    mermaidGantt: '甘特图',
    mermaidClass: '类图',
    moreActions: '更多操作',
    importFile: '导入文件',
    exportMarkdown: '导出为 Markdown',
    exportHtml: '导出为 HTML',
    syntax: '语法说明',
    fullscreen: '全屏',
    untitled: '未命名',
  },
  dialog: {
    confirm: '确定',
    cancel: '取消',
    close: '关闭',
    linkText: '链接文本',
    linkUrl: '链接地址',
    imageUrl: '图片地址',
    imageAlt: '图片描述',
    imageUpload: '本地上传',
    tableRows: '行数',
    tableCols: '列数',
  },
  modes: {
    label: '视图模式',
    edit: 'Markdown',
    split: '比对',
    preview: '预览',
  },
  theme: {
    toLight: '切换到明亮模式',
    toDark: '切换到暗黑模式',
  },
  status: {
    label: '状态栏',
    markdown: 'Markdown',
    html: 'HTML',
    words: '字数',
    lines: '行数',
    paragraphs: '段落',
    line: '当前行',
    column: '当前列',
    saving: '保存中…',
    saved: '文章已保存',
    saveFailed: '保存失败',
  },
  panels: {
    rail: '侧边栏',
    collapse: '收起',
    expand: '展开',
    toc: '目录',
    tocEmpty: '为文内增加标题，这里将生成目录',
    syntax: '语法',
  },
  upload: {
    uploading: '上传中...',
    failed: '上传失败',
    failedList: '上传失败的图片',
    failedItem: '{name} 上传失败',
    retry: '重试',
    remove: '删除',
    notImage: '仅支持上传图片文件',
    noAdapter: '未配置图片上传',
    error: '图片 {name} 上传失败：{message}',
  },
  editor: {
    ariaLabel: 'Markdown 编辑区',
    previewLabel: '预览区',
    splitter: '调整编辑区与预览区宽度',
  },
  errors: {
    extension: '扩展 {name} 出错：{message}',
    import: '导入失败：{message}',
    save: '保存失败：{message}',
  },
  syntax: {
    items: syntaxItems,
  },
}

export type Messages = typeof zhCN

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeDeep(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] = isPlainObject(current) && isPlainObject(value) ? mergeDeep(current, value) : value
  }
  return out
}

export function mergeMessages(base: Messages, override?: DeepPartial<Messages>): Messages {
  if (!override) return base
  return mergeDeep(base as unknown as Record<string, unknown>, override as Record<string, unknown>) as unknown as Messages
}

export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

`packages/toolbar/src/messages-context.tsx`：

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { mergeMessages, zhCN, type DeepPartial, type Messages } from './messages'

const MessagesContext = createContext<Messages>(zhCN)

export interface MessagesProviderProps {
  /** 覆盖部分或全部文案，叠加在外层 Provider（默认 zhCN）之上 */
  messages?: DeepPartial<Messages>
  children: ReactNode
}

export function MessagesProvider({ messages, children }: MessagesProviderProps) {
  const parent = useContext(MessagesContext)
  const value = useMemo(() => mergeMessages(parent, messages), [parent, messages])
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export function useMessages(): Messages {
  return useContext(MessagesContext)
}
```

`packages/toolbar/src/index.ts`（Task 4、5 继续追加）：

```ts
export type {
  AdapterName,
  Category,
  EditorAdapters,
  EditorDocument,
  EditorType,
  PublishPayload,
  PublishSettings,
  Resource,
  Template,
  VoteInput,
} from './types'
export { errorMessage, formatMessage, mergeMessages, zhCN } from './messages'
export type { DeepPartial, Messages } from './messages'
export { MessagesProvider, useMessages } from './messages-context'
export type { MessagesProviderProps } from './messages-context'
```

- [ ] **Step 4: 运行测试确认通过 + 构建**

Run: `pnpm --filter @editorx/toolbar exec vitest run`
Expected: `messages.test.tsx` 4 个用例 PASS；`dist.test.ts` 因无 dist 跳过。

Run: `pnpm --filter @editorx/toolbar build; pnpm --filter @editorx/toolbar exec vitest run; pnpm --filter @editorx/toolbar typecheck`
Expected: 构建生成 `dist/index.js`（首行 `'use client';`）、`dist/index.d.ts`、`dist/styles.css`；`dist.test.ts` PASS；类型检查无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/toolbar/package.json
git add packages/toolbar/tsconfig.json
git add packages/toolbar/tsup.config.ts
git add packages/toolbar/vitest.config.ts
git add packages/toolbar/src/index.ts
git add packages/toolbar/src/types.ts
git add packages/toolbar/src/messages.ts
git add packages/toolbar/src/messages-context.tsx
git add packages/toolbar/src/cx.ts
git add packages/toolbar/src/styles.css
git add packages/toolbar/src/messages.test.tsx
git add packages/toolbar/src/dist.test.ts
git add pnpm-lock.yaml
git commit -m "feat(toolbar): 新建 @editorx/toolbar 包与共享类型、文案字典" -m "定义 EditorType/EditorDocument/EditorAdapters/PublishSettings 等跨编辑器共享类型（spec §5.1、§6.3）。" -m "新增默认 zhCN 文案字典、DeepPartial 覆盖与 mergeMessages/formatMessage，MessagesProvider 逐层叠加父级文案。" -m "React 包产物首行 'use client'，theme/ui 为 peerDependency。"
```

---

### Task 4: 扩展协议与纯逻辑：布局解析、面板解析、快捷键、溢出计算

**Files:**
- Create: `packages/toolbar/src/extension.ts`、`src/layout.ts`、`src/shortcuts.ts`、`src/item-state.ts`
- Modify: `packages/toolbar/src/index.ts`
- Test: `packages/toolbar/src/layout.test.ts`、`packages/toolbar/src/shortcuts.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `Messages`、`EditorAdapters`、`EditorType`、`EditorDocument`。
- Produces:
  ```ts
  type MessageText = string | ((m: Messages) => string)
  interface ItemBase { id; title: MessageText; icon?; label?: MessageText; group?; order?; active?: string | ((ctx) => boolean); disabled?: (ctx) => boolean; allowReadOnly?: boolean; requires?: readonly AdapterName[] }
  type ToolbarItem = ToolbarButton(+shortcut, run) | ToolbarDropdown(items) | ToolbarPopover(render) | ToolbarModal(render, width?) | ToolbarSeparator
  interface PanelDef { id; title: MessageText; icon?; position: 'right' | 'bottom'; order?; render(ctx) }
  interface ExtensionContext { editorType; insert; insertEmbed; getSelectionText; replaceSelection; replaceDocument; getDocument; commands; adapters; openPanel; closePanel; togglePanel; activePanel; uploadImages; focus; notify; theme; locale; readOnly; formats }
  interface EditorExtension { name; editors?; requires?; toolbar?; shortcuts?; panels?; embeds?; setup? }
  type ToolbarLayout = ReadonlyArray<string | readonly string[]>   // '*' = 其余全部
  resolveToolbar(extensions, layout | undefined, { editorType, adapters, missingAdapter? }): ResolvedGroup[]
  resolvePanels(extensions, options): ResolvedPanel[]
  flattenChildren(children): ResolvedChild[]; overflowChildren(groups): ResolvedChild[]
  fitGroups(widths, available, dividerWidth, moreWidth): number
  parseShortcut / normalizeShortcut / matchShortcut / formatShortcut / isMacPlatform / collectShortcuts / handleShortcut
  isItemActive(resolved, ctx) / isItemDisabled(resolved, ctx, readOnly)
  ```
  规则：后注册的同名扩展替换先前的（保留原位置）；同 id 条目后者替换前者（保留原位置）；布局中未知 id 跳过、重复 id 只取首次；`'*'` 展开为剩余条目，按 `group` 首次出现顺序分组、组内按 `order`（稳定）排序；`layout` 缺省等同 `['*']`；`missingAdapter` 默认 `hide`（扩展级或条目级 `requires` 缺失则隐藏），`disable` 时显示为禁用；空的 dropdown 隐藏。

- [ ] **Step 1: 写失败测试**

`packages/toolbar/src/layout.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import type { EditorExtension, ToolbarItem } from './extension'
import {
  fitGroups,
  flattenChildren,
  isSeparator,
  overflowChildren,
  resolvePanels,
  resolveToolbar,
  type ResolvedChild,
  type ResolvedGroup,
} from './layout'

const noop = () => {}
const button = (id: string, extra: Partial<Extract<ToolbarItem, { type: 'button' }>> = {}): ToolbarItem => ({
  type: 'button',
  id,
  title: id,
  run: noop,
  ...extra,
})
const ids = (groups: readonly ResolvedGroup[]) => groups.map((g) => g.map((r) => r.item.id))
const childIds = (children: readonly ResolvedChild[]) => children.map((c) => (isSeparator(c) ? '|' : c.item.id))
const md = { editorType: 'markdown' as const, adapters: {} }

describe('resolveToolbar', () => {
  const core: EditorExtension = { name: 'core', toolbar: [button('bold'), button('italic'), button('link')] }

  it('按布局分组，未知 id 跳过，重复 id 只取首次，空组丢弃', () => {
    expect(ids(resolveToolbar([core], [['bold', 'nope'], ['italic', 'bold'], ['ghost'], 'link'], md))).toEqual([
      ['bold'],
      ['italic'],
      ['link'],
    ])
  })

  it("'*' 展开剩余条目：按 group 首次出现分组、组内按 order 稳定排序；缺省布局等同 ['*']", () => {
    const ext: EditorExtension = {
      name: 'x',
      toolbar: [
        button('a', { group: 'g1', order: 2 }),
        button('b', { group: 'g2' }),
        button('c', { group: 'g1', order: 1 }),
        button('d', { group: 'g1', order: 1 }),
      ],
    }
    expect(ids(resolveToolbar([core, ext], [['bold'], '*'], md))).toEqual([['bold'], ['italic', 'link'], ['c', 'd', 'a'], ['b']])
    expect(ids(resolveToolbar([ext], undefined, md))).toEqual([['c', 'd', 'a'], ['b']])
  })

  it('同名扩展后者替换前者；同 id 条目后者替换前者且保留位置', () => {
    const replacement: EditorExtension = { name: 'core', toolbar: [button('italic', { title: '新斜体' })] }
    expect(ids(resolveToolbar([core, replacement], undefined, md))).toEqual([['italic']])
    const override: EditorExtension = { name: 'mine', toolbar: [button('bold', { title: '新加粗' })] }
    const groups = resolveToolbar([core, override], undefined, md)
    expect(ids(groups)).toEqual([['bold', 'italic', 'link']])
    expect(groups[0]![0]!.item.title).toBe('新加粗')
    expect(groups[0]![0]!.extension).toBe('mine')
  })

  it('editors 不含当前编辑器的扩展被忽略', () => {
    const rich: EditorExtension = { name: 'rich', editors: ['richtext'], toolbar: [button('video')] }
    expect(ids(resolveToolbar([rich], undefined, md))).toEqual([])
  })

  it('缺失 adapter：默认隐藏（扩展级与条目级），disable 时标记 disabledByAdapter', () => {
    const exts: EditorExtension[] = [
      { name: 'upload', requires: ['uploadImage'], toolbar: [button('img')] },
      { name: 'mixed', toolbar: [button('tpl', { requires: ['getTemplates'] }), button('plain')] },
    ]
    expect(ids(resolveToolbar(exts, undefined, md))).toEqual([['plain']])
    const disabled = resolveToolbar(exts, undefined, { ...md, missingAdapter: 'disable' })
    expect(disabled.flat().map((r) => [r.item.id, r.disabledByAdapter])).toEqual([
      ['img', true],
      ['tpl', true],
      ['plain', false],
    ])
    const provided = resolveToolbar(exts, undefined, { ...md, adapters: { uploadImage: async () => ({ url: '' }) } })
    expect(ids(provided)).toEqual([['img', 'plain']])
  })

  it('dropdown 子项按 adapter 过滤，修剪多余分隔线；无子项的 dropdown 隐藏', () => {
    const ext: EditorExtension = {
      name: 'menu',
      toolbar: [
        {
          type: 'dropdown',
          id: 'insert',
          title: '插入',
          items: [
            { type: 'separator' },
            button('table'),
            { type: 'separator' },
            button('video', { requires: ['uploadVideo'] }),
            { type: 'separator' },
          ],
        },
        { type: 'dropdown', id: 'empty', title: '空', items: [button('v2', { requires: ['uploadVideo'] })] },
      ],
    }
    const [group] = resolveToolbar([ext], undefined, md)
    expect(group!.map((r) => r.item.id)).toEqual(['insert'])
    expect(childIds(group![0]!.children!)).toEqual(['table'])
  })
})

describe('flattenChildren / overflowChildren', () => {
  it('嵌套 dropdown 展平为分隔线包围的子项', () => {
    const ext: EditorExtension = {
      name: 'm',
      toolbar: [
        {
          type: 'dropdown',
          id: 'outer',
          title: 'outer',
          items: [button('a'), { type: 'dropdown', id: 'inner', title: 'inner', items: [button('b'), button('c')] }],
        },
      ],
    }
    const [group] = resolveToolbar([ext], undefined, md)
    expect(childIds(flattenChildren(group![0]!.children!))).toEqual(['a', '|', 'b', 'c'])
  })

  it('溢出的多个分组之间插入分隔线，dropdown 被展开', () => {
    const ext: EditorExtension = {
      name: 'm',
      toolbar: [
        button('a', { group: '1' }),
        { type: 'dropdown', id: 'd', title: 'd', group: '2', items: [button('x'), button('y')] },
        button('z', { group: '2' }),
      ],
    }
    const groups = resolveToolbar([ext], undefined, md)
    expect(childIds(flattenChildren(overflowChildren(groups)))).toEqual(['a', '|', 'x', 'y', '|', 'z'])
  })
})

describe('fitGroups', () => {
  it('全部放得下时返回总数；否则为「更多」按钮预留空间', () => {
    expect(fitGroups([100, 100, 100], 400, 17, 49)).toBe(3)
    expect(fitGroups([100, 100, 100], 250, 17, 49)).toBe(1)
    expect(fitGroups([100, 100, 100], 300, 17, 49)).toBe(2)
    expect(fitGroups([100], 10, 17, 49)).toBe(0)
  })
})

describe('resolvePanels', () => {
  it('按 order 稳定排序；同 id 后者替换；缺 adapter 的扩展不提供面板', () => {
    const render = () => null
    const panels = resolvePanels(
      [
        { name: 'a', panels: [{ id: 'toc', title: '目录', position: 'right', order: 20, render }] },
        { name: 'b', panels: [{ id: 'ai', title: 'AI', position: 'right', order: 10, render }] },
        { name: 'c', requires: ['aiAssist'], panels: [{ id: 'gpt', title: 'GPT', position: 'right', render }] },
        { name: 'd', panels: [{ id: 'toc', title: '新目录', position: 'right', order: 20, render }] },
      ],
      md,
    )
    expect(panels.map((p) => [p.panel.id, p.extension])).toEqual([
      ['ai', 'b'],
      ['toc', 'd'],
    ])
  })
})
```

`packages/toolbar/src/shortcuts.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import type { EditorExtension, ExtensionContext } from './extension'
import {
  collectShortcuts,
  formatShortcut,
  handleShortcut,
  isMacPlatform,
  matchShortcut,
  normalizeShortcut,
  parseShortcut,
} from './shortcuts'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { cancelable: true, ...init })
const ctx = (readOnly = false) => ({ readOnly }) as ExtensionContext
const md = { editorType: 'markdown' as const, adapters: {} }

describe('parse / normalize / format', () => {
  it('解析修饰键，大小写不敏感，未知修饰键抛错', () => {
    expect(parseShortcut('Mod-Shift-K')).toEqual({ mod: true, ctrl: false, meta: false, alt: false, shift: true, key: 'k' })
    expect(normalizeShortcut(parseShortcut('shift-mod-k'))).toBe('mod-shift-k')
    expect(() => parseShortcut('Hyper-K')).toThrow('Hyper')
  })

  it('Windows 显示 Ctrl+Shift+K，mac 显示 ⇧⌘K', () => {
    expect(formatShortcut('Mod-Shift-K', false)).toBe('Ctrl+Shift+K')
    expect(formatShortcut('Mod-Shift-K', true)).toBe('⇧⌘K')
    expect(formatShortcut('Alt-Enter', false)).toBe('Alt+Enter')
  })

  it('isMacPlatform 读取 navigator.platform', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    expect(isMacPlatform()).toBe(true)
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    expect(isMacPlatform()).toBe(false)
  })
})

describe('matchShortcut', () => {
  it('Mod 在 mac 上是 Meta、其他平台是 Ctrl；修饰键需完全一致', () => {
    const p = parseShortcut('Mod-B')
    expect(matchShortcut(p, key({ key: 'b', ctrlKey: true }), false)).toBe(true)
    expect(matchShortcut(p, key({ key: 'b', metaKey: true }), true)).toBe(true)
    expect(matchShortcut(p, key({ key: 'b', metaKey: true }), false)).toBe(false)
    expect(matchShortcut(p, key({ key: 'b', ctrlKey: true, shiftKey: true }), false)).toBe(false)
  })

  it('Shift 产生大写或符号时按 key / code 回退匹配', () => {
    expect(matchShortcut(parseShortcut('Mod-Shift-K'), key({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }), false)).toBe(true)
    expect(matchShortcut(parseShortcut('Mod-Shift-1'), key({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true }), false)).toBe(true)
  })
})

describe('collectShortcuts / handleShortcut', () => {
  const run = vi.fn()
  const exts: EditorExtension[] = [
    {
      name: 'core',
      toolbar: [
        { type: 'button', id: 'bold', title: '加粗', shortcut: 'Mod-B', run },
        {
          type: 'dropdown',
          id: 'list',
          title: '列表',
          items: [{ type: 'button', id: 'ol', title: '有序', shortcut: 'Mod-Shift-O', run }],
        },
        { type: 'button', id: 'view', title: '查看', shortcut: 'Mod-Shift-V', allowReadOnly: true, run },
        { type: 'button', id: 'off', title: '禁用', shortcut: 'Mod-Shift-D', disabled: () => true, run },
      ],
      shortcuts: { 'Mod-Shift-H': run },
    },
  ]

  it('收集按钮（含 dropdown 子项）与 shortcuts 映射，后注册覆盖先注册', () => {
    const later: EditorExtension = { name: 'mine', shortcuts: { 'mod-b': vi.fn() } }
    const bindings = collectShortcuts([...exts, later], md)
    expect(bindings.map((b) => normalizeShortcut(b.parsed)).sort()).toEqual(
      ['mod-b', 'mod-shift-d', 'mod-shift-h', 'mod-shift-o', 'mod-shift-v'].sort(),
    )
    expect(bindings.find((b) => b.key === 'mod-b')!.extension).toBe('mine')
  })

  it('命中则 preventDefault 并执行；已被处理、输入法组合中、未命中都不处理', () => {
    run.mockClear()
    const bindings = collectShortcuts(exts, md)
    const onError = vi.fn()
    const hit = key({ key: 'o', ctrlKey: true, shiftKey: true })
    expect(handleShortcut(hit, bindings, ctx(), false, onError)).toBe(true)
    expect(hit.defaultPrevented).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    const handled = key({ key: 'b', ctrlKey: true })
    handled.preventDefault()
    expect(handleShortcut(handled, bindings, ctx(), false, onError)).toBe(false)
    expect(handleShortcut(key({ key: 'b', ctrlKey: true, isComposing: true }), bindings, ctx(), false, onError)).toBe(false)
    expect(handleShortcut(key({ key: 'q', ctrlKey: true }), bindings, ctx(), false, onError)).toBe(false)
  })

  it('只读时只执行 allowReadOnly 项；disabled() 为真时不执行；仍 preventDefault', () => {
    run.mockClear()
    const bindings = collectShortcuts(exts, md)
    const blocked = key({ key: 'b', ctrlKey: true })
    expect(handleShortcut(blocked, bindings, ctx(true), false, vi.fn())).toBe(true)
    expect(blocked.defaultPrevented).toBe(true)
    expect(run).not.toHaveBeenCalled()
    handleShortcut(key({ key: 'v', ctrlKey: true, shiftKey: true }), bindings, ctx(true), false, vi.fn())
    expect(run).toHaveBeenCalledTimes(1)
    handleShortcut(key({ key: 'd', ctrlKey: true, shiftKey: true }), bindings, ctx(), false, vi.fn())
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('run 抛错交给 onError，不向外抛', () => {
    const boom: EditorExtension = { name: 'boom', shortcuts: { 'Mod-K': () => { throw new Error('x') } } }
    const onError = vi.fn()
    expect(() => handleShortcut(key({ key: 'k', ctrlKey: true }), collectShortcuts([boom], md), ctx(), false, onError)).not.toThrow()
    expect(onError).toHaveBeenCalledWith('boom', expect.any(Error))
  })

  it('缺 adapter：默认不收集；disable 策略下收集但不执行', () => {
    run.mockClear()
    const needs: EditorExtension = { name: 'up', requires: ['uploadImage'], shortcuts: { 'Mod-U': run } }
    expect(collectShortcuts([needs], md)).toEqual([])
    const bindings = collectShortcuts([needs], { ...md, missingAdapter: 'disable' })
    expect(handleShortcut(key({ key: 'u', ctrlKey: true }), bindings, ctx(), false, vi.fn())).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })
})
```

Run: `pnpm --filter @editorx/toolbar exec vitest run`
Expected: FAIL —— `./extension`、`./layout`、`./shortcuts` 不存在。

- [ ] **Step 2: 实现**

`packages/toolbar/src/extension.ts`：

```ts
import type { ReactNode } from 'react'
import type { Messages } from './messages'
import type { AdapterName, EditorAdapters, EditorDocument, EditorType } from './types'

/** 静态文案或从当前 Messages 取值的函数 */
export type MessageText = string | ((messages: Messages) => string)
export type NotifyType = 'info' | 'success' | 'warning' | 'error'

interface ItemBase {
  id: string
  title: MessageText
  icon?: ReactNode
  /** 按钮上显示的文字（如「列表」）；不设置时只显示图标，title 作为无障碍名称 */
  label?: MessageText
  /** 布局 '*' 展开时用于分组与排序 */
  group?: string
  order?: number
  /** 字符串为 ctx.formats 中的格式键；函数在 render 期间求值 */
  active?: string | ((ctx: ExtensionContext) => boolean)
  disabled?: (ctx: ExtensionContext) => boolean
  /** 只读时仍可用（导出、全屏等） */
  allowReadOnly?: boolean
  requires?: readonly AdapterName[]
}

export interface ToolbarButton extends ItemBase {
  type: 'button'
  /** 如 'Mod-B'、'Mod-Shift-K'；Mod 在 mac 上为 ⌘，其他平台为 Ctrl */
  shortcut?: string
  run(ctx: ExtensionContext): void
}

export interface ToolbarDropdown extends ItemBase {
  type: 'dropdown'
  items: readonly ToolbarItem[]
}

export interface ToolbarPopover extends ItemBase {
  type: 'popover'
  render(ctx: ExtensionContext, close: () => void): ReactNode
}

export interface ToolbarModal extends ItemBase {
  type: 'modal'
  width?: number | string
  render(ctx: ExtensionContext, close: () => void): ReactNode
}

export interface ToolbarSeparator {
  type: 'separator'
  id?: string
}

export type ToolbarItem = ToolbarButton | ToolbarDropdown | ToolbarPopover | ToolbarModal | ToolbarSeparator
export type ToolbarActionItem = Exclude<ToolbarItem, ToolbarSeparator>

export interface PanelDef {
  id: string
  title: MessageText
  icon?: ReactNode
  position: 'right' | 'bottom'
  order?: number
  render(ctx: ExtensionContext): ReactNode
}

/** 与 markdown-core 的 EmbedDef 结构一致（不依赖 markdown-core） */
export interface EmbedDef {
  type: string
  renderHtml(payload: unknown): string
}

export interface CommandRegistry {
  has(name: string): boolean
  /** 未注册返回 false */
  run(name: string, args?: unknown): boolean
  list(): string[]
}

export interface InsertContent {
  markdown?: string
  html?: string
}

/** 编辑器提供给扩展的能力；对象引用稳定，带 get 的属性始终返回最新值 */
export interface ExtensionContext {
  readonly editorType: EditorType
  /** 在选区末尾插入，不删除选中文本 */
  insert(content: InsertContent): void
  /** 以独立块插入嵌入卡片（Markdown：```ex-embed:<type> 围栏 + JSON） */
  insertEmbed(type: string, payload: unknown): void
  getSelectionText(): string
  replaceSelection(content: InsertContent): void
  /** 整体替换文档（可撤销），用于导入/模板 */
  replaceDocument(content: InsertContent): void
  getDocument(): EditorDocument
  readonly commands: CommandRegistry
  readonly adapters: EditorAdapters
  openPanel(id: string): void
  closePanel(id: string): void
  togglePanel(id: string): void
  readonly activePanel: string | null
  /** 走编辑器的上传流程（占位符、失败重试） */
  uploadImages(files: readonly File[]): Promise<void>
  focus(): void
  notify(message: string, type?: NotifyType): void
  readonly theme: 'light' | 'dark'
  readonly locale: Messages
  readonly readOnly: boolean
  /** 光标处的格式键（bold、heading2、orderedList…） */
  readonly formats: ReadonlySet<string>
}

export type ExtensionShortcut = (ctx: ExtensionContext) => void

export interface EditorExtension {
  /** 唯一；同名的后注册扩展替换先注册的 */
  name: string
  editors?: readonly EditorType[]
  requires?: readonly AdapterName[]
  toolbar?: readonly ToolbarItem[]
  shortcuts?: Readonly<Record<string, ExtensionShortcut>>
  panels?: readonly PanelDef[]
  embeds?: readonly EmbedDef[]
  setup?(ctx: ExtensionContext): void | (() => void)
}

/** 分组的 id 列表；字符串为单项一组，'*' 为其余全部条目 */
export type ToolbarLayout = ReadonlyArray<string | readonly string[]>
export type MissingAdapterPolicy = 'hide' | 'disable'

export function resolveText(text: MessageText, messages: Messages): string {
  return typeof text === 'function' ? text(messages) : text
}
```

`packages/toolbar/src/layout.ts`：

```ts
import type {
  EditorExtension,
  MissingAdapterPolicy,
  PanelDef,
  ToolbarActionItem,
  ToolbarLayout,
} from './extension'
import type { AdapterName, EditorAdapters, EditorType } from './types'

export interface ResolveOptions {
  editorType: EditorType
  adapters: EditorAdapters
  missingAdapter?: MissingAdapterPolicy
}

export interface ResolvedItem {
  item: ToolbarActionItem
  extension: string
  disabledByAdapter: boolean
  /** 仅 dropdown：按 adapter 过滤并修剪分隔线后的子项 */
  children?: ResolvedChild[]
}
export interface ResolvedSeparator {
  separator: true
  key: string
}
export type ResolvedChild = ResolvedItem | ResolvedSeparator
export type ResolvedGroup = readonly ResolvedItem[]

export interface ResolvedPanel {
  panel: PanelDef
  extension: string
}

export function isSeparator(child: ResolvedChild): child is ResolvedSeparator {
  return 'separator' in child
}

export function activeExtensions(extensions: readonly EditorExtension[], editorType: EditorType): EditorExtension[] {
  const byName = new Map<string, EditorExtension>()
  for (const ext of extensions) {
    if (ext.editors && !ext.editors.includes(editorType)) continue
    byName.set(ext.name, ext)
  }
  return [...byName.values()]
}

export function hasMissingAdapter(requires: readonly AdapterName[] | undefined, adapters: EditorAdapters): boolean {
  return (requires ?? []).some((name) => typeof adapters[name] !== 'function')
}

/** null = 隐藏；true = 禁用；false = 可用 */
export function adapterState(requires: readonly AdapterName[] | undefined, options: ResolveOptions): boolean | null {
  if (!hasMissingAdapter(requires, options.adapters)) return false
  return (options.missingAdapter ?? 'hide') === 'hide' ? null : true
}

function trimSeparators(children: ResolvedChild[]): ResolvedChild[] {
  const out: ResolvedChild[] = []
  for (const child of children) {
    if (isSeparator(child) && (out.length === 0 || isSeparator(out[out.length - 1]!))) continue
    out.push(child)
  }
  while (out.length > 0 && isSeparator(out[out.length - 1]!)) out.pop()
  return out
}

function resolveItem(
  item: ToolbarActionItem,
  extension: string,
  inherited: boolean,
  options: ResolveOptions,
): ResolvedItem | null {
  const state = adapterState(item.requires, options)
  if (state === null) return null
  const disabledByAdapter = inherited || state
  if (item.type !== 'dropdown') return { item, extension, disabledByAdapter }
  const children: ResolvedChild[] = []
  item.items.forEach((child, index) => {
    if (child.type === 'separator') {
      children.push({ separator: true, key: child.id ?? `${item.id}:sep:${index}` })
      return
    }
    const resolved = resolveItem(child, extension, disabledByAdapter, options)
    if (resolved) children.push(resolved)
  })
  const trimmed = trimSeparators(children)
  if (!trimmed.some((child) => !isSeparator(child))) return null
  return { item, extension, disabledByAdapter, children: trimmed }
}

export function collectItems(extensions: readonly EditorExtension[], options: ResolveOptions): Map<string, ResolvedItem> {
  const items = new Map<string, ResolvedItem>()
  for (const ext of activeExtensions(extensions, options.editorType)) {
    const extState = adapterState(ext.requires, options)
    if (extState === null) continue
    for (const item of ext.toolbar ?? []) {
      if (item.type === 'separator') continue
      const resolved = resolveItem(item, ext.name, extState, options)
      if (resolved) items.set(item.id, resolved)
    }
  }
  return items
}

function sortByOrder<T>(list: readonly T[], order: (value: T) => number): T[] {
  return list
    .map((value, index) => ({ value, index }))
    .sort((a, b) => order(a.value) - order(b.value) || a.index - b.index)
    .map(({ value }) => value)
}

function restGroups(items: Map<string, ResolvedItem>, used: Set<string>): ResolvedItem[][] {
  const byGroup = new Map<string, ResolvedItem[]>()
  for (const [id, resolved] of items) {
    if (used.has(id)) continue
    used.add(id)
    const key = resolved.item.group ?? ''
    let list = byGroup.get(key)
    if (!list) {
      list = []
      byGroup.set(key, list)
    }
    list.push(resolved)
  }
  return [...byGroup.values()].map((list) => sortByOrder(list, (r) => r.item.order ?? 0))
}

export function resolveToolbar(
  extensions: readonly EditorExtension[],
  layout: ToolbarLayout | undefined,
  options: ResolveOptions,
): ResolvedGroup[] {
  const items = collectItems(extensions, options)
  const used = new Set<string>()
  const groups: ResolvedItem[][] = []
  for (const entry of layout ?? ['*']) {
    if (entry === '*') {
      groups.push(...restGroups(items, used))
      continue
    }
    const group: ResolvedItem[] = []
    for (const id of typeof entry === 'string' ? [entry] : entry) {
      const resolved = items.get(id)
      if (!resolved || used.has(id)) continue
      used.add(id)
      group.push(resolved)
    }
    if (group.length > 0) groups.push(group)
  }
  return groups
}

export function resolvePanels(extensions: readonly EditorExtension[], options: ResolveOptions): ResolvedPanel[] {
  const panels = new Map<string, ResolvedPanel>()
  for (const ext of activeExtensions(extensions, options.editorType)) {
    if (hasMissingAdapter(ext.requires, options.adapters)) continue
    for (const panel of ext.panels ?? []) panels.set(panel.id, { panel, extension: ext.name })
  }
  return sortByOrder([...panels.values()], (p) => p.panel.order ?? 0)
}

/** 嵌套 dropdown 展平为用分隔线包围的子项 */
export function flattenChildren(children: readonly ResolvedChild[]): ResolvedChild[] {
  const out: ResolvedChild[] = []
  for (const child of children) {
    if (!isSeparator(child) && child.item.type === 'dropdown') {
      out.push({ separator: true, key: `${child.item.id}:start` })
      out.push(...flattenChildren(child.children ?? []))
      out.push({ separator: true, key: `${child.item.id}:end` })
    } else {
      out.push(child)
    }
  }
  return trimSeparators(out)
}

/** 溢出分组合并为一个菜单的子项（组间分隔线） */
export function overflowChildren(groups: readonly ResolvedGroup[]): ResolvedChild[] {
  const out: ResolvedChild[] = []
  groups.forEach((group, index) => {
    if (index > 0) out.push({ separator: true, key: `overflow:${index}` })
    out.push(...group)
  })
  return out
}

/** 能完整显示的分组数；放不下全部时为「更多」按钮预留 dividerWidth + moreWidth */
export function fitGroups(widths: readonly number[], available: number, dividerWidth: number, moreWidth: number): number {
  const total = (count: number) =>
    widths.slice(0, count).reduce((sum, width) => sum + width, 0) + Math.max(0, count - 1) * dividerWidth
  if (total(widths.length) <= available) return widths.length
  let count = widths.length - 1
  while (count > 0 && total(count) + dividerWidth + moreWidth > available) count--
  return count
}
```

`packages/toolbar/src/shortcuts.ts`：

```ts
import type { EditorExtension, ExtensionContext, ExtensionShortcut, ToolbarButton, ToolbarItem } from './extension'
import { activeExtensions, adapterState, type ResolveOptions } from './layout'

export interface ParsedShortcut {
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
  /** 小写的 KeyboardEvent.key（字母/数字）或特殊键名（enter、arrowup…） */
  key: string
}

export interface ShortcutBinding {
  /** 归一化后的组合键，如 'mod-shift-k' */
  key: string
  parsed: ParsedShortcut
  extension: string
  run: ExtensionShortcut
  /** 来自工具栏按钮时用于 allowReadOnly / disabled 判断 */
  item?: ToolbarButton
  disabledByAdapter: boolean
}

export function parseShortcut(spec: string): ParsedShortcut {
  const parts = spec.split('-')
  const key = parts.pop()!.toLowerCase()
  const parsed: ParsedShortcut = { mod: false, ctrl: false, meta: false, alt: false, shift: false, key }
  for (const raw of parts) {
    const part = raw.toLowerCase()
    if (part === 'mod') parsed.mod = true
    else if (part === 'ctrl' || part === 'control') parsed.ctrl = true
    else if (part === 'meta' || part === 'cmd') parsed.meta = true
    else if (part === 'alt' || part === 'option') parsed.alt = true
    else if (part === 'shift') parsed.shift = true
    else throw new Error(`未知的快捷键修饰符：${raw}（${spec}）`)
  }
  return parsed
}

export function normalizeShortcut(p: ParsedShortcut): string {
  return [p.mod && 'mod', p.ctrl && 'ctrl', p.meta && 'meta', p.alt && 'alt', p.shift && 'shift', p.key]
    .filter(Boolean)
    .join('-')
}

function eventKey(e: KeyboardEvent): string {
  if (/^[a-z0-9]$/i.test(e.key)) return e.key.toLowerCase()
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase()
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5)
  return e.key.toLowerCase()
}

export function matchShortcut(p: ParsedShortcut, e: KeyboardEvent, mac: boolean): boolean {
  const wantCtrl = p.ctrl || (p.mod && !mac)
  const wantMeta = p.meta || (p.mod && mac)
  return (
    e.ctrlKey === wantCtrl &&
    e.metaKey === wantMeta &&
    e.altKey === p.alt &&
    e.shiftKey === p.shift &&
    eventKey(e) === p.key
  )
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  return /mac|iphone|ipad|ipod/i.test(data?.platform || navigator.platform || '')
}

const KEY_LABELS: Record<string, string> = {
  enter: 'Enter',
  escape: 'Esc',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
}

export function formatShortcut(spec: string, mac: boolean): string {
  const p = parseShortcut(spec)
  const key = KEY_LABELS[p.key] ?? p.key.toUpperCase()
  if (mac) {
    return [p.ctrl && '⌃', p.alt && '⌥', p.shift && '⇧', (p.mod || p.meta) && '⌘', key].filter(Boolean).join('')
  }
  return [(p.mod || p.ctrl) && 'Ctrl', p.meta && 'Win', p.alt && 'Alt', p.shift && 'Shift', key].filter(Boolean).join('+')
}

export function collectShortcuts(extensions: readonly EditorExtension[], options: ResolveOptions): ShortcutBinding[] {
  const bindings = new Map<string, ShortcutBinding>()
  const add = (spec: string, binding: Omit<ShortcutBinding, 'key' | 'parsed'>) => {
    const parsed = parseShortcut(spec)
    const key = normalizeShortcut(parsed)
    bindings.set(key, { ...binding, key, parsed })
  }
  for (const ext of activeExtensions(extensions, options.editorType)) {
    const extState = adapterState(ext.requires, options)
    if (extState === null) continue
    const visit = (item: ToolbarItem, inherited: boolean) => {
      if (item.type === 'separator') return
      const state = adapterState(item.requires, options)
      if (state === null) return
      const disabledByAdapter = inherited || state
      if (item.type === 'dropdown') item.items.forEach((child) => visit(child, disabledByAdapter))
      else if (item.type === 'button' && item.shortcut) {
        add(item.shortcut, { extension: ext.name, run: item.run, item, disabledByAdapter })
      }
    }
    ext.toolbar?.forEach((item) => visit(item, extState))
    for (const [spec, run] of Object.entries(ext.shortcuts ?? {})) {
      add(spec, { extension: ext.name, run, disabledByAdapter: extState })
    }
  }
  return [...bindings.values()]
}

/** 命中返回 true（已 preventDefault）；扩展异常交给 onError */
export function handleShortcut(
  e: KeyboardEvent,
  bindings: readonly ShortcutBinding[],
  ctx: ExtensionContext,
  mac: boolean,
  onError: (extension: string, error: unknown) => void,
): boolean {
  if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return false
  const binding = bindings.find((b) => matchShortcut(b.parsed, e, mac))
  if (!binding) return false
  e.preventDefault()
  if (binding.disabledByAdapter) return true
  if (ctx.readOnly && !binding.item?.allowReadOnly) return true
  try {
    if (binding.item?.disabled?.(ctx)) return true
    binding.run(ctx)
  } catch (error) {
    onError(binding.extension, error)
  }
  return true
}
```

`packages/toolbar/src/item-state.ts`：

```ts
import type { ExtensionContext } from './extension'
import type { ResolvedItem } from './layout'

function evaluate(fn: () => boolean, extension: string): boolean {
  try {
    return fn()
  } catch (error) {
    console.error(`[editorx] 扩展 ${extension} 的状态计算出错`, error)
    return false
  }
}

export function isItemActive(resolved: ResolvedItem, ctx: ExtensionContext): boolean {
  const { active } = resolved.item
  if (active === undefined) return false
  if (typeof active === 'string') return ctx.formats.has(active)
  return evaluate(() => active(ctx), resolved.extension)
}

export function isItemDisabled(resolved: ResolvedItem, ctx: ExtensionContext, readOnly: boolean): boolean {
  if (resolved.disabledByAdapter) return true
  if (readOnly && !resolved.item.allowReadOnly) return true
  const { disabled } = resolved.item
  return disabled ? evaluate(() => disabled(ctx), resolved.extension) : false
}
```

`packages/toolbar/src/index.ts` 末尾追加：

```ts
export { resolveText } from './extension'
export type {
  CommandRegistry,
  EditorExtension,
  EmbedDef,
  ExtensionContext,
  ExtensionShortcut,
  InsertContent,
  MessageText,
  MissingAdapterPolicy,
  NotifyType,
  PanelDef,
  ToolbarActionItem,
  ToolbarButton,
  ToolbarDropdown,
  ToolbarItem,
  ToolbarLayout,
  ToolbarModal,
  ToolbarPopover,
  ToolbarSeparator,
} from './extension'
export {
  activeExtensions,
  fitGroups,
  flattenChildren,
  hasMissingAdapter,
  isSeparator,
  overflowChildren,
  resolvePanels,
  resolveToolbar,
} from './layout'
export type { ResolvedChild, ResolvedGroup, ResolvedItem, ResolvedPanel, ResolveOptions } from './layout'
export {
  collectShortcuts,
  formatShortcut,
  handleShortcut,
  isMacPlatform,
  matchShortcut,
  normalizeShortcut,
  parseShortcut,
} from './shortcuts'
export type { ParsedShortcut, ShortcutBinding } from './shortcuts'
export { isItemActive, isItemDisabled } from './item-state'
```

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm --filter @editorx/toolbar exec vitest run; pnpm --filter @editorx/toolbar typecheck`
Expected: `layout.test.ts`、`shortcuts.test.ts` 全部 PASS；类型检查无错误。

- [ ] **Step 4: 提交**

```powershell
git add packages/toolbar/src/extension.ts
git add packages/toolbar/src/layout.ts
git add packages/toolbar/src/shortcuts.ts
git add packages/toolbar/src/item-state.ts
git add packages/toolbar/src/index.ts
git add packages/toolbar/src/layout.test.ts
git add packages/toolbar/src/shortcuts.test.ts
git commit -m "feat(toolbar): 扩展协议、布局解析与快捷键" -m "定义 EditorExtension/ToolbarItem/PanelDef/ExtensionContext：条目支持 label、active（格式键或函数）、disabled、allowReadOnly、requires、shortcut。" -m "resolveToolbar 按分组 id 布局解析，'*' 展开其余条目（按 group 分组、order 稳定排序），同名扩展与同 id 条目后者替换并保留位置；缺失 adapter 按 hide/disable 策略处理。" -m "快捷键解析/匹配/格式化（Mod 适配 mac），collectShortcuts 汇总按钮与扩展快捷键，handleShortcut 处理只读、禁用、输入法与异常隔离；fitGroups 计算溢出。"
```

---

### Task 5: `<Toolbar>` 组件：分组/分隔、tooltip+快捷键、状态、溢出「更多」、弹层插槽、错误隔离、`useExtensionSetup`

**Files:**
- Create: `packages/toolbar/src/toolbar.tsx`、`src/error-boundary.tsx`、`src/use-extension-setup.ts`
- Modify: `packages/toolbar/src/styles.css`、`packages/toolbar/src/index.ts`
- Test: `packages/toolbar/src/toolbar.test.tsx`、`packages/toolbar/src/use-extension-setup.test.tsx`、`packages/toolbar/src/styles.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `Dropdown`/`Popover`/`Modal`/`Tooltip`；Task 4 的解析结果与状态函数。
- Produces:
  ```ts
  interface ToolbarProps {
    groups: readonly ResolvedGroup[]
    ctx: ExtensionContext
    readOnly?: boolean
    /** 变化时重新求值 active/disabled（memo 组件的刷新键） */
    stateKey?: string
    onError?(extension: string, error: unknown): void   // 默认 console.error + ctx.notify(errors.extension)
    ariaLabel?: string
    className?: string
  }
  const Toolbar: MemoExoticComponent<(props: ToolbarProps) => JSX.Element>
  class ExtensionErrorBoundary // props { name; onError; children }
  function useExtensionSetup(extensions, ctx, onError): void   // StrictMode 安全；扩展数组变化时整体重跑
  function useStableArray<T>(list: readonly T[]): readonly T[] // 元素逐个 === 时返回上一次引用
  ```
  DOM：`div[role=toolbar].ex-toolbar` > (`span.ex-toolbar__divider` + `div[role=group].ex-toolbar__group`)*，条目 `button.ex-toolbar__item`（`is-active`/`has-label`，`aria-pressed` 仅用于带 `active` 的 button），溢出分组加 `is-overflow` + `inert`，末尾 `button.ex-toolbar__more`。弹层内容渲染在 `.ex-portal`。

- [ ] **Step 1: 写失败测试**

`packages/toolbar/src/toolbar.test.tsx`：

```tsx
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@editorx/theme'
import { ToastProvider } from '@editorx/ui'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorExtension, ExtensionContext } from './extension'
import { resolveToolbar } from './layout'
import { zhCN } from './messages'
import { Toolbar } from './toolbar'

function makeCtx(over: Partial<ExtensionContext> = {}): ExtensionContext {
  return {
    editorType: 'markdown',
    insert: vi.fn(),
    insertEmbed: vi.fn(),
    getSelectionText: () => '',
    replaceSelection: vi.fn(),
    replaceDocument: vi.fn(),
    getDocument: () => ({ editorType: 'markdown', title: '', markdown: '', html: '' }),
    commands: { has: () => true, run: vi.fn(() => true), list: () => [] },
    adapters: {},
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    togglePanel: vi.fn(),
    activePanel: null,
    uploadImages: vi.fn(async () => {}),
    focus: vi.fn(),
    notify: vi.fn(),
    theme: 'light',
    locale: zhCN,
    readOnly: false,
    formats: new Set<string>(),
    ...over,
  }
}

const wrap = (ui: ReactNode) =>
  render(
    <ThemeProvider defaultTheme="light" storageKey={false}>
      <ToastProvider>{ui}</ToastProvider>
    </ThemeProvider>,
  )

const md = { editorType: 'markdown' as const, adapters: {} }

function setup(exts: EditorExtension[], layout?: (string | string[])[], ctx = makeCtx(), readOnly = false) {
  const groups = resolveToolbar(exts, layout, md)
  const utils = wrap(<Toolbar groups={groups} ctx={ctx} readOnly={readOnly} />)
  return { ...utils, ctx, groups }
}

const bold = vi.fn()
const core: EditorExtension = {
  name: 'core',
  toolbar: [
    { type: 'button', id: 'bold', title: (m) => m.toolbar.bold, icon: <b>B</b>, shortcut: 'Mod-B', active: 'bold', run: bold },
    { type: 'button', id: 'italic', title: '斜体', icon: <i>I</i>, run: vi.fn() },
    {
      type: 'dropdown',
      id: 'list',
      title: '列表',
      label: '列表',
      items: [
        { type: 'button', id: 'ol', title: '有序列表', shortcut: 'Mod-Shift-O', run: vi.fn() },
        { type: 'separator' },
        { type: 'button', id: 'ul', title: '无序列表', run: vi.fn() },
      ],
    },
    { type: 'modal', id: 'table', title: '表格', icon: <span>T</span>, render: (_ctx, close) => <button onClick={close}>插入</button> },
  ],
}

describe('Toolbar', () => {
  it('渲染 role=toolbar、分组与分隔线，图标按钮以 title 为名称', () => {
    setup([core], [['bold', 'italic'], ['list', 'table']])
    const toolbar = screen.getByRole('toolbar', { name: '编辑工具栏' })
    const groups = within(toolbar).getAllByRole('group')
    expect(groups).toHaveLength(2)
    expect(toolbar.querySelectorAll('.ex-toolbar__divider')).toHaveLength(1)
    expect(within(groups[0]!).getByRole('button', { name: '加粗' })).toHaveClass('ex-toolbar__item')
    expect(within(groups[1]!).getByRole('button', { name: '列表' })).toHaveClass('has-label')
  })

  it('点击按钮执行 run；悬停显示带快捷键的提示', async () => {
    setup([core])
    await userEvent.hover(screen.getByRole('button', { name: '加粗' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('加粗 (Ctrl+B)')
    await userEvent.click(screen.getByRole('button', { name: '加粗' }))
    expect(bold).toHaveBeenCalledTimes(1)
  })

  it('active 格式键驱动 aria-pressed 与 is-active', () => {
    setup([core], undefined, makeCtx({ formats: new Set(['bold']) }))
    const button = screen.getByRole('button', { name: '加粗' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('is-active')
    expect(screen.getByRole('button', { name: '斜体' })).not.toHaveAttribute('aria-pressed')
  })

  it('只读时禁用非 allowReadOnly 条目', () => {
    setup([core], undefined, makeCtx(), true)
    expect(screen.getByRole('button', { name: '加粗' })).toBeDisabled()
  })

  it('dropdown 展开菜单，显示快捷键，选择后执行子项', async () => {
    const ol = (core.toolbar![2] as { items: Array<{ run?: () => void }> }).items[0]!.run
    setup([core])
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    const menu = await screen.findByRole('menu', { name: '列表' })
    expect(within(menu).getByRole('menuitem', { name: /有序列表/ })).toHaveTextContent('Ctrl+Shift+O')
    expect(within(menu).getByRole('separator')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: /有序列表/ }))
    expect(ol).toHaveBeenCalledTimes(1)
  })

  it('modal 条目在 .ex-portal 中打开对话框，close 关闭', async () => {
    setup([core])
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    expect(dialog.closest('.ex-portal')).not.toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: '插入' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('popover 条目以 Popover 打开', async () => {
    const ext: EditorExtension = {
      name: 'pop',
      toolbar: [{ type: 'popover', id: 'emoji', title: '表情', icon: <span>E</span>, render: () => <p>表情面板</p> }],
    }
    setup([ext])
    await userEvent.click(screen.getByRole('button', { name: '表情' }))
    expect(await screen.findByText('表情面板')).toBeInTheDocument()
  })

  it('run 抛错：notify 错误并继续可用', async () => {
    const ctx = makeCtx()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ext: EditorExtension = {
      name: 'demo',
      toolbar: [{ type: 'button', id: 'boom', title: '爆炸', icon: <span>!</span>, run: () => { throw new Error('boom') } }],
    }
    setup([ext], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '爆炸' }))
    expect(ctx.notify).toHaveBeenCalledWith('扩展 demo 出错：boom', 'error')
  })

  it('render 抛错由错误边界截获并上报', async () => {
    const ctx = makeCtx()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = () => {
      throw new Error('render failed')
    }
    const ext: EditorExtension = {
      name: 'bad',
      toolbar: [{ type: 'modal', id: 'bad', title: '坏弹窗', icon: <span>X</span>, render: () => <Broken /> }],
    }
    setup([ext], undefined, ctx)
    await userEvent.click(screen.getByRole('button', { name: '坏弹窗' }))
    expect(await screen.findByRole('dialog', { name: '坏弹窗' })).toBeInTheDocument()
    expect(ctx.notify).toHaveBeenCalledWith('扩展 bad 出错：render failed', 'error')
  })

  it('方向键/Home/End 在条目间移动焦点（roving tabindex）', async () => {
    setup([core], [['bold', 'italic'], ['list']])
    const boldButton = screen.getByRole('button', { name: '加粗' })
    expect(boldButton).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: '斜体' })).toHaveAttribute('tabindex', '-1')
    boldButton.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: '斜体' })).toHaveFocus()
    expect(screen.getByRole('button', { name: '斜体' })).toHaveAttribute('tabindex', '0')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('button', { name: '列表' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(boldButton).toHaveFocus()
  })

  it('宽度不足时溢出分组移入「更多」菜单（分组设 inert）', async () => {
    const widths = new Map<string, number>([['ex-toolbar__group', 100]])
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return [...widths].find(([cls]) => this.classList.contains(cls))?.[1] ?? 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('ex-toolbar') ? 250 : 0
    })
    setup([core], [['bold'], ['italic'], ['list']])
    const groups = screen.getAllByRole('group', { hidden: true })
    expect(groups[0]).not.toHaveClass('is-overflow')
    expect(groups[1]).toHaveClass('is-overflow')
    expect(groups[1]).toHaveAttribute('inert')
    await userEvent.click(screen.getByRole('button', { name: '更多' }))
    const menu = await screen.findByRole('menu', { name: '更多' })
    expect(within(menu).getByRole('menuitem', { name: '斜体' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /有序列表/ })).toBeInTheDocument()
  })

  it('stateKey 变化时重新求值 active', () => {
    let formats = new Set<string>()
    const ctx = makeCtx()
    Object.defineProperty(ctx, 'formats', { get: () => formats })
    const groups = resolveToolbar([core], undefined, md)
    const { rerender } = wrap(<Toolbar groups={groups} ctx={ctx} stateKey="a" />)
    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'false')
    formats = new Set(['bold'])
    act(() =>
      rerender(
        <ThemeProvider defaultTheme="light" storageKey={false}>
          <ToastProvider>
            <Toolbar groups={groups} ctx={ctx} stateKey="b" />
          </ToastProvider>
        </ThemeProvider>,
      ),
    )
    expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

`packages/toolbar/src/use-extension-setup.test.tsx`：

```tsx
import { render } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { EditorExtension, ExtensionContext } from './extension'
import { useExtensionSetup, useStableArray } from './use-extension-setup'

const ctx = {} as ExtensionContext

function Host({ extensions, onError }: { extensions: EditorExtension[]; onError: (n: string, e: unknown) => void }) {
  useExtensionSetup(useStableArray(extensions), ctx, onError)
  return null
}

describe('useExtensionSetup', () => {
  it('挂载时 setup、卸载时清理；StrictMode 下成对执行', () => {
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const { unmount } = render(
      <StrictMode>
        <Host extensions={[{ name: 'a', setup }]} onError={vi.fn()} />
      </StrictMode>,
    )
    expect(setup).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledTimes(1)
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(setup).toHaveBeenCalledWith(ctx)
  })

  it('元素不变的新数组不重跑；扩展移除时清理', () => {
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const ext: EditorExtension = { name: 'a', setup }
    const { rerender } = render(<Host extensions={[ext]} onError={vi.fn()} />)
    rerender(<Host extensions={[ext]} onError={vi.fn()} />)
    expect(setup).toHaveBeenCalledTimes(1)
    rerender(<Host extensions={[]} onError={vi.fn()} />)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('setup 或 cleanup 抛错交给 onError，其他扩展照常', () => {
    const onError = vi.fn()
    const good = vi.fn()
    const { unmount } = render(
      <Host
        extensions={[
          { name: 'bad', setup: () => { throw new Error('setup') } },
          { name: 'bad-cleanup', setup: () => () => { throw new Error('cleanup') } },
          { name: 'good', setup: good },
        ]}
        onError={onError}
      />,
    )
    expect(good).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('bad', expect.objectContaining({ message: 'setup' }))
    unmount()
    expect(onError).toHaveBeenCalledWith('bad-cleanup', expect.objectContaining({ message: 'cleanup' }))
  })

  it('useStableArray：元素逐个相同则返回同一引用', () => {
    const seen: unknown[] = []
    const a = { name: 'a' }
    function Probe({ list }: { list: object[] }) {
      seen.push(useStableArray(list))
      return null
    }
    function Parent() {
      const [n, setN] = useState(0)
      return (
        <>
          <button onClick={() => setN(n + 1)}>+</button>
          <Probe list={[a]} />
        </>
      )
    }
    const { getByText } = render(<Parent />)
    getByText('+').click()
    expect(seen.length).toBeGreaterThan(1)
    expect(seen[seen.length - 1]).toBe(seen[0])
  })
})
```

`packages/toolbar/src/styles.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('toolbar styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) expect(themeCss, name).toContain(`${name}:`)
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('类名均以 ex-toolbar 开头（状态类 is-* 除外）', () => {
    for (const [, c] of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      expect(c!.startsWith('ex-toolbar') || c!.startsWith('is-') || c === 'has-label', c).toBe(true)
    }
  })

  it('溢出分组移出布局流但保留可测量宽度', () => {
    expect(css).toMatch(/\.ex-toolbar__group\.is-overflow[^{]*\{[^}]*position: absolute;[^}]*visibility: hidden;/)
  })
})
```

Run: `pnpm --filter @editorx/toolbar exec vitest run`
Expected: FAIL —— `./toolbar`、`./use-extension-setup` 不存在，样式断言失败。

- [ ] **Step 2: 实现**

`packages/toolbar/src/error-boundary.tsx`：

```tsx
import { Component, type ReactNode } from 'react'

interface Props {
  name: string
  onError(name: string, error: unknown): void
  children: ReactNode
}

/** 隔离扩展 render 中的异常：出错后渲染为空并上报 */
export class ExtensionErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError(this.props.name, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
```

`packages/toolbar/src/use-extension-setup.ts`：

```ts
import { useEffect, useRef } from 'react'
import type { EditorExtension, ExtensionContext } from './extension'

/** 元素逐个 === 时返回上一次的数组引用，避免内联数组导致 effect 重跑 */
export function useStableArray<T>(list: readonly T[]): readonly T[] {
  const ref = useRef(list)
  const prev = ref.current
  if (prev !== list && (prev.length !== list.length || prev.some((item, i) => item !== list[i]))) {
    ref.current = list
  }
  return ref.current
}

/**
 * 依次调用扩展的 setup，卸载或扩展数组变化时调用其清理函数。
 * 任一扩展抛错只上报，不影响其他扩展与编辑器。
 */
export function useExtensionSetup(
  extensions: readonly EditorExtension[],
  ctx: ExtensionContext,
  onError: (extension: string, error: unknown) => void,
): void {
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    const cleanups: Array<[string, () => void]> = []
    for (const ext of extensions) {
      if (!ext.setup) continue
      try {
        const cleanup = ext.setup(ctx)
        if (typeof cleanup === 'function') cleanups.push([ext.name, cleanup])
      } catch (error) {
        onErrorRef.current(ext.name, error)
      }
    }
    return () => {
      for (const [name, cleanup] of cleanups.reverse()) {
        try {
          cleanup()
        } catch (error) {
          onErrorRef.current(name, error)
        }
      }
    }
  }, [extensions, ctx])
}
```

（`useStableArray` 在 render 中写 ref：仅在内容变化时替换引用，结果对同一输入幂等，StrictMode 重复调用安全。）

`packages/toolbar/src/toolbar.tsx`：

```tsx
import { Dropdown, Modal, Popover, Tooltip, type DropdownItem } from '@editorx/ui'
import { ChevronDown, Ellipsis } from 'lucide-react'
import {
  Fragment,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { cx } from './cx'
import { ExtensionErrorBoundary } from './error-boundary'
import { resolveText, type ExtensionContext, type ToolbarModal, type ToolbarPopover } from './extension'
import { isItemActive, isItemDisabled } from './item-state'
import {
  fitGroups,
  flattenChildren,
  isSeparator,
  overflowChildren,
  type ResolvedChild,
  type ResolvedGroup,
  type ResolvedItem,
} from './layout'
import { errorMessage, formatMessage } from './messages'
import { useMessages } from './messages-context'
import { formatShortcut, isMacPlatform } from './shortcuts'

/** 与 styles.css 中分隔线（1px + 左右 8px 外边距）和「更多」按钮（28px + 分隔线 + 余量）保持一致 */
const DIVIDER_WIDTH = 17
const MORE_WIDTH = 49
const MORE_KEY = '__more'
const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

export interface ToolbarProps {
  groups: readonly ResolvedGroup[]
  ctx: ExtensionContext
  readOnly?: boolean
  /** 变化时重新求值 active/disabled */
  stateKey?: string
  onError?(extension: string, error: unknown): void
  ariaLabel?: string
  className?: string
}

function ToolbarImpl({ groups, ctx, readOnly = false, onError, ariaLabel, className }: ToolbarProps) {
  const m = useMessages()
  const mac = useMemo(isMacPlatform, [])
  const rootRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Array<HTMLDivElement | null>>([])
  const [fit, setFit] = useState(groups.length)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [dialog, setDialog] = useState<ResolvedItem | null>(null)

  const report =
    onError ??
    ((extension: string, error: unknown) => {
      console.error(error)
      ctx.notify(formatMessage(m.errors.extension, { name: extension, message: errorMessage(error) }), 'error')
    })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const style = getComputedStyle(root)
      const available = root.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      if (!(available > 0)) {
        setFit(groups.length)
        return
      }
      const widths = groups.map((_, i) => groupRefs.current[i]?.offsetWidth ?? 0)
      setFit(fitGroups(widths, available, DIVIDER_WIDTH, MORE_WIDTH))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [groups])

  const visible = Math.min(fit, groups.length)
  const overflow = groups.slice(visible)
  const tabbable = groups
    .slice(0, visible)
    .flat()
    .filter((r) => !isItemDisabled(r, ctx, readOnly))
    .map((r) => r.item.id)
  if (overflow.length > 0) tabbable.push(MORE_KEY)
  const tabStop = focusKey !== null && tabbable.includes(focusKey) ? focusKey : tabbable[0]

  const activate = (resolved: ResolvedItem) => {
    const { item } = resolved
    if (item.type === 'button') {
      try {
        item.run(ctx)
      } catch (error) {
        report(resolved.extension, error)
      }
    } else if (item.type === 'modal' || item.type === 'popover') {
      setDialog(resolved)
    }
  }

  const menuItems = (children: readonly ResolvedChild[]): DropdownItem[] =>
    flattenChildren(children).map((child) =>
      isSeparator(child)
        ? { key: child.key, label: '', separator: true }
        : {
            key: child.item.id,
            label: resolveText(child.item.title, m),
            icon: child.item.icon,
            extra: child.item.type === 'button' && child.item.shortcut ? formatShortcut(child.item.shortcut, mac) : undefined,
            disabled: isItemDisabled(child, ctx, readOnly),
          },
    )

  const selectFrom = (children: readonly ResolvedChild[], key: string) => {
    const found = flattenChildren(children).find((c): c is ResolvedItem => !isSeparator(c) && c.item.id === key)
    if (found) activate(found)
  }

  const renderItem = (resolved: ResolvedItem): ReactElement => {
    const { item } = resolved
    const title = resolveText(item.title, m)
    const label = item.label === undefined ? undefined : resolveText(item.label, m)
    const shortcut = item.type === 'button' && item.shortcut ? formatShortcut(item.shortcut, mac) : undefined
    const active = isItemActive(resolved, ctx)
    const button = (
      <button
        type="button"
        data-item-id={item.id}
        className={cx('ex-toolbar__item', active && 'is-active', label && 'has-label')}
        aria-label={label ? undefined : title}
        aria-pressed={item.type === 'button' && item.active !== undefined ? active : undefined}
        tabIndex={item.id === tabStop ? 0 : -1}
        disabled={isItemDisabled(resolved, ctx, readOnly)}
        onClick={item.type === 'button' || item.type === 'modal' ? () => activate(resolved) : undefined}
      >
        {item.icon && <span className="ex-toolbar__icon" aria-hidden="true">{item.icon}</span>}
        {label && <span className="ex-toolbar__label">{label}</span>}
        {item.type === 'dropdown' && label && <ChevronDown className="ex-toolbar__caret" size={12} aria-hidden="true" />}
      </button>
    )
    const withTip = <Tooltip content={shortcut ? `${title} (${shortcut})` : title}>{button}</Tooltip>
    if (item.type === 'dropdown') {
      const children = resolved.children ?? []
      return (
        <Dropdown key={item.id} label={title} items={menuItems(children)} onSelect={(key) => selectFrom(children, key)}>
          {withTip}
        </Dropdown>
      )
    }
    if (item.type === 'popover') {
      return (
        <Popover
          key={item.id}
          content={(close) => (
            <ExtensionErrorBoundary name={resolved.extension} onError={report}>
              {item.render(ctx, close)}
            </ExtensionErrorBoundary>
          )}
        >
          {withTip}
        </Popover>
      )
    }
    return <Fragment key={item.id}>{withTip}</Fragment>
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root || !NAV_KEYS.has(e.key) || !root.contains(e.target as Node)) return
    const items = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        '.ex-toolbar__group:not(.is-overflow) .ex-toolbar__item:not(:disabled), .ex-toolbar__more',
      ),
    )
    const index = items.indexOf(e.target as HTMLButtonElement)
    if (index === -1) return
    e.preventDefault()
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (index + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).dataset.itemId
    if (id) setFocusKey(id)
  }

  const overflowList = overflowChildren(overflow)
  const dialogItem = dialog?.item as ToolbarModal | ToolbarPopover | undefined

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label={ariaLabel ?? m.toolbar.label}
      aria-orientation="horizontal"
      className={cx('ex-toolbar', className)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {groups.map((group, index) => {
        const hidden = index >= visible
        return (
          <Fragment key={group[0]?.item.id ?? index}>
            {index > 0 && <span className={cx('ex-toolbar__divider', hidden && 'is-overflow')} aria-hidden="true" />}
            <div
              ref={(el) => {
                groupRefs.current[index] = el
              }}
              role="group"
              className={cx('ex-toolbar__group', hidden && 'is-overflow')}
              inert={hidden}
              aria-hidden={hidden || undefined}
            >
              {group.map(renderItem)}
            </div>
          </Fragment>
        )
      })}
      {overflow.length > 0 && (
        <>
          <span className="ex-toolbar__divider" aria-hidden="true" />
          <Dropdown label={m.toolbar.more} items={menuItems(overflowList)} onSelect={(key) => selectFrom(overflowList, key)}>
            <Tooltip content={m.toolbar.more}>
              <button
                type="button"
                data-item-id={MORE_KEY}
                className="ex-toolbar__item ex-toolbar__more"
                aria-label={m.toolbar.more}
                tabIndex={tabStop === MORE_KEY ? 0 : -1}
              >
                <Ellipsis size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          </Dropdown>
        </>
      )}
      {dialog && dialogItem && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title={resolveText(dialogItem.title, m)}
          width={dialogItem.type === 'modal' ? dialogItem.width : undefined}
          closeLabel={m.dialog.close}
        >
          <ExtensionErrorBoundary name={dialog.extension} onError={report}>
            {dialogItem.render(ctx, () => setDialog(null))}
          </ExtensionErrorBoundary>
        </Modal>
      )}
    </div>
  )
}

export const Toolbar = memo(ToolbarImpl)
```

（从「更多」菜单或 dropdown 中选中的 popover 条目没有可锚定的按钮，统一以 Modal 打开。）

`packages/toolbar/src/styles.css` 全文：

```css
/* @editorx/toolbar：28px 按钮、6px 间距、1×16px 分隔线（左右 8px） */
.ex-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.ex-toolbar__group {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.ex-toolbar__group.is-overflow,
.ex-toolbar__divider.is-overflow {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
}

.ex-toolbar__divider {
  flex: none;
  width: 1px;
  height: 16px;
  margin: 0 8px;
  background: var(--ex-color-border);
}

.ex-toolbar__item {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: var(--ex-space-1);
  min-width: 28px;
  height: 28px;
  padding: 0 var(--ex-space-1);
  border: 0;
  border-radius: var(--ex-radius-md);
  background: transparent;
  color: var(--ex-color-text);
  font: inherit;
  font-size: var(--ex-font-size-md);
  white-space: nowrap;
  cursor: pointer;
}

.ex-toolbar__item.has-label { padding: 0 var(--ex-space-2); }
.ex-toolbar__item:hover:not(:disabled) { background: var(--ex-color-surface-hover); }
.ex-toolbar__item:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: -2px; }
.ex-toolbar__item.is-active { color: var(--ex-color-primary); }
.ex-toolbar__item:disabled { color: var(--ex-color-text-muted); cursor: not-allowed; }
.ex-toolbar__icon { display: inline-flex; }
.ex-toolbar__caret { flex: none; }
```

`packages/toolbar/src/index.ts` 末尾追加：

```ts
export { Toolbar } from './toolbar'
export type { ToolbarProps } from './toolbar'
export { ExtensionErrorBoundary } from './error-boundary'
export { useExtensionSetup, useStableArray } from './use-extension-setup'
```

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm --filter @editorx/toolbar exec vitest run; pnpm --filter @editorx/toolbar typecheck; pnpm lint`
Expected: 全部 PASS；类型检查与 lint 无错误（exhaustive-deps 无新警告）。

- [ ] **Step 4: 提交**

```powershell
git add packages/toolbar/src/toolbar.tsx
git add packages/toolbar/src/error-boundary.tsx
git add packages/toolbar/src/use-extension-setup.ts
git add packages/toolbar/src/styles.css
git add packages/toolbar/src/index.ts
git add packages/toolbar/src/toolbar.test.tsx
git add packages/toolbar/src/use-extension-setup.test.tsx
git add packages/toolbar/src/styles.test.ts
git commit -m "feat(toolbar): Toolbar 组件、溢出菜单与扩展 setup 生命周期" -m "Toolbar 渲染 role=toolbar 分组与分隔线，roving tabindex + 方向键导航；提示含平台化快捷键；active/disabled 随 stateKey 重新求值，只读时禁用非 allowReadOnly 项。" -m "dropdown/popover/modal 弹层渲染到 .ex-portal；ResizeObserver 测量分组宽度，放不下的分组 inert 隐藏并合并进「更多」菜单。" -m "扩展 run/render/setup 异常由 notify 与 ExtensionErrorBoundary 隔离；useExtensionSetup 在 StrictMode 下成对 setup/cleanup。"
```

---

### Task 6: markdown-core 新命令 + `@editorx/markdown` 脚手架 + 预览流水线

**Files:**
- Modify: `packages/markdown-core/src/commands/inline.ts`、`src/commands/registry.ts`、`src/commands/commands.test.ts`
- Create: `packages/markdown/package.json`、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`
- Create: `packages/markdown/src/index.ts`、`src/cx.ts`、`src/styles.css`
- Create: `packages/markdown/src/pipeline/scheduler.ts`、`stats-counter.ts`、`preview-pipeline.ts`
- Test: `packages/markdown/src/pipeline/preview-pipeline.test.ts`、`packages/markdown/src/pipeline/stats-counter.test.ts`

**Interfaces:**
- Consumes: `markdown-core` 的 `patchPreview`、`renderDiagrams`、`countWords`、`countHtml`、`createRenderer`、`EditorEngine`、`RenderResult`。
- Produces:
  ```ts
  // markdown-core
  commands.mark / commands.superscript / commands.subscript   // toggleWrap('=='/'^'/'~')
  // @editorx/markdown（包内）
  interface PreviewStats { mdWords: number; lines: number; htmlWords: number; paragraphs: number }
  function createStatsCounter(): { count(sections, hasTime: () => boolean): PreviewStats | null }
  function yieldToMain(): Promise<void>; function whenIdle(cb): () => void
  const PREVIEW_DELAY = 200
  function createPreviewPipeline(opts: {
    engine; previewEl; getRenderer(): Renderer; getTheme(): 'light' | 'dark'; canDrawDiagrams(): boolean
    onRendered(result: RenderResult, markdown: string): void; onStats(stats: PreviewStats): void; onLayout(): void; delay?: number
  }): { schedule(): void; flush(): Promise<void>; redrawDiagrams(): void; getResult(): RenderResult | null; destroy(): void }
  ```
  流水线自己订阅 `engine.on('change')`；每次 flush：`render` → `yieldToMain` → 代次过期则丢弃 → `patchPreview` → rAF `onLayout` → 图表（`canDrawDiagrams()` 为真时）→ 空闲统计 → `onRendered`。preview 内 `load`/`error`（捕获阶段）也触发 `onLayout`。`destroy` 退订、清定时器、清空 preview。

- [ ] **Step 1: markdown-core 命令——写失败测试**

在 `packages/markdown-core/src/commands/commands.test.ts` 的 `cases` 数组末尾（`]` 之前）追加：

```ts
  ['mark wraps', commands.mark, 'a «b» c', 'a ==«b»== c'],
  ['mark placeholder', commands.mark, '«»', '==«高亮文本»=='],
  ['mark unwraps', commands.mark, '==«b»==', '«b»'],
  ['superscript wraps', commands.superscript, 'x«2»', 'x^«2»^'],
  ['superscript placeholder', commands.superscript, '«»', '^«上标»^'],
  ['subscript wraps', commands.subscript, 'H«2»O', 'H~«2»~O'],
  ['subscript placeholder', commands.subscript, '«»', '~«下标»~'],
```

并在 `'registers every spec command'` 的数组中加入 `'mark'`、`'subscript'`、`'superscript'`。

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/commands`
Expected: FAIL —— `commands.mark` 等为 undefined。

- [ ] **Step 2: markdown-core 命令——实现**

`packages/markdown-core/src/commands/inline.ts` 在 `inlineCode` 定义之后追加：

```ts
export const mark = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '==', args?.placeholder ?? '高亮文本')

export const superscript = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '^', args?.placeholder ?? '上标')

export const subscript = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '~', args?.placeholder ?? '下标')
```

`packages/markdown-core/src/commands/registry.ts`：第 15 行 import 改为

```ts
import { bold, image, inlineCode, italic, link, mark, strikethrough, subscript, superscript } from './inline'
```

并在 `commands` 对象中 `inlineCode,` 之后加入：

```ts
  mark,
  superscript,
  subscript,
```

Run: `pnpm --filter @editorx/markdown-core exec vitest run`
Expected: 全部 PASS。

- [ ] **Step 3: `@editorx/markdown` 包配置**

`packages/markdown/package.json`：

```json
{
  "name": "@editorx/markdown",
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
    "@editorx/markdown-core": "workspace:*",
    "lucide-react": "^1.53.0"
  }
}
```

`packages/markdown/tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`：内容与 Task 3 中 `packages/toolbar` 的同名文件完全相同。

`packages/markdown/src/cx.ts`：与 `packages/toolbar/src/cx.ts` 相同。

`packages/markdown/src/styles.css`（Task 7 填充）：

```css
/* @editorx/markdown：编辑器外壳样式（Task 7 起填充，3b 按 CSDN 校准） */
```

`packages/markdown/src/index.ts`（Task 7 起追加导出）：

```ts
export {}
```

Run: `pnpm install`
Expected: 成功。

- [ ] **Step 4: 流水线——写失败测试**

`packages/markdown/src/pipeline/stats-counter.test.ts`：

```ts
import { createRenderer } from '@editorx/markdown-core'
import { describe, expect, it } from 'vitest'
import { createStatsCounter } from './stats-counter'

describe('createStatsCounter', () => {
  it('按段累加的统计与整篇一致，时间不足返回 null 且保留已算缓存', () => {
    const { sections } = createRenderer().render('# 标题\n\n第一段 hello world\n\n- a\n- b\n')
    const counter = createStatsCounter()
    let budget = 1
    expect(counter.count(sections, () => budget-- > 0)).toBeNull()
    const stats = counter.count(sections, () => true)
    expect(stats).toMatchObject({ lines: 7 })
    expect(stats!.mdWords).toBeGreaterThan(0)
    expect(stats!.paragraphs).toBeGreaterThanOrEqual(2)
    expect(counter.count(sections, () => false)).toEqual(stats)
  })
})
```

`packages/markdown/src/pipeline/preview-pipeline.test.ts`：

```ts
import { createRenderer, renderDiagrams, type EditorEngine } from '@editorx/markdown-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPreviewPipeline, type PreviewPipelineOptions } from './preview-pipeline'

vi.mock('@editorx/markdown-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@editorx/markdown-core')>()),
  renderDiagrams: vi.fn(() => Promise.resolve()),
}))

function fakeEngine(initial: string) {
  let value = initial
  const listeners = new Set<(v: string) => void>()
  const engine = {
    getValue: () => value,
    on: (event: string, cb: (v: string) => void) => {
      if (event === 'change') listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
  return {
    engine: engine as unknown as EditorEngine,
    type(next: string) {
      value = next
      listeners.forEach((cb) => cb(next))
    },
    listeners: () => listeners.size,
  }
}

function setup(initial: string, over: Partial<PreviewPipelineOptions> = {}) {
  const fake = fakeEngine(initial)
  const previewEl = document.createElement('div')
  const renderer = createRenderer()
  const opts = {
    engine: fake.engine,
    previewEl,
    getRenderer: () => renderer,
    getTheme: () => 'light' as const,
    canDrawDiagrams: () => true,
    onRendered: vi.fn(),
    onStats: vi.fn(),
    onLayout: vi.fn(),
    ...over,
  }
  return { ...fake, previewEl, opts, pipeline: createPreviewPipeline(opts) }
}

describe('createPreviewPipeline', () => {
  afterEach(() => vi.useRealTimers())

  it('flush 渲染到预览并回调 onRendered(result, markdown)、绘制图表', async () => {
    const { pipeline, previewEl, opts } = setup('# 标题\n\n正文')
    await pipeline.flush()
    expect(previewEl.querySelector('h1')).toHaveTextContent('标题')
    expect(opts.onRendered).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('<h1') }), '# 标题\n\n正文')
    expect(renderDiagrams).toHaveBeenCalledWith(previewEl, { theme: 'light' })
    expect(pipeline.getResult()?.toc[0]?.text).toBe('标题')
  })

  it('change 经 200ms 防抖合并为一次渲染', async () => {
    vi.useFakeTimers()
    const { pipeline, type, opts } = setup('a')
    type('ab')
    type('abc')
    await vi.advanceTimersByTimeAsync(199)
    expect(opts.onRendered).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10)
    expect(opts.onRendered).toHaveBeenCalledTimes(1)
    expect(opts.onRendered).toHaveBeenCalledWith(expect.anything(), 'abc')
    pipeline.destroy()
  })

  it('渲染期间又有输入：旧结果被丢弃', async () => {
    const { pipeline, type, opts } = setup('旧')
    const first = pipeline.flush()
    type('新')
    await first
    expect(opts.onRendered).not.toHaveBeenCalled()
    await pipeline.flush()
    expect(opts.onRendered).toHaveBeenCalledWith(expect.anything(), '新')
  })

  it('canDrawDiagrams 为假时不绘制图表', async () => {
    vi.mocked(renderDiagrams).mockClear()
    const { pipeline } = setup('```mermaid\ngraph TD\nA-->B\n```', { canDrawDiagrams: () => false })
    await pipeline.flush()
    expect(renderDiagrams).not.toHaveBeenCalled()
  })

  it('空闲时统计并回调 onStats', async () => {
    const { pipeline, opts } = setup('# 标题\n\n正文')
    await pipeline.flush()
    await vi.waitFor(() => expect(opts.onStats).toHaveBeenCalledWith(expect.objectContaining({ lines: 3 })))
  })

  it('预览内资源 load/error 触发 onLayout（rAF 合批）', async () => {
    const { pipeline, previewEl, opts } = setup('x')
    await pipeline.flush()
    vi.mocked(opts.onLayout).mockClear()
    previewEl.firstElementChild!.dispatchEvent(new Event('load'))
    previewEl.firstElementChild!.dispatchEvent(new Event('error'))
    await vi.waitFor(() => expect(opts.onLayout).toHaveBeenCalledTimes(1))
  })

  it('destroy：退订、取消挂起渲染、清空预览', async () => {
    vi.useFakeTimers()
    const { pipeline, type, previewEl, opts, listeners } = setup('a')
    await pipeline.flush()
    vi.mocked(opts.onRendered).mockClear()
    type('ab')
    pipeline.destroy()
    expect(listeners()).toBe(0)
    expect(previewEl.childElementCount).toBe(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(opts.onRendered).not.toHaveBeenCalled()
  })
})
```

Run: `pnpm --filter @editorx/markdown exec vitest run`
Expected: FAIL —— 模块不存在。

- [ ] **Step 5: 流水线——实现（移植自 `apps/playground/app/markdown-core/markdown-core-demo.tsx`）**

`packages/markdown/src/pipeline/scheduler.ts`：

```ts
const STATS_TIMEOUT = 300

export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining(): number
}

export function whenIdle(cb: (deadline: IdleDeadlineLike) => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(cb, { timeout: STATS_TIMEOUT })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 0)
  return () => clearTimeout(id)
}
```

`packages/markdown/src/pipeline/stats-counter.ts`：

```ts
import { countHtml, countWords, type HtmlCount, type RenderedSection, type WordCount } from '@editorx/markdown-core'

export interface PreviewStats {
  mdWords: number
  lines: number
  htmlWords: number
  paragraphs: number
}

/**
 * 按段累加统计，以段源码/HTML 为键缓存。与整篇统计相等：段落在行首切分（单词不跨段），
 * 且每段渲染在独立的块包装内。
 */
export function createStatsCounter() {
  const md = new Map<string, WordCount>()
  const html = new Map<string, HtmlCount>()
  const prune = <T>(cache: Map<string, T>, used: Set<string>) => {
    for (const key of cache.keys()) if (!used.has(key)) cache.delete(key)
  }
  return {
    /** hasTime() 用尽时返回 null；已算完的段保留在缓存中 */
    count(sections: readonly RenderedSection[], hasTime: () => boolean): PreviewStats | null {
      const usedMd = new Set<string>()
      const usedHtml = new Set<string>()
      const stats: PreviewStats = { mdWords: 0, lines: 1, htmlWords: 0, paragraphs: 0 }
      for (const section of sections) {
        let words = md.get(section.text)
        let markup = html.get(section.html)
        if ((!words || !markup) && !hasTime()) return null
        if (!words) md.set(section.text, (words = countWords(section.text)))
        if (!markup) html.set(section.html, (markup = countHtml(section.html)))
        usedMd.add(section.text)
        usedHtml.add(section.html)
        stats.mdWords += words.words
        stats.lines += words.lines - 1
        stats.htmlWords += markup.words
        stats.paragraphs += markup.paragraphs
      }
      prune(md, usedMd)
      prune(html, usedHtml)
      return stats
    },
  }
}
```

（若 `HtmlCount`/`WordCount`/`RenderedSection` 未从 `@editorx/markdown-core` 根导出，先检查 `packages/markdown-core/src/index.ts`：playground demo 已从根导入这三者，应已导出。）

`packages/markdown/src/pipeline/preview-pipeline.ts`：

```ts
import { patchPreview, renderDiagrams, type EditorEngine, type RenderResult, type Renderer } from '@editorx/markdown-core'
import { whenIdle, yieldToMain } from './scheduler'
import { createStatsCounter, type PreviewStats } from './stats-counter'

export const PREVIEW_DELAY = 200

export interface PreviewPipelineOptions {
  engine: EditorEngine
  previewEl: HTMLElement
  getRenderer(): Renderer
  getTheme(): 'light' | 'dark'
  /** 主题就绪且预览可见时为 true */
  canDrawDiagrams(): boolean
  onRendered(result: RenderResult, markdown: string): void
  onStats(stats: PreviewStats): void
  /** 预览布局变化（补丁、图表、图片加载）后在下一帧调用，用于刷新同步滚动 */
  onLayout(): void
  delay?: number
}

export interface PreviewPipeline {
  /** 防抖后渲染（change 时自动调用） */
  schedule(): void
  /** 立即渲染当前值 */
  flush(): Promise<void>
  /** 已绘制的图表跳过，主题不同的重绘 */
  redrawDiagrams(): void
  getResult(): RenderResult | null
  destroy(): void
}

export function createPreviewPipeline(opts: PreviewPipelineOptions): PreviewPipeline {
  const { engine, previewEl } = opts
  const delay = opts.delay ?? PREVIEW_DELAY
  const counter = createStatsCounter()
  const previous: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let disposed = false
  let cancelStats = () => {}
  let layoutFrame = 0
  let result: RenderResult | null = null

  const layoutSoon = () => {
    cancelAnimationFrame(layoutFrame)
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0
      if (!disposed) opts.onLayout()
    })
  }
  previewEl.addEventListener('load', layoutSoon, true)
  previewEl.addEventListener('error', layoutSoon, true)

  const countStats = (sections: RenderResult['sections'], current: number) => {
    cancelStats()
    cancelStats = whenIdle((deadline) => {
      if (disposed || current !== generation) return
      const stats = counter.count(sections, () => deadline.didTimeout || deadline.timeRemaining() > 2)
      if (stats) opts.onStats(stats)
      else countStats(sections, current)
    })
  }

  const redrawDiagrams = () => {
    if (disposed || !opts.canDrawDiagrams()) return
    void renderDiagrams(previewEl, { theme: opts.getTheme() }).then(
      () => {
        if (!disposed) layoutSoon()
      },
      () => {},
    )
  }

  // 每一步在独立任务中执行，挂起的按键不会被整次预览更新阻塞
  const flush = async () => {
    clearTimeout(timer)
    timer = undefined
    const current = ++generation
    const markdown = engine.getValue()
    const next = opts.getRenderer().render(markdown)
    await yieldToMain()
    if (disposed || current !== generation) return
    result = next
    patchPreview(previewEl, next.sections, previous)
    layoutSoon()
    redrawDiagrams()
    countStats(next.sections, current)
    opts.onRendered(next, markdown)
  }

  const schedule = () => {
    generation++
    clearTimeout(timer)
    timer = setTimeout(() => {
      flush().catch((error: unknown) => console.error(error))
    }, delay)
  }

  const offChange = engine.on('change', schedule)

  return {
    schedule,
    flush,
    redrawDiagrams,
    getResult: () => result,
    destroy() {
      disposed = true
      clearTimeout(timer)
      cancelStats()
      cancelAnimationFrame(layoutFrame)
      offChange()
      previewEl.removeEventListener('load', layoutSoon, true)
      previewEl.removeEventListener('error', layoutSoon, true)
      previewEl.replaceChildren()
    },
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown exec vitest run; pnpm --filter @editorx/markdown typecheck`
Expected: 流水线与统计测试全部 PASS；类型检查无错误。

- [ ] **Step 7: 提交**

```powershell
git add packages/markdown-core/src/commands/inline.ts
git add packages/markdown-core/src/commands/registry.ts
git add packages/markdown-core/src/commands/commands.test.ts
git add packages/markdown/package.json
git add packages/markdown/tsconfig.json
git add packages/markdown/tsup.config.ts
git add packages/markdown/vitest.config.ts
git add packages/markdown/src/index.ts
git add packages/markdown/src/cx.ts
git add packages/markdown/src/styles.css
git add packages/markdown/src/pipeline/scheduler.ts
git add packages/markdown/src/pipeline/stats-counter.ts
git add packages/markdown/src/pipeline/preview-pipeline.ts
git add packages/markdown/src/pipeline/stats-counter.test.ts
git add packages/markdown/src/pipeline/preview-pipeline.test.ts
git add pnpm-lock.yaml
git commit -m "feat(markdown): 新建 @editorx/markdown 包与预览流水线" -m "markdown-core 新增 mark(==)、superscript(^)、subscript(~) 命令，与渲染器已支持的语法对应。" -m "从 playground demo 移植框架无关的预览流水线：200ms 防抖、yieldToMain、代次丢弃、patchPreview、rAF 布局刷新、主题图表重绘、空闲分段统计，并提供 destroy 清理。" -m "@editorx/markdown 以 theme/ui/toolbar 为 peerDependency，产物首行 'use client'。"
```

---

### Task 7: `<MarkdownEditor />` 核心：store、格式检测、运行时生命周期、视图模式、受控/非受控、ref、SSR

**Files:**
- Create: `packages/markdown/src/types.ts`、`store.ts`、`formats.ts`、`toc.ts`、`commands.ts`、`use-controllable.ts`、`use-latest.ts`、`mode-tabs.tsx`、`runtime.ts`、`markdown-editor.tsx`、`test-utils.tsx`
- Modify: `packages/markdown/src/index.ts`、`packages/markdown/src/styles.css`
- Test: `packages/markdown/src/formats.test.ts`、`src/toc.test.ts`、`src/store.test.ts`、`src/markdown-editor.test.tsx`、`src/ssr.test.tsx`、`src/dist.test.ts`、`src/styles.test.ts`

**Interfaces:**
- Consumes: Task 1 `useOptionalTheme`/`ready`；Task 3 `MessagesProvider`/`useMessages`；Task 6 流水线；`ClEditEngine`、`createScrollSync`、`execCommand`、`createRenderer`。
- Produces:
  ```ts
  type ViewMode = 'edit' | 'split' | 'preview'
  interface MarkdownEditorHandle {
    focus(): void; getValue(): string; setValue(markdown: string): void; getHtml(): string
    getDocument(): EditorDocument; runCommand(name: string, args?: unknown): boolean; getEngine(): EditorEngine
  }
  interface MarkdownEditorProps {
    value?; defaultValue?; onChange?(markdown, html); title?
    viewMode?; defaultViewMode?; onViewModeChange?(mode)
    theme?: ThemeMode; defaultTheme?: ThemeMode; onThemeChange?; themeStorageKey?: string | false
    locale?: DeepPartial<Messages>; readOnly?; placeholder?; ariaLabel?; height?: number | string
    engine?: () => EditorEngine; slots?: { headerEnd?: ReactNode }; className?; ref?: Ref<MarkdownEditorHandle>
  }
  function MarkdownEditor(props: MarkdownEditorProps): JSX.Element
  // 包内
  createEditorStore(initial?) / useEditorState(store, selector) / EditorSnapshot { cursor, formats, formatsKey, stats, toc, tocTitle, panel, fullscreen, uploads, save }
  detectFormats(markdown, selection): Set<string>; formatsKey(formats): string
  extractTocTitle(markdown): string | null
  createCommandRegistry(engine): CommandRegistry
  useEditorRuntime(options): { getRenderer(); getRenderResult(); setValue(md); flush() }
  ```
  DOM：`.ex-mde[data-view]` > `.ex-mde-main` > `.ex-mde-header`（`ModeTabs` + `slots.headerEnd`）+ `.ex-mde-body` > `.ex-mde-editor`（引擎宿主兼滚动容器，preview 模式 `hidden`）+ `.ex-mde-preview-pane`（edit 模式 `hidden`）> `.ex-preview.ex-mde-preview`。主题：有外层 `ThemeProvider` 且未传 `theme`/`defaultTheme` 时复用外层，否则自建 `ThemeProvider className="ex-mde-theme"`。始终包一层 `MessagesProvider` + `ToastProvider`。

- [ ] **Step 1: 纯模块——写失败测试**

`packages/markdown/src/formats.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { detectFormats, formatsKey } from './formats'

const at = (marked: string) => {
  const caret = marked.indexOf('|')
  return [...detectFormats(marked.replace('|', ''), { start: caret, end: caret })].sort()
}

describe('detectFormats', () => {
  it('块级：标题级别、引用、三种列表', () => {
    expect(at('## 标|题')).toEqual(['heading', 'heading2'])
    expect(at('> 引|用')).toEqual(['quote'])
    expect(at('- 项|目')).toEqual(['unorderedList'])
    expect(at('1. 项|目')).toEqual(['orderedList'])
    expect(at('- [x] 完|成')).toEqual(['taskList'])
  })

  it('行内：光标位于标记范围内（含标记）', () => {
    expect(at('a **b|old** c')).toEqual(['bold'])
    expect(at('a *it|al* c')).toEqual(['italic'])
    expect(at('~~de|l~~')).toEqual(['strikethrough'])
    expect(at('`co|de`')).toEqual(['inlineCode'])
    expect(at('==ma|rk==')).toEqual(['mark'])
    expect(at('x^2|^')).toEqual(['superscript'])
    expect(at('H~2|~O')).toEqual(['subscript'])
  })

  it('不在标记内或位于闭合标记之后时不激活；加粗不被识别为斜体', () => {
    expect(at('**bold**| c')).toEqual([])
    expect(at('**b|old**')).not.toContain('italic')
    expect(at('~~d|el~~')).not.toContain('subscript')
  })

  it('formatsKey 与顺序无关', () => {
    expect(formatsKey(new Set(['italic', 'bold']))).toBe(formatsKey(new Set(['bold', 'italic'])))
  })
})
```

`packages/markdown/src/toc.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { extractTocTitle } from './toc'

describe('extractTocTitle', () => {
  it('取首个 @[TOC](标题) 的标题；[TOC] 或无标题返回 null', () => {
    expect(extractTocTitle('前言\n@[TOC](这里写自定义目录标题)\n# A')).toBe('这里写自定义目录标题')
    expect(extractTocTitle('@[TOC]\n# A')).toBeNull()
    expect(extractTocTitle('[TOC]')).toBeNull()
    expect(extractTocTitle('正文 @[TOC](x)')).toBeNull()
  })
})
```

`packages/markdown/src/store.test.ts`：

```ts
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEditorStore, useEditorState } from './store'

describe('createEditorStore', () => {
  it('set 合并补丁并通知；值未变化时不通知', () => {
    const store = createEditorStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ panel: 'toc' })
    expect(store.get().panel).toBe('toc')
    store.set({ panel: 'toc' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('useEditorState 只在所选字段变化时重渲染', () => {
    const store = createEditorStore({ panel: 'toc' })
    let renders = 0
    function Probe() {
      renders++
      return <span data-testid="panel">{useEditorState(store, (s) => s.panel)}</span>
    }
    render(<Probe />)
    act(() => store.set({ fullscreen: true }))
    expect(renders).toBe(1)
    act(() => store.set({ panel: 'syntax' }))
    expect(screen.getByTestId('panel')).toHaveTextContent('syntax')
    expect(renders).toBe(2)
  })
})
```

Run: `pnpm --filter @editorx/markdown exec vitest run src/formats.test.ts src/toc.test.ts src/store.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 2: 纯模块——实现**

`packages/markdown/src/formats.ts`：

```ts
import type { Selection } from '@editorx/markdown-core'

const INLINE: ReadonlyArray<readonly [string, RegExp]> = [
  ['bold', /\*\*[^*\n]+?\*\*|__[^_\n]+?__/g],
  ['italic', /(?<![*\w])\*(?!\*)[^*\n]+?\*(?!\*)|(?<![_\w])_(?!_)[^_\n]+?_(?!_)/g],
  ['strikethrough', /~~[^~\n]+?~~/g],
  ['inlineCode', /`[^`\n]+`/g],
  ['mark', /==[^=\n]+?==/g],
  ['superscript', /(?<!\^)\^[^\s^]+\^/g],
  ['subscript', /(?<!~)~[^\s~]+~(?!~)/g],
]

/** 光标所在行的块格式 + 光标所在行内标记（只扫描当前行，按键路径可用） */
export function detectFormats(markdown: string, selection: Selection): Set<string> {
  const formats = new Set<string>()
  const caret = selection.start
  const lineStart = markdown.lastIndexOf('\n', caret - 1) + 1
  const newline = markdown.indexOf('\n', caret)
  const line = markdown.slice(lineStart, newline === -1 ? markdown.length : newline)

  const heading = /^(#{1,6})\s/.exec(line)
  if (heading) {
    formats.add('heading')
    formats.add(`heading${heading[1]!.length}`)
  }
  if (/^\s*>/.test(line)) formats.add('quote')
  const list = /^\s*(?:[-*+]\s+(\[[ xX]\]\s)?|(\d+)[.)]\s)/.exec(line)
  if (list) formats.add(list[2] !== undefined ? 'orderedList' : list[1] ? 'taskList' : 'unorderedList')

  const column = caret - lineStart
  for (const [name, pattern] of INLINE) {
    const re = new RegExp(pattern.source, 'g')
    for (let m = re.exec(line); m; m = re.exec(line)) {
      if (m.index < column && column < m.index + m[0].length) {
        formats.add(name)
        break
      }
    }
  }
  return formats
}

export function formatsKey(formats: ReadonlySet<string>): string {
  return [...formats].sort().join(',')
}
```

`packages/markdown/src/toc.ts`：

```ts
const TOC_TITLE = /^@\[TOC\]\(([^)\n]*)\)[ \t]*$/m

/** `@[TOC](标题)` 中的标题；只认独占一行的写法 */
export function extractTocTitle(markdown: string): string | null {
  const title = TOC_TITLE.exec(markdown)?.[1]?.trim()
  return title ? title : null
}
```

`packages/markdown/src/store.ts`：

```ts
import type { TocItem } from '@editorx/markdown-core'
import { useSyncExternalStore } from 'react'
import type { PreviewStats } from './pipeline/stats-counter'

export interface CursorPosition {
  line: number
  column: number
}

export interface FailedUpload {
  id: string
  name: string
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveState {
  status: SaveStatus
  savedAt: number | null
}

export interface EditorSnapshot {
  cursor: CursorPosition
  formats: ReadonlySet<string>
  formatsKey: string
  stats: PreviewStats | null
  toc: readonly TocItem[]
  tocTitle: string | null
  panel: string | null
  fullscreen: boolean
  uploads: readonly FailedUpload[]
  save: SaveState
}

export interface EditorStore {
  get(): EditorSnapshot
  set(patch: Partial<EditorSnapshot>): void
  subscribe(listener: () => void): () => void
}

const EMPTY_FORMATS: ReadonlySet<string> = new Set()

export function createEditorStore(initial: Partial<EditorSnapshot> = {}): EditorStore {
  let state: EditorSnapshot = {
    cursor: { line: 1, column: 0 },
    formats: EMPTY_FORMATS,
    formatsKey: '',
    stats: null,
    toc: [],
    tocTitle: null,
    panel: null,
    fullscreen: false,
    uploads: [],
    save: { status: 'idle', savedAt: null },
    ...initial,
  }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as Array<keyof EditorSnapshot>
      if (keys.every((key) => Object.is(state[key], patch[key]))) return
      state = { ...state, ...patch }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** selector 必须返回快照中的已有引用或原始值 */
export function useEditorState<T>(store: EditorStore, selector: (snapshot: EditorSnapshot) => T): T {
  const read = () => selector(store.get())
  return useSyncExternalStore(store.subscribe, read, read)
}
```

`packages/markdown/src/commands.ts`：

```ts
import { commands, execCommand, type CommandName, type EditorEngine } from '@editorx/markdown-core'
import type { CommandRegistry } from '@editorx/toolbar'

const NAMES: readonly string[] = [...Object.keys(commands), 'undo', 'redo']

export function createCommandRegistry(engine: EditorEngine): CommandRegistry {
  return {
    has: (name) => NAMES.includes(name),
    run(name, args) {
      if (!NAMES.includes(name)) return false
      execCommand(engine, name as CommandName, args)
      return true
    },
    list: () => [...NAMES],
  }
}
```

`packages/markdown/src/use-latest.ts`：

```ts
import { useLayoutEffect, useRef, type RefObject } from 'react'

/** 始终指向最近一次提交的值；供 effect/回调读取而不成为依赖 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
```

`packages/markdown/src/use-controllable.ts`：

```ts
import { useCallback, useState } from 'react'

export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue)
  const controlled = value !== undefined
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next)
      onChange?.(next)
    },
    [controlled, onChange],
  )
  return [controlled ? value : inner, set]
}
```

Run: `pnpm --filter @editorx/markdown exec vitest run src/formats.test.ts src/toc.test.ts src/store.test.ts`
Expected: PASS。

- [ ] **Step 3: 组件——写失败测试**

`packages/markdown/src/test-utils.tsx`：

```tsx
import { render } from '@testing-library/react'
import { createRef } from 'react'
import { MarkdownEditor } from './markdown-editor'
import type { MarkdownEditorHandle, MarkdownEditorProps } from './types'

export function renderEditor(props: MarkdownEditorProps = {}) {
  const ref = createRef<MarkdownEditorHandle>()
  const utils = render(<MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} {...props} />)
  return { ...utils, ref, handle: () => ref.current! }
}

export const editorContent = () => document.querySelector<HTMLElement>('.ex-editor-content')!
export const previewEl = () => document.querySelector<HTMLElement>('.ex-mde-preview')!
export const editorRoot = () => document.querySelector<HTMLElement>('.ex-mde')!
```

`packages/markdown/src/markdown-editor.test.tsx`：

```tsx
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@editorx/theme'
import { createRef, StrictMode, useState, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from './markdown-editor'
import { editorContent, editorRoot, previewEl, renderEditor } from './test-utils'
import type { MarkdownEditorHandle } from './types'

describe('MarkdownEditor', () => {
  it('非受控：defaultValue 渲染到编辑区与预览区', async () => {
    renderEditor({ defaultValue: '# 标题\n\n正文' })
    expect(editorContent()).toHaveTextContent('# 标题')
    await waitFor(() => expect(previewEl().querySelector('h1')).toHaveTextContent('标题'))
  })

  it('编辑后经防抖以 (markdown, html) 调用 onChange；挂载与 setValue 不触发', async () => {
    const onChange = vi.fn()
    const { handle } = renderEditor({ defaultValue: '# 标题', onChange })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    act(() => handle().getEngine().replace(4, 4, '甲'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('# 标题甲', expect.stringContaining('标题甲')))
    expect(onChange).toHaveBeenCalledTimes(1)
    act(() => handle().setValue('外部'))
    await waitFor(() => expect(previewEl()).toHaveTextContent('外部'))
    expect(handle().getValue()).toBe('外部')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('受控：回显 onChange 的值不重置内容；外部新值替换内容且不触发 onChange', async () => {
    const onChange = vi.fn()
    const ref = createRef<MarkdownEditorHandle>()
    function Controlled({ editorRef }: { editorRef: RefObject<MarkdownEditorHandle | null> }) {
      const [value, setValue] = useState('初始')
      return (
        <>
          <button onClick={() => setValue('外部值')}>外部更新</button>
          <MarkdownEditor
            ref={editorRef}
            defaultTheme="light"
            themeStorageKey={false}
            value={value}
            onChange={(md) => {
              onChange(md)
              setValue(md)
            }}
          />
        </>
      )
    }
    render(<Controlled editorRef={ref} />)
    act(() => ref.current!.getEngine().replace(2, 2, '!'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('初始!'))
    expect(ref.current!.getValue()).toBe('初始!')
    await userEvent.click(screen.getByRole('button', { name: '外部更新' }))
    expect(ref.current!.getValue()).toBe('外部值')
    await waitFor(() => expect(previewEl()).toHaveTextContent('外部值'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('StrictMode：只挂载一个编辑区，保留初始值，撤销正常', async () => {
    const ref = createRef<MarkdownEditorHandle>()
    render(
      <StrictMode>
        <MarkdownEditor ref={ref} defaultTheme="light" themeStorageKey={false} defaultValue="ab" />
      </StrictMode>,
    )
    expect(document.querySelectorAll('.ex-editor-content')).toHaveLength(1)
    expect(ref.current!.getValue()).toBe('ab')
    act(() => ref.current!.getEngine().replace(2, 2, 'c'))
    act(() => ref.current!.getEngine().undo())
    expect(ref.current!.getValue()).toBe('ab')
    await waitFor(() => expect(previewEl()).toHaveTextContent('ab'))
    expect(previewEl().querySelectorAll('.ex-preview-section')).toHaveLength(1)
  })

  it('readOnly / placeholder 原地切换，不重建编辑区', () => {
    const { rerender } = render(<MarkdownEditor defaultTheme="light" themeStorageKey={false} placeholder="写点什么" />)
    const first = editorContent()
    expect(first).toHaveAttribute('data-placeholder', '写点什么')
    rerender(<MarkdownEditor defaultTheme="light" themeStorageKey={false} placeholder="新的提示" readOnly />)
    expect(editorContent()).toBe(first)
    expect(first).toHaveAttribute('data-placeholder', '新的提示')
    expect(first).toHaveAttribute('aria-readonly', 'true')
    expect(first).toHaveAttribute('aria-label', 'Markdown 编辑区')
    expect(editorRoot()).toHaveAttribute('data-readonly')
  })

  it('视图模式：默认比对；点击切换、隐藏对应面板并回调', async () => {
    const onViewModeChange = vi.fn()
    renderEditor({ onViewModeChange })
    expect(editorRoot()).toHaveAttribute('data-view', 'split')
    expect(screen.getByRole('tab', { name: '比对' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(editorRoot()).toHaveAttribute('data-view', 'preview')
    expect(document.querySelector('.ex-mde-editor')).toHaveAttribute('hidden')
    expect(document.querySelector('.ex-mde-preview-pane')).not.toHaveAttribute('hidden')
    expect(onViewModeChange).toHaveBeenCalledWith('preview')
    await userEvent.keyboard('{ArrowLeft}')
    expect(editorRoot()).toHaveAttribute('data-view', 'split')
  })

  it('受控 viewMode：点击只回调，父组件更新后才切换', async () => {
    const onViewModeChange = vi.fn()
    const { rerender } = renderEditor({ viewMode: 'edit', onViewModeChange })
    expect(document.querySelector('.ex-mde-preview-pane')).toHaveAttribute('hidden')
    await userEvent.click(screen.getByRole('tab', { name: '预览' }))
    expect(onViewModeChange).toHaveBeenCalledWith('preview')
    expect(editorRoot()).toHaveAttribute('data-view', 'edit')
    rerender(<MarkdownEditor defaultTheme="light" themeStorageKey={false} viewMode="preview" />)
    expect(editorRoot()).toHaveAttribute('data-view', 'preview')
  })

  it('ref：runCommand / getHtml / getDocument / focus', () => {
    const { handle } = renderEditor({ defaultValue: 'hello', title: '标题' })
    act(() => handle().getEngine().setSelection(0, 5))
    act(() => {
      expect(handle().runCommand('bold')).toBe(true)
    })
    expect(handle().getValue()).toBe('**hello**')
    expect(handle().runCommand('nope')).toBe(false)
    expect(handle().getHtml()).toContain('<strong>hello</strong>')
    expect(handle().getDocument()).toEqual({
      editorType: 'markdown',
      title: '标题',
      markdown: '**hello**',
      html: expect.stringContaining('<strong>hello</strong>'),
    })
    act(() => handle().focus())
    expect(editorContent()).toHaveFocus()
  })

  it('外层已有 ThemeProvider 且未传主题时复用外层；否则自建 .ex-mde-theme', () => {
    const { unmount } = render(
      <ThemeProvider defaultTheme="dark" storageKey={false}>
        <MarkdownEditor />
      </ThemeProvider>,
    )
    expect(document.querySelectorAll('.ex-root:not(.ex-body-portal)')).toHaveLength(1)
    unmount()
    renderEditor()
    expect(document.querySelector('.ex-root.ex-mde-theme')).toHaveAttribute('data-ex-theme', 'light')
  })

  it('slots.headerEnd 渲染在模式切换右侧；height 写入 --ex-mde-height', () => {
    renderEditor({ slots: { headerEnd: <button>使用富文本编辑器</button> }, height: 600 })
    expect(screen.getByRole('button', { name: '使用富文本编辑器' }).closest('.ex-mde-header__end')).not.toBeNull()
    expect(editorRoot().style.getPropertyValue('--ex-mde-height')).toBe('600px')
  })

  it('卸载时销毁编辑区并清空预览', async () => {
    const { unmount } = renderEditor({ defaultValue: '# x' })
    await waitFor(() => expect(previewEl().querySelector('h1')).not.toBeNull())
    unmount()
    expect(document.querySelector('.ex-editor-content')).toBeNull()
  })
})
```

`packages/markdown/src/ssr.test.tsx`：

```tsx
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from './markdown-editor'

describe('SSR', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('无 window/document 时可 renderToString，只输出外壳不输出编辑内容', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const html = renderToString(<MarkdownEditor defaultValue="# 标题" defaultTheme="light" />)
    expect(html).toContain('class="ex-mde"')
    expect(html).toContain('data-view="split"')
    expect(html).toContain('比对')
    expect(html).not.toContain('ex-editor-content')
  })
})
```

`packages/markdown/src/dist.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dist = path.join(import.meta.dirname, '..', 'dist', 'index.js')
const coreDist = path.join(import.meta.dirname, '..', '..', 'markdown-core', 'dist', 'index.js')

// 需要先执行 build；turbo 的 test 任务依赖自身 build，直接运行 vitest 且无 dist 时跳过
describe.skipIf(!existsSync(dist) || !existsSync(coreDist))('构建产物 directive（需先 build）', () => {
  it("@editorx/markdown 的 dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })

  it('@editorx/markdown-core 产物不含 use client', () => {
    expect(readFileSync(coreDist, 'utf8')).not.toContain('use client')
  })
})
```

`packages/markdown/src/styles.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('markdown styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量（组件私有 --ex-mde-* 除外）', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) {
      if (name.startsWith('--ex-mde-')) continue
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

  it('隐藏面板使用 hidden 属性', () => {
    expect(css).toMatch(/\.ex-mde-editor\[hidden\],\s*\.ex-mde-preview-pane\[hidden\]\s*\{\s*display: none;/)
  })
})
```

Run: `pnpm --filter @editorx/markdown exec vitest run`
Expected: FAIL —— `./markdown-editor`、`./types` 不存在。

- [ ] **Step 4: 组件——实现**

`packages/markdown/src/types.ts`：

```ts
import type { EditorEngine } from '@editorx/markdown-core'
import type { ThemeMode } from '@editorx/theme'
import type { DeepPartial, EditorDocument, Messages } from '@editorx/toolbar'
import type { ReactNode, Ref } from 'react'

export type ViewMode = 'edit' | 'split' | 'preview'

export interface MarkdownEditorHandle {
  focus(): void
  getValue(): string
  /** 替换全部内容（清空撤销历史），不触发 onChange */
  setValue(markdown: string): void
  /** 当前内容的渲染 HTML（图表为占位块） */
  getHtml(): string
  getDocument(): EditorDocument
  /** markdown-core 命令名或 undo/redo；未知命令返回 false */
  runCommand(name: string, args?: unknown): boolean
  getEngine(): EditorEngine
}

export interface MarkdownEditorSlots {
  /** 模式切换右侧（CSDN：「使用富文本编辑器」） */
  headerEnd?: ReactNode
}

export interface MarkdownEditorProps {
  value?: string
  defaultValue?: string
  /** 防抖渲染完成后调用，html 为同一次渲染结果 */
  onChange?(markdown: string, html: string): void
  /** 写入 getDocument().title */
  title?: string
  viewMode?: ViewMode
  defaultViewMode?: ViewMode
  onViewModeChange?(mode: ViewMode): void
  /** 传入 theme 或 defaultTheme 时编辑器自建 ThemeProvider，否则复用外层 */
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?(mode: ThemeMode): void
  themeStorageKey?: string | false
  locale?: DeepPartial<Messages>
  readOnly?: boolean
  placeholder?: string
  /** 编辑区 aria-label，默认 messages.editor.ariaLabel */
  ariaLabel?: string
  /** 编辑器总高度，默认 100% */
  height?: number | string
  /** 自定义引擎工厂，只在首次渲染调用一次 */
  engine?: () => EditorEngine
  slots?: MarkdownEditorSlots
  className?: string
  ref?: Ref<MarkdownEditorHandle>
}
```

`packages/markdown/src/mode-tabs.tsx`：

```tsx
import { useMessages } from '@editorx/toolbar'
import { Columns2, Monitor, SquareCode, type LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { cx } from './cx'
import type { ViewMode } from './types'

const MODES: ReadonlyArray<{ mode: ViewMode; Icon: LucideIcon }> = [
  { mode: 'edit', Icon: SquareCode },
  { mode: 'split', Icon: Columns2 },
  { mode: 'preview', Icon: Monitor },
]

export function ModeTabs({ value, onChange }: { value: ViewMode; onChange(mode: ViewMode): void }) {
  const m = useMessages()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const index = MODES.findIndex((x) => x.mode === value)
    const next = (index + delta + MODES.length) % MODES.length
    onChange(MODES[next]!.mode)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={m.modes.label} className="ex-mde-modes" onKeyDown={onKeyDown}>
      {MODES.map(({ mode, Icon }, index) => (
        <button
          key={mode}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="button"
          role="tab"
          aria-selected={mode === value}
          tabIndex={mode === value ? 0 : -1}
          className={cx('ex-mde-mode', mode === value && 'is-active')}
          onClick={() => onChange(mode)}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{m.modes[mode]}</span>
        </button>
      ))}
    </div>
  )
}
```

（若 `LucideIcon` 类型在 lucide-react 1.53 中不存在，改用 `ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>`。）

`packages/markdown/src/runtime.ts`：

```ts
import {
  createRenderer,
  createScrollSync,
  type EditorEngine,
  type Renderer,
  type RendererOptions,
  type RenderResult,
  type ScrollSync,
} from '@editorx/markdown-core'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { detectFormats, formatsKey } from './formats'
import { createPreviewPipeline, type PreviewPipeline } from './pipeline/preview-pipeline'
import type { EditorStore } from './store'
import { extractTocTitle } from './toc'
import type { ViewMode } from './types'
import { useLatest } from './use-latest'

export interface RuntimeOptions {
  engine: EditorEngine
  store: EditorStore
  hostRef: RefObject<HTMLDivElement | null>
  previewScrollRef: RefObject<HTMLDivElement | null>
  previewRef: RefObject<HTMLDivElement | null>
  initialValue: string
  value: string | undefined
  readOnly: boolean
  placeholder: string | undefined
  ariaLabel: string
  viewMode: ViewMode
  theme: 'light' | 'dark'
  themeReady: boolean
  rendererOptions: RendererOptions
  onChange: ((markdown: string, html: string) => void) | undefined
}

export interface EditorRuntime {
  getRenderer(): Renderer
  getRenderResult(): RenderResult | null
  /** 写入引擎（不触发 onChange）并立即渲染预览 */
  setValue(markdown: string): void
  flush(): void
}

/** 光标/格式只在变化时写入 store，按键路径不触发无关订阅者 */
export function readUi(engine: EditorEngine, store: EditorStore): void {
  const prev = store.get()
  const cursor = engine.getCursorPosition()
  const formats = detectFormats(engine.getValue(), engine.getSelection())
  const key = formatsKey(formats)
  store.set({
    cursor: cursor.line === prev.cursor.line && cursor.column === prev.cursor.column ? prev.cursor : cursor,
    ...(key === prev.formatsKey ? {} : { formats, formatsKey: key }),
  })
}

export function useEditorRuntime(options: RuntimeOptions): EditorRuntime {
  const { engine, store, hostRef, previewScrollRef, previewRef } = options
  const { value, readOnly, placeholder, ariaLabel, viewMode, theme, themeReady, rendererOptions } = options
  const live = useLatest(options)
  const rendererRef = useRef<Renderer | null>(null)
  const pipelineRef = useRef<PreviewPipeline | null>(null)
  const syncRef = useRef<ScrollSync | null>(null)
  const mounted = useRef(false)
  /** 最后一次发出（onChange）或写入（setValue/受控 value）的值 */
  const lastEmitted = useRef<string | null>(null)
  const rendererOptionsRef = useRef(rendererOptions)

  const runtime = useMemo<EditorRuntime>(
    () => ({
      getRenderer() {
        rendererRef.current ??= createRenderer(live.current.rendererOptions)
        return rendererRef.current
      },
      getRenderResult: () => pipelineRef.current?.getResult() ?? null,
      setValue(markdown) {
        engine.setValue(markdown)
        lastEmitted.current = engine.getValue()
        void pipelineRef.current?.flush()
        readUi(engine, store)
      },
      flush() {
        void pipelineRef.current?.flush()
      },
    }),
    [engine, store, live],
  )

  // 引擎挂载与预览流水线：只依赖稳定引用，StrictMode 的二次挂载沿用引擎内的值与撤销历史
  useEffect(() => {
    const host = hostRef.current
    const previewEl = previewRef.current
    if (!host || !previewEl) return
    const opts = live.current
    const initial = mounted.current ? engine.getValue() : (opts.value ?? opts.initialValue)
    mounted.current = true
    engine.mount(host, { value: initial, readOnly: opts.readOnly, placeholder: opts.placeholder, ariaLabel: opts.ariaLabel })
    lastEmitted.current ??= engine.getValue()

    let frame = 0
    const scheduleUi = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        readUi(engine, store)
      })
    }
    const pipeline = createPreviewPipeline({
      engine,
      previewEl,
      getRenderer: () => runtime.getRenderer(),
      getTheme: () => live.current.theme,
      canDrawDiagrams: () => live.current.themeReady && live.current.viewMode !== 'edit',
      onRendered: (result, markdown) => {
        store.set({ toc: result.toc, tocTitle: extractTocTitle(markdown) })
        if (markdown === lastEmitted.current) return
        lastEmitted.current = markdown
        live.current.onChange?.(markdown, result.html)
      },
      onStats: (stats) => store.set({ stats }),
      onLayout: () => syncRef.current?.refresh(),
    })
    pipelineRef.current = pipeline
    const offChange = engine.on('change', scheduleUi)
    const offSelection = engine.on('selectionChange', scheduleUi)
    void pipeline.flush()
    readUi(engine, store)

    return () => {
      cancelAnimationFrame(frame)
      offChange()
      offSelection()
      pipeline.destroy()
      pipelineRef.current = null
      engine.destroy()
    }
  }, [engine, store, runtime, live, hostRef, previewRef])

  useEffect(() => {
    if (value === undefined || !mounted.current || value === lastEmitted.current) return
    runtime.setValue(value)
  }, [value, runtime])

  useEffect(() => {
    engine.setReadOnly(readOnly)
  }, [engine, readOnly])

  useEffect(() => {
    engine.setPlaceholder(placeholder)
  }, [engine, placeholder])

  useEffect(() => {
    ;(engine as Partial<{ setAriaLabel(label: string | undefined): void }>).setAriaLabel?.(ariaLabel)
  }, [engine, ariaLabel])

  useEffect(() => {
    if (rendererOptionsRef.current === rendererOptions) return
    rendererOptionsRef.current = rendererOptions
    rendererRef.current = null
    runtime.flush()
  }, [rendererOptions, runtime])

  // 主题、就绪或视图变化时补画/重画图表（预览隐藏时不画）
  useEffect(() => {
    if (themeReady && viewMode !== 'edit') pipelineRef.current?.redrawDiagrams()
  }, [theme, themeReady, viewMode])

  // 同步滚动只在比对模式存在；声明在挂载 effect 之后，保证引擎已挂载
  useEffect(() => {
    if (viewMode !== 'split') return
    const host = hostRef.current
    const scroller = previewScrollRef.current
    if (!host || !scroller) return
    const sync = createScrollSync(engine, host, scroller)
    syncRef.current = sync
    sync.refresh()
    return () => {
      sync.destroy()
      if (syncRef.current === sync) syncRef.current = null
    }
  }, [engine, viewMode, hostRef, previewScrollRef])

  return runtime
}
```

`packages/markdown/src/markdown-editor.tsx`：

```tsx
import { ClEditEngine, type EditorEngine, type RendererOptions } from '@editorx/markdown-core'
import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import { MessagesProvider, useMessages, type EditorDocument } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createCommandRegistry } from './commands'
import { cx } from './cx'
import { ModeTabs } from './mode-tabs'
import { useEditorRuntime } from './runtime'
import { createEditorStore } from './store'
import type { MarkdownEditorProps } from './types'
import { useControllableState } from './use-controllable'
import { useLatest } from './use-latest'

const createDefaultEngine = (): EditorEngine => new ClEditEngine()
const NO_RENDERER_OPTIONS: RendererOptions = {}

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
  viewMode: viewModeProp,
  defaultViewMode = 'split',
  onViewModeChange,
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
  const [engine] = useState(() => (engineFactory ?? createDefaultEngine)())
  const [store] = useState(() => createEditorStore())
  const [commands] = useState(() => createCommandRegistry(engine))
  const [viewMode, setViewMode] = useControllableState(viewModeProp, defaultViewMode, onViewModeChange)
  const hostRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const titleRef = useLatest(title)

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
    rendererOptions: NO_RENDERER_OPTIONS,
    onChange,
  })

  useImperativeHandle(
    ref,
    () => ({
      focus: () => engine.focus(),
      getValue: () => engine.getValue(),
      setValue: (markdown) => runtime.setValue(markdown),
      getHtml: () => runtime.getRenderer().render(engine.getValue()).html,
      getDocument: (): EditorDocument => {
        const markdown = engine.getValue()
        return { editorType: 'markdown', title: titleRef.current, markdown, html: runtime.getRenderer().render(markdown).html }
      },
      runCommand: (name, args) => commands.run(name, args),
      getEngine: () => engine,
    }),
    [engine, runtime, commands, titleRef],
  )

  const style = { '--ex-mde-height': typeof height === 'number' ? `${height}px` : height } as CSSProperties

  return (
    <div className={cx('ex-mde', className)} data-view={viewMode} data-readonly={readOnly || undefined} style={style}>
      <div className="ex-mde-main">
        <div className="ex-mde-header">
          <ModeTabs value={viewMode} onChange={setViewMode} />
          {slots?.headerEnd && <div className="ex-mde-header__end">{slots.headerEnd}</div>}
        </div>
        <div className="ex-mde-body">
          <div ref={hostRef} className="ex-mde-editor" hidden={viewMode === 'preview'} />
          <div ref={previewScrollRef} className="ex-mde-preview-pane" hidden={viewMode === 'edit'}>
            <div ref={previewRef} className="ex-preview ex-mde-preview" aria-label={messages.editor.previewLabel} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

`packages/markdown/src/styles.css` 全文（结构样式；3b Task 4 按 CSDN 校准后整体替换）：

```css
/* @editorx/markdown：编辑器外壳结构样式 */
.ex-mde-theme { display: contents; }

.ex-mde {
  display: flex;
  box-sizing: border-box;
  height: var(--ex-mde-height, 100%);
  min-height: 0;
}

.ex-mde-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--ex-color-surface);
}

.ex-mde-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--ex-space-3);
  padding: var(--ex-space-3) var(--ex-space-3) 0;
}

.ex-mde-header__end { display: flex; align-items: center; gap: var(--ex-space-2); }
.ex-mde-modes { display: flex; gap: var(--ex-space-3); }

.ex-mde-mode {
  display: inline-flex;
  align-items: center;
  gap: var(--ex-space-1);
  height: 32px;
  padding: 0 var(--ex-space-3);
  border: 0;
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface-hover);
  color: var(--ex-color-text);
  font: inherit;
  cursor: pointer;
}

.ex-mde-mode.is-active { background: var(--ex-color-text); color: var(--ex-color-surface); }
.ex-mde-mode:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }

.ex-mde-body { position: relative; display: flex; flex: 1; min-height: 0; }

.ex-mde-editor,
.ex-mde-preview-pane {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.ex-mde-editor[hidden],
.ex-mde-preview-pane[hidden] {
  display: none;
}

.ex-mde[data-view='split'] .ex-mde-preview-pane { border-left: 1px solid var(--ex-color-border); }
.ex-mde-preview { box-sizing: border-box; padding: var(--ex-space-4) var(--ex-space-6); }
```

`packages/markdown/src/index.ts` 全文替换为：

```ts
export { MarkdownEditor } from './markdown-editor'
export type { MarkdownEditorHandle, MarkdownEditorProps, MarkdownEditorSlots, ViewMode } from './types'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown exec vitest run`
Expected: 全部 PASS（`dist.test.ts` 无 dist 时跳过）。

Run: `pnpm --filter @editorx/markdown-core build; pnpm --filter @editorx/markdown build; pnpm --filter @editorx/markdown exec vitest run src/dist.test.ts; pnpm --filter @editorx/markdown typecheck; pnpm lint`
Expected: `dist.test.ts` 2 个用例 PASS；类型检查、lint 无错误、无新的 exhaustive-deps 警告。

- [ ] **Step 6: 提交**

```powershell
git add packages/markdown/src/types.ts
git add packages/markdown/src/store.ts
git add packages/markdown/src/formats.ts
git add packages/markdown/src/toc.ts
git add packages/markdown/src/commands.ts
git add packages/markdown/src/use-controllable.ts
git add packages/markdown/src/use-latest.ts
git add packages/markdown/src/mode-tabs.tsx
git add packages/markdown/src/runtime.ts
git add packages/markdown/src/markdown-editor.tsx
git add packages/markdown/src/test-utils.tsx
git add packages/markdown/src/styles.css
git add packages/markdown/src/index.ts
git add packages/markdown/src/formats.test.ts
git add packages/markdown/src/toc.test.ts
git add packages/markdown/src/store.test.ts
git add packages/markdown/src/markdown-editor.test.tsx
git add packages/markdown/src/ssr.test.tsx
git add packages/markdown/src/dist.test.ts
git add packages/markdown/src/styles.test.ts
git commit -m "feat(markdown): MarkdownEditor 核心组件" -m "引擎由 useState 工厂创建一次，挂载 effect 首次用 value/defaultValue、remount 沿用引擎值与撤销历史；cleanup 先退订再 destroy；readOnly/placeholder/ariaLabel 原地更新；同步滚动在比对模式的独立 effect 中创建。" -m "onChange(md, html) 在防抖渲染后发出，挂载、ref.setValue 与受控回写不触发；受控 value 仅在与最后发出值不同时写入。" -m "支持 edit/split/preview 视图（受控/非受控）、复用或自建 ThemeProvider、文案与 Toast Provider、命令式 ref（focus/getValue/setValue/getHtml/getDocument/runCommand/getEngine），SSR 只输出外壳。光标与格式经 rAF 合批写入 useSyncExternalStore 小 store。"
```

---

### Task 8: 图片上传：占位符、上传器、粘贴/拖拽、失败重试/删除

**Files:**
- Create: `packages/markdown/src/uploads/placeholders.ts`、`uploads/uploader.ts`、`uploads/upload-failures.tsx`
- Modify: `packages/markdown/src/types.ts`、`packages/markdown/src/markdown-editor.tsx`、`packages/markdown/src/styles.css`
- Test: `packages/markdown/src/uploads/uploader.test.ts`、`packages/markdown/src/uploads/uploads.test.tsx`

**Interfaces:**
- Consumes: `EditorAdapters.uploadImage`、`EditorStore.uploads`、`Messages.upload`、`ToastApi.notify`。
- Produces:
  ```ts
  const UPLOADING_SCHEME = 'ex-uploading://'; const FAILED_SCHEME = 'ex-upload-failed://'
  uploadingMarkdown(id, label) -> `![上传中...](ex-uploading://<id>)`
  failedMarkdown(id, label)    -> `![上传失败](ex-upload-failed://<id>)`
  findPlaceholder(markdown, id): { start; end } | null
  imageFiles(list): File[]
  createUploader({ engine, store, getAdapters, getMessages, notify, createId? }): { upload(files); retry(id); remove(id) }
  function UploadFailures(props: { store; onRetry(id); onRemove(id) }): JSX.Element | null
  // MarkdownEditorProps 新增 adapters?: EditorAdapters
  ```
  行为：粘贴/拖拽含图片且配置了 `uploadImage` 时拦截（`preventDefault`），在光标处插入每个文件一行占位；成功按 id 替换为 `![文件名](url)`，失败替换为失败占位、写入 `store.uploads` 并 `notify(error)`；失败条在编辑区下方列出「重试 / 删除」。替换时保持用户当前选区（按增量平移）。只读时引擎不派发 paste/drop。

- [ ] **Step 1: 写失败测试**

`packages/markdown/src/uploads/uploader.test.ts`：

```ts
import { ClEditEngine } from '@editorx/markdown-core'
import { zhCN } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { createEditorStore } from '../store'
import { findPlaceholder } from './placeholders'
import { createUploader, imageFiles } from './uploader'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(value: string, uploadImage?: (file: File) => Promise<{ url: string }>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const engine = new ClEditEngine()
  engine.mount(host, { value })
  const store = createEditorStore()
  const notify = vi.fn()
  let n = 0
  const uploader = createUploader({
    engine,
    store,
    getAdapters: () => (uploadImage ? { uploadImage } : {}),
    getMessages: () => zhCN,
    notify,
    createId: () => `u${++n}`,
  })
  return { engine, store, notify, uploader }
}

const png = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })

describe('placeholders', () => {
  it('按 id 找到上传中或失败占位', () => {
    const uploading = '![上传中...](ex-uploading://u1)'
    const failed = '![上传失败](ex-upload-failed://u2)'
    const md = `a${uploading}b${failed}`
    expect(findPlaceholder(md, 'u1')).toEqual({ start: 1, end: 1 + uploading.length })
    const range = findPlaceholder(md, 'u2')!
    expect(md.slice(range.start, range.end)).toBe(failed)
    expect(findPlaceholder(md, 'u3')).toBeNull()
  })

  it('imageFiles 只保留图片', () => {
    expect(imageFiles([png(), new File(['x'], 'a.pdf', { type: 'application/pdf' })]).map((f) => f.name)).toEqual(['shot.png'])
  })
})

describe('createUploader', () => {
  it('在光标处插入占位，成功后替换为图片并保持用户选区', async () => {
    const d = deferred<{ url: string }>()
    const { engine, uploader } = setup('ab', () => d.promise)
    engine.setSelection(1, 1)
    const done = uploader.upload([png()])
    expect(engine.getValue()).toBe('a![上传中...](ex-uploading://u1)b')
    engine.replace(0, 0, 'X')
    engine.setSelection(0, 1)
    d.resolve({ url: 'https://cdn/x.png' })
    await done
    expect(engine.getValue()).toBe('Xa![shot](https://cdn/x.png)b')
    expect(engine.getSelection()).toEqual({ start: 0, end: 1 })
  })

  it('失败：替换为失败占位、记录失败项并提示；重试成功后清除', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error('网络错误')).mockResolvedValueOnce({ url: 'https://cdn/ok.png' })
    const { engine, store, notify, uploader } = setup('', upload)
    await uploader.upload([png()])
    expect(engine.getValue()).toBe('![上传失败](ex-upload-failed://u1)')
    expect(store.get().uploads).toEqual([{ id: 'u1', name: 'shot.png' }])
    expect(notify).toHaveBeenCalledWith('图片 shot.png 上传失败：网络错误', 'error')
    await uploader.retry('u1')
    expect(engine.getValue()).toBe('![shot](https://cdn/ok.png)')
    expect(store.get().uploads).toEqual([])
  })

  it('删除失败项：移除占位与记录', async () => {
    const { engine, store, uploader } = setup('a', () => Promise.reject(new Error('x')))
    engine.setSelection(1, 1)
    await uploader.upload([png()])
    uploader.remove('u1')
    expect(engine.getValue()).toBe('a')
    expect(store.get().uploads).toEqual([])
  })

  it('多文件逐行插入；非图片给出警告；未配置 adapter 不插入', async () => {
    const { engine, uploader, notify } = setup('', () => new Promise(() => {}))
    void uploader.upload([png('a.png'), new File(['x'], 'b.txt', { type: 'text/plain' }), png('c.png')])
    expect(engine.getValue()).toBe('![上传中...](ex-uploading://u1)\n![上传中...](ex-uploading://u2)')
    expect(notify).toHaveBeenCalledWith('仅支持上传图片文件', 'warning')
    const bare = setup('z')
    await bare.uploader.upload([png()])
    expect(bare.engine.getValue()).toBe('z')
    expect(bare.notify).toHaveBeenCalledWith('未配置图片上传', 'warning')
  })

  it('占位已被用户删除时静默丢弃结果', async () => {
    const d = deferred<{ url: string }>()
    const { engine, uploader } = setup('', () => d.promise)
    const done = uploader.upload([png()])
    engine.replace(0, engine.getValue().length, '清空')
    d.resolve({ url: 'https://cdn/x.png' })
    await done
    expect(engine.getValue()).toBe('清空')
  })
})
```

`packages/markdown/src/uploads/uploads.test.tsx`：

```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { editorContent, previewEl, renderEditor } from '../test-utils'

const png = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })

describe('MarkdownEditor 图片上传', () => {
  it('粘贴图片：拦截默认粘贴，上传后插入图片并渲染', async () => {
    const uploadImage = vi.fn(async () => ({ url: 'https://cdn.example.com/a.png' }))
    const { handle } = renderEditor({ adapters: { uploadImage } })
    fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    await waitFor(() => expect(handle().getValue()).toBe('![shot](https://cdn.example.com/a.png)'))
    expect(uploadImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'shot.png' }))
    await waitFor(() => expect(previewEl().querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/a.png'))
  })

  it('未配置 uploadImage 时不拦截粘贴', () => {
    const { handle } = renderEditor({ defaultValue: 'x' })
    fireEvent.paste(editorContent(), { clipboardData: { files: [png()], types: ['Files'], getData: () => '' } })
    expect(handle().getValue()).toBe('x')
  })

  it('拖拽失败：显示失败条，可删除', async () => {
    const { handle } = renderEditor({ adapters: { uploadImage: async () => Promise.reject(new Error('超时')) } })
    fireEvent.drop(editorContent(), { dataTransfer: { files: [png('bad.png')], types: ['Files'] } })
    const list = await screen.findByRole('list', { name: '上传失败的图片' })
    expect(list).toHaveTextContent('bad.png 上传失败')
    expect(screen.getByRole('alert')).toHaveTextContent('图片 bad.png 上传失败：超时')
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByRole('list', { name: '上传失败的图片' })).toBeNull()
    expect(handle().getValue()).toBe('')
  })
})
```

Run: `pnpm --filter @editorx/markdown exec vitest run src/uploads`
Expected: FAIL —— 模块不存在、`adapters` prop 不存在。

- [ ] **Step 2: 实现**

`packages/markdown/src/uploads/placeholders.ts`：

```ts
export const UPLOADING_SCHEME = 'ex-uploading://'
export const FAILED_SCHEME = 'ex-upload-failed://'

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const uploadingMarkdown = (id: string, label: string) => `![${label}](${UPLOADING_SCHEME}${id})`
export const failedMarkdown = (id: string, label: string) => `![${label}](${FAILED_SCHEME}${id})`

export function findPlaceholder(markdown: string, id: string): { start: number; end: number } | null {
  const re = new RegExp(`!\\[[^\\]\\n]*\\]\\((?:${escapeRe(UPLOADING_SCHEME)}|${escapeRe(FAILED_SCHEME)})${escapeRe(id)}\\)`)
  const match = re.exec(markdown)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}

export const escapeAlt = (text: string) => text.replace(/[[\]\\]/g, '\\$&')
export const baseName = (name: string) => name.replace(/\.[^.]+$/, '')
```

`packages/markdown/src/uploads/uploader.ts`：

```ts
import type { EditorEngine } from '@editorx/markdown-core'
import { errorMessage, formatMessage, type EditorAdapters, type Messages, type NotifyType } from '@editorx/toolbar'
import type { EditorStore } from '../store'
import { baseName, escapeAlt, failedMarkdown, findPlaceholder, uploadingMarkdown } from './placeholders'

export interface UploaderOptions {
  engine: EditorEngine
  store: EditorStore
  getAdapters(): EditorAdapters
  getMessages(): Messages
  notify(message: string, type?: NotifyType): void
  createId?(): string
}

export interface Uploader {
  upload(files: readonly File[]): Promise<void>
  retry(id: string): Promise<void>
  remove(id: string): void
}

export function imageFiles(list: FileList | readonly File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

let sequence = 0
const defaultId = () => `${Date.now().toString(36)}${(sequence++).toString(36)}`

export function createUploader(opts: UploaderOptions): Uploader {
  const { engine, store } = opts
  const createId = opts.createId ?? defaultId
  const files = new Map<string, File>()

  const dropFailure = (id: string) => {
    store.set({ uploads: store.get().uploads.filter((u) => u.id !== id) })
  }

  /** 按 id 替换占位，并把用户选区按长度差平移；占位不存在返回 false */
  const replacePlaceholder = (id: string, text: string): boolean => {
    const range = findPlaceholder(engine.getValue(), id)
    if (!range) return false
    const before = engine.getSelection()
    engine.replace(range.start, range.end, text)
    const delta = text.length - (range.end - range.start)
    const shift = (pos: number) => (pos >= range.end ? pos + delta : Math.min(pos, range.start + text.length))
    engine.setSelection(shift(before.start), shift(before.end))
    return true
  }

  const run = async (id: string, file: File) => {
    const upload = opts.getAdapters().uploadImage
    if (!upload) return
    try {
      const { url } = await upload(file)
      replacePlaceholder(id, `![${escapeAlt(baseName(file.name))}](${url})`)
      files.delete(id)
    } catch (error) {
      const m = opts.getMessages()
      if (!replacePlaceholder(id, failedMarkdown(id, m.upload.failed))) {
        files.delete(id)
        return
      }
      store.set({ uploads: [...store.get().uploads.filter((u) => u.id !== id), { id, name: file.name }] })
      opts.notify(formatMessage(m.upload.error, { name: file.name, message: errorMessage(error) }), 'error')
    }
  }

  return {
    async upload(list) {
      const m = opts.getMessages()
      if (!opts.getAdapters().uploadImage) {
        opts.notify(m.upload.noAdapter, 'warning')
        return
      }
      const images = imageFiles(list)
      if (images.length < list.length) opts.notify(m.upload.notImage, 'warning')
      if (images.length === 0) return
      const entries = images.map((file) => ({ id: createId(), file }))
      const { start, end } = engine.getSelection()
      engine.replace(start, end, entries.map(({ id }) => uploadingMarkdown(id, m.upload.uploading)).join('\n'))
      for (const { id, file } of entries) files.set(id, file)
      await Promise.all(entries.map(({ id, file }) => run(id, file)))
    },

    async retry(id) {
      const file = files.get(id)
      if (!file) return
      dropFailure(id)
      if (!replacePlaceholder(id, uploadingMarkdown(id, opts.getMessages().upload.uploading))) {
        files.delete(id)
        return
      }
      await run(id, file)
    },

    remove(id) {
      files.delete(id)
      dropFailure(id)
      const range = findPlaceholder(engine.getValue(), id)
      if (range) engine.replace(range.start, range.end, '')
    },
  }
}
```

`packages/markdown/src/uploads/upload-failures.tsx`：

```tsx
import { formatMessage, useMessages } from '@editorx/toolbar'
import { CircleAlert } from 'lucide-react'
import { useEditorState, type EditorStore } from '../store'

export function UploadFailures({
  store,
  onRetry,
  onRemove,
}: {
  store: EditorStore
  onRetry(id: string): void
  onRemove(id: string): void
}) {
  const m = useMessages()
  const uploads = useEditorState(store, (s) => s.uploads)
  if (uploads.length === 0) return null
  return (
    <ul className="ex-mde-uploads" aria-label={m.upload.failedList}>
      {uploads.map((upload) => (
        <li key={upload.id} className="ex-mde-uploads__item">
          <CircleAlert size={14} aria-hidden="true" />
          <span className="ex-mde-uploads__name">{formatMessage(m.upload.failedItem, { name: upload.name })}</span>
          <button type="button" className="ex-mde-uploads__action" onClick={() => onRetry(upload.id)}>
            {m.upload.retry}
          </button>
          <button type="button" className="ex-mde-uploads__action" onClick={() => onRemove(upload.id)}>
            {m.upload.remove}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

`packages/markdown/src/types.ts`：import 行改为

```ts
import type { DeepPartial, EditorAdapters, EditorDocument, Messages } from '@editorx/toolbar'
```

并在 `MarkdownEditorProps` 的 `title?: string` 之后加入：

```ts
  /** 宿主能力（图片上传、保存草稿等）；缺失项对应功能按 missingAdapter 隐藏/禁用 */
  adapters?: EditorAdapters
```

`packages/markdown/src/markdown-editor.tsx` 修改：

1. import 区：
   - `import { MessagesProvider, useMessages, type EditorDocument } from '@editorx/toolbar'` 改为 `import { MessagesProvider, useMessages, type EditorAdapters, type EditorDocument } from '@editorx/toolbar'`
   - `import { ToastProvider } from '@editorx/ui'` 改为 `import { ToastProvider, useToast } from '@editorx/ui'`
   - `import { useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'` 改为 `import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react'`
   - 追加 `import { createUploader, imageFiles } from './uploads/uploader'` 与 `import { UploadFailures } from './uploads/upload-failures'`
2. 在 `const NO_RENDERER_OPTIONS: RendererOptions = {}` 之后加入 `const NO_ADAPTERS: EditorAdapters = {}`。
3. `EditorShell` 参数解构中 `title = '',` 之后加入 `adapters = NO_ADAPTERS,`。
4. 在 `const titleRef = useLatest(title)` 之后加入：

```tsx
  const { notify } = useToast()
  const live = useLatest({ adapters, messages, notify })
  const [uploader] = useState(() =>
    createUploader({
      engine,
      store,
      getAdapters: () => live.current.adapters,
      getMessages: () => live.current.messages,
      notify: (message, type) => live.current.notify(message, type),
    }),
  )
```

5. 在 `useImperativeHandle(...)` 调用之前加入：

```tsx
  useEffect(() => {
    const take = (files: FileList | null | undefined, e: Event) => {
      const images = imageFiles(files)
      if (images.length === 0 || !live.current.adapters.uploadImage) return
      e.preventDefault()
      void uploader.upload(images)
    }
    const offPaste = engine.on('paste', (e) => take(e.clipboardData?.files, e))
    const offDrop = engine.on('drop', (e) => take(e.dataTransfer?.files, e))
    return () => {
      offPaste()
      offDrop()
    }
  }, [engine, uploader, live])
```

6. JSX 中 `.ex-mde-body` 的闭合 `</div>` 之后、`.ex-mde-main` 闭合之前加入：

```tsx
        <UploadFailures store={store} onRetry={(id) => void uploader.retry(id)} onRemove={uploader.remove} />
```

`packages/markdown/src/styles.css` 末尾追加：

```css
.ex-mde-uploads {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--ex-space-1);
  margin: 0;
  padding: var(--ex-space-2) var(--ex-space-6);
  border-top: 1px solid var(--ex-color-border);
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
```

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown exec vitest run; pnpm --filter @editorx/markdown typecheck`
Expected: 全部 PASS；类型检查无错误。若 jsdom 下 `fireEvent.paste` 没有把 `clipboardData.files` 交给引擎的 paste 事件，检查 `ClEditEngine` 是否在 `paste` 监听中原样转发事件对象（Addendum B 约定为同步转发），不要改为在组件里直接监听 DOM。

- [ ] **Step 4: 提交**

```powershell
git add packages/markdown/src/uploads/placeholders.ts
git add packages/markdown/src/uploads/uploader.ts
git add packages/markdown/src/uploads/upload-failures.tsx
git add packages/markdown/src/uploads/uploader.test.ts
git add packages/markdown/src/uploads/uploads.test.tsx
git add packages/markdown/src/types.ts
git add packages/markdown/src/markdown-editor.tsx
git add packages/markdown/src/styles.css
git commit -m "feat(markdown): 图片粘贴/拖拽上传与失败重试" -m "粘贴或拖拽图片且配置了 adapters.uploadImage 时拦截默认行为，在光标处插入 ![上传中...](ex-uploading://<id>) 占位，成功按 id 替换为真实图片地址，并按长度差平移用户选区。" -m "失败时替换为 ex-upload-failed 占位、记录到 store 并以 role=alert 提示；编辑区下方失败条提供重试与删除。占位被用户删除后静默丢弃结果。"
```

---

### Task 9: 扩展接入：`ExtensionContext`、内置扩展（CSDN 工具栏布局）、对话框、快捷键、全屏

**Files:**
- Create: `packages/markdown/src/internals.ts`、`src/context.ts`、`src/download.ts`
- Create: `packages/markdown/src/core-extensions/format.tsx`、`blocks.tsx`、`insert.tsx`、`actions.tsx`、`dialogs.tsx`、`index.ts`
- Rewrite: `packages/markdown/src/markdown-editor.tsx`
- Modify: `packages/markdown/src/types.ts`、`packages/markdown/src/index.ts`、`packages/markdown/src/styles.css`
- Test: `packages/markdown/src/context.test.ts`、`packages/markdown/src/core-extensions/core-extensions.test.tsx`

**Interfaces:**
- Consumes: Task 4/5 全部 toolbar API；Task 7 runtime/store；Task 8 uploader。
- Produces:
  ```ts
  createMarkdownContext(deps: { engine; store; getRenderer; getAdapters; getTitle; getTheme; getMessages; isReadOnly; notify; uploadImages; getLiveHtml }): ExtensionContext
  getMarkdownInternals(ctx): { engine; store; getLiveHtml(); isFullscreen(); toggleFullscreen() } | undefined   // 包内私有
  const markdownCoreExtensions: readonly EditorExtension[]   // core:format/list/code/more-format/image/link/more-insert/more-actions
  const MARKDOWN_TOOLBAR_LAYOUT: ToolbarLayout =
    [['bold','italic','heading','strikethrough'], ['list','code','more-format'], ['image','link','more-insert'], ['csdn:template','csdn:history','more-actions'], '*']
  // MarkdownEditorProps 新增：extensions?, coreExtensions?, toolbarLayout?, missingAdapter?
  // MarkdownEditorHandle 新增：insert(content: InsertContent): void
  ```
  快捷键：加粗 Mod-B、斜体 Mod-I、标题级别循环 Mod-Shift-H、无序 Mod-Shift-U、有序 Mod-Shift-O、待办 Mod-Shift-C、代码块 Mod-Shift-K、图片 Mod-Shift-G、链接 Mod-Shift-L（编辑区获得焦点时，在引擎自身按键处理之后执行；引擎已处理的键不重复处理）。全屏：根节点 `data-fullscreen`，Esc 退出。

- [ ] **Step 1: 写失败测试**

`packages/markdown/src/context.test.ts`：

```ts
import { ClEditEngine, createRenderer } from '@editorx/markdown-core'
import { zhCN } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { createMarkdownContext } from './context'
import { getMarkdownInternals } from './internals'
import { createEditorStore } from './store'

function setup(value: string, readOnly = false) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const engine = new ClEditEngine()
  engine.mount(host, { value })
  const store = createEditorStore()
  const renderer = createRenderer()
  const notify = vi.fn()
  const uploadImages = vi.fn(async () => {})
  const ctx = createMarkdownContext({
    engine,
    store,
    getRenderer: () => renderer,
    getAdapters: () => ({}),
    getTitle: () => '文章',
    getTheme: () => 'dark',
    getMessages: () => zhCN,
    isReadOnly: () => readOnly,
    notify,
    uploadImages,
    getLiveHtml: () => '<p>live</p>',
  })
  return { engine, store, ctx, notify, uploadImages }
}

describe('createMarkdownContext', () => {
  it('insert 在选区末尾插入；replaceSelection 替换选区；html 内容转为 Markdown', () => {
    const { engine, ctx } = setup('hello world')
    engine.setSelection(0, 5)
    ctx.insert({ markdown: '!' })
    expect(engine.getValue()).toBe('hello! world')
    engine.setSelection(7, 12)
    ctx.replaceSelection({ html: '<strong>there</strong>' })
    expect(engine.getValue()).toBe('hello! **there**')
  })

  it('getSelectionText / getDocument / replaceDocument', () => {
    const { engine, ctx } = setup('# 标题')
    engine.setSelection(2, 4)
    expect(ctx.getSelectionText()).toBe('标题')
    expect(ctx.getDocument()).toEqual({ editorType: 'markdown', title: '文章', markdown: '# 标题', html: expect.stringContaining('<h1') })
    ctx.replaceDocument({ markdown: '新文档' })
    expect(engine.getValue()).toBe('新文档')
    engine.undo()
    expect(engine.getValue()).toBe('# 标题')
  })

  it('insertEmbed 作为独立块插入 ex-embed 围栏', () => {
    const { engine, ctx } = setup('前文')
    engine.setSelection(2, 2)
    ctx.insertEmbed('vote', { id: 'v1' })
    expect(engine.getValue()).toBe('前文\n\n```ex-embed:vote\n{\n  "id": "v1"\n}\n```\n')
  })

  it('commands 路由到 markdown-core，未知命令返回 false', () => {
    const { engine, ctx } = setup('x')
    engine.setSelection(0, 1)
    expect(ctx.commands.has('bold')).toBe(true)
    expect(ctx.commands.run('bold')).toBe(true)
    expect(engine.getValue()).toBe('**x**')
    expect(ctx.commands.run('nope')).toBe(false)
    expect(ctx.commands.list()).toContain('mark')
  })

  it('面板开关与 live getter', () => {
    const { store, ctx } = setup('')
    ctx.openPanel('toc')
    expect(ctx.activePanel).toBe('toc')
    ctx.togglePanel('toc')
    expect(ctx.activePanel).toBeNull()
    ctx.openPanel('syntax')
    ctx.closePanel('toc')
    expect(ctx.activePanel).toBe('syntax')
    store.set({ formats: new Set(['bold']) })
    expect(ctx.formats.has('bold')).toBe(true)
    expect(ctx.theme).toBe('dark')
    expect(ctx.locale.toolbar.bold).toBe('加粗')
  })

  it('internals：全屏开关与 live HTML', () => {
    const { store, ctx } = setup('')
    const internals = getMarkdownInternals(ctx)!
    internals.toggleFullscreen()
    expect(store.get().fullscreen).toBe(true)
    expect(internals.isFullscreen()).toBe(true)
    expect(internals.getLiveHtml()).toBe('<p>live</p>')
  })
})
```

`packages/markdown/src/core-extensions/core-extensions.test.tsx`：

```tsx
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EditorExtension } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { editorContent, editorRoot, renderEditor } from '../test-utils'

const groupNames = () =>
  within(screen.getByRole('toolbar', { name: '编辑工具栏' }))
    .getAllByRole('group')
    .map((g) => within(g).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent))

describe('内置扩展', () => {
  it('默认按 CSDN 布局渲染（未提供的 csdn:* 项跳过）', () => {
    renderEditor()
    expect(groupNames()).toEqual([
      ['加粗', '斜体', '标题', '删除线'],
      ['列表', '代码块', '更多格式'],
      ['图片', '链接', '更多插入'],
      ['更多操作'],
    ])
  })

  it('点击加粗包裹选区；光标在加粗内时按钮激活', async () => {
    const { handle } = renderEditor({ defaultValue: 'hello' })
    act(() => handle().getEngine().setSelection(0, 5))
    await userEvent.click(screen.getByRole('button', { name: '加粗' }))
    expect(handle().getValue()).toBe('**hello**')
    await waitFor(() => expect(screen.getByRole('button', { name: '加粗' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('编辑区内 Ctrl+B / Ctrl+Shift+O 触发命令', () => {
    const { handle } = renderEditor({ defaultValue: 'item' })
    act(() => handle().getEngine().setSelection(0, 4))
    fireEvent.keyDown(editorContent(), { key: 'b', code: 'KeyB', ctrlKey: true })
    expect(handle().getValue()).toBe('**item**')
    fireEvent.keyDown(editorContent(), { key: 'O', code: 'KeyO', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('1. **item**')
  })

  it('Mod-Shift-H 循环标题级别', () => {
    const { handle } = renderEditor({ defaultValue: 't' })
    act(() => handle().getEngine().setSelection(1, 1))
    fireEvent.keyDown(editorContent(), { key: 'H', code: 'KeyH', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('# t')
    fireEvent.keyDown(editorContent(), { key: 'H', code: 'KeyH', ctrlKey: true, shiftKey: true })
    expect(handle().getValue()).toBe('## t')
  })

  it('列表下拉选择有序列表；更多格式插入高亮', async () => {
    const { handle } = renderEditor({ defaultValue: 'a' })
    act(() => handle().getEngine().setSelection(0, 1))
    await userEvent.click(screen.getByRole('button', { name: '列表' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /有序列表/ }))
    expect(handle().getValue()).toBe('1. a')
    act(() => handle().getEngine().setSelection(3, 4))
    await userEvent.click(screen.getByRole('button', { name: '更多格式' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '高亮' }))
    expect(handle().getValue()).toBe('1. ==a==')
  })

  it('链接对话框：以选中文本预填，确定后插入链接', async () => {
    const { handle } = renderEditor({ defaultValue: '文档' })
    act(() => handle().getEngine().setSelection(0, 2))
    await userEvent.click(screen.getByRole('button', { name: '链接' }))
    const dialog = await screen.findByRole('dialog', { name: '链接' })
    expect(within(dialog).getByLabelText('链接文本')).toHaveValue('文档')
    const url = within(dialog).getByLabelText('链接地址')
    await userEvent.clear(url)
    await userEvent.type(url, 'https://e.com')
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    await waitFor(() => expect(handle().getValue()).toBe('[文档](https://e.com)'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('更多插入 → 表格对话框按行列插入', async () => {
    const { handle } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '更多插入' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '表格' }))
    const dialog = await screen.findByRole('dialog', { name: '表格' })
    const rows = within(dialog).getByLabelText('行数')
    await userEvent.clear(rows)
    await userEvent.type(rows, '1')
    await userEvent.click(within(dialog).getByRole('button', { name: '确定' }))
    await waitFor(() => expect(handle().getValue()).toContain('| 列1 | 列2 | 列3 |'))
    expect(handle().getValue().trim().split('\n')).toHaveLength(3)
  })

  it('只读：格式按钮禁用，更多操作可用（导出、全屏）', () => {
    renderEditor({ readOnly: true })
    expect(screen.getByRole('button', { name: '加粗' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '更多操作' })).not.toBeDisabled()
  })

  it('全屏：切换 data-fullscreen，Esc 退出', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '全屏' }))
    expect(editorRoot()).toHaveAttribute('data-fullscreen')
    fireEvent.keyDown(editorContent(), { key: 'Escape' })
    expect(editorRoot()).not.toHaveAttribute('data-fullscreen')
  })

  it('导出 Markdown 触发下载', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderEditor({ defaultValue: '# x', title: '我的文章' })
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '导出为 Markdown' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('我的文章.md')
    vi.unstubAllGlobals()
  })

  it('自定义扩展：经 * 追加到末尾，setup/cleanup 成对，run 抛错提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const demo: EditorExtension = {
      name: 'demo',
      setup,
      toolbar: [{ type: 'button', id: 'demo:boom', title: '演示', icon: <span>D</span>, run: () => { throw new Error('boom') } }],
    }
    const { unmount } = renderEditor({ extensions: [demo] })
    expect(groupNames().at(-1)).toEqual(['演示'])
    expect(setup).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: '演示' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('扩展 demo 出错：boom')
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('toolbarLayout 覆盖默认布局；missingAdapter=disable 显示禁用项', () => {
    const tpl: EditorExtension = {
      name: 'tpl',
      requires: ['getTemplates'],
      toolbar: [{ type: 'button', id: 'csdn:template', title: '模板', icon: <span>T</span>, run: () => {} }],
    }
    renderEditor({ extensions: [tpl], toolbarLayout: [['bold'], ['csdn:template']], missingAdapter: 'disable' })
    expect(groupNames()).toEqual([['加粗'], ['模板']])
    expect(screen.getByRole('button', { name: '模板' })).toBeDisabled()
  })

  it('ref.insert 在光标处插入', () => {
    const { handle } = renderEditor({ defaultValue: 'ab' })
    act(() => handle().getEngine().setSelection(1, 1))
    act(() => handle().insert({ markdown: 'X' }))
    expect(handle().getValue()).toBe('aXb')
  })
})
```

Run: `pnpm --filter @editorx/markdown exec vitest run src/context.test.ts src/core-extensions`
Expected: FAIL —— 模块不存在、工具栏未渲染。

- [ ] **Step 2: 实现 context / internals / download**

`packages/markdown/src/internals.ts`：

```ts
import type { EditorEngine } from '@editorx/markdown-core'
import type { ExtensionContext } from '@editorx/toolbar'
import type { EditorStore } from './store'

/** 内置扩展需要、但不属于公开 ExtensionContext 的能力 */
export interface MarkdownInternals {
  engine: EditorEngine
  store: EditorStore
  /** 预览区当前 HTML（图表已绘制时为 SVG） */
  getLiveHtml(): string
  isFullscreen(): boolean
  toggleFullscreen(): void
}

const registry = new WeakMap<ExtensionContext, MarkdownInternals>()

export function registerMarkdownInternals(ctx: ExtensionContext, internals: MarkdownInternals): void {
  registry.set(ctx, internals)
}

export function getMarkdownInternals(ctx: ExtensionContext): MarkdownInternals | undefined {
  return registry.get(ctx)
}
```

`packages/markdown/src/context.ts`：

```ts
import { htmlToMarkdown, type EditorEngine, type Renderer } from '@editorx/markdown-core'
import type { EditorAdapters, ExtensionContext, InsertContent, Messages, NotifyType } from '@editorx/toolbar'
import { createCommandRegistry } from './commands'
import { registerMarkdownInternals } from './internals'
import type { EditorStore } from './store'

export interface MarkdownContextDeps {
  engine: EditorEngine
  store: EditorStore
  getRenderer(): Renderer
  getAdapters(): EditorAdapters
  getTitle(): string
  getTheme(): 'light' | 'dark'
  getMessages(): Messages
  isReadOnly(): boolean
  notify(message: string, type?: NotifyType): void
  uploadImages(files: readonly File[]): Promise<void>
  getLiveHtml(): string
}

function toMarkdown(content: InsertContent): string {
  if (content.markdown !== undefined) return content.markdown
  return content.html ? htmlToMarkdown(content.html) : ''
}

/** 在 pos 处以独立块插入（前后补足空行） */
function asBlock(value: string, pos: number, block: string): string {
  const before = value.slice(0, pos)
  const after = value.slice(pos)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  return `${lead}${block}${trail}`
}

export function createMarkdownContext(deps: MarkdownContextDeps): ExtensionContext {
  const { engine, store } = deps
  const insertAt = (start: number, end: number, text: string) => {
    engine.replace(start, end, text)
    engine.focus()
  }

  const ctx: ExtensionContext = {
    editorType: 'markdown',
    insert(content) {
      const { end } = engine.getSelection()
      insertAt(end, end, toMarkdown(content))
    },
    insertEmbed(type, payload) {
      const { end } = engine.getSelection()
      const fence = `\`\`\`ex-embed:${type}\n${JSON.stringify(payload, null, 2)}\n\`\`\``
      insertAt(end, end, asBlock(engine.getValue(), end, fence))
    },
    getSelectionText() {
      const { start, end } = engine.getSelection()
      return engine.getValue().slice(start, end)
    },
    replaceSelection(content) {
      const { start, end } = engine.getSelection()
      insertAt(start, end, toMarkdown(content))
    },
    replaceDocument(content) {
      engine.replace(0, engine.getValue().length, toMarkdown(content))
      engine.setSelection(0, 0)
      engine.focus()
    },
    getDocument() {
      const markdown = engine.getValue()
      return { editorType: 'markdown', title: deps.getTitle(), markdown, html: deps.getRenderer().render(markdown).html }
    },
    commands: createCommandRegistry(engine),
    get adapters() {
      return deps.getAdapters()
    },
    openPanel(id) {
      store.set({ panel: id })
    },
    closePanel(id) {
      if (store.get().panel === id) store.set({ panel: null })
    },
    togglePanel(id) {
      store.set({ panel: store.get().panel === id ? null : id })
    },
    get activePanel() {
      return store.get().panel
    },
    uploadImages: (files) => deps.uploadImages(files),
    focus: () => engine.focus(),
    notify: (message, type) => deps.notify(message, type),
    get theme() {
      return deps.getTheme()
    },
    get locale() {
      return deps.getMessages()
    },
    get readOnly() {
      return deps.isReadOnly()
    },
    get formats() {
      return store.get().formats
    },
  }

  registerMarkdownInternals(ctx, {
    engine,
    store,
    getLiveHtml: deps.getLiveHtml,
    isFullscreen: () => store.get().fullscreen,
    toggleFullscreen: () => store.set({ fullscreen: !store.get().fullscreen }),
  })
  return ctx
}
```

`packages/markdown/src/download.ts`：

```ts
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}
```

- [ ] **Step 3: 实现内置扩展**

`packages/markdown/src/core-extensions/dialogs.tsx`：

```tsx
import type { ExtensionContext } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { Upload } from 'lucide-react'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

interface DialogProps {
  ctx: ExtensionContext
  close: () => void
}

/** 等对话框卸载、焦点归还后再执行，让命令最终把焦点交给编辑区 */
const afterClose = (fn: () => void) => {
  setTimeout(fn, 0)
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="ex-mde-field">
      <label htmlFor={id} className="ex-mde-field__label">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

function Actions({ ctx, close }: DialogProps) {
  return (
    <div className="ex-mde-dialog__actions">
      <Button onClick={close}>{ctx.locale.dialog.cancel}</Button>
      <Button type="submit" variant="primary">
        {ctx.locale.dialog.confirm}
      </Button>
    </div>
  )
}

export function LinkDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [text, setText] = useState(() => ctx.getSelectionText())
  const [url, setUrl] = useState('https://')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    close()
    afterClose(() => ctx.commands.run('link', { text: text || undefined, url }))
  }
  return (
    <form className="ex-mde-dialog" onSubmit={submit}>
      <Field label={m.dialog.linkText}>
        {(id) => <input id={id} className="ex-mde-input" value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <Field label={m.dialog.linkUrl}>
        {(id) => <input id={id} className="ex-mde-input" value={url} onChange={(e) => setUrl(e.target.value)} />}
      </Field>
      <Actions ctx={ctx} close={close} />
    </form>
  )
}

export function ImageDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [url, setUrl] = useState('https://')
  const [alt, setAlt] = useState(() => ctx.getSelectionText())
  const fileRef = useRef<HTMLInputElement>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    close()
    afterClose(() => ctx.commands.run('image', { url, text: alt || undefined }))
  }
  const onFiles = (files: FileList | null) => {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    close()
    afterClose(() => void ctx.uploadImages(list))
  }
  return (
    <form className="ex-mde-dialog" onSubmit={submit}>
      <Field label={m.dialog.imageUrl}>
        {(id) => <input id={id} className="ex-mde-input" value={url} onChange={(e) => setUrl(e.target.value)} />}
      </Field>
      <Field label={m.dialog.imageAlt}>
        {(id) => <input id={id} className="ex-mde-input" value={alt} onChange={(e) => setAlt(e.target.value)} />}
      </Field>
      {ctx.adapters.uploadImage && (
        <div className="ex-mde-dialog__row">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <Button icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
            {m.dialog.imageUpload}
          </Button>
        </div>
      )}
      <Actions ctx={ctx} close={close} />
    </form>
  )
}

const clampCount = (value: string) => Math.min(20, Math.max(1, Number.parseInt(value, 10) || 1))

export function TableDialog({ ctx, close }: DialogProps) {
  const m = ctx.locale
  const [rows, setRows] = useState('3')
  const [cols, setCols] = useState('3')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    close()
    afterClose(() => ctx.commands.run('table', { rows: clampCount(rows), cols: clampCount(cols) }))
  }
  return (
    <form className="ex-mde-dialog" onSubmit={submit}>
      <div className="ex-mde-dialog__row">
        <Field label={m.dialog.tableRows}>
          {(id) => (
            <input id={id} className="ex-mde-input" type="number" min={1} max={20} value={rows} onChange={(e) => setRows(e.target.value)} />
          )}
        </Field>
        <Field label={m.dialog.tableCols}>
          {(id) => (
            <input id={id} className="ex-mde-input" type="number" min={1} max={20} value={cols} onChange={(e) => setCols(e.target.value)} />
          )}
        </Field>
      </div>
      <Actions ctx={ctx} close={close} />
    </form>
  )
}
```

（`Button` 已支持 `variant`/`icon`/`type`，默认 `type="button"`，其余原生属性透传。）

`packages/markdown/src/core-extensions/format.tsx`：

```tsx
import type { EditorExtension, ExtensionContext, Messages } from '@editorx/toolbar'
import { Bold, Heading, Italic, Strikethrough } from 'lucide-react'
import { detectFormats } from '../formats'
import { getMarkdownInternals } from '../internals'

export const ICON_SIZE = 16

export const run = (name: string, args?: unknown) => (ctx: ExtensionContext) => {
  ctx.commands.run(name, args)
}

type Level = 1 | 2 | 3 | 4 | 5 | 6
const LEVELS: ReadonlyArray<readonly [Level, (m: Messages) => string]> = [
  [1, (m) => m.toolbar.heading1],
  [2, (m) => m.toolbar.heading2],
  [3, (m) => m.toolbar.heading3],
  [4, (m) => m.toolbar.heading4],
  [5, (m) => m.toolbar.heading5],
  [6, (m) => m.toolbar.heading6],
]

/** 无标题 → H1 → H2 … → H6 → 无标题 */
export function cycleHeading(ctx: ExtensionContext): void {
  const engine = getMarkdownInternals(ctx)?.engine
  const formats = engine ? detectFormats(engine.getValue(), engine.getSelection()) : ctx.formats
  const current = LEVELS.find(([level]) => formats.has(`heading${level}`))?.[0]
  ctx.commands.run(current === undefined ? 'heading1' : `heading${current === 6 ? 6 : current + 1}`)
}

export const formatExtension: EditorExtension = {
  name: 'core:format',
  editors: ['markdown'],
  toolbar: [
    { type: 'button', id: 'bold', title: (m) => m.toolbar.bold, icon: <Bold size={ICON_SIZE} />, shortcut: 'Mod-B', active: 'bold', run: run('bold') },
    { type: 'button', id: 'italic', title: (m) => m.toolbar.italic, icon: <Italic size={ICON_SIZE} />, shortcut: 'Mod-I', active: 'italic', run: run('italic') },
    {
      type: 'dropdown',
      id: 'heading',
      title: (m) => m.toolbar.heading,
      icon: <Heading size={ICON_SIZE} />,
      active: 'heading',
      items: LEVELS.map(([level, title]) => ({
        type: 'button' as const,
        id: `heading${level}`,
        title,
        active: `heading${level}`,
        run: run(`heading${level}`),
      })),
    },
    {
      type: 'button',
      id: 'strikethrough',
      title: (m) => m.toolbar.strikethrough,
      icon: <Strikethrough size={ICON_SIZE} />,
      active: 'strikethrough',
      run: run('strikethrough'),
    },
  ],
  shortcuts: { 'Mod-Shift-H': cycleHeading },
}
```

`packages/markdown/src/core-extensions/blocks.tsx`：

```tsx
import type { EditorExtension } from '@editorx/toolbar'
import {
  Code,
  CodeXml,
  Highlighter,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  SquareCode,
  Subscript,
  Superscript,
} from 'lucide-react'
import { ICON_SIZE, run } from './format'

export const listExtension: EditorExtension = {
  name: 'core:list',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'list',
      title: (m) => m.toolbar.list,
      label: (m) => m.toolbar.list,
      icon: <List size={ICON_SIZE} />,
      items: [
        { type: 'button', id: 'unorderedList', title: (m) => m.toolbar.unorderedList, icon: <List size={ICON_SIZE} />, shortcut: 'Mod-Shift-U', active: 'unorderedList', run: run('unorderedList') },
        { type: 'button', id: 'orderedList', title: (m) => m.toolbar.orderedList, icon: <ListOrdered size={ICON_SIZE} />, shortcut: 'Mod-Shift-O', active: 'orderedList', run: run('orderedList') },
        { type: 'button', id: 'taskList', title: (m) => m.toolbar.taskList, icon: <ListTodo size={ICON_SIZE} />, shortcut: 'Mod-Shift-C', active: 'taskList', run: run('taskList') },
      ],
    },
  ],
}

export const codeExtension: EditorExtension = {
  name: 'core:code',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'code',
      title: (m) => m.toolbar.code,
      label: (m) => m.toolbar.code,
      icon: <CodeXml size={ICON_SIZE} />,
      items: [
        { type: 'button', id: 'codeBlock', title: (m) => m.toolbar.codeBlock, icon: <SquareCode size={ICON_SIZE} />, shortcut: 'Mod-Shift-K', run: run('codeBlock') },
        { type: 'button', id: 'inlineCode', title: (m) => m.toolbar.inlineCode, icon: <Code size={ICON_SIZE} />, active: 'inlineCode', run: run('inlineCode') },
      ],
    },
  ],
}

export const moreFormatExtension: EditorExtension = {
  name: 'core:more-format',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'more-format',
      title: (m) => m.toolbar.moreFormat,
      label: (m) => m.toolbar.moreFormat,
      items: [
        { type: 'button', id: 'quote', title: (m) => m.toolbar.quote, icon: <Quote size={ICON_SIZE} />, active: 'quote', run: run('quote') },
        { type: 'button', id: 'hr', title: (m) => m.toolbar.hr, icon: <Minus size={ICON_SIZE} />, run: run('hr') },
        { type: 'separator' },
        { type: 'button', id: 'mark', title: (m) => m.toolbar.mark, icon: <Highlighter size={ICON_SIZE} />, active: 'mark', run: run('mark') },
        { type: 'button', id: 'superscript', title: (m) => m.toolbar.superscript, icon: <Superscript size={ICON_SIZE} />, active: 'superscript', run: run('superscript') },
        { type: 'button', id: 'subscript', title: (m) => m.toolbar.subscript, icon: <Subscript size={ICON_SIZE} />, active: 'subscript', run: run('subscript') },
      ],
    },
  ],
}
```

`packages/markdown/src/core-extensions/insert.tsx`：

```tsx
import type { EditorExtension } from '@editorx/toolbar'
import { Image, Link, Sigma, Table, TableOfContents, Workflow } from 'lucide-react'
import { ImageDialog, LinkDialog, TableDialog } from './dialogs'
import { ICON_SIZE, run } from './format'

export const imageExtension: EditorExtension = {
  name: 'core:image',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'modal',
      id: 'image',
      title: (m) => m.toolbar.image,
      icon: <Image size={ICON_SIZE} />,
      width: 440,
      render: (ctx, close) => <ImageDialog ctx={ctx} close={close} />,
    },
  ],
  shortcuts: { 'Mod-Shift-G': run('image') },
}

export const linkExtension: EditorExtension = {
  name: 'core:link',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'modal',
      id: 'link',
      title: (m) => m.toolbar.link,
      icon: <Link size={ICON_SIZE} />,
      width: 440,
      render: (ctx, close) => <LinkDialog ctx={ctx} close={close} />,
    },
  ],
  shortcuts: { 'Mod-Shift-L': run('link') },
}

export const moreInsertExtension: EditorExtension = {
  name: 'core:more-insert',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'more-insert',
      title: (m) => m.toolbar.moreInsert,
      label: (m) => m.toolbar.moreInsert,
      items: [
        { type: 'modal', id: 'table', title: (m) => m.toolbar.table, icon: <Table size={ICON_SIZE} />, width: 400, render: (ctx, close) => <TableDialog ctx={ctx} close={close} /> },
        { type: 'button', id: 'mathBlock', title: (m) => m.toolbar.mathBlock, icon: <Sigma size={ICON_SIZE} />, run: run('math') },
        { type: 'button', id: 'mathInline', title: (m) => m.toolbar.mathInline, run: run('math', { inline: true }) },
        { type: 'button', id: 'toc', title: (m) => m.toolbar.toc, icon: <TableOfContents size={ICON_SIZE} />, run: run('toc') },
        { type: 'separator' },
        { type: 'button', id: 'mermaidFlowchart', title: (m) => m.toolbar.mermaidFlowchart, icon: <Workflow size={ICON_SIZE} />, run: run('mermaid', { type: 'flowchart' }) },
        { type: 'button', id: 'mermaidSequence', title: (m) => m.toolbar.mermaidSequence, run: run('mermaid', { type: 'sequence' }) },
        { type: 'button', id: 'mermaidGantt', title: (m) => m.toolbar.mermaidGantt, run: run('mermaid', { type: 'gantt' }) },
        { type: 'button', id: 'mermaidClass', title: (m) => m.toolbar.mermaidClass, run: run('mermaid', { type: 'class' }) },
      ],
    },
  ],
}
```

`packages/markdown/src/core-extensions/actions.tsx`：

```tsx
import { exportHtml, exportMarkdown, importFile } from '@editorx/markdown-core'
import { errorMessage, formatMessage, type EditorExtension, type ExtensionContext } from '@editorx/toolbar'
import { BookOpen, Download, FileText, FileUp, Maximize2 } from 'lucide-react'
import { downloadBlob, pickFile } from '../download'
import { getMarkdownInternals } from '../internals'
import { ICON_SIZE } from './format'

const fileName = (ctx: ExtensionContext, ext: string) => `${ctx.getDocument().title.trim() || ctx.locale.toolbar.untitled}.${ext}`

async function importInto(ctx: ExtensionContext) {
  const file = await pickFile('.md,.markdown,.txt,.html,.htm')
  if (!file) return
  ctx.replaceDocument({ markdown: await importFile(file) })
}

export const moreActionsExtension: EditorExtension = {
  name: 'core:more-actions',
  editors: ['markdown'],
  toolbar: [
    {
      type: 'dropdown',
      id: 'more-actions',
      title: (m) => m.toolbar.moreActions,
      label: (m) => m.toolbar.moreActions,
      allowReadOnly: true,
      items: [
        {
          type: 'button',
          id: 'importFile',
          title: (m) => m.toolbar.importFile,
          icon: <FileUp size={ICON_SIZE} />,
          run: (ctx) => {
            importInto(ctx).catch((error: unknown) =>
              ctx.notify(formatMessage(ctx.locale.errors.import, { message: errorMessage(error) }), 'error'),
            )
          },
        },
        {
          type: 'button',
          id: 'exportMarkdown',
          title: (m) => m.toolbar.exportMarkdown,
          icon: <Download size={ICON_SIZE} />,
          allowReadOnly: true,
          run: (ctx) => downloadBlob(exportMarkdown(ctx.getDocument().markdown ?? ''), fileName(ctx, 'md')),
        },
        {
          type: 'button',
          id: 'exportHtml',
          title: (m) => m.toolbar.exportHtml,
          icon: <FileText size={ICON_SIZE} />,
          allowReadOnly: true,
          run: (ctx) => {
            const doc = ctx.getDocument()
            const html = getMarkdownInternals(ctx)?.getLiveHtml() || doc.html
            const page = exportHtml({ html, sections: [], toc: [] }, { title: doc.title || ctx.locale.toolbar.untitled })
            downloadBlob(new Blob([page], { type: 'text/html;charset=utf-8' }), fileName(ctx, 'html'))
          },
        },
        { type: 'separator' },
        {
          type: 'button',
          id: 'syntax',
          title: (m) => m.toolbar.syntax,
          icon: <BookOpen size={ICON_SIZE} />,
          allowReadOnly: true,
          active: (ctx) => ctx.activePanel === 'syntax',
          run: (ctx) => ctx.togglePanel('syntax'),
        },
        {
          type: 'button',
          id: 'fullscreen',
          title: (m) => m.toolbar.fullscreen,
          icon: <Maximize2 size={ICON_SIZE} />,
          allowReadOnly: true,
          active: (ctx) => getMarkdownInternals(ctx)?.isFullscreen() ?? false,
          run: (ctx) => getMarkdownInternals(ctx)?.toggleFullscreen(),
        },
      ],
    },
  ],
}
```

（「语法说明」面板本身在 3b Task 2 注册；3a 中 `togglePanel('syntax')` 只改变 store。）

`packages/markdown/src/core-extensions/index.ts`：

```ts
import type { EditorExtension, ToolbarLayout } from '@editorx/toolbar'
import { moreActionsExtension } from './actions'
import { codeExtension, listExtension, moreFormatExtension } from './blocks'
import { formatExtension } from './format'
import { imageExtension, linkExtension, moreInsertExtension } from './insert'

export const markdownCoreExtensions: readonly EditorExtension[] = [
  formatExtension,
  listExtension,
  codeExtension,
  moreFormatExtension,
  imageExtension,
  linkExtension,
  moreInsertExtension,
  moreActionsExtension,
]

/** CSDN Markdown 编辑器工具栏；csdn:* 由宿主扩展提供，缺失时跳过 */
export const MARKDOWN_TOOLBAR_LAYOUT: ToolbarLayout = [
  ['bold', 'italic', 'heading', 'strikethrough'],
  ['list', 'code', 'more-format'],
  ['image', 'link', 'more-insert'],
  ['csdn:template', 'csdn:history', 'more-actions'],
  '*',
]

export {
  codeExtension,
  formatExtension,
  imageExtension,
  linkExtension,
  listExtension,
  moreActionsExtension,
  moreFormatExtension,
  moreInsertExtension,
}
```

- [ ] **Step 4: 接入 MarkdownEditor**

`packages/markdown/src/types.ts`：import 行改为

```ts
import type {
  DeepPartial,
  EditorAdapters,
  EditorDocument,
  EditorExtension,
  InsertContent,
  Messages,
  MissingAdapterPolicy,
  ToolbarLayout,
} from '@editorx/toolbar'
```

`MarkdownEditorHandle` 中 `getEngine(): EditorEngine` 之前加入：

```ts
  /** 在光标处插入（html 会转为 Markdown） */
  insert(content: InsertContent): void
```

`MarkdownEditorProps` 中 `adapters?: EditorAdapters` 之后加入：

```ts
  /** 追加的扩展（同名替换内置） */
  extensions?: readonly EditorExtension[]
  /** 替换整套内置扩展，默认 markdownCoreExtensions */
  coreExtensions?: readonly EditorExtension[]
  /** 默认 MARKDOWN_TOOLBAR_LAYOUT */
  toolbarLayout?: ToolbarLayout
  /** 缺失 adapter 的扩展：隐藏（默认）或禁用 */
  missingAdapter?: MissingAdapterPolicy
```

`packages/markdown/src/markdown-editor.tsx` 全文替换为：

```tsx
import { ClEditEngine, type EditorEngine, type RendererOptions } from '@editorx/markdown-core'
import { ThemeProvider, useOptionalTheme, useTheme } from '@editorx/theme'
import {
  collectShortcuts,
  errorMessage,
  formatMessage,
  handleShortcut,
  isMacPlatform,
  MessagesProvider,
  resolveToolbar,
  Toolbar,
  useExtensionSetup,
  useMessages,
  useStableArray,
  type EditorAdapters,
  type EditorExtension,
} from '@editorx/toolbar'
import { ToastProvider, useToast } from '@editorx/ui'
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
import { createMarkdownContext } from './context'
import { MARKDOWN_TOOLBAR_LAYOUT, markdownCoreExtensions } from './core-extensions'
import { cx } from './cx'
import { ModeTabs } from './mode-tabs'
import { useEditorRuntime } from './runtime'
import { createEditorStore, useEditorState } from './store'
import type { MarkdownEditorProps } from './types'
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
  viewMode: viewModeProp,
  defaultViewMode = 'split',
  onViewModeChange,
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
  const [store] = useState(() => createEditorStore())
  const [viewMode, setViewMode] = useControllableState(viewModeProp, defaultViewMode, onViewModeChange)
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const live = useLatest({ adapters, messages, notify, title, readOnly, theme: resolved })

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

  const resolveOptions = useMemo(
    () => ({ editorType: 'markdown' as const, adapters, missingAdapter }),
    [adapters, missingAdapter],
  )
  const groups = useMemo(
    () => resolveToolbar(allExtensions, toolbarLayout, resolveOptions),
    [allExtensions, toolbarLayout, resolveOptions],
  )
  const shortcuts = useMemo(() => collectShortcuts(allExtensions, resolveOptions), [allExtensions, resolveOptions])
  const mac = useMemo(isMacPlatform, [])

  const formatsKey = useEditorState(store, (s) => s.formatsKey)
  const panel = useEditorState(store, (s) => s.panel)
  const fullscreen = useEditorState(store, (s) => s.fullscreen)

  useEffect(() => {
    const take = (files: FileList | null | undefined, e: Event) => {
      const images = imageFiles(files)
      if (images.length === 0 || !live.current.adapters.uploadImage) return
      e.preventDefault()
      void uploader.upload(images)
    }
    const offPaste = engine.on('paste', (e) => take(e.clipboardData?.files, e))
    const offDrop = engine.on('drop', (e) => take(e.dataTransfer?.files, e))
    return () => {
      offPaste()
      offDrop()
    }
  }, [engine, uploader, live])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => engine.focus(),
      getValue: () => engine.getValue(),
      setValue: (markdown) => runtime.setValue(markdown),
      getHtml: () => runtime.getRenderer().render(engine.getValue()).html,
      getDocument: () => ctx.getDocument(),
      runCommand: (name, args) => ctx.commands.run(name, args),
      insert: (content) => ctx.insert(content),
      getEngine: () => engine,
    }),
    [engine, runtime, ctx],
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
        <div className="ex-mde-body">
          <div ref={hostRef} className="ex-mde-editor" hidden={viewMode === 'preview'} />
          <div ref={previewScrollRef} className="ex-mde-preview-pane" hidden={viewMode === 'edit'}>
            <div ref={previewRef} className="ex-preview ex-mde-preview" aria-label={messages.editor.previewLabel} />
          </div>
        </div>
        <UploadFailures store={store} onRetry={(id) => void uploader.retry(id)} onRemove={uploader.remove} />
      </div>
    </div>
  )
}
```

（`createCommandRegistry` 仍由 `context.ts` 使用；Task 7 中 `markdown-editor.tsx` 对它的直接引用随全文替换移除。）

`packages/markdown/src/index.ts` 全文替换为：

```ts
export { MarkdownEditor } from './markdown-editor'
export type { MarkdownEditorHandle, MarkdownEditorProps, MarkdownEditorSlots, ViewMode } from './types'
export {
  MARKDOWN_TOOLBAR_LAYOUT,
  codeExtension,
  formatExtension,
  imageExtension,
  linkExtension,
  listExtension,
  markdownCoreExtensions,
  moreActionsExtension,
  moreFormatExtension,
  moreInsertExtension,
} from './core-extensions'
```

`packages/markdown/src/styles.css` 末尾追加：

```css
.ex-mde-toolbar { flex: none; padding: var(--ex-space-2) var(--ex-space-3); border-bottom: 1px solid var(--ex-color-border); }

.ex-mde[data-fullscreen] {
  position: fixed;
  inset: 0;
  z-index: var(--ex-z-modal);
  height: auto;
  background: var(--ex-color-bg);
}

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

（全屏 z-index 与 Modal 同层：全屏中打开的 Modal 后挂载，按 DOM 顺序位于其上。）

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @editorx/toolbar build; pnpm --filter @editorx/markdown exec vitest run; pnpm --filter @editorx/markdown typecheck; pnpm lint`
Expected: 全部 PASS（含 Task 7/8 的既有用例：工具栏加入后 `screen.getByRole('button', ...)` 的查询仍唯一）；类型检查与 lint 无错误。

- [ ] **Step 6: 提交**

```powershell
git add packages/markdown/src/internals.ts
git add packages/markdown/src/context.ts
git add packages/markdown/src/download.ts
git add packages/markdown/src/core-extensions/format.tsx
git add packages/markdown/src/core-extensions/blocks.tsx
git add packages/markdown/src/core-extensions/insert.tsx
git add packages/markdown/src/core-extensions/actions.tsx
git add packages/markdown/src/core-extensions/dialogs.tsx
git add packages/markdown/src/core-extensions/index.ts
git add packages/markdown/src/core-extensions/core-extensions.test.tsx
git add packages/markdown/src/context.test.ts
git add packages/markdown/src/markdown-editor.tsx
git add packages/markdown/src/types.ts
git add packages/markdown/src/index.ts
git add packages/markdown/src/styles.css
git commit -m "feat(markdown): 扩展上下文与 CSDN 布局的内置工具栏" -m "createMarkdownContext 实现 ExtensionContext（插入/替换/嵌入块/文档/命令/面板/上传/通知，属性为 live getter），内置扩展所需的引擎与全屏能力经包内 WeakMap 提供。" -m "markdownCoreExtensions 按 CSDN 布局提供格式、列表、代码、更多格式、图片/链接/表格对话框、公式/目录/Mermaid、导入导出、语法说明与全屏；快捷键在编辑区内、引擎自身处理之后执行。" -m "MarkdownEditor 新增 extensions/coreExtensions/toolbarLayout/missingAdapter 与 ref.insert；扩展异常统一 toast 提示。"
```

---

### Task 10: 3a 全量验证

**Files:** 无新增（只在发现问题时修复对应文件，修复单独提交）。

- [ ] **Step 1: 全量构建、单测、类型检查、lint**

Run: `pnpm build; pnpm test; pnpm typecheck; pnpm lint`
Expected:
- build：`@editorx/{theme,ui,toolbar,markdown-core,markdown}` 与 playground 均成功；
- test：全部包 PASS（含 `dist.test.ts`：toolbar/markdown 首行 `'use client';`，markdown-core 不含）；
- typecheck、lint：0 错误，无新增 exhaustive-deps 警告。

- [ ] **Step 2: 既有 e2e 与性能回归（基线不得变化）**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @editorx/playground exec playwright test --project chromium
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @editorx/playground exec playwright test --project chromium-perf --no-deps
```

Expected: `chromium` 全部通过（`showcase-*`、`markdown-core-*` 截图无差异）；`chromium-perf` 两个 `@perf` 用例通过（3a 未改动 `/markdown-core` 页，用于确认 markdown-core 命令改动未退化）。

- [ ] **Step 3: 工作区检查**

Run: `git status --short`
Expected: 无未提交改动；无 `*.png` 基线变更；无误提交的 `dist/`、`.next/`、`test-results/`。

- [ ] **Step 4: 提交（仅当 Step 1–2 中有修复）**

```powershell
git add <修复的文件，逐个>
git commit -m "fix(<scope>): <修复内容>" -m "<原因与影响>"
```

---

## 假设与风险（执行前确认）

1. **onChange 时机**：按 phase3-notes 采用「防抖渲染后发出、html 与预览同源」。受控模式下父组件对 onChange 值做变换后回写，若用户在这 200ms 内继续输入，回写会覆盖这部分输入（与所有防抖受控编辑器相同）。需要逐键同步的宿主应使用非受控 + `ref.getValue()`。
2. **`useExtensionSetup`**：扩展数组（经 `useStableArray`）变化时整体清理并重跑全部 setup，而不是只处理增删。扩展数量很少，这样做换来的是简单的语义；文档注明 setup 必须幂等。
3. **全屏与 Modal 同 z-index**：依赖 DOM 顺序让 Modal 位于全屏编辑器之上。若宿主自定义 `--ex-z-*` 顺序，需要另行调整。
4. **从菜单/溢出菜单选中的 popover 条目以 Modal 打开**（没有可锚定的按钮），属于有意的降级。
5. **subscript 与删除线**：`~` 包裹和 `~~` 相邻时，`toggleWrap` 的取消判断可能把 `~~x~~` 视为 subscript 包裹。阶段 3 只保证对普通文本添加 `~x~`；双向切换的边界情况记入 phase 4 notes。
6. **jsdom 限制**：溢出测量、Tooltip 定位在 jsdom 中靠 mock 宽度验证；真实布局在 3b 的 e2e 中验证。`fireEvent.paste` 构造的 `clipboardData` 依赖 Testing Library 对 `clipboardData`/`dataTransfer` 的属性注入。
7. **`PublishSettings`/`VoteInput` 等类型**按 spec §6.3 定义为暂定形状，阶段 4 可以调整。由于它们只是类型，调整不会破坏 3a 的实现。

## Self-Review

- **Spec 覆盖**：
  - §5.1 共享类型（Task 3）；§5.2 扩展协议（Task 4）。
  - §5.3 规则：分组布局、内置即扩展、同名替换、embeds 进渲染器、`missingAdapter`、setup 清理、异常隔离（Task 4、5、9）。
  - §6.1 props 与 ref：`value`/`defaultValue`/`onChange`/`adapters`/`extensions`/`toolbarLayout`/`viewMode`/`theme`/`height`/`placeholder`/`missingAdapter`/`locale`/`engine`，以及 `getDocument`/`insert`/`setValue`/`focus`/`getEngine`，另加 `getValue`/`getHtml`/`runCommand`（Task 7、8、9）。
  - 图片上传占位、重试与删除（Task 8）；§6.5 主题（Task 1、7）；§6.6 i18n（Task 3）；§7 错误处理（Task 5、8、9）。
  - 交给 3b 的项：`autoSaveInterval`、状态栏、拖动分隔条、目录/语法面板、视觉回归。
- **阶段 1 遗留**：
  - 嵌套浮层与 FloatingTree（Task 2）。
  - body 级主题 portal（Task 1）。
  - `useOptionalTheme`，以及 peer 依赖约束（Global Constraints、Task 3、6）。
  - Dropdown 的菜单角色和方向键、Modal 的 `aria-label`、Toast 的 alert 角色和关闭按钮（Task 2）。
  - `restoreMocks`（Task 1、3、6）；`MessagesProvider`（Task 3）。
  - 主题切换时禁用 transition、`ready` 标志（Task 1）。
- **phase3-notes 规则**：
  - 引擎只创建一次；remount 时沿用引擎内的值和撤销历史；先退订再 destroy。
  - setter 原地更新；滚动同步放在独立 effect 中。
  - 图表在 `ready` 之后才绘制；只在客户端创建渲染器；`'use client'` 只加在 React 包（Task 7、Global Constraints）。
- **类型一致性**：
  - `ResolvedItem.children` 在 layout、Toolbar、overflow 中用法一致。
  - `ExtensionContext.formats` 是 `ReadonlySet<string>`，store 的 `formats` 类型相同。
  - `MarkdownEditorHandle.insert` 在 Task 9 中同时加入类型与实现。
  - `PreviewStats` 由 Task 6 产出，store 消费。
- **占位符扫描**：所有步骤都包含完整代码或完整的修改片段，没有 TBD。Task 6 中 `styles.css`/`index.ts` 的初始内容会在 Task 7 中按全文替换明确给出。
