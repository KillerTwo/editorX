# Phase 2b：markdown-core 编辑引擎（ClEditEngine）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@geekx/markdown-core` 中交付 `ClEditEngine`（StackEdit cledit 的 TS 移植，contenteditable + 分段 Markdown 高亮 + 撤销 + 选区保持 + IME 兼容）、编辑器/预览样式、双向同步滚动，并在 playground `/markdown-core` 页用 Playwright 验证输入、IME、同步滚动、KaTeX/Mermaid、10k 行性能与亮/暗视觉基线。

**Architecture:** 引擎代码全部位于 `packages/markdown-core/src/engine/**`：`cledit/` 子目录是框架无关的小模块（utils / watcher / marker / undo / selection / highlighter / keystrokes），`cl-edit-engine.ts` 组装它们并实现 2a 定义的 `EditorEngine`。高亮按 2a 的 `splitSections` 切段，每段一个 `<div class="ex-editor-section" data-section-index>`，只替换文本变化的段，从而与预览 `.ex-preview-section[data-section-index]` 一一对应；`src/scroll-sync/**` 用两侧段偏移做线性插值。playground 页面只消费公共 API。

**Tech Stack:** TypeScript ~5.9.3、prismjs（编辑区 Markdown 语法高亮，自定义 grammar）、Vitest 5 + jsdom、tsup、Next 16 App Router（playground）、Playwright 1.64（Chromium + CDP IME）。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md`（§4.1 编辑层接口、§4.3 同步滚动、§9 测试策略、§11 风险）；共享契约 `.superpowers/phase2-contract.md`（与 2a 绑定，类型与文件归属以其为准）。

## Global Constraints

- 包代码（`packages/markdown-core/src/**`）不得依赖 React；dist 不得带 `'use client'` 横幅（playground 页面可用 React）。
- TypeScript `~5.9.3`；单元测试 Vitest v5（jsdom 环境 + `tooling/test/setup-dom.ts`）；playground 为 Next 16 App Router，端口 `:3100`。
- CSS 类名一律 `.ex-` 前缀；颜色/尺寸只用 `--ex-*` 变量；新增颜色 token 必须同时加入 `packages/theme/src/styles.css` 主块（`light-dark()`）与 `@supports not (color: light-dark(#000, #fff))` 兜底的三个块（亮、暗、system+dark），`packages/theme/src/styles.test.ts` 的一致性测试必须通过。
- 类型以 2a 的 `src/types.ts` 为准（`EditorEngine`、`EngineOptions`、`Selection`、`SectionOffset`、`EngineEvent`、`Unsubscribe`、`SourceSection`），本计划不得修改该文件；`src/index.ts` 只追加导出。
- 文件归属：2b 只创建/修改 `src/engine/**`、`src/scroll-sync/**`、`src/styles.css`、`src/index.ts`（追加）、`package.json`（追加 prismjs 依赖）、`packages/theme/src/styles.css`（追加 token）、`apps/playground/app/markdown-core/**`、`apps/playground/e2e/markdown-core.spec.ts`、`apps/playground/package.json`、`apps/playground/app/page.tsx`（追加链接）。
- 移植自 StackEdit 的文件顶部必须带归属注释：`// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: <相对路径>`。
- Shell 为 Windows PowerShell：命令用 `;` 串联，不用 `&&`。
- Playwright `webServer` 运行 `pnpm start`（先 `pnpm --filter @geekx/playground build`）；跑 e2e 前先停止残留 `:3100` 进程：`Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`。
- 不得重新生成已有视觉基线（只用 `--update-snapshots` 生成本计划新增的 `markdown-core-*.png`，且限定 `-g` 到新用例）；截图阈值 `maxDiffPixelRatio: 0.001`。
- 提交信息：中文 Conventional Commits，标题 + 空行 + 3 行描述；只 `git add` 明确列出的文件，禁止 `git add .` / `git add -A`。

---

## File Structure

```
packages/markdown-core/
  package.json                         # 追加 dependencies: prismjs, devDependencies: @types/prismjs
  src/
    index.ts                           # 追加 2b 导出
    styles.css                         # 编辑区高亮 token + 预览基础样式
    styles.test.ts                     # 只用 --ex-* 变量、类名 .ex- 前缀
    engine/
      cledit/
        utils.ts         utils.test.ts        # 文本 diff、节流、DOM 文本偏移
        watcher.ts       watcher.test.ts      # MutationObserver 包装（可暂停）
        marker.ts        marker.test.ts       # 随编辑平移的文本偏移标记
        undo.ts          undo.test.ts         # 撤销/重做栈（文本+选区快照，合并相邻输入）
        selection.ts     selection.test.ts    # 文本偏移 <-> DOM Range 互转，选区保存/恢复
        grammar.ts       grammar.test.ts      # 编辑区 Markdown Prism grammar
        highlighter.ts   highlighter.test.ts  # 分段高亮、只替换变化段
        keystrokes.ts    keystrokes.test.ts   # Enter 列表续写 / Tab / Shift-Tab / Backspace
      cl-edit-engine.ts  cl-edit-engine.test.ts  # 实现 EditorEngine
      index.ts                                # 引擎子模块出口
    scroll-sync/
      interpolate.ts     interpolate.test.ts      # 纯插值函数
      scroll-sync.ts     scroll-sync.test.ts      # createScrollSync
      index.ts
packages/theme/src/styles.css            # 追加 --ex-color-md-* token（主块 + 兜底三块）
apps/playground/
  package.json                           # 追加 @geekx/markdown-core 依赖
  app/page.tsx                           # 追加 /markdown-core 链接
  app/markdown-core/page.tsx             # server 页面壳
  app/markdown-core/markdown-core-demo.tsx  # 'use client'：引擎 + 预览 + 同步滚动
  app/markdown-core/sample.ts            # 示例文档与 10k 行生成器
  e2e/markdown-core.spec.ts
```

## Tasks

- Task 1: cledit 基础模块（utils / watcher / marker / undo）
- Task 2: 选区管理器（selection）
- Task 3: 编辑区 Markdown grammar + 分段高亮器
- Task 4: 按键处理（keystrokes）
- Task 5: ClEditEngine 组装（EditorEngine 实现、事件、IME、段偏移）
- Task 6: 样式（编辑区高亮 + 预览基础样式 + theme token）
- Task 7: 同步滚动（插值纯函数 + createScrollSync）
- Task 8: playground `/markdown-core` 页面 + Playwright e2e + 视觉基线

测试命令约定（2a 的脚手架提供 `test` = `vitest run`）：单文件用 `pnpm --filter @geekx/markdown-core exec vitest run <相对 src 的路径>`。

---

### Task 1: cledit 基础模块（utils / watcher / marker / undo）

**Files:**
- Create: `packages/markdown-core/src/engine/cledit/utils.ts`, `utils.test.ts`
- Create: `packages/markdown-core/src/engine/cledit/watcher.ts`, `watcher.test.ts`
- Create: `packages/markdown-core/src/engine/cledit/marker.ts`, `marker.test.ts`
- Create: `packages/markdown-core/src/engine/cledit/undo.ts`, `undo.test.ts`

**Interfaces:**
- Consumes（2a `src/types.ts`）: `Selection { start: number; end: number }`、`TextState { text: string; selection: Selection }`。
- Produces:
  - `interface TextChange { start: number; removed: string; inserted: string }`
  - `diffRange(oldText: string, newText: string): TextChange | null`（公共前缀/后缀单区间 diff；相等返回 `null`）
  - `applyChange(text: string, change: TextChange): string`、`revertChange(text: string, change: TextChange): string`
  - `debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { cancel(): void; flush(): void }`
  - `class Watcher { constructor(el: Node, listener: MutationCallback); readonly isWatching: boolean; start(): void; stop(): void; noWatch(cb: () => void): void }`
  - `class Marker { offset: number; readonly trailing: boolean; constructor(offset: number, trailing?: boolean); adjust(change: TextChange): void }`
  - `type UndoMode = 'typing' | 'deleting' | 'single'`
  - `class UndoManager { constructor(opts?: { maxSize?: number; mergeWindowMs?: number; now?: () => number }); record(change: TextChange, before: Selection, after: Selection, mode: UndoMode): void; undo(text: string): TextState | null; redo(text: string): TextState | null; canUndo(): boolean; canRedo(): boolean; breakMerge(): void; clear(): void }`

**移植说明（偏差）：** 参考 `src/services/editor/cledit/cleditUtils.js`、`cleditWatcher.js`(1-32)、`cleditMarker.js`(1-43)、`cleditUndoMgr.js`(1-152)。偏差：去掉 `cledit` 全局与 `cl_each/cl_bind` 原型扩展；不引入 `diff-match-patch`——cledit 每次 DOM 变更只产生一处连续编辑，用公共前后缀 diff 得到单区间 `TextChange` 即可，撤销栈存 `TextChange[]` + 前后选区（内存与文本大小无关）；`UndoMgr` 的 `StateMgr` 缓冲模式改为显式 `mode` + `mergeWindowMs`（默认 1000，同 `bufferStateUntilIdle`）合并；`maxSize` 默认 200（同 `undoStackMaxSize`）；`undo/redo` 不直接操作 DOM，返回新 `TextState` 由引擎应用。

- [ ] **Step 1: 写 utils / marker 失败测试**

`packages/markdown-core/src/engine/cledit/utils.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyChange, debounce, diffRange, revertChange } from './utils'

describe('diffRange', () => {
  it('相同文本返回 null', () => {
    expect(diffRange('abc', 'abc')).toBeNull()
  })

  it('中间插入', () => {
    expect(diffRange('abef', 'abcdef')).toEqual({ start: 2, removed: '', inserted: 'cd' })
  })

  it('中间删除', () => {
    expect(diffRange('abcdef', 'abef')).toEqual({ start: 2, removed: 'cd', inserted: '' })
  })

  it('替换', () => {
    expect(diffRange('hello world', 'hello there')).toEqual({ start: 6, removed: 'world', inserted: 'there' })
  })

  it('重复字符时前缀优先、后缀不越过前缀', () => {
    expect(diffRange('aaa', 'aaaa')).toEqual({ start: 3, removed: '', inserted: 'a' })
  })

  it('applyChange / revertChange 互逆', () => {
    const before = '# 标题\n\n正文'
    const after = '# 标题\n\n新的正文内容'
    const change = diffRange(before, after)!
    expect(applyChange(before, change)).toBe(after)
    expect(revertChange(after, change)).toBe(before)
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('在静默期结束后只调用一次并使用最后一次参数', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 50)
    d(1)
    d(2)
    vi.advanceTimersByTime(49)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('cancel 取消，flush 立即执行', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 50)
    d(1)
    d.cancel()
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
    d(3)
    d.flush()
    expect(fn).toHaveBeenCalledExactlyOnceWith(3)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

`packages/markdown-core/src/engine/cledit/marker.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Marker } from './marker'

describe('Marker', () => {
  it('前方插入时后移', () => {
    const m = new Marker(5)
    m.adjust({ start: 2, removed: '', inserted: 'ab' })
    expect(m.offset).toBe(7)
  })

  it('在标记处插入：非 trailing 后移，trailing 不动', () => {
    const a = new Marker(5)
    const b = new Marker(5, true)
    a.adjust({ start: 5, removed: '', inserted: 'xy' })
    b.adjust({ start: 5, removed: '', inserted: 'xy' })
    expect(a.offset).toBe(7)
    expect(b.offset).toBe(5)
  })

  it('后方编辑不影响', () => {
    const m = new Marker(3)
    m.adjust({ start: 4, removed: 'abc', inserted: 'z' })
    expect(m.offset).toBe(3)
  })

  it('删除覆盖标记时收缩到删除起点', () => {
    const m = new Marker(3)
    m.adjust({ start: 2, removed: 'abcd', inserted: '' })
    expect(m.offset).toBe(2)
  })

  it('删除在标记之前时前移删除长度', () => {
    const m = new Marker(5)
    m.adjust({ start: 1, removed: 'ab', inserted: '' })
    expect(m.offset).toBe(3)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/utils.test.ts src/engine/cledit/marker.test.ts`
Expected: FAIL，`Failed to resolve import "./utils"` / `"./marker"`。

- [ ] **Step 3: 实现 utils 与 marker**

`packages/markdown-core/src/engine/cledit/utils.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditUtils.js
export interface TextChange {
  start: number
  removed: string
  inserted: string
}

export function diffRange(oldText: string, newText: string): TextChange | null {
  if (oldText === newText) return null
  const maxPrefix = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < maxPrefix && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++
  const maxSuffix = Math.min(oldText.length, newText.length) - prefix
  let suffix = 0
  while (
    suffix < maxSuffix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) === newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++
  }
  return {
    start: prefix,
    removed: oldText.slice(prefix, oldText.length - suffix),
    inserted: newText.slice(prefix, newText.length - suffix),
  }
}

export function applyChange(text: string, change: TextChange): string {
  return text.slice(0, change.start) + change.inserted + text.slice(change.start + change.removed.length)
}

export function revertChange(text: string, change: TextChange): string {
  return text.slice(0, change.start) + change.removed + text.slice(change.start + change.inserted.length)
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
): ((...args: A) => void) & { cancel(): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined
  const run = () => {
    timer = undefined
    const args = pending
    pending = undefined
    if (args) fn(...args)
  }
  const debounced = (...args: A) => {
    pending = args
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(run, wait)
  }
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  debounced.flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    run()
  }
  return debounced
}
```

`packages/markdown-core/src/engine/cledit/marker.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditMarker.js
import type { TextChange } from './utils'

export class Marker {
  offset: number
  readonly trailing: boolean

  constructor(offset: number, trailing = false) {
    this.offset = offset
    this.trailing = trailing
  }

  adjust(change: TextChange): void {
    const { start, removed, inserted } = change
    if (this.offset > start) this.offset -= Math.min(removed.length, this.offset - start)
    if (this.trailing ? this.offset > start : this.offset >= start) this.offset += inserted.length
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/utils.test.ts src/engine/cledit/marker.test.ts`
Expected: PASS（13 个用例）。

- [ ] **Step 5: 写 watcher / undo 失败测试**

`packages/markdown-core/src/engine/cledit/watcher.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { Watcher } from './watcher'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('Watcher', () => {
  it('start 后上报子树文本变化', async () => {
    const el = document.createElement('div')
    el.appendChild(document.createTextNode('a'))
    const listener = vi.fn()
    const w = new Watcher(el, listener)
    w.start()
    expect(w.isWatching).toBe(true)
    ;(el.firstChild as Text).data = 'b'
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
    w.stop()
    expect(w.isWatching).toBe(false)
  })

  it('noWatch 内的变化不会上报，之后恢复监听', async () => {
    const el = document.createElement('div')
    const listener = vi.fn()
    const w = new Watcher(el, listener)
    w.start()
    w.noWatch(() => {
      el.textContent = 'silent'
    })
    await flush()
    expect(listener).not.toHaveBeenCalled()
    expect(w.isWatching).toBe(true)
    el.textContent = 'loud'
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
    w.stop()
  })

  it('未监听时 noWatch 直接执行且保持未监听', () => {
    const w = new Watcher(document.createElement('div'), vi.fn())
    const cb = vi.fn()
    w.noWatch(cb)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(w.isWatching).toBe(false)
  })
})
```

`packages/markdown-core/src/engine/cledit/undo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { UndoManager } from './undo'
import { applyChange, diffRange } from './utils'

function makeClock() {
  let t = 0
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

function edit(um: UndoManager, text: string, next: string, mode: 'typing' | 'deleting' | 'single') {
  const change = diffRange(text, next)!
  const before = { start: change.start, end: change.start + change.removed.length }
  const caret = change.start + change.inserted.length
  um.record(change, before, { start: caret, end: caret }, mode)
  return applyChange(text, change)
}

describe('UndoManager', () => {
  it('合并窗口内的连续输入合并为一步', () => {
    const clock = makeClock()
    const um = new UndoManager({ now: clock.now })
    let text = ''
    text = edit(um, text, 'a', 'typing')
    clock.advance(100)
    text = edit(um, text, 'ab', 'typing')
    clock.advance(100)
    text = edit(um, text, 'abc', 'typing')
    const undone = um.undo(text)!
    expect(undone.text).toBe('')
    expect(undone.selection).toEqual({ start: 0, end: 0 })
    expect(um.canUndo()).toBe(false)
  })

  it('超过合并窗口或模式变化时拆成多步', () => {
    const clock = makeClock()
    const um = new UndoManager({ now: clock.now, mergeWindowMs: 1000 })
    let text = 'x'
    text = edit(um, text, 'xa', 'typing')
    clock.advance(1500)
    text = edit(um, text, 'xab', 'typing')
    text = edit(um, text, 'xa', 'deleting')
    let s = um.undo(text)!
    expect(s.text).toBe('xab')
    s = um.undo(s.text)!
    expect(s.text).toBe('xa')
    s = um.undo(s.text)!
    expect(s.text).toBe('x')
    expect(um.undo(s.text)).toBeNull()
  })

  it('single 模式永不合并；breakMerge 强制断开', () => {
    const um = new UndoManager({ now: () => 0 })
    let text = ''
    text = edit(um, text, 'a', 'single')
    text = edit(um, text, 'ab', 'single')
    text = edit(um, text, 'abc', 'typing')
    um.breakMerge()
    text = edit(um, text, 'abcd', 'typing')
    const steps: string[] = []
    let s = um.undo(text)
    while (s) {
      steps.push(s.text)
      s = um.undo(s.text)
    }
    expect(steps).toEqual(['abc', 'ab', 'a', ''])
  })

  it('redo 恢复文本与选区；新编辑清空 redo 栈', () => {
    const um = new UndoManager({ now: () => 0 })
    let text = edit(um, 'hello', 'hello world', 'single')
    const undone = um.undo(text)!
    expect(undone.text).toBe('hello')
    expect(undone.selection).toEqual({ start: 5, end: 5 })
    expect(um.canRedo()).toBe(true)
    const redone = um.redo(undone.text)!
    expect(redone.text).toBe('hello world')
    expect(redone.selection).toEqual({ start: 11, end: 11 })
    text = redone.text
    um.undo(text)
    text = edit(um, 'hello', 'hello!', 'single')
    expect(um.canRedo()).toBe(false)
    expect(text).toBe('hello!')
  })

  it('超过 maxSize 时丢弃最旧条目', () => {
    const um = new UndoManager({ now: () => 0, maxSize: 2 })
    let text = ''
    for (const ch of ['a', 'b', 'c']) text = edit(um, text, text + ch, 'single')
    let s = um.undo(text)!
    s = um.undo(s.text)!
    expect(s.text).toBe('a')
    expect(um.undo(s.text)).toBeNull()
  })

  it('clear 清空两个栈', () => {
    const um = new UndoManager()
    edit(um, '', 'a', 'single')
    um.clear()
    expect(um.canUndo()).toBe(false)
    expect(um.canRedo()).toBe(false)
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/watcher.test.ts src/engine/cledit/undo.test.ts`
Expected: FAIL，`Failed to resolve import "./watcher"` / `"./undo"`。

- [ ] **Step 7: 实现 watcher 与 undo**

`packages/markdown-core/src/engine/cledit/watcher.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditWatcher.js
export class Watcher {
  private observer: MutationObserver | undefined
  private watching = false

  constructor(
    private readonly el: Node,
    private readonly listener: MutationCallback,
  ) {}

  get isWatching(): boolean {
    return this.watching
  }

  start(): void {
    this.stop()
    this.observer = new MutationObserver(this.listener)
    this.observer.observe(this.el, { childList: true, subtree: true, characterData: true })
    this.watching = true
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.watching = false
  }

  noWatch(cb: () => void): void {
    if (!this.watching) {
      cb()
      return
    }
    this.stop()
    try {
      cb()
    } finally {
      this.start()
    }
  }
}
```

`packages/markdown-core/src/engine/cledit/undo.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditUndoMgr.js
import type { Selection, TextState } from '../../types'
import { applyChange, revertChange, type TextChange } from './utils'

export type UndoMode = 'typing' | 'deleting' | 'single'

interface UndoEntry {
  changes: TextChange[]
  before: Selection
  after: Selection
  mode: UndoMode
  time: number
}

export interface UndoManagerOptions {
  maxSize?: number
  mergeWindowMs?: number
  now?: () => number
}

export class UndoManager {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private mergeBroken = true
  private readonly maxSize: number
  private readonly mergeWindowMs: number
  private readonly now: () => number

  constructor(opts: UndoManagerOptions = {}) {
    this.maxSize = opts.maxSize ?? 200
    this.mergeWindowMs = opts.mergeWindowMs ?? 1000
    this.now = opts.now ?? Date.now
  }

  record(change: TextChange, before: Selection, after: Selection, mode: UndoMode): void {
    this.redoStack = []
    const time = this.now()
    const last = this.undoStack[this.undoStack.length - 1]
    if (
      last &&
      !this.mergeBroken &&
      mode !== 'single' &&
      last.mode === mode &&
      time - last.time < this.mergeWindowMs
    ) {
      last.changes.push(change)
      last.after = after
      last.time = time
    } else {
      this.undoStack.push({ changes: [change], before, after, mode, time })
      while (this.undoStack.length > this.maxSize) this.undoStack.shift()
    }
    this.mergeBroken = false
  }

  undo(text: string): TextState | null {
    const entry = this.undoStack.pop()
    if (!entry) return null
    let next = text
    for (let i = entry.changes.length - 1; i >= 0; i--) next = revertChange(next, entry.changes[i]!)
    this.redoStack.push(entry)
    this.mergeBroken = true
    return { text: next, selection: { ...entry.before } }
  }

  redo(text: string): TextState | null {
    const entry = this.redoStack.pop()
    if (!entry) return null
    let next = text
    for (const change of entry.changes) next = applyChange(next, change)
    this.undoStack.push(entry)
    this.mergeBroken = true
    return { text: next, selection: { ...entry.after } }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  breakMerge(): void {
    this.mergeBroken = true
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.mergeBroken = true
  }
}
```

- [ ] **Step 8: 运行确认通过 + 类型检查**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit; pnpm --filter @geekx/markdown-core typecheck`
Expected: 4 个测试文件全部 PASS；typecheck 无错误。

- [ ] **Step 9: 提交**

```powershell
git add packages/markdown-core/src/engine/cledit/utils.ts packages/markdown-core/src/engine/cledit/utils.test.ts packages/markdown-core/src/engine/cledit/marker.ts packages/markdown-core/src/engine/cledit/marker.test.ts packages/markdown-core/src/engine/cledit/watcher.ts packages/markdown-core/src/engine/cledit/watcher.test.ts packages/markdown-core/src/engine/cledit/undo.ts packages/markdown-core/src/engine/cledit/undo.test.ts
git commit -m "feat(markdown-core): 移植 cledit 基础模块（diff、监听、标记、撤销栈）" -m "以公共前后缀单区间 diff 替代 diff-match-patch，撤销栈只存变更与选区。" -m "Watcher 封装 MutationObserver 并支持 noWatch 静默修改 DOM。" -m "UndoManager 按输入模式与 1s 窗口合并步骤，上限 200 条。"
```

### Task 2: 选区管理器（selection）

**Files:**
- Create: `packages/markdown-core/src/engine/cledit/selection.ts`
- Test: `packages/markdown-core/src/engine/cledit/selection.test.ts`

**Interfaces:**
- Consumes: `Selection`（2a `src/types.ts`）。
- Produces:
  - `interface DomPosition { node: Node; offset: number }`
  - `interface SectionLocator { sectionAt(offset: number): { el: Node; start: number } | undefined; sectionStart(el: Node): number | undefined }`（Task 3 高亮器实现；未提供时退化为线性遍历）
  - `findPosition(root: Node, offset: number, locator?: SectionLocator): DomPosition`
  - `getTextOffset(root: Node, node: Node, nodeOffset: number, locator?: SectionLocator): number`
  - `class SelectionManager { constructor(root: HTMLElement, locator?: SectionLocator); get(): Selection; set(start: number, end: number): void; save(): Selection | null; restore(): void; hasFocus(): boolean; createRange(start: number, end: number): Range }`
    - `set` 只记录偏移（负数夹到 0，`start > end` 表示反向选区），`hasFocus()` 时立即 `restore()`。
    - `save()` 读取 `window.getSelection()`；选区不在 `root` 内返回 `null` 且不改动记录；否则按锚点/焦点计算偏移（保留方向）并记录。
    - `restore()` 把记录的偏移写回原生选区；反向选区用 `Selection.extend`。

**DOM 文本模型（Task 3/5 依赖）：** `root.textContent` 与引擎内部文本逐字符相等（换行就是 `\n` 文本，`white-space: pre-wrap`，不用 `<br>`），所以"文本偏移"="`root` 内文本节点按文档顺序的字符偏移"。

**移植说明（偏差）：** 参考 `cleditSelectionMgr.js` 的 `findContainer`(15-28)、`createRange`(30-44)、`restoreSelection`(104-124)、`saveSelectionState`(145-335)。偏差：删除光标坐标/自动滚动（`updateCursorCoordinates`、`getCoordinates`，由浏览器原生 caret 滚动代替）、删除 WebKit `<br>`/`hd-lf` 兼容分支（我们只写 `\n` 文本，并在 Task 5 使用 `contenteditable="plaintext-only"`）、删除事件钩子（引擎负责派发 `selectionChange`）；偏移计算改为"所在段起点（`SectionLocator`）+ 段内 `Range.toString().length`"，避免 10k 行文档每次全量遍历。

**jsdom 局限（延后到 Task 8 e2e）：** jsdom 无布局，`Selection.modify`、caret 渲染、原生输入产生的 DOM 变更、IME 都无法验证；这里只测偏移 ⇄ DOM 位置换算与 `Selection` API 读写（jsdom 已实现 `Range`、`getSelection`、`addRange`、`extend`）。

- [ ] **Step 1: 写失败测试**

`packages/markdown-core/src/engine/cledit/selection.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { findPosition, getTextOffset, SelectionManager, type SectionLocator } from './selection'

function build(html: string): HTMLElement {
  const root = document.createElement('div')
  root.tabIndex = 0
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

const HTML =
  '<div class="s"><span class="h"># </span><span>Title</span>\n</div>' +
  '<div class="s">body <b>bold</b>\n</div>'
// text: "# Title\n" (0-8) + "body bold\n" (8-18)

describe('findPosition / getTextOffset', () => {
  it('偏移落到正确的文本节点', () => {
    const root = build(HTML)
    const p = findPosition(root, 3)
    expect(p.node.textContent).toBe('Title')
    expect(p.offset).toBe(1)
    const q = findPosition(root, 14)
    expect(q.node.textContent).toBe('bold')
    expect(q.offset).toBe(1)
  })

  it('越界偏移夹到末尾；空 root 返回 (root, 0)', () => {
    const root = build(HTML)
    const end = findPosition(root, 999)
    expect(getTextOffset(root, end.node, end.offset)).toBe(18)
    const empty = build('')
    expect(findPosition(empty, 5)).toEqual({ node: empty, offset: 0 })
  })

  it('getTextOffset 与 findPosition 互逆', () => {
    const root = build(HTML)
    for (let i = 0; i <= 18; i++) {
      const p = findPosition(root, i)
      expect(getTextOffset(root, p.node, p.offset)).toBe(i)
    }
  })

  it('元素容器 + 子节点下标也能换算', () => {
    const root = build(HTML)
    const second = root.children[1]!
    expect(getTextOffset(root, second, 0)).toBe(8)
    expect(getTextOffset(root, root, 1)).toBe(8)
    expect(getTextOffset(root, root, 2)).toBe(18)
  })

  it('使用 SectionLocator 时结果一致且不遍历其他段', () => {
    const root = build(HTML)
    const els = [...root.children]
    const starts = [0, 8]
    const calls: number[] = []
    const locator: SectionLocator = {
      sectionAt(offset) {
        calls.push(offset)
        const i = offset >= 8 ? 1 : 0
        return { el: els[i]!, start: starts[i]! }
      },
      sectionStart(el) {
        const i = els.indexOf(el as Element)
        return i === -1 ? undefined : starts[i]
      },
    }
    const p = findPosition(root, 14, locator)
    expect(p.node.textContent).toBe('bold')
    expect(getTextOffset(root, p.node, p.offset, locator)).toBe(14)
    expect(calls).toEqual([14])
  })
})

describe('SelectionManager', () => {
  it('set 在聚焦时写入原生选区，save 读回偏移', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(2, 7)
    const range = window.getSelection()!.getRangeAt(0)
    expect(range.toString()).toBe('Title')
    window.getSelection()!.removeAllRanges()
    const r = sm.createRange(8, 12)
    window.getSelection()!.addRange(r)
    expect(sm.save()).toEqual({ start: 8, end: 12 })
    expect(sm.get()).toEqual({ start: 8, end: 12 })
  })

  it('未聚焦时 set 只记录不写原生选区', () => {
    const root = build(HTML)
    const sm = new SelectionManager(root)
    sm.set(-3, 4)
    expect(sm.get()).toEqual({ start: 0, end: 4 })
    expect(window.getSelection()!.rangeCount).toBe(0)
  })

  it('选区在 root 外时 save 返回 null 且保留旧值', () => {
    const root = build(HTML)
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)
    const sm = new SelectionManager(root)
    sm.set(1, 1)
    const r = document.createRange()
    r.selectNodeContents(outside)
    window.getSelection()!.addRange(r)
    expect(sm.save()).toBeNull()
    expect(sm.get()).toEqual({ start: 1, end: 1 })
  })

  it('反向选区：restore 后 save 仍保持方向', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(12, 8)
    expect(sm.save()).toEqual({ start: 12, end: 8 })
  })

  it('DOM 被整体替换后 restore 仍按偏移定位', () => {
    const root = build(HTML)
    root.focus()
    const sm = new SelectionManager(root)
    sm.set(3, 3)
    root.innerHTML = '<div># Title\n</div><div>body bold\n</div>'
    sm.restore()
    const sel = window.getSelection()!
    expect(sel.anchorNode!.textContent).toBe('# Title\n')
    expect(sel.anchorOffset).toBe(3)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/selection.test.ts`
Expected: FAIL，`Failed to resolve import "./selection"`。

- [ ] **Step 3: 实现**

`packages/markdown-core/src/engine/cledit/selection.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditSelectionMgr.js
import type { Selection } from '../../types'

export interface DomPosition {
  node: Node
  offset: number
}

export interface SectionLocator {
  sectionAt(offset: number): { el: Node; start: number } | undefined
  sectionStart(el: Node): number | undefined
}

function topLevelChild(root: Node, node: Node): Node | undefined {
  let current: Node | null = node
  while (current && current.parentNode !== root) current = current.parentNode
  return current ?? undefined
}

function positionIn(container: Node, offset: number): DomPosition | undefined {
  const walker = container.ownerDocument!.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let last: Text | undefined
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text
    if (remaining <= text.length) return { node: text, offset: remaining }
    remaining -= text.length
    last = text
  }
  return last ? { node: last, offset: last.length } : undefined
}

export function findPosition(root: Node, offset: number, locator?: SectionLocator): DomPosition {
  const target = Math.max(0, offset)
  const section = locator?.sectionAt(target)
  if (section) {
    const pos = positionIn(section.el, target - section.start)
    if (pos) return pos
  }
  return positionIn(root, target) ?? { node: root, offset: 0 }
}

export function getTextOffset(root: Node, node: Node, nodeOffset: number, locator?: SectionLocator): number {
  const doc = root.ownerDocument!
  if (node === root) {
    let total = 0
    for (let i = 0; i < nodeOffset && i < root.childNodes.length; i++) total += root.childNodes[i]!.textContent!.length
    return total
  }
  const top = topLevelChild(root, node)
  if (!top) return 0
  let base = locator?.sectionStart(top)
  if (base === undefined) {
    base = 0
    for (let s = top.previousSibling; s; s = s.previousSibling) base += s.textContent!.length
  }
  const range = doc.createRange()
  range.setStart(top, 0)
  range.setEnd(node, nodeOffset)
  return base + range.toString().length
}

export class SelectionManager {
  private start = 0
  private end = 0

  constructor(
    private readonly root: HTMLElement,
    private readonly locator?: SectionLocator,
  ) {}

  get(): Selection {
    return { start: this.start, end: this.end }
  }

  hasFocus(): boolean {
    return this.root.ownerDocument.activeElement === this.root
  }

  createRange(start: number, end: number): Range {
    const range = this.root.ownerDocument.createRange()
    const a = findPosition(this.root, Math.min(start, end), this.locator)
    const b = start === end ? a : findPosition(this.root, Math.max(start, end), this.locator)
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
    return range
  }

  set(start: number, end: number): void {
    this.start = Math.max(0, start)
    this.end = Math.max(0, end)
    if (this.hasFocus()) this.restore()
  }

  save(): Selection | null {
    const sel = this.root.ownerDocument.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null
    if (!this.root.contains(sel.anchorNode) || !this.root.contains(sel.focusNode)) return null
    this.start = getTextOffset(this.root, sel.anchorNode, sel.anchorOffset, this.locator)
    this.end = getTextOffset(this.root, sel.focusNode, sel.focusOffset, this.locator)
    return this.get()
  }

  restore(): void {
    const sel = this.root.ownerDocument.getSelection()
    if (!sel) return
    const range = this.createRange(this.start, this.end)
    sel.removeAllRanges()
    if (this.start > this.end) {
      const anchor = range.cloneRange()
      anchor.collapse(false)
      sel.addRange(anchor)
      sel.extend(range.startContainer, range.startOffset)
    } else {
      sel.addRange(range)
    }
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/selection.test.ts; pnpm --filter @geekx/markdown-core typecheck`
Expected: 10 个用例 PASS；typecheck 无错误。若 jsdom 版本缺 `Selection.extend` 导致反向用例失败：不要改测试，确认 `jsdom` ≥ 16（`pnpm --filter @geekx/markdown-core why jsdom`）。

- [ ] **Step 5: 提交**

```powershell
git add packages/markdown-core/src/engine/cledit/selection.ts packages/markdown-core/src/engine/cledit/selection.test.ts
git commit -m "feat(markdown-core): 移植 cledit 选区管理器" -m "文本偏移与 DOM 位置互转，支持按段定位以避免大文档全量遍历。" -m "SelectionManager 记录偏移，重新高亮后可按偏移恢复并保留反向选区。" -m "移除光标坐标与 WebKit br 兼容分支，改由原生 caret 与纯文本换行处理。"
```

### Task 3: 编辑区 Markdown grammar + 分段高亮器

**Files:**
- Modify: `packages/markdown-core/package.json`（dependencies 追加 `prismjs`，devDependencies 追加 `@types/prismjs`；若 2a 已加则命令无变化）
- Create: `packages/markdown-core/src/engine/cledit/grammar.ts`, `grammar.test.ts`
- Create: `packages/markdown-core/src/engine/cledit/highlighter.ts`, `highlighter.test.ts`

**Interfaces:**
- Consumes: `splitSections(md: string): SourceSection[]`（2a `src/sections.ts`）、`SourceSection`（2a `src/types.ts`）、`SectionLocator`（Task 2）。
- Produces:
  - `markdownGrammar: Prism.Grammar`
  - `highlightMarkdown(text: string): string` —— 返回 HTML，**不变式**：把结果设为某元素 `innerHTML` 后其 `textContent === text`；所有 span 类名为 `ex-md-<tokenType>` 及 `ex-md-<alias>`。token 类型清单（Task 6 样式依赖）：`fence`、`math-block`、`h1`…`h6`、`setext-h1`、`setext-h2`（均带 alias `heading`）、`hr`、`blockquote`、`list`、`task`、`table`、`link-def`（alias `link`）、`comment`、`code`、`math`、`image`、`link`、`url`、`tag`、`strong`、`strike`、`mark`、`em`、`marker`（所有语法符号）。
  - `interface HighlightedSection extends SourceSection { el: HTMLDivElement }`
  - `class Highlighter implements SectionLocator { constructor(root: HTMLElement, opts?: { highlight?: (text: string) => string }); readonly sections: readonly HighlightedSection[]; update(value: string, force?: boolean): number[]; sectionAt(offset: number): { el: Node; start: number } | undefined; sectionStart(el: Node): number | undefined }`
    - `update(value)`：`value` 为引擎文本（不含 DOM 末尾补的 `\n`）；按 `splitSections(value)` 切段，最后一段 DOM 文本追加 `\n`（因此 `root.textContent === value + '\n'`）；每段渲染为 `<div class="ex-editor-section" data-section-index="{i}">`；从头、从尾比对复用未变化段（文本相同、仍挂在 root、DOM 文本未被浏览器改过），只重建中间段；删除 root 下所有非段节点；返回被重建段的新下标。调用方负责用 `Watcher.noWatch` 包裹。

**移植说明（偏差）：** 参考 `src/services/markdownGrammarSvc.js`(49-431，`makeGrammars`)与 `cleditHighlighter.js`(64-195，`parseSections`)。偏差：grammar 只保留 CSDN 需要的块/行内 token（去掉 deflist、abbr、sub/sup、latex 内部 token），符号统一为 `marker` 类型；不用 `Prism.highlight`/全局 hooks，而是 `Prism.tokenize` + 自写序列化（类名加 `ex-md-` 前缀，且不影响 2a 渲染器对 Prism 的使用）；切段改用 2a 的 `splitSections`，保证编辑段下标与预览 `.ex-preview-section[data-section-index]` 一致；删除 WebKit `<br>`/`hd-lf` 换行替代（只写 `\n`）；去掉 `isComposing` 判断（IME 暂停由引擎在 Task 5 负责，组合期间根本不调用 `update`）；用 `WeakMap` 记录段起点实现 `SectionLocator`。

- [ ] **Step 1: 安装依赖**

Run: `pnpm --filter @geekx/markdown-core add prismjs; pnpm --filter @geekx/markdown-core add -D @types/prismjs`
Expected: `packages/markdown-core/package.json` 出现 `prismjs` 与 `@types/prismjs`。

- [ ] **Step 2: 写 grammar 失败测试**

`packages/markdown-core/src/engine/cledit/grammar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { highlightMarkdown } from './grammar'

function render(md: string): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = highlightMarkdown(md)
  return div
}

const text = (root: ParentNode, selector: string) => [...root.querySelectorAll(selector)].map((n) => n.textContent)

const SAMPLES = [
  '# 标题\n\n正文 **粗体** *斜体* `code` $x^2$\n',
  '```js\nconst a = "<b>" && 1\n```\n',
  '```\n未闭合的代码块\n还在继续',
  '- [ ] 待办\n- [x] 完成\n1. 一\n2. 二\n',
  '> 引用 [链接](https://a.b)\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
  '<!-- 注释 --> <span>&amp;</span> ==高亮== ~~删除~~ ![图](u.png) https://csdn.net\n',
  '$$\n\\sum_{i=1}^n i\n$$\n',
  '标题\n===\n\n副标题\n---\n',
  '',
]

describe('highlightMarkdown', () => {
  it.each(SAMPLES)('textContent 与源文本逐字符一致：%j', (md) => {
    expect(render(md).textContent).toBe(md)
  })

  it('转义 HTML，不产生真实元素', () => {
    const div = render('<b>x</b> & <script>alert(1)</script>')
    expect(div.querySelector('b, script')).toBeNull()
    expect(text(div, '.ex-md-tag')).toEqual(['<b>', '</b>', '<script>', '</script>'])
  })

  it('ATX 标题：级别类 + heading 别名 + marker', () => {
    const div = render('## 二级标题 **粗**')
    const h = div.querySelector('.ex-md-h2.ex-md-heading')!
    expect(h.textContent).toBe('## 二级标题 **粗**')
    expect(h.querySelector('.ex-md-marker')!.textContent).toBe('##')
    expect(h.querySelector('.ex-md-strong')!.textContent).toBe('**粗**')
    expect(render('#没有空格').querySelector('.ex-md-heading')).toBeNull()
  })

  it('Setext 标题与分割线', () => {
    expect(render('标题\n===').querySelector('.ex-md-setext-h1.ex-md-heading')).not.toBeNull()
    expect(render('副标题\n---').querySelector('.ex-md-setext-h2.ex-md-heading')).not.toBeNull()
    expect(text(render('---'), '.ex-md-hr')).toEqual(['---'])
    expect(text(render('* * *'), '.ex-md-hr')).toEqual(['* * *'])
  })

  it('代码块内部不做行内高亮，未闭合时延续到段尾', () => {
    const closed = render('```js\nconst a = **b**\n```\nafter **x**')
    expect(text(closed, '.ex-md-fence')).toEqual(['```js\nconst a = **b**\n```'])
    expect(text(closed, '.ex-md-fence .ex-md-marker')).toEqual(['```js', '```'])
    expect(text(closed, '.ex-md-strong')).toEqual(['**x**'])
    const open = render('~~~\nline1\nline2')
    expect(text(open, '.ex-md-fence')).toEqual(['~~~\nline1\nline2'])
  })

  it('列表、任务、有序列表', () => {
    const div = render('- [x] 完成\n  * 子项\n12. 第十二')
    expect(text(div, '.ex-md-list')).toEqual(['- [x] 完成', '  * 子项', '12. 第十二'])
    expect(text(div, '.ex-md-list > .ex-md-marker')).toEqual(['-', '  *', '12.'])
    expect(text(div, '.ex-md-task')).toEqual(['[x]'])
  })

  it('引用与表格', () => {
    const div = render('> 引用 `c`\n| a | b |')
    expect(text(div, '.ex-md-blockquote > .ex-md-marker')).toEqual(['>'])
    expect(text(div, '.ex-md-blockquote .ex-md-code')).toEqual(['`c`'])
    expect(text(div, '.ex-md-table > .ex-md-marker')).toEqual(['|', '|', '|'])
  })

  it('行内 token', () => {
    const div = render('**b** *i* ~~s~~ `c` $x$ [l](u) ![p](q) ==m== <!-- n --> https://a.cn')
    expect(text(div, '.ex-md-strong')).toEqual(['**b**'])
    expect(text(div, '.ex-md-em')).toEqual(['*i*'])
    expect(text(div, '.ex-md-strike')).toEqual(['~~s~~'])
    expect(text(div, '.ex-md-code')).toEqual(['`c`'])
    expect(text(div, '.ex-md-math')).toEqual(['$x$'])
    expect(text(div, '.ex-md-link')).toEqual(['[l](u)'])
    expect(text(div, '.ex-md-image')).toEqual(['![p](q)'])
    expect(text(div, '.ex-md-mark')).toEqual(['==m=='])
    expect(text(div, '.ex-md-comment')).toEqual(['<!-- n -->'])
    expect(text(div, '.ex-md-url')).toEqual(['https://a.cn'])
  })

  it('公式块（多行与单行）', () => {
    expect(text(render('$$\na+b\n$$'), '.ex-md-math-block')).toEqual(['$$\na+b\n$$'])
    expect(text(render('$$a+b$$'), '.ex-md-math-block')).toEqual(['$$a+b$$'])
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/grammar.test.ts`
Expected: FAIL，`Failed to resolve import "./grammar"`。

- [ ] **Step 4: 实现 grammar**

`packages/markdown-core/src/engine/cledit/grammar.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/markdownGrammarSvc.js
import Prism from 'prismjs'

const inline: Prism.Grammar = {
  comment: /<!--[\s\S]*?-->/,
  code: { pattern: /(`+)[^`\n]+?\1/, inside: { marker: /^`+|`+$/ } },
  math: { pattern: /\$[^\s$](?:[^$\n]*[^\s$])?\$/, inside: { marker: /^\$|\$$/ } },
  image: { pattern: /!\[[^\]\n]*\]\([^)\n]*\)/, inside: { marker: /^!\[|\]\(|\)$/ } },
  link: { pattern: /\[[^\]\n]*\]\([^)\n]*\)/, inside: { marker: /^\[|\]\(|\)$/ } },
  url: /<https?:\/\/[^>\s]+>|\bhttps?:\/\/[^\s<>()]+/,
  tag: /<\/?[a-zA-Z][\w:-]*(?:\s[^<>\n]*)?\/?>/,
  strong: { pattern: /(\*\*|__)(?=\S)[^\n]*?\S\1/, inside: { marker: /^(?:\*\*|__)|(?:\*\*|__)$/ } },
  strike: { pattern: /~~(?=\S)[^\n]*?\S~~/, inside: { marker: /^~~|~~$/ } },
  mark: { pattern: /==(?=\S)[^\n]*?\S==/, inside: { marker: /^==|==$/ } },
  em: { pattern: /([*_])(?=[^\s*_])[^\n]*?[^\s*_]\1|([*_])[^\s*_]\2/, inside: { marker: /^[*_]|[*_]$/ } },
}

function atxHeading(level: number): Prism.GrammarValue {
  return {
    pattern: new RegExp(`^#{${level}}(?=[ \\t]|$).*$`, 'm'),
    alias: 'heading',
    inside: { marker: /^#+/, ...inline },
  }
}

export const markdownGrammar: Prism.Grammar = {
  fence: {
    pattern: /^(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?\n\1[ \t]*$|[\s\S]*)/m,
    inside: { marker: /^(?:`{3,}|~{3,}).*$/m },
  },
  'math-block': [
    { pattern: /^\$\$[ \t]*\n[\s\S]*?\n\$\$[ \t]*$/m, inside: { marker: /^\$\$|\$\$$/ } },
    { pattern: /^\$\$.*\$\$[ \t]*$/m, inside: { marker: /^\$\$|\$\$$/ } },
  ],
  h1: atxHeading(1),
  h2: atxHeading(2),
  h3: atxHeading(3),
  h4: atxHeading(4),
  h5: atxHeading(5),
  h6: atxHeading(6),
  'setext-h1': { pattern: /^[^\n]+\n=+[ \t]*$/m, alias: 'heading', inside: { marker: /^=+[ \t]*$/m, ...inline } },
  'setext-h2': { pattern: /^[^\n]*\S[^\n]*\n-{2,}[ \t]*$/m, alias: 'heading', inside: { marker: /^-+[ \t]*$/m, ...inline } },
  hr: /^ {0,3}([*_-])(?:[ \t]*\1){2,}[ \t]*$/m,
  blockquote: { pattern: /^ {0,3}>.*$/m, inside: { marker: /^ {0,3}>(?:[ \t]*>)*/, ...inline } },
  list: {
    pattern: /^[ \t]*(?:[*+-]|\d+[.)])[ \t].*$/m,
    inside: {
      task: { pattern: /(^[ \t]*(?:[*+-]|\d+[.)])[ \t]+)\[[ xX]\]/, lookbehind: true },
      marker: /^[ \t]*(?:[*+-]|\d+[.)])/,
      ...inline,
    },
  },
  table: { pattern: /^[ \t]*\|.*$/m, inside: { marker: /\|/, ...inline } },
  'link-def': { pattern: /^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/m, alias: 'link' },
  ...inline,
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serialize(stream: Prism.TokenStream): string {
  if (typeof stream === 'string') return escapeHtml(stream)
  if (Array.isArray(stream)) return stream.map(serialize).join('')
  const aliases = stream.alias ? (Array.isArray(stream.alias) ? stream.alias : [stream.alias]) : []
  const classes = [stream.type, ...aliases].map((c) => `ex-md-${c}`).join(' ')
  return `<span class="${classes}">${serialize(stream.content)}</span>`
}

