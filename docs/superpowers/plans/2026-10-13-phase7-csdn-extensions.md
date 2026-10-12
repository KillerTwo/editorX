# Phase 7 `@editorx/csdn-extensions` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@editorx/csdn-extensions` so `<CsdnEditor />` can insert templates, votes, videos, resources, and InsCode cards, and stream AI text, all through the adapters that already exist.

**Architecture:** Six `EditorExtension` values live in the new package and are re-exported as `csdnExtensions`. Toolbar `title` / `label` are `MessageText` functions. `requires` names an adapter; the editors' default `missingAdapter` of `'hide'` drops the button, and a panel with a missing adapter stays hidden even when the policy is `'disable'`. Templates call `ctx.replaceDocument` or `ctx.insert`. Votes, videos, resources, and InsCode call `ctx.insertEmbed`, which already writes a markdown `` ```ex-embed:<type> `` fence or a rich-text `<div data-ex-embed data-payload>`. The markdown renderer stores that payload as base64 on `data-ex-payload`. This phase teaches `htmlToMarkdown` to read `data-payload` when `data-ex-payload` is absent, and teaches the rich-text upcast to decode `data-ex-payload` when `data-payload` is absent. No third attribute and no second fence language. `<CsdnEditor />` today drops `adapters` on the floor: Task 8 passes the same object into both editors. Omitting `extensions` uses `csdnExtensions`. `extensions={[]}` stays empty.

