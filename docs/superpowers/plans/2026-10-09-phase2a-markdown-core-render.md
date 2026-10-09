# Phase 2a：`@editorx/markdown-core` 渲染与命令 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建框架无关的 `@editorx/markdown-core` 包，提供共享类型、section 切分、增量 Markdown 渲染器（GFM / 脚注 / KaTeX / emoji / Mermaid 占位 / ex-embed / Prism / DOMPurify）、Mermaid 懒渲染、纯函数编辑命令与导入导出工具。

**Architecture:** `splitSections` 用逐行扫描（跳过围栏代码）在 ATX/setext 标题处切段，渲染器与 2b 的编辑器高亮共用它以保证 section 下标一致。渲染器对每段独立调用 markdown-it，按「全局定义签名 + 段文本」缓存净化后的段 HTML；标题 id 与 `[TOC]` 在组装阶段用全文 slugger 统一回填。命令是 `TextState → TextState` 纯函数，`runCommand` 把新旧文本的最小差异区间交给 `EditorEngine.replace`。

**Tech Stack:** TypeScript ~5.9.3、tsup 8（ESM + d.ts）、vitest 5 + jsdom、markdown-it 15、KaTeX 0.19、mermaid 12（动态 import）、Prism 1.30、DOMPurify 3.4、github-slugger 2、turndown 7 + @joplin/turndown-plugin-gfm。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md`（§4、§9、§11）；共享契约 `.superpowers/phase2-contract.md`（与计划 2b 绑定，类型与文件归属以其为准）。

## Global Constraints

- 包名 `@editorx/markdown-core`，目录 `packages/markdown-core`；框架无关：不得依赖 React，构建产物**不得**带 `'use client'`。
- TypeScript `~5.9.3`；vitest `^5.0.3`；ESM（`"type": "module"`）；tsconfig 继承 `tooling/tsconfig.base.json`（`strict`、`noUncheckedIndexedAccess`、`verbatimModuleSyntax`）。
- 测试环境 jsdom + `../../tooling/test/setup-dom.ts`（与 `packages/theme` 一致）。
- 输出的类名一律 `ex-` 前缀（`ex-preview-section`、`ex-mermaid`、`ex-embed`、`ex-toc`、`ex-task-list-item` …），CSS 变量一律 `--ex-*`；唯一例外是第三方库自带的约定类名（Prism `token`/`language-*`、KaTeX `katex*`、脚注插件 `footnote*`），保持原样以兼容其生态样式。
- 所有渲染输出 HTML（段 HTML、embed 卡片、Mermaid SVG）必须经 DOMPurify 净化；用独立实例 `DOMPurify(window)`，不污染全局实例。
- `src/types.ts` 必须与契约逐字一致；2b 只追加 `src/index.ts` 导出，不改本计划拥有的文件。
- 依赖版本固定为：markdown-it 15.0.2、markdown-it-footnote 4.0.0、markdown-it-abbr 2.0.0、markdown-it-sub 2.0.0、markdown-it-sup 2.0.0、markdown-it-mark 4.0.0、markdown-it-emoji 3.1.0、katex 0.19.0、mermaid 12.1.0、prismjs 1.30.0、@types/prismjs 1.26.6、dompurify 3.4.16、github-slugger 2.0.0、turndown 7.2.4、@types/turndown 5.0.6、@joplin/turndown-plugin-gfm 1.0.68。
- 移植自 StackEdit（Apache-2.0）的文件，文件顶部必须带注释：`// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.`
- 命令行为 Windows PowerShell；提交信息使用中文 Conventional Commits + 3 行描述；只 `git add` 明确列出的文件，**禁止** `git add .` / `git add -A`。

---

## File Structure

```
packages/markdown-core/
├── package.json                 # Task 1
├── tsconfig.json                # Task 1
├── tsup.config.ts               # Task 1（无 'use client'）
├── vitest.config.ts             # Task 1
└── src/
    ├── index.ts                 # Task 1 创建，各任务追加导出，Task 7 定稿
    ├── index.test.ts            # Task 7：公共导出清单
    ├── types.ts                 # Task 1：契约类型（逐字）
    ├── vendor.d.ts              # Task 2：无类型第三方模块声明
    ├── sections.ts / .test.ts   # Task 1：splitSections
    ├── renderer/
    │   ├── md-types.ts          # Task 2：从 markdown-it 推导的 Token/State 类型
    │   ├── escape.ts            # Task 2：escapeHtml
    │   ├── sanitize.ts          # Task 2：DOMPurify 实例与配置
    │   ├── prism-manual.ts      # Task 2：在 prismjs 加载前设置 Prism.manual = true
    │   ├── prism.ts             # Task 2：Prism + 语言组件 + highlight
    │   ├── task-lists.ts        # Task 2：任务列表插件
    │   ├── headings.ts          # Task 2：标题 id 占位 / @[TOC](title)、[TOC] / toc 组装
    │   ├── definitions.ts       # Task 2：跨段链接/缩写定义与脚注定义桩
    │   ├── footnotes.ts         # Task 2：全文脚注编号占位 + 文末统一脚注列表
    │   ├── markdown-it.ts       # Task 2 创建，Task 3 扩展：createMarkdownIt(options)
    │   ├── renderer.ts          # Task 2 创建，Task 3 扩展：createRenderer
    │   ├── renderer.test.ts     # Task 2
    │   ├── math.ts              # Task 3：KaTeX 插件
    │   ├── fences.ts            # Task 3：mermaid / flowchart.js 占位 + ex-embed 围栏
    │   ├── base64.ts            # Task 3：UTF-8 安全的 base64（占位/载荷属性）
    │   ├── extensions.test.ts   # Task 3
    │   ├── diagrams.ts          # Task 4：renderDiagrams（mermaid + flowchart.js 懒加载）
    │   └── diagrams.test.ts     # Task 4
    ├── commands/
    │   ├── helpers.ts           # Task 5：行/行内操作工具
    │   ├── inline.ts            # Task 5：bold/italic/strikethrough/inlineCode/link/image
    │   ├── block.ts             # Task 5：heading/quote/ul/ol/task/codeBlock/table/hr/math/mermaid/toc
    │   ├── registry.ts          # Task 5：commands、runCommand、execCommand
    │   └── commands.test.ts     # Task 5
    └── utils/
        ├── count.ts             # Task 6：countWords + countHtml
        ├── html-to-markdown.ts  # Task 6
        ├── io.ts                # Task 6：exportMarkdown/exportHtml/importFile
        └── utils.test.ts        # Task 6
```

## Tasks

1. Task 1：包脚手架 + `types.ts` + `splitSections`
2. Task 2：核心渲染器（GFM、脚注、缩写、上下标、mark、任务列表、标题 id/TOC、Prism、净化、段缓存）
3. Task 3：KaTeX 数学、emoji、`ex-embed:<type>` 围栏、Mermaid 占位
4. Task 4：`renderDiagrams`（懒加载 mermaid、错误隔离、主题重渲染）
5. Task 5：编辑命令、`commands` 注册表、`runCommand` / `execCommand`
6. Task 6：`countWords`、`exportMarkdown`/`exportHtml`/`importFile`、`htmlToMarkdown`
7. Task 7：公共导出定稿与构建验证

---

### Task 1: 包脚手架、契约类型与 `splitSections`

**Files:**
- Create: `packages/markdown-core/package.json`
- Create: `packages/markdown-core/tsconfig.json`
- Create: `packages/markdown-core/tsup.config.ts`
- Create: `packages/markdown-core/vitest.config.ts`
- Create: `packages/markdown-core/src/types.ts`
- Create: `packages/markdown-core/src/sections.ts`
- Create: `packages/markdown-core/src/index.ts`
- Test: `packages/markdown-core/src/sections.test.ts`

**Interfaces:**
- Consumes: 无（`tooling/tsconfig.base.json`、`tooling/test/setup-dom.ts`、`tooling/copy-css.mjs` 已存在于 Phase 1）。
- Produces:
  - `src/types.ts` 中全部契约类型：`Selection`、`TextState`、`EngineOptions`、`SectionOffset`、`EngineEvent`、`Unsubscribe`、`EditorEngine`、`SourceSection`、`RenderedSection`、`TocItem`、`RenderResult`、`EmbedDef`、`RendererOptions`、`Renderer`。
  - `splitSections(md: string): SourceSection[]`（`src/sections.ts`）——保证 `sections[0].start === 0`、末段 `end === md.length`、`sections[i].start === sections[i-1].end`、`text === md.slice(start, end)`；空串返回 `[{ text: '', start: 0, end: 0 }]`。

- [ ] **Step 1: 创建包配置文件**

`packages/markdown-core/package.json`：

```json
{
  "name": "@editorx/markdown-core",
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
  }
}
```

`packages/markdown-core/tsconfig.json`：

```json
{
  "extends": "../../tooling/tsconfig.base.json",
  "include": ["src", "vitest.config.ts", "tsup.config.ts", "../../tooling/test/setup-dom.ts"]
}
```

`packages/markdown-core/tsup.config.ts`（与 theme 相同，但**不**前置 `'use client'`；`src/styles.css` 由 2b 创建，缺失时 copy-css 会跳过）：

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
  // tsup's string onSuccess cannot pass arguments on Windows, so spawn node directly
  onSuccess: async () => {
    execFileSync(process.execPath, [copyCssScript], { cwd: packageDir, stdio: 'inherit' })
  },
})
```

`packages/markdown-core/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
  },
})
```

- [ ] **Step 2: 创建契约类型（与 `.superpowers/phase2-contract.md` 含 Addendum A 逐字一致；`getCursorPosition` 返回 1 起始行号、0 起始列号）**

`packages/markdown-core/src/types.ts`：

```ts
export interface Selection { start: number; end: number }
export interface TextState { text: string; selection: Selection }

export interface EngineOptions { value: string; placeholder?: string; readOnly?: boolean }
export interface SectionOffset { start: number; end: number; top: number; height: number }
export type EngineEvent = 'change' | 'selectionChange' | 'scroll' | 'paste' | 'drop'
export type Unsubscribe = () => void

export interface EditorEngine {
  mount(el: HTMLElement, opts: EngineOptions): void
  destroy(): void
  getValue(): string
  setValue(md: string, opts?: { keepUndo?: boolean }): void
  getSelection(): Selection
  setSelection(start: number, end: number): void
  replace(start: number, end: number, text: string): void
  undo(): void
  redo(): void
  focus(): void
  on(event: EngineEvent, cb: (payload: unknown) => void): Unsubscribe
  getSectionOffsets(): SectionOffset[]
  getCursorPosition(): { line: number; column: number }
}

export interface SourceSection { text: string; start: number; end: number }
export interface RenderedSection extends SourceSection { html: string }
export interface TocItem { level: number; text: string; id: string }
export interface RenderResult { html: string; sections: RenderedSection[]; toc: TocItem[] }

export interface EmbedDef { type: string; renderHtml(payload: unknown): string }
export interface RendererOptions {
  embeds?: EmbedDef[]
  math?: boolean      // default true
  diagrams?: boolean  // default true (mermaid placeholders)
  emoji?: boolean     // default true
}
export interface Renderer { render(md: string): RenderResult }
```

- [ ] **Step 3: 写失败测试**

`packages/markdown-core/src/sections.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { splitSections } from './sections'

const texts = (md: string) => splitSections(md).map((s) => s.text)

function expectContiguous(md: string) {
  const sections = splitSections(md)
  expect(sections.length).toBeGreaterThan(0)
  expect(sections[0]!.start).toBe(0)
  expect(sections[sections.length - 1]!.end).toBe(md.length)
  sections.forEach((s, i) => {
    if (i > 0) expect(s.start).toBe(sections[i - 1]!.end)
    expect(s.text).toBe(md.slice(s.start, s.end))
  })
}

describe('splitSections', () => {
  it('returns one empty section for empty input', () => {
    expect(splitSections('')).toEqual([{ text: '', start: 0, end: 0 }])
  })

  it('keeps text without headings in a single section', () => {
    expect(texts('hello\n\nworld\n')).toEqual(['hello\n\nworld\n'])
  })

  it('starts a section at every ATX heading', () => {
    expect(texts('# A\npara\n## B\ntext')).toEqual(['# A\npara\n', '## B\ntext'])
  })

  it('keeps leading text before the first heading as its own section', () => {
    expect(texts('intro\n# A\n')).toEqual(['intro\n', '# A\n'])
  })

  it('requires a space after ATX hashes', () => {
    expect(texts('a\n#hashtag\n####### seven\n')).toEqual(['a\n#hashtag\n####### seven\n'])
  })

  it('starts a section at setext headings (at the paragraph start)', () => {
    expect(texts('intro\n\nTitle\n===\nbody\n\nSub\n---\nx')).toEqual([
      'intro\n\n',
      'Title\n===\nbody\n\n',
      'Sub\n---\nx',
    ])
  })

  it('does not treat a thematic break after a blank line as setext', () => {
    expect(texts('a\n\n---\n\nb')).toEqual(['a\n\n---\n\nb'])
  })

  it('does not treat list items or quotes as setext heading text', () => {
    expect(texts('- item\n---\n> quote\n---\n')).toEqual(['- item\n---\n> quote\n---\n'])
  })

  it('never splits inside backtick fences', () => {
    expect(texts('# A\n```\n# not heading\nfoo\n===\n```\n## B')).toEqual([
      '# A\n```\n# not heading\nfoo\n===\n```\n',
      '## B',
    ])
  })

  it('only closes a fence with the same char and at least the same length', () => {
    expect(texts('~~~~\n# x\n~~~\n```\n# y\n~~~~\n# z')).toEqual([
      '~~~~\n# x\n~~~\n```\n# y\n~~~~\n',
      '# z',
    ])
  })

  it('treats an unclosed fence as running to the end', () => {
    expect(texts('# A\n```js\n# b\n# c')).toEqual(['# A\n```js\n# b\n# c'])
  })

  it('does not open a backtick fence whose info string contains a backtick', () => {
    expect(texts('```a`b\n# H\n')).toEqual(['```a`b\n', '# H\n'])
  })

  it('handles CRLF line endings', () => {
    expect(texts('# A\r\nx\r\n\r\nT\r\n===\r\n')).toEqual(['# A\r\nx\r\n\r\n', 'T\r\n===\r\n'])
  })

  it('produces contiguous sections covering the whole text', () => {
    for (const md of [
      '',
      '# only',
      '\n\n# A\n\n',
      'p\n# A\n```\n# x\n```\n## B\nT\n---\n',
      '# A\n# B\n# C',
    ]) {
      expectContiguous(md)
    }
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/sections.test.ts`
Expected: FAIL，`Failed to resolve import "./sections"`。

- [ ] **Step 5: 实现 `splitSections`**

`packages/markdown-core/src/sections.ts`（切段时机对齐 StackEdit `src/services/markdownConversionSvc.js` 的 `parseSections`：顶层标题开启新段；这里用逐行扫描代替 markdown-it 预解析，以便编辑器高亮每次按键都能廉价调用）：

```ts
// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type { SourceSection } from './types'

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t\r]*$/
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t\r]|$)/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t\r]*$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t\r]*$/
const NOT_PARAGRAPH = /^ {0,3}(?:[-*+][ \t]|\d{1,9}[.)][ \t]|>)/

