# Non-Central Matrix Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a HU, DEP, VS y HOT la misma capa común de Vista Matriz/Resumen, historial paginado, restauración y presentación de acciones que ya usa Central, sin tocar Lineamientos ni crear migraciones.

**Architecture:** `MatrixWorkspaceV13` enviará todas las unidades a `MatrixWorkspaceV12`, que será el shell común de Resumen e Historial. `MatrixWorkspaceV11` seguirá resolviendo qué editor de datos usar: `CentralExcelWorkspace` para Central y `UnitExcelWorkspace` para el resto. `UnitExcelWorkspace` conservará su modelo de datos y funciones de importación/exportación, pero dejará de tener un historial duplicado y alineará su toolbar/acción de creación con la experiencia común.

**Tech Stack:** React + TypeScript + Supabase + Node test runner + Vite.

**Spec:** `docs/superpowers/specs/2026-09-07-unificar-matrices-no-central-con-central-design.md`

## Global Constraints

- No modificar Lineamientos.
- No implementar la plantilla de importación de lineamientos.
- No crear migraciones Supabase.
- Trabajar solo en `auditoria-codex-parcial`.
- Mantener Realtime y bloqueo colaborativo existentes.
- No cargar `snapshot` para listar historial.

---

### Task 1: Regression contract for all-unit V12 shell

**Files:**
- Create: `tests/non-central-matrix-parity.test.mjs`
- Modify: `src/MatrixWorkspaceV13.tsx`

**Interfaces:**
- Consumes: existing `MatrixWorkspaceV12` props.
- Produces: all units rendered through `MatrixWorkspaceV12`, with `MatrixRealtimeLayer` remaining the only outer Realtime wrapper.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const v13 = new URL('../src/MatrixWorkspaceV13.tsx', import.meta.url)

