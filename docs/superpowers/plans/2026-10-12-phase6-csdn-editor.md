# Phase 6 `<CsdnEditor />` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@editorx/csdn` `<CsdnEditor />` that composes one editor, a 56px top bar, publish settings, confirmed editor switching, and autosave with a local backup.

**Architecture:** The shell is a column: a 56px bar, then one editor region. `defaultEditor` (else `initialDocument.editorType`, else `markdown`) mounts either `MarkdownEditor` or `RichTextEditor`, never both. The article title is one string. On Markdown it is the bar input. On rich text it is the paper input already drawn by `RichTextEditor`; the bar does not draw a second input. Rich text keeps `PublishPanel` in `slots.afterPaper` with `barPosition="fixed"`, so the card scrolls inside `.ex-rte__scroll` and the fixed bar is portaled to `.ex-rte-bar-host.ex-pub`. Markdown does not stack that card under the editor; the same `settings` state is what publish sends, and the card geometry stays at G01 (bar 56, then 16px, card top 72). `CsdnEditor` owns `autoSaveInterval` and does not pass that prop into `MarkdownEditor`. Switching always opens a confirm dialog; confirm builds the next document with the current HTML or `htmlToMarkdown`. Autosave writes `localStorage` before `adapters.onSaveDraft`; a rejected save toasts, stays dirty, and leaves the backup in place.