export function splitSections(md: string): SourceSection[] {
  const lines = md.split('\n')
  const lineOffsets: number[] = []
  let offset = 0
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }

  const startLines: number[] = [0]
  const pushStart = (line: number) => {
    if (line > startLines[startLines.length - 1]!) startLines.push(line)
  }

  let fence: { char: string; length: number } | null = null
  let paragraphStart = -1
  lines.forEach((line, i) => {
    if (fence) {
      const close = FENCE_CLOSE.exec(line)
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length) fence = null
      return
    }
    const open = FENCE_OPEN.exec(line)
    if (open && !(open[1]![0] === '`' && open[2]!.includes('`'))) {
      fence = { char: open[1]![0]!, length: open[1]!.length }
      paragraphStart = -1
      return
    }
    if (ATX_HEADING.test(line)) {
      pushStart(i)
      paragraphStart = -1
      return
    }
    if (line.trim() === '') {
      paragraphStart = -1
      return
    }
    if (paragraphStart >= 0 && SETEXT_UNDERLINE.test(line)) {
      pushStart(paragraphStart)
      paragraphStart = -1
      return
    }
    if (THEMATIC_BREAK.test(line) || NOT_PARAGRAPH.test(line)) {
      paragraphStart = -1
      return
    }
    if (paragraphStart < 0) paragraphStart = i
  })

  return startLines.map((line, k) => {
    const start = lineOffsets[line]!
    const nextLine = startLines[k + 1]
    const end = nextLine === undefined ? md.length : lineOffsets[nextLine]!
    return { text: md.slice(start, end), start, end }
  })
}
```

注意：列表项 `- item` 被 `NOT_PARAGRAPH` 置为「非段落」，因此其后的 `---` 不会被当作 setext（CommonMark 中这是列表 + 分割线）。

- [ ] **Step 6: 创建入口**

`packages/markdown-core/src/index.ts`：

```ts
export type {
  EditorEngine,
  EmbedDef,
  EngineEvent,
  EngineOptions,
  RenderedSection,
  Renderer,
  RendererOptions,
  RenderResult,
  SectionOffset,
  Selection,
  SourceSection,
  TextState,
  TocItem,
  Unsubscribe,
} from './types'
export { splitSections } from './sections'
```

- [ ] **Step 7: 安装 workspace 链接并运行测试**

Run: `pnpm install`
Run: `pnpm --filter @editorx/markdown-core exec vitest run src/sections.test.ts`
Expected: PASS（14 tests）。

Run: `pnpm --filter @editorx/markdown-core typecheck; pnpm --filter @editorx/markdown-core build`
Expected: 均成功；`dist/index.js`、`dist/index.d.ts` 生成，控制台出现 `[copy-css] src/styles.css not found, skipping`。

- [ ] **Step 8: Commit**

```powershell
git add packages/markdown-core/package.json packages/markdown-core/tsconfig.json packages/markdown-core/tsup.config.ts packages/markdown-core/vitest.config.ts packages/markdown-core/src/types.ts packages/markdown-core/src/sections.ts packages/markdown-core/src/sections.test.ts packages/markdown-core/src/index.ts pnpm-lock.yaml
git commit -m "feat(markdown-core): 新增 markdown-core 包脚手架、共享类型与 section 切分" -m "1. 新增框架无关的 @editorx/markdown-core 包（tsup ESM + d.ts，不带 'use client'）
2. src/types.ts 按 Phase 2 契约定义 EditorEngine、Renderer、TextState 等共享类型
3. splitSections 在 ATX/setext 标题处切段且不切入围栏代码，段落连续覆盖全文"
```

---

### Task 2: 核心渲染器（GFM 扩展、emoji、标题 id / TOC、全文脚注、Prism、净化、段缓存）

**Files:**
- Create: `packages/markdown-core/src/vendor.d.ts`
- Create: `packages/markdown-core/src/renderer/md-types.ts`
- Create: `packages/markdown-core/src/renderer/escape.ts`
- Create: `packages/markdown-core/src/renderer/sanitize.ts`
- Create: `packages/markdown-core/src/renderer/prism.ts`
- Create: `packages/markdown-core/src/renderer/task-lists.ts`
- Create: `packages/markdown-core/src/renderer/headings.ts`
- Create: `packages/markdown-core/src/renderer/definitions.ts`
- Create: `packages/markdown-core/src/renderer/footnotes.ts`
- Create: `packages/markdown-core/src/renderer/markdown-it.ts`
- Create: `packages/markdown-core/src/renderer/renderer.ts`
- Modify: `packages/markdown-core/src/index.ts`（追加导出）
- Modify: `packages/markdown-core/package.json`（依赖，由 pnpm 写入）
- Test: `packages/markdown-core/src/renderer/renderer.test.ts`

**Interfaces:**
- Consumes: `splitSections(md: string): SourceSection[]`（Task 1）；`RendererOptions`、`Renderer`、`RenderResult`、`RenderedSection`、`TocItem`（`src/types.ts`）。
- Produces:
  - `escapeHtml(s: string): string`（`renderer/escape.ts`）
  - `sanitizeHtml(html: string): string`、`sanitizeSvg(svg: string): string`（`renderer/sanitize.ts`）
  - `highlightCode(code: string, lang: string): string` → `<pre class="language-x"><code class="language-x">…</code></pre>\n`（`renderer/prism.ts`）
  - `taskListsPlugin(md: MarkdownIt): void`（`renderer/task-lists.ts`）
  - `md-types.ts`：`Token`、`CoreRule`、`StateCore`、`InlineRule`、`StateInline`、`BlockRule`、`StateBlock`、`interface HeadingInfo { level: number; text: string }`、`interface RenderEnv { exHeadings?: HeadingInfo[]; exTocTitles?: string[]; exFootnoteRefs?: string[] }`
  - `headings.ts`：`headingsPlugin(md)`、`assignHeadingIds(htmls: string[], headings: HeadingInfo[][]): { htmls: string[]; toc: TocItem[] }`、`renderTocHtml(toc: TocItem[]): string`、`fillToc(html: string, titles: string[], toc: TocItem[]): string`、常量 `HEADING_ID_PLACEHOLDER`
  - `definitions.ts`：`collectDefinitions(md: string): string`（引用链接/缩写定义原文 + 脚注定义桩 `[^label]: ex-footnote`）、`collectFootnoteDefinitions(md: string): Map<string, string>`（label → 去缩进的定义正文）
  - `footnotes.ts`：`footnotesPlugin(md)`、`interface FootnoteEntry { label: string; n: number; count: number }`、`assignFootnotes(htmls: string[], refs: string[][]): { htmls: string[]; footnotes: FootnoteEntry[] }`、`renderFootnotesHtml(footnotes: FootnoteEntry[], defs: Map<string, string>, renderBody: (md: string) => string): string`
  - `markdown-it.ts`：`interface ResolvedRendererOptions { embeds: Map<string, EmbedDef>; math: boolean; diagrams: boolean; emoji: boolean }`、`resolveRendererOptions(options?: RendererOptions): ResolvedRendererOptions`、`createMarkdownIt(options: ResolvedRendererOptions): MarkdownIt`（Task 3 在其中挂数学与围栏分派）
  - `createRenderer(options?: RendererOptions): Renderer`（`renderer/renderer.ts`，从 `src/index.ts` 导出）
  - 输出约定（2b 依赖）：
    - `html` = 每段 `<div class="ex-preview-section" data-section-index="{i}">{sectionHtml}</div>` 依次拼接，段数与下标**严格等于** `splitSections(md)`（不额外增加段，2b 的同步滚动无需特殊处理）。
    - 标题 `id` 为全文唯一的 github-slugger slug。
    - 独占一行的 `[TOC]`、`@[TOC]`、`@[TOC](标题)`（不区分大小写）→ `<div class="ex-toc"><p class="ex-toc-title">{标题}</p><ul>…按级别嵌套…</ul></div>`，无标题时省略 `<p>`；链接 `<a href="#{id}">`，覆盖全文标题。
    - 脚注按**全文首次引用顺序**编号；引用 `<sup class="footnote-ref"><a href="#fn{n}" id="fnref{n}">[{n}]</a></sup>`（同一脚注第 k 次引用 id 为 `fnref{n}:{k}`，k 从 1 起）；全文**唯一一份**脚注列表追加在**最后一段**末尾：`<div class="ex-footnotes"><hr class="footnotes-sep"><section class="footnotes"><ol class="footnotes-list"><li id="fn{n}" class="footnote-item">…<a href="#fnref{n}" class="footnote-backref">↩︎</a></li>…</ol></section></div>`。
    - 任务列表 `ul.ex-task-list > li.ex-task-list-item > input.ex-task-list-item-checkbox[disabled]`。

设计决定（执行者无需再议）：
- 每段独立 `md.render`，缓存键 = 「段源文本 + 全文定义块」。引用链接、缩写定义（`[x]: …`、`*[X]: …`）原文以及脚注定义桩（`[^n]: ex-footnote`）由 `collectDefinitions` 从全文提取并追加到每段源文本末尾，使跨段引用可解析。脚注正文不进入段缓存键，所以改脚注正文只会重渲染定义所在段与脚注列表。
- 所有依赖全文的输出都在**组装阶段**由占位符回填，段缓存里只存与全文无关的 HTML：标题 `id="ex-heading-id-placeholder"`、TOC `<div class="ex-toc" data-ex-toc="{k}"></div>`（标题文字存在缓存条目的 `tocTitles` 中）、脚注引用 `ex-fn-ref-{k}-href|id|num`（label 存在 `footnoteRefs` 中）。因此其他段的标题或脚注引用变化时，TOC 段和脚注引用段无需重渲染也总是正确——这比契约要求的「TOC 段缓存键含 toc 签名」更强且更省；回填值都经 `escapeHtml` 或是纯数字，在净化之后注入是安全的。
- 脚注：保留 markdown-it-footnote 的解析，禁用行内脚注 `^[…]`（CSDN 不支持），在 `footnote_tail` 之后删除插件生成的段内列表；全文列表由 `renderFootnotesHtml` 统一生成，脚注正文按正文文本缓存。脚注列表附加到最后一段而不是新增一段，以保证预览段下标与 `splitSections` 一一对应。
- 第三方约定类名保留原样：Prism 的 `token *`、`language-*`，脚注插件的 `footnote*`，KaTeX 的 `katex*`；本包自己生成的类名一律 `ex-` 前缀。
- 净化依赖 DOM：浏览器或 jsdom 中可用；无 `window` 时 `sanitizeHtml` 抛出明确错误。

- [ ] **Step 1: 安装依赖（固定版本）**

Run:

```powershell
pnpm --filter @editorx/markdown-core add markdown-it@15.0.2 markdown-it-footnote@4.0.0 markdown-it-abbr@2.0.0 markdown-it-sub@2.0.0 markdown-it-sup@2.0.0 markdown-it-mark@4.0.0 markdown-it-emoji@3.1.0 prismjs@1.30.0 dompurify@3.4.16 github-slugger@2.0.0
pnpm --filter @editorx/markdown-core add -D @types/prismjs@1.26.6
```

Expected: `packages/markdown-core/package.json` 出现 `dependencies` 与 `devDependencies`，`pnpm-lock.yaml` 更新。markdown-it 15 自带类型，**不要**安装 `@types/markdown-it`（会与自带类型冲突）。

- [ ] **Step 2: 写失败测试**

`packages/markdown-core/src/renderer/renderer.test.ts`：

```ts
import MarkdownIt from 'markdown-it'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { splitSections } from '../sections'
import { createRenderer } from './renderer'

function dom(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRenderer — structure', () => {
  it('wraps every source section in an indexed ex-preview-section', () => {
    const md = '# A\n\ntext\n\n## B\n'
    const result = createRenderer().render(md)
    expect(result.html).toBe(
      '<div class="ex-preview-section" data-section-index="0"><h1 id="a">A</h1>\n<p>text</p>\n</div>' +
        '<div class="ex-preview-section" data-section-index="1"><h2 id="b">B</h2>\n</div>',
    )
    expect(result.sections.map(({ text, start, end }) => ({ text, start, end }))).toEqual(splitSections(md))
    expect(result.sections[1]!.html).toBe('<h2 id="b">B</h2>\n')
  })

  it('assigns document-unique slug ids and builds the toc', () => {
    const result = createRenderer().render('# Intro\n## Intro\n# 中文 标题\n### `code` **bold**')
    expect(result.toc).toEqual([
      { level: 1, text: 'Intro', id: 'intro' },
      { level: 2, text: 'Intro', id: 'intro-1' },
      { level: 1, text: '中文 标题', id: '中文-标题' },
      { level: 3, text: 'code bold', id: 'code-bold' },
    ])
    expect(result.html).toContain('<h2 id="intro-1">Intro</h2>')
  })

  it('replaces a [TOC] paragraph with a nested toc list', () => {
    const result = createRenderer().render('[TOC]\n\n# A\n## B\n# C')
    expect(result.sections[0]!.html).toBe(
      '<div class="ex-toc"><ul><li><a href="#a">A</a><ul><li><a href="#b">B</a></li></ul></li><li><a href="#c">C</a></li></ul></div>\n',
    )
  })

  it('supports @[TOC](title) with a title paragraph and @[TOC] without', () => {
    expect(createRenderer().render('@[TOC](自定义目录标题)\n\n# A').sections[0]!.html).toBe(
      '<div class="ex-toc"><p class="ex-toc-title">自定义目录标题</p><ul><li><a href="#a">A</a></li></ul></div>\n',
    )
    expect(createRenderer().render('@[toc]\n\n# A').sections[0]!.html).toBe(
      '<div class="ex-toc"><ul><li><a href="#a">A</a></li></ul></div>\n',
    )
    expect(createRenderer().render('@[TOC](<b>x</b>)\n\n# A').sections[0]!.html).toContain(
      '<p class="ex-toc-title">&lt;b&gt;x&lt;/b&gt;</p>',
    )
  })

  it('keeps [TOC] inside other text untouched', () => {
    expect(createRenderer().render('see [TOC] here').html).toContain('<p>see [TOC] here</p>')
  })

  it('updates a cached TOC section when a heading in another section changes', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    renderer.render('[TOC]\n\n# A\n# B')
    expect(spy).toHaveBeenCalledTimes(3)
    const result = renderer.render('[TOC]\n\n# A\n# B2')
    expect(spy).toHaveBeenCalledTimes(4)
    expect(result.sections[0]!.html).toContain('<a href="#b2">B2</a>')
    expect(result.sections[0]!.html).not.toContain('href="#b"')
  })
})

describe('createRenderer — footnotes', () => {
  it('numbers footnotes document-wide and lists them once at the end', () => {
    const md = '# A\nx[^a]\n# B\ny[^b] z[^a]\n\n[^a]: note A\n[^b]: note B'
    const result = createRenderer().render(md)
    expect(result.sections).toHaveLength(2)
    expect(result.html).not.toContain('ex-fn-ref')
    const el = dom(result.html)

    const refs = Array.from(el.querySelectorAll('sup.footnote-ref a'))
    expect(refs.map((a) => a.textContent)).toEqual(['[1]', '[2]', '[1]'])
    expect(refs.map((a) => a.getAttribute('href'))).toEqual(['#fn1', '#fn2', '#fn1'])
    expect(refs.map((a) => a.id)).toEqual(['fnref1', 'fnref2', 'fnref1:1'])

    expect(el.querySelectorAll('section.footnotes')).toHaveLength(1)
    const lastSection = el.querySelector('.ex-preview-section[data-section-index="1"]')!
    expect(lastSection.querySelector('.ex-footnotes section.footnotes')).not.toBeNull()
    const items = Array.from(el.querySelectorAll('li.footnote-item'))
    expect(items.map((li) => li.id)).toEqual(['fn1', 'fn2'])
    expect(items[0]!.textContent).toContain('note A')
    expect(items[1]!.textContent).toContain('note B')

    const backrefs = Array.from(items[0]!.querySelectorAll('a.footnote-backref')).map((a) => a.getAttribute('href'))
    expect(backrefs).toEqual(['#fnref1', '#fnref1:1'])
    for (const href of [...backrefs, ...refs.map((a) => a.getAttribute('href'))]) {
      expect(el.querySelector(`[id="${href!.slice(1)}"]`)).not.toBeNull()
    }
  })

  it('numbers by first reference, not by definition order', () => {
    const el = dom(createRenderer().render('p[^b]\n# H\nq[^a]\n\n[^a]: A\n[^b]: B').html)
    const items = Array.from(el.querySelectorAll('li.footnote-item'))
    expect(items.map((li) => li.textContent?.replace('↩︎', '').trim())).toEqual(['B', 'A'])
  })

  it('renumbers cached sections without re-rendering them', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    const tail = '# B\ny[^b]\n\n[^a]: A\n[^b]: B'
    renderer.render(`# A\nx[^a]\n${tail}`)
    expect(spy).toHaveBeenCalledTimes(4)
    const result = renderer.render(`# A\nw[^b] x[^a]\n${tail}`)
    expect(spy).toHaveBeenCalledTimes(5)
    const sectionB = dom(result.sections[1]!.html)
    expect(sectionB.querySelector('sup.footnote-ref a')?.textContent).toBe('[1]')
    expect(sectionB.querySelector('sup.footnote-ref a')?.id).toBe('fnref1:1')
  })

  it('supports multi-line definitions and omits the list without references', () => {
    const el = dom(createRenderer().render('see[^n]\n\n[^n]: first\n    second').html)
    expect(el.querySelector('li#fn1')?.textContent).toContain('second')
    expect(createRenderer().render('text\n\n[^u]: unused').html).not.toContain('footnote')
  })
})

describe('createRenderer — markdown extensions', () => {
  const render = (md: string) => createRenderer().render(md).html

  it('renders GFM tables with alignment', () => {
    const html = render('| a | b |\n|:-|-:|\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th style="text-align:left">a</th>')
    expect(html).toContain('<td style="text-align:right">2</td>')
  })

  it('renders strikethrough, sub, sup and mark', () => {
    const html = render('~~del~~ H~2~O x^2^ ==hi==')
    expect(html).toContain('<s>del</s>')
    expect(html).toContain('<sub>2</sub>')
    expect(html).toContain('<sup>2</sup>')
    expect(html).toContain('<mark>hi</mark>')
  })

  it('renders task lists as disabled checkboxes', () => {
    const el = dom(render('- [ ] todo\n- [x] done\n- plain'))
    const items = el.querySelectorAll('ul.ex-task-list > li.ex-task-list-item')
    expect(items).toHaveLength(2)
    const boxes = el.querySelectorAll<HTMLInputElement>('input.ex-task-list-item-checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]!.checked).toBe(false)
    expect(boxes[1]!.checked).toBe(true)
    expect(boxes[0]!.disabled).toBe(true)
    expect(items[0]!.textContent?.trim()).toBe('todo')
  })

  it('resolves abbreviations', () => {
    expect(render('*[HTML]: Hyper Text\n\nHTML rocks')).toContain('<abbr title="Hyper Text">HTML</abbr>')
  })

  it('resolves reference-style links defined in another section', () => {
    const result = createRenderer().render('[x][ref] and [y][1]\n# B\n[ref]: https://e.com\n[1]: https://one.com "One"')
    expect(result.sections[0]!.html).toContain('<a href="https://e.com">x</a>')
    expect(result.sections[0]!.html).toContain('<a href="https://one.com" title="One">y</a>')
    expect(result.sections[1]!.html).not.toContain('https://e.com')
  })

  it('renders :emoji: shortcodes and can disable them', () => {
    expect(render(':smile:')).toContain('😄')
    expect(createRenderer({ emoji: false }).render(':smile:').html).toContain(':smile:')
  })

  it('highlights fenced code with Prism and escapes unknown languages', () => {
    expect(render('```js\nconst a = 1\n```')).toContain(
      '<pre class="language-js"><code class="language-js"><span class="token keyword">const</span>',
    )
    expect(render('```nope\n<b>\n```')).toContain('<pre class="language-nope"><code class="language-nope">&lt;b&gt;\n</code></pre>')
    expect(render('```\nx\n```')).toContain('<pre><code>x\n</code></pre>')
  })

  it('puts Prism in manual mode so it never auto-highlights the host page', () => {
    expect((globalThis as { Prism?: { manual?: boolean } }).Prism?.manual).toBe(true)
  })
})

describe('createRenderer — sanitization', () => {
  const render = (md: string) => createRenderer().render(md).html

  function expectSafe(html: string) {
    const el = dom(html)
    expect(el.querySelector('script, iframe, style, object, embed')).toBeNull()
    for (const node of Array.from(el.querySelectorAll('*'))) {
      for (const attr of Array.from(node.attributes)) {
        expect(attr.name.startsWith('on')).toBe(false)
        if (attr.name === 'href' || attr.name === 'src') expect(attr.value).not.toMatch(/^\s*javascript:/i)
      }
    }
  }

  it.each([
    '<script>alert(1)</script>',
    '<img src="x" onerror="alert(1)">',
    '[a](javascript:alert(1))',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<style>body{display:none}</style>',
    '<div onclick="alert(1)">x</div>',
    '<svg><script>alert(1)</script></svg>',
  ])('strips dangerous markup: %s', (md) => {
    expectSafe(render(md))
  })

  it('keeps harmless inline html', () => {
    expect(render('<kbd>Ctrl</kbd> <span title="t">x</span>')).toContain('<kbd>Ctrl</kbd>')
  })
})

describe('createRenderer — incremental cache', () => {
  it('only re-renders sections whose source changed', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    const first = renderer.render('intro\n# A\naaa\n# B\nbbb')
    expect(spy).toHaveBeenCalledTimes(3)

    renderer.render('intro\n# A\naaa\n# B\nbbb')
    expect(spy).toHaveBeenCalledTimes(3)

    const second = renderer.render('intro\n# A\naaa\n# B\nbbb changed')
    expect(spy).toHaveBeenCalledTimes(4)
    expect(second.sections[1]!.html).toBe(first.sections[1]!.html)
  })

  it('invalidates every section when a shared definition changes', () => {
    const spy = vi.spyOn(MarkdownIt.prototype, 'render')
    const renderer = createRenderer()
    renderer.render('[x][r]\n# B\n[r]: https://a.com')
    expect(spy).toHaveBeenCalledTimes(2)
    const result = renderer.render('[x][r]\n# B\n[r]: https://b.com')
    expect(spy).toHaveBeenCalledTimes(4)
    expect(result.sections[0]!.html).toContain('https://b.com')
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/renderer/renderer.test.ts`
Expected: FAIL，`Failed to resolve import "./renderer"`。

- [ ] **Step 4: 第三方无类型模块声明**

`packages/markdown-core/src/vendor.d.ts`（Task 3/6 用到的 emoji、turndown-gfm 也在此一并声明）：

```ts
declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-abbr' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sub' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sup' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-mark' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it'
  export const full: (md: MarkdownIt) => void
}

declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  type Plugin = (service: TurndownService) => void
  export const gfm: Plugin
  export const tables: Plugin
  export const strikethrough: Plugin
  export const taskListItems: Plugin
}
```

- [ ] **Step 5: 基础工具模块**

`packages/markdown-core/src/renderer/md-types.ts`（从 markdown-it 15 自带类型推导，避免依赖其内部路径）：

```ts
import type MarkdownIt from 'markdown-it'

export type Token = ReturnType<MarkdownIt['parse']>[number]
export type CoreRule = Parameters<MarkdownIt['core']['ruler']['push']>[1]
export type StateCore = Parameters<CoreRule>[0]
export type InlineRule = Parameters<MarkdownIt['inline']['ruler']['push']>[1]
export type StateInline = Parameters<InlineRule>[0]
export type BlockRule = Parameters<MarkdownIt['block']['ruler']['push']>[1]
export type StateBlock = Parameters<BlockRule>[0]

export interface HeadingInfo {
  level: number
  text: string
}

/** Per-render env shared by the ex-* markdown-it plugins; read back by renderer.ts. */
export interface RenderEnv {
  exHeadings?: HeadingInfo[]
  exTocTitles?: string[]
  exFootnoteRefs?: string[]
}
```

`packages/markdown-core/src/renderer/escape.ts`：

```ts
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]!)
}
```

`packages/markdown-core/src/renderer/sanitize.ts`：

```ts
import DOMPurify, { type Config } from 'dompurify'

let instance: typeof DOMPurify | null = null

function purifier(): typeof DOMPurify {
  if (!instance) {
    if (typeof window === 'undefined') {
      throw new Error('[editorx/markdown-core] HTML sanitization requires a DOM (browser or jsdom)')
    }
    instance = DOMPurify(window)
  }
  return instance
}

const HTML_CONFIG: Config = {
  ADD_TAGS: ['semantics', 'annotation'],
  ADD_ATTR: ['target', 'encoding'],
  FORBID_TAGS: ['style'],
}

const SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  FORBID_TAGS: ['script', 'style'],
}

export function sanitizeHtml(html: string): string {
  return String(purifier().sanitize(html, HTML_CONFIG))
}