export function highlightMarkdown(text: string): string {
  return serialize(Prism.tokenize(text, markdownGrammar))
}
```

注意：`list > .ex-md-marker` 的期望 `'  *'` 依赖 marker 正则包含前导缩进（`^[ \t]*`），这是有意的——Task 4 的缩进与 Task 6 样式都把缩进视为列表符号的一部分。

- [ ] **Step 5: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/grammar.test.ts`
Expected: PASS。若某个期望失败，先确认是 grammar 键顺序问题（Prism 按对象键顺序匹配：`fence` → `math-block` → 标题 → `setext` → `hr` → `blockquote` → `list` → `table` → 行内），调整实现而非测试。

- [ ] **Step 6: 写 highlighter 失败测试**

`packages/markdown-core/src/engine/cledit/highlighter.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { splitSections } from '../../sections'
import { Highlighter } from './highlighter'

function setup() {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return { root, hl: new Highlighter(root) }
}

afterEach(() => {
  document.body.innerHTML = ''
})

const DOC = '# 一\n\n第一段\n\n## 二\n\n第二段\n\n## 三\n\n第三段'

describe('Highlighter', () => {
  it('段数与 splitSections 一致，DOM 文本 = value + \\n，带 data-section-index', () => {
    const { root, hl } = setup()
    const changed = hl.update(DOC)
    const expected = splitSections(DOC)
    expect(root.children).toHaveLength(expected.length)
    expect(changed).toEqual(expected.map((_, i) => i))
    expect(root.textContent).toBe(DOC + '\n')
    ;[...root.children].forEach((el, i) => {
      expect(el.className).toBe('ex-editor-section')
      expect((el as HTMLElement).dataset.sectionIndex).toBe(String(i))
    })
    expect(hl.sections.map((s) => s.start)).toEqual(expected.map((s) => s.start))
  })

  it('只重建变化的段，其余元素复用', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const before = [...root.children]
    const changed = hl.update(DOC.replace('第二段', '第二段改'))
    const after = [...root.children]
    expect(changed).toEqual([1])
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(after[2]).toBe(before[2])
    expect(root.textContent).toBe(DOC.replace('第二段', '第二段改') + '\n')
  })

  it('中间插入新段：下标顺延，前后段复用', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const before = [...root.children]
    const next = DOC.replace('## 三', '## 新\n\n内容\n\n## 三')
    const changed = hl.update(next)
    const after = [...root.children] as HTMLElement[]
    expect(after).toHaveLength(4)
    expect(changed).toEqual([2])
    expect(after[0]).toBe(before[0])
    expect(after[1]).toBe(before[1])
    expect(after[3]).toBe(before[2])
    expect(after.map((el) => el.dataset.sectionIndex)).toEqual(['0', '1', '2', '3'])
  })

  it('浏览器改过的段与段外杂散节点会被修正', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const first = root.children[0]!
    first.appendChild(document.createTextNode('X'))
    root.appendChild(document.createTextNode('stray'))
    const changed = hl.update(DOC)
    expect(changed).toEqual([0])
    expect(root.children[0]).not.toBe(first)
    expect(root.textContent).toBe(DOC + '\n')
  })

  it('force 重建全部段；空文本也有一个段', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    expect(hl.update(DOC, true)).toEqual([0, 1, 2])
    hl.update('')
    expect(root.children).toHaveLength(1)
    expect(root.textContent).toBe('\n')
  })

  it('SectionLocator：sectionAt 二分定位，段边界归后一段', () => {
    const { root, hl } = setup()
    hl.update(DOC)
    const starts = hl.sections.map((s) => s.start)
    expect(hl.sectionAt(0)!.el).toBe(root.children[0])
    expect(hl.sectionAt(starts[1]! - 1)!.el).toBe(root.children[0])
    expect(hl.sectionAt(starts[1]!)).toEqual({ el: root.children[1], start: starts[1] })
    expect(hl.sectionAt(DOC.length + 1)!.el).toBe(root.children[2])
    expect(hl.sectionStart(root.children[2]!)).toBe(starts[2])
    expect(hl.sectionStart(document.createElement('div'))).toBeUndefined()
  })
})
```

