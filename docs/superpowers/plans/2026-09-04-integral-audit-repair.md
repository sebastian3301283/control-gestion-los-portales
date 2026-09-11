# Integral Audit and Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair Central layout and real subpoint rows, make matrix collaboration converge through reliable Supabase Realtime, audit the active application, and publish only a fully verified `main`.

**Architecture:** Propagate the active matrix ID explicitly from each spreadsheet workspace to one Realtime owner, keep remote refreshes scoped and non-destructive to local drafts, and render existing `matrix_row_subpoints` as real spreadsheet rows. Restrict horizontal overflow to the sheet scroller and preserve the current business flows and permissions.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Supabase JS 2.112, Postgres 17, Node test runner, CSS.

**Spec:** `docs/superpowers/specs/2026-09-04-integral-audit-repair-design.md`

## Global Constraints

- Work from the latest fetched `main`; never force push or overwrite the user's pre-existing `package-lock.json` change.
- Keep toolbar, fullscreen, new row, Excel import/export, history, primary responsible, multiple responsibles and non-Central workspaces.
- Use Realtime rather than polling for collaborative row updates.
- Preserve RLS and avoid destructive writes to production data.
- Add a failing regression before each behavioral fix and re-run the complete suite after every green step.

---

### Task 1: Lock the Realtime contract with failing tests

**Files:**
- Create: `src/matrix-realtime-events.js`
- Create: `src/matrix-realtime-events.d.ts`
- Create: `tests/matrix-realtime-events.test.mjs`
- Modify: `tests/matrix-realtime-presence.test.mjs`

**Interfaces:**
- Produces: `matrixIdFromChange(payload, activeMatrixId)`, `shouldRefreshMatrix(change, activeMatrixId)`, and `sameCollaborationLocation(left, right)`.
- Consumes: Supabase `postgres_changes` payload shape and existing collaboration location shape.

- [ ] Write tests proving matching INSERT/UPDATE refresh, unrelated matrices do not refresh, DELETE without `matrix_id` safely refreshes the active matrix, child-table events require parent resolution, and identical focus locations are deduplicated.
- [ ] Run `node --test --test-isolation=none tests/matrix-realtime-events.test.mjs` and verify failure because the module does not exist.
- [ ] Implement the pure helpers with explicit null/unknown handling.
- [ ] Re-run the focused tests and commit the green behavior with the later Realtime integration.

### Task 2: Replace DOM polling with explicit active-matrix propagation

**Files:**
- Modify: `src/MatrixWorkspaceV13.tsx`
- Modify: `src/MatrixWorkspaceV12.tsx`
- Modify: `src/MatrixWorkspaceV11.tsx`
- Modify: `src/MatrixRealtimeLayer.tsx`
- Modify: `src/CentralExcelWorkspace.tsx`
- Modify: `src/UnitExcelWorkspace.tsx`
- Test: `tests/matrix-realtime-events.test.mjs`

**Interfaces:**
- Produces: `onActiveMatrixChange(matrixId: string)` from spreadsheet child to V11/V13 and `matrixId: string` into `MatrixRealtimeLayer`.
- Consumes: each workspace's existing `selectedMatrixId` state.

- [ ] Add structural assertions that the Realtime layer receives `matrixId` directly and no longer contains `setInterval(resolveMatrix)` or management/process lookup queries.
- [ ] Verify the assertions fail on the baseline.
- [ ] Lift `activeMatrixId` into V13 and pass one stable callback through V12/V11 to Central and unit workspaces.
- [ ] Notify the callback whenever a sheet opens, closes or period/unit changes.
- [ ] Replace V11's matrix-discovery polling with loads keyed by the explicit ID while retaining the 25-second lock heartbeat.
- [ ] Re-run focused and full tests.

### Task 3: Repair subscription lifecycle, Presence rate limiting and status feedback

**Files:**
- Modify: `src/MatrixRealtimeLayer.tsx`
- Modify: `src/matrix-realtime-layer.css`
- Modify: `src/matrix-realtime-events.js`
- Test: `tests/matrix-realtime-events.test.mjs`

**Interfaces:**
- Produces: one cleaned-up channel per active matrix, deduplicated editing-location updates, scoped database refresh events, and visible sync states.
- Consumes: explicit `matrixId`, Supabase auth token, publication events for rows/subpoints/responsibles/locks.

- [ ] Add failing source assertions for `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`, relation subscription and no repeated `track` for an unchanged location.
- [ ] Subscribe to `matrix_rows`, `matrix_row_subpoints`, `matrix_row_responsibles` and locks; resolve child rows to their parent matrix only when required.
- [ ] Deduplicate Presence location updates and treat Presence send failure independently from database subscription health.
- [ ] Show `Conectando`, `Sincronizado`, `Reconectando` or `Error de sincronización` without blocking editing.
- [ ] Verify cleanup removes the channel and pending location timer.