export function sanitizeSvg(svg: string): string {
  return String(purifier().sanitize(svg, SVG_CONFIG))
}
```

注意：Mermaid 的 SVG 内自带 `<style>`，`sanitizeSvg` 去掉它后由主题 CSS（2b 的 `styles.css`）或 mermaid `themeVariables` 内联属性负责外观；Task 4 中 mermaid 配置 `htmlLabels: false` 使文字为原生 SVG `<text>`。

`packages/markdown-core/src/renderer/prism-manual.ts`（必须在 `prismjs` 之前求值，阻止 Prism 在浏览器中自动高亮页面上的 `code[class*=language-]`）：

```ts
const g = globalThis as { Prism?: { manual?: boolean } }
g.Prism = { ...g.Prism, manual: true }
export {}
```

`packages/markdown-core/src/renderer/prism.ts`：

```ts
import './prism-manual'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript.js'
import 'prismjs/components/prism-jsx.js'
import 'prismjs/components/prism-tsx.js'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-python.js'
import 'prismjs/components/prism-java.js'
import 'prismjs/components/prism-c.js'
import 'prismjs/components/prism-cpp.js'
import 'prismjs/components/prism-csharp.js'
import 'prismjs/components/prism-go.js'
import 'prismjs/components/prism-rust.js'
import 'prismjs/components/prism-sql.js'
import 'prismjs/components/prism-yaml.js'
import 'prismjs/components/prism-markdown.js'
import 'prismjs/components/prism-diff.js'
import { escapeHtml } from './escape'