- [ ] **Step 7: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/highlighter.test.ts`
Expected: FAIL，`Failed to resolve import "./highlighter"`。

- [ ] **Step 8: 实现 highlighter**

`packages/markdown-core/src/engine/cledit/highlighter.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditHighlighter.js
import { splitSections } from '../../sections'
import type { SourceSection } from '../../types'
import { highlightMarkdown } from './grammar'
import type { SectionLocator } from './selection'

export interface HighlightedSection extends SourceSection {
  el: HTMLDivElement
}

export interface HighlighterOptions {
  highlight?: (text: string) => string
}

export class Highlighter implements SectionLocator {
  private list: HighlightedSection[] = []
  private starts = new WeakMap<Node, number>()
  private readonly highlight: (text: string) => string

  constructor(
    private readonly root: HTMLElement,
    opts: HighlighterOptions = {},
  ) {
    this.highlight = opts.highlight ?? highlightMarkdown
  }

  get sections(): readonly HighlightedSection[] {
    return this.list
  }

  update(value: string, force = false): number[] {
    const doc = this.root.ownerDocument
    const split = splitSections(value)
    const source = split.length > 0 ? split : [{ text: '', start: 0, end: 0 }]
    const next: SourceSection[] = source.map((s, i) =>
      i === source.length - 1 ? { text: `${s.text}\n`, start: s.start, end: s.end + 1 } : { ...s },
    )
    const old = this.list
    const reusable = (o: HighlightedSection, n: SourceSection) =>
      !force && o.text === n.text && o.el.parentNode === this.root && o.el.textContent === n.text

    let left = 0
    while (left < old.length && left < next.length && reusable(old[left]!, next[left]!)) left++
    let right = 0
    while (
      right < old.length - left &&
      right < next.length - left &&
      reusable(old[old.length - 1 - right]!, next[next.length - 1 - right]!)
    ) {
      right++
    }

    const result: HighlightedSection[] = []
    const changed: number[] = []
    const fragment = doc.createDocumentFragment()
    for (let i = 0; i < left; i++) result.push({ ...next[i]!, el: old[i]!.el })
    for (let i = left; i < next.length - right; i++) {
      const el = doc.createElement('div')
      el.className = 'ex-editor-section'
      el.innerHTML = this.highlight(next[i]!.text)
      fragment.appendChild(el)
      result.push({ ...next[i]!, el })
      changed.push(i)
    }
    for (let i = next.length - right; i < next.length; i++) {
      result.push({ ...next[i]!, el: old[old.length - (next.length - i)]!.el })
    }

    for (let i = left; i < old.length - right; i++) old[i]!.el.remove()
    const anchor = right > 0 ? old[old.length - right]!.el : null
    this.root.insertBefore(fragment, anchor)

    const keep = new Set<Node>(result.map((s) => s.el))
    for (let child = this.root.firstChild; child; ) {
      const following = child.nextSibling
      if (!keep.has(child)) child.parentNode!.removeChild(child)
      child = following
    }

    this.starts = new WeakMap()
    result.forEach((s, i) => {
      this.starts.set(s.el, s.start)
      if (s.el.dataset.sectionIndex !== String(i)) s.el.dataset.sectionIndex = String(i)
    })
    this.list = result
    return changed
  }

  sectionAt(offset: number): { el: Node; start: number } | undefined {
    if (this.list.length === 0) return undefined
    let lo = 0
    let hi = this.list.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.list[mid]!.start <= offset) lo = mid
      else hi = mid - 1
    }
    const s = this.list[lo]!
    return { el: s.el, start: s.start }
  }

  sectionStart(el: Node): number | undefined {
    return this.starts.get(el)
  }
}
```

- [ ] **Step 9: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit; pnpm --filter @geekx/markdown-core typecheck`
Expected: cledit 目录全部 PASS；typecheck 无错误。

- [ ] **Step 10: 提交**

```powershell
git add packages/markdown-core/package.json pnpm-lock.yaml packages/markdown-core/src/engine/cledit/grammar.ts packages/markdown-core/src/engine/cledit/grammar.test.ts packages/markdown-core/src/engine/cledit/highlighter.ts packages/markdown-core/src/engine/cledit/highlighter.test.ts
git commit -m "feat(markdown-core): 新增编辑区 Markdown 语法与分段增量高亮" -m "移植 StackEdit Markdown grammar，经 Prism.tokenize 输出 ex-md-* 类名且不污染全局 hooks。" -m "高亮器复用 splitSections 切段，段下标与预览一致，仅重建变化段。" -m "实现 SectionLocator，选区换算按段定位以支撑大文档。"
```

### Task 4: 按键处理（keystrokes）

**Files:**
- Create: `packages/markdown-core/src/engine/cledit/keystrokes.ts`
- Test: `packages/markdown-core/src/engine/cledit/keystrokes.test.ts`

**Interfaces:**
- Consumes: `TextState`（2a `src/types.ts`）、`UndoMode`（Task 1）。
- Produces:
  - `interface KeyInfo { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; isComposing: boolean }`
  - `handleEnter(state: TextState): TextState` —— 列表续写（无序/有序/任务，有序自动 +1 并重排同级后续编号）、引用续写、普通换行保持行首缩进；在空列表项/空引用行回车 = 清空该行（退出列表）。
  - `handleTab(state: TextState, outdent: boolean): TextState` —— 非列表单行无选区：插入 `\t`；列表行或多行选区：逐行加 `\t`；`outdent`：逐行去掉一个 `\t` 或最多 4 个空格。
  - `handleBackspace(state: TextState): TextState | null` —— 光标紧跟在只有标记的列表项后（如 `- |`、`1. [ ] |`）时删除标记保留缩进；其他情况返回 `null`（交给浏览器）。
  - `handleKeystroke(key: KeyInfo, state: TextState): { state: TextState; mode: UndoMode } | null` —— 组合输入中、或带 Ctrl/Meta/Alt 时返回 `null`；`Shift+Enter` 插入纯 `\n`。

**移植说明（偏差）：** 参考 `src/services/optional/keystrokes.js`（`enterKeyHandler`、`tabKeyHandler`、`fixNumberedList`、`indentRegexp`）与 `cleditKeystroke.js`（默认 Enter/Tab/Backspace 处理）。偏差：改为纯函数 `TextState → TextState`（不依赖 `editorSvc`/`store`、不读设置，自动编号恒开启）；"连按两次回车清除标记"的 `clearNewline` 状态机简化为"在空列表项上回车即清空"；有序列表重排只处理同缩进的紧随项（遇到空行或更浅缩进即停止）。

- [ ] **Step 1: 写失败测试**

测试用 `|` 表示光标、`[`…`]` 表示选区，辅助函数负责解析/还原。

`packages/markdown-core/src/engine/cledit/keystrokes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TextState } from '../../types'
import { handleBackspace, handleEnter, handleKeystroke, handleTab, type KeyInfo } from './keystrokes'

function parse(marked: string): TextState {
  const caret = marked.indexOf('|')
  if (caret !== -1) return { text: marked.replace('|', ''), selection: { start: caret, end: caret } }
  const start = marked.indexOf('[[')
  const end = marked.indexOf(']]') - 2
  return { text: marked.replace('[[', '').replace(']]', ''), selection: { start, end } }
}

function show(state: TextState): string {
  const { text, selection } = state
  if (selection.start === selection.end) return text.slice(0, selection.start) + '|' + text.slice(selection.start)
  return text.slice(0, selection.start) + '[[' + text.slice(selection.start, selection.end) + ']]' + text.slice(selection.end)
}

const key = (k: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...extra,
})

describe('handleEnter', () => {
  it.each([
    ['无序列表续写', '- a|', '- a\n- |'],
    ['保留缩进与符号', '  * a|', '  * a\n  * |'],
    ['加号符号', '+ a|', '+ a\n+ |'],
    ['任务列表续写为未勾选', '- [x] a|', '- [x] a\n- [ ] |'],
    ['有序列表 +1 并保留分隔符', '9) a|', '9) a\n10) |'],
    ['有序任务列表', '1. [ ] a|', '1. [ ] a\n2. [ ] |'],
    ['空列表项回车退出列表', 'x\n- |', 'x\n|'],
    ['空任务项回车退出列表', '- [ ] |', '|'],
    ['列表项中间断行', '- ab|cd', '- ab\n- |cd'],
    ['光标在行首：普通换行', '|- a', '\n|- a'],
    ['引用续写', '> q|', '> q\n> |'],
    ['空引用行退出', '> q\n> |', '> q\n|'],
    ['普通行保持缩进', '    code|', '    code\n    |'],
    ['普通行', 'ab|c', 'ab\n|c'],
    ['选区被替换', 'a[[bc]]d', 'a\n|d'],
  ])('%s', (_name, input, expected) => {
    expect(show(handleEnter(parse(input)))).toBe(expected)
  })

  it('有序列表插入后重排同级后续编号，嵌套与空行后不动', () => {
    const input = '1. a|\n2. b\n   - sub\n3. c\n\n4. d'
    expect(show(handleEnter(parse(input)))).toBe('1. a\n2. |\n3. b\n   - sub\n4. c\n\n4. d')
  })
})

describe('handleTab', () => {
  it.each([
    ['普通行插入制表符', 'ab|c', false, 'ab\t|c'],
    ['列表行整行缩进', '- a|', false, '\t- a|'],
    ['多行选区逐行缩进', '[[a\nb]]', false, '\t[[a\n\tb]]'],
    ['反缩进去掉制表符', '\t- a|', true, '- a|'],
    ['反缩进最多 4 个空格', '      x|', true, '  x|'],
    ['多行反缩进', '[[\ta\n  b]]', true, '[[a\nb]]'],
    ['无缩进时反缩进不变', 'a|', true, 'a|'],
  ])('%s', (_name, input, outdent, expected) => {
    expect(show(handleTab(parse(input), outdent))).toBe(expected)
  })
})

describe('handleBackspace', () => {
  it.each([
    ['删除空列表项标记', '- |', '|'],
    ['保留缩进', '  1. |', '  |'],
    ['空任务项', '- [ ] |', '|'],
  ])('%s', (_name, input, expected) => {
    expect(show(handleBackspace(parse(input))!)).toBe(expected)
  })

  it.each([['- a|'], ['abc|'], ['[[- ]]'], ['- |a']])('其他情况交给浏览器：%s', (input) => {
    expect(handleBackspace(parse(input))).toBeNull()
  })
})

describe('handleKeystroke', () => {
  it('Enter / Tab / Shift+Tab 返回 single 模式', () => {
    expect(handleKeystroke(key('Enter'), parse('- a|'))).toEqual({ state: parse('- a\n- |'), mode: 'single' })
    expect(show(handleKeystroke(key('Tab'), parse('a|'))!.state)).toBe('a\t|')
    expect(show(handleKeystroke(key('Tab', { shiftKey: true }), parse('\ta|'))!.state)).toBe('a|')
  })

  it('Shift+Enter 插入纯换行，不续写列表', () => {
    expect(show(handleKeystroke(key('Enter', { shiftKey: true }), parse('- a|'))!.state)).toBe('- a\n|')
  })

  it('组合输入中或带修饰键时不处理', () => {
    expect(handleKeystroke(key('Enter', { isComposing: true }), parse('- a|'))).toBeNull()
    expect(handleKeystroke(key('Enter', { ctrlKey: true }), parse('- a|'))).toBeNull()
    expect(handleKeystroke(key('Tab', { metaKey: true }), parse('a|'))).toBeNull()
    expect(handleKeystroke(key('a'), parse('a|'))).toBeNull()
  })

  it('Backspace 不命中时返回 null', () => {
    expect(handleKeystroke(key('Backspace'), parse('ab|'))).toBeNull()
    expect(show(handleKeystroke(key('Backspace'), parse('- |'))!.state)).toBe('|')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/keystrokes.test.ts`
