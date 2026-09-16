# Planning Matrix Polish and Multi-Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar Lineamientos/Matrices de HU/DEP/VS/HOT, hacer Historial usable en fullscreen, exportar Excel profesional, eliminar flashes de carga y soportar varias gerencias/responsables por lineamiento sin perder compatibilidad.

**Architecture:** Se mantienen los campos primarios actuales en `planning_guidelines` y se añaden tablas de relación para propiedad múltiple. El frontend consulta relaciones tipadas mediante el caché de planificación, usa una UI multiselect no Central, muestra encabezado rico en matriz, comparte un exportador Excel estilizado lazy-loaded y mueve Historial a un portal global con resumen de diffs por versión. Central conserva su modelo especial salvo Historial/Excel compartidos.

**Tech Stack:** React 19, TypeScript, Vite, Supabase/Postgres/RLS, SheetJS-compatible `xlsx-js-style` ESM remoto, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-08-planning-matrix-polish-multi-ownership-design.md`

## Global Constraints

- No tocar `main`.
- Todo el código va a `auditoria-codex-parcial`.
- Central no adopta multigerencia/multiresponsable ni selector de Objetivo general no Central.
- Mantener una sola matriz por lineamiento HU/DEP/VS/HOT.
- Preservar compatibilidad con `planning_guidelines.management_id` y `responsible_manager_id`.
- Aplicar migración a Supabase solo después de validar SQL y frontend compatible.
- Cada bloque comienza con prueba RED y termina con pruebas GREEN.

---

### Task 1: Regresiones de contrato para los siete cambios visuales/funcionales

**Files:**
- Create: `tests/planning-matrix-polish.test.mjs`
- Test: `tests/planning-matrix-polish.test.mjs`

**Interfaces:**
- Consumes: código actual de `Dashboard.tsx`, `GuidelineCatalogV2.tsx`, `UnitExcelWorkspace.tsx`, `MatrixWorkspaceV12.tsx`, `CentralExcelWorkspace.tsx`.
- Produces: contratos estáticos que obligan a portal de historial, multiselección no Central, catálogo por `matrix_unit_area_catalog`, header de matriz, selector de objetivo y exportador compartido.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const guideline = await readFile(new URL('../src/GuidelineCatalogV2.tsx', import.meta.url), 'utf8')
const unitMatrix = await readFile(new URL('../src/UnitExcelWorkspace.tsx', import.meta.url), 'utf8')
const history = await readFile(new URL('../src/MatrixWorkspaceV12.tsx', import.meta.url), 'utf8')

test('lineamientos no Central usan relaciones múltiples y catálogo activado', () => {
  assert.match(guideline, /loadGuidelineMultiRelations/)
  assert.match(guideline, /matrix_unit_area_catalog/)
  assert.match(guideline, /selectedManagementIds/)
  assert.match(guideline, /selectedResponsibleIds/)
})

test('matriz no Central muestra encabezado y selector de objetivo', () => {
  assert.match(unitMatrix, /matrix-unit-plan-header/)
  assert.match(unitMatrix, /Objetivo general/)
  assert.match(unitMatrix, /Crear nuevo objetivo/)
})

test('historial usa portal global y detalle expandible', () => {
  assert.match(history, /createPortal/)
  assert.match(history, /summarizeMatrixVersionChanges/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/planning-matrix-polish.test.mjs`
Expected: FAIL porque los nuevos contratos aún no existen.

- [ ] **Step 3: Commit RED regression**

Commit message: `test: cover planning matrix polish requirements`

---

### Task 2: Migración de propiedad múltiple y acceso RLS no Central

**Files:**
- Create: `supabase/migrations/20260908223000_planning_guideline_multi_ownership.sql`
- Create: `tests/supabase-guideline-multi-ownership.test.mjs`

**Interfaces:**
- Produces:
  - `planning_guideline_managements(guideline_id uuid, management_id uuid, sort_order int, created_at timestamptz)`
  - `planning_guideline_responsibles(guideline_id uuid, manager_id uuid, sort_order int, created_at timestamptz)`
  - `save_planning_guideline_multi(...) returns uuid`
  - `can_access_guideline_multi(uuid) returns boolean`
  - `can_edit_guideline_multi(uuid) returns boolean`

- [ ] **Step 1: Write failing migration test**

