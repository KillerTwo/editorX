# 阶段 1：基础设施（monorepo / theme / ui / playground）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 EditorX monorepo，交付可发布的 `@editorx/theme`（亮/暗主题 token + ThemeProvider）与 `@editorx/ui`（Button、Tag、ThemeToggle、Tooltip、Popover、Dropdown、Modal、Tabs、Toast），以及用于开发与还原度对照的 Next.js 16 playground。

**Architecture:** pnpm workspace + Turborepo 编排；每个包用 tsup 输出 ESM + `.d.ts`，并把 `src/styles.css` 复制为 `dist/styles.css` 供使用方显式引入。`ThemeProvider` 渲染 `.ex-root[data-ex-theme]` 根节点并在其内部提供 `.ex-portal` 挂载点，所有浮层都 portal 到这里以继承 `--ex-*` 变量。playground 消费构建产物（`dist`），用 Playwright 做 E2E 与视觉基线。

**Tech Stack:** Node ≥22、pnpm 10、Turborepo 2、TypeScript ~5.9.3、tsup 8、React 19.2+、Next.js 16（App Router）、@floating-ui/react、lucide-react、Vitest 4 + jsdom + Testing Library、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-09-csdn-editor-design.md`（本计划实现其 §3、§6.5 及 §8 中的 playground/compare 基础部分）

## Global Constraints

- 仅支持 React 19 + Next.js 16 App Router；不兼容 React 18 / Pages Router / 非 Next 环境。
- npm scope：`@editorx`；CSS 类前缀：`.ex-`；CSS 变量前缀：`--ex-*`。
- 样式：原生 CSS + CSS 变量；不使用 Tailwind / CSS Modules；每包导出 `./styles.css`。
- `packages/*` 组件中不出现硬编码视觉值（颜色、间距、字号、圆角、阴影一律引用 `--ex-*`）；唯一例外是主按钮文字白色 `#fff`。`apps/playground` 的开发工具页（如 `/compare`）不受此限。
- 所有组件包构建产物顶部带 `'use client';`。
- `@editorx/theme` 在下游包中必须是 **peerDependency**（保证 ThemeContext 单例）。
- TypeScript 固定 `~5.9.3`（tsup 的 dts 依赖 TS 5 JS API，不要升级到 7.x）。
- 图标仅使用 lucide-react 或自绘 SVG；不使用 CSDN 素材。
- 默认文案为简体中文，所有用户可见文案通过 props 可覆盖。
- 提交信息：Conventional Commits，中文摘要，附 description；只暂存当前任务文件，禁止 `git add .` / `git add -A`。
- Shell 为 Windows PowerShell；命令均在仓库根目录 `D:\frontend\editorX` 执行，除非另有说明。

---

## 文件结构

```
editorx/
├─ package.json                      # 根脚本、packageManager、devDependencies
├─ pnpm-workspace.yaml
├─ turbo.json
├─ eslint.config.mjs
├─ .gitignore
├─ tooling/
│  ├─ tsconfig.base.json             # 所有包共享的 TS 配置
│  ├─ copy-css.mjs                   # src/styles.css → dist/styles.css
│  └─ test/setup-dom.ts              # 共享 Vitest DOM setup（jest-dom、cleanup、matchMedia/ResizeObserver 桩）
├─ packages/
│  ├─ theme/
│  │  ├─ package.json / tsconfig.json / tsup.config.ts / vitest.config.ts
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ resolve-theme.ts (+ .test.ts)   # 纯函数：模式解析与校验
│  │     ├─ theme-provider.tsx (+ .test.tsx)# ThemeProvider / useTheme
│  │     └─ styles.css                      # 亮/暗 token
│  └─ ui/
│     ├─ package.json / tsconfig.json / tsup.config.ts / vitest.config.ts
│     └─ src/
│        ├─ index.ts
│        ├─ cx.ts                           # className 拼接
│        ├─ test-utils.tsx                  # renderWithTheme（不导出）
│        ├─ button.tsx (+ .test.tsx)
│        ├─ tag.tsx (+ .test.tsx)
│        ├─ theme-toggle.tsx (+ .test.tsx)
│        ├─ tooltip.tsx (+ .test.tsx)
│        ├─ popover.tsx (+ .test.tsx)
│        ├─ dropdown.tsx (+ .test.tsx)
│        ├─ modal.tsx (+ .test.tsx)
│        ├─ tabs.tsx (+ .test.tsx)
│        ├─ toast.tsx (+ .test.tsx)
│        └─ styles.css
└─ apps/
   └─ playground/
      ├─ package.json / tsconfig.json / next.config.ts / playwright.config.ts
      ├─ app/layout.tsx, app/globals.css, app/page.tsx
      ├─ app/showcase/page.tsx, app/showcase/showcase.tsx
      ├─ app/compare/page.tsx, app/compare/compare-view.tsx
      ├─ public/reference/.gitkeep
      └─ e2e/showcase.spec.ts, e2e/compare.spec.ts
```

---

### Task 1: Monorepo 脚手架 + `@editorx/theme` 纯函数与主题 token

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `eslint.config.mjs`, `.gitignore`
- Create: `tooling/tsconfig.base.json`, `tooling/copy-css.mjs`, `tooling/test/setup-dom.ts`
- Create: `packages/theme/package.json`, `packages/theme/tsconfig.json`, `packages/theme/tsup.config.ts`, `packages/theme/vitest.config.ts`
- Create: `packages/theme/src/resolve-theme.ts`, `packages/theme/src/styles.css`, `packages/theme/src/index.ts`
- Test: `packages/theme/src/resolve-theme.test.ts`

**Interfaces:**
- Produces:
  - `type ThemeMode = 'light' | 'dark' | 'system'`
  - `type ResolvedTheme = 'light' | 'dark'`
  - `resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme`
  - `isThemeMode(value: unknown): value is ThemeMode`
  - CSS 变量（`.ex-root` 上定义）：`--ex-color-primary|primary-hover|primary-active|text|text-secondary|text-muted|bg|surface|surface-hover|border|mask|success|warning|error|info`、`--ex-font-family|font-family-mono|font-size-sm|md|lg|xl`、`--ex-radius-sm|md|lg|pill`、`--ex-space-1..6`、`--ex-shadow-popover|modal`、`--ex-z-popover|modal|toast`、`--ex-transition`
  - 共享测试 setup：`tooling/test/setup-dom.ts`

- [ ] **Step 1: 创建根配置文件**

`package.json`：

```json
{
  "name": "editorx",
  "private": true,
  "packageManager": "pnpm@10.33.4",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "e2e": "turbo run e2e",
    "lint": "eslint ."
  }
}
```

`pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "e2e": { "dependsOn": ["build"], "cache": false }
  }
}
```

`.gitignore`：

```gitignore
node_modules/
dist/
.next/
.turbo/
coverage/
test-results/
playwright-report/
*.tsbuildinfo
next-env.d.ts
```

`eslint.config.mjs`：

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

export default defineConfig(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/playwright-report/**', '**/test-results/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
```

- [ ] **Step 2: 创建 tooling 共享文件**

`tooling/tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "declaration": true,
    "noEmit": true
  }
}
```

`tooling/copy-css.mjs`：

```js
import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
copyFileSync('src/styles.css', 'dist/styles.css')
```

`tooling/test/setup-dom.ts`：

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  if (!('ResizeObserver' in window)) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
```

- [ ] **Step 3: 安装根依赖**

Run:

```powershell
pnpm add -D -w turbo typescript@~5.9.3 tsup vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom react react-dom @types/react @types/react-dom eslint@^9 @eslint/js typescript-eslint eslint-plugin-react-hooks
```

Expected: 安装成功，生成 `pnpm-lock.yaml`，无 peer 依赖报错（`eslint@^9` 用于匹配 typescript-eslint 的 peer 范围）。

- [ ] **Step 4: 创建 `@editorx/theme` 包配置**

`packages/theme/package.json`：

```json
{
  "name": "@editorx/theme",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup && node ../../tooling/copy-css.mjs",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

`packages/theme/tsconfig.json`：

```json
{
  "extends": "../../tooling/tsconfig.base.json",
  "include": ["src", "vitest.config.ts", "tsup.config.ts"]
}
```

`packages/theme/tsup.config.ts`：

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: "'use client';" },
})
```

`packages/theme/vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../tooling/test/setup-dom.ts'],
  },
})
```