Expected: FAIL，`Failed to resolve import "./keystrokes"`。

- [ ] **Step 3: 实现**

`packages/markdown-core/src/engine/cledit/keystrokes.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/keystrokes.js
import type { TextState } from '../../types'
import type { UndoMode } from './undo'

export interface KeyInfo {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  isComposing: boolean
}

const LIST_RE = /^([ \t]*)(?:([*+-])|(\d+)([.)]))([ \t]+)(\[[ xX]\][ \t]+)?/
const QUOTE_RE = /^ {0,3}>[ \t]?/

function lineBounds(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf('\n', pos - 1) + 1
  const end = text.indexOf('\n', pos)
  return { start, end: end === -1 ? text.length : end }
}

function replaceRange(text: string, start: number, end: number, insert: string, caret: number): TextState {
  return { text: text.slice(0, start) + insert + text.slice(end), selection: { start: caret, end: caret } }
}

function renumberFollowing(text: string, from: number, indent: string, firstNumber: number): string {
  const lines = text.slice(from).split('\n')
  let n = firstNumber
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const m = /^([ \t]*)(\d+)([.)])[ \t]/.exec(line)
    if (m && m[1] === indent) {
      lines[i] = indent + n + m[3] + line.slice(m[1].length + m[2]!.length + 1)
      n++
      continue
    }
    if (line.length > indent.length && line.startsWith(indent) && /^[ \t]/.test(line.slice(indent.length))) continue
    break
  }
  return text.slice(0, from) + lines.join('\n')
}

export function handleEnter(state: TextState): TextState {
  const { text, selection } = state
  const s = Math.min(selection.start, selection.end)
  const e = Math.max(selection.start, selection.end)
  const { start: ls, end: le } = lineBounds(text, s)
  const line = text.slice(ls, le)

  if (s === e) {
    const list = LIST_RE.exec(line)
    if (list && s >= ls + list[0].length) {
      const [marker, indent = '', bullet, num, delim, space = ' ', task] = list
      if (line.slice(marker.length).trim() === '') return replaceRange(text, ls, le, '', ls)
      const nextMarker = bullet ?? `${Number(num) + 1}${delim}`
      const insert = `\n${indent}${nextMarker}${space}${task ? '[ ] ' : ''}`
      const next = replaceRange(text, s, e, insert, s + insert.length)
      if (num !== undefined) {
        const newLineEnd = next.text.indexOf('\n', s + insert.length)
        if (newLineEnd !== -1) next.text = renumberFollowing(next.text, newLineEnd + 1, indent, Number(num) + 2)
      }
      return next
    }
    const quote = QUOTE_RE.exec(line)
    if (quote && s >= ls + quote[0].length) {
      if (line.slice(quote[0].length).trim() === '') return replaceRange(text, ls, le, '', ls)
      const insert = `\n${quote[0]}`
      return replaceRange(text, s, e, insert, s + insert.length)
    }
  }

  const indent = /^[ \t]*/.exec(text.slice(ls, s))![0]
  const insert = `\n${indent}`
  return replaceRange(text, s, e, insert, s + insert.length)
}

export function handleTab(state: TextState, outdent: boolean): TextState {
  const { text, selection } = state
  const s = Math.min(selection.start, selection.end)
  const e = Math.max(selection.start, selection.end)
  const first = lineBounds(text, s)
  const ls = first.start
  const le = lineBounds(text, e).end
  const multi = text.slice(s, e).includes('\n')

  if (!outdent && !multi && !LIST_RE.test(text.slice(first.start, first.end))) {
    return replaceRange(text, s, e, '\t', s + 1)
  }

  let startDelta = 0
  let total = 0
  const out = text
    .slice(ls, le)
    .split('\n')
    .map((line, i) => {
      if (!outdent) {
        if (i === 0) startDelta = 1
        total += 1
        return `\t${line}`
      }
      const n = /^(?:\t| {1,4})/.exec(line)?.[0].length ?? 0
      if (i === 0) startDelta = -Math.min(n, s - ls)
      total -= n
      return line.slice(n)
    })
    .join('\n')

  const start = s + startDelta
  const end = s === e ? start : Math.max(start, e + total)
  return { text: text.slice(0, ls) + out + text.slice(le), selection: { start, end } }
}

export function handleBackspace(state: TextState): TextState | null {
  const { text, selection } = state
  if (selection.start !== selection.end) return null
  const s = selection.start
  const { start: ls, end: le } = lineBounds(text, s)
  const line = text.slice(ls, le)
  const list = LIST_RE.exec(line)
  if (!list || s !== ls + list[0].length || line.length !== list[0].length) return null
  const indent = list[1] ?? ''
  return replaceRange(text, ls, le, indent, ls + indent.length)
}

export function handleKeystroke(key: KeyInfo, state: TextState): { state: TextState; mode: UndoMode } | null {
  if (key.isComposing || key.ctrlKey || key.metaKey || key.altKey) return null
  switch (key.key) {
    case 'Enter': {
      if (key.shiftKey) {
        const s = Math.min(state.selection.start, state.selection.end)
        const e = Math.max(state.selection.start, state.selection.end)
        return { state: replaceRange(state.text, s, e, '\n', s + 1), mode: 'single' }
      }
      return { state: handleEnter(state), mode: 'single' }
    }
    case 'Tab':
      return { state: handleTab(state, key.shiftKey), mode: 'single' }
    case 'Backspace': {
      if (key.shiftKey) return null
      const next = handleBackspace(state)
      return next ? { state: next, mode: 'single' } : null
    }
    default:
      return null
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cledit/keystrokes.test.ts; pnpm --filter @geekx/markdown-core typecheck`
Expected: 全部 PASS；typecheck 无错误。

- [ ] **Step 5: 提交**

```powershell
git add packages/markdown-core/src/engine/cledit/keystrokes.ts packages/markdown-core/src/engine/cledit/keystrokes.test.ts
git commit -m "feat(markdown-core): 新增编辑区按键处理（列表续写、缩进、退格）" -m "回车续写无序/有序/任务列表与引用，有序列表自动编号并重排后续同级项。" -m "Tab/Shift+Tab 支持单行与多行缩进，空列表项退格删除标记。" -m "全部实现为 TextState 纯函数，组合输入与修饰键组合交给浏览器。"
```

### Task 5: ClEditEngine 组装（EditorEngine 实现、事件、IME、段偏移）

**Files:**
- Create: `packages/markdown-core/src/engine/cl-edit-engine.ts`
- Create: `packages/markdown-core/src/engine/index.ts`
- Test: `packages/markdown-core/src/engine/cl-edit-engine.test.ts`
- Modify: `packages/markdown-core/src/index.ts`（末尾追加一行导出）

**Interfaces:**
- Consumes: `EditorEngine`、`EngineOptions`、`EngineEvent`、`Selection`、`SectionOffset`、`TextState`、`Unsubscribe`（2a `src/types.ts`）；`splitSections`（2a，仅测试用）；Task 1–4 的 `Watcher`、`UndoManager`/`UndoManagerOptions`/`UndoMode`、`diffRange`、`SelectionManager`、`Highlighter`、`handleKeystroke`。
- Produces:
  - `interface ClEditEngineOptions { highlight?: (text: string) => string; undo?: UndoManagerOptions }`
  - `class ClEditEngine implements EditorEngine`，除契约方法外还有：`get contentElement(): HTMLElement | null`、`isComposing(): boolean`。
  - `getCursorPosition(): { line: number; column: number }`（契约 Addendum A.3，`EditorEngine` 成员）：以 `getSelection().end`（光标/选区结束处）计算，`line` 从 1 开始，`column` 从 0 开始（按 UTF-16 码元计，与 CSDN"当前行 1, 当前列 0"一致）；消费者在 `selectionChange`/`change` 回调中调用即可得到最新位置。
  - DOM 结构：`mount(el)` 给 `el` 加类 `ex-editor`（`el` 即编辑区滚动容器，Task 7 的 `editorScrollEl`），并追加 `<div class="ex-editor-content" role="textbox" aria-multiline="true" spellcheck="false" tabindex="0" contenteditable="plaintext-only|true|false" data-placeholder? data-empty?>`，其子节点为 Task 3 的 `.ex-editor-section[data-section-index]`。
  - 事件载荷：`change` → `string`（新全文）；`selectionChange` → `Selection`（`start <= end`）；`scroll` → `{ scrollTop: number }`；`paste` → 原生 `ClipboardEvent`；`drop` → 原生 `DragEvent`（监听者可 `preventDefault()` 接管，如图片上传）。
  - 语义：`setValue` 是程序化赋值，**不**派发 `change`；默认清空撤销栈并整体重建，`keepUndo: true` 时作为一步可撤销编辑。`replace`、`undo`、`redo`、用户输入、按键处理都派发 `change`。`replace` 每次调用是独立撤销步骤。`getSelection` 在聚焦时先从 DOM 读取。`getSectionOffsets()` 的 `top` 为段相对 `el` 滚动内容顶部的偏移（`rect.top - elRect.top + el.scrollTop`），`end` 夹到 `getValue().length`。
  - IME：`compositionstart`~`compositionend` 之间 MutationObserver 回调直接忽略（不读 DOM、不重新高亮、不派发 `change`、不处理按键）；`compositionend` 时一次性从 DOM 同步、记录一步撤销、重新高亮、派发一次 `change`。

**移植说明（偏差）：** 参考 `cleditCore.js`：`getTextContent`(23-38)、`replaceContent/setContent/replace`(44-97)、`checkContentChange`(144-197)、事件绑定(220-385)。偏差：去掉 `scrollElt`/光标坐标/`adjustCursorPosition`、`sectionHighlighter` 选项、`$markers`（Marker 留作后续扩展，引擎暂不使用）、`cl_*` 原型扩展与事件钩子系统，改为 `on()` 返回 `Unsubscribe`；文本末尾补 `\n` 只存在于 DOM，`getValue()` 不含它；使用 `contenteditable="plaintext-only"`（不支持时回落 `true`），因此换行与粘贴都是纯文本；拦截 `Ctrl/Cmd+Z/Y`、`Ctrl/Cmd+Shift+Z` 与 `beforeinput` 的 `historyUndo/historyRedo`，使用自己的撤销栈；IME 暂停按 spec §4.1。

- [ ] **Step 1: 写失败测试**

`packages/markdown-core/src/engine/cl-edit-engine.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitSections } from '../sections'
import { ClEditEngine } from './cl-edit-engine'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function setup(value = '', extra: { placeholder?: string; readOnly?: boolean } = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const engine = new ClEditEngine()
  engine.mount(host, { value, ...extra })
  const content = host.querySelector<HTMLElement>('.ex-editor-content')!
  const changes: unknown[] = []
  engine.on('change', (v) => changes.push(v))
  return { host, engine, content, changes }
}

function textNodeContaining(root: Node, needle: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent!.includes(needle)) return n as Text
  throw new Error(`找不到文本节点：${needle}`)
}

function typeInto(node: Text, search: string, insert: string) {
  const at = node.data.indexOf(search) + search.length
  node.data = node.data.slice(0, at) + insert + node.data.slice(at)
  const range = document.createRange()
  range.setStart(node, at + insert.length)
  range.collapse(true)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

describe('ClEditEngine 挂载', () => {
  it('渲染分段高亮且 DOM 文本 = value + \\n', () => {
    const doc = '# A\n\nx\n## B\n\ny'
    const { host, engine, content } = setup(doc)
    expect(host.classList.contains('ex-editor')).toBe(true)
    expect(content.getAttribute('role')).toBe('textbox')
    expect(['plaintext-only', 'true']).toContain(content.getAttribute('contenteditable'))
    expect(content.textContent).toBe(doc + '\n')
    expect(content.querySelectorAll('.ex-editor-section')).toHaveLength(splitSections(doc).length)
    expect(engine.getValue()).toBe(doc)
    expect(engine.contentElement).toBe(content)
  })

  it('readOnly 与 placeholder', () => {
    const { content, engine } = setup('', { placeholder: '请输入', readOnly: true })
    expect(content.getAttribute('contenteditable')).toBe('false')
    expect(content.getAttribute('aria-readonly')).toBe('true')
    expect(content.dataset.placeholder).toBe('请输入')
    expect(content.hasAttribute('data-empty')).toBe(true)
    engine.setValue('x')
    expect(content.hasAttribute('data-empty')).toBe(false)
  })

  it('destroy 移除内容并停止派发事件', async () => {
    const { host, engine, content, changes } = setup('a')
    const node = textNodeContaining(content, 'a')
    engine.destroy()
    expect(host.querySelector('.ex-editor-content')).toBeNull()
    expect(host.classList.contains('ex-editor')).toBe(false)
    node.data = 'ab'
    await flush()
    expect(changes).toEqual([])
  })
})

describe('ClEditEngine API', () => {
  it('setValue 不派发 change 且清空撤销；keepUndo 可撤销', () => {
    const { engine, changes } = setup('a')
    engine.replace(1, 1, 'b')
    engine.setValue('new')
    expect(engine.getValue()).toBe('new')
    engine.undo()
    expect(engine.getValue()).toBe('new')
    engine.setValue('newer', { keepUndo: true })
    engine.undo()
    expect(engine.getValue()).toBe('new')
    expect(changes).toEqual(['ab', 'new'])
  })

  it('replace 派发 change、光标落在插入文本后，undo/redo 往返', () => {
    const { engine, changes, content } = setup('hello')
    engine.replace(5, 5, ' world')
    expect(engine.getValue()).toBe('hello world')
    expect(engine.getSelection()).toEqual({ start: 11, end: 11 })
    expect(content.textContent).toBe('hello world\n')
    engine.undo()
    expect(engine.getValue()).toBe('hello')
    engine.redo()
    expect(engine.getValue()).toBe('hello world')
    expect(changes).toEqual(['hello world', 'hello', 'hello world'])
  })

  it('setSelection 夹取并规范化，派发 selectionChange；on 返回取消订阅', () => {
    const { engine } = setup('abc')
    const seen: unknown[] = []
    const off = engine.on('selectionChange', (s) => seen.push(s))
    engine.setSelection(5, -1)
    expect(engine.getSelection()).toEqual({ start: 0, end: 3 })
    off()
    engine.setSelection(1, 1)
    expect(seen).toEqual([{ start: 0, end: 3 }])
  })

  it('getCursorPosition：1 起行号、0 起列号，取选区结束处', () => {
    const { engine } = setup('第一行\nab\n\nxyz')
    expect(engine.getCursorPosition()).toEqual({ line: 1, column: 0 })
    engine.setSelection(3, 3)
    expect(engine.getCursorPosition()).toEqual({ line: 1, column: 3 })
    engine.setSelection(4, 4)
    expect(engine.getCursorPosition()).toEqual({ line: 2, column: 0 })
    engine.setSelection(9, 1)
    expect(engine.getCursorPosition()).toEqual({ line: 4, column: 1 })
    engine.setSelection(7, 7)
    expect(engine.getCursorPosition()).toEqual({ line: 3, column: 0 })
    engine.replace(10, 10, '!')
    expect(engine.getCursorPosition()).toEqual({ line: 4, column: 3 })
    engine.setValue('\nx')
    engine.setSelection(0, 0)
    expect(engine.getCursorPosition()).toEqual({ line: 1, column: 0 })
  })

  it('getSectionOffsets 以宿主滚动内容为基准', () => {
    const doc = '# A\n\nx\n## B\n\ny'
    const { host, engine } = setup(doc)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = this.dataset.sectionIndex
      const top = i === undefined ? 10 : 10 + Number(i) * 40 - 25
      const height = i === undefined ? 500 : 40
      return { top, height, left: 0, width: 100, right: 100, bottom: top + height, x: 0, y: top, toJSON() {} } as DOMRect
    })
    Object.defineProperty(host, 'scrollTop', { value: 25, configurable: true })
    expect(engine.getSectionOffsets()).toEqual(
      splitSections(doc).map((s, i) => ({ start: s.start, end: s.end, top: i * 40, height: 40 })),
    )
  })
})

describe('ClEditEngine 输入', () => {
  it('DOM 变更同步为 value，重新高亮并可撤销', async () => {
    const { engine, content, changes } = setup('# T\n\nabc')
    content.focus()
    const node = textNodeContaining(content, 'abc')
    typeInto(node, 'abc', 'X')
    await flush()
    expect(engine.getValue()).toBe('# T\n\nabcX')
    expect(changes).toEqual(['# T\n\nabcX'])
    expect(engine.getSelection()).toEqual({ start: 9, end: 9 })
    expect(content.contains(node)).toBe(false)
    expect(content.textContent).toBe('# T\n\nabcX\n')
    engine.undo()
    expect(engine.getValue()).toBe('# T\n\nabc')
  })

  it('Enter 续写列表并阻止默认行为', () => {
    const { engine, content } = setup('- a')
    content.focus()
    engine.setSelection(3, 3)
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    content.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('- a\n- ')
    expect(engine.getSelection()).toEqual({ start: 6, end: 6 })
  })

  it('Ctrl+Z / Ctrl+Shift+Z 走引擎撤销栈', () => {
    const { engine, content } = setup('a')
    engine.replace(1, 1, 'b')
    const undo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
    content.dispatchEvent(undo)
    expect(undo.defaultPrevented).toBe(true)
    expect(engine.getValue()).toBe('a')
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))
    expect(engine.getValue()).toBe('ab')
  })

  it('IME：组合期间不同步不重绘，compositionend 一次性提交', async () => {
    const { engine, content, changes } = setup('# T\n\nabc')
    content.focus()
    content.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(engine.isComposing()).toBe(true)
    const node = textNodeContaining(content, 'abc')
    typeInto(node, 'abc', 'ni')
    await flush()
    typeInto(node, 'abcni', 'hao')
    await flush()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    content.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
    expect(engine.getValue()).toBe('# T\n\nabc')
    expect(changes).toEqual([])
    expect(content.contains(node)).toBe(true)
    node.data = node.data.replace('nihao', '你好')
    content.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
    expect(engine.isComposing()).toBe(false)
    expect(engine.getValue()).toBe('# T\n\nabc你好')
    expect(changes).toEqual(['# T\n\nabc你好'])
    expect(content.contains(node)).toBe(false)
    engine.undo()
    expect(engine.getValue()).toBe('# T\n\nabc')
  })

  it('paste / drop / scroll 事件转发', () => {
    const { host, engine, content } = setup('a')
    const got: Array<[string, unknown]> = []
    engine.on('paste', (e) => got.push(['paste', e]))
    engine.on('drop', (e) => got.push(['drop', e]))
    engine.on('scroll', (e) => got.push(['scroll', e]))
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    content.dispatchEvent(paste)
    content.dispatchEvent(drop)
    host.dispatchEvent(new Event('scroll'))
    expect(got).toEqual([
      ['paste', paste],
      ['drop', drop],
      ['scroll', { scrollTop: 0 }],
    ])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine/cl-edit-engine.test.ts`