**Tech Stack:** React 19, Vitest + Testing Library (StrictMode), Playwright chromium, existing `@editorx/toolbar`, `@editorx/ui`, `@editorx/theme`, `@editorx/markdown-core` (`htmlToMarkdown`), `@editorx/rich-text` (embed upcast only). Native CSS, `.ex-csdn-ext-*` classes, existing `--ex-*` tokens. No Tailwind. lucide-react icons already in the repo: `FileText`, `ListChecks`, `Video`, `Link2`, `SquareCode`, `Sparkles`.

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md` (§3.1, §5.1–5.3, §6.4, §10 item 7, §11). Binding notes: `docs/superpowers/handoff/phase7-notes-from-6.md`. Field names come from `packages/toolbar/src/types.ts` and `packages/toolbar/src/extension.ts`, not from the older sketch in §5.2. Base: branch `develop`, HEAD `370d496`.

## Global Constraints

- React 19. Package entry is built by tsup with banner `'use client';`, ESM, and `./styles.css`. npm scope `@editorx`. CSS class prefix `.ex-`. CSS variables `--ex-*`.
- Dependency direction from spec §3.1: `toolbar` → `csdn-extensions` → `csdn`. `csdn-extensions` runtime dependencies are `@editorx/toolbar`, `@editorx/ui`, `@editorx/theme`, and `lucide-react`. It must not depend on `@editorx/csdn`, `@editorx/markdown`, `@editorx/rich-text`, `@editorx/markdown-core`, or `@editorx/publish`. `@editorx/markdown` and `@editorx/rich-text` must not gain a dependency on `@editorx/csdn-extensions`. `@editorx/csdn` may.
- Spec §10 item 7 only: AI 助手, 投票, 视频, 资源绑定, InsCode, 模板. The feedback tab stays out. History (历史 / 历史版本) stays the existing disabled or toast stand-in. Do not build real history. Do not add a toolbar button that toasts `阶段 6 接入`. Editor switch stays the `CsdnEditor` top-bar button.
- When `CsdnEditor` omits `extensions`, the default is the package export `csdnExtensions`. An explicit `extensions={[]}` stays empty. This replaces the phase 6 `NO_EXTENSIONS` default.
- No backend. Calls go through `EditorAdapters`: `aiAssist`, `createVote`, `uploadVideo`, `searchResources`, `runCode`, `getTemplates`. Do not call `fetch`. Missing adapter uses the existing default `missingAdapter: 'hide'`. `PanelDef` stays hidden when its extension `requires` an adapter that is missing, including when `missingAdapter` is `'disable'`.
- Colors only through existing `--ex-*` tokens. Do not edit `packages/theme/src/styles.css`. Component CSS has no hex, `rgb(`, `hsl(`, or `light-dark(`. Do not put `transform`, `filter`, or `will-change` on `.ex-csdn` or `.ex-csdn__editor`. This package's selectors start with `.ex-csdn-ext`.
- Copy already in the product wins. `zhCN.toolbar.template` is `模版`. `zhCN.toolbar.undo` is `撤消`. `zhCN.toolbar.resource` is `资源绑定`. `zhCN.toolbar.video` is `视频`. `zhCN.dialog.confirm` is `确定`. `zhCN.dialog.cancel` is `取消`. Do not rename those keys. New sentences live under `zhCN.csdnExt` and may use the word `模板`.
- Embed format already in the code: markdown `insertEmbed` writes a fence `` ```ex-embed:<type> `` plus `JSON.stringify(payload, null, 2)`. `renderEmbedFence` writes `<div class="ex-embed" data-ex-embed data-ex-payload="base64">`. Rich text `insertEmbed` writes `<div data-ex-embed data-payload="json">`. Reuse `ctx.insertEmbed`. Do not invent a second embed syntax.
- Tests: `export COREPACK_INTEGRITY_KEYS=0` then `pnpm --filter @editorx/NAME exec vitest run <files>`. The `--` form does not narrow files. Render with StrictMode. No synchronous `setState` inside an effect. Every `pnpm` command in this plan is preceded by `export COREPACK_INTEGRITY_KEYS=0`.
- Branch `develop`. Chinese Conventional Commits with a body, passed via HEREDOC. `git add` lists explicit paths. No `git add .` / `-A`. No `pnpm install`, `pnpm add`, or `playwright install` in implementer steps. If `@editorx/csdn-extensions` is missing from the lockfile, or a later task cannot resolve it, the controller runs `pnpm install --offline` once from the repo root. The implementer does not.
- Playwright: kill TCP 3100 before and after (`lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true`). After CSS or package changes, `pnpm build --force` before e2e. New visual runs skip unless darwin, message `待 Windows 复测`. Do not update unrelated baselines or any win32 PNG. Do not download reference images. Mac PNGs are already in `apps/playground/public/reference/`.
- Out of scope: phase 8 changesets, README, npm publish. Do not edit the stale win32 filename list in `RESUME.md`.

## Review Focus

1. `<CsdnEditor />` must pass its `adapters` into both `MarkdownEditor` and `RichTextEditor`. Omitting `extensions` while `getTemplates` exists shows a button named `模版`. `extensions={[]}` with the same adapter does not. Pinned in Task 8.
2. On the rich-text editor, a template that sets only `markdown` (the playground weekly template has this shape) does not call `replaceDocument` or `insert`, and `notify` is called with `这个模板没有 HTML，不能写入富文本`. Pinned in Task 2.
3. A vote fence `` ```ex-embed:vote `` whose JSON is `{"id":"v1"}` still contains that JSON after the markdown renderer writes `data-ex-payload`, rich text `getData()` writes `data-payload`, and `htmlToMarkdown` runs. A rich-text div that already has `data-payload` and no `data-ex-payload` becomes the same fence. Pinned in Task 3.
4. `uploadVideo` rejecting, or resolving `{ url: '' }` or `{ url: 'javascript:alert(1)' }`, calls `notify` and does not call `insertEmbed`. Pinned in Task 4.
5. With no `aiAssist`, the AI panel is absent for both `markdown` and `richtext` when `missingAdapter` is `'hide'` and when it is `'disable'`. If the stream yields `已生成` and then throws, that text stays on screen and `fetch` is not called. Pinned in Task 7.

## File structure

- `packages/csdn-extensions/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`: scaffold copied from `packages/csdn`, without markdown, rich-text, publish, or markdown-core.
- `packages/csdn-extensions/src/index.ts`: public exports. Side-effect `import './styles.css'`.
- `packages/csdn-extensions/src/styles.css`: dialog, list, card, and AI output. No theme edits.
- `packages/csdn-extensions/src/test-harness.tsx`: StrictMode + `ThemeProvider` + `Toolbar`, with toolbar widths forced wide enough that the button is not pushed into `更多`.
- `packages/csdn-extensions/src/form.tsx`: labeled field and the template apply function.
- `packages/csdn-extensions/src/embed-html.ts`: `escapeHtml`, `httpUrl`.
- `packages/csdn-extensions/src/template.tsx`, `vote.tsx`, `video.tsx`, `resource.tsx`, `inscode.tsx`, `ai.tsx`: one extension each.
- `packages/csdn-extensions/src/extensions.ts`: `csdnExtensions` in spec order.
- `packages/toolbar/src/messages.ts`: new `csdnExt` dictionary. Existing keys unchanged.
- `packages/markdown-core/src/utils/html-to-markdown.ts`: read `data-payload` when `data-ex-payload` is absent.
- `packages/rich-text/src/embed-plugin.ts`: decode `data-ex-payload` when `data-payload` is absent. No new dependency.
- `packages/rich-text/src/layout.ts`: one extra group `['csdn:vote', 'csdn:inscode']` of string ids. No import from this package.
- `packages/csdn/src/csdn-editor.tsx`: default `extensions` and `adapters={adapters}` on both editors.
- `apps/playground/app/layout.tsx`: import `@editorx/csdn-extensions/styles.css`.
- `apps/playground/app/csdn/csdn-playground.tsx`: swap the six stand-ins. History stand-in stays. Marketing panel stays on markdown only.
- `apps/playground/app/markdown/csdn-demo-extensions.tsx` and `apps/playground/app/rich-text/stand-in-extensions.tsx`: leave in place. `/markdown` and `/rich-text` keep their placeholders.
- `docs/superpowers/handoff/phase8-notes-from-7.md`, `RESUME.md`: phase 8 handoff. Phase 8 stays `未开始`.

---

### Task 1: Scaffold `@editorx/csdn-extensions`

**Files:**
- Create: `packages/csdn-extensions/package.json`
- Create: `packages/csdn-extensions/tsconfig.json`
- Create: `packages/csdn-extensions/tsup.config.ts`
- Create: `packages/csdn-extensions/vitest.config.ts`
- Create: `packages/csdn-extensions/src/styles.css`
- Create: `packages/csdn-extensions/src/index.ts`
- Create: `packages/csdn-extensions/src/extensions.ts`
- Create: `packages/csdn-extensions/src/test-harness.tsx`
- Create: `packages/csdn-extensions/src/package.test.ts`
- Create: `packages/csdn-extensions/src/styles.test.ts`
- Create: `packages/csdn-extensions/src/dist.test.ts`
- Create: `packages/csdn-extensions/src/harness.test.tsx`
- Test: `packages/csdn-extensions/src/package.test.ts`, `packages/csdn-extensions/src/styles.test.ts`, `packages/csdn-extensions/src/dist.test.ts`, `packages/csdn-extensions/src/harness.test.tsx`

**Interfaces:**
- Consumes: `packages/csdn/package.json`, `packages/csdn/tsup.config.ts`, `packages/csdn/vitest.config.ts` (`keepNodeFileUrls`), `packages/csdn/tsconfig.json`. `pnpm-workspace.yaml` already includes `packages/*`. `turbo.json` does not need an edit.
- Produces: package name `@editorx/csdn-extensions`. `csdnExtensions` is `readonly EditorExtension[]` and starts as `[]`. `renderExtension(extensions, ctx, layout, missingAdapter?)` renders `Toolbar` inside StrictMode. `extensionCtx(over?)` returns an `ExtensionContext`. `dist/index.js` first line is `'use client';`.

- [ ] **Step 1: Write the failing test**

`packages/csdn-extensions/src/package.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { csdnExtensions } from './index'

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
  }
}

function productSource(): string {
  const dir = new URL('.', import.meta.url)
  return readdirSync(dir)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes('.test.'))
    .map((name) => readFileSync(new URL(name, dir), 'utf8'))
    .join('\n')
}

describe('@editorx/csdn-extensions package', () => {
  it('只依赖 toolbar、ui、theme，数组初始为空', () => {
    const own = readJson('../package.json')
    const markdown = readJson('../../markdown/package.json')
    const rich = readJson('../../rich-text/package.json')
    expect(own.dependencies?.['@editorx/toolbar']).toBe('workspace:*')
    expect(own.dependencies?.['@editorx/ui']).toBe('workspace:*')
    expect(own.dependencies?.['@editorx/theme']).toBe('workspace:*')
    expect(own.dependencies?.['@editorx/csdn']).toBeUndefined()
    expect(own.dependencies?.['@editorx/markdown']).toBeUndefined()
    expect(own.dependencies?.['@editorx/rich-text']).toBeUndefined()
    expect(own.dependencies?.['@editorx/markdown-core']).toBeUndefined()
    expect(own.devDependencies?.['@editorx/csdn']).toBeUndefined()
    expect(own.devDependencies?.['@editorx/markdown']).toBeUndefined()
    expect(own.devDependencies?.['@editorx/rich-text']).toBeUndefined()
    expect(JSON.stringify(markdown)).not.toContain('@editorx/csdn-extensions')
    expect(JSON.stringify(rich)).not.toContain('@editorx/csdn-extensions')
    expect(csdnExtensions).toEqual([])
    expect(productSource()).not.toContain('阶段 7 接入')
    expect(productSource()).not.toContain('阶段 6 接入')
  })
})
```

`packages/csdn-extensions/src/styles.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('csdn-extensions styles', () => {
  it('颜色只走变量，不碰外壳的 transform', () => {
    expect(css).toMatch(/\.ex-csdn-ext-dialog \{[^}]*gap: var\(--ex-space-3\)/)
    expect(css).toMatch(/\.ex-csdn-ext-input \{[^}]*color: var\(--ex-color-text\)/)
    expect(css).not.toMatch(/\.ex-csdn \{/)
    expect(css).not.toMatch(/\.ex-csdn__editor/)
    expect(css).not.toMatch(/transform\s*:/)
    expect(css).not.toMatch(/filter\s*:/)
    expect(css).not.toMatch(/will-change\s*:/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })
})
```

`packages/csdn-extensions/src/dist.test.ts`:

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

  it('带有 styles.css，且不静态依赖 csdn 或 markdown', () => {
    const source = readFileSync(dist, 'utf8')
    expect(source).not.toContain('@editorx/csdn\'')
    expect(source).not.toContain('@editorx/markdown')
    expect(source).not.toContain('@editorx/rich-text')
    expect(source).not.toContain('@editorx/markdown-core')
    expect(existsSync(path.join(distDir, 'styles.css'))).toBe(true)
  })
})
```

`packages/csdn-extensions/src/harness.test.tsx`:

```tsx
import type { EditorExtension } from '@editorx/toolbar'
import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { extensionCtx, renderExtension } from './test-harness'

const probe: EditorExtension = {
  name: 'probe',
  toolbar: [{ type: 'button', id: 'probe', title: '探针', run: () => {} }],
}

describe('renderExtension', () => {
  it('在 StrictMode 里画出工具栏按钮', () => {
    renderExtension([probe], extensionCtx(), [['probe']])
    expect(screen.getByRole('button', { name: '探针' })).toBeEnabled()
    render(
      <StrictMode>
        <span>mounted</span>
      </StrictMode>,
    )
    expect(screen.getByText('mounted')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/package.test.ts src/styles.test.ts src/dist.test.ts src/harness.test.tsx
```

Expected: FAIL. The filter cannot see the package, or the test files cannot be resolved.

If the output says the filter matched no project, or `@editorx/csdn-extensions` is not in `pnpm-lock.yaml`, stop. The controller runs `pnpm install --offline` once from the repo root. The implementer does not run `pnpm install`. After that install, rerun the same command. Expected still FAIL, this time because `package.json` / `styles.css` / `./index` are missing.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn-extensions/package.json`:

```json
{
  "name": "@editorx/csdn-extensions",
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
    "@editorx/theme": "workspace:*",
    "@editorx/toolbar": "workspace:*",
    "@editorx/ui": "workspace:*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "dependencies": {
    "@editorx/theme": "workspace:*",
    "@editorx/toolbar": "workspace:*",
    "@editorx/ui": "workspace:*",
    "lucide-react": "^1.53.0"
  }
}
```

`packages/csdn-extensions/tsconfig.json`:

```json
{
  "extends": "../../tooling/tsconfig.base.json",
  "include": ["src", "vitest.config.ts", "tsup.config.ts", "../../tooling/test/setup-dom.ts"]
}
```

`packages/csdn-extensions/tsup.config.ts`:

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
  external: ['react', 'react-dom', '@editorx/theme', '@editorx/toolbar', '@editorx/ui'],
  onSuccess: async () => {
    execFileSync(process.execPath, [copyCssScript], { cwd: packageDir, stdio: 'inherit' })
  },
})
```

`packages/csdn-extensions/vitest.config.ts`: copy `packages/csdn/vitest.config.ts` unchanged, including both `keepNodeFileUrls` plugins, `environment: 'jsdom'`, `setupFiles: ['../../tooling/test/setup-dom.ts']`, and `restoreMocks: true`.

`packages/csdn-extensions/src/styles.css`:

```css
.ex-csdn-ext-dialog { display: flex; flex-direction: column; gap: var(--ex-space-3); }
.ex-csdn-ext-field { display: flex; flex-direction: column; gap: var(--ex-space-1); }
.ex-csdn-ext-field__label { color: var(--ex-color-text-secondary); font-size: var(--ex-font-size-sm); }
.ex-csdn-ext-input,
.ex-csdn-ext-area {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  font: inherit;
}
.ex-csdn-ext-input { height: 32px; padding: 0 var(--ex-space-3); }
.ex-csdn-ext-area { min-height: 96px; padding: var(--ex-space-2) var(--ex-space-3); resize: vertical; }
.ex-csdn-ext-input:focus,
.ex-csdn-ext-area:focus { border-color: var(--ex-color-primary); outline: none; }
.ex-csdn-ext-actions { display: flex; justify-content: flex-end; gap: var(--ex-space-2); }
.ex-csdn-ext-list { margin: 0; padding: 0; list-style: none; }
.ex-csdn-ext-row { display: flex; gap: var(--ex-space-2); align-items: center; }
.ex-csdn-ext-muted { margin: 0; color: var(--ex-color-text-secondary); }
.ex-csdn-ext-card {
  padding: var(--ex-space-3);
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
}
.ex-csdn-ext-card__title { margin: 0 0 var(--ex-space-2); color: var(--ex-color-text-secondary); font-size: var(--ex-font-size-sm); }
.ex-csdn-ext-output { min-height: 96px; margin: 0; color: var(--ex-color-text); white-space: pre-wrap; }
```

`packages/csdn-extensions/src/extensions.ts`:

```ts
import type { EditorExtension } from '@editorx/toolbar'

export const csdnExtensions: readonly EditorExtension[] = []
```

`packages/csdn-extensions/src/index.ts`:

```ts
import './styles.css'

export { csdnExtensions } from './extensions'
```

`packages/csdn-extensions/src/test-harness.tsx`:

```tsx
import { ThemeProvider } from '@editorx/theme'
import {
  Toolbar,
  resolveToolbar,
  zhCN,
  type EditorExtension,
  type ExtensionContext,
  type MissingAdapterPolicy,
  type ToolbarLayout,
} from '@editorx/toolbar'
import { render } from '@testing-library/react'
import { StrictMode, type ReactElement } from 'react'
import { vi } from 'vitest'

export function showToolbar(): void {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('ex-toolbar__group') ? 180 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('ex-toolbar') ? 1400 : 0
  })
}

export function extensionCtx(over: Partial<ExtensionContext> = {}): ExtensionContext {
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
    adapters: { ...over.adapters },
  }
}

export function renderExtension(
  extensions: readonly EditorExtension[],
  ctx: ExtensionContext,
  layout: ToolbarLayout,
  missingAdapter?: MissingAdapterPolicy,
): ReturnType<typeof render> {
  showToolbar()
  const groups = resolveToolbar([...extensions], layout, {
    editorType: ctx.editorType,
    adapters: ctx.adapters,
    missingAdapter,
  })
  return render(
    <StrictMode>
      <ThemeProvider defaultTheme="light" storageKey={false}>
        <Toolbar groups={groups} ctx={ctx} />
      </ThemeProvider>
    </StrictMode>,
  )
}

export function renderStrict(ui: ReactElement): ReturnType<typeof render> {
  return render(<StrictMode>{ui}</StrictMode>)
}
```

- [ ] **Step 4: Run test to verify it passes**

If `@editorx/csdn-extensions` is still absent from the lockfile, stop and let the controller run `pnpm install --offline` once. Then:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/package.test.ts src/styles.test.ts src/harness.test.tsx
pnpm --filter @editorx/csdn-extensions build
pnpm --filter @editorx/csdn-extensions exec vitest run src/dist.test.ts
```

Expected: PASS. `dist/index.js` starts with `'use client';` and `dist/styles.css` exists.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn-extensions/package.json packages/csdn-extensions/tsconfig.json packages/csdn-extensions/tsup.config.ts packages/csdn-extensions/vitest.config.ts packages/csdn-extensions/src/styles.css packages/csdn-extensions/src/index.ts packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/test-harness.tsx packages/csdn-extensions/src/package.test.ts packages/csdn-extensions/src/styles.test.ts packages/csdn-extensions/src/dist.test.ts packages/csdn-extensions/src/harness.test.tsx pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 建立扩展包并导出空列表

后续 AI、投票、视频、资源和模板都挂在这个包上，先把依赖方向和样式约束钉住。

EOF
)"
```

If `pnpm-lock.yaml` did not change, omit it from `git add`.

---

### Task 2: Template picker

**Files:**
- Create: `packages/csdn-extensions/src/form.tsx`
- Create: `packages/csdn-extensions/src/template.tsx`
- Create: `packages/csdn-extensions/src/template.test.tsx`
- Modify: `packages/csdn-extensions/src/extensions.ts`
- Modify: `packages/csdn-extensions/src/index.ts`
- Modify: `packages/toolbar/src/messages.ts`
- Modify: `packages/toolbar/src/messages.test.tsx`
- Test: `packages/csdn-extensions/src/template.test.tsx`, `packages/toolbar/src/messages.test.tsx`

**Interfaces:**
- Consumes: `renderExtension`, `extensionCtx`, `EditorExtension`, `ExtensionContext`, `Template`, `InsertContent`, `zhCN.toolbar.template` (`模版`), `zhCN.dialog.confirm` is not used here (the row buttons are `替换全文` / `插入`).
- Produces: `csdnTemplateExtension` named `csdn:template`, `requires: ['getTemplates']`, toolbar id `csdn:template`, `title` and `label` `(m) => m.toolbar.template`. `applyTemplate(ctx, template, mode, close)` writes through `replaceDocument` or `insert`. `ExtField` renders a `<label>`. `csdnExtensions` is `[csdnTemplateExtension]`. `zhCN.csdnExt` exists and does not change `toolbar.template` or `toolbar.undo`.

- [ ] **Step 1: Write the failing test**

Append to `packages/toolbar/src/messages.test.tsx` inside the existing describe:

```tsx
  it('工具栏仍是模版和撤消，扩展文案在 csdnExt', () => {
    expect(zhCN.toolbar.template).toBe('模版')
    expect(zhCN.toolbar.undo).toBe('撤消')
    expect(zhCN.toolbar.resource).toBe('资源绑定')
    expect(zhCN.toolbar.video).toBe('视频')
    expect(zhCN.dialog.confirm).toBe('确定')
    expect(zhCN.dialog.cancel).toBe('取消')
    expect(zhCN.csdnExt.templateNoHtml).toBe('这个模板没有 HTML，不能写入富文本')
    expect(zhCN.csdnExt.templateEmptyBody).toBe('这个模板没有内容')
    expect(zhCN.csdnExt.templateFailed).toBe('模板加载失败：{message}')
    expect(zhCN.csdnExt.templateReplace).toBe('替换全文')
    expect(zhCN.csdnExt.templateInsert).toBe('插入')
    expect(zhCN.csdnExt.templateLoading).toBe('加载中…')
    expect(zhCN.csdnExt.templateEmpty).toBe('没有模板')
    expect(zhCN.csdnExt.vote).toBe('投票')
    expect(zhCN.csdnExt.voteTitle).toBe('投票标题')
    expect(zhCN.csdnExt.voteOption).toBe('选项 {n}')
    expect(zhCN.csdnExt.voteAddOption).toBe('添加选项')
    expect(zhCN.csdnExt.voteMultiple).toBe('多选')
    expect(zhCN.csdnExt.voteDeadline).toBe('截止时间')
    expect(zhCN.csdnExt.voteFailed).toBe('创建投票失败：{message}')
    expect(zhCN.csdnExt.videoFailed).toBe('视频上传失败：{message}')
    expect(zhCN.csdnExt.videoBadUrl).toBe('视频地址需以 http:// 或 https:// 开头')
    expect(zhCN.csdnExt.resourceKeyword).toBe('搜索资源')
    expect(zhCN.csdnExt.resourceSearch).toBe('搜索')
    expect(zhCN.csdnExt.resourceEmpty).toBe('没有匹配的资源')
    expect(zhCN.csdnExt.resourceFailed).toBe('搜索资源失败：{message}')
    expect(zhCN.csdnExt.resourceBadUrl).toBe('资源地址需以 http:// 或 https:// 开头')
    expect(zhCN.csdnExt.inscode).toBe('InsCode')
    expect(zhCN.csdnExt.inscodeLang).toBe('语言')
    expect(zhCN.csdnExt.inscodeCode).toBe('代码')
    expect(zhCN.csdnExt.inscodeFailed).toBe('运行代码失败：{message}')
    expect(zhCN.csdnExt.inscodeBadUrl).toBe('运行结果地址需以 http:// 或 https:// 开头')
    expect(zhCN.csdnExt.ai).toBe('AI 助手')
    expect(zhCN.csdnExt.aiPrompt).toBe('告诉 AI 你想写什么')
    expect(zhCN.csdnExt.aiSend).toBe('生成')
    expect(zhCN.csdnExt.aiOutput).toBe('生成结果')
    expect(zhCN.csdnExt.aiPartial).toBe('生成中断：{message}')
  })
```

`packages/csdn-extensions/src/template.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnExtensions, csdnTemplateExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

describe('csdn:template', () => {
  it('富文本遇到只有 markdown 的模板时不写入', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      editorType: 'richtext',
      adapters: {
        getTemplates: vi.fn(async () => [{ id: 'weekly', name: '周报', markdown: '# 周报' }]),
      },
    })
    renderExtension([csdnTemplateExtension], ctx, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    const dialog = await screen.findByRole('dialog', { name: '模版' })
    await user.click(await within(dialog).findByRole('button', { name: '替换全文 周报' }))
    expect(ctx.replaceDocument).not.toHaveBeenCalled()
    expect(ctx.insert).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('这个模板没有 HTML，不能写入富文本', 'error')
    expect(screen.getByRole('dialog', { name: '模版' })).toBeInTheDocument()
  })

  it('Markdown 用 html 模板替换全文，也可以只插入', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      adapters: {
        getTemplates: async () => [{ id: 'card', name: '卡片', html: '<p>Hi</p>' }],
      },
    })
    renderExtension([csdnTemplateExtension], ctx, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    const dialog = await screen.findByRole('dialog', { name: '模版' })
    await user.click(await within(dialog).findByRole('button', { name: '替换全文 卡片' }))
    expect(ctx.replaceDocument).toHaveBeenCalledWith({ html: '<p>Hi</p>' })
    await user.click(screen.getByRole('button', { name: '模版' }))
    const again = await screen.findByRole('dialog', { name: '模版' })
    await user.click(await within(again).findByRole('button', { name: '插入 卡片' }))
    expect(ctx.insert).toHaveBeenCalledWith({ html: '<p>Hi</p>' })
  })

  it('没有 getTemplates 时隐藏；disable 时禁用且不调用', async () => {
    const user = userEvent.setup()
    const hidden = extensionCtx()
    const { unmount } = renderExtension([csdnTemplateExtension], hidden, [['csdn:template']])
    expect(screen.queryByRole('button', { name: '模版' })).toBeNull()
    unmount()
    const disabled = extensionCtx()
    renderExtension([csdnTemplateExtension], disabled, [['csdn:template']], 'disable')
    expect(screen.getByRole('button', { name: '模版' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '模版' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('加载失败只提示，空列表不提供写入按钮', async () => {
    const user = userEvent.setup()
    const failing = extensionCtx({
      adapters: { getTemplates: vi.fn(async () => Promise.reject(new Error('超时'))) },
    })
    const { unmount } = renderExtension([csdnTemplateExtension], failing, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    expect(await screen.findByText('模板加载失败：超时')).toBeInTheDocument()
    expect(failing.notify).toHaveBeenCalledWith('模板加载失败：超时', 'error')
    expect(failing.replaceDocument).not.toHaveBeenCalled()
    unmount()
    const empty = extensionCtx({ adapters: { getTemplates: async () => [] } })
    renderExtension([csdnTemplateExtension], empty, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    expect(await screen.findByText('没有模板')).toBeInTheDocument()
    expect(empty.replaceDocument).not.toHaveBeenCalled()
  })

  it('两个字段都空时不替换', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      adapters: { getTemplates: async () => [{ id: 'blank', name: '空', markdown: '   ' }] },
    })
    renderExtension([csdnTemplateExtension], ctx, [['csdn:template']])
    await user.click(screen.getByRole('button', { name: '模版' }))
    await user.click(await screen.findByRole('button', { name: '替换全文 空' }))
    expect(ctx.replaceDocument).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('这个模板没有内容', 'error')
  })

  it('列表里已经有模板扩展', () => {
    expect(csdnExtensions.map((ext) => ext.name)).toContain('csdn:template')
    expect(csdnTemplateExtension.requires).toEqual(['getTemplates'])
    expect(csdnTemplateExtension.editors).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx
pnpm --filter @editorx/csdn-extensions exec vitest run src/template.test.tsx
```

Expected: FAIL. `zhCN.csdnExt` is missing, and `csdnTemplateExtension` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `packages/toolbar/src/messages.ts`, add this object as a sibling of `syntax` inside `zhCN` (before `syntax`):

```ts
  csdnExt: {
    vote: '投票',
    inscode: 'InsCode',
    ai: 'AI 助手',
    aiPrompt: '告诉 AI 你想写什么',
    aiSend: '生成',
    aiOutput: '生成结果',
    aiPartial: '生成中断：{message}',
    templateLoading: '加载中…',
    templateEmpty: '没有模板',
    templateReplace: '替换全文',
    templateInsert: '插入',
    templateNoHtml: '这个模板没有 HTML，不能写入富文本',
    templateEmptyBody: '这个模板没有内容',
    templateFailed: '模板加载失败：{message}',
    voteTitle: '投票标题',
    voteOption: '选项 {n}',
    voteAddOption: '添加选项',
    voteMultiple: '多选',
    voteDeadline: '截止时间',
    voteFailed: '创建投票失败：{message}',
    videoFailed: '视频上传失败：{message}',
    videoBadUrl: '视频地址需以 http:// 或 https:// 开头',
    resourceKeyword: '搜索资源',
    resourceSearch: '搜索',
    resourceEmpty: '没有匹配的资源',
    resourceFailed: '搜索资源失败：{message}',
    resourceBadUrl: '资源地址需以 http:// 或 https:// 开头',
    inscodeLang: '语言',
    inscodeCode: '代码',
    inscodeFailed: '运行代码失败：{message}',
    inscodeBadUrl: '运行结果地址需以 http:// 或 https:// 开头',
  },
```

Do not change `toolbar.template`, `toolbar.undo`, `toolbar.resource`, `toolbar.video`, `dialog.confirm`, or `dialog.cancel`.

`packages/csdn-extensions/src/form.tsx`:

```tsx
import { errorMessage, formatMessage, type ExtensionContext, type InsertContent, type Template } from '@editorx/toolbar'
import { useId, type ReactNode } from 'react'

export function ExtField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="ex-csdn-ext-field">
      <label htmlFor={id} className="ex-csdn-ext-field__label">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

function usable(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.trim() === '' ? undefined : value
}

export function templateContent(editorType: ExtensionContext['editorType'], template: Template): InsertContent | null {
  const markdown = usable(template.markdown)
  const html = usable(template.html)
  if (editorType === 'richtext') {
    if (!html) return null
    return markdown ? { html, markdown } : { html }
  }
  if (markdown) return html ? { markdown, html } : { markdown }
  if (html) return { html }
  return null
}

export function applyTemplate(
  ctx: ExtensionContext,
  template: Template,
  mode: 'insert' | 'replace',
  close: () => void,
): void {
  const content = templateContent(ctx.editorType, template)
  if (!content) {
    ctx.notify(
      ctx.editorType === 'richtext' ? ctx.locale.csdnExt.templateNoHtml : ctx.locale.csdnExt.templateEmptyBody,
      'error',
    )
    return
  }
  close()
  if (mode === 'replace') ctx.replaceDocument(content)
  else ctx.insert(content)
}

export function reportFailure(ctx: ExtensionContext, template: string, error: unknown): void {
  ctx.notify(formatMessage(template, { message: errorMessage(error) }), 'error')
}
```

`packages/csdn-extensions/src/template.tsx`:

```tsx
import type { EditorExtension, ExtensionContext, Template } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyTemplate, reportFailure } from './form'

const ICON = 16

function TemplatePicker({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const copy = ctx.locale.csdnExt

  useEffect(() => {
    let alive = true
    const load = ctx.adapters.getTemplates
    if (!load) return
    load().then(
      (list) => {
        if (alive) setTemplates(list)
      },
      (error: unknown) => {
        if (!alive) return
        const message = copy.templateFailed.replace('{message}', error instanceof Error ? error.message : String(error))
        setFailed(message)
        setTemplates([])
        reportFailure(ctx, copy.templateFailed, error)
      },
    )
    return () => {
      alive = false
    }
  }, [ctx, copy.templateFailed])

  if (failed) return <p className="ex-csdn-ext-muted">{failed}</p>
  if (!templates) return <p className="ex-csdn-ext-muted">{copy.templateLoading}</p>
  if (templates.length === 0) return <p className="ex-csdn-ext-muted">{copy.templateEmpty}</p>
  return (
    <ul className="ex-csdn-ext-list">
      {templates.map((template) => (
        <li key={template.id} className="ex-csdn-ext-row">
          <span>{template.name}</span>
          <Button variant="text" onClick={() => applyTemplate(ctx, template, 'replace', close)}>
            {`${copy.templateReplace} ${template.name}`}
          </Button>
          <Button variant="text" onClick={() => applyTemplate(ctx, template, 'insert', close)}>
            {`${copy.templateInsert} ${template.name}`}
          </Button>
        </li>
      ))}
    </ul>
  )
}

export const csdnTemplateExtension: EditorExtension = {
  name: 'csdn:template',
  requires: ['getTemplates'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:template',
      title: (m) => m.toolbar.template,
      label: (m) => m.toolbar.template,
      icon: <FileText size={ICON} />,
      width: 420,
      render: (ctx, close) => <TemplatePicker ctx={ctx} close={close} />,
    },
  ],
}
```

The `useEffect` body does not call `setState`. The promise callback does, after a check of `alive`.

`packages/csdn-extensions/src/extensions.ts`:

```ts
import type { EditorExtension } from '@editorx/toolbar'
import { csdnTemplateExtension } from './template'

export const csdnExtensions: readonly EditorExtension[] = [csdnTemplateExtension]

export { csdnTemplateExtension }
```

`packages/csdn-extensions/src/index.ts`:

```ts
import './styles.css'

export { csdnExtensions, csdnTemplateExtension } from './extensions'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/toolbar exec vitest run src/messages.test.tsx
pnpm --filter @editorx/csdn-extensions exec vitest run src/template.test.tsx src/package.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/toolbar/src/messages.ts packages/toolbar/src/messages.test.tsx packages/csdn-extensions/src/form.tsx packages/csdn-extensions/src/template.tsx packages/csdn-extensions/src/template.test.tsx packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/index.ts
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 用 getTemplates 插入或替换模板

富文本没有 HTML 时不改文档。工具栏文案仍读模版，不改撤消。

EOF
)"
```

---

### Task 3: Vote embed that round-trips

**Files:**
- Create: `packages/csdn-extensions/src/embed-html.ts`
- Create: `packages/csdn-extensions/src/vote.tsx`
- Create: `packages/csdn-extensions/src/vote.test.tsx`
- Modify: `packages/csdn-extensions/src/extensions.ts`
- Modify: `packages/csdn-extensions/src/index.ts`
- Modify: `packages/markdown-core/src/utils/html-to-markdown.ts`
- Modify: `packages/markdown-core/src/utils/utils.test.ts`
- Modify: `packages/rich-text/src/embed-plugin.ts`
- Modify: `packages/rich-text/src/mount-editor.test.ts`
- Test: `packages/csdn-extensions/src/vote.test.tsx`, `packages/markdown-core/src/utils/utils.test.ts`, `packages/rich-text/src/mount-editor.test.ts`

**Interfaces:**
- Consumes: `ExtField`, `reportFailure`, `VoteInput`, `createVote?(data: VoteInput): Promise<{ id: string }>`, `insertEmbed(type, payload)`.
- Produces: `csdnVoteExtension` named `csdn:vote`, `requires: ['createVote']`, toolbar id `csdn:vote`, `title` and `label` `(m) => m.csdnExt.vote`, `group: 'csdn'`, `order: 10`. Embed type `vote`. Payload `{ id, title, options, multiple, deadline? }`. `escapeHtml(value: string): string`. `httpUrl(value: unknown): string | null` returns the href only for `http:` and `https:`. `csdnExtensions` includes `csdn:vote` and `csdn:template`.

- [ ] **Step 1: Write the failing test**

Add to `packages/markdown-core/src/utils/utils.test.ts` inside `describe('htmlToMarkdown')`:

```ts
  it('reads rich-text data-payload as the ex-embed fence', () => {
    expect(htmlToMarkdown('<div data-ex-embed="vote" data-payload="{&quot;id&quot;:&quot;v1&quot;}"></div>')).toBe(
      '```ex-embed:vote\n{"id":"v1"}\n```',
    )
  })

  it('prefers data-ex-payload when both attributes exist', () => {
    expect(
      htmlToMarkdown(
        '<div data-ex-embed="vote" data-ex-payload="not base64!" data-payload="{&quot;id&quot;:&quot;v1&quot;}"></div>',
      ),
    ).toBe('```ex-embed:vote\nnot base64!\n```')
  })
```

Add to `packages/rich-text/src/mount-editor.test.ts`:

```ts
  it('把 markdown 的 data-ex-payload 收成 data-payload', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = await mountEditor(
      element,
      createEditorConfig({}),
      '<div data-ex-embed="vote" data-ex-payload="eyJpZCI6InYxIn0="></div>',
    )
    const data = editor.getData()
    expect(data).toContain('data-ex-embed="vote"')
    expect(data).toContain('&quot;id&quot;:&quot;v1&quot;')
    expect(data).not.toContain('data-ex-payload')
    await editor.destroy()
  })
```

`eyJpZCI6InYxIn0=` is `btoa('{"id":"v1"}')`.

`packages/csdn-extensions/src/vote.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnVoteExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

describe('csdn:vote', () => {
  it('不足两个有效选项时不调用 createVote', async () => {
    const user = userEvent.setup()
    const createVote = vi.fn(async () => ({ id: 'v1' }))
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '午饭')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '   ')
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    expect(createVote).not.toHaveBeenCalled()
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
  })

  it('createVote 失败时不插入，对话框留着', async () => {
    const user = userEvent.setup()
    const createVote = vi.fn(async () => Promise.reject(new Error('满了')))
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '午饭')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '饭')
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(createVote).toHaveBeenCalledWith({ title: '午饭', options: ['面', '饭'], multiple: false })
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('创建投票失败：满了', 'error')
    expect(screen.getByRole('dialog', { name: '投票' })).toBeInTheDocument()
  })

  it('成功后插入 vote 嵌入，卡片转义标题', async () => {
    const user = userEvent.setup()
    const createVote = vi.fn(async () => ({ id: 'v1' }))
    const ctx = extensionCtx({ adapters: { createVote } })
    renderExtension([csdnVoteExtension], ctx, [['csdn:vote']])
    await user.click(screen.getByRole('button', { name: '投票' }))
    const dialog = await screen.findByRole('dialog', { name: '投票' })
    await user.type(within(dialog).getByRole('textbox', { name: '投票标题' }), '<b>')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 1' }), '面')
    await user.type(within(dialog).getByRole('textbox', { name: '选项 2' }), '饭')
    await user.click(within(dialog).getByRole('checkbox', { name: '多选' }))
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(ctx.insertEmbed).toHaveBeenCalledWith('vote', {
      id: 'v1',
      title: '<b>',
      options: ['面', '饭'],
      multiple: true,
    })
    const html = csdnVoteExtension.embeds?.[0]?.renderHtml({
      id: 'v1',
      title: '<b>',
      options: ['a&b', 'c'],
      multiple: false,
    })
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('a&amp;b')
    expect(html).not.toContain('<b>')
    expect(screen.queryByRole('dialog', { name: '投票' })).toBeNull()
  })

  it('没有 createVote 时隐藏按钮', () => {
    renderExtension([csdnVoteExtension], extensionCtx(), [['csdn:vote']])
    expect(screen.queryByRole('button', { name: '投票' })).toBeNull()
  })
})
```

Do not import `@editorx/markdown-core` from `packages/csdn-extensions`. The round-trip assertions are the `utils.test.ts` and `mount-editor.test.ts` cases above.

Also append this test to `packages/markdown-core/src/utils/utils.test.ts` so a rendered card still round-trips after the reader change:

```ts
  it('round-trips a vote card rendered with data-ex-payload', () => {
    const renderer = createRenderer({
      embeds: [{ type: 'vote', renderHtml: () => '<p>vote</p>' }],
    })
    const source = '```ex-embed:vote\n{\n  "id": "v1"\n}\n```'
    expect(htmlToMarkdown(renderer.render(source).html)).toBe(source)
  })
```

`createRenderer` is already imported in that file.

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/markdown-core exec vitest run src/utils/utils.test.ts
pnpm --filter @editorx/rich-text exec vitest run src/mount-editor.test.ts
pnpm --filter @editorx/csdn-extensions exec vitest run src/vote.test.tsx
```

Expected: FAIL. `htmlToMarkdown` of a `data-payload` div does not produce the fence (the body is empty). Rich text `getData()` does not contain `&quot;id&quot;`. `csdnVoteExtension` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `packages/markdown-core/src/utils/html-to-markdown.ts`, replace the embed branch inside `replaceExBlocks` so the source is chosen like this:

```ts
function embedSource(node: HTMLElement): string {
  if (node.hasAttribute('data-ex-payload')) return decode(node.getAttribute('data-ex-payload'))
  if (node.hasAttribute('data-payload')) return node.getAttribute('data-payload') ?? ''
  return ''
}
```

The existing line:

```ts
      ? [`ex-embed:${node.getAttribute('data-ex-embed') ?? ''}`, decode(node.getAttribute('data-ex-payload'))]
```

becomes:

```ts
      ? [`ex-embed:${node.getAttribute('data-ex-embed') ?? ''}`, embedSource(node)]
```

Do not change the diagram branch. Do not add a new attribute name.

In `packages/rich-text/src/embed-plugin.ts`, decode base64 locally. Do not import `@editorx/markdown-core`.

```ts
function decodePayload(value: string | undefined): string {
  if (!value) return ''
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return value
  }
}

function readPayload(viewElement: { getAttribute(name: string): string | undefined }): string {
  const raw = viewElement.getAttribute('data-payload')
  if (raw !== undefined) return raw
  return decodePayload(viewElement.getAttribute('data-ex-payload'))
}
```

In the upcast `model` callback, set `payload: readPayload(viewElement)` instead of `viewElement.getAttribute('data-payload') ?? ''`. Downcast stays `data-ex-embed` plus `data-payload`. Do not write `data-ex-payload` from rich text.

`packages/csdn-extensions/src/embed-html.ts`:

```ts
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}
```

`packages/csdn-extensions/src/vote.tsx`:

```tsx
import { formatMessage, type EditorExtension, type ExtensionContext, type VoteInput } from '@editorx/toolbar'
import { Button, Checkbox } from '@editorx/ui'
import { ListChecks } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { escapeHtml } from './embed-html'
import { ExtField, reportFailure } from './form'

const ICON = 16

interface VoteEmbed {
  id: string
  title: string
  options: string[]
  multiple: boolean
  deadline?: string
}

function voteHtml(payload: unknown): string {
  const data = payload as Partial<VoteEmbed>
  const title = escapeHtml(typeof data.title === 'string' ? data.title : '')
  const options = Array.isArray(data.options) ? data.options.filter((item): item is string => typeof item === 'string') : []
  const items = options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')
  return `<div class="ex-csdn-ext-card"><p class="ex-csdn-ext-card__title">投票</p><p>${title}</p><ul>${items}</ul></div>`
}

function VoteDialog({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const copy = ctx.locale.csdnExt
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [pending, setPending] = useState(false)
  const cleaned = options.map((option) => option.trim()).filter((option) => option !== '')
  const deadlineDate = deadline === '' ? null : new Date(deadline)
  const deadlineOk = deadline === '' || (deadlineDate !== null && !Number.isNaN(deadlineDate.getTime()))
  const canSubmit = title.trim() !== '' && cleaned.length >= 2 && deadlineOk && !pending

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    const createVote = ctx.adapters.createVote
    if (!createVote) return
    const input: VoteInput = { title: title.trim(), options: cleaned, multiple }
    if (deadlineDate) input.deadline = deadlineDate.toISOString()
    setPending(true)
    createVote(input).then(
      (result) => {
        const payload: VoteEmbed = { id: result.id, title: input.title, options: input.options, multiple: input.multiple }
        if (input.deadline) payload.deadline = input.deadline
        close()
        ctx.insertEmbed('vote', payload)
      },
      (error: unknown) => {
        setPending(false)
        reportFailure(ctx, copy.voteFailed, error)
      },
    )
  }

  return (
    <form className="ex-csdn-ext-dialog" onSubmit={submit}>
      <ExtField label={copy.voteTitle}>
        {(id) => (
          <input id={id} className="ex-csdn-ext-input" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
        )}
      </ExtField>
      {options.map((option, index) => (
        <ExtField key={index} label={formatMessage(copy.voteOption, { n: index + 1 })}>
          {(id) => (
            <input
              id={id}
              className="ex-csdn-ext-input"
              value={option}
              onChange={(event) => {
                const next = options.slice()
                next[index] = event.target.value
                setOptions(next)
              }}
            />
          )}
        </ExtField>
      ))}
      <Button type="button" variant="text" onClick={() => setOptions([...options, ''])}>
        {copy.voteAddOption}
      </Button>
      <Checkbox checked={multiple} onChange={setMultiple}>
        {copy.voteMultiple}
      </Checkbox>
      <ExtField label={copy.voteDeadline}>
        {(id) => (
          <input
            id={id}
            className="ex-csdn-ext-input"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="button" onClick={close}>
          {ctx.locale.dialog.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} loading={pending}>
          {ctx.locale.dialog.confirm}
        </Button>
      </div>
    </form>
  )
}

export const csdnVoteExtension: EditorExtension = {
  name: 'csdn:vote',
  requires: ['createVote'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:vote',
      title: (m) => m.csdnExt.vote,
      label: (m) => m.csdnExt.vote,
      icon: <ListChecks size={ICON} />,
      group: 'csdn',
      order: 10,
      width: 440,
      render: (ctx, close) => <VoteDialog ctx={ctx} close={close} />,
    },
  ],
  embeds: [{ type: 'vote', renderHtml: voteHtml }],
}
```

`packages/csdn-extensions/src/extensions.ts`:

```ts
import type { EditorExtension } from '@editorx/toolbar'
import { csdnTemplateExtension } from './template'
import { csdnVoteExtension } from './vote'

export const csdnExtensions: readonly EditorExtension[] = [csdnVoteExtension, csdnTemplateExtension]

export { csdnTemplateExtension, csdnVoteExtension }
```

Export `csdnVoteExtension` from `index.ts` as well.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/markdown-core exec vitest run src/utils/utils.test.ts
pnpm --filter @editorx/rich-text exec vitest run src/mount-editor.test.ts
pnpm --filter @editorx/csdn-extensions exec vitest run src/vote.test.tsx src/package.test.ts
```

Expected: PASS. `package.test.ts` still shows no dependency on markdown-core.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn-extensions/src/embed-html.ts packages/csdn-extensions/src/vote.tsx packages/csdn-extensions/src/vote.test.tsx packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/index.ts packages/markdown-core/src/utils/html-to-markdown.ts packages/markdown-core/src/utils/utils.test.ts packages/rich-text/src/embed-plugin.ts packages/rich-text/src/mount-editor.test.ts
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 插入可往返的投票嵌入

createVote 失败或选项不足时不写文档。富文本 data-payload 与 markdown data-ex-payload 互相认对方已经写出的属性。

EOF
)"
```

---

### Task 4: Video upload

**Files:**
- Create: `packages/csdn-extensions/src/video.tsx`
- Create: `packages/csdn-extensions/src/video.test.tsx`
- Modify: `packages/csdn-extensions/src/extensions.ts`
- Modify: `packages/csdn-extensions/src/index.ts`
- Test: `packages/csdn-extensions/src/video.test.tsx`

**Interfaces:**
- Consumes: `httpUrl`, `escapeHtml`, `reportFailure`, `uploadVideo?(file: File, onProgress?: (p: number) => void): Promise<{ url: string; cover?: string }>`.
- Produces: `csdnVideoExtension` named `csdn:video`, `requires: ['uploadVideo']`, toolbar id `csdn:video`, `title` and `label` `(m) => m.toolbar.video`, `group: 'csdn'`, `order: 20`. Embed type `video`. Payload `{ url: string; cover?: string }` and only after `httpUrl` accepts both. `csdnExtensions` also contains this extension.

- [ ] **Step 1: Write the failing test**

`packages/csdn-extensions/src/video.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnVideoExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })

async function pick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '视频' }))
  const input = document.querySelector('input.ex-csdn-ext-file')
  expect(input).not.toBeNull()
  await user.upload(input as HTMLInputElement, file)
}

describe('csdn:video', () => {
  it('上传失败、空地址、javascript 地址都不插入', async () => {
    const user = userEvent.setup()
    const rejected = vi.fn(async () => Promise.reject(new Error('太大')))
    const ctx = extensionCtx({ adapters: { uploadVideo: rejected } })
    const first = renderExtension([csdnVideoExtension], ctx, [['csdn:video']])
    await pick(user)
    expect(rejected).toHaveBeenCalledWith(file)
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('视频上传失败：太大', 'error')
    first.unmount()

    for (const url of ['', 'javascript:alert(1)']) {
      const uploadVideo = vi.fn(async () => ({ url }))
      const next = extensionCtx({ adapters: { uploadVideo } })
      const view = renderExtension([csdnVideoExtension], next, [['csdn:video']])
      await pick(user)
      expect(next.insertEmbed).not.toHaveBeenCalled()
      expect(next.notify).toHaveBeenCalledWith('视频地址需以 http:// 或 https:// 开头', 'error')
      view.unmount()
    }
  })

  it('封面不是 http(s) 时不插入；成功时插入 video 嵌入', async () => {
    const user = userEvent.setup()
    const badCover = extensionCtx({
      adapters: { uploadVideo: vi.fn(async () => ({ url: 'https://cdn.example/a.mp4', cover: 'javascript:alert(1)' })) },
    })
    const badView = renderExtension([csdnVideoExtension], badCover, [['csdn:video']])
    await pick(user)
    expect(badCover.insertEmbed).not.toHaveBeenCalled()
    expect(badCover.notify).toHaveBeenCalledWith('视频地址需以 http:// 或 https:// 开头', 'error')
    badView.unmount()

    const ok = extensionCtx({
      adapters: {
        uploadVideo: vi.fn(async () => ({ url: 'https://cdn.example/a.mp4', cover: 'https://cdn.example/a.jpg' })),
      },
    })
    renderExtension([csdnVideoExtension], ok, [['csdn:video']])
    await pick(user)
    expect(ok.insertEmbed).toHaveBeenCalledWith('video', {
      url: 'https://cdn.example/a.mp4',
      cover: 'https://cdn.example/a.jpg',
    })
    const html = csdnVideoExtension.embeds?.[0]?.renderHtml({
      url: 'https://cdn.example/a.mp4',
      cover: 'https://cdn.example/a.jpg',
    })
    expect(html).toContain('src="https://cdn.example/a.mp4"')
    expect(html).toContain('poster="https://cdn.example/a.jpg"')
    expect(csdnVideoExtension.embeds?.[0]?.renderHtml({ url: 'javascript:alert(1)' })).not.toContain('javascript:')
  })

  it('没有 uploadVideo 时隐藏', () => {
    renderExtension([csdnVideoExtension], extensionCtx(), [['csdn:video']])
    expect(screen.queryByRole('button', { name: '视频' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/video.test.tsx
```

Expected: FAIL with `csdnVideoExtension` not exported.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn-extensions/src/video.tsx`:

```tsx
import type { EditorExtension, ExtensionContext } from '@editorx/toolbar'
import { Video } from 'lucide-react'
import { escapeHtml, httpUrl } from './embed-html'
import { reportFailure } from './form'

const ICON = 16
const FILE_CLASS = 'ex-csdn-ext-file'

function videoHtml(payload: unknown): string {
  const data = payload as { url?: unknown; cover?: unknown }
  const url = httpUrl(data.url)
  if (!url) return '<div class="ex-csdn-ext-card"></div>'
  const cover = httpUrl(data.cover)
  const poster = cover ? ` poster="${escapeHtml(cover)}"` : ''
  return `<video src="${escapeHtml(url)}"${poster} controls></video>`
}

async function uploadVideoFile(ctx: ExtensionContext, file: File): Promise<void> {
  const uploadVideo = ctx.adapters.uploadVideo
  if (!uploadVideo) return
  try {
    const result = await uploadVideo(file)
    const url = httpUrl(result.url)
    if (!url) {
      ctx.notify(ctx.locale.csdnExt.videoBadUrl, 'error')
      return
    }
    if (result.cover !== undefined) {
      const cover = httpUrl(result.cover)
      if (!cover) {
        ctx.notify(ctx.locale.csdnExt.videoBadUrl, 'error')
        return
      }
      ctx.insertEmbed('video', { url, cover })
      return
    }
    ctx.insertEmbed('video', { url })
  } catch (error) {
    reportFailure(ctx, ctx.locale.csdnExt.videoFailed, error)
  }
}

export const csdnVideoExtension: EditorExtension = {
  name: 'csdn:video',
  requires: ['uploadVideo'],
  toolbar: [
    {
      type: 'button',
      id: 'csdn:video',
      title: (m) => m.toolbar.video,
      label: (m) => m.toolbar.video,
      icon: <Video size={ICON} />,
      group: 'csdn',
      order: 20,
      run(ctx) {
        document.querySelectorAll(`input.${FILE_CLASS}`).forEach((node) => node.remove())
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'video/*'
        input.className = FILE_CLASS
        input.hidden = true
        input.addEventListener('change', () => {
          const chosen = input.files?.[0]
          input.remove()
          if (chosen) void uploadVideoFile(ctx, chosen)
        })
        document.body.append(input)
        input.click()
      },
    },
  ],
  embeds: [{ type: 'video', renderHtml: videoHtml }],
}
```

Add `csdnVideoExtension` to `csdnExtensions` and to the `index.ts` exports. Leave `csdn:template` and `csdn:vote` in the array.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/video.test.tsx src/package.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn-extensions/src/video.tsx packages/csdn-extensions/src/video.test.tsx packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/index.ts
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 上传视频失败时不插入嵌入

空地址和 javascript 地址同样只提示。成功才把 http(s) 地址交给 insertEmbed。

EOF
)"
```

---

### Task 5: Resource binding

**Files:**
- Create: `packages/csdn-extensions/src/resource.tsx`
- Create: `packages/csdn-extensions/src/resource.test.tsx`
- Modify: `packages/csdn-extensions/src/extensions.ts`
- Modify: `packages/csdn-extensions/src/index.ts`
- Test: `packages/csdn-extensions/src/resource.test.tsx`

**Interfaces:**
- Consumes: `httpUrl`, `escapeHtml`, `reportFailure`, `searchResources?(keyword: string): Promise<Resource[]>`, `Resource` fields `id`, `title`, `url`, `description?`.
- Produces: `csdnResourceExtension` named `csdn:resource`, `requires: ['searchResources']`, toolbar id `csdn:resource`, `title` and `label` `(m) => m.toolbar.resource`, `group: 'csdn'`, `order: 30`. Embed type `resource`. Payload is the chosen `Resource`. A non-http(s) `url` is not inserted.

- [ ] **Step 1: Write the failing test**

`packages/csdn-extensions/src/resource.test.tsx`:

```tsx
import type { Resource } from '@editorx/toolbar'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnResourceExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

const good: Resource = { id: 'r1', title: '手册', url: 'https://cdn.example/a', description: '说明' }
const bad: Resource = { id: 'r2', title: '坏链', url: 'javascript:alert(1)' }

describe('csdn:resource', () => {
  it('搜索失败不插入；javascript 结果点了也不插入', async () => {
    const user = userEvent.setup()
    const searchResources = vi.fn(async () => Promise.reject(new Error('超时')))
    const ctx = extensionCtx({ adapters: { searchResources } })
    const first = renderExtension([csdnResourceExtension], ctx, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const dialog = await screen.findByRole('dialog', { name: '资源绑定' })
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '手册')
    await user.click(within(dialog).getByRole('button', { name: '搜索' }))
    expect(searchResources).toHaveBeenCalledWith('手册')
    expect(ctx.notify).toHaveBeenCalledWith('搜索资源失败：超时', 'error')
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    first.unmount()

    const listed = extensionCtx({
      adapters: { searchResources: vi.fn(async () => [bad, good]) },
    })
    renderExtension([csdnResourceExtension], listed, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const next = await screen.findByRole('dialog', { name: '资源绑定' })
    await user.type(within(next).getByRole('textbox', { name: '搜索资源' }), '手册')
    await user.click(within(next).getByRole('button', { name: '搜索' }))
    await user.click(await within(next).findByRole('button', { name: '坏链' }))
    expect(listed.insertEmbed).not.toHaveBeenCalled()
    expect(listed.notify).toHaveBeenCalledWith('资源地址需以 http:// 或 https:// 开头', 'error')
    expect(screen.getByRole('dialog', { name: '资源绑定' })).toBeInTheDocument()
  })

  it('选中 http 资源后插入并关闭', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({
      adapters: { searchResources: vi.fn(async () => [good]) },
    })
    renderExtension([csdnResourceExtension], ctx, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const dialog = await screen.findByRole('dialog', { name: '资源绑定' })
    expect(within(dialog).getByRole('button', { name: '搜索' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '  ')
    expect(within(dialog).getByRole('button', { name: '搜索' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '手册')
    await user.click(within(dialog).getByRole('button', { name: '搜索' }))
    await user.click(await within(dialog).findByRole('button', { name: '手册' }))
    expect(ctx.insertEmbed).toHaveBeenCalledWith('resource', good)
    expect(screen.queryByRole('dialog', { name: '资源绑定' })).toBeNull()
    const html = csdnResourceExtension.embeds?.[0]?.renderHtml(good)
    expect(html).toContain('href="https://cdn.example/a"')
    expect(html).toContain('手册')
    expect(csdnResourceExtension.embeds?.[0]?.renderHtml(bad)).not.toContain('javascript:')
  })

  it('没有结果时提示，没有 searchResources 时隐藏', async () => {
    const user = userEvent.setup()
    const ctx = extensionCtx({ adapters: { searchResources: async () => [] } })
    const view = renderExtension([csdnResourceExtension], ctx, [['csdn:resource']])
    await user.click(screen.getByRole('button', { name: '资源绑定' }))
    const dialog = await screen.findByRole('dialog', { name: '资源绑定' })
    await user.type(within(dialog).getByRole('textbox', { name: '搜索资源' }), '无')
    await user.click(within(dialog).getByRole('button', { name: '搜索' }))
    expect(await within(dialog).findByText('没有匹配的资源')).toBeInTheDocument()
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    view.unmount()
    renderExtension([csdnResourceExtension], extensionCtx(), [['csdn:resource']])
    expect(screen.queryByRole('button', { name: '资源绑定' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/resource.test.tsx
```

Expected: FAIL with `csdnResourceExtension` not exported.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn-extensions/src/resource.tsx`:

```tsx
import type { EditorExtension, ExtensionContext, Resource } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { Link2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { escapeHtml, httpUrl } from './embed-html'
import { ExtField, reportFailure } from './form'

const ICON = 16

function resourceHtml(payload: unknown): string {
  const data = payload as Partial<Resource>
  const href = httpUrl(data.url)
  const title = escapeHtml(typeof data.title === 'string' ? data.title : '')
  const description = escapeHtml(typeof data.description === 'string' ? data.description : '')
  if (!href) return `<div class="ex-csdn-ext-card"><p>${title}</p></div>`
  return `<div class="ex-csdn-ext-card"><a href="${escapeHtml(href)}">${title}</a><p>${description}</p></div>`
}

function ResourceDialog({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const copy = ctx.locale.csdnExt
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Resource[] | null>(null)
  const [pending, setPending] = useState(false)
  const query = keyword.trim()

  const search = (event: FormEvent) => {
    event.preventDefault()
    const searchResources = ctx.adapters.searchResources
    if (!searchResources || query === '' || pending) return
    setPending(true)
    searchResources(query).then(
      (list) => {
        setPending(false)
        setResults(list)
      },
      (error: unknown) => {
        setPending(false)
        setResults([])
        reportFailure(ctx, copy.resourceFailed, error)
      },
    )
  }

  const choose = (resource: Resource) => {
    if (!httpUrl(resource.url)) {
      ctx.notify(copy.resourceBadUrl, 'error')
      return
    }
    close()
    ctx.insertEmbed('resource', resource)
  }

  return (
    <form className="ex-csdn-ext-dialog" onSubmit={search}>
      <ExtField label={copy.resourceKeyword}>
        {(id) => (
          <input
            id={id}
            className="ex-csdn-ext-input"
            autoFocus
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="submit" variant="primary" disabled={query === '' || pending} loading={pending}>
          {copy.resourceSearch}
        </Button>
      </div>
      {results && results.length === 0 ? <p className="ex-csdn-ext-muted">{copy.resourceEmpty}</p> : null}
      {results && results.length > 0 ? (
        <ul className="ex-csdn-ext-list">
          {results.map((resource) => (
            <li key={resource.id}>
              <Button type="button" variant="text" onClick={() => choose(resource)}>
                {resource.title}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}

export const csdnResourceExtension: EditorExtension = {
  name: 'csdn:resource',
  requires: ['searchResources'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:resource',
      title: (m) => m.toolbar.resource,
      label: (m) => m.toolbar.resource,
      icon: <Link2 size={ICON} />,
      group: 'csdn',
      order: 30,
      width: 440,
      render: (ctx, close) => <ResourceDialog ctx={ctx} close={close} />,
    },
  ],
  embeds: [{ type: 'resource', renderHtml: resourceHtml }],
}
```

Add it to `csdnExtensions` and `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/resource.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn-extensions/src/resource.tsx packages/csdn-extensions/src/resource.test.tsx packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/index.ts
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 搜索资源后插入选中的一条

搜索失败和 javascript 地址只提示。空白关键字不能发起搜索。

EOF
)"
```

---

### Task 6: InsCode

**Files:**
- Create: `packages/csdn-extensions/src/inscode.tsx`
- Create: `packages/csdn-extensions/src/inscode.test.tsx`
- Modify: `packages/csdn-extensions/src/extensions.ts`
- Modify: `packages/csdn-extensions/src/index.ts`
- Test: `packages/csdn-extensions/src/inscode.test.tsx`

**Interfaces:**
- Consumes: `httpUrl`, `escapeHtml`, `reportFailure`, `runCode?(lang: string, code: string): Promise<{ url: string }>`.
- Produces: `csdnInscodeExtension` named `csdn:inscode`, `requires: ['runCode']`, toolbar id `csdn:inscode`, `title` and `label` `(m) => m.csdnExt.inscode`, `group: 'csdn'`, `order: 40`. Embed type `inscode`. Payload `{ url, lang }`. Failure or a non-http(s) url does not insert.

- [ ] **Step 1: Write the failing test**

`packages/csdn-extensions/src/inscode.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnInscodeExtension } from './index'
import { extensionCtx, renderExtension } from './test-harness'

async function fill(user: ReturnType<typeof userEvent.setup>, code = 'console.log(1)') {
  await user.click(screen.getByRole('button', { name: 'InsCode' }))
  const dialog = await screen.findByRole('dialog', { name: 'InsCode' })
  await user.clear(within(dialog).getByRole('textbox', { name: '语言' }))
  await user.type(within(dialog).getByRole('textbox', { name: '语言' }), 'javascript')
  await user.type(within(dialog).getByRole('textbox', { name: '代码' }), code)
  return dialog
}

describe('csdn:inscode', () => {
  it('空白代码不能提交；运行失败不插入', async () => {
    const user = userEvent.setup()
    const runCode = vi.fn(async () => Promise.reject(new Error('编译失败')))
    const ctx = extensionCtx({ adapters: { runCode } })
    renderExtension([csdnInscodeExtension], ctx, [['csdn:inscode']])
    await user.click(screen.getByRole('button', { name: 'InsCode' }))
    const dialog = await screen.findByRole('dialog', { name: 'InsCode' })
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: '代码' }), '   ')
    expect(within(dialog).getByRole('button', { name: '确定' })).toBeDisabled()
    await user.clear(within(dialog).getByRole('textbox', { name: '语言' }))
    await user.type(within(dialog).getByRole('textbox', { name: '语言' }), 'javascript')
    await user.clear(within(dialog).getByRole('textbox', { name: '代码' }))
    await user.type(within(dialog).getByRole('textbox', { name: '代码' }), 'console.log(1)')
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(runCode).toHaveBeenCalledWith('javascript', 'console.log(1)')
    expect(ctx.insertEmbed).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('运行代码失败：编译失败', 'error')
    expect(screen.getByRole('dialog', { name: 'InsCode' })).toBeInTheDocument()
  })

  it('javascript 结果不插入；http 结果插入 inscode 嵌入', async () => {
    const user = userEvent.setup()
    const bad = extensionCtx({
      adapters: { runCode: vi.fn(async () => ({ url: 'javascript:alert(1)' })) },
    })
    const badView = renderExtension([csdnInscodeExtension], bad, [['csdn:inscode']])
    const badDialog = await fill(user)
    await user.click(within(badDialog).getByRole('button', { name: '确定' }))
    expect(bad.insertEmbed).not.toHaveBeenCalled()
    expect(bad.notify).toHaveBeenCalledWith('运行结果地址需以 http:// 或 https:// 开头', 'error')
    badView.unmount()

    const ok = extensionCtx({
      adapters: { runCode: vi.fn(async () => ({ url: 'https://inscode.example/run' })) },
    })
    renderExtension([csdnInscodeExtension], ok, [['csdn:inscode']])
    const dialog = await fill(user)
    await user.click(within(dialog).getByRole('button', { name: '确定' }))
    expect(ok.insertEmbed).toHaveBeenCalledWith('inscode', { url: 'https://inscode.example/run', lang: 'javascript' })
    expect(screen.queryByRole('dialog', { name: 'InsCode' })).toBeNull()
    const html = csdnInscodeExtension.embeds?.[0]?.renderHtml({ url: 'https://inscode.example/run', lang: 'javascript' })
    expect(html).toContain('href="https://inscode.example/run"')
    expect(csdnInscodeExtension.embeds?.[0]?.renderHtml({ url: 'javascript:alert(1)', lang: 'javascript' })).not.toContain(
      'javascript:',
    )
  })

  it('没有 runCode 时隐藏', () => {
    renderExtension([csdnInscodeExtension], extensionCtx(), [['csdn:inscode']])
    expect(screen.queryByRole('button', { name: 'InsCode' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/inscode.test.tsx
```

Expected: FAIL with `csdnInscodeExtension` not exported.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn-extensions/src/inscode.tsx`:

```tsx
import type { EditorExtension, ExtensionContext } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { SquareCode } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { escapeHtml, httpUrl } from './embed-html'
import { ExtField, reportFailure } from './form'

const ICON = 16

function inscodeHtml(payload: unknown): string {
  const data = payload as { url?: unknown; lang?: unknown }
  const href = httpUrl(data.url)
  const lang = escapeHtml(typeof data.lang === 'string' ? data.lang : '')
  if (!href) return `<div class="ex-csdn-ext-card"><p>${lang}</p></div>`
  return `<div class="ex-csdn-ext-card"><a href="${escapeHtml(href)}">${lang || 'InsCode'}</a></div>`
}

function InsCodeDialog({ ctx, close }: { ctx: ExtensionContext; close: () => void }) {
  const copy = ctx.locale.csdnExt
  const [lang, setLang] = useState('javascript')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const canSubmit = lang.trim() !== '' && code.trim() !== '' && !pending

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const runCode = ctx.adapters.runCode
    if (!runCode || !canSubmit) return
    const language = lang.trim()
    const source = code.trim()
    setPending(true)
    runCode(language, source).then(
      (result) => {
        const url = httpUrl(result.url)
        if (!url) {
          setPending(false)
          ctx.notify(copy.inscodeBadUrl, 'error')
          return
        }
        close()
        ctx.insertEmbed('inscode', { url, lang: language })
      },
      (error: unknown) => {
        setPending(false)
        reportFailure(ctx, copy.inscodeFailed, error)
      },
    )
  }

  return (
    <form className="ex-csdn-ext-dialog" onSubmit={submit}>
      <ExtField label={copy.inscodeLang}>
        {(id) => (
          <input id={id} className="ex-csdn-ext-input" value={lang} onChange={(event) => setLang(event.target.value)} />
        )}
      </ExtField>
      <ExtField label={copy.inscodeCode}>
        {(id) => (
          <textarea id={id} className="ex-csdn-ext-area" value={code} onChange={(event) => setCode(event.target.value)} />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="button" onClick={close}>
          {ctx.locale.dialog.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} loading={pending}>
          {ctx.locale.dialog.confirm}
        </Button>
      </div>
    </form>
  )
}

export const csdnInscodeExtension: EditorExtension = {
  name: 'csdn:inscode',
  requires: ['runCode'],
  toolbar: [
    {
      type: 'modal',
      id: 'csdn:inscode',
      title: (m) => m.csdnExt.inscode,
      label: (m) => m.csdnExt.inscode,
      icon: <SquareCode size={ICON} />,
      group: 'csdn',
      order: 40,
      width: 520,
      render: (ctx, close) => <InsCodeDialog ctx={ctx} close={close} />,
    },
  ],
  embeds: [{ type: 'inscode', renderHtml: inscodeHtml }],
}
```

The language field's initial value is `javascript`, so `确定` stays disabled until the code textarea is non-blank after trim. Clearing the language field also disables it. Add the export to `extensions.ts` and `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/inscode.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn-extensions/src/inscode.tsx packages/csdn-extensions/src/inscode.test.tsx packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/index.ts
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 用 runCode 插入 InsCode 地址

运行失败或结果不是 http(s) 时不插入。空白代码不能提交。

EOF
)"
```

---

### Task 7: AI panel

**Files:**
- Create: `packages/csdn-extensions/src/ai.tsx`
- Create: `packages/csdn-extensions/src/ai.test.tsx`
- Create: `packages/csdn-extensions/src/list.test.ts`
- Modify: `packages/csdn-extensions/src/extensions.ts`
- Modify: `packages/csdn-extensions/src/index.ts`
- Test: `packages/csdn-extensions/src/ai.test.tsx`, `packages/csdn-extensions/src/list.test.ts`

**Interfaces:**
- Consumes: `reportFailure`, `resolvePanels`, `aiAssist?(prompt: string, ctx: { selection: string; document: EditorDocument }): AsyncIterable<string>`.
- Produces: `csdnAiExtension` named `csdn:ai`, `requires: ['aiAssist']`, panel id `csdn:ai`, `title: (m) => m.csdnExt.ai`, `position: 'right'`, `order: 10`. No toolbar item. `csdnExtensions` order is `csdn:ai`, `csdn:vote`, `csdn:video`, `csdn:resource`, `csdn:inscode`, `csdn:template`. None of them set `editors`. Names `csdn:history` and `csdn:switch-editor` are absent.

- [ ] **Step 1: Write the failing test**

`packages/csdn-extensions/src/ai.test.tsx`:

```tsx
import { resolvePanels } from '@editorx/toolbar'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { csdnAiExtension } from './index'
import { extensionCtx, renderStrict } from './test-harness'

describe('csdn:ai', () => {
  it('缺少 aiAssist 时两种编辑器和两种策略都没有面板', () => {
    for (const editorType of ['markdown', 'richtext'] as const) {
      for (const missingAdapter of ['hide', 'disable'] as const) {
        expect(resolvePanels([csdnAiExtension], { editorType, adapters: {}, missingAdapter })).toEqual([])
      }
    }
  })

  it('流在第一段之后抛错时保留已生成，并且不调用 fetch', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    async function* stream() {
      yield '已生成'
      throw new Error('断开')
    }
    const aiAssist = vi.fn(() => stream())
    const ctx = extensionCtx({
      getSelectionText: () => '选中',
      getDocument: () => ({ editorType: 'markdown', title: '题', markdown: '正文', html: '<p>正文</p>' }),
      adapters: { aiAssist },
    })
    const panel = csdnAiExtension.panels?.[0]
    expect(panel?.id).toBe('csdn:ai')
    renderStrict(<>{panel?.render(ctx)}</>)
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }), '你好')
    await user.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByText('已生成')).toBeInTheDocument()
    expect(ctx.notify).toHaveBeenCalledWith('生成中断：断开', 'error')
    expect(screen.getByText('已生成')).toBeInTheDocument()
    expect(aiAssist).toHaveBeenCalledWith('你好', {
      selection: '选中',
      document: { editorType: 'markdown', title: '题', markdown: '正文', html: '<p>正文</p>' },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('按顺序拼接多段，空白提示不能发送', async () => {
    const user = userEvent.setup()
    async function* stream() {
      yield '甲'
      yield '乙'
    }
    const ctx = extensionCtx({ adapters: { aiAssist: vi.fn(() => stream()) } })
    const panel = csdnAiExtension.panels?.[0]
    renderStrict(<>{panel?.render(ctx)}</>)
    await user.type(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }), '   ')
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
    await user.clear(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }))
    await user.type(screen.getByRole('textbox', { name: '告诉 AI 你想写什么' }), '写一段')
    await user.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByText('甲乙')).toBeInTheDocument()
    expect(ctx.notify).not.toHaveBeenCalled()
  })
})
```

`packages/csdn-extensions/src/list.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { csdnExtensions } from './index'

describe('csdnExtensions', () => {
  it('按规格顺序导出六项，不含历史和切换编辑器', () => {
    expect(csdnExtensions.map((ext) => ext.name)).toEqual([
      'csdn:ai',
      'csdn:vote',
      'csdn:video',
      'csdn:resource',
      'csdn:inscode',
      'csdn:template',
    ])
    for (const ext of csdnExtensions) expect(ext.editors).toBeUndefined()
    const names = csdnExtensions.map((ext) => ext.name)
    expect(names).not.toContain('csdn:history')
    expect(names).not.toContain('csdn:switch-editor')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/ai.test.tsx src/list.test.ts
```

Expected: FAIL. `csdnAiExtension` is missing, and the name list is not the six-item order.

- [ ] **Step 3: Write minimal implementation**

`packages/csdn-extensions/src/ai.tsx`:

```tsx
import type { EditorExtension, ExtensionContext } from '@editorx/toolbar'
import { Button } from '@editorx/ui'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ExtField, reportFailure } from './form'

function AiPanel({ ctx }: { ctx: ExtensionContext }) {
  const copy = ctx.locale.csdnExt
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const send = () => {
    const text = prompt.trim()
    const aiAssist = ctx.adapters.aiAssist
    if (!text || !aiAssist || running) return
    setRunning(true)
    setOutput('')
    void (async () => {
      try {
        const stream = aiAssist(text, { selection: ctx.getSelectionText(), document: ctx.getDocument() })
        for await (const chunk of stream) {
          if (!alive.current) return
          setOutput((prev) => prev + chunk)
        }
      } catch (error) {
        if (!alive.current) return
        reportFailure(ctx, copy.aiPartial, error)
      } finally {
        if (alive.current) setRunning(false)
      }
    })()
  }

  return (
    <div className="ex-csdn-ext-dialog">
      <ExtField label={copy.aiPrompt}>
        {(id) => (
          <textarea id={id} className="ex-csdn-ext-area" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        )}
      </ExtField>
      <div className="ex-csdn-ext-actions">
        <Button type="button" variant="primary" disabled={prompt.trim() === '' || running} loading={running} onClick={send}>
          {copy.aiSend}
        </Button>
      </div>
      <p className="ex-csdn-ext-output" aria-label={copy.aiOutput}>
        {output}
      </p>
    </div>
  )
}

export const csdnAiExtension: EditorExtension = {
  name: 'csdn:ai',
  requires: ['aiAssist'],
  panels: [
    {
      id: 'csdn:ai',
      title: (m) => m.csdnExt.ai,
      icon: <Sparkles size={20} />,
      position: 'right',
      order: 10,
      render: (ctx) => <AiPanel ctx={ctx} />,
    },
  ],
}
```

The effect sets `alive.current = true` and clears it on cleanup. It does not call `setState`. StrictMode runs the cleanup between the two setups, so the ref must be set back to `true` or the first streamed chunk is dropped. The panel does not call `fetch`.

`packages/csdn-extensions/src/extensions.ts`:

```ts
import type { EditorExtension } from '@editorx/toolbar'
import { csdnAiExtension } from './ai'
import { csdnInscodeExtension } from './inscode'
import { csdnResourceExtension } from './resource'
import { csdnTemplateExtension } from './template'
import { csdnVideoExtension } from './video'
import { csdnVoteExtension } from './vote'

export const csdnExtensions: readonly EditorExtension[] = [
  csdnAiExtension,
  csdnVoteExtension,
  csdnVideoExtension,
  csdnResourceExtension,
  csdnInscodeExtension,
  csdnTemplateExtension,
]

export {
  csdnAiExtension,
  csdnInscodeExtension,
  csdnResourceExtension,
  csdnTemplateExtension,
  csdnVideoExtension,
  csdnVoteExtension,
}
```

`index.ts` re-exports that same list.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/ai.test.tsx src/list.test.ts src/package.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn-extensions/src/ai.tsx packages/csdn-extensions/src/ai.test.tsx packages/csdn-extensions/src/list.test.ts packages/csdn-extensions/src/extensions.ts packages/csdn-extensions/src/index.ts
git commit -m "$(cat <<'EOF'
feat(csdn-extensions): 把 aiAssist 的流写进 AI 面板

没有 adapter 时面板隐藏，包括 disable。中途失败留下已收到的文字，扩展自己不请求网络。

EOF
)"
```

---

### Task 8: `CsdnEditor` default and `/csdn` wiring

**Files:**
- Modify: `packages/csdn/package.json`
- Modify: `packages/csdn/tsup.config.ts`
- Modify: `packages/csdn/src/csdn-editor.tsx`
- Modify: `packages/csdn/src/index.ts`
- Modify: `packages/csdn/src/package.test.ts`
- Create: `packages/csdn/src/extensions-default.test.tsx`
- Modify: `packages/rich-text/src/layout.ts`
- Modify: `packages/rich-text/src/layout.test.ts`
- Modify: `apps/playground/package.json`
- Modify: `apps/playground/app/layout.tsx`
- Modify: `apps/playground/app/csdn/csdn-playground.tsx`
- Test: `packages/csdn/src/extensions-default.test.tsx`, `packages/csdn/src/package.test.ts`, `packages/rich-text/src/layout.test.ts`

**Interfaces:**
- Consumes: `csdnExtensions` from Task 7. `CsdnEditorShell` currently sets `extensions = NO_EXTENSIONS` and does not pass `adapters` to `MarkdownEditor` or `RichTextEditor`. `RICH_TEXT_TOOLBAR_LAYOUT` already names `csdn:resource`, `csdn:video`, and `csdn:template`. Markdown `MARKDOWN_TOOLBAR_LAYOUT` ends with `'*'`, so `group: 'csdn'` buttons show there without an edit. `csdnHistoryExtension` in `stand-in-extensions.tsx` still toasts `阶段 7 接入` and is `editors: ['richtext']`. `csdnHistoryExtension` in `csdn-demo-extensions.tsx` is disabled, labeled `历史版本`, `editors: ['markdown']`. `csdnMarketingExtension` stays on the markdown playground list only.
- Produces: omitted `extensions` equals `csdnExtensions`. `extensions={[]}` is empty. Both editors receive `adapters={adapters}`. Rich-text layout gains `['csdn:vote', 'csdn:inscode']` immediately before `['csdn:switch-editor']`. `/csdn` passes the package list plus the history stand-in. It does not pass `csdnSwitchEditorExtension`. `/markdown` and `/rich-text` are unchanged.

- [ ] **Step 1: Write the failing test**

Append to the test in `packages/csdn/src/package.test.ts`:

```ts
    expect(csdn.dependencies?.['@editorx/csdn-extensions']).toBe('workspace:*')
    expect(JSON.stringify(rich)).not.toContain('@editorx/csdn-extensions')
    expect(JSON.stringify(readJson('../../markdown/package.json'))).not.toContain('@editorx/csdn-extensions')
```

`packages/csdn/src/extensions-default.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CsdnEditor } from './csdn-editor'

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('ex-toolbar__group') ? 180 : 0
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('ex-toolbar') ? 1400 : 0
  })
})

describe('CsdnEditor 默认扩展', () => {
  it('省略 extensions 时能看见模版，空数组则没有', async () => {
    const getTemplates = vi.fn(async () => [{ id: 'weekly', name: '周报', markdown: '# 周报' }])
    const view = render(
      <StrictMode>
        <CsdnEditor adapters={{ getTemplates }} />
      </StrictMode>,
    )
    expect(await screen.findByRole('button', { name: '模版' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '历史' })).toBeNull()
    expect(screen.queryByRole('button', { name: '历史版本' })).toBeNull()
    expect(screen.queryByRole('button', { name: '使用 MD 编辑器' })).toBeNull()
    view.rerender(
      <StrictMode>
        <CsdnEditor adapters={{ getTemplates }} extensions={[]} />
      </StrictMode>,
    )
    expect(screen.queryByRole('button', { name: '模版' })).toBeNull()
  })

  it('富文本把 aiAssist 交给面板；没有 adapter 时面板不出现', async () => {
    async function* stream() {
      yield '已生成'
    }
    const withAi = render(
      <StrictMode>
        <CsdnEditor defaultEditor="richtext" adapters={{ aiAssist: () => stream() }} />
      </StrictMode>,
    )
    expect(await screen.findByRole('textbox', { name: '告诉 AI 你想写什么' })).toBeInTheDocument()
    withAi.unmount()
    render(
      <StrictMode>
        <CsdnEditor defaultEditor="richtext" />
      </StrictMode>,
    )
    expect(screen.queryByRole('textbox', { name: '告诉 AI 你想写什么' })).toBeNull()
  })

  it('切换编辑器仍打开外壳对话框，不提示阶段 6', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <CsdnEditor />
      </StrictMode>,
    )
    await user.click(screen.getByRole('button', { name: '切换编辑器' }))
    expect(await screen.findByRole('dialog', { name: '切换编辑器' })).toBeInTheDocument()
    expect(screen.queryByText('阶段 6 接入')).toBeNull()
  })
})
```

Replace the expected array in `packages/rich-text/src/layout.test.ts` with:

```ts
    expect(RICH_TEXT_TOOLBAR_LAYOUT).toEqual([
      ['undo', 'redo', 'csdn:history'],
      ['format', 'bold', 'color', 'background', 'other'],
      ['list', 'align', 'hr', 'quote'],
      ['code', 'csdn:resource', 'table'],
      ['image', 'csdn:video', 'math', 'link', 'csdn:template', 'toc', 'wide'],
      ['csdn:vote', 'csdn:inscode'],
      ['csdn:switch-editor'],
    ])
```

Change that test's title to `参考图分组顺序不变，投票和 InsCode 单独成组`.

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/package.test.ts src/extensions-default.test.tsx
pnpm --filter @editorx/rich-text exec vitest run src/layout.test.ts
```

Expected: FAIL. `package.json` has no `@editorx/csdn-extensions`. The default editor does not show `模版`. The layout array does not contain `csdn:vote`.

- [ ] **Step 3: Write minimal implementation**

Add `"@editorx/csdn-extensions": "workspace:*"` to `dependencies` and `devDependencies` in `packages/csdn/package.json`. Add the same dependency to `apps/playground/package.json` `dependencies`.

Add `'@editorx/csdn-extensions'` to the `external` array in `packages/csdn/tsup.config.ts`.

In `packages/csdn/src/index.ts`, add:

```ts
import '@editorx/csdn-extensions/styles.css'
```

In `packages/csdn/src/csdn-editor.tsx`:

```ts
import { csdnExtensions } from '@editorx/csdn-extensions'
```

Delete `const NO_EXTENSIONS`. Change the shell default to `extensions = csdnExtensions`. Pass `adapters={adapters}` to both `MarkdownEditor` and `RichTextEditor`. Do not pass the publish-panel wrapper that replaces `onSaveDraft`. Do not add a `missingAdapter` prop.

In `packages/rich-text/src/layout.ts`, insert `['csdn:vote', 'csdn:inscode']` before `['csdn:switch-editor']`. Do not import this package.

In `apps/playground/app/layout.tsx`, add `import '@editorx/csdn-extensions/styles.css'` next to the other `@editorx/*/styles.css` imports.

Replace the extension wiring in `apps/playground/app/csdn/csdn-playground.tsx`. Keep `createPublishAdapters` and spread the six adapters beside it. Do not edit `apps/playground/app/markdown/csdn-demo-extensions.tsx` or `apps/playground/app/rich-text/stand-in-extensions.tsx`.

```tsx
import { csdnExtensions } from '@editorx/csdn-extensions'
import type { EditorExtension, EditorType } from '@editorx/toolbar'
import { csdnHistoryExtension as markdownHistory, csdnMarketingExtension } from '../markdown/csdn-demo-extensions'
import { csdnHistoryExtension as richHistory } from '../rich-text/stand-in-extensions'

const markdownExtensions: readonly EditorExtension[] = [...csdnExtensions, markdownHistory, csdnMarketingExtension]
const richTextExtensions: readonly EditorExtension[] = [...csdnExtensions, richHistory]
```

Remove the local `richTextExtensions` that listed the toast stand-ins. Pass `extensions={editorType === 'richtext' ? richTextExtensions : markdownExtensions}`.

Build `adapters` as the publish mock plus:

```tsx
async getTemplates() {
  return [
    { id: 'weekly', name: '周报模板', markdown: '# 本周工作\n\n- \n' },
    { id: 'card', name: '卡片模板', html: '<p>卡片</p>' },
  ]
},
async createVote(data: { title: string }) {
  return { id: `vote-${data.title}` }
},
async uploadVideo(file: File) {
  if (/fail/i.test(file.name)) throw new Error('模拟上传失败')
  return { url: 'https://cdn.example/video.mp4' }
},
async searchResources(keyword: string) {
  return [{ id: 'r1', title: `资源 ${keyword}`, url: 'https://cdn.example/res' }]
},
async runCode(lang: string) {
  return { url: `https://inscode.example/${encodeURIComponent(lang)}` }
},
async *aiAssist(prompt: string) {
  yield prompt.slice(0, 4)
  yield '已写完'
},
```

Do not call `fetch` in these functions. Do not copy the strings `阶段 7 接入` or `阶段 6 接入` into the package or into this mock.

If the test run cannot resolve `@editorx/csdn-extensions`, stop. The controller runs `pnpm install --offline` once. Then rerun Step 4.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn exec vitest run src/package.test.ts src/extensions-default.test.tsx
pnpm --filter @editorx/rich-text exec vitest run src/layout.test.ts
pnpm --filter @editorx/csdn-extensions exec vitest run src/package.test.ts
```

Expected: PASS. `模版` is visible only when the prop is omitted and `getTemplates` exists. The AI textbox is visible on rich text only when `aiAssist` exists. `阶段 6 接入` is absent.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add packages/csdn/package.json packages/csdn/tsup.config.ts packages/csdn/src/csdn-editor.tsx packages/csdn/src/index.ts packages/csdn/src/package.test.ts packages/csdn/src/extensions-default.test.tsx packages/rich-text/src/layout.ts packages/rich-text/src/layout.test.ts apps/playground/package.json apps/playground/app/layout.tsx apps/playground/app/csdn/csdn-playground.tsx pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(csdn): 默认挂上 csdn-extensions 并把 adapter 传进编辑器

省略 extensions 使用包里的六项，显式空数组保持为空。playground 的 /csdn 换掉六个占位，历史占位还在。

EOF
)"
```

If `pnpm-lock.yaml` did not change, omit it from `git add`.

---

### Task 9: Focused `/csdn` checks

**Files:**
- Modify: `apps/playground/e2e/csdn.spec.ts`
- Modify: `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-markdown-light-chromium-darwin.png` (darwin snapshot update only)
- Modify: `apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-richtext-light-chromium-darwin.png` (darwin snapshot update only)
- Test: `apps/playground/e2e/csdn.spec.ts`, `apps/playground/e2e/csdn-visual.spec.ts`

**Interfaces:**
- Consumes: `/csdn` markdown extensions include `csdn:template` and the disabled markdown history button `历史版本`. `/csdn?editor=richtext` includes the toast history button `历史` and the AI panel. `csdn-visual.spec.ts` already skips with `test.skip(process.platform !== 'darwin', '待 Windows 复测')`.
- Produces: an e2e assertion that `模版` replaces the markdown document with `本周工作`, and that rich text `历史` still toasts `阶段 7 接入`. No assertion looks for `阶段 6 接入`. Snapshot pixels may change because the AI panel and the extra vote / InsCode buttons are now real. No other spec's snapshots change.

- [ ] **Step 1: Write the failing test**

Append to `apps/playground/e2e/csdn.spec.ts`:

```ts
test('模板替换写入 Markdown，工具栏不提示阶段 6', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/csdn')
  await page.getByRole('button', { name: '模版' }).click()
  await page.getByRole('button', { name: '替换全文 周报模板' }).click()
  await expect(page.locator('.ex-mde-preview')).toContainText('本周工作')
  await expect(page.getByRole('status').filter({ hasText: '阶段 6 接入' })).toHaveCount(0)
  await page.goto('/csdn?editor=richtext')
  await page.getByRole('button', { name: '历史' }).click()
  await expect(page.getByRole('status').filter({ hasText: '阶段 7 接入' })).toBeVisible()
  await expect(page.getByRole('button', { name: '使用 MD 编辑器' })).toHaveCount(0)
  expect(errors).toEqual([])
})
```

Leave the existing history test in place. Do not edit `apps/playground/e2e/rich-text.spec.ts` or `apps/playground/e2e/reference-acceptance.spec.ts`.

- [ ] **Step 2: Run test to verify it fails**

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
export COREPACK_INTEGRITY_KEYS=0
pnpm build --force
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
pnpm --filter @editorx/playground exec playwright test e2e/csdn.spec.ts e2e/csdn-visual.spec.ts --project=chromium
```

Expected: FAIL on the new template assertion until the playground from Task 8 is what the server built. A failure in a spec other than these two files is not this task. On darwin, `csdn-visual.spec.ts` may also fail because the AI panel and toolbar pixels changed. On any other platform that spec is skipped with `待 Windows 复测`.

- [ ] **Step 3: Write minimal implementation**

Task 8 is the implementation. If the template assertion fails, fix `csdn-playground.tsx` so the weekly template markdown is `# 本周工作` and the button name is `替换全文 周报模板`. Do not weaken the assertion.

On darwin, after `e2e/csdn.spec.ts` passes, update only this spec's snapshots:

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/playground exec playwright test e2e/csdn-visual.spec.ts --project=chromium --update-snapshots
```

Do not pass any other spec file to `--update-snapshots`. Do not add or replace a win32 PNG. Do not download reference images.

- [ ] **Step 4: Run test to verify it passes**

```bash
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/playground exec playwright test e2e/csdn.spec.ts e2e/csdn-visual.spec.ts --project=chromium
lsof -ti tcp:3100 | xargs kill -9 2>/dev/null || true
```

Expected: PASS. `csdn-visual.spec.ts` passes on darwin and is skipped elsewhere with `待 Windows 复测`. `git status` shows no win32 PNG and no snapshot outside `csdn-visual.spec.ts-snapshots`.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add apps/playground/e2e/csdn.spec.ts apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-markdown-light-chromium-darwin.png apps/playground/e2e/csdn-visual.spec.ts-snapshots/csdn-richtext-light-chromium-darwin.png
git commit -m "$(cat <<'EOF'
test(playground): 核对 /csdn 的模板替换和历史占位

阶段 7 只改这两张 darwin 截图。历史仍提示阶段 7，切换编辑器不走工具栏占位。

EOF
)"
```

If a snapshot file was not modified, omit that path from `git add`.

---

### Task 10: Handoff note for phase 8

**Files:**
- Create: `docs/superpowers/handoff/phase8-notes-from-7.md`
- Modify: `docs/superpowers/handoff/RESUME.md`
- Create: `packages/csdn-extensions/src/handoff-contract.test.ts`
- Test: `packages/csdn-extensions/src/handoff-contract.test.ts`

**Interfaces:**
- Consumes: `csdnExtensions`, adapter forwarding, embed attributes `data-ex-payload` and `data-payload`, history stand-in, feedback tab left undone.
- Produces: a note phase 8 can read without re-auditing phase 7. `RESUME.md` phase 7 row points at `phase8-notes-from-7.md` and says `已完成`. Phase 8 stays `未开始`. The win32 filename list is unchanged.

- [ ] **Step 1: Write the failing test**

`packages/csdn-extensions/src/handoff-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('阶段 8 交接', () => {
  it('笔记写明六个扩展、adapter 和嵌入属性，RESUME 把阶段 8 留在未开始', () => {
    const note = readFileSync(new URL('../../../docs/superpowers/handoff/phase8-notes-from-7.md', import.meta.url), 'utf8')
    const resume = readFileSync(new URL('../../../docs/superpowers/handoff/RESUME.md', import.meta.url), 'utf8')
    for (const phrase of [
      'csdnExtensions',
      'aiAssist',
      'createVote',
      'uploadVideo',
      'searchResources',
      'runCode',
      'getTemplates',
      'data-ex-payload',
      'data-payload',
      '模版',
      'extensions={[]}',
      '反馈',
      '历史',
      '待 Windows 复测',
      '未开始',
    ]) {
      expect(note).toContain(phrase)
    }
    expect(resume).toContain('phase8-notes-from-7.md')
    expect(resume).toMatch(/\| 7 \|[\s\S]*已完成/)
    expect(resume).toMatch(/\| 8 \|[\s\S]*未开始/)
    expect(resume).toContain('markdown-dialog-link-light-chromium-win32.png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/handoff-contract.test.ts
```

Expected: FAIL. `phase8-notes-from-7.md` cannot be read.

- [ ] **Step 3: Write minimal implementation**

Write `docs/superpowers/handoff/phase8-notes-from-7.md` in Chinese. Fill the short git hash by running `git rev-parse --short HEAD` at commit time and pasting that value. Do not leave a blank.

```markdown
# 阶段 7 交给阶段 8 的笔记

阶段 7 代码 HEAD：`<short hash>`（分支 `develop`）。本笔记是其后的 docs(handoff) 提交。范围是 `@editorx/csdn-extensions`。阶段 8 做 Changesets、README 和 npm 发布时以本文为准。

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
```

In `docs/superpowers/handoff/RESUME.md`, replace:

```markdown
| 7–8 | csdn-extensions、发布准备 | 未开始 |
```

with:

```markdown
| 7 | `@editorx/csdn-extensions`：AI 助手、投票、视频、资源绑定、InsCode、模板 | 已完成（develop），见 `phase8-notes-from-7.md` |
| 8 | 发布准备：Changesets、文档/README、npm 发布流程 | 未开始 |
```

In the handoff-materials list, add a bullet:

```markdown
- `phase8-notes-from-7.md`：阶段 8 必读，含六个扩展、adapter 转发、嵌入属性和明确没做的反馈 tab。
```

Replace the final 「下一步」 paragraph with:

```markdown
## 下一步

阶段 8（Changesets、文档/README、npm 发布）：先读 `phase8-notes-from-7.md`。反馈 tab 和历史版本不在阶段 7 里，仍然没做。
```

Do not edit the stale win32 filename list. Do not mark phase 8 `已完成`.

- [ ] **Step 4: Run test to verify it passes**

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/csdn-extensions exec vitest run src/handoff-contract.test.ts
test "$(git branch --show-current)" = develop
git diff --check
```

Expected: PASS, and `git diff --check` prints nothing.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = develop
git add docs/superpowers/handoff/phase8-notes-from-7.md docs/superpowers/handoff/RESUME.md packages/csdn-extensions/src/handoff-contract.test.ts
git commit -m "$(cat <<'EOF'
docs(handoff): 记录阶段 7 交给阶段 8 的扩展约定

六个扩展仍走已有 adapter，嵌入沿用现有属性。反馈、历史和发布准备留在后面。

EOF
)"
```