export function highlightCode(code: string, lang: string): string {
  const name = lang.trim().toLowerCase()
  const grammar = name ? Prism.languages[name] : undefined
  const cls = name ? ` class="language-${escapeHtml(name)}"` : ''
  const body = grammar ? Prism.highlight(code, grammar, name) : escapeHtml(code)
  return `<pre${cls}><code${cls}>${body}</code></pre>\n`
}
```

`prism-cpp` 依赖 `prism-c`，`prism-tsx` 依赖 `prism-jsx` + `prism-typescript`，上面的 import 顺序即加载顺序，不可调换。若 typecheck 报 `prismjs/components/*.js` 无声明，在 `vendor.d.ts` 末尾追加 `declare module 'prismjs/components/*'`。

- [ ] **Step 6: 任务列表插件**

`packages/markdown-core/src/renderer/task-lists.ts`（行为对齐 StackEdit `src/libs/markdownItTasklist.js`）：

```ts
// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type MarkdownIt from 'markdown-it'

const TASK_MARKER = /^\[([ xX])\][ \t]/

export function taskListsPlugin(md: MarkdownIt): void {
  md.core.ruler.after('text_join', 'ex_task_lists', (state) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]!
      const item = tokens[i - 2]!
      if (inline.type !== 'inline' || tokens[i - 1]!.type !== 'paragraph_open' || item.type !== 'list_item_open') {
        continue
      }
      const match = TASK_MARKER.exec(inline.content)
      const first = inline.children?.[0]
      if (!match || !first || first.type !== 'text' || !first.content.startsWith(match[0])) continue

      first.content = first.content.slice(match[0].length)
      inline.content = inline.content.slice(match[0].length)
      const checkbox = new state.Token('html_inline', '', 0)
      const checked = match[1] === ' ' ? '' : ' checked'
      checkbox.content = `<input class="ex-task-list-item-checkbox" type="checkbox" disabled${checked}> `
      inline.children!.unshift(checkbox)
      item.attrJoin('class', 'ex-task-list-item')

      for (let j = i - 3; j >= 0; j--) {
        const list = tokens[j]!
        const isListOpen = list.type === 'bullet_list_open' || list.type === 'ordered_list_open'
        if (isListOpen && list.level === item.level - 1) {
          if (!list.attrGet('class')?.includes('ex-task-list')) list.attrJoin('class', 'ex-task-list')
          break
        }
      }
    }
  })
}
```

规则挂在 `text_join` 之后：markdown-it 会把 `[` 切成独立 text token，`text_join` 合并后首个 text token 才以 `[ ] ` 开头。

- [ ] **Step 7: 标题 id 与 TOC**

`packages/markdown-core/src/renderer/headings.ts`：

```ts
import GithubSlugger from 'github-slugger'
import type MarkdownIt from 'markdown-it'
import type { TocItem } from '../types'
import { escapeHtml } from './escape'
import type { HeadingInfo, RenderEnv, Token } from './md-types'

export const HEADING_ID_PLACEHOLDER = 'ex-heading-id-placeholder'

const TOC_MARKER = /^(?:@\[toc\](?:\(([^)\n]*)\))?|\[toc\])$/i
const TOC_PLACEHOLDER = /<div class="ex-toc" data-ex-toc="(\d+)"><\/div>/g

function inlineText(token: Token | undefined): string {
  if (!token) return ''
  if (!token.children) return token.content.trim()
  return token.children
    .map((child) => {
      if (child.type === 'text' || child.type === 'code_inline' || child.type === 'emoji') return child.content
      if (child.type === 'softbreak' || child.type === 'hardbreak') return ' '
      return ''
    })
    .join('')
    .trim()
}

export function headingsPlugin(md: MarkdownIt): void {
  md.core.ruler.after('block', 'ex_toc_placeholder', (state) => {
    const env = state.env as RenderEnv
    const tokens = state.tokens
    for (let i = 0; i + 2 < tokens.length; i++) {
      const open = tokens[i]!
      const inline = tokens[i + 1]!
      if (
        open.type !== 'paragraph_open' ||
        open.level !== 0 ||
        inline.type !== 'inline' ||
        tokens[i + 2]!.type !== 'paragraph_close'
      ) {
        continue
      }
      const match = TOC_MARKER.exec(inline.content.trim())
      if (!match) continue
      const titles = (env.exTocTitles ??= [])
      const block = new state.Token('html_block', '', 0)
      block.content = `<div class="ex-toc" data-ex-toc="${titles.length}"></div>\n`
      block.map = open.map
      titles.push((match[1] ?? '').trim())
      tokens.splice(i, 3, block)
    }
  })

  md.core.ruler.push('ex_heading_collect', (state) => {
    const env = state.env as RenderEnv
    const headings = (env.exHeadings ??= [])
    state.tokens.forEach((token, i) => {
      if (token.type === 'heading_open') {
        headings.push({ level: Number(token.tag.slice(1)), text: inlineText(state.tokens[i + 1]) })
      }
    })
  })

  md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
    tokens[idx]!.attrSet('id', HEADING_ID_PLACEHOLDER)
    return self.renderToken(tokens, idx, options)
  }
}

export function assignHeadingIds(
  htmls: string[],
  headings: HeadingInfo[][],
): { htmls: string[]; toc: TocItem[] } {
  const slugger = new GithubSlugger()
  const toc: TocItem[] = []
  const placeholder = `id="${HEADING_ID_PLACEHOLDER}"`
  const out = htmls.map((html, sectionIndex) => {
    const list = headings[sectionIndex] ?? []
    let k = 0
    return html.replaceAll(placeholder, () => {
      const info = list[k++] ?? { level: 1, text: '' }
      const id = slugger.slug(info.text) || `heading-${toc.length + 1}`
      toc.push({ level: info.level, text: info.text, id })
      return `id="${escapeHtml(id)}"`
    })
  })
  return { htmls: out, toc }
}

export function renderTocHtml(toc: TocItem[]): string {
  let html = ''
  const stack: number[] = []
  for (const item of toc) {
    const top = stack[stack.length - 1]
    if (top === undefined || item.level > top) {
      html += '<ul>'
      stack.push(item.level)
    } else {
      html += '</li>'
      while (stack.length > 1 && item.level < stack[stack.length - 1]!) {
        html += '</ul></li>'
        stack.pop()
      }
    }
    html += `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`
  }
  while (stack.length > 0) {
    html += '</li></ul>'
    stack.pop()
  }
  return html
}

export function fillToc(html: string, titles: string[], toc: TocItem[]): string {
  return html.replace(TOC_PLACEHOLDER, (_match, k: string) => {
    const title = titles[Number(k)] ?? ''
    const titleHtml = title ? `<p class="ex-toc-title">${escapeHtml(title)}</p>` : ''
    return `<div class="ex-toc">${titleHtml}${renderTocHtml(toc)}</div>`
  })
}
```

TOC 占位在 DOMPurify 序列化后形如 `<div class="ex-toc" data-ex-toc="0"></div>`（属性顺序与引号保持不变），`fillToc` 的正则依赖这一点；标题文字不进 HTML 属性，而是存在缓存条目里，避免 DOMPurify 的 `SAFE_FOR_XML` 过滤。

`packages/markdown-core/src/renderer/definitions.ts`：

```ts
const LINK_OR_ABBR_DEFINITION = /^ {0,3}\*?\[(?!\^)[^\]\n]+\]:/
const FOOTNOTE_DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/
const CONTINUATION_LINE = /^(?: {4}|\t)\S/
const INDENT = /^(?: {4}|\t)/
const FENCE_LINE = /^ {0,3}(?:`{3,}|~{3,})/

export const FOOTNOTE_STUB = 'ex-footnote'

function forEachLineOutsideFences(md: string, visit: (line: string, index: number, lines: string[]) => void): void {
  const lines = md.split('\n')
  let inFence = false
  lines.forEach((line, index) => {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence
      return
    }
    if (!inFence) visit(line, index, lines)
  })
}

export function collectDefinitions(md: string): string {
  const out: string[] = []
  let inDefinition = false
  forEachLineOutsideFences(md, (line) => {
    const footnote = FOOTNOTE_DEFINITION.exec(line)
    if (footnote) {
      out.push(`[^${footnote[1]}]: ${FOOTNOTE_STUB}`)
      inDefinition = false
    } else if (LINK_OR_ABBR_DEFINITION.test(line)) {
      out.push(line)
      inDefinition = true
    } else if (inDefinition && CONTINUATION_LINE.test(line)) {
      out.push(line)
    } else {
      inDefinition = false
    }
  })
  return out.join('\n')
}

export function collectFootnoteDefinitions(md: string): Map<string, string> {
  const defs = new Map<string, string>()
  forEachLineOutsideFences(md, (line, index, lines) => {
    const match = FOOTNOTE_DEFINITION.exec(line)
    if (!match || defs.has(match[1]!)) return
    const body = [match[2]!]
    for (let i = index + 1; i < lines.length; i++) {
      const next = lines[i]!
      if (INDENT.test(next)) {
        body.push(next.replace(INDENT, ''))
      } else if (next.trim() === '' && INDENT.test(lines[i + 1] ?? '')) {
        body.push('')
      } else {
        break
      }
    }
    defs.set(match[1]!, body.join('\n'))
  })
  return defs
}
```

已知简化：围栏检测只按行首 ``` / ~~~ 切换，不区分字符与长度（定义写在围栏内的极端情况不处理）。

- [ ] **Step 8: 全文脚注**

`packages/markdown-core/src/renderer/footnotes.ts`：

```ts
import type MarkdownIt from 'markdown-it'
import footnote from 'markdown-it-footnote'
import type { RenderEnv } from './md-types'

export interface FootnoteEntry {
  label: string
  n: number
  count: number
}

interface FootnoteParseEnv extends RenderEnv {
  footnotes?: { list?: Array<{ label?: string }> }
}

const FOOTNOTE_REF_PLACEHOLDER = /ex-fn-ref-(\d+)-(href|id|num)/g

export function footnotesPlugin(md: MarkdownIt): void {
  md.use(footnote)
  md.inline.ruler.disable(['footnote_inline'])

  md.core.ruler.after('footnote_tail', 'ex_footnote_strip', (state) => {
    const start = state.tokens.findIndex((token) => token.type === 'footnote_block_open')
    if (start === -1) return
    const end = state.tokens.findIndex((token) => token.type === 'footnote_block_close')
    state.tokens.splice(start, end - start + 1)
  })

  md.renderer.rules.footnote_ref = (tokens, idx, _options, env: FootnoteParseEnv) => {
    const id = (tokens[idx]!.meta as { id: number }).id
    const label = env.footnotes?.list?.[id]?.label ?? `#${id}`
    const refs = (env.exFootnoteRefs ??= [])
    const k = refs.push(label) - 1
    return `<sup class="footnote-ref"><a href="#ex-fn-ref-${k}-href" id="ex-fn-ref-${k}-id">[ex-fn-ref-${k}-num]</a></sup>`
  }
}

export function assignFootnotes(htmls: string[], refs: string[][]): { htmls: string[]; footnotes: FootnoteEntry[] } {
  const entries = new Map<string, FootnoteEntry>()
  const out = htmls.map((html, sectionIndex) => {
    const resolved = (refs[sectionIndex] ?? []).map((label) => {
      let entry = entries.get(label)
      if (!entry) {
        entry = { label, n: entries.size + 1, count: 0 }
        entries.set(label, entry)
      }
      return { n: entry.n, sub: entry.count++ }
    })
    return html.replace(FOOTNOTE_REF_PLACEHOLDER, (match, k: string, part: string) => {
      const ref = resolved[Number(k)]
      if (!ref) return match
      if (part === 'href') return `fn${ref.n}`
      if (part === 'id') return ref.sub ? `fnref${ref.n}:${ref.sub}` : `fnref${ref.n}`
      return String(ref.n)
    })
  })
  return { htmls: out, footnotes: [...entries.values()] }
}

export function renderFootnotesHtml(
  footnotes: FootnoteEntry[],
  defs: Map<string, string>,
  renderBody: (md: string) => string,
): string {
  if (footnotes.length === 0) return ''
  const items = footnotes.map(({ label, n, count }) => {
    const backrefs = Array.from(
      { length: count },
      (_, sub) => `<a href="#fnref${n}${sub ? `:${sub}` : ''}" class="footnote-backref">↩︎</a>`,
    ).join(' ')
    const body = renderBody(defs.get(label) ?? '')
    const content = body.endsWith('</p>\n') ? `${body.slice(0, -5)} ${backrefs}</p>\n` : `${body}${backrefs}`
    return `<li id="fn${n}" class="footnote-item">${content}</li>`
  })
  return `<div class="ex-footnotes"><hr class="footnotes-sep"><section class="footnotes"><ol class="footnotes-list">${items.join('')}</ol></section></div>`
}
```

markdown-it-footnote 只有在当前渲染里存在 `[^label]:` 定义时才把 `[^label]` 识别为引用，所以 `collectDefinitions` 给每段追加定义桩；插件生成的段内列表被 `ex_footnote_strip` 删除，定义正文由 `collectFootnoteDefinitions` 取出后在 `renderFootnotesHtml` 中统一渲染。若 `md.inline.ruler.disable(['footnote_inline'])` 报规则名不存在，在 `node_modules/markdown-it-footnote/index.mjs` 中查找 `md.inline.ruler.after(` 注册的行内脚注规则名并替换。

- [ ] **Step 9: markdown-it 实例与渲染器**

`packages/markdown-core/src/renderer/markdown-it.ts`（本任务版本已使用 `options.emoji`，因此没有未使用参数，单独通过 lint）：

```ts
import MarkdownIt from 'markdown-it'
import abbr from 'markdown-it-abbr'
import { full as emojiPlugin } from 'markdown-it-emoji'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import type { EmbedDef, RendererOptions } from '../types'
import { footnotesPlugin } from './footnotes'
import { headingsPlugin } from './headings'
import { highlightCode } from './prism'
import { taskListsPlugin } from './task-lists'

export interface ResolvedRendererOptions {
  embeds: Map<string, EmbedDef>
  math: boolean
  diagrams: boolean
  emoji: boolean
}

export function resolveRendererOptions(options: RendererOptions = {}): ResolvedRendererOptions {
  return {
    embeds: new Map((options.embeds ?? []).map((def) => [def.type, def])),
    math: options.math ?? true,
    diagrams: options.diagrams ?? true,
    emoji: options.emoji ?? true,
  }
}

export function createMarkdownIt(options: ResolvedRendererOptions): MarkdownIt {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
  md.use(footnotesPlugin).use(abbr).use(sub).use(sup).use(mark).use(taskListsPlugin).use(headingsPlugin)
  if (options.emoji) md.use(emojiPlugin)

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!
    const lang = token.info.trim().split(/\s+/)[0] ?? ''
    return highlightCode(token.content, lang)
  }
  return md
}
```

`packages/markdown-core/src/renderer/renderer.ts`：

```ts
import { splitSections } from '../sections'
import type { RenderedSection, Renderer, RendererOptions, RenderResult } from '../types'
import { collectDefinitions, collectFootnoteDefinitions } from './definitions'
import { assignFootnotes, renderFootnotesHtml } from './footnotes'
import { assignHeadingIds, fillToc } from './headings'
import { createMarkdownIt, resolveRendererOptions } from './markdown-it'
import type { HeadingInfo, RenderEnv } from './md-types'
import { sanitizeHtml } from './sanitize'

interface CachedSection {
  html: string
  headings: HeadingInfo[]
  tocTitles: string[]
  footnoteRefs: string[]
}

export function createRenderer(options?: RendererOptions): Renderer {
  const md = createMarkdownIt(resolveRendererOptions(options))
  let cache = new Map<string, CachedSection>()
  let footnoteCache = new Map<string, string>()

  function renderSource(source: string): CachedSection {
    const env: RenderEnv = {}
    const html = sanitizeHtml(md.render(source, env))
    return {
      html,
      headings: env.exHeadings ?? [],
      tocTitles: env.exTocTitles ?? [],
      footnoteRefs: env.exFootnoteRefs ?? [],
    }
  }

  return {
    render(markdown: string): RenderResult {
      const sources = splitSections(markdown)
      const definitions = collectDefinitions(markdown)
      const nextCache = new Map<string, CachedSection>()
      const rendered = sources.map((section) => {
        const source = definitions ? `${section.text}\n\n${definitions}\n` : section.text
        const entry = nextCache.get(source) ?? cache.get(source) ?? renderSource(source)
        nextCache.set(source, entry)
        return entry
      })
      cache = nextCache

      const withIds = assignHeadingIds(
        rendered.map((entry) => entry.html),
        rendered.map((entry) => entry.headings),
      )
      const toc = withIds.toc
      const withRefs = assignFootnotes(
        withIds.htmls,
        rendered.map((entry) => entry.footnoteRefs),
      )

      const nextFootnoteCache = new Map<string, string>()
      const footnotesHtml = renderFootnotesHtml(withRefs.footnotes, collectFootnoteDefinitions(markdown), (body) => {
        const html = nextFootnoteCache.get(body) ?? footnoteCache.get(body) ?? sanitizeHtml(md.render(body, {}))
        nextFootnoteCache.set(body, html)
        return html
      })
      footnoteCache = nextFootnoteCache

      const lastIndex = sources.length - 1
      const sections: RenderedSection[] = sources.map((section, i) => {
        const html = fillToc(withRefs.htmls[i]!, rendered[i]!.tocTitles, toc)
        return { ...section, html: i === lastIndex ? html + footnotesHtml : html }
      })
      const html = sections
        .map((section, i) => `<div class="ex-preview-section" data-section-index="${i}">${section.html}</div>`)
        .join('')
      return { html, sections, toc }
    },
  }
}
```

缓存只保留本次渲染用到的段（与 StackEdit 一致），因此内存随文档段数而非编辑历史增长。

- [ ] **Step 10: 追加入口导出**

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export { createRenderer } from './renderer/renderer'
```

- [ ] **Step 11: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/renderer/renderer.test.ts`
Expected: PASS（全部用例）。若 `中文 标题` 的 slug 断言失败，打印 `new GithubSlugger().slug('中文 标题')` 的实际值并以 github-slugger 行为为准修正**断言**（不要改 slug 算法）。

Run: `pnpm --filter @editorx/markdown-core typecheck; pnpm exec eslint packages/markdown-core`
Expected: 均无错误。

- [ ] **Step 12: Commit**

```powershell
git add packages/markdown-core/package.json pnpm-lock.yaml packages/markdown-core/src/vendor.d.ts packages/markdown-core/src/renderer/md-types.ts packages/markdown-core/src/renderer/escape.ts packages/markdown-core/src/renderer/sanitize.ts packages/markdown-core/src/renderer/prism-manual.ts packages/markdown-core/src/renderer/prism.ts packages/markdown-core/src/renderer/task-lists.ts packages/markdown-core/src/renderer/headings.ts packages/markdown-core/src/renderer/definitions.ts packages/markdown-core/src/renderer/footnotes.ts packages/markdown-core/src/renderer/markdown-it.ts packages/markdown-core/src/renderer/renderer.ts packages/markdown-core/src/renderer/renderer.test.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 新增按 section 增量渲染的 Markdown 渲染器" -m "1. 基于 markdown-it 支持 GFM 表格/删除线/任务列表、缩写、上下标、==mark== 与 emoji，代码块使用 Prism 高亮
2. 标题生成全文唯一 slug，[TOC]/@[TOC](标题) 输出全文嵌套目录；脚注全文编号并在文末统一列出
3. 每段输出经 DOMPurify 净化并按段文本缓存，目录、标题 id、脚注编号在组装阶段回填保证缓存正确"
```

---

### Task 3: KaTeX 数学、`ex-embed:<type>` 围栏、Mermaid 与 flowchart.js 占位

**Files:**
- Create: `packages/markdown-core/src/renderer/math.ts`
- Create: `packages/markdown-core/src/renderer/fences.ts`
- Create: `packages/markdown-core/src/renderer/base64.ts`
- Modify: `packages/markdown-core/src/renderer/markdown-it.ts`（整文件替换为下方版本）
- Modify: `packages/markdown-core/src/index.ts`（追加导出）
- Modify: `packages/markdown-core/package.json`（依赖，由 pnpm 写入）
- Test: `packages/markdown-core/src/renderer/extensions.test.ts`

**Interfaces:**
- Consumes: `escapeHtml`、`highlightCode`、`ResolvedRendererOptions`、`StateBlock`、`StateInline`（Task 2）；`EmbedDef`（`src/types.ts`）。
- Produces:
  - `mathPlugin(md: MarkdownIt): void`、`renderTex(tex: string, displayMode: boolean): string`（`renderer/math.ts`）。行内 `$..$` / `$$..$$`（同一行内）、块级 `$$\n..\n$$` 或单行 `$$..$$`；块级外包 `<div class="ex-math-block">`。
  - `EMBED_FENCE_PREFIX = 'ex-embed:'`、`renderMermaidPlaceholder(source: string): string`、`renderEmbedFence(type: string, raw: string, embeds: Map<string, EmbedDef>): string`（`renderer/fences.ts`）。
  - `encodeBase64Utf8(text: string): string`、`decodeBase64Utf8(b64: string): string`（`renderer/base64.ts`；Task 4、Task 6 解码用）。
  - Mermaid 占位：`<div class="ex-mermaid" data-ex-diagram="{encodeBase64Utf8(source)}"></div>`。契约允许 base64 或转义源码，这里**必须**选 base64：DOMPurify 3 默认 `SAFE_FOR_XML: true`，会删除值中含 `-->` 的属性，而 `A-->B` 正是最常见的 Mermaid 写法。
  - Embed：`<div class="ex-embed" data-ex-embed="{type}" data-ex-payload="{encodeBase64Utf8(JSON 原文.trim())}">{renderHtml(payload)}</div>`（同理用 base64）；类型未注册、JSON 无效或 `renderHtml` 抛错 → 普通转义代码块 `<pre class="language-ex-embed:{type}"><code …>`（Task 6 的 `htmlToMarkdown` 据此还原围栏）。
  - flowchart.js（契约 Addendum A §2）：`isFlowchartJs(src: string): boolean`、`stripFlowchartHeader(src: string): string`、`renderFlowchartPlaceholder(source: string): string`（`renderer/fences.ts`，`isFlowchartJs` 从 `src/index.ts` 导出）。语言为 `flow` / `flowchart` 的围栏，以及正文是 flowchart.js 语法的 `mermaid` 围栏 → `<div class="ex-flowchart" data-ex-diagram="{base64(去掉首行 flowchart 后的源码)}"></div>`。判定规则：首个非空行恰为 `flowchart` 且后续某行含 `=>`；或首个非空行就是 flowchart.js 节点定义（`名称=>start|end|operation|subroutine|condition|inputoutput|parallel|input|output…`）。`flowchart TD`、`graph`、`sequenceDiagram` 等普通 Mermaid 语法保持 Mermaid。`diagrams: false` 时两类围栏都回退为普通代码块。

设计决定：KaTeX **同步静态导入**——`Renderer.render` 契约是同步返回字符串，懒加载会迫使渲染异步化；katex 作为 `dependencies` 外部化，应用侧可自行分包。KaTeX 样式由应用或 2b 的样式入口引入 `katex/dist/katex.min.css`。公式结果按 `displayMode + tex` 做模块级缓存（上限 500 条，超出整体清空）。

- [ ] **Step 1: 安装依赖**

```powershell
pnpm --filter @editorx/markdown-core add katex@0.19.0
```

Expected: `dependencies` 新增 `katex`（emoji 插件已在 Task 2 安装）。

- [ ] **Step 2: 写失败测试**

`packages/markdown-core/src/renderer/extensions.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import type { EmbedDef } from '../types'
import { decodeBase64Utf8, encodeBase64Utf8 } from './base64'
import { isFlowchartJs } from './fences'
import { createRenderer } from './renderer'

function dom(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('math', () => {
  const render = (md: string) => createRenderer().render(md).html

  it('renders inline $..$ with KaTeX including MathML', () => {
    const html = render('a $x^2$ b')
    expect(html).toContain('class="katex"')
    expect(html).toContain('<math')
    expect(html).not.toContain('katex-display')
  })

  it('renders $$ blocks in display mode', () => {
    expect(render('$$\n\\sum_{i=1}^n i\n$$')).toContain('<div class="ex-math-block"><span class="katex-display">')
    expect(render('$$E=mc^2$$')).toContain('katex-display')
  })

  it('does not render math inside code', () => {
    expect(render('`$x$`')).toContain('<code>$x$</code>')
    expect(render('```\n$x$\n$$\ny\n$$\n```')).not.toContain('katex')
  })

  it('ignores currency-like and space-padded dollars', () => {
    expect(render('costs $5 and $6')).not.toContain('katex')
    expect(render('a $ x$ b')).not.toContain('katex')
    expect(render('\\$x$')).not.toContain('katex')
  })

  it('shows KaTeX errors inline instead of throwing', () => {
    expect(render('$\\frac{$')).toContain('katex-error')
  })

  it('can be disabled', () => {
    expect(createRenderer({ math: false }).render('$x$').html).toContain('<p>$x$</p>')
  })
})

describe('base64 helpers', () => {
  it('round-trips unicode text', () => {
    const text = 'graph TD\nA["中文 😄"]-->B\n'
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text)
  })
})

describe('mermaid placeholders', () => {
  it('emits an ex-mermaid placeholder carrying the base64 source (survives DOMPurify with -->)', () => {
    const el = dom(createRenderer().render('```mermaid\ngraph TD\nA-->B\n```').html)
    const block = el.querySelector('.ex-mermaid')
    expect(block).not.toBeNull()
    expect(decodeBase64Utf8(block!.getAttribute('data-ex-diagram')!)).toBe('graph TD\nA-->B\n')
    expect(block!.innerHTML).toBe('')
  })

  it('falls back to a code block when diagrams are disabled', () => {
    const html = createRenderer({ diagrams: false }).render('```mermaid\ngraph TD\n```').html
    expect(html).toContain('<pre class="language-mermaid">')
    expect(html).not.toContain('ex-mermaid')
  })
})

describe('flowchart.js placeholders', () => {
  const FLOW = 'st=>start: 开始\ne=>end: 结束\nst->e\n'

  it.each([
    [`flowchart\n${FLOW}`, true],
    [`\n  flowchart  \n${FLOW}`, true],
    [FLOW, true],
    ['cond=>condition: 是否?\ncond(yes)->e', true],
    ['flowchart TD\nA-->B', false],
    ['flowchart LR\nA[开始] --> B', false],
    ['graph LR\nA-->B', false],
    ['sequenceDiagram\nA->>B: hi', false],
    ['flowchart\nA-->B', false],
    ['', false],
  ])('isFlowchartJs(%j) === %s', (src, expected) => {
    expect(isFlowchartJs(src)).toBe(expected)
  })

  function flowchartSource(md: string, options?: Parameters<typeof createRenderer>[0]): string | null {
    const el = dom(createRenderer(options).render(md).html)
    const block = el.querySelector('.ex-flowchart')
    return block ? decodeBase64Utf8(block.getAttribute('data-ex-diagram')!) : null
  }

  it('turns mermaid fences written in flowchart.js syntax into ex-flowchart (header stripped)', () => {
    expect(flowchartSource(`\`\`\`mermaid\nflowchart\n${FLOW}\`\`\``)).toBe(FLOW)
  })

  it.each(['flow', 'flowchart'])('renders ```%s fences as ex-flowchart', (lang) => {
    const md = `\`\`\`${lang}\n${FLOW}\`\`\``
    expect(flowchartSource(md)).toBe(FLOW)
    expect(createRenderer().render(md).html).not.toContain('ex-mermaid')
  })

  it('keeps ordinary mermaid flowcharts as mermaid', () => {
    const html = createRenderer().render('```mermaid\nflowchart TD\nA-->B\n```').html
    expect(html).toContain('class="ex-mermaid"')
    expect(html).not.toContain('ex-flowchart')
  })

  it('falls back to a code block when diagrams are disabled', () => {
    const html = createRenderer({ diagrams: false }).render(`\`\`\`flow\n${FLOW}\`\`\``).html
    expect(html).toContain('<pre class="language-flow">')
    expect(html).not.toContain('ex-flowchart')
  })
})

describe('ex-embed fences', () => {
  const card: EmbedDef = {
    type: 'card',
    renderHtml: (payload) => {
      const { url, title } = payload as { url: string; title: string }
      return `<a class="ex-card" href="${url}">${title}</a><script>bad()</script>`
    },
  }

  it('renders registered embeds through renderHtml and keeps the payload', () => {
    const md = '```ex-embed:card\n{"url":"https://e.com","title":"T"}\n```'
    const el = dom(createRenderer({ embeds: [card] }).render(md).html)
    const embed = el.querySelector<HTMLElement>('.ex-embed')!
    expect(embed.dataset.exEmbed).toBe('card')
    expect(JSON.parse(decodeBase64Utf8(embed.dataset.exPayload!))).toEqual({ url: 'https://e.com', title: 'T' })
    expect(embed.querySelector('a.ex-card')?.getAttribute('href')).toBe('https://e.com')
    expect(el.querySelector('script')).toBeNull()
  })

  it('sanitizes dangerous embed output', () => {
    const md = '```ex-embed:card\n{"url":"javascript:alert(1)","title":"T"}\n```'
    const el = dom(createRenderer({ embeds: [card] }).render(md).html)
    expect(el.querySelector('a.ex-card')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i)
  })

  it.each([
    ['unknown type', '```ex-embed:nope\n{"a":1}\n```', '{"a":1}\n'],
    ['invalid JSON', '```ex-embed:card\n{oops\n```', '{oops\n'],
  ])('falls back to an escaped code block for %s', (_name, md, code) => {
    const el = dom(createRenderer({ embeds: [card] }).render(md).html)
    expect(el.querySelector('.ex-embed')).toBeNull()
    expect(el.querySelector('pre code')?.textContent).toBe(code)
  })

  it('falls back to a code block when renderHtml throws', () => {
    const broken: EmbedDef = {
      type: 'card',
      renderHtml: () => {
        throw new Error('boom')
      },
    }
    const el = dom(createRenderer({ embeds: [broken] }).render('```ex-embed:card\n{}\n```').html)
    expect(el.querySelector('.ex-embed')).toBeNull()
    expect(el.querySelector('pre code')?.textContent).toBe('{}\n')
  })

  it('reuses cached sections instead of calling renderHtml again', () => {
    const renderHtml = vi.fn(() => '<b>card</b>')
    const renderer = createRenderer({ embeds: [{ type: 'card', renderHtml }] })
    const md = '# A\n```ex-embed:card\n{}\n```\n# B\n```ex-embed:card\n{}\n```\n'
    renderer.render(md)
    expect(renderHtml).toHaveBeenCalledTimes(2)
    renderer.render(md)
    expect(renderHtml).toHaveBeenCalledTimes(2)
    renderer.render(`${md}tail`)
    expect(renderHtml).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/renderer/extensions.test.ts`
Expected: FAIL（`katex` 断言失败、`.ex-mermaid` 为 null 等）。

- [ ] **Step 4: 实现数学插件**

`packages/markdown-core/src/renderer/math.ts`（定界规则移植自 StackEdit `src/libs/markdownItMath.js`：开 `$` 后不能是空白、闭 `$` 前不能是空白、闭 `$` 后不能紧跟数字）：

```ts
// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import katex from 'katex'
import type MarkdownIt from 'markdown-it'
import { escapeHtml } from './escape'
import type { StateBlock, StateInline } from './md-types'

const DOLLAR = 0x24
const BACKSLASH = 0x5c
const MAX_CACHE = 500
const texCache = new Map<string, string>()

export function renderTex(tex: string, displayMode: boolean): string {
  const key = `${displayMode ? 'D' : 'I'}:${tex}`
  const hit = texCache.get(key)
  if (hit !== undefined) return hit
  let html: string
  try {
    html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: 'ignore',
      trust: false,
    })
  } catch {
    html = `<span class="katex-error">${escapeHtml(tex)}</span>`
  }
  if (texCache.size >= MAX_CACHE) texCache.clear()
  texCache.set(key, html)
  return html
}

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a
}

function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src
  const start = state.pos
  if (src.charCodeAt(start) !== DOLLAR) return false

  if (src.charCodeAt(start + 1) === DOLLAR) {
    const close = src.indexOf('$$', start + 2)
    if (close <= start + 2) return false
    if (!silent) {
      const token = state.push('math_inline_display', 'math', 0)
      token.content = src.slice(start + 2, close)
      token.markup = '$$'
    }
    state.pos = close + 2
    return true
  }

  const first = src.charCodeAt(start + 1)
  if (Number.isNaN(first) || isSpace(first)) return false
  let close = start + 1
  while ((close = src.indexOf('$', close)) !== -1 && src.charCodeAt(close - 1) === BACKSLASH) close++
  if (close === -1 || isSpace(src.charCodeAt(close - 1))) return false
  const after = src.charCodeAt(close + 1)
  if (after >= 0x30 && after <= 0x39) return false

  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = src.slice(start + 1, close)
    token.markup = '$'
  }
  state.pos = close + 1
  return true
}

function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false
  const pos = state.bMarks[startLine]! + state.tShift[startLine]!
  const max = state.eMarks[startLine]!
  if (state.src.slice(pos, pos + 2) !== '$$') return false

  const firstRest = state.src.slice(pos + 2, max).trimEnd()
  let next = startLine
  let content: string
  if (firstRest.endsWith('$$')) {
    content = firstRest.slice(0, -2)
  } else {
    const lines = [firstRest]
    let closed = false
    while (++next < endLine) {
      const lineStart = state.bMarks[next]! + state.tShift[next]!
      const lineEnd = state.eMarks[next]!
      if (lineStart < lineEnd && state.sCount[next]! < state.blkIndent) break
      const line = state.src.slice(lineStart, lineEnd).trimEnd()
      if (line.endsWith('$$')) {
        lines.push(line.slice(0, -2))
        closed = true
        break
      }
      lines.push(line)
    }
    if (!closed) return false
    content = lines.join('\n')
  }
  if (silent) return true

  state.line = next + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content.trim()
  token.markup = '$$'
  token.map = [startLine, state.line]
  return true
}

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline)
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  md.renderer.rules.math_inline = (tokens, idx) => renderTex(tokens[idx]!.content, false)
  md.renderer.rules.math_inline_display = (tokens, idx) => renderTex(tokens[idx]!.content, true)
  md.renderer.rules.math_block = (tokens, idx) =>
    `<div class="ex-math-block">${renderTex(tokens[idx]!.content, true)}</div>\n`
}
```

`$` 位于行内代码中时，backticks 规则在更早的位置已吞掉整个代码段；围栏/缩进代码块由块规则先行消费，因此不会进入数学规则。

- [ ] **Step 5: 实现 base64 工具与围栏分派**

`packages/markdown-core/src/renderer/base64.ts`：

```ts
export function encodeBase64Utf8(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
```

`packages/markdown-core/src/renderer/fences.ts`：

```ts
import type { EmbedDef } from '../types'
import { encodeBase64Utf8 } from './base64'
import { escapeHtml } from './escape'
import { highlightCode } from './prism'

export const EMBED_FENCE_PREFIX = 'ex-embed:'

export function renderMermaidPlaceholder(source: string): string {
  return `<div class="ex-mermaid" data-ex-diagram="${encodeBase64Utf8(source)}"></div>\n`
}

const FLOWCHART_HEADER = /^\s*flowchart[ \t]*\r?\n/
const FLOWCHART_JS_NODE =
  /^[\w-]+=>(?:start|end|operation|subroutine|condition|inputoutput|parallel|input|output)\b/

export function isFlowchartJs(src: string): boolean {
  const lines = src
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const [first, ...rest] = lines
  if (first === undefined) return false
  if (first === 'flowchart') return rest.some((line) => line.includes('=>'))
  return FLOWCHART_JS_NODE.test(first)
}

export function stripFlowchartHeader(src: string): string {
  return src.replace(FLOWCHART_HEADER, '')
}

export function renderFlowchartPlaceholder(source: string): string {
  return `<div class="ex-flowchart" data-ex-diagram="${encodeBase64Utf8(stripFlowchartHeader(source))}"></div>\n`
}

export function renderEmbedFence(type: string, raw: string, embeds: Map<string, EmbedDef>): string {
  const def = embeds.get(type)
  if (def) {
    try {
      const payload: unknown = JSON.parse(raw)
      const inner = def.renderHtml(payload)
      return `<div class="ex-embed" data-ex-embed="${escapeHtml(type)}" data-ex-payload="${encodeBase64Utf8(raw.trim())}">${inner}</div>\n`
    } catch {
      // invalid JSON or a throwing embed renderer degrades to a plain code block
    }
  }
  return highlightCode(raw, `${EMBED_FENCE_PREFIX}${type}`)
}
```

`renderHtml` 的输出不在这里单独净化：它是段 HTML 的一部分，`renderer.ts` 对整段统一调用 `sanitizeHtml`。

- [ ] **Step 6: 替换 `markdown-it.ts` 挂载新插件**

`packages/markdown-core/src/renderer/markdown-it.ts`（整文件）：

```ts
import MarkdownIt from 'markdown-it'
import abbr from 'markdown-it-abbr'
import { full as emojiPlugin } from 'markdown-it-emoji'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import type { EmbedDef, RendererOptions } from '../types'
import {
  EMBED_FENCE_PREFIX,
  isFlowchartJs,
  renderEmbedFence,
  renderFlowchartPlaceholder,
  renderMermaidPlaceholder,
} from './fences'
import { footnotesPlugin } from './footnotes'
import { headingsPlugin } from './headings'
import { mathPlugin } from './math'
import { highlightCode } from './prism'
import { taskListsPlugin } from './task-lists'

export interface ResolvedRendererOptions {
  embeds: Map<string, EmbedDef>
  math: boolean
  diagrams: boolean
  emoji: boolean
}

export function resolveRendererOptions(options: RendererOptions = {}): ResolvedRendererOptions {
  return {
    embeds: new Map((options.embeds ?? []).map((def) => [def.type, def])),
    math: options.math ?? true,
    diagrams: options.diagrams ?? true,
    emoji: options.emoji ?? true,
  }
}

export function createMarkdownIt(options: ResolvedRendererOptions): MarkdownIt {
  const md = new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
  md.use(footnotesPlugin).use(abbr).use(sub).use(sup).use(mark).use(taskListsPlugin).use(headingsPlugin)
  if (options.math) md.use(mathPlugin)
  if (options.emoji) md.use(emojiPlugin)

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!
    const lang = token.info.trim().split(/\s+/)[0] ?? ''
    if (options.diagrams && (lang === 'flow' || lang === 'flowchart')) {
      return renderFlowchartPlaceholder(token.content)
    }
    if (options.diagrams && lang === 'mermaid') {
      return isFlowchartJs(token.content)
        ? renderFlowchartPlaceholder(token.content)
        : renderMermaidPlaceholder(token.content)
    }
    if (lang.startsWith(EMBED_FENCE_PREFIX)) {
      return renderEmbedFence(lang.slice(EMBED_FENCE_PREFIX.length), token.content, options.embeds)
    }
    return highlightCode(token.content, lang)
  }
  return md
}
```

- [ ] **Step 7: 追加入口导出**

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export { isFlowchartJs } from './renderer/fences'
```

- [ ] **Step 8: 运行测试确认通过（含 Task 2 回归）**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/renderer`
Expected: PASS（`renderer.test.ts` 与 `extensions.test.ts` 全部通过）。若 `<math` 断言失败，说明 DOMPurify 丢弃了 MathML：检查 `sanitize.ts` 的 `ADD_TAGS` 是否包含 `semantics`、`annotation`，不要改成 `output: 'html'`。

Run: `pnpm --filter @editorx/markdown-core typecheck; pnpm exec eslint packages/markdown-core`
Expected: 均无错误。

- [ ] **Step 9: Commit**

```powershell
git add packages/markdown-core/package.json pnpm-lock.yaml packages/markdown-core/src/renderer/math.ts packages/markdown-core/src/renderer/fences.ts packages/markdown-core/src/renderer/base64.ts packages/markdown-core/src/renderer/markdown-it.ts packages/markdown-core/src/renderer/extensions.test.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 渲染器支持 KaTeX 公式、图表占位与 ex-embed 嵌入块" -m "1. 移植 StackEdit 数学定界规则，行内与块级公式经 KaTeX 同步渲染并缓存，代码中不生效
2. mermaid 围栏输出 .ex-mermaid 占位；flow/flowchart 围栏及 flowchart.js 语法的 mermaid 围栏输出 .ex-flowchart 占位，源码均以 base64 携带
3. ex-embed:<type> 围栏调用已注册 EmbedDef.renderHtml，未知类型/无效 JSON/渲染异常回退为转义代码块"
```

---

### Task 4: `renderDiagrams`（懒加载 Mermaid 与 flowchart.js、错误隔离、主题重渲染）

**Files:**
- Create: `packages/markdown-core/src/renderer/diagrams.ts`
- Modify: `packages/markdown-core/src/index.ts`（追加导出）
- Modify: `packages/markdown-core/package.json`（依赖，由 pnpm 写入）
- Test: `packages/markdown-core/src/renderer/diagrams.test.ts`

**Interfaces:**
- Consumes: `decodeBase64Utf8`、`renderMermaidPlaceholder`、`renderFlowchartPlaceholder`（Task 3）；`escapeHtml`、`sanitizeSvg`（Task 2）。
- Produces:
  - `interface RenderDiagramsOptions { theme: 'light' | 'dark' }`
  - `FLOWCHART_THEMES: Record<'light' | 'dark', Record<string, string>>`（flowchart.js `drawSVG` 的颜色选项）
  - `renderDiagrams(container: HTMLElement, opts: RenderDiagramsOptions): Promise<void>`（`renderer/diagrams.ts`，从 `src/index.ts` 导出）
  - DOM 约定：处理 `container` 内所有 `.ex-mermaid[data-ex-diagram]` 与 `.ex-flowchart[data-ex-diagram]`；成功后 `innerHTML` = 净化后的 SVG；失败时 `innerHTML` = `<pre class="ex-{mermaid|flowchart}-error">{转义错误信息}</pre>` 并加类 `ex-{mermaid|flowchart}--error`；无论成败都写 `data-ex-rendered-theme="{theme}"`。同主题再次调用跳过已渲染块；换主题会重渲染全部块。`data-ex-diagram` 始终保留（Task 6 的 `htmlToMarkdown` 依赖它还原源码）。

设计决定：
- `import('mermaid')`、`import('flowchart.js')` 都是动态导入，只在出现对应占位块时加载；两者作为 `dependencies` 外部化。flowchart.js 1.18.0 自身依赖 `raphael@2.3.0`（随其安装，无需单独声明），raphael 依赖浏览器 DOM，因此只能在客户端调用 `renderDiagrams`。加载失败不会缓存（下次调用重试），并作为每块的错误显示。
- `mermaid.initialize` 是全局状态，所以所有调用经模块级 Promise 队列串行执行，避免亮/暗两次调用交错。
- Mermaid：`securityLevel: 'strict'`，`flowchart.htmlLabels: false`（文字用原生 SVG `<text>`，不依赖 `foreignObject`）。flowchart.js：在 `document.body` 中挂一个屏幕外临时容器调用 `chart.drawSVG(host, FLOWCHART_THEMES[theme])`（Raphael 需要已挂载节点测量文字），取出 SVG 后移除容器。两者输出都经 `sanitizeSvg`。
- SVG 结果按 `类型 + theme + base64 源码` 缓存（上限 200 条，超出整体清空）。
- jsdom 不能真正运行 mermaid / Raphael 布局，因此单测 `vi.mock('mermaid')`、`vi.mock('flowchart.js')`；真实渲染由 2b 的 Playwright 覆盖。

- [ ] **Step 1: 安装依赖**

```powershell
pnpm --filter @editorx/markdown-core add mermaid@12.1.0 flowchart.js@1.18.0
```

Expected: `dependencies` 新增 `mermaid`、`flowchart.js`；`pnpm-lock.yaml` 中出现 `raphael@2.3.0`。

- [ ] **Step 2: 写失败测试**

`packages/markdown-core/src/renderer/diagrams.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOWCHART_THEMES, renderDiagrams } from './diagrams'
import { renderFlowchartPlaceholder, renderMermaidPlaceholder } from './fences'

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))

const flowchartMock = vi.hoisted(() => ({
  parse: vi.fn(),
}))

vi.mock('mermaid', () => ({ default: mermaidMock }))
vi.mock('flowchart.js', () => ({ default: flowchartMock }))

function mount(...sources: string[]): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = sources.map((source) => renderMermaidPlaceholder(source)).join('')
  document.body.appendChild(container)
  return container
}

function mountFlow(...sources: string[]): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = sources.map((source) => renderFlowchartPlaceholder(source)).join('')
  document.body.appendChild(container)
  return container
}

function blocks(container: HTMLElement, selector = '.ex-mermaid'): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
}

beforeEach(() => {
  document.body.innerHTML = ''
  mermaidMock.initialize.mockReset()
  mermaidMock.render.mockReset()
  mermaidMock.render.mockImplementation(async (_id: string, source: string) => {
    if (source.includes('bad')) throw new Error('Parse error on line 1')
    return { svg: `<svg data-src="ok" onload="alert(1)"><text>${source.trim()}</text><script>alert(1)</script></svg>` }
  })
  flowchartMock.parse.mockReset()
  flowchartMock.parse.mockImplementation((code: string) => {
    if (code.includes('bad')) throw new Error('Unknown symbol type')
    return {
      drawSVG: (host: HTMLElement, options: Record<string, string>) => {
        expect(host.isConnected).toBe(true)
        host.innerHTML = `<svg data-line="${options['line-color']}" data-font="${options['font-color']}"><text>${code.trim()}</text><script>x()</script></svg>`
      },
    }
  })
})

describe('renderDiagrams', () => {
  it('does nothing (and loads no diagram library) without placeholders', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>no diagrams</p>'
    await renderDiagrams(container, { theme: 'light' })
    expect(mermaidMock.initialize).not.toHaveBeenCalled()
    expect(flowchartMock.parse).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('<p>no diagrams</p>')
  })

  it('replaces placeholders with sanitized svg and keeps the source attribute', async () => {
    const container = mount('graph TD\nA-->B1\n')
    await renderDiagrams(container, { theme: 'light' })

    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, securityLevel: 'strict', theme: 'default' }),
    )
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.stringMatching(/^ex-mermaid-\d+$/), 'graph TD\nA-->B1\n')
    const [block] = blocks(container)
    expect(block!.querySelector('svg text')?.textContent).toBe('graph TD\nA-->B1')
    expect(block!.querySelector('script')).toBeNull()
    expect(block!.querySelector('svg')!.hasAttribute('onload')).toBe(false)
    expect(block!.hasAttribute('data-ex-diagram')).toBe(true)
    expect(block!.dataset.exRenderedTheme).toBe('light')
  })

  it('isolates errors to the failing block', async () => {
    const container = mount('graph TD\nbad', 'graph TD\nC-->D2')
    await renderDiagrams(container, { theme: 'light' })

    const [broken, fine] = blocks(container)
    expect(broken!.classList.contains('ex-mermaid--error')).toBe(true)
    expect(broken!.querySelector('pre.ex-mermaid-error')?.textContent).toBe('Parse error on line 1')
    expect(fine!.classList.contains('ex-mermaid--error')).toBe(false)
    expect(fine!.querySelector('svg')).not.toBeNull()
  })

  it('re-renders with the dark theme and skips blocks already rendered for a theme', async () => {
    const container = mount('graph TD\nE-->F3')
    await renderDiagrams(container, { theme: 'light' })
    expect(mermaidMock.render).toHaveBeenCalledTimes(1)

    await renderDiagrams(container, { theme: 'dark' })
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }))
    expect(mermaidMock.render).toHaveBeenCalledTimes(2)
    expect(blocks(container)[0]!.dataset.exRenderedTheme).toBe('dark')

    await renderDiagrams(container, { theme: 'dark' })
    expect(mermaidMock.render).toHaveBeenCalledTimes(2)
  })

  it('reuses cached svg for the same source and theme', async () => {
    await renderDiagrams(mount('graph TD\nG-->H4'), { theme: 'light' })
    const second = mount('graph TD\nG-->H4')
    await renderDiagrams(second, { theme: 'light' })
    expect(mermaidMock.render).toHaveBeenCalledTimes(1)
    expect(blocks(second)[0]!.querySelector('svg')).not.toBeNull()
  })

  it('serializes concurrent calls so themes do not interleave', async () => {
    const a = mount('graph TD\nI-->J5')
    const b = mount('graph TD\nK-->L6')
    await Promise.all([renderDiagrams(a, { theme: 'light' }), renderDiagrams(b, { theme: 'dark' })])
    const themes = mermaidMock.initialize.mock.calls.map(([config]) => (config as { theme: string }).theme)
    expect(themes).toEqual(['default', 'dark'])
    expect(blocks(a)[0]!.dataset.exRenderedTheme).toBe('light')
    expect(blocks(b)[0]!.dataset.exRenderedTheme).toBe('dark')
  })
})

describe('renderDiagrams — flowchart.js', () => {
  it('renders ex-flowchart blocks with theme colors into sanitized svg', async () => {
    const container = mountFlow('st=>start: A1\ne=>end: Z1\nst->e\n')
    await renderDiagrams(container, { theme: 'light' })

    expect(flowchartMock.parse).toHaveBeenCalledWith('st=>start: A1\ne=>end: Z1\nst->e\n')
    expect(mermaidMock.initialize).not.toHaveBeenCalled()
    const [block] = blocks(container, '.ex-flowchart')
    const svg = block!.querySelector('svg')!
    expect(svg.getAttribute('data-line')).toBe(FLOWCHART_THEMES.light['line-color'])
    expect(svg.getAttribute('data-font')).toBe(FLOWCHART_THEMES.light['font-color'])
    expect(block!.querySelector('script')).toBeNull()
    expect(block!.dataset.exRenderedTheme).toBe('light')
    expect(document.body.children).toHaveLength(1)
  })

  it('strips the flowchart header line before parsing', async () => {
    await renderDiagrams(mountFlow('flowchart\nst=>start: A2\n'), { theme: 'light' })
    expect(flowchartMock.parse).toHaveBeenCalledWith('st=>start: A2\n')
  })

  it('isolates flowchart errors to the failing block', async () => {
    const container = mountFlow('bad=>start: X', 'st=>start: A3\n')
    await renderDiagrams(container, { theme: 'light' })
    const [broken, fine] = blocks(container, '.ex-flowchart')
    expect(broken!.classList.contains('ex-flowchart--error')).toBe(true)
    expect(broken!.querySelector('pre.ex-flowchart-error')?.textContent).toBe('Unknown symbol type')
    expect(fine!.querySelector('svg')).not.toBeNull()
  })

  it('re-renders flowcharts with dark colors on theme change', async () => {
    const container = mountFlow('st=>start: A4\n')
    await renderDiagrams(container, { theme: 'light' })
    await renderDiagrams(container, { theme: 'dark' })
    expect(flowchartMock.parse).toHaveBeenCalledTimes(2)
    const svg = blocks(container, '.ex-flowchart')[0]!.querySelector('svg')!
    expect(svg.getAttribute('data-line')).toBe(FLOWCHART_THEMES.dark['line-color'])
  })

  it('renders mermaid and flowchart blocks in the same container', async () => {
    const container = document.createElement('div')
    container.innerHTML = renderMermaidPlaceholder('graph TD\nM-->N7') + renderFlowchartPlaceholder('st=>start: A7\n')
    document.body.appendChild(container)
    await renderDiagrams(container, { theme: 'dark' })
    expect(container.querySelector('.ex-mermaid svg')).not.toBeNull()
    expect(container.querySelector('.ex-flowchart svg')).not.toBeNull()
  })
})
```

每个用例使用不同的图源码，避免模块级 SVG 缓存在用例间串扰。

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/renderer/diagrams.test.ts`
Expected: FAIL，`Failed to resolve import "./diagrams"`。

- [ ] **Step 4: 实现 `renderDiagrams`**

`packages/markdown-core/src/renderer/diagrams.ts`：

```ts
import { decodeBase64Utf8 } from './base64'
import { escapeHtml } from './escape'
import { sanitizeSvg } from './sanitize'

export interface RenderDiagramsOptions {
  theme: 'light' | 'dark'
}

type Theme = RenderDiagramsOptions['theme']
type DiagramKind = 'mermaid' | 'flowchart'
type Mermaid = (typeof import('mermaid'))['default']

interface FlowchartChart {
  drawSVG(container: HTMLElement, options?: Record<string, string>): void
}

interface FlowchartApi {
  parse(code: string): FlowchartChart
}

export const FLOWCHART_THEMES: Record<Theme, Record<string, string>> = {
  light: { 'line-color': '#4d4d4d', 'element-color': '#4d4d4d', 'font-color': '#222226', fill: '#ffffff' },
  dark: { 'line-color': '#c9d1d9', 'element-color': '#c9d1d9', 'font-color': '#e6edf3', fill: '#22272e' },
}

const MAX_CACHE = 200
const svgCache = new Map<string, string>()
let mermaidPromise: Promise<Mermaid> | null = null
let flowchartPromise: Promise<FlowchartApi> | null = null
let queue: Promise<void> = Promise.resolve()
let idCounter = 0

function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid')
    .then((mod) => mod.default)
    .catch((error: unknown) => {
      mermaidPromise = null
      throw error
    })
  return mermaidPromise
}

function loadFlowchart(): Promise<FlowchartApi> {
  flowchartPromise ??= import('flowchart.js')
    .then((mod) => {
      const loaded = mod as unknown as { default?: FlowchartApi } & FlowchartApi
      return loaded.default ?? loaded
    })
    .catch((error: unknown) => {
      flowchartPromise = null
      throw error
    })
  return flowchartPromise
}

function drawFlowchart(api: FlowchartApi, source: string, theme: Theme): string {
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.visibility = 'hidden'
  document.body.appendChild(host)
  try {
    api.parse(source).drawSVG(host, { ...FLOWCHART_THEMES[theme] })
    const svg = host.innerHTML
    if (!svg.includes('<svg')) throw new Error('flowchart.js produced no SVG')
    return svg
  } finally {
    host.remove()
  }
}

async function renderBlock(
  block: HTMLElement,
  kind: DiagramKind,
  theme: Theme,
  draw: (source: string, id: string) => Promise<string>,
): Promise<void> {
  const encoded = block.dataset.exDiagram ?? ''
  const key = `${kind}:${theme}:${encoded}`
  const id = `ex-${kind}-${++idCounter}`
  try {
    let svg = svgCache.get(key)
    if (svg === undefined) {
      svg = sanitizeSvg(await draw(decodeBase64Utf8(encoded), id))
      if (svgCache.size >= MAX_CACHE) svgCache.clear()
      svgCache.set(key, svg)
    }
    block.innerHTML = svg
    block.classList.remove(`ex-${kind}--error`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    block.innerHTML = `<pre class="ex-${kind}-error">${escapeHtml(message)}</pre>`
    block.classList.add(`ex-${kind}--error`)
  } finally {
    // mermaid may leave its temporary render container in <body> when parsing fails
    document.getElementById(`d${id}`)?.remove()
    block.dataset.exRenderedTheme = theme
  }
}

function pendingBlocks(container: HTMLElement, selector: string, theme: Theme): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (block) => block.dataset.exRenderedTheme !== theme,
  )
}

async function renderNow(container: HTMLElement, { theme }: RenderDiagramsOptions): Promise<void> {
  const mermaidBlocks = pendingBlocks(container, '.ex-mermaid[data-ex-diagram]', theme)
  if (mermaidBlocks.length > 0) {
    const ready = loadMermaid().then((mermaid) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme === 'dark' ? 'dark' : 'default',
        flowchart: { htmlLabels: false },
      })
      return mermaid
    })
    for (const block of mermaidBlocks) {
      await renderBlock(block, 'mermaid', theme, async (source, id) => (await (await ready).render(id, source)).svg)
    }
  }

  const flowchartBlocks = pendingBlocks(container, '.ex-flowchart[data-ex-diagram]', theme)
  if (flowchartBlocks.length > 0) {
    const ready = loadFlowchart()
    for (const block of flowchartBlocks) {
      await renderBlock(block, 'flowchart', theme, async (source) => drawFlowchart(await ready, source, theme))
    }
  }
}

export function renderDiagrams(container: HTMLElement, opts: RenderDiagramsOptions): Promise<void> {
  const run = queue.then(() => renderNow(container, opts))
  queue = run.catch(() => undefined)
  return run
}
```

若 mermaid 12 的 `MermaidConfig` 类型不再接受 `flowchart.htmlLabels`，改为顶层 `htmlLabels: false`（以 `node_modules/mermaid/dist/config.type.d.ts` 为准），测试无需改动。

- [ ] **Step 5: 追加入口导出**

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export { FLOWCHART_THEMES, renderDiagrams, type RenderDiagramsOptions } from './renderer/diagrams'
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/renderer`
Expected: PASS（diagrams 11 个用例 + 之前的渲染器用例）。

Run: `pnpm --filter @editorx/markdown-core typecheck; pnpm exec eslint packages/markdown-core`
Expected: 均无错误。

- [ ] **Step 7: Commit**

```powershell
git add packages/markdown-core/package.json pnpm-lock.yaml packages/markdown-core/src/renderer/diagrams.ts packages/markdown-core/src/renderer/diagrams.test.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 新增 renderDiagrams 懒加载渲染 Mermaid 与 flowchart.js 图表" -m "1. 出现 .ex-mermaid / .ex-flowchart 占位时才动态 import mermaid 或 flowchart.js，输出 SVG 统一净化
2. 单块解析失败仅在该块内显示错误信息，不影响其他图表；库加载失败不缓存以便重试
3. 支持亮/暗主题切换重渲染（flowchart.js 以线条/文字颜色传入主题），调用串行化并按类型+主题+源码缓存 SVG"
```

---

### Task 5: 编辑命令、`commands` 注册表与 `runCommand` / `execCommand`

**Files:**
- Create: `packages/markdown-core/src/commands/helpers.ts`
- Create: `packages/markdown-core/src/commands/inline.ts`
- Create: `packages/markdown-core/src/commands/block.ts`
- Create: `packages/markdown-core/src/commands/registry.ts`
- Modify: `packages/markdown-core/src/index.ts`（追加导出）
- Test: `packages/markdown-core/src/commands/commands.test.ts`

**Interfaces:**
- Consumes: `TextState`、`Selection`、`EditorEngine`（`src/types.ts`）。
- Produces（2b 与后续 toolbar 包依赖这些名字）：
  - `helpers.ts`：`lineRange(text, start, end): { start: number; end: number }`、`editLinePrefixes(state, plan: (lines: string[]) => LineEdit[]): TextState`、`toggleWrap(state, marker: string, placeholder: string): TextState`、`insertBlock(state, block: string, select: [number, number]): TextState`、`interface LineEdit { remove: number; insert: string }`
  - `inline.ts`：`bold`、`italic`、`strikethrough`、`inlineCode`（`(state, args?: PlaceholderArgs) => TextState`）、`link`、`image`（`(state, args?: LinkArgs) => TextState`）；`interface PlaceholderArgs { placeholder?: string }`、`interface LinkArgs { url?: string; text?: string }`
  - `block.ts`：`heading(state, args?: HeadingArgs)`、`quote`、`unorderedList`、`orderedList`、`taskList`、`codeBlock(state, args?: CodeBlockArgs)`、`table(state, args?: TableArgs)`、`hr`、`math(state, args?: MathArgs)`、`mermaid(state, args?: MermaidArgs)`、`toc`；`MERMAID_TEMPLATES`（键 `flowchart | sequence | gantt | class`）；`interface HeadingArgs { level?: 1 | 2 | 3 | 4 | 5 | 6 }`、`interface CodeBlockArgs { lang?: string }`、`interface TableArgs { rows?: number; cols?: number }`（`rows` 为表体行数，不含表头，默认 2×3）、`interface MathArgs { inline?: boolean }`、`interface MermaidArgs { type?: keyof typeof MERMAID_TEMPLATES }`
  - `registry.ts`：`commands`（键：`bold, italic, strikethrough, inlineCode, link, image, heading, heading1…heading6, quote, unorderedList, orderedList, taskList, codeBlock, table, hr, math, mermaid, toc`）、`type CommandName = keyof typeof commands | 'undo' | 'redo'`、`type CommandTransform<A = unknown> = (state: TextState, args?: A) => TextState`、`minimalDiff(a: string, b: string): { start: number; end: number; text: string } | null`、`runCommand<A>(engine: EditorEngine, transform: CommandTransform<A>, args?: A): void`、`execCommand(engine: EditorEngine, name: CommandName, args?: unknown): void`

行为约定（测试即规格）：
- 行内包裹（bold `**`、italic `*`、strikethrough `~~`、inlineCode `` ` ``、行内公式 `$`）可切换：标记紧贴选区外侧或被包含在选区两端时移除，否则包裹；空选区插入占位文本并选中。单字符标记要求两侧连续标记数为奇数才视为「已包裹」，因此对 `**b**` 内的 `b` 执行 italic 得到 `***b***`。默认占位：加粗文本 / 斜体文本 / 删除线文本 / 行内代码。
- 行前缀（heading / quote / ul / ol / task）作用于选区覆盖的整行；多行时跳过空行；所有目标行已是该格式则移除，否则替换已有列表/标题前缀。光标无选区时保持在原文字位置；有选区时选中整个改写后的块。
- 块插入（codeBlock / table / hr / math 块 / mermaid / toc）保证块前后各有一个空行（文首/文末除外，文末补一个 `\n`）。toc 插入 CSDN 写法 `@[TOC](这里写目录标题)` 并选中标题。
- 测试中的假引擎实现完整 `EditorEngine`（含 Addendum A 的 `getCursorPosition`：1 起始行、0 起始列）。
- `runCommand` 只把新旧文本的最小差异区间（公共前后缀之外，且不切断代理对）交给 `engine.replace`，文本无变化时不调用；然后 `setSelection`，最后 `focus()`。`undo` / `redo` 由 `execCommand` 直接调用引擎方法。

- [ ] **Step 1: 写失败测试**

`packages/markdown-core/src/commands/commands.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import type { EditorEngine, Selection, TextState } from '../types'
import { MERMAID_TEMPLATES } from './block'
import { type CommandTransform, commands, execCommand, minimalDiff, runCommand } from './registry'

/** `«` and `»` mark the selection; `«»` is a caret. */
function st(marked: string): TextState {
  const start = marked.indexOf('«')
  const end = marked.indexOf('»') - 1
  return { text: marked.replace('«', '').replace('»', ''), selection: { start, end } }
}

