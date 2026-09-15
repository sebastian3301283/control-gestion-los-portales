# Fase 3 Security Realtime History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear permisos no Central, locks colaborativos, historial restaurable y Realtime con la arquitectura aprobada de matrices por `guideline_id`.

**Architecture:** Endurecimiento incremental sobre las capas existentes. Una única migración nueva corrige RLS/locks/historial/publicación Realtime y el frontend amplía el canal actual de `MatrixRealtimeLayer` para metadatos de `matrices`, sin introducir un segundo sistema de sincronización.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Postgres/RLS/Realtime/Storage, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-phase3-security-realtime-history-design.md`

## Global Constraints

- Trabajar únicamente en `auditoria-codex-parcial`.
- No tocar, fusionar ni hacer push directo a `main`.
- No modificar ni reaplicar migraciones ya registradas en Supabase.
- La migración nueva se aplica una sola vez mediante Supabase y luego se sincroniza al repo con el versionado exacto registrado por Supabase.
- Mantener Central separado y no volver a acoplar matrices no Central a gerencia/área.
- Regresiones primero; verificación final exacta al HEAD.

---

### Task 1: Regresiones Fase 3

**Files:**
- Create: `tests/phase3-security-realtime-history.test.mjs`
- Read: `supabase/migrations/*.sql`
- Read: `src/MatrixRealtimeLayer.tsx`

**Interfaces:**
- Consumes: migraciones SQL y sus funciones/policies, `MatrixRealtimeLayer`.
- Produces: regresiones estructurales que fallan en el baseline y describen el comportamiento aprobado.

- [ ] **Step 1: Crear pruebas RED para RLS no Central de subpuntos**

La prueba debe exigir que la migración de Fase 3 contenga políticas de `matrix_row_subpoints` con ramas `can_access_guideline_multi` y `can_edit_guideline_multi`, además del control existente por unidad/gerencia.

- [ ] **Step 2: Crear pruebas RED para locks**

Exigir que `try_lock_matrix_row()` y la lectura de `matrix_row_edit_locks` acepten matrices no Central autorizadas por `guideline_id`, manteniendo `auth.uid()` y propiedad del lock para heartbeat/release.

- [ ] **Step 3: Crear pruebas RED para historial con responsables**

Exigir que `capture_matrix_version()` almacene la clave `responsibles`, que exista trigger sobre `matrix_row_responsibles`, que la coalescencia acepte acciones `RESPONSIBLE_`, y que `restore_matrix_version_by_context()` restaure responsables.

- [ ] **Step 4: Crear pruebas RED para Realtime y seguridad auxiliar**

Exigir que la migración añada `public.matrices` a `supabase_realtime`; exigir que `MatrixRealtimeLayer.tsx` se suscriba a `matrices`; proteger `is_email_authorized(text)` como excepción pre-auth explícita y las policies de `planning-ppts` como restringidas.

- [ ] **Step 5: Ejecutar CI de la rama y confirmar RED**

Esperado: únicamente las nuevas regresiones de Fase 3 fallan; las regresiones anteriores permanecen verdes.

- [ ] **Step 6: Commit**

Commit: `test: add phase 3 security realtime history regressions`.

---

### Task 2: Migración incremental de seguridad, locks e historial

**Files:**
- Create: migration registrada por Supabase con nombre `phase3_security_realtime_history`, sincronizada después al path exacto `supabase/migrations/<version_registrada>_phase3_security_realtime_history.sql`.
- Test: `tests/phase3-security-realtime-history.test.mjs`

**Interfaces:**
- Consumes: `can_access_management`, `can_edit_management`, `can_access_guideline_multi`, `can_edit_guideline_multi`, `matrix_versions`, `matrix_row_responsibles`.
- Produces: RLS consistente, locks consistentes y snapshots/restores completos.

- [ ] **Step 1: Corregir policies de `matrix_row_subpoints`**

SELECT debe aceptar `can_access_management(...) OR (no Central AND guideline_id IS NOT NULL AND can_access_guideline_multi(guideline_id))`. INSERT/UPDATE/DELETE deben usar la rama equivalente con `can_edit_guideline_multi` y conservar Gestión Estratégica.

- [ ] **Step 2: Corregir locks**

Reemplazar la autorización exclusiva por gerencia en `try_lock_matrix_row()` por el mismo predicado de edición que `matrix_rows`. Actualizar `matrix_row_edit_locks_read` con la misma rama de acceso no Central. No ampliar heartbeat/release.

- [ ] **Step 3: Ampliar `capture_matrix_version()`**

Agregar `responsibles_json` ordenado por fila y responsable. El snapshot debe guardar `responsibles`. La expresión de coalescencia debe considerar `^(ROW_|SUBPOINT_|RESPONSIBLE_)` para cambios consecutivos del mismo usuario dentro de la ventana existente.

- [ ] **Step 4: Agregar trigger de responsables**

Crear una función trigger que resuelva `matrix_id` desde `matrix_row_responsibles.row_id` usando OLD/NEW y llame a `capture_matrix_version(matrix_id, 'RESPONSIBLE_' || TG_OP)`, respetando `app.matrix_restore` para no duplicar versiones durante restore.

- [ ] **Step 5: Ampliar restore**

`restore_matrix_version_by_context()` debe leer `snapshot->'responsibles'`, restaurarlos después de filas/subpuntos y antes de capturar `RESTORE`. Debe retornar también `responsibles_restored`.

- [ ] **Step 6: Publicar `matrices` en Realtime de forma idempotente**

Agregar `public.matrices` a `supabase_realtime` solo si no está ya publicada.

- [ ] **Step 7: Aplicar una sola vez mediante Supabase**

Usar el nombre `phase3_security_realtime_history`; no reejecutar migraciones anteriores. Registrar el versionado generado.

- [ ] **Step 8: Sincronizar SQL exacto al repositorio**

Crear el archivo con la versión exacta registrada por Supabase y el SQL exacto aplicado.

- [ ] **Step 9: Ejecutar regresiones Fase 3**

Esperado: pasan las pruebas SQL/migración; la prueba de frontend Realtime todavía puede permanecer RED hasta Task 3.

- [ ] **Step 10: Commit**

Commit: `fix: align phase 3 database authorization and history`.

---

### Task 3: Realtime de metadatos de matriz

**Files:**
- Modify: `src/MatrixRealtimeLayer.tsx`
- Test: `tests/phase3-security-realtime-history.test.mjs`

**Interfaces:**
- Consumes: canal existente `matrix-collab:${matrixId}` y `requestRefresh(table,eventType)`.
- Produces: refresco de la matriz activa al cambiar su fila de `public.matrices`, sin nuevos canales.

- [ ] **Step 1: Añadir handler Postgres Changes de `matrices`**

En el mismo channel privado, suscribirse a `public.matrices`. Filtrar en callback con `shouldRefreshMatrix(payload, matrixId)` y disparar `requestRefresh('matrices', payload.eventType)`.

- [ ] **Step 2: Mantener aislamiento del canal**

No crear canales adicionales, no cambiar Presence/Broadcast, no quitar `supabase.realtime.setAuth()` ni `removeChannel()` del cleanup.

- [ ] **Step 3: Ejecutar la prueba de Fase 3**

Esperado: toda `phase3-security-realtime-history.test.mjs` verde.

- [ ] **Step 4: Commit**

Commit: `fix: refresh active matrix metadata in realtime`.

---

### Task 4: Verificación de base de datos y seguridad

**Files:**
- No cambios de producto salvo que una verificación demuestre una regresión real.

**Interfaces:**
- Consumes: Supabase `GESTION` ya migrado.
- Produces: evidencia de estado real posterior a Fase 3.

- [ ] **Step 1: Consultar policies y funciones activas**

Verificar `matrix_row_subpoints`, `matrix_row_edit_locks`, `try_lock_matrix_row`, `capture_matrix_version`, trigger de responsables y `restore_matrix_version_by_context`.

- [ ] **Step 2: Verificar publicación Realtime**

Confirmar que `matrices`, `matrix_rows`, `matrix_row_subpoints`, `matrix_row_responsibles` y `matrix_row_edit_locks` están en `supabase_realtime`.

- [ ] **Step 3: Ejecutar Security Advisor**

Clasificar warnings: distinguir exposiciones intencionales como `is_email_authorized(text)` de riesgos nuevos. No cambiar permisos sin evidencia funcional.

- [ ] **Step 4: Ejecutar Performance Advisor**

Revisar índices/policies relacionados con la fase y corregir únicamente hallazgos introducidos o directamente agravados por esta migración.

---

### Task 5: Cierre técnico exacto al HEAD

**Files:**
- Modify: `docs/superpowers/plans/2026-09-14-phase3-security-realtime-history.md` solo para registrar resultados si se requiere.

**Interfaces:**
- Consumes: rama final.
- Produces: Fase 3 verificable y lista para pasar a Fase 4.

- [ ] **Step 1: Ejecutar suite completa**

Esperado: 0 fallos.

- [ ] **Step 2: Ejecutar TypeScript**

Run: `npm run check`; esperado: PASS.

- [ ] **Step 3: Ejecutar build**

Run: `npm run build`; esperado: PASS.

- [ ] **Step 4: Verificar GitHub Actions**

Workflow `Validate application` debe quedar verde sobre el SHA exacto de `auditoria-codex-parcial`.

- [ ] **Step 5: Verificar `main`**

Comparar SHA de `main` con su baseline previo; debe permanecer sin cambios por esta fase.

- [ ] **Step 6: Entrega final**

Reportar HEAD exacto, CI, pruebas, TypeScript/build, migración registrada, estado de Supabase y cualquier warning preexistente deliberadamente no cambiado.
