# Platform Visual Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Control de Gestión platform visually consistent across Dashboard, Configuración, Permisos, Lineamientos, Soportes and Matrices without changing workflows, data behavior, permissions or Supabase.

**Architecture:** Keep the existing React component structure and unit-specific layouts. Add a small shared visual token layer in `src/styles.css`, then make conservative, targeted CSS updates in each module. Static regression tests will assert visual invariants that are safe to express without a browser, while the existing suite protects behavior.

**Tech Stack:** React 18, TypeScript, Vite, plain CSS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-platform-visual-consistency-design.md`

## Global Constraints

- Work only on `auditoria-codex-parcial`.
- Do not modify, merge or push to `main`.
- No Supabase migration, RLS, storage or backend change.
- Preserve all existing navigation and permission semantics.
- Preserve recent HU/VS/DEP/HOT guideline width changes and `Ir a matriz` layout.
- Preserve CENTRAL-specific layout where intentionally different.
- Preserve matrix column models and Excel-like density.
- Keep `Inter` and the current corporate blue/white identity.
- Important working text must normally be 11–13 px; do not use 7–8 px for important labels/descriptions.
- Standard text buttons should be 38–40 px high; compact toolbar buttons 36–38 px; icon-only buttons 34–38 px square.

---

### Task 1: Shared visual token layer

**Files:**
- Modify: `src/styles.css`
- Create: `tests/platform-visual-consistency.test.mjs`

**Interfaces:**
- Consumes: existing global `:root`, Inter font and current module CSS imports.
- Produces: CSS custom properties for colors, radii, control heights, spacing, panel border/shadow and focus ring used by later tasks.

- [ ] **Step 1: Write the failing test**

Create `tests/platform-visual-consistency.test.mjs` with assertions that `src/styles.css` defines a shared token set including `--ui-control-height`, `--ui-toolbar-height`, `--ui-icon-control`, `--ui-radius-control`, `--ui-radius-panel`, `--ui-border`, `--ui-focus-ring`, `--ui-text`, `--ui-muted`, `--ui-primary`, `--ui-danger`, and spacing tokens for 6/8/12/16/20/24 px.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/platform-visual-consistency.test.mjs`
Expected: FAIL because the shared token set does not yet exist.

- [ ] **Step 3: Add minimal shared tokens**

Extend the existing `:root` in `src/styles.css` without changing login layout behavior. Define the shared variables using the current corporate palette and dimensions from the approved design.

- [ ] **Step 4: Run verification**

Run:
`node --test tests/platform-visual-consistency.test.mjs`
`npm test`
`npm run check`
`npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `style: add shared visual consistency tokens`

---

### Task 2: Dashboard and configuration consistency

**Files:**
- Modify: `src/dashboard.css`
- Modify: `src/planning.css`
- Modify: `src/catalog-configuration.css`
- Modify: `src/period-catalog.css`
- Modify: `src/guideline-responsible-accordion.css`
- Extend test: `tests/platform-visual-consistency.test.mjs`

**Interfaces:**
- Consumes: shared tokens from Task 1.
- Produces: consistent panel radii, button heights, focus states, accordion spacing and section hierarchy used as the visual reference for the application.

- [ ] **Step 1: Extend the test with RED invariants**

Assert that Dashboard/navigation controls and configuration accordions use the shared control/panel tokens or exact approved equivalent dimensions. Assert visible `:focus-visible` treatment exists for dashboard navigation/buttons and configuration interactive controls.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/platform-visual-consistency.test.mjs`
Expected: FAIL on the new Dashboard/Configuración assertions.

- [ ] **Step 3: Implement conservative CSS normalization**

Normalize button/icon sizes, panel/card radii, content spacing and accordion header rhythm. Keep existing unit colors, Periodos/Gerentes accordion behavior and responsive layouts. Do not alter component markup unless a focus style cannot be targeted safely.

- [ ] **Step 4: Verify**

Run focused test, full tests, TypeScript and build. Expected: all PASS.

- [ ] **Step 5: Commit**

Commit message: `style: align dashboard and configuration surfaces`

---

### Task 3: Permission catalog readability and alignment

**Files:**
- Modify: `src/permission-catalog-v4.css`
- Extend test: `tests/platform-visual-consistency.test.mjs`

**Interfaces:**
- Consumes: existing CENTRAL area permission layout and non-CENTRAL guideline accordions.
- Produces: readable labels/descriptions and aligned Access/Edit controls without modifying permission behavior.