- [ ] **Step 5: 写失败测试**

`packages/theme/src/resolve-theme.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { isThemeMode, resolveTheme } from './resolve-theme'

describe('resolveTheme', () => {
  it('显式模式不受系统偏好影响', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('system 模式跟随系统偏好', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('isThemeMode', () => {
  it('接受合法模式', () => {
    expect(isThemeMode('light')).toBe(true)
    expect(isThemeMode('dark')).toBe(true)
    expect(isThemeMode('system')).toBe(true)
  })

  it('拒绝非法值', () => {
    expect(isThemeMode('blue')).toBe(false)
    expect(isThemeMode(null)).toBe(false)
    expect(isThemeMode(undefined)).toBe(false)
  })
})
```

- [ ] **Step 6: 运行测试确认失败**

Run: `pnpm --filter @editorx/theme test`
Expected: FAIL，提示 `Failed to resolve import "./resolve-theme"`。

- [ ] **Step 7: 实现纯函数与入口**

`packages/theme/src/resolve-theme.ts`：

```ts
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}
```

`packages/theme/src/index.ts`：

```ts
export { isThemeMode, resolveTheme } from './resolve-theme'
export type { ResolvedTheme, ThemeMode } from './resolve-theme'
```

- [ ] **Step 8: 运行测试确认通过**

Run: `pnpm --filter @editorx/theme test`
Expected: PASS（4 个用例）。

- [ ] **Step 9: 编写主题 token**

`packages/theme/src/styles.css`（颜色为 CSDN 当前近似值，阶段 3 依据参考截图校准）：

```css
.ex-root,
.ex-root[data-ex-theme='light'] {
  --ex-color-primary: #fc5531;
  --ex-color-primary-hover: #ff6d4e;
  --ex-color-primary-active: #e64a29;
  --ex-color-text: #222226;
  --ex-color-text-secondary: #555666;
  --ex-color-text-muted: #999aaa;
  --ex-color-bg: #f5f6f7;
  --ex-color-surface: #ffffff;
  --ex-color-surface-hover: #f0f0f5;
  --ex-color-border: #e8e8ed;
  --ex-color-mask: rgba(0, 0, 0, 0.45);
  --ex-color-success: #2ea121;
  --ex-color-warning: #ff9900;
  --ex-color-error: #f0473a;
  --ex-color-info: #4183f1;

  --ex-font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'SF UI Text', Arial, sans-serif;
  --ex-font-family-mono: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  --ex-font-size-sm: 12px;
  --ex-font-size-md: 14px;
  --ex-font-size-lg: 16px;
  --ex-font-size-xl: 20px;

  --ex-radius-sm: 2px;
  --ex-radius-md: 4px;
  --ex-radius-lg: 8px;
  --ex-radius-pill: 999px;

  --ex-space-1: 4px;
  --ex-space-2: 8px;
  --ex-space-3: 12px;
  --ex-space-4: 16px;
  --ex-space-5: 20px;
  --ex-space-6: 24px;

  --ex-shadow-popover: 0 2px 12px rgba(0, 0, 0, 0.12);
  --ex-shadow-modal: 0 4px 24px rgba(0, 0, 0, 0.16);

  --ex-z-popover: 1000;
  --ex-z-modal: 1100;
  --ex-z-toast: 1200;

  --ex-transition: 0.2s ease;

  color-scheme: light;
}

.ex-root[data-ex-theme='dark'] {
  --ex-color-primary: #fc5531;
  --ex-color-primary-hover: #ff7556;
  --ex-color-primary-active: #e04a2a;
  --ex-color-text: #e8e8ed;
  --ex-color-text-secondary: #b8b9c4;
  --ex-color-text-muted: #7d7e8a;
  --ex-color-bg: #18191c;
  --ex-color-surface: #232428;
  --ex-color-surface-hover: #2e2f34;
  --ex-color-border: #3a3b41;
  --ex-color-mask: rgba(0, 0, 0, 0.6);
  --ex-shadow-popover: 0 2px 12px rgba(0, 0, 0, 0.5);
  --ex-shadow-modal: 0 4px 24px rgba(0, 0, 0, 0.6);

  color-scheme: dark;
}

.ex-root {
  font-family: var(--ex-font-family);
  font-size: var(--ex-font-size-md);
  line-height: 1.5;
  color: var(--ex-color-text);
}
```

- [ ] **Step 10: 验证构建与类型检查**

Run: `pnpm turbo run build typecheck --filter=@editorx/theme`
Expected: 成功；`packages/theme/dist/` 下存在 `index.js`（首行为 `'use client';`）、`index.d.ts`、`styles.css`。

- [ ] **Step 11: 提交**

```powershell
git add package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json eslint.config.mjs .gitignore tooling packages/theme
git commit -m "build(theme): 初始化 pnpm monorepo 并新增主题模式解析与亮暗 token" -m "1. 新增 pnpm workspace、Turborepo、共享 tsconfig/eslint/Vitest setup 与 CSS 复制脚本
2. 新增 @editorx/theme 的 resolveTheme、isThemeMode 及 --ex-* 亮暗 CSS 变量
3. TypeScript 固定 ~5.9.3 以兼容 tsup 类型声明生成"
```

---

### Task 2: `ThemeProvider` 与 `useTheme`

**Files:**
- Create: `packages/theme/src/theme-provider.tsx`
- Modify: `packages/theme/src/index.ts`
- Test: `packages/theme/src/theme-provider.test.tsx`

**Interfaces:**
- Consumes: `ThemeMode`、`ResolvedTheme`、`resolveTheme`、`isThemeMode`（Task 1）
- Produces:
  - `interface ThemeProviderProps { theme?: ThemeMode; defaultTheme?: ThemeMode; onThemeChange?: (mode: ThemeMode) => void; storageKey?: string | false; className?: string; children: ReactNode }`
  - `ThemeProvider(props: ThemeProviderProps): JSX.Element` —— 渲染 `<div class="ex-root …" data-ex-theme="light|dark">{children}<div class="ex-portal" /></div>`
  - `interface ThemeContextValue { mode: ThemeMode; resolved: ResolvedTheme; setMode(mode: ThemeMode): void; portalRoot: HTMLElement | null }`
  - `useTheme(): ThemeContextValue`（Provider 外调用抛出 `Error('useTheme must be used within <ThemeProvider>')`）
  - 默认值：`defaultTheme = 'system'`，`storageKey = 'editorx-theme'`

- [ ] **Step 1: 写失败测试**

`packages/theme/src/theme-provider.test.tsx`：

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './theme-provider'

function mockSystemDark(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return {
    emit(next: boolean) {
      mql.matches = next
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent))
    },
  }
}

function Probe() {
  const { mode, resolved, setMode, portalRoot } = useTheme()
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <span data-testid="portal">{portalRoot?.className ?? 'none'}</span>
      <button onClick={() => setMode('dark')}>to-dark</button>
    </div>
  )
}

const root = () => document.querySelector('.ex-root') as HTMLElement