function show({ text, selection: { start, end } }: TextState): string {
  return `${text.slice(0, start)}«${text.slice(start, end)}»${text.slice(end)}`
}

type Case = [name: string, transform: CommandTransform<never>, input: string, expected: string, args?: unknown]

const cases: Case[] = [
  ['bold wraps', commands.bold, 'a «b» c', 'a **«b»** c'],
  ['bold inserts placeholder', commands.bold, 'a «» c', 'a **«加粗文本»** c'],
  ['bold unwraps outside markers', commands.bold, 'a **«b»** c', 'a «b» c'],
  ['bold unwraps inside markers', commands.bold, 'a «**b**» c', 'a «b» c'],
  ['bold custom placeholder', commands.bold, '«»', '**«strong»**', { placeholder: 'strong' }],
  ['italic wraps', commands.italic, 'a «b» c', 'a *«b»* c'],
  ['italic inside bold wraps', commands.italic, '**«b»**', '***«b»***'],
  ['italic unwraps', commands.italic, '*«b»*', '«b»'],
  ['strikethrough wraps', commands.strikethrough, 'x«y»', 'x~~«y»~~'],
  ['strikethrough unwraps', commands.strikethrough, '~~«y»~~', '«y»'],
  ['inlineCode wraps', commands.inlineCode, '«k»', '`«k»`'],
  ['inlineCode placeholder', commands.inlineCode, '«»', '`«行内代码»`'],
  ['link selects url', commands.link, 'see «docs»', 'see [docs](«https://»)'],
  ['link with url selects text', commands.link, 'see «docs»', 'see [«docs»](https://e.com)', { url: 'https://e.com' }],
  ['link placeholder', commands.link, '«»', '[链接描述](«https://»)'],
  ['image placeholder', commands.image, '«»', '![图片描述](«https://»)'],
  ['image with args', commands.image, '«»', '![«logo»](a.png)', { url: 'a.png', text: 'logo' }],
  ['heading2 adds prefix keeping caret', commands.heading2, 'ti«»tle', '## ti«»tle'],
  ['heading2 toggles off', commands.heading2, '## ti«»tle', 'ti«»tle'],
  ['heading1 replaces other level', commands.heading1, '### «t»', '«# t»'],
  ['heading via args', commands.heading, '«»t', '### «»t', { level: 3 }],
  ['heading6 on second line only', commands.heading6, 'a\nb«»', 'a\n###### b«»'],
  ['quote caret', commands.quote, 'a«»', '> a«»'],
  ['quote lines', commands.quote, '«a\nb»', '«> a\n> b»'],
  ['quote toggles off', commands.quote, '«> a\n> b»', '«a\nb»'],
  ['ul skips blank lines', commands.unorderedList, '«a\n\nb»', '«- a\n\n- b»'],
  ['ul converts ordered list', commands.unorderedList, '«1. a\n2. b»', '«- a\n- b»'],
  ['ul toggles off', commands.unorderedList, '«- a\n- b»', '«a\nb»'],
  ['ol numbers lines', commands.orderedList, '«a\nb\nc»', '«1. a\n2. b\n3. c»'],
  ['ol toggles off', commands.orderedList, '«1. a\n2. b\n3. c»', '«a\nb\nc»'],
  ['task adds checkboxes', commands.taskList, '«a\n- b»', '«- [ ] a\n- [ ] b»'],
  ['task toggles off', commands.taskList, '«- [ ] a\n- [x] b»', '«a\nb»'],
  ['codeBlock empty after text', commands.codeBlock, 'x«»', 'x\n\n```\n«»\n```\n'],
  ['codeBlock wraps selected lines', commands.codeBlock, '«const a\nb»', '```\n«const a\nb»\n```\n'],
  ['codeBlock with lang', commands.codeBlock, '«x»', '```js\n«x»\n```\n', { lang: 'js' }],
  [
    'table default 2x3',
    commands.table,
    '«»',
    '| «列1» | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n',
  ],
  ['table rows x cols', commands.table, 'p«»', 'p\n\n| «列1» | 列2 |\n| --- | --- |\n|  |  |\n', { rows: 1, cols: 2 }],
  ['hr between lines', commands.hr, 'a«»\nb', 'a\n\n---«»\n\nb'],
  ['math block placeholder', commands.math, '«»', '$$\n«E=mc^2»\n$$\n'],
  ['math inline', commands.math, 'a «x» b', 'a $«x»$ b', { inline: true }],
  ['mermaid default flowchart', commands.mermaid, '«»', `\`\`\`mermaid\n«${MERMAID_TEMPLATES.flowchart}»\n\`\`\`\n`],
  [
    'mermaid sequence',
    commands.mermaid,
    '«»',
    `\`\`\`mermaid\n«${MERMAID_TEMPLATES.sequence}»\n\`\`\`\n`,
    { type: 'sequence' },
  ],
  ['toc inserts CSDN @[TOC](title) and selects the title', commands.toc, 'x«»', 'x\n\n@[TOC](«这里写目录标题»)\n'],
]

