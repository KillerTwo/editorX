# Phase 8 Release Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Changesets, a root README, and a GitHub npm publish workflow, and prove the packages pack locally without sending them to a registry.

**Architecture:** Nine `@editorx/*` libraries stay publishable and version together from `0.0.0` to `0.1.0`. The repo root and `@editorx/playground` stay private. A local script runs `npm pack --dry-run --offline` only. `.github/workflows/release.yml` is the later human publish path and is not executed in this phase. Duplicate theme tokens become `var()` aliases of the tokens they already equal. `PublishBaseProps.templates` keeps its name. `@editorx/csdn` keeps `@editorx/rich-text` as a normal dependency. `MODAL_LAYER_CLASS`, `ModalLayer`, and `useModalLayerClass` leave the `@editorx/ui` public entry.

**Tech Stack:** pnpm `10.33.4`, Node `>=22`, Changesets CLI major 2, Vitest 5, `node --test` for repo-root checks, GitHub Actions `changesets/action@v1`. No new editor UI.

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md` (§3.1, §3.2, §10 item 8, §11). Binding notes: `docs/superpowers/handoff/phase8-notes-from-7.md`, `docs/superpowers/handoff/phase5-notes-from-4.md` section 「Phase 8 清单」, `docs/superpowers/handoff/RESUME.md` phase table only. Base: branch `develop`, HEAD `a5cf294`. Local `main` is the same SHA. There is no root `README.md` today. `@changesets/cli` is not in `pnpm-lock.yaml`.

## Global Constraints

- Spec §3.2, verbatim: pnpm workspace + Turborepo. tsup 构建：ESM + `.d.ts`，每包导出 `./styles.css`. 所有组件入口文件标注 `'use client'`；CKEditor、cledit 等仅在客户端懒加载. Vitest（单元/组件）、Playwright（E2E + 视觉回归）. Changesets 管理版本发布. 命名：npm scope `@editorx`，CSS 类前缀 `.ex-`，CSS 变量 `--ex-*`.
- Root `package.json`: `"private": true`, `"packageManager": "pnpm@10.33.4"`, `"engines.node": ">=22"`. `@editorx/playground` is `"private": true`.
- Branch `develop`. Every pnpm command is preceded by `export COREPACK_INTEGRITY_KEYS=0`. Package tests: `pnpm --filter @editorx/NAME exec vitest run <files>`. The `--` form does not narrow files. Repo-root checks that are not a package test use the exact `node --test` command in that task.
- Chinese Conventional Commits with a body, via HEREDOC. `git add` lists explicit paths. No `git add .` or `git add -A`. No push, merge, rebase, or amend.
- The implementer does not run `pnpm install` or `pnpm add`. Task 1 adds `"@changesets/cli": "^2"` to the root `devDependencies`. Major 2 is the Changesets CLI line whose current source leaves `workspace:*` and `workspace:^` unchanged and supports pnpm 10. The repo cannot pin a patch because the lockfile has no Changesets entry. The controller confirms the resolved version at the one install and commits `pnpm-lock.yaml` if that install changes it. The implementer does not commit the lockfile in Task 1.
- Do not run `npm publish`, `npm login`, or `changeset publish`. Do not point those commands at a registry. The deliverable is the workflow file plus `node scripts/release-dry-run.mjs`.
- Do not rename `PublishBaseProps.templates` to `articleTemplates`.
- The only CSS edit is the four aliases in `packages/theme/src/styles.css`. Hex stays only in that file. Do not change any other token value. Do not add hex, `rgb(`, `hsl(`, or `light-dark(` in new code.
- Do not generate or edit win32 PNGs. Do not edit `docs/superpowers/handoff/RESUME.md`, including its stale win32 filename list. Do not update e2e snapshots. No `playwright install`. Do not touch port 3100.
- Do not mark `@editorx/theme`, `@editorx/ui`, `@editorx/toolbar`, `@editorx/markdown-core`, `@editorx/markdown`, `@editorx/rich-text`, `@editorx/publish`, `@editorx/csdn-extensions`, or `@editorx/csdn` private. Root and `@editorx/playground` stay `"private": true`.
- Spec §3.1 says `csdn` 对 `rich-text` 声明为 optional peerDependency. That sentence is not what shipped. Keep `@editorx/rich-text` in `@editorx/csdn` `dependencies` at `workspace:*`. Do not add it to `peerDependencies` or `peerDependenciesMeta`.
- Do not call `fetch` from new code. Do not build the feedback tab, real history, or any editor behavior.
- Out of scope: a `LICENSE` file, renaming packages, and running the GitHub workflow.

## Review Focus

1. A person runs the documented dry-run and expects a local tarball listing, with no publish and no registry contact. `node scripts/release-dry-run.mjs npm publish` exits 1 before packing. The success path uses `npm pack --dry-run --json --ignore-scripts --offline` only. Pinned by Task 8 `scripts/release-workflow.test.mjs` (`拒绝把 npm publish 当成 dry-run`, `offline dry-run 打包九个 0.1.0 库`).
2. The four duplicate tokens stay equal to the colors they already have: `--ex-color-pub-option-modal` tracks `--ex-color-text-secondary`, `--ex-color-pub-text` tracks `--ex-color-mde-chrome-text`, `--ex-color-pub-link-modal` tracks `--ex-color-mde-preview-link`, and `--ex-color-pub-button-border-modal` tracks `--ex-color-border`, in the main block and all three `@supports` blocks. Neighbor tokens such as `--ex-color-primary` and `--ex-color-pub-button-border` keep their current values. Pinned by Task 3 `packages/theme/src/styles.test.ts` (`重复的发布色标是源 token 的别名`).
3. `PublishBaseProps.templates` stays `templates?: readonly PublishOption[]`. Its JSDoc says this prop replaces the default article-template list and is not the toolbar content `Template`. Pinned by Task 4 `packages/publish/src/templates-prop.test.ts` (`templates 仍是这个名字，并说明它不是工具栏内容 Template`).
4. Installing `@editorx/csdn` still installs `@editorx/rich-text`. The nine libraries stay publishable, and the root README says `rich-text` is a separate package that uses CKEditor 5 under GPL. Pinned by Task 2 `scripts/library-publish.test.mjs` (`九个库可发布且 csdn 依赖 rich-text`) and Task 6 `scripts/readme.test.mjs` (`README 写明 rich-text 的 GPL 和已发布的依赖`).
5. Each library changelog states that `PublishSettings` gained required fields `declaration`, `backupToGitCode`, `template`, and `multiPlatform`. A host that builds those objects by hand can see the four names. Pinned by Task 7 `scripts/changelog-required-fields.test.mjs` (`九个库的 changelog 写明四个必填字段`).

## File structure

- `.changeset/config.json`: public access, `baseBranch` `main`, the nine libraries in one `fixed` group, playground ignored, private packages not versioned.
- `.changeset/README.md`: says this directory is for Changesets, and the product README is the repo root.
- `.changeset/publish-settings-required-fields.md`: one minor changeset naming all nine libraries. Task 7 consumes it with `changeset version`.
- `package.json`: devDependency `@changesets/cli` at `^2`, later the `release:dry-run` script.
- Nine `packages/*/package.json`: `publishConfig.access` `public`, then version `0.1.0`. No `private` field.
- `packages/theme/src/styles.css`: four tokens aliased. `packages/theme/src/styles.test.ts`: alias assertions.
- `packages/publish/src/types.ts`: JSDoc only. `packages/publish/src/templates-prop.test.ts`.
- `packages/ui/src/index.ts`: drop the public re-export and comment why. `packages/ui/src/layer.tsx` unchanged. `packages/ui/src/public-entry.test.ts`.
- `README.md`: product docs at the repo root. There is no `docs/README.md`.
- `packages/<library>/CHANGELOG.md`: generated by `changeset version`.
- `scripts/changesets-config.test.mjs`, `scripts/library-publish.test.mjs`, `scripts/readme.test.mjs`, `scripts/changelog-required-fields.test.mjs`, `scripts/release-dry-run.mjs`, `scripts/release-workflow.test.mjs`.
- `.github/workflows/release.yml`: version or publish on `main`. Not executed here.

The nine library names, in this order everywhere:

`@editorx/theme`, `@editorx/ui`, `@editorx/toolbar`, `@editorx/markdown-core`, `@editorx/markdown`, `@editorx/rich-text`, `@editorx/publish`, `@editorx/csdn-extensions`, `@editorx/csdn`.

---

### Task 1: Wire Changesets config

**Files:**
- Modify: `package.json` (root `devDependencies`)
- Create: `.changeset/config.json`
- Create: `.changeset/README.md`
- Create: `scripts/changesets-config.test.mjs`
- Test: `scripts/changesets-config.test.mjs`

**Interfaces:**
- Consumes: root `package.json` fields `"private": true` and `"packageManager": "pnpm@10.33.4"`. No `.changeset/` directory exists.
- Produces: `devDependencies["@changesets/cli"] === "^2"`. `.changeset/config.json` has `access` `"public"`, `baseBranch` `"main"`, `commit` `false`, `changelog` `"@changesets/cli/changelog"`, `updateInternalDependencies` `"patch"`, `linked` `[]`, `ignore` `["@editorx/playground"]`, `privatePackages` `{ "version": false, "tag": false }`, and `fixed` equal to one group of the nine library names in the order above. Later tasks call `pnpm exec changeset`.

- [ ] **Step 1: Write the failing test**

`scripts/changesets-config.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  '@editorx/theme',
  '@editorx/ui',
  '@editorx/toolbar',
  '@editorx/markdown-core',
  '@editorx/markdown',
  '@editorx/rich-text',
  '@editorx/publish',
  '@editorx/csdn-extensions',
  '@editorx/csdn',
]

test('根 package.json 以主版本 2 声明 changesets CLI', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.private, true)
  assert.equal(pkg.packageManager, 'pnpm@10.33.4')
  assert.equal(pkg.devDependencies['@changesets/cli'], '^2')
})

test('changesets 配置公开九个库并忽略 playground', () => {
  const config = JSON.parse(readFileSync(new URL('../.changeset/config.json', import.meta.url), 'utf8'))
  assert.equal(config.changelog, '@changesets/cli/changelog')
  assert.equal(config.commit, false)
  assert.equal(config.access, 'public')
  assert.equal(config.baseBranch, 'main')
  assert.equal(config.updateInternalDependencies, 'patch')
  assert.deepEqual(config.linked, [])
  assert.deepEqual(config.ignore, ['@editorx/playground'])
  assert.deepEqual(config.privatePackages, { version: false, tag: false })
  assert.deepEqual(config.fixed, [PUBLISHABLE])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from the repo root:

```bash
node --test scripts/changesets-config.test.mjs
```

Expected: FAIL. `devDependencies['@changesets/cli']` is `undefined`, or reading `.changeset/config.json` throws `ENOENT`.

- [ ] **Step 3: Write minimal implementation**

In root `package.json`, insert this entry as the first key of `devDependencies` (it sorts before `@eslint/js`):

```json
"@changesets/cli": "^2",
```

The value is the major-2 range. Do not write a patch number. Do not run `pnpm install`.

`.changeset/config.json`:

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [
    [
      "@editorx/theme",
      "@editorx/ui",
      "@editorx/toolbar",
      "@editorx/markdown-core",
      "@editorx/markdown",
      "@editorx/rich-text",
      "@editorx/publish",
      "@editorx/csdn-extensions",
      "@editorx/csdn"
    ]
  ],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@editorx/playground"],
  "privatePackages": {
    "version": false,
    "tag": false
  }
}
```

`.changeset/README.md`:

```md
# Changesets

此目录只放 Changesets 的配置和待发布说明。产品说明在仓库根目录的 README.md。
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test scripts/changesets-config.test.mjs
```

Expected: PASS. 2 tests.

- [ ] **Step 5: Commit**

```bash
git add package.json .changeset/config.json .changeset/README.md scripts/changesets-config.test.mjs
git commit -m "$(cat <<'EOF'
build: 接入 changesets 配置

九个库固定为一组并从 main 公开版本。CLI 先写主版本 2，安装和锁文件留给控制方。

EOF
)"
```

Stop after this commit. The controller runs, from the repo root:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm install
```

The controller confirms the resolved `@changesets/cli` version is major 2 and, if `pnpm-lock.yaml` changed, commits that file. The implementer does not run install. Tasks 2–6 do not need the binary. Task 7 does. If `pnpm exec changeset --help` fails at Task 7, stop and wait for that install.

---

### Task 2: Mark libraries publishable

**Files:**
- Modify: `packages/theme/package.json`
- Modify: `packages/ui/package.json`
- Modify: `packages/toolbar/package.json`
- Modify: `packages/markdown-core/package.json`
- Modify: `packages/markdown/package.json`
- Modify: `packages/rich-text/package.json`
- Modify: `packages/publish/package.json`
- Modify: `packages/csdn-extensions/package.json`
- Modify: `packages/csdn/package.json`
- Create: `scripts/library-publish.test.mjs`
- Test: `scripts/library-publish.test.mjs`

**Interfaces:**
- Consumes: each library `package.json` already has `"version": "0.0.0"` and no `private` key. `@editorx/csdn` `dependencies["@editorx/rich-text"]` is `workspace:*`. Its `peerDependencies` are only `react` and `react-dom`. Root `name` is `editorx`. Playground `name` is `@editorx/playground`.
- Produces: each library has `publishConfig: { access: "public" }` and still has no `private` key. Dependency ranges are unchanged. Task 7 later sets `version` to `0.1.0` and this test still passes because it does not read `version`.

- [ ] **Step 1: Write the failing test**

`scripts/library-publish.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  ['@editorx/theme', 'packages/theme/package.json'],
  ['@editorx/ui', 'packages/ui/package.json'],
  ['@editorx/toolbar', 'packages/toolbar/package.json'],
  ['@editorx/markdown-core', 'packages/markdown-core/package.json'],
  ['@editorx/markdown', 'packages/markdown/package.json'],
  ['@editorx/rich-text', 'packages/rich-text/package.json'],
  ['@editorx/publish', 'packages/publish/package.json'],
  ['@editorx/csdn-extensions', 'packages/csdn-extensions/package.json'],
  ['@editorx/csdn', 'packages/csdn/package.json'],
]

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'))
}

test('九个库可发布且 csdn 依赖 rich-text', () => {
  for (const [name, file] of PUBLISHABLE) {
    const pkg = readJson(file)
    assert.equal(pkg.name, name)
    assert.equal(Object.hasOwn(pkg, 'private'), false, name)
    assert.equal(pkg.publishConfig?.access, 'public', name)
  }

  const csdn = readJson('packages/csdn/package.json')
  assert.equal(csdn.dependencies['@editorx/rich-text'], 'workspace:*')
  assert.equal(csdn.peerDependencies['@editorx/rich-text'], undefined)
  assert.equal(csdn.peerDependenciesMeta, undefined)

  const root = readJson('package.json')
  const playground = readJson('apps/playground/package.json')
  assert.equal(root.name, 'editorx')
  assert.equal(root.private, true)
  assert.equal(playground.name, '@editorx/playground')
  assert.equal(playground.private, true)
  assert.equal(playground.publishConfig, undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/library-publish.test.mjs
```

Expected: FAIL with `undefined !== 'public'` for `@editorx/theme` (or the first library missing `publishConfig.access`).

- [ ] **Step 3: Write minimal implementation**

In each of the nine library `package.json` files, insert this object immediately after the `"version": "0.0.0",` line. Do not add `"private"`. Do not move `@editorx/rich-text`.

```json
  "publishConfig": {
    "access": "public"
  },
```

Paths:

- `packages/theme/package.json`
- `packages/ui/package.json`
- `packages/toolbar/package.json`
- `packages/markdown-core/package.json`
- `packages/markdown/package.json`
- `packages/rich-text/package.json`
- `packages/publish/package.json`
- `packages/csdn-extensions/package.json`
- `packages/csdn/package.json`

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test scripts/library-publish.test.mjs
```

Expected: PASS. 1 test.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/package.json packages/ui/package.json packages/toolbar/package.json packages/markdown-core/package.json packages/markdown/package.json packages/rich-text/package.json packages/publish/package.json packages/csdn-extensions/package.json packages/csdn/package.json scripts/library-publish.test.mjs
git commit -m "$(cat <<'EOF'
build: 声明库包的公开 publishConfig

九个 @editorx 库保持可发布。仓库根和 playground 继续 private，csdn 对 rich-text 仍是普通依赖。

EOF
)"
```

---

### Task 3: Alias duplicate theme tokens

**Files:**
- Modify: `packages/theme/src/styles.css`
- Modify: `packages/theme/src/styles.test.ts`
- Test: `packages/theme/src/styles.test.ts`

**Interfaces:**
- Consumes: `mainTokens`, `fallbackCss`, `ruleBody`, and `parseColorTokens` already in `packages/theme/src/styles.test.ts`. `splitLightDark` treats a `var(--ex-color-…)` value as the same string for light and dark, and the existing `@supports` test requires each fallback declaration to equal that string. Current main values: `--ex-color-pub-option-modal: light-dark(#555666, #b8b9c4)`, `--ex-color-pub-text: light-dark(#1a1a1a, #e8e8ed)`, `--ex-color-pub-link-modal: light-dark(#4ea1db, #6cb6ea)`, `--ex-color-pub-button-border-modal: light-dark(#e8e8ed, #3a3b41)`. The same four names are hex in the light rule and in both dark rules.
- Produces: those four custom properties are `var(--ex-color-text-secondary)`, `var(--ex-color-mde-chrome-text)`, `var(--ex-color-mde-preview-link)`, and `var(--ex-color-border)`. Each of those four lines appears exactly four times (main, light `@supports`, dark `@supports`, system `@supports`). Source tokens keep the hex and `light-dark()` values already in the file.

- [ ] **Step 1: Write the failing test**

Append this describe to `packages/theme/src/styles.test.ts`:

```ts
describe('重复的发布色标是源 token 的别名', () => {
  const aliases: Array<[string, string]> = [
    ['--ex-color-pub-option-modal', 'var(--ex-color-text-secondary)'],
    ['--ex-color-pub-text', 'var(--ex-color-mde-chrome-text)'],
    ['--ex-color-pub-link-modal', 'var(--ex-color-mde-preview-link)'],
    ['--ex-color-pub-button-border-modal', 'var(--ex-color-border)'],
  ]

  const sources: Record<string, string> = {
    '--ex-color-text-secondary': 'light-dark(#555666, #b8b9c4)',
    '--ex-color-mde-chrome-text': 'light-dark(#1a1a1a, #e8e8ed)',
    '--ex-color-mde-preview-link': 'light-dark(#4ea1db, #6cb6ea)',
    '--ex-color-border': 'light-dark(#e8e8ed, #3a3b41)',
    '--ex-color-primary': 'light-dark(#fc5531, #fc5531)',
    '--ex-color-pub-link': 'light-dark(#006fff, #5aa0ff)',
    '--ex-color-pub-button-border': 'light-dark(#e5e5e5, #3a3b41)',
    '--ex-color-rte-ink': 'var(--ex-color-text-secondary)',
  }

  it('主块把四个重复色标指到已有 token，其它抽查值不变', () => {
    for (const [name, value] of aliases) {
      expect(mainTokens.get(name), name).toBe(value)
      expect(css.split(`${name}: ${value};`).length - 1, name).toBe(4)
    }
    for (const [name, value] of Object.entries(sources)) {
      expect(mainTokens.get(name), name).toBe(value)
    }
  })

  const blocks: Array<[string, string, 0 | 1]> = [
    ['亮色', ".ex-root,\n  .ex-root[data-ex-theme='light']", 0],
    ['暗色', ".ex-root[data-ex-theme='dark']", 1],
    ['system 暗色', ".ex-root[data-ex-theme='system']", 1],
  ]

  it.each(blocks)('%s 兜底块里别名仍是 var()，源 token 仍是原来的十六进制', (_label, selector, index) => {
    const scope = selector.includes('system')
      ? ruleBody(fallbackCss, '@media (prefers-color-scheme: dark)')
      : fallbackCss
    const tokens = parseColorTokens(ruleBody(scope, selector))
    for (const [name, value] of aliases) {
      expect(tokens.get(name), name).toBe(value)
    }
    expect(tokens.get('--ex-color-text-secondary')).toBe(index === 0 ? '#555666' : '#b8b9c4')
    expect(tokens.get('--ex-color-mde-chrome-text')).toBe(index === 0 ? '#1a1a1a' : '#e8e8ed')
    expect(tokens.get('--ex-color-mde-preview-link')).toBe(index === 0 ? '#4ea1db' : '#6cb6ea')
    expect(tokens.get('--ex-color-border')).toBe(index === 0 ? '#e8e8ed' : '#3a3b41')
    expect(tokens.get('--ex-color-primary')).toBe('#fc5531')
    expect(tokens.get('--ex-color-pub-button-border')).toBe(index === 0 ? '#e5e5e5' : '#3a3b41')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/theme exec vitest run src/styles.test.ts
```

Expected: FAIL. `expected 'light-dark(#555666, #b8b9c4)' to be 'var(--ex-color-text-secondary)'` on `--ex-color-pub-option-modal`.

- [ ] **Step 3: Write minimal implementation**

In `packages/theme/src/styles.css`, replace these exact declaration lines. Replace each full line, not the hex alone. The two dark copies of each hex line (`data-ex-theme='dark'` and `data-ex-theme='system'`) share the same text, so replace both copies of that line.

| Old line | New line | Copies |
|---|---|---|
| `--ex-color-pub-text: light-dark(#1a1a1a, #e8e8ed);` | `--ex-color-pub-text: var(--ex-color-mde-chrome-text);` | 1 |
| `--ex-color-pub-option-modal: light-dark(#555666, #b8b9c4);` | `--ex-color-pub-option-modal: var(--ex-color-text-secondary);` | 1 |
| `--ex-color-pub-link-modal: light-dark(#4ea1db, #6cb6ea);` | `--ex-color-pub-link-modal: var(--ex-color-mde-preview-link);` | 1 |
| `--ex-color-pub-button-border-modal: light-dark(#e8e8ed, #3a3b41);` | `--ex-color-pub-button-border-modal: var(--ex-color-border);` | 1 |
| `--ex-color-pub-text: #1a1a1a;` | `--ex-color-pub-text: var(--ex-color-mde-chrome-text);` | 1 |
| `--ex-color-pub-option-modal: #555666;` | `--ex-color-pub-option-modal: var(--ex-color-text-secondary);` | 1 |
| `--ex-color-pub-link-modal: #4ea1db;` | `--ex-color-pub-link-modal: var(--ex-color-mde-preview-link);` | 1 |
| `--ex-color-pub-button-border-modal: #e8e8ed;` | `--ex-color-pub-button-border-modal: var(--ex-color-border);` | 1 |
| `--ex-color-pub-text: #e8e8ed;` | `--ex-color-pub-text: var(--ex-color-mde-chrome-text);` | 2 |
| `--ex-color-pub-option-modal: #b8b9c4;` | `--ex-color-pub-option-modal: var(--ex-color-text-secondary);` | 2 |
| `--ex-color-pub-link-modal: #6cb6ea;` | `--ex-color-pub-link-modal: var(--ex-color-mde-preview-link);` | 2 |
| `--ex-color-pub-button-border-modal: #3a3b41;` | `--ex-color-pub-button-border-modal: var(--ex-color-border);` | 2 |

Leave `--ex-color-text-secondary`, `--ex-color-mde-chrome-text`, `--ex-color-mde-preview-link`, `--ex-color-border`, `--ex-color-pub-button-border`, and every other custom property as they are. The `@supports` blocks use `var()` so the existing fallback test, which compares them to `splitLightDark` of the main value, keeps passing, and each block still resolves to the source token declared above the alias in that same rule.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/theme exec vitest run src/styles.test.ts
```

Expected: PASS. Do not run Playwright and do not update snapshots.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/styles.css packages/theme/src/styles.test.ts
git commit -m "$(cat <<'EOF'
refactor(theme): 把重复的发布色标改成已有 token 的别名

四个 --ex-color-pub-* 与已有 token 同色，别名让以后改源 token 时计算色跟着走。其它色值不动。

EOF
)"
```

---

### Task 4: Document `templates` without renaming it

**Files:**
- Modify: `packages/publish/src/types.ts`
- Create: `packages/publish/src/templates-prop.test.ts`
- Test: `packages/publish/src/templates-prop.test.ts`

**Interfaces:**
- Consumes: `PublishBaseProps.templates?: readonly PublishOption[]` in `packages/publish/src/types.ts`. The current comment says `传入 templates 则整表替换默认列表` and does not mention the toolbar content `Template`. `PublishOption` is imported from `@editorx/toolbar`.
- Produces: the same property name and type. The JSDoc block directly above it contains `这个属性替换默认文章模板列表` and `这不是工具栏内容 Template`. The identifier `articleTemplates` does not appear in the file.

- [ ] **Step 1: Write the failing test**

`packages/publish/src/templates-prop.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PublishBaseProps.templates', () => {
  it('templates 仍是这个名字，并说明它不是工具栏内容 Template', () => {
    const source = readFileSync(new URL('./types.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('articleTemplates')
    const match = /\/\*\*([\s\S]*?)\*\/\s*templates\?: readonly PublishOption\[\]/.exec(source)
    expect(match).not.toBeNull()
    const doc = match?.[1] ?? ''
    expect(doc).toContain('这个属性替换默认文章模板列表')
    expect(doc).toContain('这不是工具栏内容 Template')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/publish exec vitest run src/templates-prop.test.ts
```

Expected: FAIL because the doc does not contain `这个属性替换默认文章模板列表`.

- [ ] **Step 3: Write minimal implementation**

Replace the JSDoc immediately above `templates?: readonly PublishOption[]` in `packages/publish/src/types.ts` with:

```ts
  /**
   * 文章模板选项；默认 默认模板 / 简洁模板 / 墨衍模板。
   * 未传 document 时按 FALLBACK_DOC（markdown）墨衍可选；editorType 不是 markdown 时墨衍禁用。
   * 这个属性替换默认文章模板列表。
   * 这不是工具栏内容 Template（`toolbar.template`，插入内容模版）。
   */
  templates?: readonly PublishOption[]
```

Do not rename the property. Do not edit call sites.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/publish exec vitest run src/templates-prop.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/publish/src/types.ts packages/publish/src/templates-prop.test.ts
git commit -m "$(cat <<'EOF'
docs(publish): 说明 templates 替换的是文章模板列表

属性名保持 templates。注释写明它整表替换默认文章模板，并和工具栏内容 Template 区分开。

EOF
)"
```

---

### Task 5: Stop exporting modal-layer helpers

**Files:**
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/src/public-entry.test.ts`
- Test: `packages/ui/src/public-entry.test.ts`
- Test: `packages/ui/src/layer.test.tsx`

**Interfaces:**
- Consumes: `packages/ui/src/layer.tsx` exports `MODAL_LAYER_CLASS`, `ModalLayer`, and `useModalLayerClass`. In-package files import them from `./layer`. Planner check on 2026-10-13: ripgrep `MODAL_LAYER_CLASS|ModalLayer|useModalLayerClass` over the repo. TypeScript matches are only under `packages/ui/src/`. No file outside that package imports the three names. Docs mention them; product code outside the package does not.
- Produces: `packages/ui/src/index.ts` does not re-export the three names. A comment in that file records the check. `layer.tsx` still exports them. `dist/index.d.ts` after `pnpm --filter @editorx/ui build` does not contain `MODAL_LAYER_CLASS`. README Task 6 repeats one consumer-facing sentence; this task's comment is the source of record.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/public-entry.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as api from './index'
import { MODAL_LAYER_CLASS, ModalLayer, useModalLayerClass } from './layer'

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full)
  }
}

describe('@editorx/ui 公开入口', () => {
  it('不导出模态层辅助函数，包外也没有引用', () => {
    expect(api).not.toHaveProperty('MODAL_LAYER_CLASS')
    expect(api).not.toHaveProperty('ModalLayer')
    expect(api).not.toHaveProperty('useModalLayerClass')
    expect(MODAL_LAYER_CLASS).toBe('is-in-modal')
    expect(typeof ModalLayer).toBe('function')
    expect(typeof useModalLayerClass).toBe('function')

    const entry = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(entry).toContain('MODAL_LAYER_CLASS、ModalLayer、useModalLayerClass 不从本入口导出。')
    expect(entry).toContain('包外没有文件 import 这三个名字。包内仍从 ./layer 使用。')
    expect(entry).not.toMatch(/export\s*\{[^}]*MODAL_LAYER_CLASS/)

    const repo = fileURLToPath(new URL('../../..', import.meta.url))
    const files: string[] = []
    walk(path.join(repo, 'packages'), files)
    walk(path.join(repo, 'apps'), files)
    const uiRoot = path.join(repo, 'packages', 'ui') + path.sep
    const outside = files.filter((file) => !file.startsWith(uiRoot))
    const hits = outside.filter((file) => {
      const text = readFileSync(file, 'utf8')
      return text.includes('MODAL_LAYER_CLASS') || text.includes('useModalLayerClass') || /\bModalLayer\b/.test(text)
    })
    expect(hits).toEqual([])

    const dts = readFileSync(new URL('../dist/index.d.ts', import.meta.url), 'utf8')
    expect(dts).not.toContain('MODAL_LAYER_CLASS')
    expect(dts).not.toContain('useModalLayerClass')
    expect(dts).not.toMatch(/\bModalLayer\b/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/ui exec vitest run src/public-entry.test.ts
```

Expected: FAIL with a message that the module has property `MODAL_LAYER_CLASS`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/src/index.ts`, delete this line:

```ts
export { MODAL_LAYER_CLASS, ModalLayer, useModalLayerClass } from './layer'
```

Put this comment where that line was:

```ts
// MODAL_LAYER_CLASS、ModalLayer、useModalLayerClass 不从本入口导出。
// 写计划时检索全仓库 ts/tsx：包外没有文件 import 这三个名字。包内仍从 ./layer 使用。
```

Do not edit `packages/ui/src/layer.tsx` or the files that import `./layer`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/ui build
pnpm --filter @editorx/ui exec vitest run src/public-entry.test.ts src/layer.test.tsx
```

Expected: PASS. `dist/` is gitignored. Do not `git add` it.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/index.ts packages/ui/src/public-entry.test.ts
git commit -m "$(cat <<'EOF'
refactor(ui): 停止从入口导出模态层辅助函数

包外没有引用 MODAL_LAYER_CLASS、ModalLayer、useModalLayerClass。入口注释记下这次检索，包内仍从 ./layer 使用。

EOF
)"
```

---

### Task 6: Write the root README

**Files:**
- Create: `README.md`
- Create: `scripts/readme.test.mjs`
- Test: `scripts/readme.test.mjs`

**Interfaces:**
- Consumes: Task 2's publish rules and the shipped dependency graph in the nine `package.json` files. Task 4's sentences about `templates`. Task 5's decision not to export the modal helpers. Task 8 will add `pnpm release:dry-run`, which this README names. There is no `docs/README.md` and this task does not create one.
- Produces: root `README.md` containing the exact sentences the test searches for. It does not contain `反馈` or `历史版本`.

- [ ] **Step 1: Write the failing test**

`scripts/readme.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('README 写明 rich-text 的 GPL 和已发布的依赖', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
  const sentences = [
    '@editorx/rich-text` 是单独的包，使用 CKEditor 5，`licenseKey` 为 `GPL`。',
    '@editorx/csdn` 把 `@editorx/rich-text` 放在 `dependencies`，版本范围是 `workspace:*`。这是普通依赖，不是 optional peerDependency。',
    '@editorx/csdn-extensions` 的运行时依赖是 `@editorx/toolbar`、`@editorx/ui`、`@editorx/theme`、`lucide-react`。',
    '它不依赖 `@editorx/csdn`、`@editorx/markdown`、`@editorx/rich-text`、`@editorx/markdown-core`、`@editorx/publish`。',
    '@editorx/markdown` 和 `@editorx/rich-text` 不依赖 `@editorx/csdn-extensions`。',
    '@editorx/csdn` 依赖 `@editorx/csdn-extensions`。',
    'PublishBaseProps.templates` 替换默认文章模板列表，不是工具栏内容 `Template`。',
    '@editorx/ui` 的公开入口不导出 `MODAL_LAYER_CLASS`、`ModalLayer`、`useModalLayerClass`。',
    'PublishSettings` 增加了必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。',
    'pnpm release:dry-run',
    'npm pack --dry-run --offline',
  ]
  for (const sentence of sentences) assert.ok(readme.includes(sentence), sentence)
  assert.equal(readme.includes('反馈'), false)
  assert.equal(readme.includes('历史版本'), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/readme.test.mjs
```

Expected: FAIL with `ENOENT` for `README.md`.

- [ ] **Step 3: Write minimal implementation**

Create root `README.md`. The block below uses four backticks so the `sh` fences inside the README stay part of the file:

````md
# EditorX

EditorX 是一组 `@editorx/*` npm 包，用来在多个项目里复用 CSDN 博客发布编辑器：Markdown 编辑器、富文本编辑器、发布设置。包管理是 pnpm workspace，构建是 Turborepo 和 tsup（ESM 与 `.d.ts`，每个库导出 `./styles.css`）。CSS 类前缀是 `.ex-`，颜色变量是 `--ex-*`。

## 包

| 包 | 说明 |
|---|---|
| `@editorx/theme` | 主题 token |
| `@editorx/ui` | 界面组件 |
| `@editorx/toolbar` | 工具栏与共享类型，含 `PublishSettings` |
| `@editorx/markdown-core` | Markdown 渲染与命令，不依赖 React |
| `@editorx/markdown` | `<MarkdownEditor />` |
| `@editorx/rich-text` | `<RichTextEditor />` |
| `@editorx/publish` | `<PublishPanel />` 与 `<PublishModal />` |
| `@editorx/csdn-extensions` | AI、投票、视频、资源、InsCode、模板 |
| `@editorx/csdn` | `<CsdnEditor />` |
| `@editorx/playground` | Next.js 演示，不发布 |

## 依赖

`@editorx/markdown-core` 不依赖 React，也不依赖其他 `@editorx/*` 包。

`@editorx/ui` 使用 `@editorx/theme`。`@editorx/toolbar` 使用 `@editorx/theme` 和 `@editorx/ui`。`@editorx/markdown` 依赖 `@editorx/markdown-core`，并使用 `@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。

`@editorx/rich-text` 是单独的包，使用 CKEditor 5，`licenseKey` 为 `GPL`。它使用 `@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。它不依赖 `@editorx/csdn` 或 `@editorx/csdn-extensions`。

`@editorx/publish` 使用 `@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。

`@editorx/csdn-extensions` 的运行时依赖是 `@editorx/toolbar`、`@editorx/ui`、`@editorx/theme`、`lucide-react`。它不依赖 `@editorx/csdn`、`@editorx/markdown`、`@editorx/rich-text`、`@editorx/markdown-core`、`@editorx/publish`。

`@editorx/markdown` 和 `@editorx/rich-text` 不依赖 `@editorx/csdn-extensions`。

`@editorx/csdn` 依赖 `@editorx/csdn-extensions`。`@editorx/csdn` 还依赖 `@editorx/markdown`、`@editorx/markdown-core`、`@editorx/publish`、`@editorx/rich-text`、`@editorx/theme`、`@editorx/toolbar`、`@editorx/ui`。

`@editorx/csdn` 把 `@editorx/rich-text` 放在 `dependencies`，版本范围是 `workspace:*`。这是普通依赖，不是 optional peerDependency。

`@editorx/markdown`、`@editorx/rich-text`、`@editorx/publish` 可以不通过 `@editorx/csdn` 单独使用。

## 公开 API

`@editorx/ui` 的公开入口不导出 `MODAL_LAYER_CLASS`、`ModalLayer`、`useModalLayerClass`。写阶段 8 计划时检索了仓库里的 ts/tsx：包外没有文件 import 这三个名字。包内仍从 `./layer` 使用。

`PublishBaseProps.templates` 替换默认文章模板列表，不是工具栏内容 `Template`。

`PublishSettings` 增加了必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。手工构造 `PublishSettings` 或 `PublishPayload` 的宿主需要补上这四个字段。各库的 `CHANGELOG.md` 有同一句说明。

## 开发

需要 Node `>=22` 和 pnpm `10.33.4`。macOS 上 corepack 报 keyid 时，每条 pnpm 命令前先执行 `export COREPACK_INTEGRITY_KEYS=0`。

```sh
pnpm install
pnpm build
pnpm test
```

## 发布

九个库可以发布到 npm，`publishConfig.access` 为 `public`。仓库根包 `editorx` 和 `@editorx/playground` 保持 `"private": true`。

本地检查打包内容：

```sh
export COREPACK_INTEGRITY_KEYS=0
pnpm release:dry-run
```

这条命令执行 `npm pack --dry-run --offline`。它不执行 `npm publish`、`npm login` 或 `changeset publish`。

人把 `main` 上的提交推进远端之后，`.github/workflows/release.yml` 才会版本或发布。
````

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test scripts/readme.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md scripts/readme.test.mjs
git commit -m "$(cat <<'EOF'
docs: 写仓库 README 和包依赖说明

说明 rich-text 单独以 CKEditor 5 的 GPL 发布，csdn 仍把它当作普通依赖，并记下 PublishSettings 的四个必填字段。

EOF
)"
```

---

### Task 7: Record the PublishSettings fields in the changelogs

**Files:**
- Create: `.changeset/publish-settings-required-fields.md` (consumed before the commit)
- Create: `packages/theme/CHANGELOG.md`
- Create: `packages/ui/CHANGELOG.md`
- Create: `packages/toolbar/CHANGELOG.md`
- Create: `packages/markdown-core/CHANGELOG.md`
- Create: `packages/markdown/CHANGELOG.md`
- Create: `packages/rich-text/CHANGELOG.md`
- Create: `packages/publish/CHANGELOG.md`
- Create: `packages/csdn-extensions/CHANGELOG.md`
- Create: `packages/csdn/CHANGELOG.md`
- Modify: the nine library `package.json` files (`version` becomes `0.1.0`)
- Create: `scripts/changelog-required-fields.test.mjs`
- Test: `scripts/changelog-required-fields.test.mjs`

**Interfaces:**
- Consumes: Task 1 config. `pnpm exec changeset` works because the controller installed `@changesets/cli`. Every library `version` is `0.0.0`. `@editorx/*` keys under `dependencies` and `devDependencies` are `workspace:*`. `@editorx/*` keys under `peerDependencies` are `workspace:^`. Current Changesets `getDependencyVersionEdits` returns early for workspace ranges `*`, `^`, and `~`, so those strings stay.
- Produces: each library `version` is `0.1.0`. Each `packages/<dir>/CHANGELOG.md` contains the sentence `` `PublishSettings` 增加必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。手工构造 `PublishSettings` 或 `PublishPayload` 的宿主需要补上这四个字段。 `` Playground and the repo root have no `CHANGELOG.md`. Playground `version` stays `0.0.0`. The changeset markdown is gone. `commit` is `false`, so this command does not create a git commit.

- [ ] **Step 1: Write the failing test**

`scripts/changelog-required-fields.test.mjs`:

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const PUBLISHABLE = [
  ['@editorx/theme', 'packages/theme'],
  ['@editorx/ui', 'packages/ui'],
  ['@editorx/toolbar', 'packages/toolbar'],
  ['@editorx/markdown-core', 'packages/markdown-core'],
  ['@editorx/markdown', 'packages/markdown'],
  ['@editorx/rich-text', 'packages/rich-text'],
  ['@editorx/publish', 'packages/publish'],
  ['@editorx/csdn-extensions', 'packages/csdn-extensions'],
  ['@editorx/csdn', 'packages/csdn'],
]

const SENTENCE =
  '`PublishSettings` 增加必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。手工构造 `PublishSettings` 或 `PublishPayload` 的宿主需要补上这四个字段。'

test('九个库的 changelog 写明四个必填字段', () => {
  for (const [name, dir] of PUBLISHABLE) {
    const pkg = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8'))
    assert.equal(pkg.name, name)
    assert.equal(pkg.version, '0.1.0')
    assert.equal(Object.hasOwn(pkg, 'private'), false)
    assert.equal(pkg.publishConfig.access, 'public')
    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const block = pkg[depType] ?? {}
      for (const [dep, range] of Object.entries(block)) {
        if (!dep.startsWith('@editorx/')) continue
        assert.equal(range, depType === 'peerDependencies' ? 'workspace:^' : 'workspace:*', `${name} ${depType} ${dep}`)
      }
    }
    const changelog = readFileSync(new URL(`../${dir}/CHANGELOG.md`, import.meta.url), 'utf8')
    assert.ok(changelog.includes(SENTENCE), name)
    assert.ok(changelog.includes(name), name)
  }

  assert.equal(existsSync(new URL('../CHANGELOG.md', import.meta.url)), false)
  assert.equal(existsSync(new URL('../apps/playground/CHANGELOG.md', import.meta.url)), false)
  const playground = JSON.parse(readFileSync(new URL('../apps/playground/package.json', import.meta.url), 'utf8'))
  assert.equal(playground.version, '0.0.0')
  assert.equal(playground.private, true)
  assert.equal(existsSync(new URL('../.changeset/publish-settings-required-fields.md', import.meta.url)), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/changelog-required-fields.test.mjs
```

Expected: FAIL. `version` is `0.0.0`, or reading a `CHANGELOG.md` throws `ENOENT`.

- [ ] **Step 3: Write the changeset**

`.changeset/publish-settings-required-fields.md`:

```md
---
"@editorx/theme": minor
"@editorx/ui": minor
"@editorx/toolbar": minor
"@editorx/markdown-core": minor
"@editorx/markdown": minor
"@editorx/rich-text": minor
"@editorx/publish": minor
"@editorx/csdn-extensions": minor
"@editorx/csdn": minor
---

`PublishSettings` 增加必填字段 `declaration`、`backupToGitCode`、`template`、`multiPlatform`。手工构造 `PublishSettings` 或 `PublishPayload` 的宿主需要补上这四个字段。
```

All nine names are in this file so each changelog gets this paragraph. The `fixed` group also forces every library to `0.1.0`.

- [ ] **Step 4: Apply the changeset locally**

Run from the repo root:

```bash
export COREPACK_INTEGRITY_KEYS=0
export CI=true
pnpm exec changeset status
pnpm exec changeset version
```

Expected for `changeset status`: it lists `@editorx/publish` and does not say `No unreleased changesets`.

Expected for `changeset version`: it deletes `.changeset/publish-settings-required-fields.md`, writes the nine `CHANGELOG.md` files, and sets each library `version` to `0.1.0`. It does not create a git commit. It does not publish.

Then set every `@editorx/*` value under `dependencies` and `devDependencies` back to `workspace:*`, and every `@editorx/*` value under `peerDependencies` back to `workspace:^`, if any line differs. Leave `version` at `0.1.0`. Leave `publishConfig`. Do not add a changelog for the repo root or `apps/playground`.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
export COREPACK_INTEGRITY_KEYS=0
export CI=true
pnpm exec changeset status
node --test scripts/changelog-required-fields.test.mjs
```

Expected: `changeset status` prints `No unreleased changesets`. The node test PASSes.

- [ ] **Step 6: Commit**

`git add` the test, the nine changelogs, and the nine library `package.json` files. If `pnpm-lock.yaml` is modified, `git add pnpm-lock.yaml` as well. If the changeset file still exists, do not commit it; `changeset version` should already have deleted it. If `git status` shows the deletion of `.changeset/publish-settings-required-fields.md` and that path was never committed, there is nothing to stage for it.

```bash
git add scripts/changelog-required-fields.test.mjs packages/theme/CHANGELOG.md packages/theme/package.json packages/ui/CHANGELOG.md packages/ui/package.json packages/toolbar/CHANGELOG.md packages/toolbar/package.json packages/markdown-core/CHANGELOG.md packages/markdown-core/package.json packages/markdown/CHANGELOG.md packages/markdown/package.json packages/rich-text/CHANGELOG.md packages/rich-text/package.json packages/publish/CHANGELOG.md packages/publish/package.json packages/csdn-extensions/CHANGELOG.md packages/csdn-extensions/package.json packages/csdn/CHANGELOG.md packages/csdn/package.json
git commit -m "$(cat <<'EOF'
docs: 记录 PublishSettings 新增的必填字段

declaration、backupToGitCode、template、multiPlatform 写进九个库的 changelog。版本一起到 0.1.0，workspace 范围保持原样。

EOF
)"
```

---

### Task 8: Add the publish workflow and local dry-run

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `scripts/release-dry-run.mjs`
- Create: `scripts/release-workflow.test.mjs`
- Modify: `package.json` (add script `release:dry-run`)
- Test: `scripts/release-workflow.test.mjs`

**Interfaces:**
- Consumes: Task 7 versions `0.1.0`, `publishConfig.access` `"public"`, root and playground `"private": true`, and the README command `pnpm release:dry-run`. `npm pack --dry-run --json --ignore-scripts --offline`, run in a library directory, prints a JSON array whose first object has `version`, `name`, and `files[].path`. That command does not write a tarball and does not contact the registry. `files` includes `package.json` and paths under `dist/`.
- Produces: `package.json` script `"release:dry-run": "node scripts/release-dry-run.mjs"`. The workflow's only publish line is `publish: pnpm exec changeset publish` on `changesets/action@v1`, triggered by a push to `main`. The implementer does not run it, does not push, and does not run `gh workflow run`.

- [ ] **Step 1: Write the failing test**

`scripts/release-workflow.test.mjs`:

```js
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('..', import.meta.url)

test('工作流只在 changesets action 里发布，且本阶段没有碰 win32 或 RESUME', () => {
  const yaml = readFileSync(new URL('.github/workflows/release.yml', root), 'utf8')
  assert.match(yaml, /changesets\/action@v1/)
  assert.match(yaml, /branches:\s*\n\s+- main/)
  assert.match(yaml, /version:\s*pnpm exec changeset version/)
  assert.equal((yaml.match(/pnpm exec changeset publish/g) ?? []).length, 1)
  assert.equal(yaml.includes('npm publish'), false)
  assert.equal(yaml.includes('npm login'), false)
  assert.match(yaml, /NPM_TOKEN/)
  assert.equal(yaml.includes('playwright'), false)
  assert.equal(yaml.includes('3100'), false)

  const script = readFileSync(new URL('scripts/release-dry-run.mjs', root), 'utf8')
  assert.match(
    script,
    /spawnSync\(\s*'npm',\s*\[\s*'pack',\s*'--dry-run',\s*'--json',\s*'--ignore-scripts',\s*'--offline'\s*\]/,
  )
  assert.doesNotMatch(script, /spawnSync\([\s\S]{0,120}'publish'/)
  assert.doesNotMatch(script, /fetch\s*\(/)
  assert.equal(script.includes('3100'), false)

  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  assert.equal(pkg.scripts['release:dry-run'], 'node scripts/release-dry-run.mjs')
  const readme = readFileSync(new URL('README.md', root), 'utf8')
  assert.ok(readme.includes('pnpm release:dry-run'))

  const committed = spawnSync('git', ['diff', '--name-only', 'a5cf294...HEAD'], { encoding: 'utf8' })
  const worktree = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  assert.equal(committed.status, 0)
  assert.equal(worktree.status, 0)
  const names = `${committed.stdout}\n${worktree.stdout}`
  assert.equal(names.includes('RESUME.md'), false)
  assert.equal(names.includes('win32.png'), false)
  assert.equal(names.includes('e2e/'), false)
})

test('拒绝把 npm publish 当成 dry-run', () => {
  const refused = spawnSync(process.execPath, ['scripts/release-dry-run.mjs', 'npm publish'], {
    encoding: 'utf8',
  })
  assert.equal(refused.status, 1)
  assert.match(`${refused.stdout}\n${refused.stderr}`, /拒绝执行发布命令/)
})

test('offline dry-run 打包九个 0.1.0 库', () => {
  const result = spawnSync(process.execPath, ['scripts/release-dry-run.mjs'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /dry-run ok/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/release-workflow.test.mjs
```

Expected: FAIL with `ENOENT` for `.github/workflows/release.yml` or `scripts/release-dry-run.mjs`.

- [ ] **Step 3: Write minimal implementation**

Add this script to root `package.json` `scripts`, next to the existing keys:

```json
"release:dry-run": "node scripts/release-dry-run.mjs"
```

`scripts/release-dry-run.mjs`:

```js
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const libs = [
  ['@editorx/theme', 'theme'],
  ['@editorx/ui', 'ui'],
  ['@editorx/toolbar', 'toolbar'],
  ['@editorx/markdown-core', 'markdown-core'],
  ['@editorx/markdown', 'markdown'],
  ['@editorx/rich-text', 'rich-text'],
  ['@editorx/publish', 'publish'],
  ['@editorx/csdn-extensions', 'csdn-extensions'],
  ['@editorx/csdn', 'csdn'],
]

const haystack = process.argv.slice(2).join(' ')
if (
  haystack.includes('npm publish') ||
  haystack.includes('npm login') ||
  haystack.includes('changeset publish') ||
  process.env.npm_command === 'publish'
) {
  console.error('拒绝执行发布命令')
  process.exit(1)
}

for (const [name, dirName] of libs) {
  const dir = path.join(root, 'packages', dirName)
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
  if (pkg.name !== name || pkg.private === true || pkg.publishConfig?.access !== 'public' || pkg.version !== '0.1.0') {
    console.error(`${name} 不能打包：name/private/publishConfig/version 不符合`)
    process.exit(1)
  }
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--offline'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, npm_config_offline: 'true', COREPACK_INTEGRITY_KEYS: '0' },
  })
  if (result.status !== 0) {
    console.error(result.stderr)
    process.exit(result.status ?? 1)
  }
  const packed = JSON.parse(result.stdout)
  const entry = packed[0]
  if (entry.name !== name || entry.version !== '0.1.0') {
    console.error(`${name} pack 版本不是 0.1.0`)
    process.exit(1)
  }
  const files = entry.files.map((file) => file.path)
  if (!files.includes('package.json') || !files.some((file) => file.startsWith('dist/'))) {
    console.error(`${name} pack 结果缺少 package.json 或 dist`)
    process.exit(1)
  }
}

const rootPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const playground = JSON.parse(readFileSync(path.join(root, 'apps/playground/package.json'), 'utf8'))
if (rootPkg.private !== true || playground.private !== true) {
  console.error('仓库根和 playground 必须保持 private')
  process.exit(1)
}

console.log('dry-run ok')
```

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    name: Version or publish
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.33.4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install
        run: pnpm install --frozen-lockfile
        env:
          COREPACK_INTEGRITY_KEYS: "0"

      - name: Build
        run: pnpm build
        env:
          COREPACK_INTEGRITY_KEYS: "0"

      - name: Create version PR or publish
        uses: changesets/action@v1
        with:
          version: pnpm exec changeset version
          publish: pnpm exec changeset publish
          commit: |-
            chore: 发布版本

            由 Changesets 在 main 上汇总版本号和 changelog。
          title: "chore: 发布版本"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          COREPACK_INTEGRITY_KEYS: "0"
```

Do not run this workflow. Do not push. Do not run `npm publish`, `npm login`, or `changeset publish`.

- [ ] **Step 4: Run test to verify it passes**

Build the nine libraries so `dist/` is present, then run the test. This build does not start playground and does not use port 3100.

```bash
export COREPACK_INTEGRITY_KEYS=0
pnpm --filter @editorx/theme --filter @editorx/ui --filter @editorx/toolbar --filter @editorx/markdown-core --filter @editorx/markdown --filter @editorx/rich-text --filter @editorx/publish --filter @editorx/csdn-extensions --filter @editorx/csdn build
node --test scripts/release-workflow.test.mjs
```

Expected: PASS. 3 tests. Stdout of the dry-run includes `dry-run ok`.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/release-dry-run.mjs scripts/release-workflow.test.mjs .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci: 添加 npm 发布工作流和本地 dry-run

dry-run 只用 npm pack --offline。推到 main 之后才由 changesets action 发布，这一阶段不执行它。

EOF
)"
```

Do not edit `docs/superpowers/handoff/RESUME.md`.