test('all matrix units use the V12 common experience shell', async () => {
  const source = await readFile(v13, 'utf8')
  assert.match(source, /<MatrixWorkspaceV12 \{\.\.\.props\} onActiveMatrixChange=\{setActiveMatrixId\}/)
  assert.doesNotMatch(source, /props\.unitCode === 'CENTRAL'[\s\S]*MatrixWorkspaceV11/)
  assert.match(source, /<MatrixRealtimeLayer matrixId=\{activeMatrixId\}>/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/non-central-matrix-parity.test.mjs`
Expected: FAIL because V13 still routes non-Central units directly to V11.

- [ ] **Step 3: Write minimal implementation**

Make V13 always render:

```tsx
<MatrixRealtimeLayer matrixId={activeMatrixId}>
  <MatrixWorkspaceV12 {...props} onActiveMatrixChange={setActiveMatrixId} />
</MatrixRealtimeLayer>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/non-central-matrix-parity.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: route all matrices through common V12 shell`

---

### Task 2: Generalize Resumen without extra queries

**Files:**
- Modify: `tests/non-central-matrix-parity.test.mjs`
- Modify: `src/MatrixWorkspaceV12.tsx`

**Interfaces:**
- Consumes: rendered `.matrix-v5-sheet` table from either `CentralExcelWorkspace` or `UnitExcelWorkspace`.
- Produces: `SummaryRow[]` built from visible table cells using normalized header names.

- [ ] **Step 1: Extend the failing test**

Add assertions that V12:

```js
assert.match(v12Source, /function refreshMatrixSummary/)
assert.match(v12Source, /findHeaderIndex/)
assert.match(v12Source, /Acción/)
assert.match(v12Source, /Responsable/)
assert.match(v12Source, /Entregable/)
assert.doesNotMatch(summaryBlock, /supabase\./)
```

The test must also assert that the summary search uses `.matrix-v5-sheet` rather than only `.matrix-central-spreadsheet-grid`.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL because V12 currently uses `refreshCentralSummary()` and hard-coded Central cell indexes.

- [ ] **Step 3: Implement header-based summary extraction**

In V12:

```ts
function normalizeHeader(value: string | null | undefined) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}
function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex(header => candidates.some(candidate => header === candidate || header.includes(candidate)))
}
```

`refreshMatrixSummary()` must:
- find `.matrix-v5-sheet`;
- read `thead th` labels;
- locate Acción, Responsable, Hitos/Fechas/Fechas and Entregable;
- ignore edit/group/subpoint rows where appropriate;
- use `data-matrix-row-id` as stable key;
- never call Supabase.

For Central, `enhanceCentralTable()` remains gated by `props.unitCode === 'CENTRAL'` so only its 9-column layout is reordered.

- [ ] **Step 4: Run regression tests**

Run: `node --test tests/non-central-matrix-parity.test.mjs tests/central-summary-history.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: generalize matrix summary for all units`

---

### Task 3: Remove duplicate non-Central history and use paged V12 history

**Files:**
- Modify: `tests/non-central-matrix-parity.test.mjs`
- Modify: `src/UnitExcelWorkspace.tsx`
- Modify: `src/MatrixWorkspaceV12.tsx`

**Interfaces:**
- Consumes: `matrixId` emitted through `onActiveMatrixChange`.
- Produces: a single history implementation in V12 for Central and non-Central.

- [ ] **Step 1: Add failing assertions**

```js
assert.doesNotMatch(unitSource, /select\('id,version_no,action,changed_email,created_at,snapshot'\)/)
assert.doesNotMatch(unitSource, /historyOpen &&/)
assert.match(v12Source, /const HISTORY_PAGE_SIZE = 20/)
assert.match(v12Source, /\.range\(offset, offset \+ HISTORY_PAGE_SIZE\)/)
assert.match(v12Source, /Cargar más/)
assert.match(v12Source, /restore_matrix_version_by_context/)
```

- [ ] **Step 2: Run test and observe failure**

Expected: FAIL because `UnitExcelWorkspace` still owns its old snapshot history modal.

- [ ] **Step 3: Remove old history state/query/modal from UnitExcelWorkspace**

Keep the toolbar button visually present as the trigger intercepted by V12, preferably:

```tsx
<button className="matrix-v5-secondary" data-matrix-history-trigger type="button">
  <History size={16}/> Historial
</button>
```

Remove `MatrixVersion`, `formatDateTime`, `historyActionLabel`, `historyOpen`, `historyLoading`, `versions`, `openHistory()` and the old history JSX from UnitExcelWorkspace when no longer used.

- [ ] **Step 4: Make V12 intercept a stable history marker**

`handleRootClickCapture` should recognize `[data-matrix-history-trigger]` and retain text fallback for Central compatibility.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/non-central-matrix-parity.test.mjs tests/central-summary-history.test.mjs tests/unit-excel-workspace.test.mjs`
Expected: PASS after adjusting any old source-contract assertions that intentionally describe the removed history duplication.

- [ ] **Step 6: Commit**

Commit message: `refactor: share paged matrix history across units`

---

### Task 4: Align non-Central toolbar and creation wording

**Files:**
- Modify: `tests/non-central-matrix-parity.test.mjs`
- Modify: `tests/unit-excel-workspace.test.mjs`
- Modify: `src/UnitExcelWorkspace.tsx`
- Modify: `src/unit-excel-workspace.css` only if layout needs it.

**Interfaces:**
- Consumes: existing `startNewRow`, import/export and fullscreen functions.
- Produces: Central-like commandbar labels without changing data persistence.

- [ ] **Step 1: Write failing assertions**

Assert:

```js
assert.match(unitSource, /matrix-central-page-head/)
assert.match(unitSource, /matrix-central-commandbar/)
assert.match(unitSource, /Añadir acción/)
assert.doesNotMatch(unitSource, />Nueva fila</)
```

Also keep an assertion that the new-row draft is rendered after `rows.map(...)`:

```js
const persistedRows = unitSource.indexOf('rows.map(row =>')
const newDraft = unitSource.indexOf("renderSpreadsheetDraftRow('new-unit-action')")
assert.ok(newDraft > persistedRows)
```

- [ ] **Step 2: Run tests and observe failure**

Expected: FAIL on Central-like commandbar/wording.

- [ ] **Step 3: Implement minimal markup alignment**

Wrap the non-Central title and toolbar in the same `matrix-central-page-head` / `matrix-central-commandbar` structure used by Central. Preserve `Áreas`, expand, history, import, export and add-action capabilities. Rename creation to `Añadir acción` while calling the existing `startNewRow()`.

- [ ] **Step 4: Run focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: align unit matrix toolbar with Central`

---

### Task 5: Full verification

**Files:**
- No production changes unless a regression is discovered.

- [ ] **Step 1: Run full tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`
Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: exit code 0; existing Vite bundle-size warning is acceptable if unchanged.

- [ ] **Step 4: Verify no scope creep**

Check branch diff and confirm no changes to `CentralGuidelineWorkspace.tsx`, `GuidelineCatalogV2.tsx`, `GuidelineMultiImport.tsx`, or Supabase migrations for this feature.

- [ ] **Step 5: Final commit if verification-only test adjustments are needed**

Commit message: `test: verify matrix parity across units`