describe('command transforms', () => {
  it.each(cases)('%s', (_name, transform, input, expected, args) => {
    const run = transform as CommandTransform<unknown>
    expect(show(run(st(input), args))).toBe(expected)
  })

  it('registers every spec command', () => {
    expect(Object.keys(commands).sort()).toEqual(
      [
        'bold',
        'codeBlock',
        'heading',
        'heading1',
        'heading2',
        'heading3',
        'heading4',
        'heading5',
        'heading6',
        'hr',
        'image',
        'inlineCode',
        'italic',
        'link',
        'math',
        'mermaid',
        'orderedList',
        'quote',
        'strikethrough',
        'table',
        'taskList',
        'toc',
        'unorderedList',
      ].sort(),
    )
  })

  it('offers flowchart, sequence, gantt and class mermaid templates', () => {
    expect(Object.keys(MERMAID_TEMPLATES)).toEqual(['flowchart', 'sequence', 'gantt', 'class'])
  })
})

describe('minimalDiff', () => {
  it('returns null for identical text', () => {
    expect(minimalDiff('abc', 'abc')).toBeNull()
  })

  it('returns the smallest replaced range', () => {
    expect(minimalDiff('a\nb\nc', 'a\n# b\nc')).toEqual({ start: 2, end: 2, text: '# ' })
    expect(minimalDiff('hello', 'help')).toEqual({ start: 3, end: 5, text: 'p' })
  })

  it('never splits a surrogate pair', () => {
    expect(minimalDiff('a😀', 'a😃')).toEqual({ start: 1, end: 3, text: '😃' })
  })
})

function fakeEngine(initial: string, selection: Selection) {
  const calls: string[] = []
  let value = initial
  let sel = selection
  const engine: EditorEngine = {
    mount: vi.fn(),
    destroy: vi.fn(),
    getValue: () => value,
    setValue: (md) => {
      value = md
    },
    getSelection: () => sel,
    setSelection: (start, end) => {
      sel = { start, end }
      calls.push(`select ${start} ${end}`)
    },
    replace: (start, end, text) => {
      value = value.slice(0, start) + text + value.slice(end)
      calls.push(`replace ${start} ${end} ${JSON.stringify(text)}`)
    },
    undo: () => {
      calls.push('undo')
    },
    redo: () => {
      calls.push('redo')
    },
    focus: () => {
      calls.push('focus')
    },
    on: () => () => {},
    getSectionOffsets: () => [],
    getCursorPosition: () => {
      const before = value.slice(0, sel.end)
      return { line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') - 1 }
    },
  }
  return { engine, calls, value: () => value }
}

describe('runCommand / execCommand', () => {
  it('applies the minimal replace then selection then focus', () => {
    const fake = fakeEngine('a\nb\nc', { start: 2, end: 2 })
    runCommand(fake.engine, commands.heading1)
    expect(fake.calls).toEqual(['replace 2 2 "# "', 'select 4 4', 'focus'])
    expect(fake.value()).toBe('a\n# b\nc')
  })

  it('passes args to the transform', () => {
    const fake = fakeEngine('', { start: 0, end: 0 })
    runCommand(fake.engine, commands.link, { url: 'https://e.com', text: 'E' })
    expect(fake.value()).toBe('[E](https://e.com)')
    expect(fake.calls.at(-2)).toBe('select 1 2')
  })

  it('skips replace when the text is unchanged', () => {
    const fake = fakeEngine('abc', { start: 0, end: 0 })
    runCommand(fake.engine, (state: TextState) => ({ ...state, selection: { start: 1, end: 2 } }))
    expect(fake.calls).toEqual(['select 1 2', 'focus'])
  })

  it('execCommand routes undo/redo to the engine and others through runCommand', () => {
    const fake = fakeEngine('x', { start: 0, end: 1 })
    execCommand(fake.engine, 'undo')
    execCommand(fake.engine, 'redo')
    execCommand(fake.engine, 'bold')
    expect(fake.calls).toEqual(['undo', 'redo', 'replace 0 1 "**x**"', 'select 2 3', 'focus'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/commands`
Expected: FAIL，`Failed to resolve import "./block"`。

- [ ] **Step 3: 实现通用工具**

`packages/markdown-core/src/commands/helpers.ts`（切换语义参考 StackEdit 的 pagedown 工具栏命令 `src/libs/pagedown.js`）：

```ts
// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type { TextState } from '../types'

export interface LineEdit {
  remove: number
  insert: string
}

export function lineRange(text: string, start: number, end: number): { start: number; end: number } {
  const from = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end
  const newline = text.indexOf('\n', last)
  return { start: from, end: newline === -1 ? text.length : newline }
}

export function editLinePrefixes(state: TextState, plan: (lines: string[]) => LineEdit[]): TextState {
  const { text, selection } = state
  const range = lineRange(text, selection.start, selection.end)
  const lines = text.slice(range.start, range.end).split('\n')
  const edits = plan(lines)
  const block = lines.map((line, i) => edits[i]!.insert + line.slice(edits[i]!.remove)).join('\n')
  const nextText = text.slice(0, range.start) + block + text.slice(range.end)
  if (selection.start === selection.end) {
    const edit = edits[0]!
    const column = selection.start - range.start
    const caret = range.start + Math.max(edit.insert.length, column - edit.remove + edit.insert.length)
    return { text: nextText, selection: { start: caret, end: caret } }
  }
  return { text: nextText, selection: { start: range.start, end: range.start + block.length } }
}

function runLength(text: string, from: number, step: 1 | -1, ch: string): number {
  let count = 0
  for (let i = step === 1 ? from : from - 1; i >= 0 && i < text.length && text[i] === ch; i += step) count++
  return count
}

export function toggleWrap(state: TextState, marker: string, placeholder: string): TextState {
  const { text } = state
  const { start, end } = state.selection
  const m = marker.length
  const selected = text.slice(start, end)
  const single = m === 1

  const outside =
    start >= m &&
    text.slice(start - m, start) === marker &&
    text.slice(end, end + m) === marker &&
    (!single || (runLength(text, start, -1, marker) % 2 === 1 && runLength(text, end, 1, marker) % 2 === 1))
  if (outside) {
    return {
      text: text.slice(0, start - m) + selected + text.slice(end + m),
      selection: { start: start - m, end: end - m },
    }
  }

  const inside =
    selected.length >= 2 * m &&
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    (!single ||
      (runLength(selected, 0, 1, marker) % 2 === 1 && runLength(selected, selected.length, -1, marker) % 2 === 1))
  if (inside) {
    const inner = selected.slice(m, -m)
    return { text: text.slice(0, start) + inner + text.slice(end), selection: { start, end: start + inner.length } }
  }

  const content = selected || placeholder
  return {
    text: text.slice(0, start) + marker + content + marker + text.slice(end),
    selection: { start: start + m, end: start + m + content.length },
  }
}

export function insertBlock(state: TextState, block: string, select: [number, number]): TextState {
  const { text } = state
  const before = text.slice(0, state.selection.start)
  const after = text.slice(state.selection.end)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const blockStart = before.length + lead.length
  return {
    text: before + lead + block + trail + after,
    selection: { start: blockStart + select[0], end: blockStart + select[1] },
  }
}
```

- [ ] **Step 4: 实现行内命令**

`packages/markdown-core/src/commands/inline.ts`：

```ts
import type { TextState } from '../types'
import { toggleWrap } from './helpers'

export interface PlaceholderArgs {
  placeholder?: string
}

export interface LinkArgs {
  url?: string
  text?: string
}

export const bold = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '**', args?.placeholder ?? '加粗文本')

export const italic = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '*', args?.placeholder ?? '斜体文本')

export const strikethrough = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '~~', args?.placeholder ?? '删除线文本')

export const inlineCode = (state: TextState, args?: PlaceholderArgs): TextState =>
  toggleWrap(state, '`', args?.placeholder ?? '行内代码')

function linkLike(state: TextState, bang: '' | '!', args: LinkArgs, placeholder: string): TextState {
  const { text } = state
  const { start, end } = state.selection
  const label = args.text ?? (text.slice(start, end) || placeholder)
  const url = args.url ?? 'https://'
  const labelStart = start + bang.length + 1
  const urlStart = labelStart + label.length + 2
  return {
    text: `${text.slice(0, start)}${bang}[${label}](${url})${text.slice(end)}`,
    selection:
      args.url === undefined
        ? { start: urlStart, end: urlStart + url.length }
        : { start: labelStart, end: labelStart + label.length },
  }
}

export const link = (state: TextState, args?: LinkArgs): TextState => linkLike(state, '', args ?? {}, '链接描述')

export const image = (state: TextState, args?: LinkArgs): TextState => linkLike(state, '!', args ?? {}, '图片描述')
```

- [ ] **Step 5: 实现块级命令**

`packages/markdown-core/src/commands/block.ts`：

```ts
import type { TextState } from '../types'
import { editLinePrefixes, insertBlock, type LineEdit, lineRange, toggleWrap } from './helpers'

export interface HeadingArgs {
  level?: 1 | 2 | 3 | 4 | 5 | 6
}
export interface CodeBlockArgs {
  lang?: string
}
export interface TableArgs {
  rows?: number
  cols?: number
}
export interface MathArgs {
  inline?: boolean
}

export const MERMAID_TEMPLATES = {
  flowchart: 'flowchart LR\n  A[开始] --> B{条件}\n  B -->|是| C[结束]\n  B -->|否| A',
  sequence: 'sequenceDiagram\n  Alice->>Bob: 你好\n  Bob-->>Alice: 收到',
  gantt:
    'gantt\n  title 项目计划\n  dateFormat YYYY-MM-DD\n  section 阶段一\n  任务A :a1, 2026-01-01, 7d\n  任务B :after a1, 5d',
  class: 'classDiagram\n  Animal <|-- Dog\n  Animal : +String name\n  Dog : +bark()',
} as const

export interface MermaidArgs {
  type?: keyof typeof MERMAID_TEMPLATES
}

const HEADING = /^#{1,6}(?:[ \t]+|$)/
const QUOTE = /^>[ \t]?/
const TASK = /^[-*+][ \t]+\[[ xX]\][ \t]+/
const UL = /^[-*+][ \t]+/
const OL = /^\d{1,9}[.)][ \t]+/
const ANY_LIST = /^(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/

const NO_EDIT: LineEdit = { remove: 0, insert: '' }

function prefixLength(re: RegExp, line: string): number {
  return re.exec(line)?.[0].length ?? 0
}

function targetLines(lines: string[]): number[] {
  if (lines.length === 1) return [0]
  return lines.flatMap((line, i) => (line.trim() === '' ? [] : [i]))
}

function toggleLines(
  state: TextState,
  isOn: (line: string) => boolean,
  off: RegExp,
  on: (line: string, n: number) => LineEdit,
): TextState {
  return editLinePrefixes(state, (lines) => {
    const targets = targetLines(lines)
    const allOn = targets.every((i) => isOn(lines[i]!))
    let n = 0
    return lines.map((line, i) => {
      if (!targets.includes(i)) return NO_EDIT
      if (allOn) return { remove: prefixLength(off, line), insert: '' }
      return on(line, n++)
    })
  })
}

export function heading(state: TextState, args?: HeadingArgs): TextState {
  const level = args?.level ?? 1
  return toggleLines(
    state,
    (line) => HEADING.exec(line)?.[0].trim().length === level,
    HEADING,
    (line) => ({ remove: prefixLength(HEADING, line), insert: `${'#'.repeat(level)} ` }),
  )
}

export const quote = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => QUOTE.test(line),
    QUOTE,
    (line) => (QUOTE.test(line) ? NO_EDIT : { remove: 0, insert: '> ' }),
  )

export const unorderedList = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => UL.test(line) && !TASK.test(line),
    ANY_LIST,
    (line) => ({ remove: prefixLength(ANY_LIST, line), insert: '- ' }),
  )

export const orderedList = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => OL.test(line),
    ANY_LIST,
    (line, n) => ({ remove: prefixLength(ANY_LIST, line), insert: `${n + 1}. ` }),
  )

export const taskList = (state: TextState): TextState =>
  toggleLines(
    state,
    (line) => TASK.test(line),
    ANY_LIST,
    (line) => ({ remove: prefixLength(ANY_LIST, line), insert: '- [ ] ' }),
  )

export function codeBlock(state: TextState, args?: CodeBlockArgs): TextState {
  const { text, selection } = state
  const range = selection.start === selection.end ? selection : lineRange(text, selection.start, selection.end)
  const content = text.slice(range.start, range.end)
  const open = `\`\`\`${args?.lang ?? ''}`
  return insertBlock({ text, selection: range }, `${open}\n${content}\n\`\`\``, [
    open.length + 1,
    open.length + 1 + content.length,
  ])
}

function clampCount(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.floor(value ?? fallback))
}