- [ ] **Step 1: Add RED assertions**

Assert that important permission labels, descriptions, role controls, unit tabs, accordion titles and Access/Edit descriptions are no longer 7–8 px. Require standard/compact control heights and consistent modal spacing. Preserve 9–10 px only for metadata/status text.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `node --test tests/platform-visual-consistency.test.mjs`
Expected: FAIL on permission typography/control assertions.

- [ ] **Step 3: Normalize permission CSS**

Increase important text to approximately 11–12 px, metadata to 9–10 px, align Access/Edit toggle cards, normalize modal header/body/footer spacing and control sizes. Keep CENTRAL structurally distinct, keep non-CENTRAL lineamiento accordions closed by default, and do not edit `PermissionCatalogV4.tsx` behavior.

- [ ] **Step 4: Verify**

Run focused test, `npm test`, `npm run check`, `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `style: improve permission catalog consistency`

---

### Task 4: Guidelines and support documents consistency

**Files:**
- Modify: `src/planning-guidelines.css`
- Modify: `src/guideline-catalog-v2.css`
- Modify: `src/guideline-unit-layout-overrides.css` only if needed for spacing, never column regression
- Modify: `src/guideline-ppt-panel.css`
- Extend test: `tests/platform-visual-consistency.test.mjs`
- Reuse existing guideline regression tests.

**Interfaces:**
- Consumes: current widened HU/VS/DEP/HOT lineamiento columns, special DEP/HOT table structures, `Ir a matriz` button and shortened support header.
- Produces: consistent toolbar hierarchy, actions, support cards and viewer dialog.

- [ ] **Step 1: Add RED visual assertions**

Require coherent toolbar/control heights and focus states, consistent table/action typography and support document controls. Also assert the widened strategic guideline widths remain unchanged and `Ir a matriz` still keeps text and arrow inside the shared button.

- [ ] **Step 2: Run focused tests and confirm RED only for new consistency rules**

Run: `node --test tests/platform-visual-consistency.test.mjs tests/*guideline*.test.mjs`
Expected: new visual assertions FAIL; existing guideline behavior/layout regressions PASS.

- [ ] **Step 3: Implement targeted CSS changes**

Normalize toolbar spacing, action dimensions, panel hierarchy, support upload/view/delete controls, empty-state rhythm and viewer dialog. Do not reduce lineamiento width, alter unit table structure or change support storage behavior.

- [ ] **Step 4: Verify**

Run focused guideline tests, full suite, TypeScript and build. Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `style: harmonize guidelines and support surfaces`

---

### Task 5: Matrix surfaces, dialogs and final regression

**Files:**
- Modify: `src/matrix-workspace-v11.css`
- Modify: `src/matrix-workspace-v12.css`
- Modify: `src/matrix-workspace-v12-unit-theme.css` only if necessary for token consumption
- Modify: `src/unit-excel-workspace.css`
- Modify: `src/central-excel-workspace.css`
- Modify: `src/matrix-collaboration.css` only for visual consistency if needed
- Extend test: `tests/platform-visual-consistency.test.mjs`

**Interfaces:**
- Consumes: matrix behavior and column layouts as-is.
- Produces: aligned toolbar controls, editor/summary cards, history dialog and restore confirmation without changing matrix density.

- [ ] **Step 1: Add RED assertions**

Require consistent toolbar/button heights, icon controls, dialog radius/backdrop, card borders and focus states while asserting existing matrix column grid definitions remain present.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `node --test tests/platform-visual-consistency.test.mjs tests/*matrix*.test.mjs tests/central-*.test.mjs`
Expected: new style assertions FAIL; existing functional matrix tests PASS.

- [ ] **Step 3: Normalize matrix presentation conservatively**

Apply shared dimensions/radii/colors to toolbar buttons, editor cards, summaries, history/restore dialogs and collaboration indicators. Do not change grid-template column definitions, row heights required for Excel density, data loading or editing behavior.

- [ ] **Step 4: Full final verification**

Run:
`npm test`
`npm run check`
`npm run build`
Then confirm the GitHub Actions workflow for the final commit is green.

- [ ] **Step 5: Scope audit**

Compare the final branch against the pre-pass HEAD. Confirm no Supabase migration, backend/RLS, data model, permission logic or `main` changes occurred.

- [ ] **Step 6: Commit**

Commit message: `style: complete platform visual consistency pass`