describe('ThemeProvider', () => {
  it('按 defaultTheme 渲染根节点', () => {
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
    expect(screen.getByTestId('mode')).toHaveTextContent('light')
  })

  it('system 模式跟随系统并响应变化', () => {
    const media = mockSystemDark(true)
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
    act(() => media.emit(false))
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
  })

  it('非受控：setMode 更新主题并写入 localStorage', async () => {
    const onThemeChange = vi.fn()
    render(<ThemeProvider defaultTheme="light" onThemeChange={onThemeChange}><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('to-dark'))
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
    expect(window.localStorage.getItem('editorx-theme')).toBe('dark')
    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })

  it('非受控：挂载时读取 localStorage', () => {
    window.localStorage.setItem('editorx-theme', 'dark')
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
  })

  it('非受控：忽略 localStorage 中的非法值', () => {
    window.localStorage.setItem('editorx-theme', 'purple')
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
  })

  it('storageKey=false 时不读写 localStorage', async () => {
    render(<ThemeProvider defaultTheme="light" storageKey={false}><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('to-dark'))
    expect(window.localStorage.length).toBe(0)
  })

  it('受控：setMode 只触发回调，主题由 prop 决定', async () => {
    const onThemeChange = vi.fn()
    const { rerender } = render(
      <ThemeProvider theme="light" onThemeChange={onThemeChange}><Probe /></ThemeProvider>,
    )
    await userEvent.click(screen.getByText('to-dark'))
    expect(onThemeChange).toHaveBeenCalledWith('dark')
    expect(root()).toHaveAttribute('data-ex-theme', 'light')
    expect(window.localStorage.length).toBe(0)
    rerender(<ThemeProvider theme="dark" onThemeChange={onThemeChange}><Probe /></ThemeProvider>)
    expect(root()).toHaveAttribute('data-ex-theme', 'dark')
  })

  it('提供位于根节点内的 portalRoot', () => {
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>)
    expect(screen.getByTestId('portal')).toHaveTextContent('ex-portal')
    expect(root().querySelector('.ex-portal')).not.toBeNull()
  })

  it('合并自定义 className', () => {
    render(<ThemeProvider defaultTheme="light" className="host"><Probe /></ThemeProvider>)
    expect(root()).toHaveClass('ex-root', 'host')
  })

  it('Provider 外调用 useTheme 抛错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useTheme must be used within <ThemeProvider>')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @editorx/theme test`
Expected: FAIL，提示 `Failed to resolve import "./theme-provider"`。

- [ ] **Step 3: 实现 ThemeProvider**

`packages/theme/src/theme-provider.tsx`：

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isThemeMode, resolveTheme, type ResolvedTheme, type ThemeMode } from './resolve-theme'

export interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode(mode: ThemeMode): void
  portalRoot: HTMLElement | null
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

const ThemeContext = createContext<ThemeContextValue | null>(null)

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
  const mode = isControlled ? theme : innerMode

  useEffect(() => {
    if (isControlled || !storageKey) return
    const stored = window.localStorage.getItem(storageKey)
    if (isThemeMode(stored)) setInnerMode(stored)
  }, [isControlled, storageKey])

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY)
    setSystemDark(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (!isControlled) {
        setInnerMode(next)
        if (storageKey) window.localStorage.setItem(storageKey, next)
      }
      onThemeChange?.(next)
    },
    [isControlled, storageKey, onThemeChange],
  )

  const resolved = resolveTheme(mode, systemDark)
  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, portalRoot }),
    [mode, resolved, setMode, portalRoot],
  )

  return (
    <ThemeContext.Provider value={value}>
      <div className={className ? `ex-root ${className}` : 'ex-root'} data-ex-theme={resolved}>
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
```

`packages/theme/src/index.ts`（完整替换）：

```ts
export { isThemeMode, resolveTheme } from './resolve-theme'
export type { ResolvedTheme, ThemeMode } from './resolve-theme'
export { ThemeProvider, useTheme } from './theme-provider'
export type { ThemeContextValue, ThemeProviderProps } from './theme-provider'
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @editorx/theme test`
Expected: PASS（resolve-theme 4 个 + theme-provider 10 个）。

- [ ] **Step 5: 构建与类型检查**

Run: `pnpm turbo run build typecheck --filter=@editorx/theme`
Expected: 成功。

- [ ] **Step 6: 提交**

```powershell
git add packages/theme/src/theme-provider.tsx packages/theme/src/theme-provider.test.tsx packages/theme/src/index.ts
git commit -m "feat(theme): 新增 ThemeProvider 与 useTheme 支持受控/非受控亮暗切换" -m "1. ThemeProvider 渲染 .ex-root[data-ex-theme] 根节点并提供 .ex-portal 浮层挂载点
2. 支持 system 模式跟随 prefers-color-scheme，非受控模式持久化到 localStorage（storageKey 可关闭）
3. 受控模式下 setMode 仅触发 onThemeChange，主题由 theme prop 决定"
```

---

### Task 3: `@editorx/ui` 脚手架 + Button / Tag / ThemeToggle

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/tsup.config.ts`, `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/cx.ts`, `packages/ui/src/test-utils.tsx`, `packages/ui/src/button.tsx`, `packages/ui/src/tag.tsx`, `packages/ui/src/theme-toggle.tsx`, `packages/ui/src/styles.css`, `packages/ui/src/index.ts`
- Test: `packages/ui/src/button.test.tsx`, `packages/ui/src/tag.test.tsx`, `packages/ui/src/theme-toggle.test.tsx`

**Interfaces:**
- Consumes: `ThemeProvider`、`useTheme`（Task 2）
- Produces:
  - `cx(...parts: Array<string | false | null | undefined>): string`
  - `renderWithTheme(ui: ReactElement, options?: RenderOptions)`（仅测试内部使用）
  - `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'default' | 'text'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode; ref?: Ref<HTMLButtonElement> }`；`Button(props)`
  - `interface TagProps { children: ReactNode; closable?: boolean; onClose?: () => void; closeLabel?: string; className?: string }`；`Tag(props)`
  - `interface ThemeToggleProps { labels?: { toLight: string; toDark: string }; className?: string }`；`ThemeToggle(props)`（默认文案：`切换到明亮模式` / `切换到暗黑模式`）

- [ ] **Step 1: 创建包配置**

`packages/ui/package.json`：

```json
{
  "name": "@editorx/ui",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup && node ../../tooling/copy-css.mjs",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "@editorx/theme": "workspace:^",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@editorx/theme": "workspace:*"
  }
}
```

`packages/ui/tsconfig.json`、`packages/ui/tsup.config.ts`、`packages/ui/vitest.config.ts`：内容与 `packages/theme/` 下同名文件**逐字相同**（见 Task 1 Step 4），直接复制这三份文件。

Run:

```powershell
pnpm --filter @editorx/ui add lucide-react
pnpm install
```

Expected: `packages/ui/package.json` 的 `dependencies` 出现 `lucide-react`。

- [ ] **Step 2: 创建工具文件**

`packages/ui/src/cx.ts`：

```ts
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
```

`packages/ui/src/test-utils.tsx`：

```tsx
import { render, type RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@editorx/theme'
import type { ReactElement, ReactNode } from 'react'

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" storageKey={false}>
      {children}
    </ThemeProvider>
  )
}

export function renderWithTheme(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Wrapper, ...options })
}
```

- [ ] **Step 3: 写失败测试**

`packages/ui/src/button.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'
import { renderWithTheme } from './test-utils'