**Tech Stack:** React 19, Next.js 16 App Router playground, Vitest + Testing Library (StrictMode), Playwright chromium, existing `@editorx/markdown`, `@editorx/rich-text`, `@editorx/publish`, `@editorx/toolbar`, `@editorx/theme`, `@editorx/ui`, `@editorx/markdown-core` (`htmlToMarkdown`). Native CSS, `.ex-` classes, `--ex-*` tokens. No Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md` (§6.4, §7, §10 item 6). Binding notes: `docs/superpowers/handoff/phase6-notes-from-5.md`. Bar height source: `docs/superpowers/handoff/reference-index.md` G01 row「顶栏 | 高 56，无下边框」. Base: branch `develop`, HEAD `b899957`.

## Global Constraints

- React 19 + Next.js 16 App Router only. Components that ship in the package are client components; `tsup` banner is `'use client';`.
- Dependency direction: `@editorx/csdn` depends directly on `@editorx/markdown`, `@editorx/rich-text`, `@editorx/publish`, `@editorx/markdown-core`, `@editorx/toolbar`, `@editorx/theme`, `@editorx/ui`. `@editorx/rich-text` does not gain a dependency on `markdown`, `markdown-core`, `publish`, or `csdn`. `@editorx/publish` does not gain a dependency on `csdn` or `rich-text`. `rich-text` is a normal dependency, not an optional peer, and the shell does not dynamic-import it or hide rich text when a package is missing.
- `@editorx/csdn-extensions` does not exist in this phase. `extensions` defaults to `[]` and is forwarded to the mounted editor. Phase 7 owns real AI, vote, video, resource, InsCode, and template behavior. Playground stand-ins may toast `阶段 7 接入`. Do not copy CSDN logo or icon art; icons are lucide.
- Colors only through existing `--ex-*` tokens. This phase adds no tokens. Do not edit `packages/theme/src/styles.css`. Component CSS has no hex, `rgb(`, `hsl(`, or `light-dark(`.
- The top bar is 56px tall with no bottom border (G01). Phase 5's `/rich-text` subtracted 48 from reference coordinates because that page did not draw a bar. Phase 6 draws 56, from G01, not 48.
- Page root stays overflow hidden. Do not move scrolling back to `window`. Rich text scrolls in `.ex-rte__scroll`. Markdown scrolls in the markdown editor's own scroller. `.ex-rte` keeps `overflow: hidden` and `transform: translate(0)`. Do not put `transform`, `filter`, or `will-change` on `.ex-csdn` or `.ex-csdn__editor` (those would make the fixed publish bar's containing block the shell).
- Title length uses code points, including spaces: `Array.from(title).length`, same bands as `titleCounter` (`还需输入5个字`, `还需输入1个字`, `5 / 100`, `100 / 100`, `101/100` with `.is-over`). Body word count is non-whitespace via `countRichTextChars` / `onWordCount`. Do not strip spaces inside the title counter.
- `RichTextEditor` `onChange` is `(html: string) => void`. `getDocument()` is `{ editorType: 'richtext', title, html, markdown: undefined }`. `setValue` does not fire `onChange`. Switching remounts with `defaultValue` and a new `key`. Do not call `setValue` from an effect to push the handed-off document.
- `MarkdownEditor` already implements `autoSaveInterval` and calls `adapters.onSaveDraft`. Leave that prop at its default `0`. The shell timer calls `getDocument` and `adapters.onSaveDraft(document, settings)`.
- Publish follows `usePublishController.publish` without a schedule argument: missing `onPublish` returns false and does not toast; `countChars(title.trim()) === 0` toasts `文章标题需为 5～100 个字`; `htmlToText(html) === ''` toasts `正文不能为空`; then `validatePublish` / `firstError`; success calls `onPublish` with `toPayload(document, settings)` and toasts `发布成功`. `resolveTemplate` still turns `moyan` into `default` when `editorType !== 'markdown'`.
- Autosave interval: off when the value is omitted, `0`, non-finite, or greater than `2147483647`. Dirty means title, editor type, markdown source (markdown mode) or html (rich text mode), or settings differ from the last successful save. The shell writes the local backup before the adapter call. Failure toasts `保存草稿失败：{message}` once per failure streak, keeps `data-dirty="true"`, and does not delete the backup. Manual save toasts `草稿已保存` on success. Autosave success does not toast.
- Local backup key default `editorx-csdn-draft`. Shape `{ document, settings, updatedAt }`. On load, if `updatedAt` is greater than `initialUpdatedAt` (default `0`) and the fingerprint differs from the initial document plus initial settings, ask before restoring. Cancel keeps the initial document and leaves the backup stored. The restore dialog blocks autosave and disables 保存草稿, 发布, and 切换编辑器 until the user chooses. Do not `setState` synchronously inside an effect; the offer is read in the `useState` initializer.
- Tests: `pnpm --filter @editorx/NAME exec vitest run <files>` after `export COREPACK_INTEGRITY_KEYS=0`. The `--` form does not narrow files. Render with StrictMode. Every `pnpm` command in this plan is preceded by `export COREPACK_INTEGRITY_KEYS=0`.
- Branch `develop`. Chinese Conventional Commits with a body, passed via HEREDOC. `git add` lists explicit paths. No `git add .` / `-A`. No `pnpm install`, `pnpm add`, or `playwright install` in implementer steps. If `@editorx/csdn` is missing from the lockfile, the controller runs `pnpm install --offline` once.
- Playwright: kill TCP 3100 before and after (`lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true`). `reuseExistingServer` would keep a stale server, so the kill is required. After CSS or package changes, `pnpm build --force` before e2e. Darwin is the acceptance platform. New visual specs start with `test.skip(process.platform !== 'darwin', '待 Windows 复测')`. Do not update unrelated baselines or any win32 PNG. Do not download reference images; mac PNGs are already in `apps/playground/public/reference/`.
- Out of scope: phase 7 real AI / vote / video / resource / InsCode / template behavior, phase 8 changesets / README / npm publish, the feedback tab, CSDN logo art.

## Review Focus

1. Five spaces are a 5-character title for the counter (`5 / 100`, no error color) and an empty title for publish (`countChars(trim) === 0`), so `onPublish` is not called and the toast is `文章标题需为 5～100 个字`; `abcd` shows `还需输入1个字` and the same toast, and also does not call `onPublish`. Pinned in Task 5.
2. A body whose text is only whitespace (`<p> </p>`, `<p>&nbsp;</p>`, or empty markdown) does not call `onPublish` and toasts `正文不能为空`, even when the title is long enough and a tag is present. Pinned in Task 5.
3. A dirty document still opens the switch dialog; 取消 leaves the current editor mounted, keeps the edited title, and does not run `htmlToMarkdown`. Pinned in Task 6.
4. When `onSaveDraft` rejects, the toast is `保存草稿失败：` plus the error message, `data-dirty` stays `true`, and `localStorage` still holds the backup written for that attempt. Pinned in Task 7.
5. A backup with `updatedAt` greater than `initialUpdatedAt` and different content asks before it is applied; 取消 leaves the initial title on screen and leaves the stored backup untouched; an older `updatedAt` does not open the dialog. Pinned in Task 7.

## File structure

- `packages/csdn/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`: package scaffold. `tsup` externals include every `@editorx/*` package this package imports, plus `react`, `react-dom`, `ckeditor5`, `@ckeditor/ckeditor5-react`.
- `packages/csdn/src/types.ts`: public props and handle.
- `packages/csdn/src/cx.ts`: class name join.
- `packages/csdn/src/top-bar.tsx`: 56px bar. Title input only when `editorType === 'markdown'`.
- `packages/csdn/src/submit-publish.ts`: publish gate shared by the shell button.
- `packages/csdn/src/switch-document.ts`: MD ↔ rich text document handoff.
- `packages/csdn/src/draft-backup.ts`: localStorage backup, fingerprint, restore predicate, interval limit.
- `packages/csdn/src/csdn-editor.tsx`: composition, one mounted editor, dialogs, autosave.
- `packages/csdn/src/index.ts`: public exports and `styles.css` import.
- `packages/csdn/src/styles.css`: shell layout. No new theme tokens.
- `apps/playground/app/page.tsx`: link to `/csdn`.
- `apps/playground/app/csdn/*`: demo page. `apps/playground/app/layout.tsx` imports `@editorx/csdn/styles.css`.
- `apps/playground/e2e/csdn.spec.ts`, `csdn-visual.spec.ts`: functional checks and darwin geometry / screenshots.
- `docs/superpowers/handoff/phase7-notes-from-6.md`, `RESUME.md`: phase 7 handoff.

---

### Task 1: Scaffold `@editorx/csdn`

**Files:**
- Create: `packages/csdn/package.json`
- Create: `packages/csdn/tsconfig.json`
- Create: `packages/csdn/tsup.config.ts`
- Create: `packages/csdn/vitest.config.ts`
- Create: `packages/csdn/src/cx.ts`
- Create: `packages/csdn/src/types.ts`
- Create: `packages/csdn/src/styles.css`
- Create: `packages/csdn/src/csdn-editor.tsx`
- Create: `packages/csdn/src/index.ts`
- Create: `packages/csdn/src/package.test.ts`
- Create: `packages/csdn/src/styles.test.ts`
- Create: `packages/csdn/src/shell.test.tsx`
- Create: `packages/csdn/src/dist.test.ts`
- Modify: `apps/playground/package.json`
- Modify: `apps/playground/app/layout.tsx`
- Modify: `apps/playground/app/page.tsx`
- Test: `packages/csdn/src/package.test.ts`, `packages/csdn/src/styles.test.ts`, `packages/csdn/src/shell.test.tsx`, `packages/csdn/src/dist.test.ts`

**Interfaces:**
- Consumes: `packages/publish/package.json`, `packages/rich-text/tsup.config.ts`, `packages/rich-text/vitest.config.ts`, `packages/rich-text/tsconfig.json`. `pnpm-workspace.yaml` already includes `packages/*`. `turbo.json` does not need an edit.
- Produces: package name `@editorx/csdn`. Runtime exports `CsdnEditor`. Types `CsdnEditorProps`, `CsdnEditorHandle`. `CsdnEditorHandle.getDocument(): EditorDocument`. Root element `class="ex-csdn"` and `data-editor="markdown"`. `dist/index.js` first line is `'use client';`. `dist/styles.css` exists.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/package.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
}

describe('@editorx/csdn package', () => {
  it('直接依赖 rich-text，而 rich-text 与 publish 不反向依赖', () => {
    const csdn = readJson('../package.json')
    const rich = readJson('../../rich-text/package.json')
    const publish = readJson('../../publish/package.json')
    expect(csdn.dependencies?.['@editorx/rich-text']).toBe('workspace:*')
    expect(csdn.dependencies?.['@editorx/markdown']).toBe('workspace:*')
    expect(csdn.dependencies?.['@editorx/publish']).toBe('workspace:*')
    expect(csdn.dependencies?.['@editorx/markdown-core']).toBe('workspace:*')
    expect(csdn.peerDependenciesMeta?.['@editorx/rich-text']).toBeUndefined()
    const richText = JSON.stringify(rich)
    expect(richText).not.toContain('@editorx/csdn')
    expect(richText).not.toContain('@editorx/markdown')
    expect(richText).not.toContain('@editorx/publish')
    const publishText = JSON.stringify(publish)
    expect(publishText).not.toContain('@editorx/csdn')
    expect(publishText).not.toContain('@editorx/rich-text')
  })
})
```

`packages/csdn/src/styles.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('csdn styles', () => {
  it('外壳占满高度并隐藏溢出，颜色只走变量', () => {
    expect(css).toMatch(/\.ex-csdn \{[^}]*height: 100%/)
    expect(css).toMatch(/\.ex-csdn \{[^}]*overflow: hidden/)
    expect(css).not.toMatch(/transform\s*:/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })
})
```

`packages/csdn/src/shell.test.tsx`:

```tsx
import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { CsdnEditor } from './csdn-editor'

describe('CsdnEditor 壳', () => {
  it('根节点占满父级并标出 markdown', () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor />
      </StrictMode>,
    )
    const root = container.querySelector('.ex-csdn')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute('data-editor', 'markdown')
    expect(root).toHaveClass('ex-csdn')
  })

  it('服务端渲染不访问 window', () => {
    const html = renderToString(<CsdnEditor />)
    expect(html).toContain('ex-csdn')
  })

  it('首页链到 /csdn', () => {
    const home = readFileSync(new URL('../../../apps/playground/app/page.tsx', import.meta.url), 'utf8')
    expect(home).toContain('href="/csdn"')
  })
})
```

`packages/csdn/src/dist.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const distDir = path.join(import.meta.dirname, '..', 'dist')
const dist = path.join(distDir, 'index.js')

describe.skipIf(!existsSync(dist))('构建产物（需先 build）', () => {
  it("dist/index.js 首行为 'use client';", () => {
    expect(readFileSync(dist, 'utf8').split(/\r?\n/, 1)[0]).toBe("'use client';")
  })

  it('静态依赖 @editorx/rich-text，并带有 styles.css', () => {
    const source = readFileSync(dist, 'utf8')
    expect(source).toContain('@editorx/rich-text')
    expect(source).not.toContain('import(')
    expect(existsSync(path.join(distDir, 'styles.css'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/package.test.ts src/styles.test.ts src/shell.test.tsx
```

Expected: FAIL. The filter does not know `@editorx/csdn`, or the modules `./csdn-editor` and `../package.json` cannot be loaded.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn/package.json`:

```json
{
  "name": "@editorx/csdn",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@editorx/markdown": "workspace:*",
    "@editorx/markdown-core": "workspace:*",
    "@editorx/publish": "workspace:*",
    "@editorx/rich-text": "workspace:*",
    "@editorx/theme": "workspace:*",
    "@editorx/toolbar": "workspace:*",
    "@editorx/ui": "workspace:*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "dependencies": {
    "@editorx/markdown": "workspace:*",
    "@editorx/markdown-core": "workspace:*",
    "@editorx/publish": "workspace:*",
    "@editorx/rich-text": "workspace:*",
    "@editorx/theme": "workspace:*",
    "@editorx/toolbar": "workspace:*",
    "@editorx/ui": "workspace:*",
    "lucide-react": "^1.53.0"
  }
}
```

`packages/csdn/tsconfig.json`:

```json
{
  "extends": "../../tooling/tsconfig.base.json",
  "include": ["src", "vitest.config.ts", "tsup.config.ts", "../../tooling/test/setup-dom.ts"]
}
```

`packages/csdn/vitest.config.ts`:

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

`packages/csdn/tsup.config.ts`:

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
  external: [
    'react',
    'react-dom',
    'ckeditor5',
    '@ckeditor/ckeditor5-react',
    '@editorx/markdown',
    '@editorx/markdown-core',
    '@editorx/rich-text',
    '@editorx/publish',
    '@editorx/theme',
    '@editorx/toolbar',
    '@editorx/ui',
  ],
  onSuccess: async () => {
    execFileSync(process.execPath, [copyCssScript], { cwd: packageDir, stdio: 'inherit' })
  },
})
```

`packages/csdn/src/cx.ts`:

```ts
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}
```

`packages/csdn/src/types.ts`:

```ts
import type { EditorDocument } from '@editorx/toolbar'
import type { Ref } from 'react'

export interface CsdnEditorHandle {
  getDocument(): EditorDocument
}

export interface CsdnEditorProps {
  className?: string
  ref?: Ref<CsdnEditorHandle>
}
```

`packages/csdn/src/styles.css`:

```css
.ex-csdn {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--ex-color-mde-canvas);
  color: var(--ex-color-text);
  font-family: var(--ex-font-family);
}
```

`packages/csdn/src/csdn-editor.tsx`:

```tsx
import type { EditorDocument } from '@editorx/toolbar'
import { useImperativeHandle } from 'react'
import { cx } from './cx'
import type { CsdnEditorProps } from './types'

const EMPTY_DOCUMENT: EditorDocument = { editorType: 'markdown', title: '', html: '', markdown: '' }

export function CsdnEditor({ className, ref }: CsdnEditorProps) {
  useImperativeHandle(ref, () => ({ getDocument: () => EMPTY_DOCUMENT }), [])
  return <div className={cx('ex-csdn', className)} data-editor="markdown" />
}
```

`packages/csdn/src/index.ts`:

```ts
export { CsdnEditor } from './csdn-editor'
export type { CsdnEditorHandle, CsdnEditorProps } from './types'
import './styles.css'
```

In `apps/playground/package.json` `dependencies`, add `"@editorx/csdn": "workspace:*"` beside the other `@editorx/*` entries.

In `apps/playground/app/layout.tsx`, after `import '@editorx/rich-text/styles.css'`, add:

```tsx
import '@editorx/csdn/styles.css'
```

In `apps/playground/app/page.tsx`, add this list item after the `/publish` item:

```tsx
<li><Link href="/csdn">CSDN 编辑器 /csdn</Link></li>
```

- [ ] **Step 4: Controller links the workspace**

If Step 2 or the build below reports that the filter cannot find `@editorx/csdn`, stop. The controller, from the repo root, runs this once:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm install --offline
```

That rewrites `pnpm-lock.yaml` only. The implementer does not run `pnpm install`, `pnpm add`, or `playwright install`.

- [ ] **Step 5: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn build
pnpm --filter @editorx/csdn exec vitest run src/package.test.ts src/styles.test.ts src/shell.test.tsx src/dist.test.ts
```

Expected: PASS. `dist/index.js` first line is `'use client';`.

- [ ] **Step 6: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/package.json packages/csdn/tsconfig.json packages/csdn/tsup.config.ts packages/csdn/vitest.config.ts packages/csdn/src/cx.ts packages/csdn/src/types.ts packages/csdn/src/styles.css packages/csdn/src/csdn-editor.tsx packages/csdn/src/index.ts packages/csdn/src/package.test.ts packages/csdn/src/styles.test.ts packages/csdn/src/shell.test.tsx packages/csdn/src/dist.test.ts apps/playground/package.json apps/playground/app/layout.tsx apps/playground/app/page.tsx pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(csdn): 搭建编辑器外壳

外壳先占满父高度并藏住页面滚动，包直接依赖富文本，playground 能链到 /csdn。

EOF
)"
git status
```

---

### Task 2: Top bar chrome

**Files:**
- Create: `packages/csdn/src/top-bar.tsx`
- Create: `packages/csdn/src/top-bar.test.tsx`
- Modify: `packages/csdn/src/types.ts`
- Modify: `packages/csdn/src/styles.css`
- Modify: `packages/csdn/src/styles.test.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Test: `packages/csdn/src/top-bar.test.tsx`, `packages/csdn/src/styles.test.ts`

**Interfaces:**
- Consumes: `CsdnEditor` root `.ex-csdn`. `ThemeToggle` from `@editorx/ui` (aria-label `切换到暗黑模式` when the resolved theme is light). `ThemeProvider` from `@editorx/theme`.
- Produces: `TopBar` props `{ onBack?: () => void; onSaveDraft: () => void; onSwitch: () => void; onPublish: () => void; showThemeToggle: boolean }`. Buttons: `.ex-csdn__back` named 返回, `.ex-csdn__draft` named 保存草稿, `.ex-csdn__switch` named 切换编辑器, `.ex-csdn__publish` named 发布. `showThemeToggle={false}` omits the theme button. Bar class `.ex-csdn__bar` is `height: 56px` and `border-bottom: 0`. `CsdnEditorProps` gains `onBack`, `showThemeToggle`, `theme`, `defaultTheme`, `onThemeChange`.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/top-bar.test.tsx`:

```tsx
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'

describe('顶栏', () => {
  it('高 56 且没有下边框，返回会调用 onBack', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const { container } = render(
      <StrictMode>
        <CsdnEditor defaultTheme="light" onBack={onBack} />
      </StrictMode>,
    )
    const bar = container.querySelector('.ex-csdn__bar')
    expect(bar).not.toBeNull()
    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '保存草稿' })).toHaveClass('ex-csdn__draft')
    expect(screen.getByRole('button', { name: '切换编辑器' })).toHaveClass('ex-csdn__switch')
    expect(screen.getByRole('button', { name: '发布' })).toHaveClass('ex-csdn__publish')
    expect(screen.getByRole('button', { name: '切换到暗黑模式' })).toBeInTheDocument()
  })

  it('showThemeToggle 为 false 时不渲染主题按钮', () => {
    render(
      <StrictMode>
        <CsdnEditor defaultTheme="light" showThemeToggle={false} />
      </StrictMode>,
    )
    expect(screen.queryByRole('button', { name: '切换到暗黑模式' })).toBeNull()
  })
})
```

Append this `it` inside `describe('csdn styles')` in `packages/csdn/src/styles.test.ts`:

```ts
  it('顶栏高 56 且无下边框', () => {
    expect(css).toMatch(/\.ex-csdn__bar \{[^}]*height: 56px/)
    expect(css).toMatch(/\.ex-csdn__bar \{[^}]*border-bottom:\s*0/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/top-bar.test.tsx src/styles.test.ts
```

Expected: FAIL. `.ex-csdn__bar` is missing, or `height: 56px` is absent from `styles.css`.

- [ ] **Step 3: Write minimal implementation**

Replace `packages/csdn/src/types.ts` with:

```ts
import type { ThemeMode } from '@editorx/theme'
import type { EditorDocument } from '@editorx/toolbar'
import type { Ref } from 'react'

export interface CsdnEditorHandle {
  getDocument(): EditorDocument
}

export interface CsdnEditorProps {
  className?: string
  onBack?: () => void
  showThemeToggle?: boolean
  theme?: ThemeMode
  defaultTheme?: ThemeMode
  onThemeChange?: (mode: ThemeMode) => void
  ref?: Ref<CsdnEditorHandle>
}
```

`packages/csdn/src/top-bar.tsx`:

```tsx
import { Button, ThemeToggle } from '@editorx/ui'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'

export interface TopBarProps {
  onBack?: () => void
  onSaveDraft: () => void
  onSwitch: () => void
  onPublish: () => void
  showThemeToggle: boolean
}

export function TopBar({ onBack, onSaveDraft, onSwitch, onPublish, showThemeToggle }: TopBarProps) {
  return (
    <header className="ex-csdn__bar">
      <Button type="button" variant="text" className="ex-csdn__back" onClick={() => onBack?.()}>
        <ArrowLeft size={16} aria-hidden="true" />
        返回
      </Button>
      <div className="ex-csdn__spacer" />
      <div className="ex-csdn__actions">
        <Button type="button" className="ex-csdn__draft" onClick={onSaveDraft}>
          保存草稿
        </Button>
        {showThemeToggle ? <ThemeToggle /> : null}
        <Button type="button" variant="text" className="ex-csdn__switch" onClick={onSwitch}>
          <ArrowLeftRight size={16} aria-hidden="true" />
          切换编辑器
        </Button>
        <Button type="button" variant="primary" className="ex-csdn__publish" onClick={onPublish}>
          发布
        </Button>
      </div>
    </header>
  )
}
```

Append to `packages/csdn/src/styles.css`:

```css
/* G01：顶栏高 56，无下边框。阶段 5 的 /rich-text 把参考坐标减 48，是因为那一页没有画这根栏。 */
.ex-csdn__bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  height: 56px;
  padding: 0 24px;
  border-bottom: 0;
  background: var(--ex-color-surface);
}

.ex-csdn__spacer { flex: 1; min-width: 0; }
.ex-csdn__actions { display: flex; flex: none; align-items: center; gap: 12px; }
```

Replace `packages/csdn/src/csdn-editor.tsx` with:

```tsx
import { ThemeProvider } from '@editorx/theme'
import type { EditorDocument } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useImperativeHandle } from 'react'
import { cx } from './cx'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

const EMPTY_DOCUMENT: EditorDocument = { editorType: 'markdown', title: '', html: '', markdown: '' }

export function CsdnEditor(props: CsdnEditorProps) {
  return (
    <ThemeProvider
      theme={props.theme}
      defaultTheme={props.defaultTheme}
      onThemeChange={props.onThemeChange}
      storageKey="editorx-csdn-theme"
      className="ex-csdn-theme"
    >
      <ToastProvider>
        <CsdnEditorShell {...props} />
      </ToastProvider>
    </ThemeProvider>
  )
}

function CsdnEditorShell({ className, onBack, showThemeToggle = true, ref }: CsdnEditorProps) {
  useImperativeHandle(ref, () => ({ getDocument: () => EMPTY_DOCUMENT }), [])
  return (
    <div className={cx('ex-csdn', className)} data-editor="markdown">
      <TopBar
        onBack={onBack}
        showThemeToggle={showThemeToggle}
        onSaveDraft={() => undefined}
        onSwitch={() => undefined}
        onPublish={() => undefined}
      />
    </div>
  )
}
```

Add `.ex-csdn-theme { display: contents; }` at the top of `styles.css`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/top-bar.test.tsx src/styles.test.ts src/shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/src/top-bar.tsx packages/csdn/src/top-bar.test.tsx packages/csdn/src/types.ts packages/csdn/src/styles.css packages/csdn/src/styles.test.ts packages/csdn/src/csdn-editor.tsx
git commit -m "$(cat <<'EOF'
feat(csdn): 加上 56px 顶栏

顶栏按 G01 固定高度且不画下边框，返回、主题、切换和发布先放在编辑器外面。

EOF
)"
git status
```

---

### Task 3: Title sync and counter

**Files:**
- Modify: `packages/rich-text/src/index.ts`
- Modify: `packages/csdn/src/types.ts`
- Modify: `packages/csdn/src/top-bar.tsx`
- Modify: `packages/csdn/src/top-bar.test.tsx`
- Modify: `packages/csdn/src/styles.css`
- Modify: `packages/csdn/src/styles.test.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Test: `packages/csdn/src/top-bar.test.tsx`, `packages/csdn/src/styles.test.ts`

**Interfaces:**
- Consumes: `titleCounter(length: number, messages: Pick<Messages['richText'], 'titleNeed' | 'titleCount' | 'titleOver'>): { text: string; over: boolean }` from `@editorx/rich-text` after this task exports it. Bands: length `< 5` → `还需输入{n}个字` with `n = 5 - length`; `5..100` → `{n} / 100`; `> 100` → `{n}/100` and `over: true`.
- Produces: `CsdnEditorProps.initialDocument?: EditorDocument` and `defaultEditor?: EditorType`. `getDocument().title` is the bar string when `data-editor="markdown"`. `defaultEditor="richtext"` sets `data-editor="richtext"` and renders no title input. Counter element `.ex-csdn-title__count`, plus `.is-over` when `over` is true. CSS `.ex-csdn-title__count.is-over` uses `color: var(--ex-color-error)`.

- [ ] **Step 1: Write the failing test**

Append to `packages/csdn/src/top-bar.test.tsx`:

```tsx
  it('Markdown 顶栏按码点计数，超长使用 is-over', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <StrictMode>
        <CsdnEditor defaultTheme="light" initialDocument={{ editorType: 'markdown', title: '', html: '' }} />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('还需输入5个字')
    await user.type(input, 'abcd')
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('还需输入1个字')
    await user.type(input, 'e')
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('5 / 100')
    await user.clear(input)
    await user.type(input, '     ')
    const spaces = container.querySelector('.ex-csdn-title__count')
    expect(spaces).toHaveTextContent('5 / 100')
    expect(spaces).not.toHaveClass('is-over')
    await user.clear(input)
    await user.type(input, 'a'.repeat(101))
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('101/100')
    expect(container.querySelector('.ex-csdn-title__count')).toHaveClass('is-over')
  })

  it('富文本模式的顶栏不放标题输入', () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '稿纸标题', html: '' }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-editor', 'richtext')
    expect(container.querySelector('.ex-csdn__bar input')).toBeNull()
    expect(container.querySelector('.ex-csdn-title__count')).toBeNull()
  })