Assert the migration contains both relation tables, composite PKs, backfill inserts, RLS, helper access functions, save RPC and execute grants restricted to authenticated/global manager logic.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/supabase-guideline-multi-ownership.test.mjs`
Expected: FAIL because migration is absent.

- [ ] **Step 3: Implement migration**

Core SQL shape:

```sql
create table if not exists public.planning_guideline_managements (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  management_id uuid not null references public.managements_global(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, management_id)
);

create table if not exists public.planning_guideline_responsibles (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, manager_id)
);

insert into public.planning_guideline_managements (guideline_id, management_id, sort_order)
select id, management_id, 0 from public.planning_guidelines
on conflict do nothing;

insert into public.planning_guideline_responsibles (guideline_id, manager_id, sort_order)
select id, responsible_manager_id, 0 from public.planning_guidelines
where responsible_manager_id is not null
on conflict do nothing;
```

`save_planning_guideline_multi` must:
- require `is_global_planning_manager()`;
- validate non-empty management ids;
- for non Central require every management in `matrix_unit_area_catalog` for requested unit;
- validate every responsible active and linked through `manager_managements` to at least one selected management;
- insert/update parent with first ids;
- replace relation rows atomically preserving order;
- return guideline id.

`can_access_guideline_multi` / `can_edit_guideline_multi` must preserve Central behavior and allow HU/DEP/VS/HOT access/edit when any related management passes existing `can_access_management` / `can_edit_management`.

Policies for non-Central matrices, matrix_rows and matrix_versions must add the guideline-multi access path while retaining existing process-based access.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/supabase-guideline-multi-ownership.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: support multi ownership for noncentral guidelines`

---

### Task 3: Carga tipada de relaciones y formulario Lineamientos no Central

**Files:**
- Modify: `src/lib/planning-query-cache.ts`
- Modify: `src/GuidelineCatalogV2.tsx`
- Modify: `src/guideline-catalog-v2.css`
- Modify: `tests/non-central-guideline-parity.test.mjs`

**Interfaces:**
- Produces:
  - `loadGuidelineMultiRelations(guidelineIds: string[], force?: boolean)` returning `{ managements, responsibles }`.
  - UI state `selectedManagementIds: string[]`, `selectedResponsibleIds: string[]`.

- [ ] **Step 1: Extend RED tests**

Require scoped loads for `planning_guideline_managements` and `planning_guideline_responsibles`, multi-select UI, use of `save_planning_guideline_multi`, and filtering of managements through `matrix_unit_area_catalog`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/non-central-guideline-parity.test.mjs tests/planning-matrix-polish.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement query/cache helpers**

Add cached loaders keyed by sorted guideline ids and invalidate them with `planning-guidelines:<period>:<unit>` changes.

- [ ] **Step 4: Implement non-Central form**

For `CENTRAL`, keep existing single selects. For HU/DEP/VS/HOT, render a checkbox/dropdown multiselect of activated managements and a second multiselect of managers linked to at least one selected management. Save through `save_planning_guideline_multi`.

Render multiple managements/responsibles in table as compact chips. Keep the first legacy ids as fallback when relation rows are absent.

- [ ] **Step 5: Verify GREEN**

Run both tests above.

- [ ] **Step 6: Commit**

Commit message: `feat: add multi management guideline editor`

---

### Task 4: Encabezado de matriz y selector de Objetivo general no Central

**Files:**
- Modify: `src/UnitExcelWorkspace.tsx`
- Modify: `src/unit-excel-workspace.css`
- Modify: `src/lib/planning-query-cache.ts`
- Modify: `tests/unit-excel-workspace.test.mjs`

**Interfaces:**
- Consumes: relaciones múltiples del lineamiento activo.
- Produces: `availableObjectives: string[]` deduplicados de `rows.objective_group`.

- [ ] **Step 1: Add failing tests**

Require header `matrix-unit-plan-header`, multi ownership labels, `availableObjectives`, selector text `Objetivo general` and option `+ Crear nuevo objetivo`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/unit-excel-workspace.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement header**

Show `PLAN DE ACCIÓN {year}`, selected guideline text/code, unit, all linked managements and responsibles. Use unit accent CSS variables.

- [ ] **Step 4: Implement objective picker**

Normalize/dedupe existing `objective_group`; on new row use select when objectives exist and an explicit create-new branch; on first row show input directly; editing preselects existing objective.

- [ ] **Step 5: Verify GREEN and commit**

Commit message: `feat: polish noncentral matrix planning flow`

---

### Task 5: Exportador Excel profesional compartido