export function table(state: TextState, args?: TableArgs): TextState {
  const rows = clampCount(args?.rows, 2)
  const cols = clampCount(args?.cols, 3)
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`
  const header = row(Array.from({ length: cols }, (_, i) => `列${i + 1}`))
  const lines = [header, row(Array<string>(cols).fill('---')), ...Array<string>(rows).fill(row(Array<string>(cols).fill('')))]
  return insertBlock(state, lines.join('\n'), [2, 2 + '列1'.length])
}

export const hr = (state: TextState): TextState => insertBlock(state, '---', [3, 3])

export function math(state: TextState, args?: MathArgs): TextState {
  if (args?.inline) return toggleWrap(state, '$', 'E=mc^2')
  const content = state.text.slice(state.selection.start, state.selection.end) || 'E=mc^2'
  return insertBlock(state, `$$\n${content}\n$$`, [3, 3 + content.length])
}

export function mermaid(state: TextState, args?: MermaidArgs): TextState {
  const template = MERMAID_TEMPLATES[args?.type ?? 'flowchart']
  const open = '```mermaid\n'
  return insertBlock(state, `${open}${template}\n\`\`\``, [open.length, open.length + template.length])
}

const TOC_TITLE = '这里写目录标题'

export const toc = (state: TextState): TextState =>
  insertBlock(state, `@[TOC](${TOC_TITLE})`, ['@[TOC]('.length, '@[TOC]('.length + TOC_TITLE.length])
```

- [ ] **Step 6: 实现注册表与引擎适配**

`packages/markdown-core/src/commands/registry.ts`：

```ts
import type { EditorEngine, TextState } from '../types'
import {
  codeBlock,
  heading,
  hr,
  math,
  mermaid,
  orderedList,
  quote,
  table,
  taskList,
  toc,
  unorderedList,
} from './block'
import { bold, image, inlineCode, italic, link, strikethrough } from './inline'

export type CommandTransform<A = unknown> = (state: TextState, args?: A) => TextState

export const commands = {
  bold,
  italic,
  strikethrough,
  inlineCode,
  link,
  image,
  heading,
  heading1: (state: TextState) => heading(state, { level: 1 }),
  heading2: (state: TextState) => heading(state, { level: 2 }),
  heading3: (state: TextState) => heading(state, { level: 3 }),
  heading4: (state: TextState) => heading(state, { level: 4 }),
  heading5: (state: TextState) => heading(state, { level: 5 }),
  heading6: (state: TextState) => heading(state, { level: 6 }),
  quote,
  unorderedList,
  orderedList,
  taskList,
  codeBlock,
  table,
  hr,
  math,
  mermaid,
  toc,
}

export type CommandName = keyof typeof commands | 'undo' | 'redo'

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

export function minimalDiff(a: string, b: string): { start: number; end: number; text: string } | null {
  if (a === b) return null
  const max = Math.min(a.length, b.length)
  let prefix = 0
  while (prefix < max && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++
  if (prefix > 0 && isHighSurrogate(a.charCodeAt(prefix - 1))) prefix--
  let suffix = 0
  while (suffix < max - prefix && a.charCodeAt(a.length - 1 - suffix) === b.charCodeAt(b.length - 1 - suffix)) {
    suffix++
  }
  if (suffix > 0 && isLowSurrogate(a.charCodeAt(a.length - suffix))) suffix--
  return { start: prefix, end: a.length - suffix, text: b.slice(prefix, b.length - suffix) }
}

export function runCommand<A>(engine: EditorEngine, transform: CommandTransform<A>, args?: A): void {
  const next = transform({ text: engine.getValue(), selection: engine.getSelection() }, args)
  const diff = minimalDiff(engine.getValue(), next.text)
  if (diff) engine.replace(diff.start, diff.end, diff.text)
  engine.setSelection(next.selection.start, next.selection.end)
  engine.focus()
}

export function execCommand(engine: EditorEngine, name: CommandName, args?: unknown): void {
  if (name === 'undo') {
    engine.undo()
    return
  }
  if (name === 'redo') {
    engine.redo()
    return
  }
  runCommand(engine, commands[name] as CommandTransform<unknown>, args)
}
```

`minimalDiff('a😀', 'a😃')`：公共前缀先走到 2（两个 emoji 高代理相同），回退到 1 以免切断代理对，结果 `{ start: 1, end: 3, text: '😃' }`。

- [ ] **Step 7: 追加入口导出**

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export {
  commands,
  execCommand,
  minimalDiff,
  runCommand,
  type CommandName,
  type CommandTransform,
} from './commands/registry'
export {
  MERMAID_TEMPLATES,
  type CodeBlockArgs,
  type HeadingArgs,
  type MathArgs,
  type MermaidArgs,
  type TableArgs,
} from './commands/block'
export type { LinkArgs, PlaceholderArgs } from './commands/inline'
```

- [ ] **Step 8: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/commands`
Expected: PASS（43 个表驱动用例 + 注册表/模板/minimalDiff/适配器用例）。

Run: `pnpm --filter @editorx/markdown-core typecheck; pnpm exec eslint packages/markdown-core`
Expected: 均无错误。若 `cases` 数组中 `commands.heading1` 等与 `CommandTransform<never>` 不兼容，把 `Case` 的第二项类型改为 `CommandTransform<any>` 并加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`，不要改命令签名。

- [ ] **Step 9: Commit**

```powershell
git add packages/markdown-core/src/commands/helpers.ts packages/markdown-core/src/commands/inline.ts packages/markdown-core/src/commands/block.ts packages/markdown-core/src/commands/registry.ts packages/markdown-core/src/commands/commands.test.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 新增纯函数编辑命令与引擎适配器" -m "1. 加粗/斜体/删除线/行内代码/行内公式支持切换，标题/引用/列表/任务列表按行切换前缀
2. 代码块、表格(rows×cols)、分割线、公式、Mermaid 模板、目录按块插入并保证前后空行
3. runCommand 只向引擎提交最小差异区间并恢复选区，execCommand 统一路由含撤销/重做"
```

---

### Task 6: `countWords` / `countHtml`、导入导出与 `htmlToMarkdown`

**Files:**
- Create: `packages/markdown-core/src/utils/count.ts`
- Create: `packages/markdown-core/src/utils/html-to-markdown.ts`
- Create: `packages/markdown-core/src/utils/io.ts`
- Modify: `packages/markdown-core/src/index.ts`（追加导出）
- Modify: `packages/markdown-core/package.json`（依赖，由 pnpm 写入）
- Test: `packages/markdown-core/src/utils/utils.test.ts`

**Interfaces:**
- Consumes: `RenderResult`（`src/types.ts`）；`createRenderer`（Task 2/3，仅测试用于往返）；`escapeHtml`（Task 2）；`decodeBase64Utf8`（Task 3）。
- Produces:
  - `interface WordCount { words: number; chars: number; lines: number }`、`countWords(md: string): WordCount`、`interface HtmlCount { words: number; paragraphs: number }`、`countHtml(html: string): HtmlCount`（`utils/count.ts`，契约 Addendum A §3）
  - `htmlToMarkdown(html: string): string`（`utils/html-to-markdown.ts`）
  - `exportMarkdown(md: string): Blob`（`text/markdown;charset=utf-8`）、`interface ExportHtmlOptions { title: string; css?: string; katexCssHref?: string }`、`KATEX_CSS_HREF`、`exportHtml(result: RenderResult, opts: ExportHtmlOptions): string`（完整独立 HTML 文档）、`importFile(file: File): Promise<string>`（`.md`/`.markdown`/`.txt` 原样返回；`.html`/`.htm` 或 `text/html` 取 `<body>` 后经 `htmlToMarkdown`）（`utils/io.ts`）

计数口径（契约原文）：`words` = CJK 字符（中日韩统一表意文字及全角标点）逐个计数 + 连续拉丁字母/数字序列各计 1；`chars` = 所有非空白字符数（按 Unicode 码点计，emoji 计 1）；`lines` = 按 `\n` 分割的行数（空串为 1）。实现中「CJK」= 汉字、平假名、片假名、谚文；「全角标点」= `U+3001–U+303F`、`U+FF01–U+FF0F`、`U+FF1A–U+FF20`、`U+FF3B–U+FF40`、`U+FF5B–U+FF65` 以及中文排版常用的 `‘ ’ “ ” … —`；「拉丁字母/数字」= `\p{Script=Latin}`、ASCII 数字与全角数字。markdown 语法符号不剔除（与契约一致，按源文计数）。

`countHtml` 口径：`words` = 对 HTML 文本内容用与 `countWords` 相同的规则计数（文本节点之间以空格连接，避免 `<p>abc</p><p>def</p>` 被拼成一个词；忽略 `script`、`style` 与 KaTeX 的 `.katex-mathml` 重复文本）；`paragraphs` = `p`、`li`、`h1`–`h6`、`blockquote`、`pre`、`tr` 中文本非空（trim 后）的元素个数（嵌套时各自计数，如 `blockquote > p` 计 2，按契约字面执行）。

`htmlToMarkdown` 还原规则：`div[data-ex-embed]` → ` ```ex-embed:{type}\n{payload}\n``` `；`div.ex-mermaid[data-ex-diagram]` → ` ```mermaid ` 围栏，`div.ex-flowchart[data-ex-diagram]` → ` ```flow ` 围栏（未渲染的空占位走 turndown 的 `blankReplacement`，否则会被当空块丢弃）；`span.katex-display` → `$$\n{tex}\n$$`；`span.katex` → `$tex$`（tex 取自 `annotation[encoding="application/x-tex"]`）；`div.ex-toc` → 有 `p.ex-toc-title` 时 `@[TOC]({标题})`，否则 `[TOC]`；`del/s/strike` → `~~x~~`；`sup.footnote-ref` → `[^{n}]`，`div.ex-footnotes` → 文末 `[^{n}]: 正文`（去掉回链，标签按渲染编号重写）；列表项统一 `- ` / `1. ` 单空格前缀，任务项 `- [ ] ` / `- [x] `；代码块保留 `language-*` 语言；表格用 GFM 插件（对齐信息不还原）。

- [ ] **Step 1: 安装依赖**

```powershell
pnpm --filter @editorx/markdown-core add turndown@7.2.4 @joplin/turndown-plugin-gfm@1.0.68
pnpm --filter @editorx/markdown-core add -D @types/turndown@5.0.6
```

- [ ] **Step 2: 写失败测试**

`packages/markdown-core/src/utils/utils.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { createRenderer } from '../renderer/renderer'
import { countHtml, countWords } from './count'
import { htmlToMarkdown } from './html-to-markdown'
import { exportHtml, exportMarkdown, importFile, KATEX_CSS_HREF } from './io'

describe('countHtml', () => {
  it.each([
    ['', { words: 0, paragraphs: 0 }],
    ['<h1>标题</h1><p>你好 world</p><p> </p><ul><li>a</li><li></li></ul>', { words: 6, paragraphs: 3 }],
    ['<p>abc</p><p>def</p>', { words: 2, paragraphs: 2 }],
    ['<blockquote><p>引用</p></blockquote><pre><code>x = 1</code></pre>', { words: 4, paragraphs: 3 }],
    ['<table><tr><td>1</td><td>2</td></tr><tr><td> </td></tr></table>', { words: 2, paragraphs: 1 }],
    ['<div>只有 div</div><script>var a</script><style>p{}</style>', { words: 3, paragraphs: 0 }],
  ])('counts %j', (html, expected) => {
    expect(countHtml(html)).toEqual(expected)
  })

  it('does not double-count KaTeX MathML text', () => {
    const html = createRenderer().render('$x$').html
    expect(countHtml(html)).toEqual({ words: 1, paragraphs: 1 })
  })

  it('counts a rendered document', () => {
    const html = createRenderer().render('# 标题\n\n第一段 text\n\n- 项一\n- 项二').html
    expect(countHtml(html)).toEqual({ words: 10, paragraphs: 4 })
  })
})

describe('countWords', () => {
  it.each([
    ['', { words: 0, chars: 0, lines: 1 }],
    ['你好，世界！Hello world 2026', { words: 9, chars: 20, lines: 1 }],
    ['a\nb\n', { words: 2, chars: 2, lines: 3 }],
    ['中文abc中文', { words: 5, chars: 7, lines: 1 }],
    ["don't", { words: 2, chars: 5, lines: 1 }],
    ['😀', { words: 0, chars: 1, lines: 1 }],
    ['“引号”…', { words: 5, chars: 5, lines: 1 }],
    ['こんにちは 안녕', { words: 7, chars: 7, lines: 1 }],
    ['ＡＢＣ１２３', { words: 1, chars: 6, lines: 1 }],
    ['\t \n', { words: 0, chars: 0, lines: 2 }],
    ['# 标题\n\n**bold** text', { words: 4, chars: 15, lines: 3 }],
  ])('counts %j', (md, expected) => {
    expect(countWords(md)).toEqual(expected)
  })
})

describe('export / import', () => {
  it('exports markdown as a utf-8 markdown blob', async () => {
    const blob = exportMarkdown('# 标题')
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    expect(await blob.text()).toBe('# 标题')
  })

  it('exports a standalone html document', () => {
    const result = createRenderer().render('# A\n\n$x$')
    const html = exportHtml(result, { title: 'a <b>', css: 'p{color:red}</style><script>' })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>a &lt;b&gt;</title>')
    expect(html).toContain(`<article class="ex-preview">\n${result.html}\n</article>`)
    expect(html).toContain(`<link rel="stylesheet" href="${KATEX_CSS_HREF}">`)
    expect(html).toContain('<style>p{color:red}<\\/style><script></style>')
  })

  it('omits the KaTeX stylesheet when there is no math', () => {
    const html = exportHtml(createRenderer().render('plain'), { title: 't' })
    expect(html).not.toContain('katex')
  })

  it('imports markdown files verbatim', async () => {
    const file = new File(['# Hi\n'], 'note.md', { type: 'text/markdown' })
    expect(await importFile(file)).toBe('# Hi\n')
  })

  it('imports html files as markdown using only the body', async () => {
    const file = new File(
      ['<html><head><title>T</title></head><body><h1>Hi</h1><p><strong>b</strong></p></body></html>'],
      'page.html',
      { type: 'text/html' },
    )
    expect(await importFile(file)).toBe('# Hi\n\n**b**')
  })
})

describe('htmlToMarkdown', () => {
  it('converts basic formatting', () => {
    expect(htmlToMarkdown('<h2>T</h2><p>a <em>b</em> <s>c</s> <code>d</code></p>')).toBe('## T\n\na *b* ~~c~~ `d`')
  })

  it('converts lists with single-space markers and task items', () => {
    expect(htmlToMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b')
    expect(htmlToMarkdown('<ol><li>a</li><li>b</li></ol>')).toBe('1. a\n2. b')
    const md = htmlToMarkdown(createRenderer().render('- [ ] todo\n- [x] done').html)
    expect(md).toBe('- [ ] todo\n- [x] done')
  })

  it('round-trips fenced code with language', () => {
    const md = htmlToMarkdown(createRenderer().render('```js\nconst a = 1\n```').html)
    expect(md).toBe('```js\nconst a = 1\n```')
  })

  it('converts GFM tables', () => {
    const md = htmlToMarkdown(createRenderer().render('| a | b |\n|---|---|\n| 1 | 2 |').html)
    expect(md).toMatch(/^\|\s*a\s*\|\s*b\s*\|\n\|\s*-+\s*\|\s*-+\s*\|\n\|\s*1\s*\|\s*2\s*\|$/)
  })

  it('round-trips ex-embed cards through the renderer', () => {
    const renderer = createRenderer({ embeds: [{ type: 'card', renderHtml: () => '<a href="https://e.com">card</a>' }] })
    const source = '```ex-embed:card\n{"url":"https://e.com","title":"T"}\n```'
    expect(htmlToMarkdown(renderer.render(source).html)).toBe(source)
  })

  it('round-trips empty embeds and unrendered mermaid placeholders', () => {
    const renderer = createRenderer({ embeds: [{ type: 'card', renderHtml: () => '' }] })
    expect(htmlToMarkdown(renderer.render('```ex-embed:card\n{}\n```').html)).toBe('```ex-embed:card\n{}\n```')
    const mermaid = '```mermaid\ngraph TD\nA-->B\n```'
    expect(htmlToMarkdown(renderer.render(mermaid).html)).toBe(mermaid)
  })

  it('restores rendered mermaid diagrams from the source attribute', () => {
    const container = document.createElement('div')
    container.innerHTML = createRenderer().render('```mermaid\ngraph TD\nA-->B\n```').html
    container.querySelector('.ex-mermaid')!.innerHTML = '<svg><text>A</text></svg>'
    expect(htmlToMarkdown(container.innerHTML)).toBe('```mermaid\ngraph TD\nA-->B\n```')
  })

  it('round-trips KaTeX math and the [TOC] marker', () => {
    const md = htmlToMarkdown(createRenderer().render('[TOC]\n\n# A\n\n$x^2$ and\n\n$$\ny\n$$').html)
    expect(md).toBe('[TOC]\n\n# A\n\n$x^2$ and\n\n$$\ny\n$$')
  })

  it('round-trips @[TOC](title)', () => {
    const md = htmlToMarkdown(createRenderer().render('@[TOC](目录)\n\n# A').html)
    expect(md).toBe('@[TOC](目录)\n\n# A')
  })

  it('round-trips flowchart.js placeholders as flow fences', () => {
    const md = htmlToMarkdown(createRenderer().render('```flow\nst=>start: 开始\ne=>end\nst->e\n```').html)
    expect(md).toBe('```flow\nst=>start: 开始\ne=>end\nst->e\n```')
  })

  it('round-trips document-wide footnotes as definitions at the end', () => {
    const html = createRenderer().render('# A\nx[^a]\n# B\ny[^b]\n\n[^a]: note A\n[^b]: note B').html
    expect(htmlToMarkdown(html)).toBe('# A\n\nx[^1]\n\n# B\n\ny[^2]\n\n[^1]: note A\n[^2]: note B')
  })

  it('keeps an unknown-embed code block as a fence', () => {
    const md = htmlToMarkdown(createRenderer().render('```ex-embed:nope\n{"a":1}\n```').html)
    expect(md).toBe('```ex-embed:nope\n{"a":1}\n```')
  })
})
```

`'你好，世界！Hello world 2026'`：CJK 6（你 好 ， 世 界 ！）+ 拉丁/数字序列 3 = 9；非空白字符 6+5+5+4 = 20。`'# 标题\n\n**bold** text'`：标 题 + bold + text = 4；非空白 `#`、标、题、`**bold**`(8)、text(4) = 15。

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/utils`
Expected: FAIL，`Failed to resolve import "./count"`。

- [ ] **Step 4: 实现 `countWords`**

`packages/markdown-core/src/utils/count.ts`：

```ts
export interface WordCount {
  words: number
  chars: number
  lines: number
}

const CJK_CHAR =
  '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}' +
  '\\u3001-\\u303F\\uFF01-\\uFF0F\\uFF1A-\\uFF20\\uFF3B-\\uFF40\\uFF5B-\\uFF65' +
  '\\u2018\\u2019\\u201C\\u201D\\u2026\\u2014'
const LATIN_OR_DIGIT = '\\p{Script=Latin}0-9\\uFF10-\\uFF19'
const WORD = new RegExp(`[${CJK_CHAR}]|[${LATIN_OR_DIGIT}]+`, 'gu')
const WHITESPACE = /\s/gu

export function countWords(md: string): WordCount {
  return {
    words: md.match(WORD)?.length ?? 0,
    chars: Array.from(md.replace(WHITESPACE, '')).length,
    lines: md.split('\n').length,
  }
}

export interface HtmlCount {
  words: number
  paragraphs: number
}

const IGNORED = 'script, style, .katex-mathml'
const PARAGRAPHS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr'

export function countHtml(html: string): HtmlCount {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll(IGNORED).forEach((node) => node.remove())

  const texts: string[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node.textContent ?? '')

  const paragraphs = Array.from(doc.body.querySelectorAll(PARAGRAPHS)).filter(
    (el) => (el.textContent ?? '').trim() !== '',
  ).length
  return { words: texts.join(' ').match(WORD)?.length ?? 0, paragraphs }
}
```

- [ ] **Step 5: 实现 `htmlToMarkdown`**

`packages/markdown-core/src/utils/html-to-markdown.ts`：

```ts
import { gfm } from '@joplin/turndown-plugin-gfm'
import TurndownService from 'turndown'
import { decodeBase64Utf8 } from '../renderer/base64'

function decode(value: string | null): string {
  if (!value) return ''
  try {
    return decodeBase64Utf8(value)
  } catch {
    return ''
  }
}

function fence(info: string, body: string): string {
  return `\n\n\`\`\`${info}\n${body.replace(/\n$/, '')}\n\`\`\`\n\n`
}

function exBlockMarkdown(node: HTMLElement): string | null {
  if (node.nodeName !== 'DIV') return null
  if (node.hasAttribute('data-ex-embed')) {
    return fence(`ex-embed:${node.getAttribute('data-ex-embed') ?? ''}`, decode(node.getAttribute('data-ex-payload')))
  }
  if (node.hasAttribute('data-ex-diagram')) {
    return fence(hasClass(node, 'ex-flowchart') ? 'flow' : 'mermaid', decode(node.getAttribute('data-ex-diagram')))
  }
  return null
}

function hasClass(node: HTMLElement, name: string): boolean {
  return (node.getAttribute('class') ?? '').split(/\s+/).includes(name)
}

function footnoteNumber(href: string | null): string {
  return (href ?? '').replace(/^#fn/, '')
}

function footnotesMarkdown(td: TurndownService, node: HTMLElement): string {
  const lines = Array.from(node.querySelectorAll('li.footnote-item')).map((item) => {
    const clone = item.cloneNode(true) as HTMLElement
    clone.querySelectorAll('a.footnote-backref').forEach((backref) => backref.remove())
    const body = td.turndown(clone.innerHTML).trim().replace(/\n/g, '\n    ')
    return `[^${item.id.replace(/^fn/, '')}]: ${body}`
  })
  return `\n\n${lines.join('\n')}\n\n`
}

function texOf(node: HTMLElement): string {
  const annotation = node.querySelector('annotation[encoding="application/x-tex"]')
  return (annotation?.textContent ?? node.textContent ?? '').trim()
}

let service: TurndownService | null = null

function getService(): TurndownService {
  if (service) return service
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    blankReplacement: (_content, node) => {
      const el = node as HTMLElement
      return exBlockMarkdown(el) ?? ((node as { isBlock?: boolean }).isBlock ? '\n\n' : '')
    },
  })
  td.use(gfm)

  td.addRule('exBlocks', {
    filter: (node) => exBlockMarkdown(node) !== null,
    replacement: (_content, node) => exBlockMarkdown(node as HTMLElement) ?? '',
  })
  td.addRule('exToc', {
    filter: (node) => node.nodeName === 'DIV' && hasClass(node, 'ex-toc'),
    replacement: (_content, node) => {
      const title = (node as HTMLElement).querySelector('p.ex-toc-title')?.textContent?.trim()
      return title ? `\n\n@[TOC](${title})\n\n` : '\n\n[TOC]\n\n'
    },
  })
  td.addRule('footnoteRef', {
    filter: (node) => node.nodeName === 'SUP' && hasClass(node, 'footnote-ref'),
    replacement: (_content, node) =>
      `[^${footnoteNumber((node as HTMLElement).querySelector('a')?.getAttribute('href') ?? null)}]`,
  })
  td.addRule('exFootnotes', {
    filter: (node) => node.nodeName === 'DIV' && hasClass(node, 'ex-footnotes'),
    replacement: (_content, node) => footnotesMarkdown(td, node as HTMLElement),
  })
  td.addRule('katexDisplay', {
    filter: (node) => node.nodeName === 'SPAN' && hasClass(node, 'katex-display'),
    replacement: (_content, node) => `\n\n$$\n${texOf(node as HTMLElement)}\n$$\n\n`,
  })
  td.addRule('katexInline', {
    filter: (node) => node.nodeName === 'SPAN' && hasClass(node, 'katex'),
    replacement: (_content, node) => `$${texOf(node as HTMLElement)}$`,
  })
  td.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: (content) => `~~${content}~~`,
  })
  td.addRule('taskCheckbox', {
    filter: (node) => node.nodeName === 'INPUT' && node.getAttribute('type') === 'checkbox',
    replacement: (_content, node) => ((node as HTMLElement).hasAttribute('checked') ? '[x] ' : '[ ] '),
  })
  td.addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      const parent = node.parentNode as HTMLElement | null
      let prefix = '- '
      if (parent?.nodeName === 'OL') {
        const start = Number(parent.getAttribute('start') ?? '1')
        prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `
      }
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/^\[([ x])\] +/, '[$1] ')
        .replace(/\n/gm, `\n${' '.repeat(prefix.length)}`)
      return prefix + body + (node.nextSibling && !body.endsWith('\n') ? '\n' : '')
    },
  })
  service = td
  return td
}

export function htmlToMarkdown(html: string): string {
  return getService().turndown(html).trim()
}
```

`addRule` 新增的规则优先于内置与 GFM 插件规则（turndown 内部 `unshift`），因此这里的 `strikethrough`、`listItem`、`taskCheckbox` 会覆盖插件版本。

- [ ] **Step 6: 实现导入导出**

`packages/markdown-core/src/utils/io.ts`：

```ts
import { escapeHtml } from '../renderer/escape'
import type { RenderResult } from '../types'
import { htmlToMarkdown } from './html-to-markdown'

export const KATEX_CSS_HREF = 'https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css'

export interface ExportHtmlOptions {
  title: string
  css?: string
  katexCssHref?: string
}

export function exportMarkdown(md: string): Blob {
  return new Blob([md], { type: 'text/markdown;charset=utf-8' })
}

export function exportHtml(result: RenderResult, opts: ExportHtmlOptions): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(opts.title)}</title>`,
  ]
  if (result.html.includes('class="katex')) {
    head.push(`<link rel="stylesheet" href="${escapeHtml(opts.katexCssHref ?? KATEX_CSS_HREF)}">`)
  }
  if (opts.css) head.push(`<style>${opts.css.replace(/<\/style/gi, '<\\/style')}</style>`)
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    ...head,
    '</head>',
    '<body>',
    '<article class="ex-preview">',
    result.html,
    '</article>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

