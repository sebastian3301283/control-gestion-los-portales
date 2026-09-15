# Phase 6 Technical Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar técnicamente `auditoria-codex-parcial` con repositorio, documentación, configuración, Supabase y CI auditados, aplicando solo cambios conservadores y verificables.

**Architecture:** Mantener intacto el runtime aprobado de Fases 1–5. La fase se apoya en regresiones y controles ya existentes para alcanzabilidad, limpieza, seguridad e integridad; cualquier defecto nuevo exige RED antes de un arreglo mínimo. Los warnings de Supabase se tratan como señales, no como órdenes de migración.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Supabase JS 2.x, PostgreSQL/Supabase, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-phase6-technical-closure-design.md`

## Global Constraints

- Trabajar únicamente sobre `auditoria-codex-parcial`.
- No tocar, fusionar ni hacer push a `main`.
- PR #13 debe permanecer en borrador.
- Supabase se revisa principalmente en lectura.
- No crear migraciones para silenciar warnings de advisors.
- Si aparece un bug reproducible: prueba RED primero, arreglo mínimo después.
- No rediseñar UX/UI ni cambiar reglas de negocio de Fases 1–5.
- No hacer upgrades masivos de dependencias.
- Cierre obligatorio con suite completa, TypeScript, build y CI del HEAD final.

---

### Task 1: Confirmar baseline exacto y no rehacer fases previas

**Files:**
- Read: branch metadata, PR #13, workflow run, `.github/workflows/validate.yml`
- No code changes.

**Interfaces:**
- Consumes: HEAD aprobado `85afba8c032ada459fc177cd9e0af150336e70e5`.
- Produces: baseline verificable para toda Fase 6.

- [x] **Step 1: Confirmar rama y HEAD.**

Verificar que `auditoria-codex-parcial` parte exactamente del HEAD aprobado o, si avanzó, inspeccionar primero los commits posteriores.

- [x] **Step 2: Confirmar PR #13.**

Exigir: abierto, `draft: true`, base `main`, head `auditoria-codex-parcial`.

- [x] **Step 3: Confirmar último CI del baseline.**

Exigir que `Validate application` corresponda al HEAD verificado y termine en `success`.

- [x] **Step 4: Confirmar relación con `main`.**

Resultado inicial observado: rama `402` commits por delante y `0` por detrás. No sincronizar ni modificar `main`.

---

### Task 2: Auditar repo, configuración y residuos técnicos

**Files:**
- Read: `.gitignore`
- Read: `package.json`
- Read: `package-lock.json`
- Read: `tsconfig.json`
- Read: `tsconfig.app.json`
- Read: `tsconfig.node.json`
- Read: `vite.config.ts`
- Read: `tests/audit-cleanliness.test.mjs`
- Read: `tests/phase2-runtime-reachability.test.mjs`
- Read: runtime reachable from `src/main.tsx`

**Interfaces:**
- Consumes: controles de limpieza creados en Fase 2.
- Produces: decisión explícita sobre si hace falta código nuevo de limpieza.

- [x] **Step 1: Revisar archivos temporales y secretos versionados.**

Comprobar raíz, `.gitignore` y configuración del cliente. No tratar una publishable key como secret key.

- [x] **Step 2: Revisar TODO/FIXME y debugging.**

Usar tanto búsqueda como `tests/audit-cleanliness.test.mjs`. El criterio del test debe seguir prohibiendo `debugger`, `console.log` y TODO/FIXME en código activo.

- [x] **Step 3: Revisar referencias muertas.**

Usar `tests/phase2-runtime-reachability.test.mjs`; no borrar `CatalogConfigurationLegacy.tsx`, adaptadores DOM u otros archivos que sigan alcanzables.

- [x] **Step 4: Revisar TypeScript/Vite.**

Mantener `strict`, `Bundler`, `noEmit` y configuración Vite mínima mientras no exista defecto reproducible.

- [x] **Step 5: Revisar dependencias.**

No actualizar por disponibilidad de versiones nuevas. El lockfile debe seguir siendo fuente de `npm ci`.

**Resultado esperado:** cero refactor adicional si los controles existentes ya demuestran limpieza y alcanzabilidad.

---

### Task 3: Auditar Supabase en lectura y clasificar advisors

**Files:**
- Read: `supabase/migrations/*`
- Read-only database inspection.

**Interfaces:**
- Consumes: migraciones aplicadas hasta `20260914220435_phase3_security_realtime_history`.
- Produces: registro de warnings aceptados y defectos reales, si existieran.

- [x] **Step 1: Confirmar proyecto y migraciones.**

Verificar que el historial remoto incluye las migraciones que la rama espera. No reaplicar ninguna.

- [x] **Step 2: Ejecutar advisors de seguridad y rendimiento.**

Registrar, sin corregir a ciegas:
- `citext` en `public`;
- `is_email_authorized` pre-auth;
- 27 funciones `SECURITY DEFINER` ejecutables por `authenticated`;
- leaked password protection desactivado;
- 11 foreign keys sin índice;
- 9 índices sin uso.

- [x] **Step 3: Verificar controles básicos de acceso.**

Comprobar RLS en tablas `public`, privilegios directos de `authorized_users` y `search_path`/guards relevantes de funciones privilegiadas.

- [x] **Step 4: Decidir si existe defecto real.**

Si no existe reproducción concreta, no crear migración.

**Resultado observado:** no se identificó un defecto reproducible que justifique DDL de Fase 6.

---

### Task 4: Actualizar documentación y configuración no funcional

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/superpowers/specs/2026-09-14-phase6-technical-closure-design.md`
- Create: `docs/superpowers/plans/2026-09-14-phase6-technical-closure.md`

**Interfaces:**
- Consumes: estado funcional real de Fases 1–5 y `src/lib/supabase.ts`.
- Produces: documentación utilizable por desarrolladores sin alterar runtime.

- [x] **Step 1: Crear diseño de Fase 6.**

Guardar criterios, baseline, resultados de auditoría, warnings aceptados y límites de cambio.

- [x] **Step 2: Crear plan de Fase 6.**

Guardar este documento con tareas y verificación final.

- [ ] **Step 3: Reemplazar README desfasado.**

Debe describir arquitectura, autenticación, planificación, lineamientos, matrices, soportes, permisos, Realtime/historial, configuración local, comandos y CI.

- [ ] **Step 4: Alinear `.env.example`.**

Contenido objetivo:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
# Fallback legado opcional:
# VITE_SUPABASE_ANON_KEY=
```

No modificar `src/lib/supabase.ts` porque ya prioriza la publishable key y su fallback actual es compatible.

---

### Task 5: Gate de defectos reproducibles

**Files:**
- Test: `tests/*.test.mjs` solo si aparece un bug nuevo.
- Modify: archivo mínimo responsable del bug, solo después de RED.

**Interfaces:**
- Consumes: resultado de auditoría Tasks 1–4.
- Produces: fix mínimo o decisión explícita de “sin cambios de runtime”.

- [x] **Step 1: Evaluar hallazgos.**

No confundir deuda, warning o preferencia de estilo con defecto.

- [x] **Step 2: Si no hay reproducción, no tocar runtime.**

Resultado de auditoría: no apareció bug reproducible dentro del alcance.

- [ ] **Step 3: Si apareciera uno durante verificaciones finales, escribir RED primero.**

Ejecutar únicamente el test específico y demostrar fallo antes de modificar implementación.

- [ ] **Step 4: Aplicar arreglo mínimo y revalidar.**

No ampliar alcance ni crear migraciones salvo que el defecto probado sea de esquema y requiera DDL real.

---

### Task 6: Verificación final y cierre del PR

**Files:**
- Update metadata: PR #13 body only.
- No merge.

**Interfaces:**
- Consumes: HEAD final de Fase 6.
- Produces: cierre verificable listo para revisión humana.

- [ ] **Step 1: Ejecutar regresiones completas.**

Run:

```bash
npm test
```

Expected: PASS, cero tests fallidos.

- [ ] **Step 2: Ejecutar TypeScript.**

Run:

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 3: Ejecutar build de producción.**

Run:

```bash
npm run build
```

Expected: exit 0. Los warnings de tamaño de bundle no son fallo por sí solos.

- [ ] **Step 4: Verificar CI del HEAD exacto.**

Esperar/consultar `Validate application` del commit final y exigir `success` en instalación, regresiones, TypeScript y build.

- [ ] **Step 5: Actualizar descripción del PR #13.**

Debe reflejar Fases 1–6, la auditoría conservadora, los cambios documentales, el estado de Supabase, warnings aceptados y el CI final.

- [ ] **Step 6: Confirmar invariantes de cierre.**

Exigir simultáneamente:
- PR #13 sigue `draft: true`;
- PR sigue abierto;
- base sigue `main`;
- `main` no fue modificado;
- no se aplicó ninguna migración en Fase 6;
- no se fusionó el PR.