Expected: FAIL，`Failed to resolve import "./cl-edit-engine"`。

- [ ] **Step 3: 实现引擎**

`packages/markdown-core/src/engine/cl-edit-engine.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditCore.js
import type {
  EditorEngine,
  EngineEvent,
  EngineOptions,
  SectionOffset,
  Selection,
  TextState,
  Unsubscribe,
} from '../types'
import { Highlighter } from './cledit/highlighter'
import { handleKeystroke } from './cledit/keystrokes'
import { SelectionManager } from './cledit/selection'
import { UndoManager, type UndoManagerOptions, type UndoMode } from './cledit/undo'
import { diffRange } from './cledit/utils'
import { Watcher } from './cledit/watcher'

export interface ClEditEngineOptions {
  highlight?: (text: string) => string
  undo?: UndoManagerOptions
}

type Listener = (payload: unknown) => void

function editableMode(doc: Document): 'plaintext-only' | 'true' {
  const probe = doc.createElement('div')
  try {
    probe.contentEditable = 'plaintext-only'
  } catch {
    return 'true'
  }
  return probe.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'
}

export class ClEditEngine implements EditorEngine {
  private host: HTMLElement | null = null
  private content: HTMLElement | null = null
  private highlighter: Highlighter | null = null
  private selection: SelectionManager | null = null
  private watcher: Watcher | null = null
  private readonly undoMgr: UndoManager
  private value = ''
  private lastSelection: Selection = { start: 0, end: 0 }
  private composing = false
  private readOnly = false
  private readonly listeners = new Map<EngineEvent, Set<Listener>>()
  private cleanups: Array<() => void> = []

  constructor(private readonly options: ClEditEngineOptions = {}) {
    this.undoMgr = new UndoManager(options.undo)
  }

  get contentElement(): HTMLElement | null {
    return this.content
  }

  isComposing(): boolean {
    return this.composing
  }

  mount(el: HTMLElement, opts: EngineOptions): void {
    if (this.host) this.destroy()
    const doc = el.ownerDocument
    const content = doc.createElement('div')
    content.className = 'ex-editor-content'
    content.setAttribute('role', 'textbox')
    content.setAttribute('aria-multiline', 'true')
    content.setAttribute('spellcheck', 'false')
    content.tabIndex = 0
    if (opts.placeholder) content.dataset.placeholder = opts.placeholder
    this.readOnly = opts.readOnly ?? false
    if (this.readOnly) {
      content.setAttribute('contenteditable', 'false')
      content.setAttribute('aria-readonly', 'true')
    } else {
      content.setAttribute('contenteditable', editableMode(doc))
    }
    el.classList.add('ex-editor')
    el.appendChild(content)

    this.host = el
    this.content = content
    this.highlighter = new Highlighter(content, this.options.highlight ? { highlight: this.options.highlight } : {})
    this.selection = new SelectionManager(content, this.highlighter)
    this.watcher = new Watcher(content, () => {
      if (!this.composing) this.syncFromDom()
    })
    this.value = opts.value
    this.lastSelection = { start: 0, end: 0 }
    this.undoMgr.clear()
    this.render(true)
    this.watcher.start()
    this.bindEvents(el, content)
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    this.watcher?.stop()
    this.content?.remove()
    this.host?.classList.remove('ex-editor')
    this.host = null
    this.content = null
    this.highlighter = null
    this.selection = null
    this.watcher = null
    this.composing = false
    this.listeners.clear()
  }

  getValue(): string {
    return this.value
  }

  setValue(md: string, opts: { keepUndo?: boolean } = {}): void {
    const before = this.readSelection()
    const after = this.clamp(before, md.length)
    const change = diffRange(this.value, md)
    if (opts.keepUndo) {
      if (change) this.undoMgr.record(change, before, after, 'single')
    } else {
      this.undoMgr.clear()
    }
    this.value = md
    this.lastSelection = after
    this.render(!opts.keepUndo)
    this.selection?.set(after.start, after.end)
  }

  getSelection(): Selection {
    const s = this.readSelection()
    return { start: Math.min(s.start, s.end), end: Math.max(s.start, s.end) }
  }

  getCursorPosition(): { line: number; column: number } {
    const caret = this.getSelection().end
    let line = 1
    for (let i = this.value.indexOf('\n'); i !== -1 && i < caret; i = this.value.indexOf('\n', i + 1)) line++
    const lineStart = caret === 0 ? 0 : this.value.lastIndexOf('\n', caret - 1) + 1
    return { line, column: caret - lineStart }
  }

  setSelection(start: number, end: number): void {
    const sel = this.clamp({ start, end }, this.value.length)
    this.lastSelection = sel
    this.selection?.set(sel.start, sel.end)
    this.emit('selectionChange', this.getSelection())
  }

  replace(start: number, end: number, text: string): void {
    const s = Math.max(0, Math.min(start, end, this.value.length))
    const e = Math.min(this.value.length, Math.max(start, end, 0))
    this.readSelection()
    const caret = s + text.length
    this.applyState(
      { text: this.value.slice(0, s) + text + this.value.slice(e), selection: { start: caret, end: caret } },
      'single',
    )
  }

  undo(): void {
    const state = this.undoMgr.undo(this.value)
    if (state) this.restoreState(state)
  }

  redo(): void {
    const state = this.undoMgr.redo(this.value)
    if (state) this.restoreState(state)
  }

  focus(): void {
    this.content?.focus({ preventScroll: true })
    this.selection?.set(this.lastSelection.start, this.lastSelection.end)
  }

  on(event: EngineEvent, cb: (payload: unknown) => void): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(cb)
    return () => {
      set.delete(cb)
    }
  }

  getSectionOffsets(): SectionOffset[] {
    const { host, highlighter } = this
    if (!host || !highlighter) return []
    const base = host.getBoundingClientRect().top - host.scrollTop
    return highlighter.sections.map((s) => {
      const rect = s.el.getBoundingClientRect()
      return { start: s.start, end: Math.min(s.end, this.value.length), top: rect.top - base, height: rect.height }
    })
  }

  private emit(event: EngineEvent, payload: unknown): void {
    const set = this.listeners.get(event)
    if (set) for (const cb of [...set]) cb(payload)
  }

  private clamp(sel: Selection, length: number): Selection {
    return {
      start: Math.min(Math.max(0, sel.start), length),
      end: Math.min(Math.max(0, sel.end), length),
    }
  }

  private readSelection(): Selection {
    const saved = this.selection?.hasFocus() ? this.selection.save() : null
    if (saved) this.lastSelection = this.clamp(saved, this.value.length)
    return this.lastSelection
  }

  private render(force: boolean): void {
    const { content, highlighter, watcher, selection } = this
    if (!content || !highlighter || !watcher || !selection) return
    watcher.noWatch(() => {
      highlighter.update(this.value, force)
      content.toggleAttribute('data-empty', this.value === '')
    })
    if (selection.hasFocus()) selection.restore()
  }

  private syncFromDom(): void {
    const { content, selection } = this
    if (!content || !selection) return
    const raw = (content.textContent ?? '').replace(/\r\n?/g, '\n')
    const text = raw.endsWith('\n') ? raw.slice(0, -1) : raw
    const after = this.clamp(selection.save() ?? this.lastSelection, text.length)
    const change = diffRange(this.value, text)
    if (change) {
      const mode: UndoMode = change.removed === '' ? 'typing' : change.inserted === '' ? 'deleting' : 'single'
      this.undoMgr.record(change, this.lastSelection, after, mode)
      this.value = text
    }
    this.lastSelection = after
    selection.set(after.start, after.end)
    this.render(false)
    if (change) this.emit('change', this.value)
  }

  private applyState(next: TextState, mode: UndoMode): void {
    const change = diffRange(this.value, next.text)
    const after = this.clamp(next.selection, next.text.length)
    if (change) {
      this.undoMgr.record(change, this.lastSelection, after, mode)
      this.value = next.text
      this.render(false)
    }
    this.lastSelection = after
    this.selection?.set(after.start, after.end)
    if (change) this.emit('change', this.value)
    this.emit('selectionChange', this.getSelection())
  }

  private restoreState(state: TextState): void {
    const sel = this.clamp(state.selection, state.text.length)
    this.value = state.text
    this.lastSelection = sel
    this.render(false)
    this.selection?.set(sel.start, sel.end)
    this.emit('change', this.value)
    this.emit('selectionChange', this.getSelection())
  }

  private onKeydown(e: KeyboardEvent): void {
    if (this.composing || e.isComposing || e.keyCode === 229 || this.readOnly) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && !e.altKey && (k === 'z' || k === 'y')) {
      e.preventDefault()
      if (k === 'y' || e.shiftKey) this.redo()
      else this.undo()
      return
    }
    const result = handleKeystroke(
      { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, isComposing: false },
      { text: this.value, selection: this.readSelection() },
    )
    if (!result) return
    e.preventDefault()
    this.undoMgr.breakMerge()
    this.applyState(result.state, result.mode)
  }

  private bindEvents(host: HTMLElement, content: HTMLElement): void {
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      target.addEventListener(type, fn)
      this.cleanups.push(() => target.removeEventListener(type, fn))
    }
    listen(content, 'keydown', (e) => this.onKeydown(e))
    listen(content, 'beforeinput', (e) => {
      if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo') return
      e.preventDefault()
      if (e.inputType === 'historyUndo') this.undo()
      else this.redo()
    })
    listen(content, 'compositionstart', () => {
      this.readSelection()
      this.composing = true
    })
    listen(content, 'compositionend', () => {
      this.composing = false
      this.syncFromDom()
    })
    listen(content, 'paste', (e) => this.emit('paste', e))
    listen(content, 'drop', (e) => this.emit('drop', e))
    listen(host, 'scroll', () => this.emit('scroll', { scrollTop: host.scrollTop }))

    const doc = host.ownerDocument
    const onSelectionChange = () => {
      if (this.composing || !this.selection?.hasFocus()) return
      const prev = this.lastSelection
      const next = this.readSelection()
      if (next.start !== prev.start || next.end !== prev.end) this.emit('selectionChange', this.getSelection())
    }
    doc.addEventListener('selectionchange', onSelectionChange)
    this.cleanups.push(() => doc.removeEventListener('selectionchange', onSelectionChange))
  }
}
```

`packages/markdown-core/src/engine/index.ts`:

```ts
export { ClEditEngine } from './cl-edit-engine'
export type { ClEditEngineOptions } from './cl-edit-engine'
export { highlightMarkdown, markdownGrammar } from './cledit/grammar'
```

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export { ClEditEngine, highlightMarkdown, markdownGrammar } from './engine'
export type { ClEditEngineOptions } from './engine'
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/engine; pnpm --filter @geekx/markdown-core typecheck`
Expected: engine 目录全部 PASS；typecheck 无错误。若 IME 用例里 `typeInto` 后 `content.contains(node)` 为 `false`，说明组合期间仍触发了重绘——检查 Watcher 回调是否先判断 `this.composing`。

- [ ] **Step 5: 全量测试与构建，确认 dist 无 'use client'**

Run: `pnpm --filter @geekx/markdown-core test; pnpm --filter @geekx/markdown-core build; Select-String -Path packages/markdown-core/dist/index.js -Pattern "use client" -SimpleMatch`
Expected: 全部测试 PASS；构建成功；`Select-String` 无输出。

- [ ] **Step 6: 提交**

```powershell
git add packages/markdown-core/src/engine/cl-edit-engine.ts packages/markdown-core/src/engine/cl-edit-engine.test.ts packages/markdown-core/src/engine/index.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 新增 ClEditEngine 实现 EditorEngine 接口" -m "组装 cledit 各模块：DOM 同步、分段高亮、选区保持、撤销栈与按键处理。" -m "输入法组合期间暂停同步与重绘，compositionend 时一次性提交并记一步撤销。" -m "转发 paste/drop/scroll 事件，提供 getCursorPosition 行列与同步滚动所需的段偏移。"
```

### Task 6: 样式（编辑区高亮 + 预览基础样式 + theme token）

**Files:**
- Modify: `packages/theme/src/styles.css`（主块 + `@supports` 兜底三块各追加 17 个 token）
- Create: `packages/markdown-core/src/styles.css`
- Test: `packages/markdown-core/src/styles.test.ts`
- Modify（仅当 2a 未加）: `packages/markdown-core/package.json` —— `exports` 含 `"./styles.css": "./dist/styles.css"`，`"sideEffects": ["*.css"]`

**Interfaces:**
- Consumes: Task 3 的 token 类名（`ex-md-*`）；Task 5 的 `.ex-editor`、`.ex-editor-content[data-empty][data-placeholder]`、`.ex-editor-section`；2a 渲染器输出的 `.ex-preview-section`、`.ex-mermaid`、KaTeX `.katex-display`、Prism `.token.*`；契约 Addendum A 的 `.ex-toc > .ex-toc-title + ul`、`.ex-flowchart`（flowchart.js/raphael SVG）、尾部脚注段 `.ex-preview-section.ex-footnotes`（markdown-it-footnote 的 `hr.footnotes-sep`、`ol.footnotes-list`、`sup.footnote-ref`、`a.footnote-backref`）；Mermaid SVG 的内联 `<style>` 被 2a 净化掉，因此节点/连线/文字配色必须由本样式按 Mermaid 类名（`.node`、`.edgePath`、`.flowchart-link`、`.edgeLabel`、`.nodeLabel`、`.label`、`.cluster`、`.marker`、`.actor`、`.messageLine0`、`.messageLine1`、`.messageText`、`.note`）提供。
- Produces: `@geekx/markdown-core/styles.css`；预览容器类名约定 `.ex-preview`（消费者把渲染 HTML 放进带此类名的元素，Task 8 照此使用）；新 theme token：`--ex-color-md-{heading,marker,link,code,code-bg,quote,math,mark-bg,tag}`、`--ex-color-code-{bg,text,comment,keyword,string,number,function,tag}`。

- [ ] **Step 1: 写失败测试**

`packages/markdown-core/src/styles.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

const THIRD_PARTY = new Set([
  'katex-display',
  'token',
  'comment',
  'prolog',
  'doctype',
  'cdata',
  'keyword',
  'boolean',
  'important',
  'atrule',
  'deleted',
  'string',
  'char',
  'attr-value',
  'regex',
  'url',
  'number',
  'constant',
  'symbol',
  'property',
  'function',
  'class-name',
  'tag',
  'selector',
  'attr-name',
  'builtin',
  'inserted',
  'operator',
  'punctuation',
  'footnotes-sep',
  'footnotes-list',
  'footnote-ref',
  'footnote-backref',
  'node',
  'edgePath',
  'path',
  'flowchart-link',
  'edgeLabel',
  'nodeLabel',
  'label',
  'cluster',
  'marker',
  'actor',
  'messageLine0',
  'messageLine1',
  'messageText',
  'note',
])

