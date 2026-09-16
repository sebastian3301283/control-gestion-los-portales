# Frontend Code Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the application's first-load JavaScript by lazy-loading the authenticated dashboard and heavy dashboard modules while preserving current navigation and behavior.

**Architecture:** `App.tsx` will dynamically import `DashboardRestricted`, making authentication the only eagerly loaded application UI. `Dashboard.tsx` will dynamically import `CatalogConfiguration`, `PlanningGuidelines`, and `MatrixWorkspace`, with explicit non-blocking prefetch helpers triggered before likely navigation. `Suspense` fallbacks will preserve usable transitions without changing data flow.

**Tech Stack:** React 19, TypeScript, Vite, Supabase JS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-08-frontend-code-splitting-design.md`

## Global Constraints

- Work only on `auditoria-codex-parcial`.
- Do not modify `main`.
- Do not modify `supabase/**`.
- Preserve current authentication, permission, Realtime, Storage, import, and navigation behavior.
- Keep existing planning-data prefetching intact.
- Do not introduce aggressive `manualChunks` in this iteration.
- Baseline production JS: 611.26 kB minified / 167.81 kB gzip.

---

### Task 1: Add lazy-loading regressions

**Files:**
- Create: `tests/frontend-code-splitting.test.mjs`
- Test: `tests/frontend-code-splitting.test.mjs`

**Interfaces:**
- Consumes: source text from `src/App.tsx` and `src/Dashboard.tsx`.
- Produces: regression requirements for dynamic imports and no eager heavy-module imports.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/Dashboard.tsx', import.meta.url), 'utf8')

test('authentication does not eagerly import the authenticated dashboard', () => {
  assert.doesNotMatch(app, /^import Dashboard from '.\/DashboardRestricted'/m)
  assert.match(app, /lazy\(\(\) => import\('\.\/DashboardRestricted'\)\)/)
  assert.match(app, /Suspense/)
})

test('dashboard lazily loads heavy configuration and planning workspaces', () => {
  for (const moduleName of ['CatalogConfiguration', 'PlanningGuidelines', 'MatrixWorkspace']) {
    assert.doesNotMatch(dashboard, new RegExp(`^import ${moduleName} from`, 'm'))
    assert.match(dashboard, new RegExp(`lazy\\(\\(\\) => import\\('\\.\\/${moduleName}'\\)\\)`))
  }
})

test('dashboard prefetches lazy chunks before likely navigation without awaiting them', () => {
  assert.match(dashboard, /prefetchPlanningGuidelinesModule/)
  assert.match(dashboard, /prefetchMatrixWorkspaceModule/)
  assert.match(dashboard, /prefetchCatalogConfigurationModule/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/frontend-code-splitting.test.mjs`
Expected: FAIL because the heavy modules are still statically imported.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/frontend-code-splitting.test.mjs
git commit -m "test: require frontend code splitting"
```

### Task 2: Split authentication from the dashboard

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/auth-access.test.mjs`
- Test: `tests/frontend-code-splitting.test.mjs`

**Interfaces:**
- Consumes: `DashboardRestricted` default export.
- Produces: lazy `Dashboard` component and a `prefetchDashboardModule(): void` helper.

- [ ] **Step 1: Add lazy import and lightweight fallback**

Use React `lazy` and `Suspense`, define a module loader function reused for lazy import and prefetch, and render the dashboard inside `Suspense` only when `access` is available.

- [ ] **Step 2: Prefetch the dashboard while resolving an existing authenticated session**

After `getSession()` confirms a session, call `void loadDashboardModule()` before awaiting `current_access`; do not block access resolution on the import.

- [ ] **Step 3: Preserve password and OTP login behavior**

Keep `setAccess(currentAccess)` and existing sign-out/error paths unchanged.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/auth-access.test.mjs tests/frontend-code-splitting.test.mjs`
Expected: App-specific tests PASS; dashboard heavy-module split test remains RED until Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/auth-access.test.mjs tests/frontend-code-splitting.test.mjs
git commit -m "perf: lazy load authenticated dashboard"
```

### Task 3: Split heavy dashboard modules and prefetch code

**Files:**
- Modify: `src/Dashboard.tsx`
- Test: `tests/frontend-code-splitting.test.mjs`
- Test: existing planning/navigation regression suite.

**Interfaces:**
- Consumes: default exports from `CatalogConfiguration`, `PlanningGuidelines`, and `MatrixWorkspace`.
- Produces: lazy components plus non-blocking module prefetch functions.

- [ ] **Step 1: Replace static imports with reusable loaders**

Define loaders:

```ts
const loadCatalogConfigurationModule = () => import('./CatalogConfiguration')
const loadPlanningGuidelinesModule = () => import('./PlanningGuidelines')
const loadMatrixWorkspaceModule = () => import('./MatrixWorkspace')

const CatalogConfiguration = lazy(loadCatalogConfigurationModule)
const PlanningGuidelines = lazy(loadPlanningGuidelinesModule)
const MatrixWorkspace = lazy(loadMatrixWorkspaceModule)
```

Define non-blocking helpers that catch import failures:

```ts
function prefetchCatalogConfigurationModule() { void loadCatalogConfigurationModule().catch(() => undefined) }
function prefetchPlanningGuidelinesModule() { void loadPlanningGuidelinesModule().catch(() => undefined) }
function prefetchMatrixWorkspaceModule() { void loadMatrixWorkspaceModule().catch(() => undefined) }
```

- [ ] **Step 2: Wrap lazy module render points in `Suspense`**

Use the existing planning loading visual language (`LoaderCircle`) as fallback. Do not change page structure or navigation state.

- [ ] **Step 3: Prefetch before section/module navigation**

Call configuration prefetch when navigating to Configuración; planning-guidelines prefetch when entering Planificación/Lineamientos; matrix prefetch before opening matrix. Keep existing data-prefetch calls unchanged and non-blocking.

- [ ] **Step 4: Run regression tests**

Run: `node --test tests/*.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Run TypeScript**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Build and capture bundle sizes**

Run: `npm run build`
Expected: PASS and multiple JS chunks. Record initial entry chunk minified/gzip sizes and compare with 611.26/167.81 kB baseline.

- [ ] **Step 7: Commit**

```bash
git add src/Dashboard.tsx tests/frontend-code-splitting.test.mjs
git commit -m "perf: lazy load dashboard modules"
```

### Task 4: Final CI and scope verification

**Files:**
- No production changes expected unless verification exposes an issue.

**Interfaces:**
- Consumes: final branch HEAD.
- Produces: exact final SHA, CI run, regression count, TypeScript/build result, bundle measurements, and scope comparison.

- [ ] **Step 1: Verify branch diff excludes Supabase**

Compare the starting HEAD `0a4c4f97039551c3a1cf65974b924d5808ea72c2` to final HEAD and confirm no `supabase/**` files changed.

- [ ] **Step 2: Verify GitHub Actions on exact final HEAD**

Confirm `Validate application` completes with `success` and regression tests, TypeScript, and production build all succeed.

- [ ] **Step 3: Report measured improvement**

Report old vs new initial bundle size and list the generated lazy chunks. Do not claim completion before exact-HEAD CI is green.
