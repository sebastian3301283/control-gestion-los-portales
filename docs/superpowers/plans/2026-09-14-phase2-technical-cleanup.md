# Phase 2 Technical Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir deuda técnica real sin alterar el comportamiento aprobado de Fase 1 ni romper Central, HU, DEP, VS o HOT.

**Architecture:** Partir del grafo de imports real desde `src/main.tsx`, distinguir runtime activo de generaciones antiguas y conservar CSS/helpers todavía consumidos por la cadena activa. Las limpiezas de wrappers DOM se abordarán solo cuando puedan sustituirse por contratos declarativos sin cambiar flujos ni datos.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Supabase JS, Node test runner.

**Spec:** alcance aprobado de Fase 2: limpieza técnica global posterior al cierre de integridad Lineamientos → Matriz → Soportes.

## Global Constraints

- Trabajar únicamente sobre `auditoria-codex-parcial`.
- No tocar, fusionar ni hacer push a `main`.
- No aplicar ni reaplicar migraciones de Supabase.
- Mantener intacto el comportamiento funcional validado en Fase 1.
- No eliminar código, estilos o tests sin demostrar que ya no participan del runtime o que validan únicamente una generación retirada.
- Evitar refactors masivos; cada limpieza debe ser mínima y verificable.
- Cierre obligatorio con regresiones completas, TypeScript, build y CI verdes.

---

### Task 1: Baseline y mapa de alcanzabilidad runtime

**Files:**
- Modify: `tests/audit-cleanliness.test.mjs`
- Create: `tests/phase2-runtime-reachability.test.mjs`

- [ ] Construir el grafo de imports relativos desde `src/main.tsx`, incluyendo imports estáticos, dinámicos y CSS.
- [ ] Reportar implementaciones runtime no alcanzables sin confundir `.d.ts` compañeros de módulos JS activos.
- [ ] Añadir regresiones que impidan reintroducir generaciones retiradas.

### Task 2: Retirar generaciones y helpers realmente muertos

**Files:**
- Delete only when proven unreachable: legacy TSX/JS/CSS generations and tests dedicated exclusively to them.

- [ ] Retirar `MatrixWorkspaceV10.tsx` solo si no existe ruta de import activa.
- [ ] Revisar helpers históricos usados únicamente por esa generación (`central-table-rows`, `matrix-subpoints`, `central-excel-model`) y retirar solo los que queden sin consumidor runtime.
- [ ] Conservar hojas CSS antiguas todavía importadas por `CentralExcelWorkspace`, `UnitExcelWorkspace`, V11/V12/V13 o componentes activos.

### Task 3: Limpiar adaptadores DOM demostrablemente redundantes

**Files:**
- Inspect: `src/CatalogConfiguration.tsx`, `src/PlanningGuidelines.tsx`, `src/MatrixWorkspace.tsx`, V11/V12/V13 and their active children.
- Modify only wrappers whose behavior can be expressed declaratively without changing output.

- [ ] Identificar `MutationObserver`, `document.createElement`, clicks sintéticos y aliases puente.
- [ ] Eliminar primero solo los que ya fueron reemplazados por renderizado/props nativos.
- [ ] Mantener temporalmente cualquier adaptador que todavía sea necesario para Central o para compatibilidad visual, documentando por qué no se elimina aún.

### Task 4: Higiene de imports, estados y lógica duplicada

**Files:**
- Inspect all active files reachable from `src/main.tsx`.

- [ ] Eliminar imports, estados, funciones y listeners sin uso cuando TypeScript/tests demuestren que son redundantes.
- [ ] Mantener timers de colaboración/locks que tengan función activa (por ejemplo heartbeat) y comprobar cleanup.
- [ ] No cambiar contratos de Supabase ni permisos en esta fase.

### Task 5: Verificación integral de Fase 2

- [ ] Ejecutar toda la suite Node y exigir cero fallos.
- [ ] Ejecutar TypeScript y exigir cero errores.
- [ ] Ejecutar build de producción y exigir éxito.
- [ ] Revisar CI final del HEAD exacto.
- [ ] Confirmar que `main` y Supabase no fueron modificados.
