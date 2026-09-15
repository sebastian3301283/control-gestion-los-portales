# Guideline Matrix Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mantener CENTRAL por área y mover HU/VS/DEP/HOT a autorización de acceso/edición por `guideline_id`, con UI compacta y RLS consistente.

**Architecture:** Introducir una tabla explícita `guideline_user_permissions`, mantener `can_access_guideline_multi`/`can_edit_guideline_multi` como frontera de autorización y separar las políticas RLS por unidad para eliminar el fallback de área en no-Central. `PermissionCatalogV4` conserva el editor CENTRAL y añade un editor no-Central de acordeones cerrados por defecto.

**Tech Stack:** React 18, TypeScript, Supabase/PostgreSQL RLS, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-guideline-matrix-permissions-design.md`

## Global Constraints

- Trabajar únicamente en `auditoria-codex-parcial`.
- No tocar ni fusionar `main`.
- No modificar ni reaplicar migraciones anteriores.
- Conservar los últimos cambios visuales de Lineamientos.
- TDD: RED antes de implementación; GREEN antes de cierre.
- Terminar con suite completa, TypeScript, build y CI.

---

### Task 1: Especificación ejecutable RED

**Files:**
- Test: `tests/guideline-matrix-permissions.test.mjs`

**Interfaces:**
- Consumes: requisitos aprobados.
- Produces: contrato verificable para persistencia, helpers, RLS y UI.

- [x] **Step 1: Escribir pruebas que exijan migración, separación CENTRAL/no-Central y acordeones.**
- [x] **Step 2: Ejecutar CI y confirmar fallo RED.** Run #512 falla en `Run regression tests` sobre commit test-only `64649136e7f8bf9a38c14a9f2ea4956fc6865960`.

### Task 2: Backend y RLS por lineamiento

**Files:**
- Create: `supabase/migrations/20260915113000_guideline_matrix_permissions.sql`
- Test: `tests/guideline-matrix-permissions.test.mjs`

**Interfaces:**
- Produces: `public.guideline_user_permissions`, `can_access_guideline_multi(uuid)`, `can_edit_guideline_multi(uuid)` y RLS no-Central por `guideline_id`.

- [ ] **Step 1: Crear tabla, constraints, índices, RLS de administración y validación no-Central.**
- [ ] **Step 2: Migrar permisos existentes no-Central por gerencia hacia los lineamientos relacionados.**
- [ ] **Step 3: Reemplazar helpers para CENTRAL por gerencia y no-Central por permiso exacto de lineamiento.**
- [ ] **Step 4: Extender `can_access_unit` para reconocer permisos visibles por lineamiento.**
- [ ] **Step 5: Endurecer políticas de lineamientos, matrices, filas, subpuntos, responsables, locks e historial para no conservar fallback de área en no-Central.**
- [ ] **Step 6: Ajustar `try_lock_matrix_row` para usar edición por área solo en CENTRAL y edición por lineamiento en no-Central.**

### Task 3: Editor de permisos aislado por unidad

**Files:**
- Modify: `src/PermissionCatalogV4.tsx`
- Modify: `src/permission-catalog-v4.css`
- Test: `tests/guideline-matrix-permissions.test.mjs`

**Interfaces:**
- Consumes: `guideline_user_permissions` y `planning_guidelines`.
- Produces: CENTRAL sin cambios conceptuales y HU/VS/DEP/HOT con controles por lineamiento.

- [ ] **Step 1: Cargar lineamientos no-Central y permisos por lineamiento en `loadData`.**
- [ ] **Step 2: Implementar `updateGuidelinePermission`: Editar activa Acceso; quitar Acceso elimina el permiso completo.**
- [ ] **Step 3: Mantener selector/bulk rápido por área únicamente cuando `unitCode === 'CENTRAL'`.**
- [ ] **Step 4: Mantener el modal CENTRAL con las filas de áreas actuales.**
- [ ] **Step 5: Renderizar HU/VS/DEP/HOT como `<details>` cerrados con `Acceso a matriz` y `Edición de matriz`.**
- [ ] **Step 6: Añadir estilos compactos, alineados y responsive sin tocar estilos de Lineamientos.**

### Task 4: GREEN y cierre

**Files:**
- Verify: repository-wide tests and CI.

- [ ] **Step 1: Ejecutar el test específico y corregir únicamente fallos reales de la implementación.**
- [ ] **Step 2: Ejecutar suite completa `node --test tests/*.test.mjs`.**
- [ ] **Step 3: Ejecutar `npm run check`.**
- [ ] **Step 4: Ejecutar `npm run build`.**
- [ ] **Step 5: Aplicar la nueva migración únicamente si el código y SQL están verdes y verificar estado/advisors de Supabase.**
- [ ] **Step 6: Confirmar CI completo del PR #13 en el HEAD final y revisar que `main` no cambió.**
