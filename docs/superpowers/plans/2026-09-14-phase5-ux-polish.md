# Fase 5 UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar navegación, feedback y confirmaciones de Control de Gestión sin rediseñar la interfaz ni alterar lógica de negocio o datos.

**Architecture:** Mantener los componentes existentes y añadir cambios incrementales en la capa de interacción. La navegación se corrige en `PlanningView`; las confirmaciones y accesibilidad del historial en `MatrixWorkspaceV12`; el diálogo de eliminación de lineamientos se completa con comportamiento de teclado. No se agregan dependencias ni consultas.

**Tech Stack:** React, TypeScript, CSS existente, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-09-14-phase5-ux-polish-design.md`

## Global Constraints

- Trabajar únicamente en `auditoria-codex-parcial`.
- No tocar `main`.
- No aplicar migraciones ni modificar Supabase.
- Mantener el diseño visual actual.
- Mantener Central separado de HU/DEP/VS/HOT y preservar `guideline_id` como identidad no-Central.
- TDD obligatorio: RED antes de producción.

---

### Task 1: Navegación de Planificación

**Files:**
- Modify: `src/Dashboard.tsx`
- Test: `tests/phase5-ux-polish.test.mjs`

**Interfaces:**
- Consumes: `PlanningStep`, `openGuidelinesFromMatrix`, `selectedPeriod`, `selectedPlanningUnit`.
- Produces: breadcrumb de tres pasos y retorno `Matriz → Lineamientos`.

- [ ] **Step 1: Write failing tests**
  - Verificar que el breadcrumb represente `Unidad`, `Lineamientos`, `Matriz`.
  - Verificar que `goBack()` desde `matrices` invoque el retorno a `guidelines`, no a `modules`.
  - Verificar que el contexto de `guideline_id` ya transportado por `onViewGuidelines` siga siendo el mecanismo de retorno.
- [ ] **Step 2: Run test and verify RED**
  - `node --test tests/phase5-ux-polish.test.mjs`
  - Esperado: fallos de breadcrumb/retorno porque el código actual usa dos pasos y `goBack()` retorna a `modules`.
- [ ] **Step 3: Implement minimal navigation change**
  - Renderizar tres pasos sin cambiar rutas ni estado de negocio.
  - Desde `matrices`, `Volver` debe ejecutar el mismo flujo que `openGuidelinesFromMatrix()` con el contexto ya disponible cuando corresponda.
  - Desde `guidelines`, `Volver` regresa a `modules`.
- [ ] **Step 4: Verify GREEN**
  - Ejecutar el test específico.
- [ ] **Step 5: Commit**
  - `git commit -m "fix: clarify planning navigation flow"`

### Task 2: Confirmación de restauración consistente

**Files:**
- Modify: `src/MatrixWorkspaceV12.tsx`
- Modify: `src/matrix-workspace-v12.css`
- Test: `tests/phase5-ux-polish.test.mjs`

**Interfaces:**
- Consumes: `HistoryVersion`, `restoreVersion()`.
- Produces: estado `pendingRestoreVersion`, diálogo React propio y acción confirmada.

- [ ] **Step 1: Write failing tests**
  - Verificar ausencia de `window.confirm` en restauración.
  - Verificar existencia de diálogo con `role="dialog"`, `aria-modal`, `aria-labelledby` y copy explícito.
  - Verificar que Escape cierre el diálogo cuando no hay restauración en curso.
- [ ] **Step 2: Run test and verify RED**
  - Esperado: falla porque `restoreVersion()` usa `window.confirm`.
- [ ] **Step 3: Implement minimal dialog**
  - Separar `requestRestore(version)` de `confirmRestore()`.
  - Reutilizar clases/patrones del historial y estilos actuales.
  - Bloquear cierre durante `restoringVersionNo !== null`.
- [ ] **Step 4: Verify GREEN**
- [ ] **Step 5: Commit**
  - `git commit -m "fix: use accessible restore confirmation"`

### Task 3: Feedback y modales accesibles

**Files:**
- Modify: `src/Dashboard.tsx`
- Modify: `src/PlanningGuidelines.tsx`
- Test: `tests/phase5-ux-polish.test.mjs`

**Interfaces:**
- Consumes: `error`, `notice`, `pendingDelete`, `importNotice`.
- Produces: semántica `alert/status`, títulos accesibles y cierre por Escape.

- [ ] **Step 1: Write failing tests**
  - Error visible usa `role="alert"`.
  - Notice/import notice usa `role="status"` y `aria-live="polite"`.
  - Diálogo de eliminación tiene `aria-labelledby` y Escape cierra sin confirmar.
- [ ] **Step 2: Run test and verify RED**
- [ ] **Step 3: Implement minimal semantic/keyboard changes**
  - No cambiar copy de negocio salvo aclaraciones necesarias.
  - No crear sistema global de toast.
- [ ] **Step 4: Verify GREEN**
- [ ] **Step 5: Commit**
  - `git commit -m "fix: standardize ux feedback states"`

### Task 4: Verificación integral

**Files:**
- No production files nuevos.

**Interfaces:**
- Produces: evidencia de cierre de Fase 5.

- [ ] **Step 1: Run focused UX tests**
  - `node --test tests/phase5-ux-polish.test.mjs`
- [ ] **Step 2: Run full regression suite**
  - `node --test tests/*.test.mjs`
- [ ] **Step 3: Run TypeScript**
  - `npm run check`
- [ ] **Step 4: Run production build**
  - `npm run build`
- [ ] **Step 5: Verify CI on exact HEAD and confirm `main` unchanged**