```

Add the `userEvent` import to that file if it is not already imported. Append to `styles.test.ts`:

```ts
  it('超长标题计数使用错误色变量', () => {
    expect(css).toMatch(/\.ex-csdn-title__count\.is-over \{[^}]*color:\s*var\(--ex-color-error\)/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/top-bar.test.tsx src/styles.test.ts
```

Expected: FAIL. `getByRole('textbox', { name: '文章标题' })` cannot find the input.

- [ ] **Step 3: Write minimal implementation**

In `packages/rich-text/src/index.ts`, add:

```ts
export { titleCounter } from './title-counter'
```

Extend `CsdnEditorProps` in `types.ts` with:

```ts
import type { EditorDocument, EditorType } from '@editorx/toolbar'

initialDocument?: EditorDocument
defaultEditor?: EditorType
```

Replace `packages/csdn/src/top-bar.tsx` with:

```tsx
import { titleCounter } from '@editorx/rich-text'
import type { EditorType } from '@editorx/toolbar'
import { useMessages } from '@editorx/toolbar'
import { Button, ThemeToggle } from '@editorx/ui'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { cx } from './cx'

export interface TopBarProps {
  editorType: EditorType
  title: string
  onTitleChange: (title: string) => void
  onBack?: () => void
  onSaveDraft: () => void
  onSwitch: () => void
  onPublish: () => void
  showThemeToggle: boolean
  actionsDisabled?: boolean
}

export function TopBar({
  editorType,
  title,
  onTitleChange,
  onBack,
  onSaveDraft,
  onSwitch,
  onPublish,
  showThemeToggle,
  actionsDisabled = false,
}: TopBarProps) {
  const messages = useMessages()
  const length = Array.from(title).length
  const counter = titleCounter(length, messages.richText)
  return (
    <header className="ex-csdn__bar">
      <Button type="button" variant="text" className="ex-csdn__back" onClick={() => onBack?.()}>
        <ArrowLeft size={16} aria-hidden="true" />
        返回
      </Button>
      {editorType === 'markdown' ? (
        <label className="ex-csdn-title">
          <input
            className="ex-csdn-title__input"
            aria-label="文章标题"
            placeholder={messages.richText.titlePlaceholder}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <span className={cx('ex-csdn-title__count', counter.over && 'is-over')}>{counter.text}</span>
        </label>
      ) : (
        <div className="ex-csdn__spacer" />
      )}
      <div className="ex-csdn__actions">
        <Button type="button" className="ex-csdn__draft" disabled={actionsDisabled} onClick={onSaveDraft}>
          保存草稿
        </Button>
        {showThemeToggle ? <ThemeToggle /> : null}
        <Button type="button" variant="text" className="ex-csdn__switch" disabled={actionsDisabled} onClick={onSwitch}>
          <ArrowLeftRight size={16} aria-hidden="true" />
          切换编辑器
        </Button>
        <Button type="button" variant="primary" className="ex-csdn__publish" disabled={actionsDisabled} onClick={onPublish}>
          发布
        </Button>
      </div>
    </header>
  )
}
```

Append to `styles.css`:

```css
.ex-csdn-title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ex-csdn-title__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--ex-color-text);
  font: inherit;
  font-size: 16px;
}

.ex-csdn-title__count {
  flex: none;
  color: var(--ex-color-text-secondary);
  font-size: 12px;
}

.ex-csdn-title__count.is-over { color: var(--ex-color-error); }
```

Replace `csdn-editor.tsx` with:

```tsx
import { ThemeProvider } from '@editorx/theme'
import { MessagesProvider, type EditorDocument, type EditorType } from '@editorx/toolbar'
import { ToastProvider } from '@editorx/ui'
import { useImperativeHandle, useState } from 'react'
import { cx } from './cx'
import { TopBar } from './top-bar'
import type { CsdnEditorProps } from './types'

export function CsdnEditor(props: CsdnEditorProps) {
  return (
    <ThemeProvider
      theme={props.theme}
      defaultTheme={props.defaultTheme}
      onThemeChange={props.onThemeChange}
      storageKey="editorx-csdn-theme"
      className="ex-csdn-theme"
    >
      <MessagesProvider messages={props.locale}>
        <ToastProvider>
          <CsdnEditorShell {...props} />
        </ToastProvider>
      </MessagesProvider>
    </ThemeProvider>
  )
}

function CsdnEditorShell({
  className,
  onBack,
  showThemeToggle = true,
  initialDocument,
  defaultEditor,
  ref,
}: CsdnEditorProps) {
  const editorType: EditorType = defaultEditor ?? initialDocument?.editorType ?? 'markdown'
  const [title, setTitle] = useState(initialDocument?.title ?? '')
  const document: EditorDocument = {
    editorType,
    title,
    html: initialDocument?.html ?? '',
    ...(editorType === 'markdown' ? { markdown: initialDocument?.markdown ?? '' } : { markdown: undefined }),
  }
  useImperativeHandle(ref, () => ({ getDocument: () => document }), [document])
  return (
    <div className={cx('ex-csdn', className)} data-editor={editorType}>
      <TopBar
        editorType={editorType}
        title={title}
        onTitleChange={setTitle}
        onBack={onBack}
        showThemeToggle={showThemeToggle}
        onSaveDraft={() => undefined}
        onSwitch={() => undefined}
        onPublish={() => undefined}
      />
    </div>
  )
}
```

Add `locale?: DeepPartial<Messages>` to `CsdnEditorProps` and import those types from `@editorx/toolbar`. `MessagesProvider` already accepts `DeepPartial<Messages>`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/rich-text exec vitest run src/title-counter.test.ts
pnpm --filter @editorx/csdn exec vitest run src/top-bar.test.tsx src/styles.test.ts src/shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/rich-text/src/index.ts packages/csdn/src/types.ts packages/csdn/src/top-bar.tsx packages/csdn/src/top-bar.test.tsx packages/csdn/src/styles.css packages/csdn/src/styles.test.ts packages/csdn/src/csdn-editor.tsx
git commit -m "$(cat <<'EOF'
feat(csdn): 同步标题计数并区分两种编辑器

Markdown 在顶栏输入标题并沿用富文本的三档计数，富文本顶栏不再放第二个标题框。

EOF
)"
git status
```

---

### Task 4: One mounted editor

**Files:**
- Modify: `packages/csdn/src/types.ts`
- Modify: `packages/csdn/src/styles.css`
- Modify: `packages/csdn/src/styles.test.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Create: `packages/csdn/src/editor-mount.test.tsx`
- Test: `packages/csdn/src/editor-mount.test.tsx`, `packages/csdn/src/styles.test.ts`

**Interfaces:**
- Consumes: `MarkdownEditor` / `MarkdownEditorHandle` (`getDocument`, `onChange(markdown, html)`, `title`, `defaultValue`, `extensions`, `toolbarLayout`, `height`). `RichTextEditor` / `RichTextEditorHandle` (`title`, `onTitleChange`, `defaultValue`, `onChange(html)`, `onWordCount`, `defaultRightOpen`, `defaultTocOpen`, `slots`). Do not pass `theme`, `defaultTheme`, or `autoSaveInterval` to either child; the shell's `ThemeProvider` is the outer provider, and the markdown timer stays off.
- Produces: `CsdnEditorProps.extensions?: readonly EditorExtension[]` (default `[]`), `toolbarLayout?: ToolbarLayout`, `defaultRightOpen?: boolean`, `defaultTocOpen?: boolean`, `onEditorTypeChange?: (editorType: EditorType) => void`. Exactly one of `.ex-mde` or `.ex-rte` is mounted. `getDocument()` for markdown prefers `markdownRef.getDocument()` and overwrites `title` with shell state. For rich text, `getDocument()` returns `{ editorType: 'richtext', title, html, markdown: undefined }` from shell state (updated by `onChange`). Editor region `.ex-csdn__editor`. Markdown mode pads that region `16px` so `.ex-mde-main` sits 16px under the 56px bar.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/editor-mount.test.tsx`:

```tsx
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'
import { createRef } from 'react'

describe('只挂载一个编辑器', () => {
  it('默认挂载 Markdown，标题输入写回 getDocument', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor ref={ref} defaultTheme="light" initialDocument={{ editorType: 'markdown', title: '栏内标题', markdown: 'Hello', html: '' }} />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-mde')).not.toBeNull()
    expect(container.querySelector('.ex-rte')).toBeNull()
    expect(container.querySelector('.ex-rte-title__input')).toBeNull()
    const input = screen.getByRole('textbox', { name: '文章标题' })
    expect(input).toHaveValue('栏内标题')
    await user.clear(input)
    await user.type(input, '新的标题')
    await waitFor(() => expect(ref.current?.getDocument().title).toBe('新的标题'))
    expect(ref.current?.getDocument().editorType).toBe('markdown')
    expect(ref.current?.getDocument().markdown).toContain('Hello')
  })

  it('defaultEditor=richtext 只挂载稿纸标题', () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '稿纸标题', html: '<p>Hi</p>' }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-rte')).not.toBeNull()
    expect(container.querySelector('.ex-mde')).toBeNull()
    expect(container.querySelector('.ex-csdn__bar input')).toBeNull()
    const titles = screen.getAllByRole('textbox', { name: '文章标题' })
    expect(titles).toHaveLength(1)
    expect(titles[0]).toHaveValue('稿纸标题')
    expect(titles[0]).toHaveClass('ex-rte-title__input')
  })
})
```

Append to `styles.test.ts`:

```ts
  it('Markdown 编辑区在顶栏下留 16px，富文本编辑区不留', () => {
    expect(css).toMatch(/\.ex-csdn__editor \{[^}]*overflow: hidden/)
    expect(css).toMatch(/\.ex-csdn\[data-editor='markdown'\] \.ex-csdn__editor \{[^}]*padding: 16px/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/editor-mount.test.tsx src/styles.test.ts
```

Expected: FAIL. `.ex-mde` is null.

- [ ] **Step 3: Write minimal implementation**

Add to `CsdnEditorProps`:

```ts
import type { EditorExtension, ToolbarLayout } from '@editorx/toolbar'

extensions?: readonly EditorExtension[]
toolbarLayout?: ToolbarLayout
defaultRightOpen?: boolean
defaultTocOpen?: boolean
onEditorTypeChange?: (editorType: EditorType) => void
```

Append to `styles.css`:

```css
.ex-csdn__editor {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.ex-csdn[data-editor='markdown'] .ex-csdn__editor { padding: 16px; }
```

Replace the shell in `csdn-editor.tsx` so it keeps the `ThemeProvider` / `MessagesProvider` / `ToastProvider` wrapper from Task 3 and uses this shell. Import `MarkdownEditor`, type `MarkdownEditorHandle` from `@editorx/markdown`, and `RichTextEditor`, type `RichTextEditorHandle` from `@editorx/rich-text`.

```tsx
const NO_EXTENSIONS: readonly EditorExtension[] = []

function CsdnEditorShell({
  className,
  onBack,
  showThemeToggle = true,
  initialDocument,
  defaultEditor,
  extensions = NO_EXTENSIONS,
  toolbarLayout,
  defaultRightOpen,
  defaultTocOpen,
  ref,
}: CsdnEditorProps) {
  const editorType: EditorType = defaultEditor ?? initialDocument?.editorType ?? 'markdown'
  const [title, setTitle] = useState(initialDocument?.title ?? '')
  const [markdown, setMarkdown] = useState(initialDocument?.markdown ?? '')
  const [html, setHtml] = useState(initialDocument?.html ?? '')
  const markdownRef = useRef<MarkdownEditorHandle>(null)
  const richRef = useRef<RichTextEditorHandle>(null)

  const readDocument = useCallback((): EditorDocument => {
    if (editorType === 'markdown') {
      const live = markdownRef.current?.getDocument()
      if (live) return { ...live, title }
      return { editorType: 'markdown', title, markdown, html }
    }
    return { editorType: 'richtext', title, html, markdown: undefined }
  }, [editorType, title, markdown, html])

  useImperativeHandle(ref, () => ({ getDocument: readDocument }), [readDocument])

  return (
    <div className={cx('ex-csdn', className)} data-editor={editorType}>
      <TopBar
        editorType={editorType}
        title={title}
        onTitleChange={setTitle}
        onBack={onBack}
        showThemeToggle={showThemeToggle}
        onSaveDraft={() => undefined}
        onSwitch={() => undefined}
        onPublish={() => undefined}
      />
      <div className="ex-csdn__editor">
        {editorType === 'markdown' ? (
          <MarkdownEditor
            ref={markdownRef}
            defaultValue={markdown}
            title={title}
            extensions={extensions}
            toolbarLayout={toolbarLayout}
            height="100%"
            onChange={(nextMarkdown, nextHtml) => {
              setMarkdown(nextMarkdown)
              setHtml(nextHtml)
            }}
          />
        ) : (
          <RichTextEditor
            ref={richRef}
            defaultValue={html}
            title={title}
            onTitleChange={setTitle}
            extensions={extensions}
            toolbarLayout={toolbarLayout}
            defaultRightOpen={defaultRightOpen}
            defaultTocOpen={defaultTocOpen}
            height="100%"
            onChange={setHtml}
          />
        )}
      </div>
    </div>
  )
}
```

Do not pass `autoSaveInterval`, `theme`, or `defaultTheme` on either editor. Add the `useRef` / `useCallback` imports from `react`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/editor-mount.test.tsx src/top-bar.test.tsx src/styles.test.ts src/shell.test.tsx
```

Expected: PASS. One editor node is present in each test.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/src/types.ts packages/csdn/src/styles.css packages/csdn/src/styles.test.ts packages/csdn/src/csdn-editor.tsx packages/csdn/src/editor-mount.test.tsx
git commit -m "$(cat <<'EOF'
feat(csdn): 按默认编辑器挂载一个编辑区

同一篇文章只挂载 Markdown 或富文本其中之一，标题状态与当前编辑器上的那一个输入框保持一致。

EOF
)"
git status
```

---

### Task 5: Publish panel and the publish gate

**Files:**
- Create: `packages/csdn/src/submit-publish.ts`
- Create: `packages/csdn/src/submit-publish.test.ts`
- Modify: `packages/csdn/src/types.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Create: `packages/csdn/src/publish-shell.test.tsx`
- Test: `packages/csdn/src/submit-publish.test.ts`, `packages/csdn/src/publish-shell.test.tsx`

**Interfaces:**
- Consumes: from `@editorx/publish`: `createSettings`, `resolveTemplate`, `toPayload`, `htmlToText`, `countChars`, `validatePublish`, `firstError`, `TITLE_MIN`, `TITLE_MAX`. `PublishPanel` props `value`, `onChange`, `document`, `adapters`, `barPosition="fixed"`, `slots.barStart`. `zhCN.publish` messages. `countRichTextChars` from `@editorx/rich-text` is what `RichTextEditor` already uses for `onWordCount`; the shell displays `formatMessage(messages.richText.words, { n })` which is `共 {n} 字`.
- Produces: `submitPublish(input: { document: EditorDocument; settings: PublishSettings; adapters: EditorAdapters; notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void; messages: Messages['publish']; now?: () => number }): Promise<boolean>`. `CsdnEditorProps.adapters?: EditorAdapters`, `initialSettings?: Partial<PublishSettings>`, `slots?: { publishBarStart?: ReactNode }`. Shell `.ex-csdn__publish` calls `submitPublish`. Rich text renders `PublishPanel` in `slots.afterPaper`. The fixed bar's parent becomes `.ex-rte-bar-host`. Markdown does not render `.ex-pub-card`.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/submit-publish.test.ts`:

```ts
import { createSettings } from '@editorx/publish'
import { zhCN, type EditorDocument } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { submitPublish } from './submit-publish'

const messages = zhCN.publish
const ready: EditorDocument = {
  editorType: 'markdown',
  title: '足够长的标题',
  markdown: 'Hello',
  html: '<p>Hello</p>',
}

function setup(document: EditorDocument = ready, settings = createSettings({ tags: ['jvm'] })) {
  const onPublish = vi.fn(async () => undefined)
  const notify = vi.fn()
  return { onPublish, notify, settings, document }
}

describe('submitPublish', () => {
  it('五个空格不算可发布标题，四字标题同样不调用 onPublish', async () => {
    const spaces = setup({ ...ready, title: '     ' })
    await submitPublish({
      document: spaces.document,
      settings: spaces.settings,
      adapters: { onPublish: spaces.onPublish },
      notify: spaces.notify,
      messages,
    })
    expect(spaces.onPublish).not.toHaveBeenCalled()
    expect(spaces.notify).toHaveBeenCalledWith('文章标题需为 5～100 个字', 'error')

    const short = setup({ ...ready, title: 'abcd' })
    await submitPublish({
      document: short.document,
      settings: short.settings,
      adapters: { onPublish: short.onPublish },
      notify: short.notify,
      messages,
    })
    expect(short.onPublish).not.toHaveBeenCalled()
    expect(short.notify).toHaveBeenCalledWith('文章标题需为 5～100 个字', 'error')
  })

  it('空白正文不调用 onPublish', async () => {
    for (const html of ['<p> </p>', '<p>&nbsp;</p>', '']) {
      const ctx = setup({ ...ready, html })
      await submitPublish({
        document: ctx.document,
        settings: ctx.settings,
        adapters: { onPublish: ctx.onPublish },
        notify: ctx.notify,
        messages,
      })
      expect(ctx.onPublish).not.toHaveBeenCalled()
      expect(ctx.notify).toHaveBeenCalledWith('正文不能为空', 'error')
    }
  })

  it('标题和正文以及设置都通过时，onPublish 收到文档加设置', async () => {
    const ctx = setup(ready, createSettings({ tags: ['jvm'], template: 'moyan' }))
    const ok = await submitPublish({
      document: ctx.document,
      settings: ctx.settings,
      adapters: { onPublish: ctx.onPublish },
      notify: ctx.notify,
      messages,
    })
    expect(ok).toBe(true)
    expect(ctx.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        editorType: 'markdown',
        title: '足够长的标题',
        markdown: 'Hello',
        html: '<p>Hello</p>',
        tags: ['jvm'],
        template: 'moyan',
      }),
    )
    expect(ctx.notify).toHaveBeenCalledWith('发布成功', 'success')
  })

  it('富文本下墨衍模板会回到 default', async () => {
    const ctx = setup(
      { editorType: 'richtext', title: '足够长的标题', html: '<p>Hello</p>', markdown: undefined },
      createSettings({ tags: ['jvm'], template: 'moyan' }),
    )
    await submitPublish({
      document: ctx.document,
      settings: ctx.settings,
      adapters: { onPublish: ctx.onPublish },
      notify: ctx.notify,
      messages,
    })
    expect(ctx.onPublish).toHaveBeenCalledWith(expect.objectContaining({ template: 'default', markdown: undefined }))
  })

  it('没有 onPublish 时直接返回 false，不提示', async () => {
    const notify = vi.fn()
    const ok = await submitPublish({
      document: { ...ready, title: '' },
      settings: createSettings(),
      adapters: {},
      notify,
      messages,
    })
    expect(ok).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })
})
```

`packages/csdn/src/publish-shell.test.tsx`:

```tsx
import { htmlToText } from '@editorx/publish'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { countRichTextChars } from '@editorx/rich-text'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'

describe('外壳发布', () => {
  it('五个空格在计数里是 5 / 100，发布仍提示标题不合规', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '     ', markdown: 'Hello', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('5 / 100')
    expect(container.querySelector('.ex-csdn-title__count')).not.toHaveClass('is-over')
    await user.click(container.querySelector('.ex-csdn__publish')!)
    expect(await screen.findByText('文章标题需为 5～100 个字')).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('abcd 显示还需输入 1 个字，并且不调用 onPublish', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: 'abcd', markdown: 'Hello', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    expect(container.querySelector('.ex-csdn-title__count')).toHaveTextContent('还需输入1个字')
    await user.click(container.querySelector('.ex-csdn__publish')!)
    expect(await screen.findByText('文章标题需为 5～100 个字')).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('空正文不调用 onPublish', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: '', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    await waitFor(() => expect(htmlToText(ref.current!.getDocument().html)).toBe(''))
    await user.click(container.querySelector('.ex-csdn__publish')!)
    expect(await screen.findByText('正文不能为空')).toBeInTheDocument()
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('标题、正文和标签都在时，onPublish 收到文档和设置', async () => {
    const user = userEvent.setup()
    const onPublish = vi.fn(async () => undefined)
    const ref = createRef<CsdnEditorHandle>()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          initialSettings={{ tags: ['jvm'] }}
          adapters={{ onPublish }}
        />
      </StrictMode>,
    )
    await waitFor(() => expect(htmlToText(ref.current!.getDocument().html)).not.toBe(''))
    await user.click(container.querySelector('.ex-csdn__publish')!)
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
    expect(onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ title: '足够长的标题', markdown: 'Hello', tags: ['jvm'], editorType: 'markdown' }),
    )
    expect(await screen.findByText('发布成功')).toBeInTheDocument()
    expect(container.querySelector('.ex-pub-card')).toBeNull()
  })

  it('富文本把发布卡片放进滚动容器，固定栏挂到 bar host', async () => {
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '', html: '<p>a b</p>' }}
        />
      </StrictMode>,
    )
    expect(countRichTextChars('<p>a b</p>')).toBe(2)
    expect(countRichTextChars('<p>你好 世界</p>')).toBe(4)
    const card = container.querySelector('.ex-pub-card')
    expect(card?.closest('.ex-rte__scroll')).not.toBeNull()
    await waitFor(() => {
      expect(container.querySelector('.ex-pub-bar.is-fixed')?.parentElement).toHaveClass('ex-rte-bar-host')
    })
    expect(container.querySelector('.ex-csdn-words')).toHaveTextContent(/共 \d+ 字/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/submit-publish.test.ts src/publish-shell.test.tsx
```

Expected: FAIL. `submitPublish` is not defined, or `.ex-csdn__publish` does not toast.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn/src/submit-publish.ts`:

```ts
import {
  countChars,
  firstError,
  htmlToText,
  resolveTemplate,
  TITLE_MAX,
  TITLE_MIN,
  toPayload,
  validatePublish,
} from '@editorx/publish'
import {
  errorMessage,
  formatMessage,
  type EditorAdapters,
  type EditorDocument,
  type Messages,
  type PublishSettings,
} from '@editorx/toolbar'

export async function submitPublish(input: {
  document: EditorDocument
  settings: PublishSettings
  adapters: EditorAdapters
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  messages: Messages['publish']
  now?: () => number
}): Promise<boolean> {
  const { document: doc, adapters, notify, messages } = input
  const now = input.now ?? Date.now
  if (!adapters.onPublish) return false
  const settings: PublishSettings = {
    ...input.settings,
    tags: [...input.settings.tags],
    categories: [...input.settings.categories],
    cover: { ...input.settings.cover, urls: [...input.settings.cover.urls] },
  }
  const template = resolveTemplate(settings.template, doc.editorType)
  if (template !== settings.template) settings.template = template
  if (countChars(doc.title.trim()) === 0) {
    notify(formatMessage(messages.errors.title, { min: TITLE_MIN, max: TITLE_MAX }), 'error')
    return false
  }
  if (htmlToText(doc.html) === '') {
    notify(messages.errors.emptyHtml, 'error')
    return false
  }
  const found = firstError(validatePublish(settings, { messages, now: now(), title: doc.title }))
  if (found) {
    notify(found.message, 'error')
    return false
  }
  try {
    await adapters.onPublish(toPayload(doc, settings))
  } catch (error) {
    notify(formatMessage(messages.errors.publish, { message: errorMessage(error) }), 'error')
    return false
  }
  notify(messages.status.published, 'success')
  return true
}
```

Add to `CsdnEditorProps`:

```ts
import type { ReactNode } from 'react'
import type { EditorAdapters, PublishSettings } from '@editorx/toolbar'

adapters?: EditorAdapters
initialSettings?: Partial<PublishSettings>
slots?: { publishBarStart?: ReactNode }
```

Inside `CsdnEditorShell`, keep the editor mount from Task 4 and add settings plus publish:

```tsx
import { createSettings, PublishPanel } from '@editorx/publish'
import { formatMessage, useMessages } from '@editorx/toolbar'
import { useToast } from '@editorx/ui'
import { submitPublish } from './submit-publish'

const EMPTY_ADAPTERS: EditorAdapters = {}

// inside the shell, after title/html state:
const messages = useMessages()
const { notify } = useToast()
const adapters = props.adapters ?? EMPTY_ADAPTERS
const [settings, setSettings] = useState(() => createSettings(props.initialSettings))
const [words, setWords] = useState(0)
const publishing = useRef(false)

const publish = () => {
  if (publishing.current) return
  publishing.current = true
  void submitPublish({
    document: readDocument(),
    settings,
    adapters,
    notify,
    messages: messages.publish,
  }).finally(() => {
    publishing.current = false
  })
}
```

Pass `onPublish={publish}` to `TopBar`. Give `RichTextEditor` `onWordCount={setWords}` and:

```tsx
slots={{
  afterPaper: (
    <PublishPanel
      value={settings}
      onChange={setSettings}
      document={readDocument()}
      adapters={adapters}
      barPosition="fixed"
      slots={{
        barStart: (
          <>
            <span className="ex-csdn-words">{formatMessage(messages.richText.words, { n: words })}</span>
            {props.slots?.publishBarStart}
          </>
        ),
      }}
    />
  ),
}}
```

`readDocument` is called during render for the panel `document` prop. That is intentional: the panel validates the current title and html. Do not copy `document` into an effect.

Markdown branch does not render `PublishPanel`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/submit-publish.test.ts src/publish-shell.test.tsx src/editor-mount.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/src/submit-publish.ts packages/csdn/src/submit-publish.test.ts packages/csdn/src/types.ts packages/csdn/src/csdn-editor.tsx packages/csdn/src/publish-shell.test.tsx
git commit -m "$(cat <<'EOF'
feat(csdn): 接入发布设置并校验空标题空正文

顶栏发布走与发布控制器相同的空标题、空正文和设置校验，富文本的固定栏仍挂在编辑器外的宿主上。

EOF
)"
git status
```

---

### Task 6: Confirm switch and document handoff

**Files:**
- Create: `packages/csdn/src/switch-document.ts`
- Create: `packages/csdn/src/switch-document.test.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Create: `packages/csdn/src/switch-editor.test.tsx`
- Test: `packages/csdn/src/switch-document.test.ts`, `packages/csdn/src/switch-editor.test.tsx`

**Interfaces:**
- Consumes: `htmlToMarkdown(html: string): string` from `@editorx/markdown-core`. `Modal` from `@editorx/ui` (`open`, `onClose`, `title`, `footer`). `useMessages().dialog.confirm` is `确定`, `dialog.cancel` is `取消`. Shell `readDocument()` from Task 4. `onEditorTypeChange` from Task 4.
- Produces: `switchedDocument(doc: EditorDocument): EditorDocument`. Markdown in → `{ editorType: 'richtext', title, html: doc.html, markdown: undefined }`. Rich text in → `{ editorType: 'markdown', title, markdown: htmlToMarkdown(doc.html), html: doc.html }`. Confirm dialog title `切换编辑器`. Cancel closes it and leaves `data-editor` unchanged. Confirm increments a mount key, stores the switched document, and remounts the other editor with `defaultValue` set to that html or markdown. `onEditorTypeChange` runs from the confirm click handler.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/switch-document.test.ts`:

```ts
import { htmlToMarkdown } from '@editorx/markdown-core'
import { describe, expect, it } from 'vitest'
import { switchedDocument } from './switch-document'

describe('switchedDocument', () => {
  it('Markdown 把当前 html 交给富文本，并丢掉 markdown 字段', () => {
    expect(
      switchedDocument({ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '<p>Hello</p>' }),
    ).toEqual({ editorType: 'richtext', title: '足够长的标题', html: '<p>Hello</p>', markdown: undefined })
  })

  it('富文本用 htmlToMarkdown 生成 Markdown，标题保留', () => {
    const html = '<p>Hello</p>'
    expect(switchedDocument({ editorType: 'richtext', title: '足够长的标题', html, markdown: undefined })).toEqual({
      editorType: 'markdown',
      title: '足够长的标题',
      markdown: htmlToMarkdown(html),
      html,
    })
  })
})
```

`packages/csdn/src/switch-editor.test.tsx`:

```tsx
import { htmlToMarkdown } from '@editorx/markdown-core'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'
import type { CsdnEditorHandle } from './types'

async function confirm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: '切换编辑器' })
  await user.click(within(dialog).getByRole('button', { name: '确定' }))
}

describe('切换编辑器', () => {
  it('脏文档仍要确认，取消后留在 Markdown 且不转换', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const onEditorTypeChange = vi.fn()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          onEditorTypeChange={onEditorTypeChange}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '<p>Hello</p>' }}
        />
      </StrictMode>,
    )
    const input = screen.getByRole('textbox', { name: '文章标题' })
    await user.type(input, '呀')
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    const dialog = await screen.findByRole('dialog', { name: '切换编辑器' })
    await user.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '切换编辑器' })).toBeNull()
    expect(container.querySelector('.ex-mde')).not.toBeNull()
    expect(container.querySelector('.ex-rte')).toBeNull()
    expect(ref.current?.getDocument().editorType).toBe('markdown')
    expect(ref.current?.getDocument().title).toBe('足够长的标题呀')
    expect(ref.current?.getDocument().markdown).toContain('Hello')
    expect(onEditorTypeChange).not.toHaveBeenCalled()
  })

  it('确认后把 Markdown 的 html 交给富文本，标题仍是同一个', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const onEditorTypeChange = vi.fn()
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          onEditorTypeChange={onEditorTypeChange}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    await waitFor(() => expect(ref.current!.getDocument().html).not.toBe(''))
    const before = ref.current!.getDocument()
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    await confirm(user)
    await waitFor(() => expect(container.querySelector('.ex-rte')).not.toBeNull())
    expect(container.querySelector('.ex-mde')).toBeNull()
    expect(container.querySelector('.ex-csdn__bar input')).toBeNull()
    expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('足够长的标题')
    expect(ref.current?.getDocument()).toMatchObject({
      editorType: 'richtext',
      title: before.title,
      html: before.html,
      markdown: undefined,
    })
    expect(onEditorTypeChange).toHaveBeenCalledWith('richtext')
  })

  it('确认后富文本经 htmlToMarkdown 进入 Markdown', async () => {
    const user = userEvent.setup()
    const ref = createRef<CsdnEditorHandle>()
    const html = '<p>Hello</p>'
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          defaultEditor="richtext"
          initialDocument={{ editorType: 'richtext', title: '足够长的标题', html }}
        />
      </StrictMode>,
    )
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    await confirm(user)
    await waitFor(() => expect(container.querySelector('.ex-mde')).not.toBeNull())
    expect(container.querySelector('.ex-rte')).toBeNull()
    expect(ref.current?.getDocument().editorType).toBe('markdown')
    expect(ref.current?.getDocument().title).toBe('足够长的标题')
    expect(ref.current?.getDocument().markdown).toBe(htmlToMarkdown(html))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/switch-document.test.ts src/switch-editor.test.tsx
```

Expected: FAIL. `switchedDocument` is not defined, or the dialog does not appear.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn/src/switch-document.ts`:

```ts
import { htmlToMarkdown } from '@editorx/markdown-core'
import type { EditorDocument } from '@editorx/toolbar'

export function switchedDocument(doc: EditorDocument): EditorDocument {
  if (doc.editorType === 'markdown') {
    return { editorType: 'richtext', title: doc.title, html: doc.html, markdown: undefined }
  }
  return {
    editorType: 'markdown',
    title: doc.title,
    markdown: htmlToMarkdown(doc.html),
    html: doc.html,
  }
}
```

In the shell, replace the fixed `editorType` const with state initialized the same way:

```tsx
const [editorType, setEditorType] = useState<EditorType>(defaultEditor ?? initialDocument?.editorType ?? 'markdown')
const [mountKey, setMountKey] = useState(0)
const [switchOpen, setSwitchOpen] = useState(false)
```

`readDocument` closes over this state. Update its dependency list.

```tsx
const confirmSwitch = () => {
  const next = switchedDocument(readDocument())
  setTitle(next.title)
  setMarkdown(next.markdown ?? '')
  setHtml(next.html)
  setEditorType(next.editorType)
  setMountKey((key) => key + 1)
  setSwitchOpen(false)
  onEditorTypeChange?.(next.editorType)
}
```

`TopBar` `onSwitch` becomes `() => setSwitchOpen(true)`. Put `key={\`${editorType}:${mountKey}\`}` on both editors. `MarkdownEditor` `defaultValue={markdown}`. `RichTextEditor` `defaultValue={html}`.

Render this beside the editor region, inside the shell:

```tsx
import { Modal, Button } from '@editorx/ui'

<Modal
  open={switchOpen}
  onClose={() => setSwitchOpen(false)}
  title="切换编辑器"
  footer={
    <>
      <Button type="button" onClick={() => setSwitchOpen(false)}>
        {messages.dialog.cancel}
      </Button>
      <Button type="button" variant="primary" onClick={confirmSwitch}>
        {messages.dialog.confirm}
      </Button>
    </>
  }
>
  {editorType === 'markdown'
    ? '切换后将用当前 HTML 打开富文本编辑器。'
    : '切换后将把 HTML 转成 Markdown，部分格式会丢失。'}
</Modal>
```

Do not write an effect that calls `setValue` or `setEditorType`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/switch-document.test.ts src/switch-editor.test.tsx src/editor-mount.test.tsx src/publish-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/src/switch-document.ts packages/csdn/src/switch-document.test.ts packages/csdn/src/switch-editor.test.tsx packages/csdn/src/csdn-editor.tsx
git commit -m "$(cat <<'EOF'
feat(csdn): 确认后再切换编辑器并交接正文

取消会留在当前编辑器，确认后 Markdown 把 HTML 交给富文本，富文本则经 htmlToMarkdown 回来。

EOF
)"
git status
```

---

### Task 7: Autosave, local backup, restore prompt

**Files:**
- Create: `packages/csdn/src/draft-backup.ts`
- Create: `packages/csdn/src/draft-backup.test.ts`
- Modify: `packages/csdn/src/types.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Create: `packages/csdn/src/autosave.test.tsx`
- Test: `packages/csdn/src/draft-backup.test.ts`, `packages/csdn/src/autosave.test.tsx`

**Interfaces:**
- Consumes: `readDocument()` and `settings` from the shell. `EditorAdapters.onSaveDraft?(doc: EditorDocument, settings?: PublishSettings): Promise<void>`. `formatMessage(messages.publish.errors.saveDraft, { message })` → `保存草稿失败：{message}`. `messages.publish.status.draftSaved` → `草稿已保存`. `errorMessage` from `@editorx/toolbar`.
- Produces: `DRAFT_STORAGE_KEY = 'editorx-csdn-draft'`. `MAX_TIMER_DELAY = 2147483647`. `CsdnDraftBackup = { document: EditorDocument; settings: PublishSettings; updatedAt: number }`. `draftFingerprint(doc, settings): string` uses markdown source for markdown and html for rich text, plus `editorType`, `title`, and `settings`. `readDraftBackup(storage, key?): CsdnDraftBackup | null`. `writeDraftBackup(storage, backup, key?): void`. `shouldPromptRestore(backup, initialUpdatedAt, initialDoc, initialSettings): boolean`. `CsdnEditorProps.autoSaveInterval?: number`, `initialUpdatedAt?: number`, `draftStorageKey?: string`. Handle gains `getSettings(): PublishSettings` and `saveDraft(): Promise<boolean>`. Root `data-dirty="true" | "false"`. Restore dialog title `恢复本地草稿`.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/draft-backup.test.ts`:

```ts
import { createSettings } from '@editorx/publish'
import type { EditorDocument } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import {
  draftFingerprint,
  readDraftBackup,
  shouldPromptRestore,
  writeDraftBackup,
  DRAFT_STORAGE_KEY,
} from './draft-backup'

const initial: EditorDocument = { editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '<p>Hello</p>' }
const settings = createSettings({ tags: ['jvm'] })

describe('draft backup', () => {
  it('坏 JSON 读成 null，写后再读回', () => {
    const storage = new Map<string, string>()
    const memory: Storage = {
      get length() {
        return storage.size
      },
      clear: () => storage.clear(),
      getItem: (key) => storage.get(key) ?? null,
      key: (index) => [...storage.keys()][index] ?? null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, value),
    }
    memory.setItem(DRAFT_STORAGE_KEY, '{')
    expect(readDraftBackup(memory)).toBeNull()
    const backup = {
      document: initial,
      settings,
      updatedAt: 50,
    }
    writeDraftBackup(memory, backup)
    expect(readDraftBackup(memory)).toEqual(backup)
  })

  it('更新且内容不同才询问；更旧或内容相同不询问', () => {
    const backup = {
      document: { ...initial, title: '本地更新的标题啊' },
      settings,
      updatedAt: 50,
    }
    expect(shouldPromptRestore(backup, 10, initial, settings)).toBe(true)
    expect(shouldPromptRestore({ ...backup, updatedAt: 5 }, 10, initial, settings)).toBe(false)
    expect(shouldPromptRestore({ ...backup, document: initial }, 0, initial, settings)).toBe(false)
    expect(draftFingerprint(initial, settings)).toBe(draftFingerprint({ ...initial, html: '<p>ignored</p>' }, settings))
  })
})
```

`packages/csdn/src/autosave.test.tsx`:

```tsx
import { createSettings } from '@editorx/publish'
import { StrictMode, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsdnEditor } from './csdn-editor'
import { DRAFT_STORAGE_KEY } from './draft-backup'
import type { CsdnEditorHandle } from './types'

