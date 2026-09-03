# Central Spreadsheet Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert only the CENTRAL matrix into an in-place spreadsheet-style grid where rows and cells are edited directly, while preserving Supabase persistence, multi-responsible area filtering, realtime collaboration, Excel import/export, history, fullscreen and all non-Central units.

**Architecture:** Keep `CentralExcelWorkspace` as the isolated CENTRAL workspace and keep V11 as the collaboration wrapper. Replace the bottom/expanded row form with an in-place row editor: existing rows become cell editors on click and `Nueva fila` inserts a blank editable row directly in the grid. Objective groups remain full-width separator rows; choosing/creating the objective is compact and stays adjacent to the row instead of opening a large form.

**Tech Stack:** React + TypeScript, Supabase, existing CSS, Node regression tests. No new spreadsheet dependency.

**Spec:** User-approved Central Excel reference and current conversation requirements.

## Global Constraints

- Change only unit `CENTRAL`; HU/DEP/VS/HOT behavior must remain unchanged.
- Keep columns: Acción, Responsable, Prioridad, Hitos/Fechas, KPI, Inicio, Fin, Riesgos, Restricciones, Soporte, Entregable, Comité.
- Responsible supports multiple managers and only managers mapped to the selected Central area through `manager_managements`.
- Objective groups OB1/OB2/etc. remain full-width separator rows.
- Preserve row locking/realtime collaboration, history, import/export Excel, fullscreen and zoom.
- Do not require all fields to be complete before saving.

---

### Task 1: Lock spreadsheet interaction requirements with regression tests

**Files:**
- Modify: `tests/central-excel-actions.test.mjs`
- Test: `tests/central-excel-actions.test.mjs`

**Interfaces:**
- Consumes: current `CentralExcelWorkspace.tsx` and `central-excel-workspace.css`.
- Produces: regression assertions for in-place rows, no detached bottom editor, native Tab navigation and direct new-row insertion.

- [ ] **Step 1: Write failing assertions** requiring an in-grid draft row marker, spreadsheet cell classes, `Nueva fila` to use the in-grid draft, and absence of the detached form rendering pattern.
- [ ] **Step 2: Run `node --test tests/central-excel-actions.test.mjs`** and verify the new assertions fail on the current branch.
- [ ] **Step 3: Commit the red test** with `test: require in-place Central spreadsheet editing`.

### Task 2: Replace detached row form with in-place spreadsheet rows

**Files:**
- Modify: `src/CentralExcelWorkspace.tsx`
- Modify: `src/central-excel-workspace.css`
- Test: `tests/central-excel-actions.test.mjs`

**Interfaces:**
- Consumes: `RowDraft`, `selectedResponsibleIds`, `centralManagers`, `saveRow`, `startEditRow`, `startNewRow`, `cancelRowEdit`.
- Produces: editable action row rendered at its natural table position, blank new row inside `<tbody>`, compact objective selector row, borderless cell controls, visible active-cell focus, Tab traversal and Ctrl+Enter save.

- [ ] **Step 1: Move editing markup into the row's natural position** so an existing row is replaced by its editable cells instead of adding a detached editor after all rows.
- [ ] **Step 2: Render a new blank action row inside the grid** immediately after the relevant objective group / at the grid end when `Nueva fila` is pressed.
- [ ] **Step 3: Keep objective group selection compact** as a full-width spreadsheet separator directly above the in-grid draft row.
- [ ] **Step 4: Style `.matrix-central-sheet-cell` controls** as spreadsheet cells with compact padding, borderless inputs/textareas, focus outline, sticky header and sensible row heights.
- [ ] **Step 5: Keep multiple-responsible picker inside the Responsable cell**, still sourced from `manager_managements` for the selected area.
- [ ] **Step 6: Run the focused regression test** and make it pass.
- [ ] **Step 7: Commit** with `feat: edit Central rows directly in spreadsheet grid`.

### Task 3: Preserve collaboration and verify the production build

**Files:**
- Modify only if needed: `src/MatrixWorkspaceV11.tsx`
- Test: `tests/central-excel-actions.test.mjs` and all `tests/*.test.mjs`

**Interfaces:**
- Consumes: V11 row lock capture using `tr[data-matrix-row-id]`, Central realtime `matrix-realtime-data-change`, existing `saveRow`/cancel lifecycle.
- Produces: row click/focus still acquires locks for existing rows; realtime refresh keeps the current draft; new unsaved rows do not attempt to lock a nonexistent database id.

- [ ] **Step 1: Add/adjust regression assertions** for `data-matrix-row-id` on editable existing rows and realtime refresh preserving the draft.
- [ ] **Step 2: Adjust V11 only if the new markup requires it**, preserving all non-Central behavior.
- [ ] **Step 3: Run `node --test tests/*.test.mjs`** and require all tests to pass.
- [ ] **Step 4: Run `npm run check`** and require TypeScript success.
- [ ] **Step 5: Run `npm run build`** and require production build success.
- [ ] **Step 6: Merge only after CI validates the exact branch head**.
