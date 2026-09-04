# HU DEP VS HOT Spreadsheet Grids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved spreadsheet-style matrix experience to HU, DEP, VS and HOT with direct cell editing and multiple responsible managers, while leaving Central unchanged.

**Architecture:** Add a dedicated `UnitExcelWorkspace` for non-Central units and keep `MatrixWorkspaceV11` as the collaboration/locking wrapper. Reuse the existing generic `matrix_row_responsibles` relation and the existing spreadsheet CSS patterns; the responsible picker reads all active managers and limits choices to cargo values containing the standalone role `Gerente`, without filtering by selected area.

**Tech Stack:** React 18, TypeScript, Supabase, Node test runner, existing CSS and XLSX dynamic import.

**Spec:** User-approved HU/DEP/VS/HOT spreadsheet design in the current conversation.

## Global Constraints

- Central must continue using `CentralExcelWorkspace` unchanged.
- HU, DEP, VS and HOT keep area-based matrix navigation, but responsible options are platform-wide and are not area-filtered.
- Responsible supports multiple managers using `matrix_row_responsibles`; the first selected manager remains mirrored in legacy `responsible_manager_id` for compatibility.
- Only active managers whose cargo is a `Gerente` role are selectable; `Subgerente` is excluded.
- Columns are Objetivo, Acción, Responsable, Prioridad, Hitos / Fechas, KPI, Inicio, Fin, Riesgos, Restricciones, Soporte, Entregable and Comité.
- Preserve fullscreen, zoom, history, Excel import/export and realtime collaboration.
- Save remains partial; empty optional cells do not block persistence.

---

### Task 1: Lock requirements with regression tests

**Files:**
- Create: `tests/unit-excel-workspace.test.mjs`
- Create: `src/unit-excel-model.js`

**Interfaces:**
- Produces: `filterGerenteManagers(managers)` and `toggleResponsibleId(currentIds, managerId)`.

- [x] **Step 1:** Add failing tests for gerente-only filtering, multiple responsables, V11 routing, spreadsheet toolbar/columns and realtime refresh.
- [x] **Step 2:** Run PR CI and verify the tests fail because the new model/workspace do not yet exist.
- [ ] **Step 3:** Implement the minimal model helpers and make the model tests pass.

### Task 2: Implement non-Central spreadsheet workspace

**Files:**
- Create: `src/UnitExcelWorkspace.tsx`
- Create: `src/unit-excel-workspace.css`
- Modify: `src/MatrixWorkspaceV11.tsx`

**Interfaces:**
- Consumes: `matrix_rows`, `matrix_row_responsibles`, `matrix_versions`, `can_edit_management` and existing V11 row locking through `data-matrix-row-id`.
- Produces: in-grid add/edit rows, multiple-responsible picker, area navigation, history, import/export, fullscreen/zoom and realtime-safe refresh.

- [ ] **Step 1:** Load areas, matrices, active managers and row-responsible links for the selected unit.
- [ ] **Step 2:** Render the 13 spreadsheet columns and edit/add rows directly in the table.
- [ ] **Step 3:** Persist selected responsables transactionally enough to preserve legacy compatibility and roll back a newly-created row when links fail.
- [ ] **Step 4:** Add Excel import/export and version history using the same persisted fields.
- [ ] **Step 5:** Route HU/DEP/VS/HOT through `UnitExcelWorkspace` in V11 while Central stays on `CentralExcelWorkspace`.

### Task 3: Verify and merge

**Files:**
- Test: `tests/*.test.mjs`

**Interfaces:**
- Produces: a CI-validated branch head safe to merge to `main`.

- [ ] **Step 1:** Run all regression tests and require zero failures.
- [ ] **Step 2:** Run `npm run check` and require TypeScript success.
- [ ] **Step 3:** Run `npm run build` and require production build success.
- [ ] **Step 4:** Review the PR diff to confirm Central source is untouched and no unrelated behavior changed.
- [ ] **Step 5:** Merge the exact validated branch head to `main`.