describe('Button', () => {
  it('默认 type=button，带默认变体与尺寸类名', () => {
    renderWithTheme(<Button>保存草稿</Button>)
    const btn = screen.getByRole('button', { name: '保存草稿' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveClass('ex-btn', 'ex-btn--default', 'ex-btn--md')
  })

  it('应用 variant 与 size', () => {
    renderWithTheme(<Button variant="primary" size="lg">发布文章</Button>)
    expect(screen.getByRole('button')).toHaveClass('ex-btn--primary', 'ex-btn--lg')
  })

  it('点击触发 onClick', async () => {
    const onClick = vi.fn()
    renderWithTheme(<Button onClick={onClick}>点我</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('loading 时禁用并标记 aria-busy', async () => {
    const onClick = vi.fn()
    renderWithTheme(<Button loading onClick={onClick}>发布</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('渲染 icon', () => {
    renderWithTheme(<Button icon={<svg data-testid="icon" />}>上传</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
```

`packages/ui/src/tag.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tag } from './tag'
import { renderWithTheme } from './test-utils'

describe('Tag', () => {
  it('渲染文本，默认不可关闭', () => {
    renderWithTheme(<Tag>React</Tag>)
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('closable 时点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn()
    renderWithTheme(<Tag closable onClose={onClose}>Next.js</Tag>)
    await userEvent.click(screen.getByRole('button', { name: '删除标签 Next.js' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('支持自定义关闭文案', () => {
    renderWithTheme(<Tag closable closeLabel="Remove">Vue</Tag>)
    expect(screen.getByRole('button', { name: 'Remove Vue' })).toBeInTheDocument()
  })
})
```

`packages/ui/src/theme-toggle.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'
import { renderWithTheme } from './test-utils'

describe('ThemeToggle', () => {
  it('明亮模式下显示"切换到暗黑模式"，点击后切换', async () => {
    renderWithTheme(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: '切换到暗黑模式' }))
    expect(document.querySelector('.ex-root')).toHaveAttribute('data-ex-theme', 'dark')
    expect(screen.getByRole('button', { name: '切换到明亮模式' })).toBeInTheDocument()
  })

  it('支持自定义文案', () => {
    renderWithTheme(<ThemeToggle labels={{ toLight: 'Light', toDark: 'Dark' }} />)
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: FAIL，提示无法解析 `./button`、`./tag`、`./theme-toggle`。

- [ ] **Step 5: 实现组件**

`packages/ui/src/button.tsx`：

```tsx
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'default' | 'text'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('ex-btn', `ex-btn--${variant}`, `ex-btn--${size}`, loading && 'is-loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="ex-btn__spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="ex-btn__icon" aria-hidden="true">{icon}</span>
      ) : null}
      {children != null && <span className="ex-btn__label">{children}</span>}
    </button>
  )
}
```

`packages/ui/src/tag.tsx`：

```tsx
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'

export interface TagProps {
  children: ReactNode
  closable?: boolean
  onClose?: () => void
  closeLabel?: string
  className?: string
}

export function Tag({ children, closable = false, onClose, closeLabel = '删除标签', className }: TagProps) {
  return (
    <span className={cx('ex-tag', className)}>
      <span className="ex-tag__text">{children}</span>
      {closable && (
        <button
          type="button"
          className="ex-tag__close"
          aria-label={typeof children === 'string' ? `${closeLabel} ${children}` : closeLabel}
          onClick={onClose}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
```

`packages/ui/src/theme-toggle.tsx`：

```tsx
import { useTheme } from '@editorx/theme'
import { Moon, Sun } from 'lucide-react'
import { Button } from './button'

export interface ThemeToggleProps {
  labels?: { toLight: string; toDark: string }
  className?: string
}

const DEFAULT_LABELS = { toLight: '切换到明亮模式', toDark: '切换到暗黑模式' }

export function ThemeToggle({ labels = DEFAULT_LABELS, className }: ThemeToggleProps) {
  const { resolved, setMode } = useTheme()
  const isDark = resolved === 'dark'
  return (
    <Button
      variant="text"
      className={className ? `ex-theme-toggle ${className}` : 'ex-theme-toggle'}
      aria-label={isDark ? labels.toLight : labels.toDark}
      title={isDark ? labels.toLight : labels.toDark}
      icon={isDark ? <Sun size={16} /> : <Moon size={16} />}
      onClick={() => setMode(isDark ? 'light' : 'dark')}
    />
  )
}
```

`packages/ui/src/index.ts`：

```ts
export { Button } from './button'
export type { ButtonProps } from './button'
export { Tag } from './tag'
export type { TagProps } from './tag'
export { ThemeToggle } from './theme-toggle'
export type { ThemeToggleProps } from './theme-toggle'
```

`packages/ui/src/styles.css`：

```css
.ex-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ex-space-1);
  height: 32px;
  padding: 0 var(--ex-space-4);
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-pill);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  font: inherit;
  font-size: var(--ex-font-size-md);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--ex-transition), background-color var(--ex-transition), border-color var(--ex-transition);
}
.ex-btn:hover:not(:disabled) { border-color: var(--ex-color-primary); color: var(--ex-color-primary); }
.ex-btn:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }
.ex-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.ex-btn--sm { height: 28px; padding: 0 var(--ex-space-3); font-size: var(--ex-font-size-sm); }
.ex-btn--lg { height: 36px; padding: 0 var(--ex-space-5); font-size: var(--ex-font-size-lg); }
.ex-btn--primary { background: var(--ex-color-primary); border-color: var(--ex-color-primary); color: #fff; }
.ex-btn--primary:hover:not(:disabled) { background: var(--ex-color-primary-hover); border-color: var(--ex-color-primary-hover); color: #fff; }
.ex-btn--primary:active:not(:disabled) { background: var(--ex-color-primary-active); border-color: var(--ex-color-primary-active); }
.ex-btn--text { border-color: transparent; background: transparent; padding: 0 var(--ex-space-2); }
.ex-btn--text:hover:not(:disabled) { border-color: transparent; background: var(--ex-color-surface-hover); color: var(--ex-color-text); }
.ex-btn__icon { display: inline-flex; }
.ex-btn__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ex-spin 0.8s linear infinite;
}
@keyframes ex-spin { to { transform: rotate(360deg); } }

.ex-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--ex-space-1);
  height: 24px;
  padding: 0 var(--ex-space-2);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface-hover);
  color: var(--ex-color-text-secondary);
  font-size: var(--ex-font-size-sm);
}
.ex-tag__close {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-text-muted);
  cursor: pointer;
}
.ex-tag__close:hover { color: var(--ex-color-primary); }
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: PASS（button 5 个、tag 3 个、theme-toggle 2 个）。

- [ ] **Step 7: 构建与类型检查**

Run: `pnpm turbo run build typecheck --filter=@editorx/ui`
Expected: 成功；`packages/ui/dist/styles.css` 存在。

- [ ] **Step 8: 提交**

```powershell
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): 新增 ui 包及 Button、Tag、ThemeToggle 组件" -m "1. 新增 @editorx/ui 包，@editorx/theme 作为 peerDependency 保证主题上下文单例
2. Button 支持 primary/default/text 变体、三种尺寸、loading 与 icon；Tag 支持可关闭
3. ThemeToggle 基于 useTheme 在亮暗之间切换，文案可覆盖"
```

---

### Task 4: Tooltip / Popover / Dropdown（浮层）

**Files:**
- Create: `packages/ui/src/tooltip.tsx`, `packages/ui/src/popover.tsx`, `packages/ui/src/dropdown.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`
- Test: `packages/ui/src/tooltip.test.tsx`, `packages/ui/src/popover.test.tsx`, `packages/ui/src/dropdown.test.tsx`

**Interfaces:**
- Consumes: `useTheme().portalRoot`（Task 2）、`cx`（Task 3）
- Produces:
  - `interface TooltipProps { content: ReactNode; children: ReactElement<Record<string, unknown>>; placement?: Placement; delay?: number }`（默认 `placement='bottom'`、`delay=300`）
  - `interface PopoverProps { content: (close: () => void) => ReactNode; children: ReactElement<Record<string, unknown>>; placement?: Placement; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string }`（默认 `placement='bottom-start'`）
  - `interface DropdownItem { key: string; label: ReactNode; icon?: ReactNode; disabled?: boolean }`
  - `interface DropdownProps { items: DropdownItem[]; onSelect: (key: string) => void; children: ReactElement<Record<string, unknown>>; placement?: Placement }`
  - 所有浮层 portal 到 `.ex-portal`

- [ ] **Step 1: 安装依赖**

Run: `pnpm --filter @editorx/ui add @floating-ui/react`
Expected: 安装成功。

- [ ] **Step 2: 写失败测试**

`packages/ui/src/tooltip.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './tooltip'
import { renderWithTheme } from './test-utils'

describe('Tooltip', () => {
  it('悬停显示提示，移出后隐藏', async () => {
    renderWithTheme(
      <Tooltip content="加粗 Ctrl+B" delay={0}>
        <button>B</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.hover(screen.getByRole('button', { name: 'B' }))
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('加粗 Ctrl+B')
    expect(tip.closest('.ex-portal')).not.toBeNull()
    await userEvent.unhover(screen.getByRole('button', { name: 'B' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('键盘聚焦也会显示', async () => {
    renderWithTheme(
      <Tooltip content="斜体" delay={0}>
        <button>I</button>
      </Tooltip>,
    )
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('斜体')
  })
})
```

`packages/ui/src/popover.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Popover } from './popover'
import { renderWithTheme } from './test-utils'

describe('Popover', () => {
  it('点击触发器打开，内容渲染在 .ex-portal 内', async () => {
    renderWithTheme(
      <Popover content={() => <p>表格选择器</p>}>
        <button>表格</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '表格' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('表格选择器')
    expect(dialog.closest('.ex-portal')).not.toBeNull()
  })

  it('content 收到的 close 可关闭浮层', async () => {
    renderWithTheme(
      <Popover content={(close) => <button onClick={close}>完成</button>}>
        <button>打开</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await userEvent.click(await screen.findByRole('button', { name: '完成' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('按 Escape 关闭', async () => {
    renderWithTheme(
      <Popover content={() => <p>内容</p>}>
        <button>打开</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('受控模式：由 open 决定显示，交互触发 onOpenChange', async () => {
    const onOpenChange = vi.fn()
    renderWithTheme(
      <Popover open={false} onOpenChange={onOpenChange} content={() => <p>内容</p>}>
        <button>打开</button>
      </Popover>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开' }))
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything(), expect.anything())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

`packages/ui/src/dropdown.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown } from './dropdown'
import { renderWithTheme } from './test-utils'

const items = [
  { key: 'h1', label: '一级标题' },
  { key: 'h2', label: '二级标题' },
  { key: 'h7', label: '不可用', disabled: true },
]

describe('Dropdown', () => {
  it('点击触发器展开菜单项', async () => {
    renderWithTheme(
      <Dropdown items={items} onSelect={() => {}}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(await screen.findAllByRole('menuitem')).toHaveLength(3)
  })

  it('选择后回调 key 并关闭', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Dropdown items={items} onSelect={onSelect}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '二级标题' }))
    expect(onSelect).toHaveBeenCalledWith('h2')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('禁用项不可选择', async () => {
    const onSelect = vi.fn()
    renderWithTheme(
      <Dropdown items={items} onSelect={onSelect}>
        <button>标题</button>
      </Dropdown>,
    )
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    const disabled = await screen.findByRole('menuitem', { name: '不可用' })
    expect(disabled).toBeDisabled()
    await userEvent.click(disabled)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: FAIL，无法解析 `./tooltip`、`./popover`、`./dropdown`。

- [ ] **Step 4: 实现**

`packages/ui/src/tooltip.tsx`：

```tsx
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useState, type ReactElement, type ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  delay?: number
}

export function Tooltip({ content, children, placement = 'bottom', delay = 300 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const { portalRoot } = useTheme()
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: delay, close: 0 }, move: false }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: 'tooltip' }),
  ])

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps(children.props) })}
      {open && (
        <FloatingPortal root={portalRoot}>
          <div ref={refs.setFloating} style={floatingStyles} className="ex-tooltip" {...getFloatingProps()}>
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
```

`packages/ui/src/popover.tsx`：

```tsx
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type OpenChangeReason,
  type Placement,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { cloneElement, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'

export interface PopoverProps {
  content: (close: () => void) => ReactNode
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean, event?: Event, reason?: OpenChangeReason) => void
  className?: string
}

export function Popover({
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

  const setOpen = (next: boolean, event?: Event, reason?: OpenChangeReason) => {
    if (openProp === undefined) setInnerOpen(next)
    onOpenChange?.(next, event, reason)
  }

  const { refs, floatingStyles, context } = useFloating({
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

  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps(children.props) })}
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
    </>
  )
}
```

> 注意：受控测试断言 `onOpenChange` 被调用为 `(true, event, reason)`，与上面签名一致。

`packages/ui/src/dropdown.tsx`：

```tsx
import type { Placement } from '@floating-ui/react'
import type { ReactElement, ReactNode } from 'react'
import { Popover } from './popover'

export interface DropdownItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface DropdownProps {
  items: DropdownItem[]
  onSelect: (key: string) => void
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
}

export function Dropdown({ items, onSelect, children, placement = 'bottom-start' }: DropdownProps) {
  return (
    <Popover
      placement={placement}
      className="ex-dropdown"
      content={(close) => (
        <ul role="menu" className="ex-dropdown__menu">
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                className="ex-dropdown__item"
                disabled={item.disabled}
                onClick={() => {
                  onSelect(item.key)
                  close()
                }}
              >
                {item.icon && <span className="ex-dropdown__icon" aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    >
      {children}
    </Popover>
  )
}
```

`packages/ui/src/index.ts`（追加）：

```ts
export { Tooltip } from './tooltip'
export type { TooltipProps } from './tooltip'
export { Popover } from './popover'
export type { PopoverProps } from './popover'
export { Dropdown } from './dropdown'
export type { DropdownItem, DropdownProps } from './dropdown'
```

`packages/ui/src/styles.css`（追加）：

```css
.ex-tooltip {
  z-index: var(--ex-z-popover);
  max-width: 240px;
  padding: var(--ex-space-1) var(--ex-space-2);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-text);
  color: var(--ex-color-surface);
  font-size: var(--ex-font-size-sm);
  line-height: 1.5;
  pointer-events: none;
}

.ex-popover {
  z-index: var(--ex-z-popover);
  min-width: 120px;
  padding: var(--ex-space-2);
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  box-shadow: var(--ex-shadow-popover);
}
.ex-popover:focus { outline: none; }

.ex-dropdown { padding: var(--ex-space-1) 0; }
.ex-dropdown__menu { margin: 0; padding: 0; list-style: none; }
.ex-dropdown__item {
  display: flex;
  align-items: center;
  gap: var(--ex-space-2);
  width: 100%;
  padding: var(--ex-space-2) var(--ex-space-4);
  border: 0;
  background: transparent;
  color: var(--ex-color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ex-dropdown__item:hover:not(:disabled),
.ex-dropdown__item:focus-visible { background: var(--ex-color-surface-hover); outline: none; }
.ex-dropdown__item:disabled { color: var(--ex-color-text-muted); cursor: not-allowed; }
.ex-dropdown__icon { display: inline-flex; color: var(--ex-color-text-secondary); }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: PASS（新增 tooltip 2、popover 4、dropdown 3）。

- [ ] **Step 6: 构建与类型检查**

Run: `pnpm turbo run build typecheck --filter=@editorx/ui`
Expected: 成功。

- [ ] **Step 7: 提交**

```powershell
git add packages/ui/src/tooltip.tsx packages/ui/src/tooltip.test.tsx packages/ui/src/popover.tsx packages/ui/src/popover.test.tsx packages/ui/src/dropdown.tsx packages/ui/src/dropdown.test.tsx packages/ui/src/index.ts packages/ui/src/styles.css packages/ui/package.json pnpm-lock.yaml
git commit -m "feat(ui): 新增 Tooltip、Popover、Dropdown 浮层组件" -m "1. 基于 @floating-ui/react 实现悬停/聚焦提示、点击弹层与下拉菜单
2. 浮层统一 portal 到 ThemeProvider 的 .ex-portal，继承亮暗主题变量
3. Popover 支持受控/非受控，content 渲染函数接收 close 回调"
```

---

### Task 5: Modal / Tabs

**Files:**
- Create: `packages/ui/src/modal.tsx`, `packages/ui/src/tabs.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`
- Test: `packages/ui/src/modal.test.tsx`, `packages/ui/src/tabs.test.tsx`

**Interfaces:**
- Consumes: `useTheme().portalRoot`、`cx`
- Produces:
  - `interface ModalProps { open: boolean; onClose: () => void; title?: ReactNode; footer?: ReactNode; width?: number | string; closeOnMaskClick?: boolean; closeLabel?: string; className?: string; children: ReactNode }`（默认 `width=520`、`closeOnMaskClick=true`、`closeLabel='关闭'`）
  - `interface TabItem { key: string; label: ReactNode; disabled?: boolean }`
  - `interface TabsProps { items: TabItem[]; activeKey: string; onChange: (key: string) => void; className?: string }`

- [ ] **Step 1: 写失败测试**

`packages/ui/src/modal.test.tsx`：

```tsx
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './modal'
import { renderWithTheme } from './test-utils'

describe('Modal', () => {
  it('open=false 时不渲染', () => {
    renderWithTheme(<Modal open={false} onClose={() => {}} title="插入投票">内容</Modal>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('以标题作为可访问名称，渲染 body 与 footer', () => {
    renderWithTheme(
      <Modal open onClose={() => {}} title="插入投票" footer={<button>确定</button>}>
        投票内容
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: '插入投票' })
    expect(dialog).toHaveTextContent('投票内容')
    expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument()
    expect(dialog.closest('.ex-portal')).not.toBeNull()
  })

  it('点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题">内容</Modal>)
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('按 Escape 触发 onClose', async () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题">内容</Modal>)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩触发 onClose', () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题">内容</Modal>)
    fireEvent.mouseDown(document.querySelector('.ex-modal-mask') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeOnMaskClick=false 时点击遮罩不关闭', () => {
    const onClose = vi.fn()
    renderWithTheme(<Modal open onClose={onClose} title="标题" closeOnMaskClick={false}>内容</Modal>)
    fireEvent.mouseDown(document.querySelector('.ex-modal-mask') as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

`packages/ui/src/tabs.test.tsx`：

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs, type TabItem } from './tabs'
import { renderWithTheme } from './test-utils'

const items: TabItem[] = [
  { key: 'original', label: '原创' },
  { key: 'reprint', label: '转载' },
  { key: 'vip', label: 'VIP', disabled: true },
  { key: 'translated', label: '翻译' },
]

function Controlled({ onChange }: { onChange?: (key: string) => void }) {
  const [active, setActive] = useState('original')
  return (
    <Tabs
      items={items}
      activeKey={active}
      onChange={(key) => {
        setActive(key)
        onChange?.(key)
      }}
    />
  )
}

describe('Tabs', () => {
  it('标记选中项', () => {
    renderWithTheme(<Tabs items={items} activeKey="reprint" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '转载' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '原创' })).toHaveAttribute('aria-selected', 'false')
  })

  it('点击触发 onChange', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Tabs items={items} activeKey="original" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '翻译' }))
    expect(onChange).toHaveBeenCalledWith('translated')
  })

  it('方向键跳过禁用项并循环', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Controlled onChange={onChange} />)
    screen.getByRole('tab', { name: '原创' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('reprint')
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('translated')
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('original')
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('translated')
    expect(screen.getByRole('tab', { name: '翻译' })).toHaveFocus()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: FAIL，无法解析 `./modal`、`./tabs`。

- [ ] **Step 3: 实现**

`packages/ui/src/modal.tsx`：

```tsx
import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useTheme } from '@editorx/theme'
import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cx } from './cx'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  footer?: ReactNode
  width?: number | string
  closeOnMaskClick?: boolean
  closeLabel?: string
  className?: string
  children: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  footer,
  width = 520,
  closeOnMaskClick = true,
  closeLabel = '关闭',
  className,
  children,
}: ModalProps) {
  const { portalRoot } = useTheme()
  const titleId = useId()
  const { refs, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: closeOnMaskClick, outsidePressEvent: 'mousedown' }),
    useRole(context, { role: 'dialog' }),
  ])

  if (!open) return null

  return (
    <FloatingPortal root={portalRoot}>
      <FloatingOverlay className="ex-modal-mask" lockScroll>
        <FloatingFocusManager context={context}>
          <div
            ref={refs.setFloating}
            className={cx('ex-modal', className)}
            style={{ width }}
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
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
  )
}
```

`packages/ui/src/tabs.tsx`：

```tsx
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'

export interface TabItem {
  key: string
  label: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ items, activeKey, onChange, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const move = (from: number, step: 1 | -1) => {
    const enabled = items.filter((item) => !item.disabled)
    if (enabled.length === 0) return
    const current = items[from]
    const pos = enabled.findIndex((item) => item.key === current?.key)
    const next = enabled[(pos + step + enabled.length) % enabled.length]
    if (!next) return
    onChange(next.key)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-key="${next.key}"]`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      move(index, 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      move(index, -1)
    }
  }

  return (
    <div ref={listRef} role="tablist" className={cx('ex-tabs', className)}>
      {items.map((item, index) => {
        const selected = item.key === activeKey
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            data-key={item.key}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={cx('ex-tabs__tab', selected && 'is-active')}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
```

`packages/ui/src/index.ts`（追加）：

```ts
export { Modal } from './modal'
export type { ModalProps } from './modal'
export { Tabs } from './tabs'
export type { TabItem, TabsProps } from './tabs'
```

`packages/ui/src/styles.css`（追加）：

```css
.ex-modal-mask {
  z-index: var(--ex-z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ex-color-mask);
}
.ex-modal {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  box-shadow: var(--ex-shadow-modal);
}
.ex-modal:focus { outline: none; }
.ex-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ex-space-4) var(--ex-space-6);
}
.ex-modal__title { margin: 0; font-size: var(--ex-font-size-lg); font-weight: 600; }
.ex-modal__close {
  display: inline-flex;
  margin-left: auto;
  padding: var(--ex-space-1);
  border: 0;
  border-radius: var(--ex-radius-md);
  background: transparent;
  color: var(--ex-color-text-muted);
  cursor: pointer;
}
.ex-modal__close:hover { background: var(--ex-color-surface-hover); color: var(--ex-color-text); }
.ex-modal__body { flex: 1; overflow: auto; padding: 0 var(--ex-space-6) var(--ex-space-4); }
.ex-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ex-space-3);
  padding: var(--ex-space-3) var(--ex-space-6) var(--ex-space-5);
}

.ex-tabs { display: flex; gap: var(--ex-space-6); border-bottom: 1px solid var(--ex-color-border); }
.ex-tabs__tab {
  position: relative;
  padding: var(--ex-space-2) 0;
  border: 0;
  background: transparent;
  color: var(--ex-color-text-secondary);
  font: inherit;
  cursor: pointer;
}
.ex-tabs__tab:hover:not(:disabled) { color: var(--ex-color-text); }
.ex-tabs__tab:disabled { color: var(--ex-color-text-muted); cursor: not-allowed; }
.ex-tabs__tab:focus-visible { outline: 2px solid var(--ex-color-primary); outline-offset: 2px; }
.ex-tabs__tab.is-active { color: var(--ex-color-text); font-weight: 600; }
.ex-tabs__tab.is-active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--ex-color-primary);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: PASS（新增 modal 6、tabs 3）。

- [ ] **Step 5: 构建与类型检查**

Run: `pnpm turbo run build typecheck --filter=@editorx/ui`
Expected: 成功。

- [ ] **Step 6: 提交**

```powershell
git add packages/ui/src/modal.tsx packages/ui/src/modal.test.tsx packages/ui/src/tabs.tsx packages/ui/src/tabs.test.tsx packages/ui/src/index.ts packages/ui/src/styles.css
git commit -m "feat(ui): 新增 Modal 弹窗与 Tabs 标签页组件" -m "1. Modal 支持标题、底部操作区、Esc 与遮罩关闭（可关闭遮罩关闭）、焦点锁定与滚动锁定
2. Tabs 支持禁用项与左右方向键循环切换，符合 tablist/tab 无障碍语义
3. 弹窗 portal 到 .ex-portal，跟随亮暗主题"
```

---

### Task 6: Toast（`ToastProvider` / `useToast`）

**Files:**
- Create: `packages/ui/src/toast.tsx`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/styles.css`
- Test: `packages/ui/src/toast.test.tsx`

**Interfaces:**
- Consumes: `useTheme().portalRoot`
- Produces:
  - `type ToastType = 'info' | 'success' | 'warning' | 'error'`
  - `interface ToastApi { notify(message: ReactNode, type?: ToastType, duration?: number): void }`
  - `interface ToastProviderProps { duration?: number; children: ReactNode }`（默认 `duration=3000`）
  - `ToastProvider(props)`；`useToast(): ToastApi`（Provider 外调用抛出 `Error('useToast must be used within <ToastProvider>')`）
  - 阶段 3 的 `ExtensionContext.notify` 将直接委托 `useToast().notify`

- [ ] **Step 1: 写失败测试**

`packages/ui/src/toast.test.tsx`：

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@editorx/theme'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast, type ToastType } from './toast'

function Trigger({ type, duration }: { type?: ToastType; duration?: number }) {
  const { notify } = useToast()
  return <button onClick={() => notify('草稿已保存', type, duration)}>notify</button>
}

function setup(ui: ReactNode, duration?: number) {
  return render(
    <ThemeProvider defaultTheme="light" storageKey={false}>
      <ToastProvider duration={duration}>{ui}</ToastProvider>
    </ThemeProvider>,
  )
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('notify 显示消息并带类型类名，渲染在 .ex-portal 内', () => {
    setup(<Trigger type="success" />)
    fireEvent.click(screen.getByText('notify'))
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('草稿已保存')
    expect(toast).toHaveClass('ex-toast', 'ex-toast--success')
    expect(toast.closest('.ex-portal')).not.toBeNull()
  })

  it('默认类型为 info', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getByRole('status')).toHaveClass('ex-toast--info')
  })

  it('到达 Provider 默认时长后自动消失', () => {
    setup(<Trigger />, 1000)
    fireEvent.click(screen.getByText('notify'))
    act(() => vi.advanceTimersByTime(999))
    expect(screen.queryByRole('status')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('单次调用的 duration 覆盖默认时长', () => {
    setup(<Trigger duration={500} />)
    fireEvent.click(screen.getByText('notify'))
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('可同时显示多条', () => {
    setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    fireEvent.click(screen.getByText('notify'))
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('卸载时清理定时器', () => {
    const { unmount } = setup(<Trigger />)
    fireEvent.click(screen.getByText('notify'))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('Provider 外调用 useToast 抛错', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow('useToast must be used within <ToastProvider>')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: FAIL，无法解析 `./toast`。

- [ ] **Step 3: 实现**

`packages/ui/src/toast.tsx`：

```tsx
import { useTheme } from '@editorx/theme'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastApi {
  notify(message: ReactNode, type?: ToastType, duration?: number): void
}

export interface ToastProviderProps {
  duration?: number
  children: ReactNode
}

interface ToastItem {
  id: number
  message: ReactNode
  type: ToastType
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ duration = 3000, children }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())
  const { portalRoot } = useTheme()

  const remove = useCallback((id: number) => {
    timers.current.delete(id)
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (message: ReactNode, type: ToastType = 'info', itemDuration: number = duration) => {
      const id = ++nextId.current
      setItems((list) => [...list, { id, message, type }])
      timers.current.set(id, window.setTimeout(() => remove(id), itemDuration))
    },
    [duration, remove],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portalRoot &&
        createPortal(
          <div className="ex-toast-stack" aria-live="polite">
            {items.map((item) => (
              <div key={item.id} role="status" className={`ex-toast ex-toast--${item.type}`}>
                {item.message}
              </div>
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

`packages/ui/src/index.ts`（追加）：

```ts
export { ToastProvider, useToast } from './toast'
export type { ToastApi, ToastProviderProps, ToastType } from './toast'
```

`packages/ui/src/styles.css`（追加）：

```css
.ex-toast-stack {
  position: fixed;
  top: var(--ex-space-6);
  left: 50%;
  z-index: var(--ex-z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ex-space-2);
  transform: translateX(-50%);
  pointer-events: none;
}
.ex-toast {
  padding: var(--ex-space-2) var(--ex-space-4);
  border-left: 3px solid var(--ex-color-info);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-text);
  box-shadow: var(--ex-shadow-popover);
  pointer-events: auto;
}
.ex-toast--success { border-left-color: var(--ex-color-success); }
.ex-toast--warning { border-left-color: var(--ex-color-warning); }
.ex-toast--error { border-left-color: var(--ex-color-error); }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm turbo run test --filter=@editorx/ui`
Expected: PASS（新增 toast 7 个；ui 包合计 35 个）。

- [ ] **Step 5: 构建、类型检查、lint**

Run: `pnpm turbo run build typecheck --filter=@editorx/ui; pnpm lint`
Expected: 全部成功，lint 无 error。

- [ ] **Step 6: 提交**

```powershell
git add packages/ui/src/toast.tsx packages/ui/src/toast.test.tsx packages/ui/src/index.ts packages/ui/src/styles.css
git commit -m "feat(ui): 新增 ToastProvider 与 useToast 全局提示" -m "1. 支持 info/success/warning/error 四种类型，Provider 级默认时长与单次覆盖
2. 提示渲染到 .ex-portal 并以 aria-live 播报，卸载时清理所有定时器
3. 为后续扩展上下文的 notify 能力提供底层实现"
```

---

### Task 7: Next.js 16 playground（showcase + compare + Playwright 视觉基线）

**Files:**
- Create: `apps/playground/package.json`, `apps/playground/tsconfig.json`, `apps/playground/next.config.ts`, `apps/playground/playwright.config.ts`
- Create: `apps/playground/app/layout.tsx`, `apps/playground/app/globals.css`, `apps/playground/app/page.tsx`
- Create: `apps/playground/app/showcase/page.tsx`, `apps/playground/app/showcase/showcase.tsx`
- Create: `apps/playground/app/compare/page.tsx`, `apps/playground/app/compare/compare-view.tsx`
- Create: `apps/playground/public/reference/.gitkeep`
- Test: `apps/playground/e2e/showcase.spec.ts`, `apps/playground/e2e/compare.spec.ts`

**Interfaces:**
- Consumes: `@editorx/theme`（`ThemeProvider`、`styles.css`）、`@editorx/ui`（全部组件与 `styles.css`）
- Produces:
  - 路由 `/showcase`：所有 ui 组件在一个 `ThemeProvider` + `ToastProvider` 下的展示页（后续阶段在此追加编辑器演示）
  - 路由 `/compare?ref=<文件名>&target=<路径>`：左右并排或叠加对比 `public/reference/<文件名>` 与 iframe 中的 `<路径>`（默认 `/showcase`），透明度可调
  - 端口：3100

- [ ] **Step 1: 创建 playground 配置**

`apps/playground/package.json`：

```json
{
  "name": "@editorx/playground",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3100",
    "build": "next build",
    "start": "next start --port 3100",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@editorx/theme": "workspace:*",
    "@editorx/ui": "workspace:*"
  }
}
```

Run:

```powershell
pnpm --filter @editorx/playground add next react react-dom lucide-react
pnpm --filter @editorx/playground add -D @playwright/test @types/node @types/react @types/react-dom typescript@~5.9.3
pnpm --filter @editorx/playground exec playwright install chromium
```

Expected: 依赖安装成功，Chromium 下载完成；`next` 版本为 16.x。

`apps/playground/tsconfig.json`：

```json
{
  "extends": "../../tooling/tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": false,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/playground/next.config.ts`：

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
}

export default config
```

`apps/playground/playwright.config.ts`：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 2: 写失败的 E2E 测试**

`apps/playground/e2e/showcase.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/showcase')
})

test('切换主题会更新 data-ex-theme', async ({ page }) => {
  const root = page.locator('.ex-root').first()
  await expect(root).toHaveAttribute('data-ex-theme', 'light')
  await page.getByRole('button', { name: '切换到暗黑模式' }).click()
  await expect(root).toHaveAttribute('data-ex-theme', 'dark')
})

test('弹窗可打开并按 Esc 关闭', async ({ page }) => {
  await page.getByRole('button', { name: '打开弹窗' }).click()
  await expect(page.getByRole('dialog', { name: '插入投票' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '插入投票' })).toBeHidden()
})

test('Toast 提示可见', async ({ page }) => {
  await page.getByRole('button', { name: '显示提示' }).click()
  await expect(page.getByRole('status')).toHaveText('草稿已保存')
})

test('视觉基线：明亮模式', async ({ page }) => {
  await expect(page).toHaveScreenshot('showcase-light.png', { fullPage: true })
})

test('视觉基线：暗黑模式', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/showcase')
  await expect(page.locator('.ex-root').first()).toHaveAttribute('data-ex-theme', 'dark')
  await expect(page).toHaveScreenshot('showcase-dark.png', { fullPage: true })
})
```

`apps/playground/e2e/compare.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test('对照页渲染目标 iframe 与透明度滑块', async ({ page }) => {
  await page.goto('/compare?target=/showcase')
  await expect(page.locator('iframe[title="目标页面"]')).toHaveAttribute('src', '/showcase')
  await expect(page.getByRole('slider', { name: '参考图透明度' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '叠加' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '并排' })).toBeVisible()
})

test('无参考图时显示放置提示', async ({ page }) => {
  await page.goto('/compare?ref=__missing__.png')
  await expect(page.getByText('public/reference/')).toBeVisible()
})
```

- [ ] **Step 3: 运行 E2E 确认失败**

Run: `pnpm turbo run e2e --filter=@editorx/playground`
Expected: FAIL（`next build` 报错找不到 `app` 目录，或页面 404）。

- [ ] **Step 4: 实现应用骨架**

`apps/playground/app/globals.css`：

```css
html,
body {
  margin: 0;
  padding: 0;
}

.pg-page {
  min-height: 100vh;
  padding: var(--ex-space-6);
  background: var(--ex-color-bg);
  box-sizing: border-box;
}

.pg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ex-space-6);
}

.pg-section {
  margin-bottom: var(--ex-space-6);
  padding: var(--ex-space-5);
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
}

.pg-section h2 {
  margin: 0 0 var(--ex-space-4);
  font-size: var(--ex-font-size-lg);
}

.pg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ex-space-3);
}

.pg-compare {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: system-ui, sans-serif;
}

.pg-compare__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid #ddd;
}

.pg-compare__stage {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.pg-compare__stage iframe,
.pg-compare__stage img {
  width: 100%;
  height: 100%;
  border: 0;
  object-fit: contain;
  object-position: top left;
}

.pg-compare__stage--side > * {
  flex: 1;
  min-width: 0;
}

.pg-compare__stage--overlay img {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pg-compare__empty {
  padding: 24px;
  color: #666;
}
```

`apps/playground/app/layout.tsx`：

```tsx
import '@editorx/theme/styles.css'
import '@editorx/ui/styles.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'EditorX Playground',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

`apps/playground/app/page.tsx`：

```tsx
import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>EditorX Playground</h1>
      <ul>
        <li><Link href="/showcase">组件展示 /showcase</Link></li>
        <li><Link href="/compare">还原度对照 /compare</Link></li>
      </ul>
    </main>
  )
}
```

`apps/playground/app/showcase/page.tsx`：

```tsx
import { Showcase } from './showcase'

export default function ShowcasePage() {
  return <Showcase />
}
```

`apps/playground/app/showcase/showcase.tsx`：

```tsx
'use client'

import { ThemeProvider } from '@editorx/theme'
import {
  Button,
  Dropdown,
  Modal,
  Popover,
  Tabs,
  Tag,
  ThemeToggle,
  ToastProvider,
  Tooltip,
  useToast,
} from '@editorx/ui'
import { Bold, Heading, Upload } from 'lucide-react'
import { useState } from 'react'

const articleTypes = [
  { key: 'original', label: '原创' },
  { key: 'reprint', label: '转载' },
  { key: 'translated', label: '翻译' },
]

function Sections() {
  const { notify } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [tags, setTags] = useState(['React', 'Next.js', '前端'])
  const [articleType, setArticleType] = useState('original')
  const [heading, setHeading] = useState('未选择')

  return (
    <>
      <section className="pg-section">
        <h2>Button</h2>
        <div className="pg-row">
          <Button variant="primary">发布文章</Button>
          <Button>保存草稿</Button>
          <Button variant="text" icon={<Upload size={16} />}>上传</Button>
          <Button size="sm">小按钮</Button>
          <Button size="lg">大按钮</Button>
          <Button loading>保存中</Button>
          <Button disabled>禁用</Button>
        </div>
      </section>

      <section className="pg-section">
        <h2>Tag</h2>
        <div className="pg-row">
          {tags.map((tag) => (
            <Tag key={tag} closable onClose={() => setTags((list) => list.filter((t) => t !== tag))}>
              {tag}
            </Tag>
          ))}
        </div>
      </section>

      <section className="pg-section">
        <h2>Tooltip / Popover / Dropdown</h2>
        <div className="pg-row">
          <Tooltip content="加粗 Ctrl+B">
            <Button variant="text" icon={<Bold size={16} />} aria-label="加粗" />
          </Tooltip>
          <Popover content={(close) => (
            <div className="pg-row">
              <span>表格 3 × 4</span>
              <Button size="sm" variant="primary" onClick={close}>插入</Button>
            </div>
          )}>
            <Button>表格</Button>
          </Popover>
          <Dropdown
            items={[
              { key: 'h1', label: '一级标题' },
              { key: 'h2', label: '二级标题' },
              { key: 'h3', label: '三级标题' },
            ]}
            onSelect={setHeading}
          >
            <Button icon={<Heading size={16} />}>标题</Button>
          </Dropdown>
          <span>已选：{heading}</span>
        </div>
      </section>

      <section className="pg-section">
        <h2>Tabs</h2>
        <Tabs items={articleTypes} activeKey={articleType} onChange={setArticleType} />
      </section>

      <section className="pg-section">
        <h2>Modal / Toast</h2>
        <div className="pg-row">
          <Button onClick={() => setModalOpen(true)}>打开弹窗</Button>
          <Button onClick={() => notify('草稿已保存', 'success')}>显示提示</Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="插入投票"
          footer={
            <>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>确定</Button>
            </>
          }
        >
          这里是投票表单。
        </Modal>
      </section>
    </>
  )
}

export function Showcase() {
  return (
    <ThemeProvider storageKey="editorx-playground-theme">
      <ToastProvider>
        <main className="pg-page">
          <header className="pg-header">
            <h1>EditorX 组件展示</h1>
            <ThemeToggle />
          </header>
          <Sections />
        </main>
      </ToastProvider>
    </ThemeProvider>
  )
}
```

`apps/playground/app/compare/page.tsx`：

```tsx
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { CompareView } from './compare-view'

async function listReferences(): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), 'public', 'reference'))
    return files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file)).sort()
  } catch {
    return []
  }
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; target?: string }>
}) {
  const { ref, target } = await searchParams
  const references = await listReferences()
  const selected = ref && references.includes(ref) ? ref : references[0]
  return <CompareView references={references} selected={selected} target={target ?? '/showcase'} />
}
```

`apps/playground/app/compare/compare-view.tsx`：

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CompareViewProps {
  references: string[]
  selected?: string
  target: string
}

export function CompareView({ references, selected, target }: CompareViewProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'overlay' | 'side'>('overlay')
  const [opacity, setOpacity] = useState(50)

  const navigate = (next: { ref?: string; target?: string }) => {
    const params = new URLSearchParams()
    const ref = next.ref ?? selected
    if (ref) params.set('ref', ref)
    params.set('target', next.target ?? target)
    router.replace(`/compare?${params.toString()}`)
  }

  return (
    <div className="pg-compare">
      <div className="pg-compare__bar">
        <label>
          参考图{' '}
          <select value={selected ?? ''} onChange={(e) => navigate({ ref: e.target.value })} disabled={!references.length}>
            {references.map((file) => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
        </label>
        <label>
          目标路径{' '}
          <input defaultValue={target} onBlur={(e) => navigate({ target: e.target.value })} />
        </label>
        <span role="radiogroup" aria-label="对比模式">
          <label><input type="radio" name="mode" checked={mode === 'overlay'} onChange={() => setMode('overlay')} />叠加</label>
          <label><input type="radio" name="mode" checked={mode === 'side'} onChange={() => setMode('side')} />并排</label>
        </span>
        <label>
          参考图透明度{' '}
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            aria-label="参考图透明度"
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
      </div>
      <div className={`pg-compare__stage pg-compare__stage--${mode}`}>
        <iframe title="目标页面" src={target} />
        {selected ? (
          <img src={`/reference/${selected}`} alt="CSDN 参考截图" style={{ opacity: mode === 'overlay' ? opacity / 100 : 1 }} />
        ) : (
          <p className="pg-compare__empty">
            未找到参考截图：请将登录 CSDN 后截取的图片放入 <code>apps/playground/public/reference/</code>
          </p>
        )}
      </div>
    </div>
  )
}
```

> 参考截图需按原始像素展示，故使用原生 `<img>` 而非 `next/image`；根 eslint 配置未启用 `@next/next` 插件，无需 disable 注释。

创建空文件 `apps/playground/public/reference/.gitkeep`。

- [ ] **Step 5: 生成视觉基线并运行 E2E**

Run:

```powershell
pnpm turbo run build --filter=@editorx/playground
pnpm --filter @editorx/playground exec playwright test --update-snapshots
pnpm turbo run e2e --filter=@editorx/playground
```

Expected:
- 第二条命令生成 `apps/playground/e2e/showcase.spec.ts-snapshots/showcase-light-chromium-win32.png` 与 `showcase-dark-chromium-win32.png`。
- 第三条命令 7 个用例全部 PASS。
- 人工打开两张基线截图确认：明亮模式白底红色主按钮；暗黑模式深色背景、文字浅色、主按钮仍为红色。

- [ ] **Step 6: 全仓验证**

Run: `pnpm build; pnpm test; pnpm typecheck; pnpm lint`
Expected: 全部成功（theme 14 个、ui 35 个单元测试通过，lint 无 error）。

- [ ] **Step 7: 提交**

```powershell
git add apps/playground pnpm-lock.yaml
git commit -m "feat(playground): 新增 Next.js 16 示例应用、组件展示页与还原度对照页" -m "1. /showcase 在 ThemeProvider 与 ToastProvider 下展示全部 ui 组件，用于开发与视觉基线
2. /compare 支持叠加/并排对比 public/reference/ 下的 CSDN 参考截图与目标页面，透明度可调
3. 新增 Playwright E2E 与亮暗两套视觉基线（像素差异阈值 0.1%）"
```

---

## 后续阶段

本计划完成后，按 spec §10 依次为以下阶段单独编写计划（每个阶段开始前再编写，以便吸收前一阶段的实际产出）：

2. `markdown-core`
3. `toolbar` 扩展 API + `<MarkdownEditor />`
4. `<PublishPanel />`
5. `<RichTextEditor />`
6. `<CsdnEditor />`
7. `csdn-extensions`
8. 发布准备