### Task 4: Restore Central subpoints as real spreadsheet rows

**Files:**
- Modify: `src/CentralExcelWorkspace.tsx`
- Modify: `src/central-excel-workspace.css`
- Modify: `tests/central-workspace-structure.test.mjs`
- Modify: `tests/central-excel-actions.test.mjs`
- Keep and exercise: `src/central-subpoint-records.js`

**Interfaces:**
- Consumes: `matrix_row_subpoints`, `buildCentralSubpointDrafts`, `normalizeCentralSubpointRows` and current action-row draft.
- Produces: `centralSubpointsByRow`, editable subpoint drafts, and one `<tr>` for each S1/S2/S3 with Hitos/KPI/Inicio/Fin cells.

- [ ] Replace stale tests that require subpoints to be absent with assertions requiring real child `<tr>` elements and persisted `matrix_row_subpoints`.
- [ ] Run focused tests and confirm they fail against the action-only Central workspace.
- [ ] Load subpoints together with rows and preserve partial subpoint records.
- [ ] Render display rows immediately below their parent action without stacking multiple subpoints in one cell.
- [ ] Add/remove/edit subpoint draft rows inside the spreadsheet editor and save them only after the parent row exists.
- [ ] Reconcile the confirmed row/subpoint/responsible state after save failure or success.
- [ ] Update Excel import/export so subpoints remain aligned with Hitos/KPI/Inicio/Fin.
- [ ] Re-run focused and full tests.

### Task 5: Prove and repair overflow containment

**Files:**
- Modify: `src/dashboard.css`
- Modify: `src/planning.css`
- Modify: `src/matrix-realtime-layer.css`
- Modify: `src/matrix-workspace-v11.css`
- Modify: `src/central-excel-workspace.css`
- Modify: `tests/central-wrapper-overflow.test.mjs`

**Interfaces:**
- Produces: shrinkable ancestor chain and exactly one horizontal sheet scroller.

- [ ] Add failing regression assertions for `dashboard-content`, `planning-flow`, `matrix-realtime-content` and direct MatrixWorkspace host containment.
- [ ] Apply `min-width:0`, `max-width:100%`, `width:100%` or `minmax(0,1fr)` only to active ancestors shown by computed layout evidence.
- [ ] Verify desktop, medium and mobile widths; confirm toolbar and primary responsible stay inside the viewport while the table scrolls independently.

### Task 6: Audit active flows and remove only proven dead competition

**Files:**
- Inspect: every file in `src`, `tests`, `.github` and `supabase`.
- Modify only files with reproduced defects or verified dead references.

**Interfaces:**
- Produces: reference map, cleanup list and unchanged business behavior for unrelated screens.

- [ ] Trace imports from `src/main.tsx` and distinguish dead TSX generations from CSS still imported by the active workspace.
- [ ] Review every Supabase query/mutation for errors, null handling, partial updates and cleanup.
- [ ] Fix reproducible auth/navigation/configuration defects with focused failing tests.
- [ ] Remove obsolete components/tests only when no production import, dynamic reference or required style depends on them.
- [ ] Scan for secrets, debugging, unsafe casts, TODO/FIXME, duplicated listeners and unbounded timers.

### Task 7: Apply the minimal Realtime schema migration

**Files:**
- Create through Supabase migration tooling: one migration adding `matrix_row_responsibles` to `supabase_realtime` if absent and the minimum replica identity needed for reliable deletes.
- Commit the generated SQL under `supabase/migrations/`.

**Interfaces:**
- Produces: publication coverage for every relation the client subscribes to.

- [ ] Verify current publication and replica identity metadata with read-only SQL.
- [ ] Apply only idempotent publication/replica changes justified by client event routing.
- [ ] Re-query metadata, Realtime logs, security advisors and performance advisors.
- [ ] Do not modify the locked `realtime` schema objects; retain only allowed policies on `realtime.messages`.

### Task 8: Integral technical and visual verification

**Files:**
- Modify: `package.json` only if a reproducible test script can be added without new tooling.
- Review: complete Git diff and generated build output status.

**Interfaces:**
- Produces: verified release candidate for `main`.

- [ ] Run all Node tests in the supported isolation mode and require zero failures.
- [ ] Run TypeScript project check and require zero errors.
- [ ] Run the Vite production build outside the sandbox when esbuild needs subprocess permission; record bundle warnings accurately.
- [ ] Run the application and complete a second visual pass at desktop, medium and mobile widths.
- [ ] When authenticated sessions are available, use two independent sessions for A→B and B→A INSERT/UPDATE/DELETE, subpoints, responsables, navigation and reconnect; otherwise report the exact authentication limitation and verify channel/database layers independently.
- [ ] Review `git status`, full diff, secrets and temporary files.
- [ ] Fetch `origin/main`, integrate only understandable new commits, rerun critical checks, commit logically and push `main` without force.
