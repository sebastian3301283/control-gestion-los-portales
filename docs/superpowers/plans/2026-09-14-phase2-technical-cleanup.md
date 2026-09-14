# Phase 2 Technical Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir deuda técnica real sin alterar el comportamiento aprobado de Fase 1 ni romper Central, HU, DEP, VS o HOT.

**Architecture:** Partir del grafo de imports real desde `src/main.tsx`, distinguir runtime activo de generaciones antiguas y conservar CSS/helpers todavía consumidos por la cadena activa. Las limpiezas de wrappers DOM se abordan solo cuando pueden sustituirse por contratos declarativos sin cambiar flujos ni datos.

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
- Modified: `tests/audit-cleanliness.test.mjs`
- Created: `tests/phase2-runtime-reachability.test.mjs`

- [x] Construir el grafo de imports relativos desde `src/main.tsx`, incluyendo imports estáticos, dinámicos y CSS.
- [x] Reportar implementaciones runtime no alcanzables sin confundir `.d.ts` compañeros de módulos JS activos.
- [x] Añadir regresiones que impidan reintroducir generaciones retiradas.

**Resultado:** el primer RED detectó exactamente seis archivos runtime inalcanzables y protegió `matrix-subpoints.js` al demostrar que sí sigue activo.

### Task 2: Retirar generaciones y helpers realmente muertos

- [x] Retirar `MatrixWorkspaceV10.tsx` después de demostrar que no existe ruta de import activa.
- [x] Retirar los helpers/CSS probadamente inalcanzables: `central-table-rows.js`, su `.d.ts`, `central-excel-model.js`, `catalog-configuration-v2.css`, `matrix-subpoints.css` y `new-guideline.css`.
- [x] Retirar pruebas exclusivas de V10/helpers muertos y reorientar la cobertura mixta de responsables a `CentralExcelWorkspace`.
- [x] Conservar `matrix-subpoints.js` y las hojas CSS antiguas que todavía son importadas por `CentralExcelWorkspace`, `UnitExcelWorkspace`, V11/V12/V13 o componentes activos.

### Task 3: Limpiar adaptadores DOM demostrablemente redundantes

**Inspeccionados:** `src/CatalogConfiguration.tsx`, `src/PlanningGuidelines.tsx`, `src/MatrixWorkspace.tsx`, V11/V12/V13 y sus hijos activos.

- [x] Identificar `MutationObserver`, `document.createElement`, clicks sintéticos y aliases puente.
- [x] Confirmar que el adaptador de flecha de Lineamientos ya fue reemplazado por renderizado nativo y permanece eliminado.
- [x] Mantener los adaptadores restantes porque todavía implementan comportamiento activo: apertura contextual de Central, filtros/compatibilidad visual de Configuración y ajustes vigentes de Lineamientos/Resumen. Retirarlos aquí cambiaría comportamiento y queda fuera de una limpieza segura.

### Task 4: Higiene de imports, estados y lógica duplicada

- [x] El mapa de alcanzabilidad deja cero módulos runtime huérfanos en `src` (excluyendo declaraciones `.d.ts`).
- [x] Mantener listeners/timers de colaboración y Realtime que continúan cubiertos por regresiones activas.
- [x] No cambiar contratos de Supabase, RLS ni permisos en esta fase.
- [x] Añadir protección en `audit-cleanliness` para impedir reintroducir `MatrixWorkspaceV10`.

### Task 5: Verificación integral de Fase 2

- [ ] Ejecutar toda la suite Node y exigir cero fallos sobre el HEAD final.
- [ ] Ejecutar TypeScript y exigir cero errores sobre el HEAD final.
- [ ] Ejecutar build de producción y exigir éxito sobre el HEAD final.
- [ ] Revisar CI final del HEAD exacto.
- [ ] Confirmar que `main` y Supabase no fueron modificados.