describe('markdown-core styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) {
      expect(name.startsWith('--ex-'), name).toBe(true)
      expect(themeCss, name).toContain(`${name}:`)
    }
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('自有类名以 ex- 开头，第三方类名在白名单内', () => {
    const classes = [...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]!)
    for (const c of classes) expect(c.startsWith('ex-') || THIRD_PARTY.has(c), c).toBe(true)
  })

  it('覆盖 grammar 产生的全部 token 类型', () => {
    for (const t of ['heading', 'marker', 'strong', 'em', 'strike', 'mark', 'code', 'fence', 'math', 'math-block', 'link', 'image', 'url', 'blockquote', 'task', 'hr', 'tag', 'comment']) {
      expect(css, t).toContain(`.ex-md-${t}`)
    }
  })

  it('覆盖目录、flowchart.js、脚注与 Mermaid 图元', () => {
    for (const selector of ['.ex-toc', '.ex-toc-title', '.ex-flowchart', '.ex-footnotes', '.ex-mermaid .node', '.ex-mermaid .edgeLabel']) {
      expect(css, selector).toContain(selector)
    }
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/styles.test.ts`
Expected: FAIL，`ENOENT ... styles.css`。

- [ ] **Step 3: 在 theme 中追加 token（四处，值必须一一对应）**

`packages/theme/src/styles.css` 主块：在 `  --ex-color-shadow-modal: light-dark(rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.6));` 之后插入：

```css
  --ex-color-md-heading: light-dark(#1f5fbf, #7aa7f0);
  --ex-color-md-marker: light-dark(#b4b5c2, #5f606b);
  --ex-color-md-link: light-dark(#4183f1, #6ea1f5);
  --ex-color-md-code: light-dark(#c7254e, #f08aa6);
  --ex-color-md-code-bg: light-dark(#f3f3f6, #2b2c31);
  --ex-color-md-quote: light-dark(#6a6b7a, #a0a1ad);
  --ex-color-md-math: light-dark(#8e44ad, #c39bd3);
  --ex-color-md-mark-bg: light-dark(#fff3b0, #5c4f12);
  --ex-color-md-tag: light-dark(#2e8b57, #6fcf97);
  --ex-color-code-bg: light-dark(#f6f8fa, #1e1f23);
  --ex-color-code-text: light-dark(#24292e, #d4d4d8);
  --ex-color-code-comment: light-dark(#6a737d, #7f8590);
  --ex-color-code-keyword: light-dark(#d73a49, #ff7b72);
  --ex-color-code-string: light-dark(#032f62, #a5d6ff);
  --ex-color-code-number: light-dark(#005cc5, #79c0ff);
  --ex-color-code-function: light-dark(#6f42c1, #d2a8ff);
  --ex-color-code-tag: light-dark(#22863a, #7ee787);
```

兜底块 `.ex-root,\n  .ex-root[data-ex-theme='light']`：在 `    --ex-color-shadow-modal: rgba(0, 0, 0, 0.16);` 之后插入（4 空格缩进）：

```css
    --ex-color-md-heading: #1f5fbf;
    --ex-color-md-marker: #b4b5c2;
    --ex-color-md-link: #4183f1;
    --ex-color-md-code: #c7254e;
    --ex-color-md-code-bg: #f3f3f6;
    --ex-color-md-quote: #6a6b7a;
    --ex-color-md-math: #8e44ad;
    --ex-color-md-mark-bg: #fff3b0;
    --ex-color-md-tag: #2e8b57;
    --ex-color-code-bg: #f6f8fa;
    --ex-color-code-text: #24292e;
    --ex-color-code-comment: #6a737d;
    --ex-color-code-keyword: #d73a49;
    --ex-color-code-string: #032f62;
    --ex-color-code-number: #005cc5;
    --ex-color-code-function: #6f42c1;
    --ex-color-code-tag: #22863a;
```

兜底块 `.ex-root[data-ex-theme='dark']`：在其 `    --ex-color-shadow-modal: rgba(0, 0, 0, 0.6);` 之后插入（4 空格缩进）；`@media (prefers-color-scheme: dark)` 内的 `.ex-root[data-ex-theme='system']`：在其 `      --ex-color-shadow-modal: rgba(0, 0, 0, 0.6);` 之后插入同样内容（6 空格缩进）：

```css
    --ex-color-md-heading: #7aa7f0;
    --ex-color-md-marker: #5f606b;
    --ex-color-md-link: #6ea1f5;
    --ex-color-md-code: #f08aa6;
    --ex-color-md-code-bg: #2b2c31;
    --ex-color-md-quote: #a0a1ad;
    --ex-color-md-math: #c39bd3;
    --ex-color-md-mark-bg: #5c4f12;
    --ex-color-md-tag: #6fcf97;
    --ex-color-code-bg: #1e1f23;
    --ex-color-code-text: #d4d4d8;
    --ex-color-code-comment: #7f8590;
    --ex-color-code-keyword: #ff7b72;
    --ex-color-code-string: #a5d6ff;
    --ex-color-code-number: #79c0ff;
    --ex-color-code-function: #d2a8ff;
    --ex-color-code-tag: #7ee787;
```

Run: `pnpm --filter @geekx/theme test`
Expected: PASS（`styles.test.ts` 的一致性用例自动覆盖新 token；任何一处漏写会报出具体 token 名）。

- [ ] **Step 4: 编写 markdown-core 样式**

`packages/markdown-core/src/styles.css`:

```css
/* ---------- 编辑区 ---------- */
.ex-editor {
  position: relative;
  overflow: auto;
  background: var(--ex-color-surface);
}

.ex-editor-content {
  box-sizing: border-box;
  min-height: 100%;
  padding: var(--ex-space-4) var(--ex-space-5);
  font-family: var(--ex-font-family-mono);
  font-size: var(--ex-font-size-md);
  line-height: 1.8;
  color: var(--ex-color-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 4;
  outline: none;
  caret-color: var(--ex-color-primary);
}

.ex-editor-content[data-empty]::before {
  position: absolute;
  content: attr(data-placeholder);
  color: var(--ex-color-text-muted);
  pointer-events: none;
}

.ex-md-heading {
  color: var(--ex-color-md-heading);
  font-weight: 600;
}

.ex-md-marker {
  color: var(--ex-color-md-marker);
  font-weight: normal;
}

.ex-md-strong {
  font-weight: 600;
}

.ex-md-em {
  font-style: italic;
}

.ex-md-strike {
  color: var(--ex-color-text-muted);
  text-decoration: line-through;
}

.ex-md-mark {
  background: var(--ex-color-md-mark-bg);
}

.ex-md-code,
.ex-md-fence {
  color: var(--ex-color-md-code);
  background: var(--ex-color-md-code-bg);
  border-radius: var(--ex-radius-sm);
}

.ex-md-math,
.ex-md-math-block {
  color: var(--ex-color-md-math);
}

.ex-md-link,
.ex-md-image,
.ex-md-url {
  color: var(--ex-color-md-link);
}

.ex-md-blockquote {
  color: var(--ex-color-md-quote);
}

.ex-md-list > .ex-md-marker,
.ex-md-task,
.ex-md-hr {
  color: var(--ex-color-primary);
}

.ex-md-tag {
  color: var(--ex-color-md-tag);
}

.ex-md-comment {
  color: var(--ex-color-text-muted);
  font-style: italic;
}

/* ---------- 预览 ---------- */
.ex-preview {
  font-family: var(--ex-font-family);
  font-size: var(--ex-font-size-lg);
  line-height: 1.75;
  color: var(--ex-color-text);
  overflow-wrap: break-word;
}

.ex-preview h1,
.ex-preview h2,
.ex-preview h3,
.ex-preview h4,
.ex-preview h5,
.ex-preview h6 {
  margin: var(--ex-space-6) 0 var(--ex-space-3);
  font-weight: 600;
  line-height: 1.4;
}

.ex-preview h1 { font-size: 1.75em; }
.ex-preview h2 { font-size: 1.5em; }
.ex-preview h3 { font-size: 1.25em; }
.ex-preview h4 { font-size: 1.125em; }
.ex-preview h5 { font-size: 1em; }
.ex-preview h6 { font-size: 0.875em; color: var(--ex-color-text-secondary); }

.ex-preview p,
.ex-preview ul,
.ex-preview ol,
.ex-preview blockquote,
.ex-preview pre,
.ex-preview table {
  margin: 0 0 var(--ex-space-4);
}

.ex-preview a {
  color: var(--ex-color-md-link);
  text-decoration: none;
}

.ex-preview a:hover {
  text-decoration: underline;
}

.ex-preview code {
  padding: 0.1em 0.4em;
  font-family: var(--ex-font-family-mono);
  font-size: 0.875em;
  color: var(--ex-color-md-code);
  background: var(--ex-color-md-code-bg);
  border-radius: var(--ex-radius-sm);
}

.ex-preview pre {
  overflow: auto;
  padding: var(--ex-space-4);
  font-size: var(--ex-font-size-md);
  line-height: 1.6;
  color: var(--ex-color-code-text);
  background: var(--ex-color-code-bg);
  border-radius: var(--ex-radius-md);
}

.ex-preview pre code {
  padding: 0;
  font-size: inherit;
  color: inherit;
  background: none;
}

.ex-preview blockquote {
  padding: var(--ex-space-2) var(--ex-space-4);
  color: var(--ex-color-text-secondary);
  background: var(--ex-color-surface-hover);
  border-left: 4px solid var(--ex-color-border);
}

.ex-preview table {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}

.ex-preview th,
.ex-preview td {
  padding: var(--ex-space-2) var(--ex-space-3);
  border: 1px solid var(--ex-color-border);
}

.ex-preview th {
  font-weight: 600;
  background: var(--ex-color-surface-hover);
}

.ex-preview hr {
  margin: var(--ex-space-6) 0;
  border: 0;
  border-top: 1px solid var(--ex-color-border);
}

.ex-preview img {
  max-width: 100%;
}

.ex-preview mark {
  color: inherit;
  background: var(--ex-color-md-mark-bg);
}

.ex-preview ul:has(> li > input[type='checkbox']) {
  padding-left: var(--ex-space-5);
  list-style: none;
}

.ex-preview li > input[type='checkbox'] {
  margin: 0 var(--ex-space-2) 0 0;
  vertical-align: middle;
}

.ex-preview .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--ex-space-1) 0;
}

.ex-mermaid {
  margin: 0 0 var(--ex-space-4);
  overflow-x: auto;
  text-align: center;
}

.ex-mermaid svg {
  max-width: 100%;
  height: auto;
  font-family: var(--ex-font-family);
}

/* Mermaid 内联 <style> 被净化移除，图元配色在此提供 */
.ex-mermaid .node rect,
.ex-mermaid .node circle,
.ex-mermaid .node ellipse,
.ex-mermaid .node polygon,
.ex-mermaid .node path,
.ex-mermaid .actor,
.ex-mermaid .note {
  fill: var(--ex-color-surface-hover);
  stroke: var(--ex-color-md-heading);
  stroke-width: 1px;
}

.ex-mermaid .cluster rect {
  fill: var(--ex-color-bg);
  stroke: var(--ex-color-border);
}

.ex-mermaid .edgePath .path,
.ex-mermaid .flowchart-link,
.ex-mermaid .messageLine0,
.ex-mermaid .messageLine1 {
  fill: none;
  stroke: var(--ex-color-text-secondary);
  stroke-width: 1.5px;
}

.ex-mermaid .marker {
  fill: var(--ex-color-text-secondary);
  stroke: var(--ex-color-text-secondary);
}

.ex-mermaid text,
.ex-mermaid .label,
.ex-mermaid .nodeLabel,
.ex-mermaid .messageText {
  fill: var(--ex-color-text);
  color: var(--ex-color-text);
}

.ex-mermaid .edgeLabel,
.ex-mermaid .edgeLabel rect {
  fill: var(--ex-color-surface);
  color: var(--ex-color-text-secondary);
  background: var(--ex-color-surface);
}

/* flowchart.js（raphael）颜色由 renderDiagrams 按主题传入，这里只负责布局 */
.ex-flowchart {
  margin: 0 0 var(--ex-space-4);
  overflow-x: auto;
  text-align: center;
}

.ex-flowchart svg {
  max-width: 100%;
  height: auto;
}

/* 目录 */
.ex-toc {
  margin: 0 0 var(--ex-space-4);
}

.ex-toc-title {
  margin: 0 0 var(--ex-space-2);
  font-size: var(--ex-font-size-xl);
  font-weight: 600;
  color: var(--ex-color-text);
}

.ex-toc ul {
  margin: 0;
  padding-left: var(--ex-space-6);
  list-style: disc;
}

.ex-toc ul ul {
  list-style: circle;
}

.ex-toc a {
  color: var(--ex-color-md-link);
}

/* 脚注（文档末尾单独的预览段） */
.ex-footnotes {
  font-size: var(--ex-font-size-md);
  color: var(--ex-color-text-secondary);
}

.ex-footnotes .footnotes-sep {
  margin: var(--ex-space-6) 0 var(--ex-space-4);
}

.ex-footnotes .footnotes-list {
  padding-left: var(--ex-space-6);
}

.ex-preview .footnote-ref a,
.ex-footnotes .footnote-backref {
  color: var(--ex-color-md-link);
  text-decoration: none;
}

.ex-preview .token.comment,
.ex-preview .token.prolog,
.ex-preview .token.doctype,
.ex-preview .token.cdata {
  color: var(--ex-color-code-comment);
  font-style: italic;
}

.ex-preview .token.keyword,
.ex-preview .token.boolean,
.ex-preview .token.important,
.ex-preview .token.atrule,
.ex-preview .token.deleted {
  color: var(--ex-color-code-keyword);
}

.ex-preview .token.string,
.ex-preview .token.char,
.ex-preview .token.attr-value,
.ex-preview .token.regex,
.ex-preview .token.url {
  color: var(--ex-color-code-string);
}

.ex-preview .token.number,
.ex-preview .token.constant,
.ex-preview .token.symbol,
.ex-preview .token.property {
  color: var(--ex-color-code-number);
}

.ex-preview .token.function,
.ex-preview .token.class-name {
  color: var(--ex-color-code-function);
}

.ex-preview .token.tag,
.ex-preview .token.selector,
.ex-preview .token.attr-name,
.ex-preview .token.builtin,
.ex-preview .token.inserted {
  color: var(--ex-color-code-tag);
}

.ex-preview .token.operator,
.ex-preview .token.punctuation {
  color: var(--ex-color-code-text);
}
```

- [ ] **Step 5: 确认 package.json 导出样式**

打开 `packages/markdown-core/package.json`：若 `exports` 中没有 `"./styles.css"`，在 `"."` 条目之后加入 `"./styles.css": "./dist/styles.css",`；若没有 `sideEffects`，在 `"type": "module",` 之后加入 `"sideEffects": ["*.css"],`。

- [ ] **Step 6: 运行确认通过 + 构建产物包含样式**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/styles.test.ts; pnpm --filter @geekx/theme test; pnpm --filter @geekx/markdown-core build; Test-Path packages/markdown-core/dist/styles.css`
Expected: 两组测试 PASS；构建成功；`Test-Path` 输出 `True`。

- [ ] **Step 7: 提交**

```powershell
git add packages/theme/src/styles.css packages/markdown-core/src/styles.css packages/markdown-core/src/styles.test.ts packages/markdown-core/package.json
git commit -m "feat(markdown-core): 新增编辑区高亮与预览基础样式" -m "theme 新增 17 个 Markdown/代码配色 token，主块与 @supports 兜底三块同步。" -m "编辑区按 ex-md-* token 着色，预览覆盖标题、代码、表格、引用、任务列表、目录、脚注、KaTeX、Mermaid 图元与 flowchart.js。" -m "样式测试保证只引用已定义的 --ex-* 变量且自有类名均为 ex- 前缀。"
```

### Task 7: 同步滚动（插值纯函数 + createScrollSync）

**Files:**
- Create: `packages/markdown-core/src/scroll-sync/interpolate.ts`, `interpolate.test.ts`
- Create: `packages/markdown-core/src/scroll-sync/scroll-sync.ts`, `scroll-sync.test.ts`
- Create: `packages/markdown-core/src/scroll-sync/index.ts`
- Modify: `packages/markdown-core/src/index.ts`（末尾追加导出）

**Interfaces:**
- Consumes: `EditorEngine`、`SectionOffset`（2a `src/types.ts`）；`debounce`（Task 1）；`ClEditEngine.getSectionOffsets()` 语义（Task 5：`top` 相对编辑滚动容器内容顶部）；预览 DOM `.ex-preview-section[data-section-index]`（2a 契约）。
- Produces:
  - `type ScrollSide = 'editor' | 'preview'`
  - `interface Dimension { top: number; height: number }`、`interface SectionPair { editor: Dimension; preview: Dimension }`
  - `mapScrollTop(scrollTop: number, pairs: SectionPair[], from: ScrollSide): number` —— 找到第一个 `scrollTop <= top + height` 的段，按段内比例（`(scrollTop - top) / (height || 1)`，下限 0）映射到对侧同下标段；超出最后一段映射到对侧最后一段底部；`pairs` 为空时原样返回。
  - `measurePreviewSections(previewEl: HTMLElement): Dimension[]` —— 按 `data-section-index` 下标返回（相对 `previewEl` 滚动内容顶部）。
  - `buildPairs(editor: SectionOffset[], preview: Array<Dimension | undefined>): SectionPair[]` —— 同下标配对，取两者都存在的段；下标 `>= editor.length` 的预览段（契约 Addendum A.5：2a 的尾部脚注段 `.ex-footnotes`，下标 = 源段数）不参与配对，而是把最后一个配对的预览高度延伸到这些尾段的最底部，使编辑区滚到底时预览也滚到底。
  - `interface ScrollSyncOptions { debounceMs?: number; lockMs?: number }`（默认 16 / 100）
  - `createScrollSync(engine: EditorEngine, editorScrollEl: HTMLElement, previewEl: HTMLElement, opts?: ScrollSyncOptions): { destroy(): void; refresh(): void }` —— 契约签名 + 可选第 4 参。双向：用户滚动哪侧哪侧为源（防抖后同步对侧，结果夹到 `[0, scrollHeight - clientHeight]` 并取整）；写入对侧 `scrollTop` 后对该侧加"来源锁" `lockMs`，锁内该侧 `scroll` 事件被忽略；段尺寸缓存，在 `engine` 的 `change`、两侧 `ResizeObserver`（存在时）后失效、下次同步时重新测量；`refresh()` 立即重新测量并按最近一次的源侧同步（初始为 editor），供预览重新渲染后调用。

**移植说明（偏差）：** 参考 `src/services/optional/scrollSync.js`（`doScrollSync` 1-110 及其后的 `forceScrollSync`/事件绑定）与 `editorSvc.js` 中 `measureSectionDimensions`（`sectionDescList` 的 editor/previewDimension）。偏差：去掉 store 设置、`animationSvc` 动画与 `showSidePreview` 判断（直接赋值 `scrollTop`）；用 `isEditorMoving/isPreviewMoving` 的思路实现为显式"来源锁"；节流改为防抖（spec §4.3）；尺寸测量拆为纯函数便于单测；按 `data-section-index` 配对，依赖 2a/2b 共享的 `splitSections`。

- [ ] **Step 1: 写插值失败测试**

`packages/markdown-core/src/scroll-sync/interpolate.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPairs, mapScrollTop, measurePreviewSections, type SectionPair } from './interpolate'

const PAIRS: SectionPair[] = [
  { editor: { top: 0, height: 100 }, preview: { top: 0, height: 300 } },
  { editor: { top: 100, height: 200 }, preview: { top: 300, height: 100 } },
]

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mapScrollTop', () => {
  it.each([
    [50, 'editor', 150],
    [100, 'editor', 300],
    [200, 'editor', 350],
    [1000, 'editor', 400],
    [150, 'preview', 50],
    [350, 'preview', 200],
    [0, 'preview', 0],
  ] as const)('scrollTop=%d from %s → %d', (top, from, expected) => {
    expect(mapScrollTop(top, PAIRS, from)).toBe(expected)
  })

  it('空 pairs 原样返回', () => {
    expect(mapScrollTop(42, [], 'editor')).toBe(42)
  })

  it('零高度段与首段之前的位置', () => {
    expect(mapScrollTop(0, [{ editor: { top: 0, height: 0 }, preview: { top: 0, height: 50 } }], 'editor')).toBe(0)
    expect(mapScrollTop(0, [{ editor: { top: 20, height: 100 }, preview: { top: 40, height: 100 } }], 'editor')).toBe(40)
  })
})

describe('buildPairs / measurePreviewSections', () => {
  it('按下标配对，缺失的预览段跳过', () => {
    const editor = [
      { start: 0, end: 5, top: 0, height: 10 },
      { start: 5, end: 9, top: 10, height: 20 },
      { start: 9, end: 12, top: 30, height: 5 },
    ]
    const preview = [{ top: 0, height: 100 }, undefined, { top: 150, height: 50 }] as Array<{ top: number; height: number }>
    expect(buildPairs(editor, preview)).toEqual([
      { editor: { top: 0, height: 10 }, preview: { top: 0, height: 100 } },
      { editor: { top: 30, height: 5 }, preview: { top: 150, height: 50 } },
    ])
  })

  it('多出的尾部预览段（脚注）不配对，并入最后一段的预览高度', () => {
    const editor = [
      { start: 0, end: 5, top: 0, height: 100 },
      { start: 5, end: 9, top: 100, height: 100 },
    ]
    const preview = [
      { top: 0, height: 100 },
      { top: 100, height: 200 },
      { top: 300, height: 150 },
    ]
    const pairs = buildPairs(editor, preview)
    expect(pairs).toEqual([
      { editor: { top: 0, height: 100 }, preview: { top: 0, height: 100 } },
      { editor: { top: 100, height: 100 }, preview: { top: 100, height: 350 } },
    ])
    expect(mapScrollTop(200, pairs, 'editor')).toBe(450)
    expect(mapScrollTop(150, pairs, 'editor')).toBe(275)
    expect(mapScrollTop(450, pairs, 'preview')).toBe(200)
  })

  it('测量预览段相对滚动内容顶部的偏移', () => {
    const preview = document.createElement('div')
    preview.innerHTML =
      '<div class="ex-preview-section" data-section-index="0"></div><div class="ex-preview-section" data-section-index="1"></div>'
    Object.defineProperty(preview, 'scrollTop', { value: 30, configurable: true })
    const rect = (top: number, height: number) => ({ top, height }) as DOMRect
    preview.getBoundingClientRect = () => rect(100, 400)
    const [a, b] = [...preview.children] as HTMLElement[]
    a!.getBoundingClientRect = () => rect(70, 120)
    b!.getBoundingClientRect = () => rect(190, 60)
    expect(measurePreviewSections(preview)).toEqual([
      { top: 0, height: 120 },
      { top: 120, height: 60 },
    ])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/scroll-sync/interpolate.test.ts`
Expected: FAIL，`Failed to resolve import "./interpolate"`。

- [ ] **Step 3: 实现插值**

`packages/markdown-core/src/scroll-sync/interpolate.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/scrollSync.js
import type { SectionOffset } from '../types'

export type ScrollSide = 'editor' | 'preview'

export interface Dimension {
  top: number
  height: number
}

export interface SectionPair {
  editor: Dimension
  preview: Dimension
}

export function mapScrollTop(scrollTop: number, pairs: SectionPair[], from: ScrollSide): number {
  if (pairs.length === 0) return scrollTop
  const to: ScrollSide = from === 'editor' ? 'preview' : 'editor'
  for (const pair of pairs) {
    const src = pair[from]
    if (scrollTop > src.top + src.height) continue
    const ratio = Math.max(0, (scrollTop - src.top) / (src.height || 1))
    return pair[to].top + pair[to].height * ratio
  }
  const last = pairs[pairs.length - 1]![to]
  return last.top + last.height
}

export function measurePreviewSections(previewEl: HTMLElement): Dimension[] {
  const base = previewEl.getBoundingClientRect().top - previewEl.scrollTop
  const out: Dimension[] = []
  for (const el of previewEl.querySelectorAll<HTMLElement>('.ex-preview-section[data-section-index]')) {
    const rect = el.getBoundingClientRect()
    out[Number(el.dataset.sectionIndex)] = { top: rect.top - base, height: rect.height }
  }
  return out
}

export function buildPairs(editor: SectionOffset[], preview: Array<Dimension | undefined>): SectionPair[] {
  const pairs: SectionPair[] = []
  const n = Math.min(editor.length, preview.length)
  for (let i = 0; i < n; i++) {
    const e = editor[i]
    const p = preview[i]
    if (e && p) pairs.push({ editor: { top: e.top, height: e.height }, preview: { top: p.top, height: p.height } })
  }
  const last = pairs[pairs.length - 1]
  if (last) {
    let tailBottom = last.preview.top + last.preview.height
    for (let i = editor.length; i < preview.length; i++) {
      const p = preview[i]
      if (p) tailBottom = Math.max(tailBottom, p.top + p.height)
    }
    last.preview.height = tailBottom - last.preview.top
  }
  return pairs
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/scroll-sync/interpolate.test.ts`
Expected: PASS。

- [ ] **Step 5: 写 createScrollSync 失败测试**

`packages/markdown-core/src/scroll-sync/scroll-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorEngine, SectionOffset } from '../types'
import { createScrollSync } from './scroll-sync'

function scroller(scrollHeight: number, clientHeight: number): HTMLElement {
  const el = document.createElement('div')
  let top = 0
  Object.defineProperties(el, {
    scrollTop: { get: () => top, set: (v: number) => (top = v), configurable: true },
    scrollHeight: { value: scrollHeight, configurable: true },
    clientHeight: { value: clientHeight, configurable: true },
  })
  document.body.appendChild(el)
  return el
}

function setupPreview(el: HTMLElement, sections: Array<[number, number]>) {
  el.getBoundingClientRect = () => ({ top: 0, height: el.clientHeight }) as DOMRect
  sections.forEach(([top, height], i) => {
    const s = document.createElement('div')
    s.className = 'ex-preview-section'
    s.dataset.sectionIndex = String(i)
    s.getBoundingClientRect = () => ({ top: top - el.scrollTop, height }) as DOMRect
    el.appendChild(s)
  })
}

function fakeEngine(offsets: SectionOffset[]) {
  const handlers = new Map<string, (p: unknown) => void>()
  const off = vi.fn()
  const engine = {
    getSectionOffsets: vi.fn(() => offsets),
    on: vi.fn((event: string, cb: (p: unknown) => void) => {
      handlers.set(event, cb)
      return off
    }),
  } as unknown as EditorEngine
  return { engine, handlers, off }
}

const OFFSETS: SectionOffset[] = [
  { start: 0, end: 10, top: 0, height: 100 },
  { start: 10, end: 20, top: 100, height: 200 },
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function setup() {
  const editor = scroller(1000, 100)
  const preview = scroller(400, 100)
  setupPreview(preview, [
    [0, 300],
    [300, 100],
  ])
  const { engine, handlers, off } = fakeEngine(OFFSETS)
  const sync = createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
  return { editor, preview, engine, handlers, off, sync }
}

const scrollTo = (el: HTMLElement, top: number) => {
  el.scrollTop = top
  el.dispatchEvent(new Event('scroll'))
}

describe('createScrollSync', () => {
  it('编辑区滚动经防抖后同步预览', () => {
    const { editor, preview } = setup()
    scrollTo(editor, 50)
    expect(preview.scrollTop).toBe(0)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(150)
  })

  it('预览滚动同步编辑区；结果夹到可滚动范围', () => {
    const { editor, preview } = setup()
    scrollTo(preview, 350)
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(200)
    vi.advanceTimersByTime(50)
    scrollTo(editor, 1000)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(300)
  })

  it('来源锁：被动滚动的一侧在锁期内不会反向同步', () => {
    const { editor, preview } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(150)
    preview.dispatchEvent(new Event('scroll'))
    editor.scrollTop = 0
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(0)
    vi.advanceTimersByTime(50)
    scrollTo(preview, 150)
    vi.advanceTimersByTime(10)
    expect(editor.scrollTop).toBe(50)
  })

  it('refresh 立即重新测量并按最近的源同步', () => {
    const { editor, preview, engine, sync } = setup()
    editor.scrollTop = 200
    const calls = vi.mocked(engine.getSectionOffsets).mock.calls.length
    sync.refresh()
    expect(vi.mocked(engine.getSectionOffsets).mock.calls.length).toBe(calls + 1)
    expect(preview.scrollTop).toBe(300)
  })

  it('change 后尺寸缓存失效并重新测量', () => {
    const { editor, engine, handlers } = setup()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    const before = vi.mocked(engine.getSectionOffsets).mock.calls.length
    handlers.get('change')!('new text')
    vi.advanceTimersByTime(60)
    scrollTo(editor, 60)
    vi.advanceTimersByTime(10)
    expect(vi.mocked(engine.getSectionOffsets).mock.calls.length).toBe(before + 1)
  })

  it('尾部脚注段（下标 = 源段数）不配对：编辑区滚到底时预览也到底', () => {
    const editor = scroller(400, 100)
    const preview = scroller(600, 100)
    setupPreview(preview, [
      [0, 300],
      [300, 100],
      [400, 200],
    ])
    preview.lastElementChild!.classList.add('ex-footnotes')
    const { engine } = fakeEngine(OFFSETS)
    createScrollSync(engine, editor, preview, { debounceMs: 10, lockMs: 50 })
    scrollTo(editor, 300)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(500)
  })

  it('destroy 取消订阅并停止同步', () => {
    const { editor, preview, off, sync } = setup()
    sync.destroy()
    expect(off).toHaveBeenCalled()
    scrollTo(editor, 50)
    vi.advanceTimersByTime(10)
    expect(preview.scrollTop).toBe(0)
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `pnpm --filter @geekx/markdown-core exec vitest run src/scroll-sync/scroll-sync.test.ts`
Expected: FAIL，`Failed to resolve import "./scroll-sync"`。

- [ ] **Step 7: 实现**

`packages/markdown-core/src/scroll-sync/scroll-sync.ts`:

```ts
// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/optional/scrollSync.js
import { debounce } from '../engine/cledit/utils'
import type { EditorEngine } from '../types'
import { buildPairs, mapScrollTop, measurePreviewSections, type ScrollSide, type SectionPair } from './interpolate'

export interface ScrollSyncOptions {
  debounceMs?: number
  lockMs?: number
}

export function createScrollSync(
  engine: EditorEngine,
  editorScrollEl: HTMLElement,
  previewEl: HTMLElement,
  opts: ScrollSyncOptions = {},
): { destroy(): void; refresh(): void } {
  const lockMs = opts.lockMs ?? 100
  let pairs: SectionPair[] | null = null
  let lastSource: ScrollSide = 'editor'
  let locked: ScrollSide | null = null
  let lockTimer: ReturnType<typeof setTimeout> | undefined

  const elementOf = (side: ScrollSide) => (side === 'editor' ? editorScrollEl : previewEl)
  const other = (side: ScrollSide): ScrollSide => (side === 'editor' ? 'preview' : 'editor')

  const measure = (): SectionPair[] => {
    pairs = buildPairs(engine.getSectionOffsets(), measurePreviewSections(previewEl))
    return pairs
  }

  const doSync = (source: ScrollSide) => {
    const current = pairs ?? measure()
    const src = elementOf(source)
    const target = other(source)
    const dst = elementOf(target)
    const max = Math.max(0, dst.scrollHeight - dst.clientHeight)
    const next = Math.round(Math.min(Math.max(0, mapScrollTop(src.scrollTop, current, source)), max))
    if (Math.abs(dst.scrollTop - next) < 1) return
    locked = target
    clearTimeout(lockTimer)
    lockTimer = setTimeout(() => {
      locked = null
    }, lockMs)
    dst.scrollTop = next
  }

  const scheduleSync = debounce(doSync, opts.debounceMs ?? 16)

  const onScroll = (side: ScrollSide) => () => {
    if (locked === side) return
    lastSource = side
    scheduleSync(side)
  }
  const onEditorScroll = onScroll('editor')
  const onPreviewScroll = onScroll('preview')
  editorScrollEl.addEventListener('scroll', onEditorScroll, { passive: true })
  previewEl.addEventListener('scroll', onPreviewScroll, { passive: true })

  const invalidate = () => {
    pairs = null
  }
  const offChange = engine.on('change', invalidate)
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate)
  resizeObserver?.observe(editorScrollEl)
  resizeObserver?.observe(previewEl)

  return {
    refresh() {
      scheduleSync.cancel()
      measure()
      doSync(lastSource)
    },
    destroy() {
      scheduleSync.cancel()
      clearTimeout(lockTimer)
      offChange()
      resizeObserver?.disconnect()
      editorScrollEl.removeEventListener('scroll', onEditorScroll)
      previewEl.removeEventListener('scroll', onPreviewScroll)
    },
  }
}
```

`packages/markdown-core/src/scroll-sync/index.ts`:

```ts
export { createScrollSync } from './scroll-sync'
export type { ScrollSyncOptions } from './scroll-sync'
export { buildPairs, mapScrollTop, measurePreviewSections } from './interpolate'
export type { Dimension, ScrollSide, SectionPair } from './interpolate'
```

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export { buildPairs, createScrollSync, mapScrollTop, measurePreviewSections } from './scroll-sync'
export type { Dimension, ScrollSide, ScrollSyncOptions, SectionPair } from './scroll-sync'
```

- [ ] **Step 8: 运行确认通过 + 全量**

Run: `pnpm --filter @geekx/markdown-core test; pnpm --filter @geekx/markdown-core typecheck; pnpm --filter @geekx/markdown-core build`
Expected: 全部 PASS；typecheck 与构建成功。

- [ ] **Step 9: 提交**

```powershell
git add packages/markdown-core/src/scroll-sync/interpolate.ts packages/markdown-core/src/scroll-sync/interpolate.test.ts packages/markdown-core/src/scroll-sync/scroll-sync.ts packages/markdown-core/src/scroll-sync/scroll-sync.test.ts packages/markdown-core/src/scroll-sync/index.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 新增编辑区与预览双向同步滚动" -m "移植 StackEdit 段落对齐插值，按 data-section-index 配对编辑段与预览段。" -m "以用户滚动侧为源，防抖同步对侧并加来源锁避免循环触发。" -m "内容变化与尺寸变化后段尺寸失效，refresh 供预览重渲染后立即对齐。"
```

### Task 8: playground `/markdown-core` 页面 + Playwright e2e + 视觉基线

**Files:**
- Modify: `apps/playground/package.json`（dependencies 追加 `@geekx/markdown-core: workspace:*` 与 `katex`）
- Modify: `apps/playground/app/page.tsx`（追加链接）
- Create: `apps/playground/app/markdown-core/page.tsx`
- Create: `apps/playground/app/markdown-core/markdown-core-demo.tsx`
- Create: `apps/playground/app/markdown-core/markdown-core.css`
- Create: `apps/playground/app/markdown-core/sample.ts`
- Create: `apps/playground/e2e/markdown-core.spec.ts`
- Create（生成）: `apps/playground/e2e/markdown-core.spec.ts-snapshots/markdown-core-light-chromium-win32.png`、`markdown-core-dark-chromium-win32.png`

**Interfaces:**
- Consumes（包根导出，契约 Addendum A.5）：2a 的 `createRenderer(options?: RendererOptions): Renderer`、`renderDiagrams(container: HTMLElement, opts: { theme: 'light' | 'dark' }): Promise<void>`（同时渲染 `.ex-mermaid` 与 `.ex-flowchart`）、`countWords(md: string): { words: number; chars: number; lines: number }`、`countHtml(html: string): { words: number; paragraphs: number }`、类型 `RenderResult`（`sections[i].html` 为段内 HTML，不含包裹层；`html` 含包裹层，且可能以尾部脚注段 `<div class="ex-preview-section ex-footnotes" data-section-index="{源段数}">` 结尾）；2b 的 `ClEditEngine`（含 `getCursorPosition()`，Task 5）、`createScrollSync`（Task 7）、`@geekx/markdown-core/styles.css`（Task 6，预览容器类 `.ex-preview`）；`@geekx/theme` 的 `ThemeProvider`/`useTheme().resolved`；`@geekx/ui` 的 `Button`、`ThemeToggle`（亮色下无障碍名为"切换到暗黑模式"）。
- Produces（e2e 依赖的页面约定）：编辑滚动容器 `[data-testid=editor]`（内含 `.ex-editor-content`）；预览滚动容器 `[data-testid=preview]`（内含 `.ex-preview > .ex-preview-section[data-section-index]`，可能有尾部 `.ex-footnotes` 段）；`[data-testid=change-count]` 文本 `"变更 {n}"`（引擎 `change` 次数）；状态栏 `[data-testid=status-md]` 文本 `"Markdown {countWords.words} 字数 {countWords.lines} 行数 当前行 {line}, 当前列 {column}"`、`[data-testid=status-html]` 文本 `"HTML {countHtml.words} 字数 {countHtml.paragraphs} 段落"`；按钮"加载 10k 行文档"。预览在 `change` 后防抖 200ms 增量更新（只替换 HTML 变化的段，尾部脚注段按其完整 HTML 比较），字数统计随预览一起更新；行/列在每次 `selectionChange`/`change` 时立即更新；主题变化时全量重渲染以按新主题重绘 Mermaid 与 flowchart.js。

**IME 方案：** Chromium 下用 CDP：`const client = await page.context().newCDPSession(page)`；`Input.imeSetComposition({ text, selectionStart, selectionEnd })` 产生真实的 `compositionstart/compositionupdate` 与组合态 DOM 文本；`Input.insertText({ text })` 在组合态下提交并触发 `compositionend`。这走浏览器真实 IME 管线，比手动派发 `CompositionEvent`（不会改 DOM）可靠。注意 `page.keyboard.type` 对非 US 布局字符走 `insertText` 且不派发 `keydown`，所以延迟测量只用 ASCII 按键。

- [ ] **Step 1: 安装依赖**

```powershell
pnpm --filter @geekx/playground add "@geekx/markdown-core@workspace:*"
$katex = (Get-Content packages/markdown-core/package.json -Raw | ConvertFrom-Json).dependencies.katex
pnpm --filter @geekx/playground add "katex@$katex"
```

Expected: `apps/playground/package.json` 出现两项依赖，`katex` 版本与 markdown-core 一致。

- [ ] **Step 2: 示例文档（e2e 也导入它来计算期望值，先写）**

`apps/playground/app/markdown-core/sample.ts`:

```ts
export const SAMPLE = [
  '@[TOC](这里写自定义目录标题)',
  '',
  '# EditorX Markdown 引擎演示',
  '',
  '这是 **ClEditEngine** 的演示，支持 *斜体*、~~删除线~~、==高亮== 与 `行内代码`。',
  '参考 [CSDN][csdn] 与 [StackEdit][1] 的写作体验，这里有一个脚注[^1]。',
  '',
  '[csdn]: https://www.csdn.net',
  '[1]: https://stackedit.io',
  '',
  '## 列表',
  '',
  '- 无序列表',
  '- [x] 已完成任务',
  '- [ ] 未完成任务',
  '',
  '1. 第一步',
  '2. 第二步',
  '',
  '## 代码',
  '',
  '```ts',
  'export function add(a: number, b: number): number {',
  '  return a + b',
  '}',
  '```',
  '',
  '## 公式',
  '',
  '行内公式 $E = mc^2$，块级公式：',
  '',
  '$$',
  '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
  '$$',
  '',
  '## 图表',
  '',
  '```mermaid',
  'graph LR',
  '  A[编辑] --> B[渲染]',
  '  B --> C[预览]',
  '```',
  '',
  '## 流程图',
  '',
  '```mermaid',
  'flowchart',
  'st=>start: 开始',
  'e=>end: 结束',
  'op=>operation: 我的操作',
  'cond=>condition: 确认？',
  '',
  'st->op->cond',
  'cond(yes)->e',
  'cond(no)->op',
  '```',
  '',
  '## 表格与引用',
  '',
  '| 功能 | 状态 |',
  '| --- | --- |',
  '| 高亮 | 完成 |',
  '| 同步滚动 | 完成 |',
  '',
  '> 引用：写作从这里开始，这是第二个脚注[^2]。',
  '',
  '[^1]: 第一个脚注的内容。',
  '[^2]: 第二个脚注的内容。',
  '',
].join('\n')

export function generateLargeDoc(lineCount: number): string {
  const lines: string[] = []
  for (let section = 1; lines.length < lineCount; section++) {
    lines.push(`## 第 ${section} 节`, '')
    for (let row = 1; row <= 46; row++) {
      lines.push(`第 ${section} 节第 ${row} 行：用于性能测试的 **Markdown** 文本，包含 \`code\` 与 [链接](https://example.com)。`)
    }
    lines.push('')
  }
  return lines.slice(0, lineCount).join('\n')
}
```

脚注引用分别位于 `# EditorX…` 段与 `## 表格与引用` 段（两个不同的 section），定义在文末。第 3 行（`# EditorX Markdown 引擎演示`）很短，状态栏用例依赖它不折行。

- [ ] **Step 3: 写失败的 e2e**

`apps/playground/e2e/markdown-core.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { SAMPLE } from '../app/markdown-core/sample'

const editor = (page: Page) => page.locator('.ex-editor-content')
const preview = (page: Page) => page.getByTestId('preview')
const editorValue = (page: Page) => editor(page).evaluate((el) => el.textContent ?? '')
const changeCount = async (page: Page) => Number((await page.getByTestId('change-count').textContent())!.replace(/\D/g, ''))
const statNumber = async (page: Page, testId: string, pattern: RegExp) =>
  Number(pattern.exec((await page.getByTestId(testId).textContent()) ?? '')![1])

async function moveToEnd(page: Page) {
  await editor(page).click()
  await page.keyboard.press('Control+End')
}

async function loadLargeDoc(page: Page) {
  await page.getByRole('button', { name: '加载 10k 行文档' }).click()
  await expect(page.getByTestId('status-md')).toContainText('10000 行数')
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
      editor: first(document.querySelector('[data-testid=editor]')!, '.ex-editor-section'),
      preview: first(document.querySelector('[data-testid=preview]')!, '.ex-preview-section'),
    }
  })
}

async function expectAligned(page: Page) {
  await expect
    .poll(async () => {
      const s = await topSections(page)
      return Math.abs(s.editor - s.preview)
    })
    .toBeLessThanOrEqual(1)
}

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/markdown-core')
  await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
  await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test('输入实时高亮并渲染到预览', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('## 新增标题')
  await expect(editor(page).locator('.ex-md-h2', { hasText: '新增标题' })).toHaveCount(1)
  await expect(preview(page).locator('h2', { hasText: '新增标题' })).toBeVisible()
})

test('回车续写无序与有序列表', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('- 第一项')
  await page.keyboard.press('Enter')
  await page.keyboard.type('第二项')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('1. 甲')
  await page.keyboard.press('Enter')
  await page.keyboard.type('乙')
  await expect.poll(() => editorValue(page)).toContain('- 第一项\n- 第二项\n\n1. 甲\n2. 乙')
  await expect(preview(page).locator('ol > li', { hasText: '乙' })).toBeVisible()
})

test('撤销与重做', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('undo-test')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
  await page.keyboard.press('Control+z')
  await expect.poll(() => editorValue(page)).not.toContain('undo-test')
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+y')
  await expect.poll(() => editorValue(page)).toContain('undo-test')
})

test('输入法组合输入：组合期间不重绘，提交只产生一次变更且高亮恢复', async ({ page }) => {
  await moveToEnd(page)
  await page.keyboard.press('Enter')
  await expect.poll(() => changeCount(page)).toBeGreaterThan(0)
  const before = await changeCount(page)
  await editor(page)
    .locator('.ex-editor-section')
    .last()
    .evaluate((el) => {
      ;(window as unknown as { __exSection: Element }).__exSection = el
    })

  const client = await page.context().newCDPSession(page)
  await client.send('Input.imeSetComposition', { text: 'ni', selectionStart: 2, selectionEnd: 2 })
  await client.send('Input.imeSetComposition', { text: 'nihao', selectionStart: 5, selectionEnd: 5 })
  // 断言"什么都没发生"只能等待一段时间
  await page.waitForTimeout(300)
  expect(await editorValue(page)).toContain('nihao')
  expect(await changeCount(page)).toBe(before)
  expect(await page.evaluate(() => (window as unknown as { __exSection: Element }).__exSection.isConnected)).toBe(true)

  await client.send('Input.insertText', { text: '你好' })
  await expect.poll(() => changeCount(page)).toBe(before + 1)
  await page.waitForTimeout(300)
  expect(await changeCount(page)).toBe(before + 1)
  const value = await editorValue(page)
  expect(value).toContain('你好')
  expect(value).not.toContain('nihao')

  await page.keyboard.type(' **bold**')
  await expect(editor(page).locator('.ex-md-strong', { hasText: '**bold**' })).toHaveCount(1)
  await expect(preview(page).locator('strong', { hasText: 'bold' })).toBeVisible()
})

test('状态栏：字数/行数随输入更新，行列随光标移动更新', async ({ page }) => {
  const md = page.getByTestId('status-md')
  const html = page.getByTestId('status-html')
  await expect(md).toHaveText(/^Markdown \d+ 字数 \d+ 行数 当前行 \d+, 当前列 \d+$/)
  await expect(md).toContainText(`${SAMPLE.split('\n').length} 行数`)
  await expect(html).toHaveText(/^HTML \d+ 字数 \d+ 段落$/)

  // 字数：在文末新起一段输入（不放在标题里，避免目录同步变化影响 HTML 字数）
  const lines = SAMPLE.split('\n')
  const mdWords = await statNumber(page, 'status-md', /Markdown (\d+) 字数/)
  const htmlWords = await statNumber(page, 'status-html', /HTML (\d+) 字数/)
  await moveToEnd(page)
  await expect(md).toContainText(`当前行 ${lines.length}, 当前列 0`)
  await page.keyboard.press('Enter')
  await page.keyboard.type('新增')
  await expect(md).toContainText(`当前行 ${lines.length + 1}, 当前列 2`)
  await expect.poll(() => statNumber(page, 'status-md', /Markdown (\d+) 字数/)).toBe(mdWords + 2)
  await expect.poll(() => statNumber(page, 'status-html', /HTML (\d+) 字数/)).toBe(htmlWords + 2)
  await expect(md).toContainText(`${lines.length + 1} 行数`)

  // 行列：回到开头再移动光标
  await page.keyboard.press('Control+Home')
  await expect(md).toContainText('当前行 1, 当前列 0')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await expect(md).toContainText(`当前行 3, 当前列 ${lines[2]!.length}`)
  await page.keyboard.type(' 新')
  await expect(md).toContainText(`当前行 3, 当前列 ${lines[2]!.length + 2}`)
})

test('自定义标题目录：渲染标题并可跳转到对应标题', async ({ page }) => {
  const toc = preview(page).locator('.ex-toc')
  await expect(toc).toHaveCount(1)
  await expect(toc.locator('.ex-toc-title')).toHaveText('这里写自定义目录标题')
  const link = toc.locator('a', { hasText: '流程图' })
  await expect(link).toHaveCount(1)
  const href = await link.getAttribute('href')
  expect(href).toMatch(/^#.+/)
  const target = preview(page).locator(`[id="${decodeURIComponent(href!.slice(1))}"]`)
  await expect(target).toHaveText('流程图')
  await expect(target).not.toBeInViewport()
  await link.click()
  await expect(target).toBeInViewport()
  await expect.poll(() => preview(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('脚注按出现顺序编号 1、2，且只在文末输出一个列表', async ({ page }) => {
  const p = preview(page)
  await expect(p.locator('.ex-footnotes')).toHaveCount(1)
  await expect(p.locator('.ex-preview > .ex-preview-section').last()).toHaveClass(/ex-footnotes/)
  await expect(p.locator('sup a')).toHaveText([/1/, /2/])
  await expect(p.locator('.ex-footnotes li')).toHaveCount(2)
  await expect(p.locator('.ex-footnotes li').first()).toContainText('第一个脚注的内容')
  await expect(p.locator('.ex-footnotes li').last()).toContainText('第二个脚注的内容')
  const footnoteIndex = Number(await p.locator('.ex-footnotes').getAttribute('data-section-index'))
  expect(footnoteIndex).toBe(await editor(page).locator('.ex-editor-section').count())
})

test('同步滚动：编辑区 → 预览、预览 → 编辑区', async ({ page }) => {
  await loadLargeDoc(page)
  const editorScroll = page.getByTestId('editor')
  const previewScroll = preview(page)

  await editorScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.4
  })
  await expect.poll(() => previewScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect.poll(async () => (await topSections(page)).editor).toBeGreaterThan(0)
  await expectAligned(page)

  const editorIndexBefore = (await topSections(page)).editor
  // 等待来源锁（100ms）过期
  await page.waitForTimeout(200)
  await previewScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.8
  })
  await expect.poll(async () => (await topSections(page)).editor).toBeGreaterThan(editorIndexBefore)
  await expectAligned(page)
})

test('同步滚动：存在尾部脚注段时仍按源段对齐', async ({ page }) => {
  const editorScroll = page.getByTestId('editor')
  const previewScroll = preview(page)
  await expect(previewScroll.locator('.ex-footnotes')).toHaveCount(1)

  await editorScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight * 0.5
  })
  await expect.poll(() => previewScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expectAligned(page)

  await page.waitForTimeout(200)
  await editorScroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expectAligned(page)

  await page.waitForTimeout(200)
  await previewScroll.evaluate((el) => {
    el.scrollTop = 0
  })
  await expect.poll(() => editorScroll.evaluate((el) => el.scrollTop)).toBeLessThanOrEqual(24)
})

test('KaTeX、Mermaid 与 flowchart.js 在亮/暗主题下真实渲染', async ({ page }) => {
  const p = preview(page)
  await expect(p.locator('.katex')).toHaveCount(2)
  await expect(p.locator('.katex-display')).toHaveCount(1)
  await expect(p.locator('.ex-mermaid')).toHaveCount(1)
  await expect(p.locator('.ex-flowchart')).toHaveCount(1)
  const mermaidSvg = p.locator('.ex-mermaid svg').first()
  const flowSvg = p.locator('.ex-flowchart svg').first()
  await expect(mermaidSvg).toContainText('编辑')
  await expect(flowSvg).toContainText('开始')
  await expect(flowSvg).toContainText('确认？')
  const lightSvg = await mermaidSvg.evaluate((el) => el.outerHTML)

  await page.getByRole('button', { name: '切换到暗黑模式' }).click()
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect.poll(() => mermaidSvg.evaluate((el) => el.outerHTML)).not.toBe(lightSvg)
  await expect(mermaidSvg).toContainText('编辑')
  await expect(flowSvg).toBeVisible()
  await expect(flowSvg).toContainText('开始')
  await expect(p.locator('.katex')).toHaveCount(2)
})

test('10k 行文档单次按键延迟 < 50ms', async ({ page }) => {
  await loadLargeDoc(page)
  await editor(page).click({ position: { x: 60, y: 30 } })
  await page.keyboard.press('End')
  await page.evaluate(() => {
    const w = window as unknown as { __exLatency: number[] }
    w.__exLatency = []
    document.querySelector('.ex-editor-content')!.addEventListener(
      'keydown',
      () => {
        const t0 = performance.now()
        requestAnimationFrame(() => {
          setTimeout(() => w.__exLatency.push(performance.now() - t0), 0)
        })
      },
      { capture: true },
    )
  })
  const keys = 'abcdefghijklmnopqrstuvwxyz0123'
  await page.keyboard.type(keys, { delay: 80 })
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __exLatency: number[] }).__exLatency.length))
    .toBe(keys.length)
  const samples = await page.evaluate(() => (window as unknown as { __exLatency: number[] }).__exLatency)
  const sorted = [...samples].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!
  test.info().annotations.push({ type: 'latency-ms', description: JSON.stringify({ median, p95, max: sorted.at(-1) }) })
  expect(await editorValue(page)).toContain(keys)
  expect(median).toBeLessThan(50)
  expect(p95).toBeLessThan(50)
})

test('视觉基线：明亮模式', async ({ page }) => {
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'light')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('markdown-core-light.png')
})

test('视觉基线：暗黑模式', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/markdown-core')
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect(preview(page).locator('.ex-mermaid svg').first()).toBeVisible()
  await expect(preview(page).locator('.ex-flowchart svg').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('markdown-core-dark.png')
})
```

- [ ] **Step 4: 运行确认失败**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm turbo run build --filter=@geekx/playground
pnpm --filter @geekx/playground exec playwright test e2e/markdown-core.spec.ts
```

Expected: FAIL —— `/markdown-core` 返回 404，`beforeEach` 等待 `.ex-mermaid svg` 超时。

- [ ] **Step 5: 页面、样式与客户端组件**

`apps/playground/app/markdown-core/page.tsx`:

```tsx
import '@geekx/markdown-core/styles.css'
import 'katex/dist/katex.min.css'
import './markdown-core.css'
import { MarkdownCoreDemo } from './markdown-core-demo'

export default function MarkdownCorePage() {
  return <MarkdownCoreDemo />
}
```

`apps/playground/app/markdown-core/markdown-core.css`:

```css
.pg-mdc {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--ex-color-bg);
  box-sizing: border-box;
}

.pg-mdc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ex-space-3) var(--ex-space-5);
  background: var(--ex-color-surface);
  border-bottom: 1px solid var(--ex-color-border);
}

.pg-mdc-header h1 {
  margin: 0;
  font-size: var(--ex-font-size-lg);
}

.pg-mdc-actions {
  display: flex;
  align-items: center;
  gap: var(--ex-space-3);
  font-size: var(--ex-font-size-sm);
  color: var(--ex-color-text-secondary);
}

.pg-mdc-panes {
  display: grid;
  flex: 1;
  grid-template-columns: 1fr 1fr;
  min-height: 0;
}

.pg-mdc-pane {
  min-height: 0;
  overflow: auto;
}

.pg-mdc-pane + .pg-mdc-pane {
  border-left: 1px solid var(--ex-color-border);
}

.pg-mdc-preview {
  box-sizing: border-box;
  padding: var(--ex-space-4) var(--ex-space-6);
  background: var(--ex-color-surface);
}

.pg-mdc-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: var(--ex-space-1) var(--ex-space-5);
  font-size: var(--ex-font-size-sm);
  color: var(--ex-color-text-muted);
  background: var(--ex-color-surface);
  border-top: 1px solid var(--ex-color-border);
}
```

`apps/playground/app/markdown-core/markdown-core-demo.tsx`:

```tsx
'use client'

import {
  ClEditEngine,
  countHtml,
  countWords,
  createRenderer,
  createScrollSync,
  renderDiagrams,
  type RenderResult,
} from '@geekx/markdown-core'
import { ThemeProvider, useTheme } from '@geekx/theme'
import { Button, ThemeToggle } from '@geekx/ui'
import { useEffect, useRef, useState } from 'react'
import { generateLargeDoc, SAMPLE } from './sample'

const PREVIEW_DELAY = 200
const FOOTNOTES_OPEN = '<div class="ex-preview-section ex-footnotes"'

function buildSection(doc: Document, html: string, index: number): HTMLElement {
  const el = doc.createElement('div')
  el.className = 'ex-preview-section'
  el.dataset.sectionIndex = String(index)
  el.innerHTML = html
  return el
}

function buildTail(doc: Document, html: string): HTMLElement {
  const template = doc.createElement('template')
  template.innerHTML = html
  return template.content.firstElementChild as HTMLElement
}

function patchPreview(container: HTMLElement, result: RenderResult, previous: string[]): void {
  const doc = container.ownerDocument
  const items = result.sections.map((s) => s.html)
  const tailAt = result.html.lastIndexOf(FOOTNOTES_OPEN)
  if (tailAt !== -1) items.push(result.html.slice(tailAt))
  const tailIndex = tailAt === -1 ? -1 : items.length - 1

  items.forEach((html, i) => {
    const isTail = i === tailIndex
    const current = container.children[i] as HTMLElement | undefined
    if (current && previous[i] === html && current.classList.contains('ex-footnotes') === isTail) {
      if (!isTail && current.dataset.sectionIndex !== String(i)) current.dataset.sectionIndex = String(i)
      return
    }
    const el = isTail ? buildTail(doc, html) : buildSection(doc, html, i)
    if (current) container.replaceChild(el, current)
    else container.appendChild(el)
  })
  while (container.children.length > items.length) container.lastElementChild!.remove()
  previous.splice(0, previous.length, ...items)
}

interface DemoApi {
  engine: ClEditEngine
  renderNow(full: boolean): void
}

interface Stats {
  mdWords: number
  lines: number
  htmlWords: number
  paragraphs: number
}

function Workbench() {
  const { resolved } = useTheme()
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<DemoApi | null>(null)
  const themeRef = useRef(resolved)
  const [changeCount, setChangeCount] = useState(0)
  const [stats, setStats] = useState<Stats>({ mdWords: 0, lines: 0, htmlWords: 0, paragraphs: 0 })
  const [cursor, setCursor] = useState({ line: 1, column: 0 })

  useEffect(() => {
    const editorEl = editorRef.current!
    const scrollEl = scrollRef.current!
    const previewEl = previewRef.current!
    const renderer = createRenderer()
    const engine = new ClEditEngine()
    const previous: string[] = []
    let timer: ReturnType<typeof setTimeout> | undefined

    engine.mount(editorEl, { value: SAMPLE, placeholder: '开始写作…' })
    const sync = createScrollSync(engine, editorEl, scrollEl)

    const renderNow = (full: boolean) => {
      clearTimeout(timer)
      if (full) previous.length = 0
      const value = engine.getValue()
      const result = renderer.render(value)
      patchPreview(previewEl, result, previous)
      const md = countWords(value)
      const html = countHtml(result.html)
      setStats({ mdWords: md.words, lines: md.lines, htmlWords: html.words, paragraphs: html.paragraphs })
      sync.refresh()
      void renderDiagrams(previewEl, { theme: themeRef.current }).then(() => sync.refresh())
    }

    const updateCursor = () => setCursor(engine.getCursorPosition())
    const offChange = engine.on('change', () => {
      setChangeCount((c) => c + 1)
      updateCursor()
      clearTimeout(timer)
      timer = setTimeout(() => renderNow(false), PREVIEW_DELAY)
    })
    const offSelection = engine.on('selectionChange', updateCursor)
    renderNow(true)
    updateCursor()
    apiRef.current = { engine, renderNow }

    return () => {
      clearTimeout(timer)
      offChange()
      offSelection()
      sync.destroy()
      engine.destroy()
      previewEl.innerHTML = ''
      apiRef.current = null
    }
  }, [])

  useEffect(() => {
    if (themeRef.current === resolved) return
    themeRef.current = resolved
    apiRef.current?.renderNow(true)
  }, [resolved])

  const loadLargeDoc = () => {
    const api = apiRef.current
    if (!api) return
    api.engine.setValue(generateLargeDoc(10000))
    api.renderNow(true)
    setCursor(api.engine.getCursorPosition())
  }

  return (
    <main className="pg-mdc">
      <header className="pg-mdc-header">
        <h1>markdown-core 编辑引擎</h1>
        <div className="pg-mdc-actions">
          <span data-testid="change-count">变更 {changeCount}</span>
          <Button size="sm" onClick={loadLargeDoc}>
            加载 10k 行文档
          </Button>
          <ThemeToggle />
        </div>
      </header>
      <div className="pg-mdc-panes">
        <div ref={editorRef} className="pg-mdc-pane" data-testid="editor" />
        <div ref={scrollRef} className="pg-mdc-pane pg-mdc-preview" data-testid="preview">
          <div ref={previewRef} className="ex-preview" />
        </div>
      </div>
      <footer className="pg-mdc-status">
        <span data-testid="status-md">
          {`Markdown ${stats.mdWords} 字数 ${stats.lines} 行数 当前行 ${cursor.line}, 当前列 ${cursor.column}`}
        </span>
        <span data-testid="status-html">{`HTML ${stats.htmlWords} 字数 ${stats.paragraphs} 段落`}</span>
      </footer>
    </main>
  )
}

export function MarkdownCoreDemo() {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <Workbench />
    </ThemeProvider>
  )
}
```

`apps/playground/app/page.tsx`：在 `/compare` 那一项之后追加：

```tsx
        <li><Link href="/markdown-core">编辑引擎 /markdown-core</Link></li>
```

- [ ] **Step 6: 类型检查与构建**

Run: `pnpm --filter @geekx/playground typecheck; pnpm turbo run build --filter=@geekx/playground`
Expected: 无类型错误；`next build` 成功并列出 `/markdown-core` 路由。

- [ ] **Step 7: 生成本页视觉基线（只限新用例）**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test e2e/markdown-core.spec.ts -g "视觉基线" --update-snapshots
```

Expected: 生成 `apps/playground/e2e/markdown-core.spec.ts-snapshots/markdown-core-light-chromium-win32.png` 与 `markdown-core-dark-chromium-win32.png`；打开两张图人工确认：左侧编辑区有分段高亮（标题蓝色、标记灰色），右侧预览顶部是带"这里写自定义目录标题"的目录，下方有 KaTeX、代码块；底部状态栏两组统计可见；暗色图整体为暗底。`git status` 中 `showcase` 基线不得出现变化。

- [ ] **Step 8: 运行全部 e2e**

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm --filter @geekx/playground exec playwright test
```

Expected: 全部 PASS（含原有 showcase/compare 用例）。延迟数据见报告中的 `latency-ms` 注解。若延迟用例失败：先看注解中的 median/p95，不得放宽阈值；按 spec §11 记录结果并在交付说明中提出启用 `CodeMirrorEngine` 的评估。若 IME 用例失败于 `__exSection.isConnected === false`，说明组合期间仍在重绘，回到 Task 5 排查。若脚注用例失败于 `sup a` 数量，先确认 2a 的脚注引用标记结构（`sup.footnote-ref > a`）。

- [ ] **Step 9: 全仓回归**

Run: `pnpm build; pnpm test; pnpm typecheck; pnpm lint`
Expected: 全部成功。

- [ ] **Step 10: 提交**

```powershell
git add apps/playground/package.json pnpm-lock.yaml apps/playground/app/page.tsx apps/playground/app/markdown-core/page.tsx apps/playground/app/markdown-core/markdown-core-demo.tsx apps/playground/app/markdown-core/markdown-core.css apps/playground/app/markdown-core/sample.ts apps/playground/e2e/markdown-core.spec.ts apps/playground/e2e/markdown-core.spec.ts-snapshots/markdown-core-light-chromium-win32.png apps/playground/e2e/markdown-core.spec.ts-snapshots/markdown-core-dark-chromium-win32.png
git commit -m "test(playground): 新增 markdown-core 演示页与端到端测试" -m "演示页组合 ClEditEngine、渲染器、Mermaid/flowchart.js、同步滚动与 CSDN 风格状态栏。" -m "e2e 覆盖输入渲染、列表续写、撤销重做、输入法、目录跳转、脚注、状态栏与双向同步滚动。" -m "新增 10k 行按键延迟（<50ms）断言与亮/暗视觉基线。"
```

---

## 假设与风险（执行前确认）

- **2a 接口（契约 Addendum A 已定）：** `RenderedSection.html` 为段内 HTML、`RenderResult.html` 含包裹层；脚注列表可能是尾部额外段 `.ex-preview-section.ex-footnotes`（下标 = 源段数），Task 7 的 `buildPairs` 不配对它并把它并入最后一段，Task 8 的 `patchPreview` 从 `RenderResult.html` 截取它；包根导出 `createRenderer`、`renderDiagrams`、`isFlowchartJs`、`splitSections`、`countWords`、`countHtml` 与全部类型；`EditorEngine` 含 `getCursorPosition()`。`splitSections('')` 返回 `[]` 或单个空段，Highlighter 两种都兼容。
- **Prism：** 2a 设置 manual 模式；编辑区只用 `Prism.tokenize`，不依赖自动高亮。
- **Mermaid 配色：** 2a 净化掉 Mermaid SVG 的内联 `<style>`，图元配色完全来自 Task 6 按 Mermaid 类名写的样式；Mermaid 升级改类名会导致图元失色（视觉基线会发现）。
- **脚注标记结构：** e2e 假设脚注引用渲染为 `sup > a`（markdown-it-footnote 默认）。
- **性能：** 每次按键为 O(n) 的 `textContent` 读取 + 公共前后缀 diff + `splitSections` + `getCursorPosition` 的换行计数，以及仅变化段的 tokenize；10k 行文档约 210 段。`countWords`/`countHtml` 放在 200ms 防抖的预览更新里，不在按键路径上。若 p95 超 50ms，优先排查 Highlighter 的 `el.textContent === text` 逐段比对，不得放宽阈值（spec §11 的回退是 `CodeMirrorEngine`）。
- **IME：** CDP `Input.imeSetComposition` / `Input.insertText` 仅 Chromium 可用，与当前 Playwright 只有 chromium 项目一致。
- **`contenteditable="plaintext-only"`：** Chromium/Safari/Firefox ≥136 支持；不支持时回落 `true`，粘贴富文本会插入元素，但同步时只读 `textContent` 且重新高亮会清理结构，文本仍正确。