describe('自动保存与本地备份', () => {
  it('失败时提示、保持未保存，并且不删本地备份', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn(async () => {
      throw new Error('offline')
    })
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          autoSaveInterval={30}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await user.type(screen.getByRole('textbox', { name: '文章标题' }), '呀')
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalled())
    expect(await screen.findByText('保存草稿失败：offline')).toBeInTheDocument()
    expect(container.querySelector('.ex-csdn')).toHaveAttribute('data-dirty', 'true')
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    expect(stored).toContain('足够长的标题呀')
    const calls = onSaveDraft.mock.calls.length
    await waitFor(() => expect(onSaveDraft.mock.calls.length).toBeGreaterThan(calls))
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('足够长的标题呀')
    expect(screen.getAllByText('保存草稿失败：offline')).toHaveLength(1)
  })

  it('较新的备份先询问，取消后仍显示初始标题且备份还在', async () => {
    const user = userEvent.setup()
    const settings = createSettings()
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '<p>Local</p>' },
        settings,
        updatedAt: 50,
      }),
    )
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialUpdatedAt={10}
          autoSaveInterval={30}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    const dialog = await screen.findByRole('dialog', { name: '恢复本地草稿' })
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '发布' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '切换编辑器' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('足够长的标题')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toContain('本地更新的标题啊')
  })

  it('恢复会换上备份里的标题', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '<p>Local</p>' },
        settings: createSettings({ tags: ['jvm'] }),
        updatedAt: 50,
      }),
    )
    const ref = createRef<CsdnEditorHandle>()
    render(
      <StrictMode>
        <CsdnEditor
          ref={ref}
          defaultTheme="light"
          initialUpdatedAt={10}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    const dialog = await screen.findByRole('dialog', { name: '恢复本地草稿' })
    await user.click(within(dialog).getByRole('button', { name: '恢复' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('本地更新的标题啊'))
    expect(ref.current?.getSettings().tags).toEqual(['jvm'])
  })

  it('更旧的备份不弹窗', () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        document: { editorType: 'markdown', title: '本地更新的标题啊', markdown: 'Local', html: '' },
        settings: createSettings(),
        updatedAt: 5,
      }),
    )
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          initialUpdatedAt={10}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
        />
      </StrictMode>,
    )
    expect(screen.queryByRole('dialog', { name: '恢复本地草稿' })).toBeNull()
    expect(screen.getByRole('textbox', { name: '文章标题' })).toHaveValue('足够长的标题')
  })

  it('手动保存成功会提示草稿已保存，间隔为 0 或过大时不自动调用', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn(async () => undefined)
    const { container } = render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          autoSaveInterval={0}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await user.click(container.querySelector('.ex-csdn__draft')!)
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('草稿已保存')).toBeInTheDocument()
    expect(onSaveDraft.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ title: '足够长的标题' }))
    expect(onSaveDraft.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ tags: [] }))
  })

  it.each([Infinity, 2 ** 31])('超出范围的间隔（%s）不调用 onSaveDraft', async (autoSaveInterval) => {
    const onSaveDraft = vi.fn(async () => undefined)
    render(
      <StrictMode>
        <CsdnEditor
          defaultTheme="light"
          autoSaveInterval={autoSaveInterval}
          initialDocument={{ editorType: 'markdown', title: '足够长的标题', markdown: 'Hello', html: '' }}
          adapters={{ onSaveDraft }}
        />
      </StrictMode>,
    )
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(onSaveDraft).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/draft-backup.test.ts src/autosave.test.tsx
```

Expected: FAIL. `draftFingerprint` or `DRAFT_STORAGE_KEY` is not defined, or the restore dialog is missing.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn/src/draft-backup.ts`:

```ts
import type { EditorDocument, PublishSettings } from '@editorx/toolbar'

export const DRAFT_STORAGE_KEY = 'editorx-csdn-draft'
export const MAX_TIMER_DELAY = 2_147_483_647

export interface CsdnDraftBackup {
  document: EditorDocument
  settings: PublishSettings
  updatedAt: number
}

export function draftFingerprint(doc: EditorDocument, settings: PublishSettings): string {
  const body = doc.editorType === 'markdown' ? (doc.markdown ?? '') : doc.html
  return JSON.stringify({ editorType: doc.editorType, title: doc.title, body, settings })
}

export function readDraftBackup(storage: Storage, key = DRAFT_STORAGE_KEY): CsdnDraftBackup | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CsdnDraftBackup>
    if (!parsed.document || !parsed.settings || typeof parsed.updatedAt !== 'number') return null
    if (parsed.document.editorType !== 'markdown' && parsed.document.editorType !== 'richtext') return null
    if (typeof parsed.document.title !== 'string' || typeof parsed.document.html !== 'string') return null
    return parsed as CsdnDraftBackup
  } catch {
    return null
  }
}

export function writeDraftBackup(storage: Storage, backup: CsdnDraftBackup, key = DRAFT_STORAGE_KEY): void {
  storage.setItem(key, JSON.stringify(backup))
}

export function shouldPromptRestore(
  backup: CsdnDraftBackup | null,
  initialUpdatedAt: number,
  initialDoc: EditorDocument,
  initialSettings: PublishSettings,
): boolean {
  if (!backup) return false
  if (!(typeof backup.updatedAt === 'number' && Number.isFinite(backup.updatedAt))) return false
  if (!(backup.updatedAt > initialUpdatedAt)) return false
  return draftFingerprint(backup.document, backup.settings) !== draftFingerprint(initialDoc, initialSettings)
}
```

Add to `CsdnEditorProps` and `CsdnEditorHandle`:

```ts
autoSaveInterval?: number
initialUpdatedAt?: number
draftStorageKey?: string

getSettings(): PublishSettings
saveDraft(): Promise<boolean>
```

Keep the single `const [settings, setSettings] = useState(() => createSettings(initialSettings))` from Task 5. Next to it, capture the seed once during render and read the backup in the offer state's initializer. Do not add another settings state, and do not `setState` inside an effect.

```tsx
const draftKey = draftStorageKey ?? DRAFT_STORAGE_KEY
const seed = useRef<{ doc: EditorDocument; settings: PublishSettings } | null>(null)
if (seed.current === null) {
  seed.current = {
    doc: {
      editorType: defaultEditor ?? initialDocument?.editorType ?? 'markdown',
      title: initialDocument?.title ?? '',
      html: initialDocument?.html ?? '',
      markdown: initialDocument?.markdown ?? '',
    },
    settings,
  }
}
const [offer, setOffer] = useState<CsdnDraftBackup | null>(() => {
  if (typeof window === 'undefined' || seed.current === null) return null
  const backup = readDraftBackup(window.localStorage, draftKey)
  return shouldPromptRestore(backup, initialUpdatedAt ?? 0, seed.current.doc, seed.current.settings) ? backup : null
})
const savedFingerprint = useRef<string | null>(null)
if (savedFingerprint.current === null && seed.current) {
  savedFingerprint.current = draftFingerprint(seed.current.doc, seed.current.settings)
}
const errorShown = useRef(false)
const [saveVersion, setSaveVersion] = useState(0)
const live = useRef({ readDocument, settings, adapters, notify, messages, offer, draftKey })
live.current = { readDocument, settings, adapters, notify, messages, offer, draftKey }
```

`draftKey`, `initialUpdatedAt`, and `draftStorageKey` come from props. Declare `seed` before the `useState` that reads it, in that order, so the initializer sees the seed on the first render.

`persist`:

```tsx
const persist = useCallback(async (force: boolean): Promise<boolean> => {
  const current = live.current
  if (current.offer) return false
  const doc = current.readDocument()
  const fingerprint = draftFingerprint(doc, current.settings)
  if (!force && fingerprint === savedFingerprint.current) return true
  writeDraftBackup(window.localStorage, { document: doc, settings: current.settings, updatedAt: Date.now() }, current.draftKey)
  const adapter = current.adapters.onSaveDraft
  if (!adapter) return false
  try {
    await adapter(doc, current.settings)
  } catch (error) {
    if (force || !errorShown.current) {
      current.notify(formatMessage(current.messages.publish.errors.saveDraft, { message: errorMessage(error) }), 'error')
      errorShown.current = true
    }
    setSaveVersion((version) => version + 1)
    return false
  }
  savedFingerprint.current = fingerprint
  errorShown.current = false
  setSaveVersion((version) => version + 1)
  if (force) current.notify(current.messages.publish.status.draftSaved, 'success')
  return true
}, [])
```

Interval effect, no `setState` in the effect body:

```tsx
useEffect(() => {
  const interval = autoSaveInterval
  if (!(typeof interval === 'number' && interval > 0 && interval <= MAX_TIMER_DELAY)) return
  const timer = window.setInterval(() => {
    void persist(false)
  }, interval)
  return () => window.clearInterval(timer)
}, [autoSaveInterval, persist])
```

`data-dirty` is derived during render:

```tsx
const dirty = draftFingerprint(readDocument(), settings) !== savedFingerprint.current
```

Pass `actionsDisabled={offer !== null}` to `TopBar`. Manual save: `onSaveDraft={() => { void persist(true) }}`.

Restore dialog:

```tsx
<Modal
  open={offer !== null}
  onClose={() => setOffer(null)}
  title="恢复本地草稿"
  closeOnMaskClick={false}
  footer={
    <>
      <Button type="button" onClick={() => setOffer(null)}>
        {messages.dialog.cancel}
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={() => {
          if (!offer) return
          const next = offer.document
          setTitle(next.title)
          setMarkdown(next.markdown ?? '')
          setHtml(next.html)
          setEditorType(next.editorType)
          setSettings(createSettings(offer.settings))
          setMountKey((key) => key + 1)
          setOffer(null)
          onEditorTypeChange?.(next.editorType)
        }}
      >
        恢复
      </Button>
    </>
  }
>
  本地备份比当前文档更新。恢复会替换标题、正文和发布设置。
</Modal>
```

`useImperativeHandle` returns `getDocument`, `getSettings: () => live.current.settings`, and `saveDraft: () => persist(true)`.

`saveVersion` is read in the render that computes `dirty` (`void saveVersion`) so a failed or successful save refreshes `data-dirty`. Root: `data-dirty={dirty ? 'true' : 'false'}`.

Do not pass `autoSaveInterval` to `MarkdownEditor`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/draft-backup.test.ts src/autosave.test.tsx src/switch-editor.test.tsx src/publish-shell.test.tsx src/shell.test.tsx
```

Expected: PASS. The failure test shows one error toast, and cancel keeps `足够长的标题`.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/src/draft-backup.ts packages/csdn/src/draft-backup.test.ts packages/csdn/src/types.ts packages/csdn/src/csdn-editor.tsx packages/csdn/src/autosave.test.tsx
git commit -m "$(cat <<'EOF'
feat(csdn): 自动保存并在失败时保留本地备份

间隔保存写在外壳上，失败时保持未保存并留下 localStorage；比初始文档新的备份会先询问再恢复。

EOF
)"
git status
```

Export `DRAFT_STORAGE_KEY` and `CsdnDraftBackup` from `packages/csdn/src/index.ts` in this same commit:

```ts
export { DRAFT_STORAGE_KEY } from './draft-backup'
export type { CsdnDraftBackup } from './draft-backup'
```

Add `packages/csdn/src/index.ts` to the `git add` list above.

---

### Task 8: Playground `/csdn`

**Files:**
- Create: `apps/playground/app/csdn/page.tsx`
- Create: `apps/playground/app/csdn/csdn-playground.tsx`
- Create: `apps/playground/app/csdn/csdn.css`
- Create: `packages/csdn/src/playground-contract.test.ts`
- Test: `packages/csdn/src/playground-contract.test.ts`

**Interfaces:**
- Consumes: `CsdnEditor` props `defaultEditor`, `onEditorTypeChange`, `extensions`, `adapters`, `onWordCount` is internal; the shell already renders `共 {n} 字`. `slots.publishBarStart`. `createPublishAdapters` from `apps/playground/app/publish/mock-adapters.ts`. Markdown stand-ins: `csdnDemoExtensions` from `apps/playground/app/markdown/csdn-demo-extensions.tsx`. Rich text stand-ins: `csdnHistoryExtension`, `csdnResourceExtension`, `csdnVideoExtension`, `csdnTemplateExtension`, `csdnAiExtension` from `apps/playground/app/rich-text/stand-in-extensions.tsx`. Do not pass `csdnSwitchEditorExtension` (that button toasts `阶段 6 接入`). `QuotaNotice` from `apps/playground/app/quota-notice.tsx`.
- Produces: route `/csdn`. Query `editor=richtext` selects rich text; any other value selects markdown. `drawer=closed` sets `defaultRightOpen={false}`. `scroll=card` scrolls `.pg-csdn .ex-rte__scroll` until `.ex-pub-card` aligns with the scroller. Page CSS: `html:has(.pg-csdn)` and `body` are `height: 100%` and `overflow: hidden`. `.pg-csdn { height: 100%; }`. No `overflow-y: scroll` on `html` (this page does not reserve the 15px window gutter that `/rich-text` reserves).

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/playground-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../../../apps/playground/app/csdn/', import.meta.url)

describe('/csdn 页面契约', () => {
  it('挂上 CsdnEditor，页面本身不滚动，也不挂阶段 6 的切换占位', () => {
    const page = readFileSync(new URL('page.tsx', root), 'utf8')
    const playground = readFileSync(new URL('csdn-playground.tsx', root), 'utf8')
    const css = readFileSync(new URL('csdn.css', root), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(page).toContain('CsdnPlayground')
    expect(page).toContain("editorParam === 'richtext'")
    expect(playground).toContain('CsdnEditor')
    expect(playground).toContain('onEditorTypeChange')
    expect(playground).toContain('csdnDemoExtensions')
    expect(playground).toContain('csdnHistoryExtension')
    expect(playground).not.toContain('csdnSwitchEditorExtension')
    expect(playground).not.toContain('阶段 6 接入')
    expect(css).toMatch(/html:has\(\.pg-csdn\)[\s\S]*overflow:\s*hidden/)
    expect(css).toContain('.pg-csdn')
    expect(css).not.toMatch(/overflow-y:\s*scroll/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/playground-contract.test.ts
```

Expected: FAIL. `apps/playground/app/csdn/page.tsx` cannot be read.

- [ ] **Step 3: Write minimal implementation**

`apps/playground/app/csdn/page.tsx`:

```tsx
import type { EditorType } from '@editorx/toolbar'
import { CsdnPlayground } from './csdn-playground'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function CsdnPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const editorParam = first(params.editor)
  const editor: EditorType = editorParam === 'richtext' ? 'richtext' : 'markdown'
  return (
    <CsdnPlayground editor={editor} drawer={first(params.drawer) ?? null} scroll={first(params.scroll) ?? null} />
  )
}
```

`apps/playground/app/csdn/csdn.css`:

```css
html:has(.pg-csdn),
html:has(.pg-csdn) body {
  height: 100%;
  overflow: hidden;
}

.pg-csdn { height: 100%; }

.pg-csdn .ex-rte__scroll { scrollbar-width: none; }
.pg-csdn .ex-rte__scroll::-webkit-scrollbar { width: 0; height: 0; }

.pg-csdn-jump {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-rte-chrome);
  font-family: inherit;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.pg-csdn-float {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104px;
  height: 159px;
  border-radius: 20px 0 8px 20px;
  background: var(--ex-color-rte-paper);
  box-shadow: 0 0 40px var(--ex-color-rte-drawer-shadow);
  color: var(--ex-color-rte-chrome);
  font-size: 14px;
  font-weight: 600;
}
```

`apps/playground/app/csdn/csdn-playground.tsx`:

```tsx
'use client'

import '../quota-notice.css'
import './csdn.css'
import { CsdnEditor } from '@editorx/csdn'
import type { EditorExtension, EditorType } from '@editorx/toolbar'
import { useEffect, useMemo, useState } from 'react'
import { csdnDemoExtensions } from '../markdown/csdn-demo-extensions'
import { QuotaNotice } from '../quota-notice'
import { createPublishAdapters } from '../publish/mock-adapters'
import {
  csdnAiExtension,
  csdnHistoryExtension,
  csdnResourceExtension,
  csdnTemplateExtension,
  csdnVideoExtension,
} from '../rich-text/stand-in-extensions'

const richTextExtensions: readonly EditorExtension[] = [
  csdnHistoryExtension,
  csdnResourceExtension,
  csdnVideoExtension,
  csdnTemplateExtension,
  csdnAiExtension,
]

export function CsdnPlayground({
  editor,
  drawer,
  scroll,
}: {
  editor: EditorType
  drawer: string | null
  scroll: string | null
}) {
  const [editorType, setEditorType] = useState(editor)
  const [cardVisible, setCardVisible] = useState(false)
  const adapters = useMemo(
    () => createPublishAdapters({ categories: false, onLog: (kind, data) => console.info(`[publish:${kind}] ${JSON.stringify(data)}`) }),
    [],
  )

  useEffect(() => {
    const root = document.querySelector('.pg-csdn .ex-rte__scroll')
    const card = root?.querySelector('.ex-pub-card')
    if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return
    if (scroll === 'card') {
      const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top
      root.scrollTop += delta
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setCardVisible(entry.isIntersecting)
      },
      { root },
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [scroll, editorType])

  const onJump = () => {
    const root = document.querySelector('.pg-csdn .ex-rte__scroll')
    const card = root?.querySelector('.ex-pub-card')
    if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return
    if (cardVisible) {
      root.scrollTop = 0
      return
    }
    const delta = card.getBoundingClientRect().top - root.getBoundingClientRect().top
    root.scrollTop += delta
  }

  return (
    <div className="pg-csdn">
      <CsdnEditor
        defaultTheme="light"
        defaultEditor={editor}
        onEditorTypeChange={setEditorType}
        extensions={editorType === 'richtext' ? richTextExtensions : csdnDemoExtensions}
        adapters={adapters}
        autoSaveInterval={0}
        defaultRightOpen={drawer !== 'closed'}
        slots={{
          publishBarStart: (
            <>
              <button type="button" className="pg-csdn-jump" onClick={onJump}>
                {cardVisible ? '回到顶部' : '发文设置'}
              </button>
              <QuotaNotice />
            </>
          ),
          rightCollapsed: drawer === 'closed' ? <div className="pg-csdn-float">AI助手</div> : undefined,
        }}
      />
    </div>
  )
}
```

Extend `CsdnEditorProps.slots` in this task:

```tsx
slots?: { publishBarStart?: ReactNode; rightCollapsed?: ReactNode }
```

Pass it through on the rich text element:

```tsx
slots={{
  afterPaper: (
    <PublishPanel
      value={settings}
      onChange={setSettings}
      document={readDocument()}
      adapters={adapters}
      barPosition="fixed"
      slots={{
        barStart: (
          <>
            <span className="ex-csdn-words">{formatMessage(messages.richText.words, { n: words })}</span>
            {slots?.publishBarStart}
          </>
        ),
      }}
    />
  ),
  rightCollapsed: slots?.rightCollapsed,
}}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn build
pnpm --filter @editorx/csdn exec vitest run src/playground-contract.test.ts src/editor-mount.test.tsx
pnpm --filter @editorx/playground exec tsc --noEmit
```

Expected: PASS. `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add apps/playground/app/csdn/page.tsx apps/playground/app/csdn/csdn-playground.tsx apps/playground/app/csdn/csdn.css packages/csdn/src/playground-contract.test.ts packages/csdn/src/csdn-editor.tsx packages/csdn/src/types.ts
git commit -m "$(cat <<'EOF'
feat(playground): 增加带顶栏的 CSDN 演示页

/csdn 用外壳包住两种编辑器，页面保持内部滚动，工具栏占位只提示阶段 7。

EOF
)"
git status
```

---

### Task 9: Functional e2e and darwin top-bar geometry

**Files:**
- Create: `apps/playground/e2e/csdn.spec.ts`
- Create: `apps/playground/e2e/csdn-visual.spec.ts`
- Create: `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-markdown-light-chromium-darwin.png`
- Create: `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-richtext-light-chromium-darwin.png`
- Test: those two spec files

**Interfaces:**
- Consumes: `/csdn` and `/csdn?editor=richtext`. Shell classes `.ex-csdn__bar`, `.ex-csdn__publish`, `.ex-mde-main`, `.ex-rte__scroll`, `.ex-rte-bar-host`, `.ex-pub-bar.is-fixed`, `.ex-csdn-words`. History button name `历史` toasts `阶段 7 接入` on the rich text page.
- Produces: functional spec runs on every platform. Visual spec skips unless `process.platform === 'darwin'`, with the skip message `待 Windows 复测`. Viewport `1727×932`, `deviceScaleFactor: 1`. Snapshots are new darwin files only.

- [ ] **Step 1: Write the failing test**

`apps/playground/e2e/csdn.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1727, height: 932 } })

test('空标题不能发布，取消切换后仍是 Markdown', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/csdn')
  await expect(page.locator('.ex-csdn__bar')).toBeVisible()
  await page.locator('.ex-csdn__publish').click()
  await expect(page.getByRole('alert').filter({ hasText: '文章标题需为 5～100 个字' })).toBeVisible()
  await page.getByRole('button', { name: '切换编辑器' }).click()
  await expect(page.getByRole('dialog', { name: '切换编辑器' })).toBeVisible()
  await page.getByRole('dialog', { name: '切换编辑器' }).getByRole('button', { name: '取消' }).click()
  await expect(page.locator('.ex-mde')).toBeVisible()
  await expect(page.locator('.ex-rte')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('富文本空格不计入字数，历史占位提示阶段 7', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/csdn?editor=richtext')
  await page.getByRole('textbox', { name: '文章标题' }).fill('足够长的标题')
  await page.locator('.ex-rte-body').click()
  await page.keyboard.type('你好 世界')
  await expect(page.locator('.ex-csdn-words')).toHaveText('共 4 字')
  await page.getByRole('button', { name: '历史' }).click()
  await expect(page.getByRole('status').filter({ hasText: '阶段 7 接入' })).toBeVisible()
  await page.locator('.ex-csdn__publish').click()
  await expect(page.getByRole('alert').filter({ hasText: '正文不能为空' })).toHaveCount(0)
  expect(errors).toEqual([])
})
```

The second test types a non-empty body, so the empty-body toast must not appear. It may toast `请至少添加 1 个文章标签` because no tag was added. Assert that:

```ts
  await expect(page.getByRole('alert').filter({ hasText: '请至少添加 1 个文章标签' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '发布成功' })).toHaveCount(0)
```

Put those two lines in place of the `正文不能为空` assertion. The word-count line stays.

`apps/playground/e2e/csdn-visual.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

test.skip(process.platform !== 'darwin', '待 Windows 复测')
test.use({ viewport: { width: 1727, height: 932 }, deviceScaleFactor: 1 })

async function settle(page: Page, path: string) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto(path)
  await expect(page.locator('.ex-csdn__bar')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
}

test('Markdown 顶栏几何', async ({ page }) => {
  await settle(page, '/csdn')
  const bar = page.locator('.ex-csdn__bar')
  const box = await bar.boundingBox()
  expect(box?.y).toBe(0)
  expect(box?.height).toBe(56)
  expect(await bar.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('0px')
  const card = await page.locator('.ex-mde-main').boundingBox()
  expect(card?.x).toBe(16)
  expect(card?.y).toBe(72)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page).toHaveScreenshot('csdn-markdown-light.png', { animations: 'disabled', caret: 'hide' })
})

test('富文本顶栏几何与内部滚动', async ({ page }) => {
  await settle(page, '/csdn?editor=richtext')
  const bar = page.locator('.ex-csdn__bar')
  expect((await bar.boundingBox())?.height).toBe(56)
  await expect(page.locator('.ex-pub-bar.is-fixed').locator('..')).toHaveClass(/ex-rte-bar-host/)
  await page.locator('.ex-rte__scroll').evaluate((el) => {
    el.scrollTop = 40
  })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(await page.locator('.ex-rte__scroll').evaluate((el) => el.scrollTop)).toBe(40)
  await page.locator('.ex-rte__scroll').evaluate((el) => {
    el.scrollTop = 0
  })
  await expect(page).toHaveScreenshot('csdn-richtext-light.png', { animations: 'disabled', caret: 'hide' })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
pnpm --filter @editorx/playground exec playwright test e2e/csdn.spec.ts e2e/csdn-visual.spec.ts --project=chromium
```

Expected: FAIL. Functional assertions fail until the page matches, or the visual spec fails because `csdn-markdown-light.png` / `csdn-richtext-light.png` have no darwin snapshot yet. A failure in an unrelated spec is not this task.

- [ ] **Step 3: Write minimal implementation**

The page from Task 8 is the implementation. If a functional assertion fails, fix the shell or the playground so the assertion's expected text and DOM match this plan. Do not weaken the spec to hide a miss.

On darwin, after functional tests pass, write only this spec's snapshots:

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/playground exec playwright test e2e/csdn-visual.spec.ts --project=chromium --update-snapshots
```

Do not pass any other spec file to `--update-snapshots`. Do not touch win32 PNGs or existing snapshot folders.

- [ ] **Step 4: Run test to verify it passes**

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/playground exec playwright test e2e/csdn.spec.ts e2e/csdn-visual.spec.ts --project=chromium
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
```

Expected: PASS on darwin. The visual file is skipped on other platforms with `待 Windows 复测`. `window.scrollY` stays 0 after the rich text scroller moves.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add apps/playground/e2e/csdn.spec.ts apps/playground/e2e/csdn-visual.spec.ts apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-markdown-light-chromium-darwin.png apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-richtext-light-chromium-darwin.png
git commit -m "$(cat <<'EOF'
test(playground): 为 CSDN 页补上功能与顶栏几何

空标题、取消切换和富文本非空白字数在浏览器里核对，darwin 基线记下 56px 顶栏。

EOF
)"
git status
```

If a functional fix touched `packages/csdn` or `apps/playground/app/csdn`, add those explicit paths in the same commit.

---

### Task 10: Handoff note for phase 7

**Files:**
- Create: `docs/superpowers/handoff/phase7-notes-from-6.md`
- Modify: `docs/superpowers/handoff/RESUME.md`
- Create: `packages/csdn/src/handoff-contract.test.ts`
- Test: `packages/csdn/src/handoff-contract.test.ts`

**Interfaces:**
- Consumes: the public API shipped by Tasks 1–9: `CsdnEditor`, `DRAFT_STORAGE_KEY`, switch via `htmlToMarkdown`, publish via `submitPublish`, bar height 56.
- Produces: a note phase 7 can read without re-auditing phase 6. `RESUME.md` phase 6 row points at `phase7-notes-from-6.md` and says `已完成`. Phases 7–8 stay `未开始`.

- [ ] **Step 1: Write the failing test**

`packages/csdn/src/handoff-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('阶段 7 交接', () => {
  it('笔记写明顶栏、切换、备份和滚动，RESUME 指向该笔记', () => {
    const note = readFileSync(new URL('../../../docs/superpowers/handoff/phase7-notes-from-6.md', import.meta.url), 'utf8')
    const resume = readFileSync(new URL('../../../docs/superpowers/handoff/RESUME.md', import.meta.url), 'utf8')
    for (const phrase of [
      'G01',
      '56',
      'editorx-csdn-draft',
      'htmlToMarkdown',
      'autoSaveInterval',
      '.ex-rte__scroll',
      '.ex-rte-bar-host',
      'countRichTextChars',
      '阶段 7',
      '待 Windows 复测',
    ]) {
      expect(note).toContain(phrase)
    }
    expect(resume).toContain('phase7-notes-from-6.md')
    expect(resume).toMatch(/\| 6 \|[\s\S]*已完成/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/handoff-contract.test.ts
```

Expected: FAIL. `phase7-notes-from-6.md` cannot be read.

- [ ] **Step 3: Write minimal implementation**

Write `docs/superpowers/handoff/phase7-notes-from-6.md` in Chinese with these sections. Fill the short git hash by running `git rev-parse --short HEAD` at commit time and pasting that value; do not leave a blank.

```markdown
# 阶段 6 交给阶段 7 的笔记

阶段 6 代码 HEAD：`<short hash>`（分支 `develop`）。本笔记是其后的 docs(handoff) 提交。范围是 `@editorx/csdn` 的 `<CsdnEditor />`。阶段 7 做 `csdn-extensions` 时以本文为准。

## 代码范围

`<CsdnEditor />` 组合顶栏、一个编辑器、发布设置、确认切换和自动保存。`extensions` 默认是空数组。`@editorx/csdn-extensions` 尚未创建。

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
```

In `docs/superpowers/handoff/RESUME.md`, replace the table rows for phase 5's following line:

```markdown
| 6–8 | CsdnEditor 组合、csdn-extensions、发布准备 | 未开始 |
```

with:

```markdown
| 6 | `<CsdnEditor />`：顶栏、组合、切换、自动保存 | 已完成（develop），见 `phase7-notes-from-6.md` |
| 7–8 | csdn-extensions、发布准备 | 未开始 |
```

Replace the final 「下一步」 paragraph with:

```markdown
## 下一步

阶段 7（`csdn-extensions`：AI 助手、投票、视频、资源绑定、InsCode、模板）：先读 `phase7-notes-from-6.md`。顶栏已经在编辑器外面，高度 56。切换和自动保存已在 `<CsdnEditor />` 里。反馈 tab 与这些扩展的真实行为仍未做。
```

Leave the stale win32 baseline list unchanged.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/handoff-contract.test.ts
test "$(git branch --show-current)" = develop
git diff --check
```

Expected: PASS, and `git diff --check` prints nothing.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add docs/superpowers/handoff/phase7-notes-from-6.md docs/superpowers/handoff/RESUME.md packages/csdn/src/handoff-contract.test.ts
git commit -m "$(cat <<'EOF'
docs(handoff): 记录阶段 6 交给阶段 7 的组合约定

顶栏、单标题、切换交接和失败仍保留的本地备份写进笔记，扩展的真实行为仍留给阶段 7。

EOF
)"
git status
```

---

## 自检记录

- 设计 §6.4：顶栏按钮在 Task 2，标题 5–100 与计数在 Task 3，编辑器区域在 Task 4，发布设置在 Task 5，确认切换与 `htmlToMarkdown` 在 Task 6，`autoSaveInterval` 与 localStorage 在 Task 7。`onPublish` 的成功载荷是文档加设置。
- 设计 §7：保存失败会 `notify`，保持未保存，并留下本地备份（Task 7）。本阶段不实现「未安装 rich-text 就隐藏富文本」。
- 设计 §10 第 6 项之外的 `csdn-extensions` 真实行为、changesets、README、npm 发布不在任务里。
- 阶段 5 笔记：固定栏仍在 `.ex-rte-bar-host`，滚动仍在 `.ex-rte__scroll`，字数仍是 `countRichTextChars`，`@[TOC]` 与富文本标题目录都没有改。
- 五项 Review Focus 分别落在 Task 5（空格标题、空白正文）、Task 6（脏切换取消）、Task 7（失败保留备份、较新备份询问与取消）。
- 已核对名字：`submitPublish`、`switchedDocument`、`draftFingerprint`、`shouldPromptRestore`、`DRAFT_STORAGE_KEY`、`readDraftBackup`、`writeDraftBackup`、`titleCounter`、`countRichTextChars`、`htmlToMarkdown`、`toPayload`、`htmlToText`、`createSettings`、`CsdnEditorHandle.getDocument` / `getSettings` / `saveDraft`。