const HTML_FILE = /\.html?$/i

export async function importFile(file: File): Promise<string> {
  const text = (await file.text()).replace(/^\uFEFF/, '')
  if (!HTML_FILE.test(file.name) && file.type !== 'text/html') return text
  const body = new DOMParser().parseFromString(text, 'text/html').body.innerHTML
  return htmlToMarkdown(body)
}
```

- [ ] **Step 7: 追加入口导出**

在 `packages/markdown-core/src/index.ts` 末尾追加：

```ts
export { countHtml, countWords, type HtmlCount, type WordCount } from './utils/count'
export { htmlToMarkdown } from './utils/html-to-markdown'
export { exportHtml, exportMarkdown, importFile, KATEX_CSS_HREF, type ExportHtmlOptions } from './utils/io'
```

- [ ] **Step 8: 运行测试确认通过**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/utils`
Expected: PASS。

排障指引（只改实现，不放宽断言）：
- 任务项多出空格：确认 `listItem` 中 `/^\[([ x])\] +/` 归一化生效。
- 表格断言失败：打印实际输出，若 GFM 插件因表格无 `<thead>` 而保留 HTML，检查 markdown-it 输出是否含 `<thead>`（应含）。
- `importFile` 在 jsdom 中 `file.text` 不存在：jsdom 30 已实现 `Blob.text()`；如环境缺失，改用 `new Response(file).text()`。

Run: `pnpm --filter @editorx/markdown-core typecheck; pnpm exec eslint packages/markdown-core`
Expected: 均无错误。

- [ ] **Step 9: Commit**

```powershell
git add packages/markdown-core/package.json pnpm-lock.yaml packages/markdown-core/src/utils/count.ts packages/markdown-core/src/utils/html-to-markdown.ts packages/markdown-core/src/utils/io.ts packages/markdown-core/src/utils/utils.test.ts packages/markdown-core/src/index.ts
git commit -m "feat(markdown-core): 新增字数/段落统计、Markdown/HTML 导入导出与 HTML 转 Markdown" -m "1. countWords 按 CSDN 口径统计字数、字符与行数，countHtml 统计预览文本字数与非空段落数
2. exportHtml 输出含标题、可选样式与按需 KaTeX 样式的独立 HTML，importFile 识别 .md/.html
3. htmlToMarkdown 基于 turndown + GFM，ex-embed、Mermaid/flowchart、KaTeX、目录、脚注与任务列表可回转为源码"
```

---

### Task 7: 公共导出定稿与构建验证

**Files:**
- Modify: `packages/markdown-core/src/index.ts`（核对为下方完整内容）
- Test: `packages/markdown-core/src/index.test.ts`

**Interfaces:**
- Consumes: Task 1–6 的全部导出。
- Produces: `@editorx/markdown-core` 公共 API（2b 只在此文件末尾追加 `engine` / `scroll-sync` 导出）：类型 `EditorEngine, EmbedDef, EngineEvent, EngineOptions, RenderedSection, Renderer, RendererOptions, RenderResult, SectionOffset, Selection, SourceSection, TextState, TocItem, Unsubscribe, RenderDiagramsOptions, CommandName, CommandTransform, CodeBlockArgs, HeadingArgs, MathArgs, MermaidArgs, TableArgs, LinkArgs, PlaceholderArgs, WordCount, HtmlCount, ExportHtmlOptions`；值 `splitSections, createRenderer, isFlowchartJs, renderDiagrams, FLOWCHART_THEMES, commands, execCommand, minimalDiff, runCommand, MERMAID_TEMPLATES, countWords, countHtml, htmlToMarkdown, exportHtml, exportMarkdown, importFile, KATEX_CSS_HREF`。

- [ ] **Step 1: 写导出清单测试**

`packages/markdown-core/src/index.test.ts`（用 `arrayContaining`，2b 追加导出后无需修改本测试）：

```ts
import { describe, expect, it } from 'vitest'
import * as api from './index'

describe('@editorx/markdown-core public API', () => {
  it('exposes every phase 2a runtime export', () => {
    expect(Object.keys(api)).toEqual(
      expect.arrayContaining([
        'splitSections',
        'createRenderer',
        'isFlowchartJs',
        'renderDiagrams',
        'FLOWCHART_THEMES',
        'commands',
        'execCommand',
        'minimalDiff',
        'runCommand',
        'MERMAID_TEMPLATES',
        'countWords',
        'countHtml',
        'htmlToMarkdown',
        'exportHtml',
        'exportMarkdown',
        'importFile',
        'KATEX_CSS_HREF',
      ]),
    )
  })

  it('renders, edits and converts through the public entry', () => {
    const result = api.createRenderer().render('# 标题\n\n**粗体**')
    expect(result.html).toContain('<h1 id="标题">标题</h1>')
    expect(api.commands.bold({ text: 'a', selection: { start: 0, end: 1 } }).text).toBe('**a**')
    expect(api.countWords('# 标题')).toEqual({ words: 2, chars: 3, lines: 1 })
    expect(api.countHtml(result.html)).toEqual({ words: 4, paragraphs: 2 })
    expect(api.isFlowchartJs('st=>start: 开始\ne=>end: 结束\nst->e')).toBe(true)
    expect(api.htmlToMarkdown(result.html)).toBe('# 标题\n\n**粗体**')
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm --filter @editorx/markdown-core exec vitest run src/index.test.ts`
Expected: 若前序任务都已追加导出则直接 PASS；若 FAIL，按 Step 3 补齐 `index.ts` 后重跑。

- [ ] **Step 3: 核对 `src/index.ts` 完整内容**

`packages/markdown-core/src/index.ts` 应为（缺失的行补上，顺序保持一致）：

```ts
export type {
  EditorEngine,
  EmbedDef,
  EngineEvent,
  EngineOptions,
  RenderedSection,
  Renderer,
  RendererOptions,
  RenderResult,
  SectionOffset,
  Selection,
  SourceSection,
  TextState,
  TocItem,
  Unsubscribe,
} from './types'
export { splitSections } from './sections'
export { createRenderer } from './renderer/renderer'
export { isFlowchartJs } from './renderer/fences'
export { FLOWCHART_THEMES, renderDiagrams, type RenderDiagramsOptions } from './renderer/diagrams'
export {
  commands,
  execCommand,
  minimalDiff,
  runCommand,
  type CommandName,
  type CommandTransform,
} from './commands/registry'
export {
  MERMAID_TEMPLATES,
  type CodeBlockArgs,
  type HeadingArgs,
  type MathArgs,
  type MermaidArgs,
  type TableArgs,
} from './commands/block'
export type { LinkArgs, PlaceholderArgs } from './commands/inline'
export { countHtml, countWords, type HtmlCount, type WordCount } from './utils/count'
export { htmlToMarkdown } from './utils/html-to-markdown'
export { exportHtml, exportMarkdown, importFile, KATEX_CSS_HREF, type ExportHtmlOptions } from './utils/io'
```

- [ ] **Step 4: 全量测试、类型检查与 lint**

Run: `pnpm --filter @editorx/markdown-core test`
Expected: 所有测试文件 PASS（sections、renderer、extensions、diagrams、commands、utils、index）。

Run: `pnpm --filter @editorx/markdown-core typecheck`
Expected: 无错误。

Run: `pnpm exec eslint packages/markdown-core`
Expected: 无错误。

- [ ] **Step 5: 构建并检查产物**

Run: `pnpm --filter @editorx/markdown-core build`
Expected: 生成 `packages/markdown-core/dist/index.js`、`index.d.ts`、`index.js.map`；输出 `[copy-css] src/styles.css not found, skipping`（2b 会创建该文件）。

Run（产物不得含 `'use client'`，应无任何输出）：

```powershell
Select-String -Path packages/markdown-core/dist/index.js -Pattern "use client"
```

Run（依赖必须外部化：应命中 `from "katex"`、`from "markdown-it"`、`from "dompurify"`、`from "turndown"` 以及 `import("mermaid")`、`import("flowchart.js")`）：

```powershell
Select-String -Path packages/markdown-core/dist/index.js -Pattern 'from "katex"|from "markdown-it"|from "dompurify"|from "turndown"|import\("mermaid"\)|import\("flowchart\.js"\)' | ForEach-Object { $_.Line.Trim() }
```

Run（raphael 不得被内联：flowchart.js 运行时自行加载，应无任何输出）：

```powershell
Select-String -Path packages/markdown-core/dist/index.js -Pattern "Raphael\.fn|raphael\.js"
```

Run（未内联第三方库，产物应小于 150 KB）：

```powershell
(Get-Item packages/markdown-core/dist/index.js).Length / 1KB
```

Run（类型声明不泄漏 markdown-it 内部类型路径）：

```powershell
Select-String -Path packages/markdown-core/dist/index.d.ts -Pattern "markdown-it/lib"
```

Expected: 无输出。

- [ ] **Step 6: 通过 turbo 跑一遍包级流水线**

Run: `pnpm turbo run build typecheck test --filter=@editorx/markdown-core`
Expected: 三个任务全部成功。

- [ ] **Step 7: Commit**

```powershell
git add packages/markdown-core/src/index.ts packages/markdown-core/src/index.test.ts
git commit -m "test(markdown-core): 固化 markdown-core 公共导出并验证构建产物" -m "1. 新增公共入口导出清单测试，覆盖渲染、命令、字数统计与 HTML 回转的端到端调用
2. 核对 src/index.ts 导出顺序，供计划 2b 在末尾追加引擎与同步滚动导出
3. 验证 dist 不含 'use client'，katex/mermaid/flowchart.js/markdown-it 等依赖保持外部化"
```

---

## Self-Review（已执行）

- **Spec 覆盖：** §4.2 渲染链 → Task 2/3/4（GFM、脚注、缩写、上下标、mark、emoji、`[TOC]`、KaTeX、Mermaid、Prism、DOMPurify、按段增量、KaTeX/Mermaid 缓存、ex-embed）；§4.4 命令 → Task 5（全部 19 项，撤销/重做经 `execCommand`）；§4.5 工具 → Task 6；§9 单测 → 每个任务的 vitest，Mermaid 真实渲染与编辑器交互留给 2b 的 Playwright；§4.1 引擎、§4.3 同步滚动归 2b。Prism 亮/暗 token 配色由 2b 的 `styles.css` 通过 `--ex-*` 提供。
- **契约一致性：** `types.ts` 逐字照抄；`splitSections`、`createRenderer`、`renderDiagrams`、`runCommand`、`countWords`、`exportHtml(result, { title })`、`importFile`、`htmlToMarkdown` 签名与契约一致；section 包装 `<div class="ex-preview-section" data-section-index="{i}">` 一致；Mermaid 占位选用 base64（契约允许）。
- **类型一致性：** `ResolvedRendererOptions`、`HeadingInfo`、`CommandTransform`、`LineEdit` 在定义与使用处名称一致；`renderMermaidPlaceholder` / `decodeBase64Utf8` 在 Task 3 定义、Task 4/6 使用。
- **Addendum A 覆盖：** (1) `getCursorPosition` → Task 1 `types.ts` + Task 5 假引擎；(2) `@[TOC](title)` / `@[TOC]` / `[TOC]` → Task 2 `headings.ts`，toc 以 `data-ex-toc` 占位在组装期填充，测试覆盖「改其他段标题 → TOC 段更新且不重渲染」；(3) flowchart.js → Task 3 `isFlowchartJs` + 占位，Task 4 懒加载 `flowchart.js@1.18.0`（raphael 2.3.0 传递依赖）、主题色、逐块错误隔离、`vi.mock`；(4) `countHtml` → Task 6 `count.ts`；(5) 脚注 → Task 2 `footnotes.ts`：全文按引用顺序编号、单一文末列表追加到最后一段（段数仍等于 `splitSections`）、回链可达、编号变化不触发重渲染；(6) 跨段引用式链接 → Task 2 测试；(7) `createMarkdownIt(options)` 在 Task 2 即使用 `options.emoji`，每个任务验证步骤含 `eslint`。
- **缓存正确性：** 段缓存键 = 段文本 + 定义块（链接/缩写定义原文 + 脚注定义桩），全文相关内容（标题 id、TOC、脚注编号/列表）一律占位后在组装期填充，故缓存段在他处变化时仍正确。
- **占位扫描：** 无 TBD/TODO/「同上」；各任务 commit 均列出显式文件清单，未使用 `git add .`。