**Files:**
- Create: `src/lib/styled-plan-export.ts`
- Modify: `src/UnitExcelWorkspace.tsx`
- Modify: `src/CentralExcelWorkspace.tsx`
- Create: `tests/styled-plan-export.test.mjs`

**Interfaces:**
- Produces: `exportStyledPlanWorkbook(input): Promise<void>`.
- Input contains `year`, `unitCode`, `unitName`, `guideline`, `managementNames`, `responsibleNames`, `headers`, `rows`, `central`.

- [ ] **Step 1: Add RED test**

Require lazy `xlsx-js-style` URL, merged title cells, style objects (`fill`, `font`, `alignment`, `border`), column widths, `!autofilter`, `!freeze`, and use by both workspaces.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/styled-plan-export.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement utility**

Use `https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/+esm` with `@vite-ignore`. Build AOA sheet, merges and styles. HU green, DEP orange, VS cyan, HOT dark; Central keeps its own header structure.

- [ ] **Step 4: Wire Unit and Central exports**

Replace duplicated bare XLSX generation. Preserve import path using the existing plain `xlsx` module.

- [ ] **Step 5: Verify GREEN and commit**

Commit message: `feat: export styled planning workbooks`

---

### Task 6: Historial global en fullscreen y resumen de cambios

**Files:**
- Create: `src/lib/matrix-history-diff.ts`
- Modify: `src/MatrixWorkspaceV12.tsx`
- Modify: `src/matrix-workspace-v12.css`
- Modify: `tests/central-summary-history.test.mjs`
- Create: `tests/matrix-history-diff.test.mjs`

**Interfaces:**
- Produces: `summarizeMatrixVersionChanges(currentSnapshot, previousSnapshot)` returning `{ summary, changes }`, where each change has `label`, `before`, `after`.

- [ ] **Step 1: Add RED unit tests for diff**

Cover insert, delete and updates of business fields; ignore ids/timestamps/sort-order noise.

- [ ] **Step 2: Add RED integration test**

Require `createPortal(historyLayer, document.body)`, version snapshot loading only when needed, grouped actor cards and expandable details.

- [ ] **Step 3: Verify RED**

Run both history tests.

- [ ] **Step 4: Implement diff helper and portal**

Keep page-size 20. Fetch metadata first; on expand fetch the selected snapshot plus nearest previous version snapshot. Render concise summary by actor/version and an `Anterior → Nuevo` details list. Preserve restore flow.

- [ ] **Step 5: Verify GREEN and commit**

Commit message: `feat: redesign matrix history experience`

---

### Task 7: Eliminar flash/cuadro negro de carga propia de la app

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/Dashboard.tsx`
- Modify: `src/dashboard.css`
- Modify: `src/styles.css`
- Create: `tests/planning-loading-surface.test.mjs`

**Interfaces:**
- Produces: fallback claro compartido `module-loading-surface` para lazy modules.

- [ ] **Step 1: Add RED test**

Assert all Planning/Matrix Suspense fallbacks use `module-loading-surface`, no black background tokens, and fullscreen loading surfaces inherit white/app background.

- [ ] **Step 2: Verify RED**

Run new test.

- [ ] **Step 3: Implement light loading surface**

Use white/neutral background, spinner, stable min-height and no overlay black. Do not alter external floating controls that are not from app DOM.

- [ ] **Step 4: Verify GREEN and commit**

Commit message: `fix: remove dark lazy loading flash`

---

### Task 8: Validación integral, aplicar migración y revisar Supabase

**Files:**
- No new production files unless verification reveals a defect.

- [ ] **Step 1: Run full regression suite**

Run: `node --test tests/*.test.mjs`
Expected: 0 failures.

- [ ] **Step 2: Run TypeScript**

Run: `npm run check`
Expected: success.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: success and no regression that rejoins all lazy chunks into the initial bundle.

- [ ] **Step 4: Apply migration**

Apply exactly `20260908223000_planning_guideline_multi_ownership.sql` through Supabase migration tooling.

- [ ] **Step 5: Verify data backfill**

Query counts and verify every existing guideline has at least its legacy primary management relation and every non-null legacy responsible has a responsible relation.

- [ ] **Step 6: Run Supabase advisors**

Run security and performance advisors. Fix any new RLS/security issue caused by this migration before completion.

- [ ] **Step 7: Verify exact final HEAD CI**

Confirm GitHub Actions regression tests, TypeScript and build on the exact branch HEAD.

- [ ] **Step 8: Compare branch and confirm constraints**

Verify no push to `main`; list migration and frontend files changed; ensure no temporary scripts/workflows remain.
