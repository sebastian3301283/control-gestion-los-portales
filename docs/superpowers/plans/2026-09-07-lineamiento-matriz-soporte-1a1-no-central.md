# Lineamiento → Matriz → Soportes 1:1 para HU/DEP/VS/HOT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que cada lineamiento de HU/DEP/VS/HOT cree, abra y elimine exactamente una matriz propia y gestione documentos de soporte exclusivos por `guideline_id`.

**Architecture:** Supabase será la fuente de integridad para la relación 1:1 mediante trigger transaccional e índice único parcial sobre `matrices.guideline_id` para unidades no Central. El frontend transportará `guidelineId` desde la tabla de lineamientos hasta el workspace de matriz y usará el mismo identificador para seleccionar/aislar documentos en Storage. Central queda fuera del cambio.

**Tech Stack:** React 19, TypeScript, Supabase Postgres/RLS/Storage/Realtime, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-09-07-lineamiento-matriz-soporte-1a1-no-central-design.md`

## Global Constraints

- Trabajar únicamente en `auditoria-codex-parcial`.
- No modificar `main` ni fusionar PR #13.
- Central no cambia de comportamiento.
- Eliminar datos operativos de prueba de HU/DEP/VS/HOT antes de activar el modelo nuevo.
- Conservar periodos, unidades, gerencias, procesos, managers, usuarios, permisos, RLS y Realtime.
- Mantener la matriz visible no Central con los 9 encabezados ya aprobados.
- Aplicar TDD y ejecutar suite completa, TypeScript y build antes de finalizar.

---

### Task 1: Integridad 1:1 y limpieza operativa en Supabase

**Files:**
- Create: `supabase/migrations/20260907195000_noncentral_guideline_matrix_one_to_one.sql`
- Modify: `tests/supabase-noncentral-guideline-matrix.test.mjs`

**Interfaces:**
- Consumes: `planning_guidelines(id, period_id, unit_code, management_id, code, guideline_text)` y `processes(id, unit_code, management_id, active)`.
- Produces: trigger helper `sync_noncentral_guideline_matrix()` y trigger `planning_guidelines_noncentral_matrix_sync`; índice único parcial `matrices_noncentral_guideline_uidx`.

- [ ] **Step 1: Escribir pruebas de regresión fallidas**

Crear `tests/supabase-noncentral-guideline-matrix.test.mjs` para verificar textualmente que la nueva migración:

```js
assert.match(sql, /create unique index[^;]+matrices_noncentral_guideline_uidx/is)
assert.match(sql, /guideline_id[^;]+unit_code\s+in\s*\(\s*'HU'\s*,\s*'DEP'\s*,\s*'VS'\s*,\s*'HOT'\s*\)/is)
assert.match(sql, /create or replace function public\.sync_noncentral_guideline_matrix\(\)/i)
assert.match(sql, /from public\.processes[\s\S]+management_id = new\.management_id[\s\S]+active = true/i)
assert.match(sql, /insert into public\.matrices[\s\S]+new\.id/i)
assert.match(sql, /update public\.matrices[\s\S]+where guideline_id = new\.id/i)
assert.match(sql, /delete from public\.matrices[\s\S]+where guideline_id = old\.id/i)
assert.match(sql, /delete from public\.planning_guidelines[\s\S]+unit_code in \('HU','DEP','VS','HOT'\)/i)
assert.match(sql, /delete from public\.matrices[\s\S]+unit_code in \('HU','DEP','VS','HOT'\)/i)
assert.doesNotMatch(sql, /delete from public\.planning_guidelines[\s\S]+CENTRAL/i)
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `node --test tests/supabase-noncentral-guideline-matrix.test.mjs`

Expected: FAIL porque la migración aún no existe.

- [ ] **Step 3: Implementar la migración**

La migración debe:

1. Borrar datos operativos de HU/DEP/VS/HOT en orden seguro, sin tocar Central.
2. Crear índice único parcial sobre `matrices(guideline_id)` para HU/DEP/VS/HOT y `guideline_id is not null`.
3. Crear `public.sync_noncentral_guideline_matrix()` como trigger function con `security definer set search_path = public, pg_temp`.
4. En `INSERT` de lineamiento no Central, resolver exactamente un proceso activo de la misma unidad/gerencia y crear la matriz con `guideline_id = NEW.id`.
5. En `UPDATE`, mantener el mismo `matrix.id`, actualizar contexto y mover `process_id` si cambió gerencia.
6. En `DELETE`, borrar la matriz asociada antes de que el FK existente convierta `guideline_id` a null.
7. Revocar ejecución directa de la función a `public`, `anon` y `authenticated` porque se ejecuta solo por trigger.

Usar un nombre de matriz determinista y único, por ejemplo:

```sql
format('Matriz %s · %s', coalesce(nullif(new.code, ''), 'Lineamiento'), left(new.id::text, 8))
```

Si la cantidad de procesos activos compatibles no es exactamente 1, lanzar excepción con mensaje claro.

- [ ] **Step 4: Ejecutar prueba de migración y suite Supabase relacionada**

Run:

```bash
node --test tests/supabase-noncentral-guideline-matrix.test.mjs tests/supabase-matrix-realtime-migration.test.mjs tests/supabase-function-permissions.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Aplicar la migración al proyecto Supabase `GESTION`**

Aplicar exactamente el SQL versionado usando la operación de migración, no `execute_sql` para DDL.

Después verificar con consultas de solo lectura:

```sql
select unit_code, count(*) from planning_guidelines where unit_code in ('HU','DEP','VS','HOT') group by unit_code;
select unit_code, count(*) from matrices where unit_code in ('HU','DEP','VS','HOT') group by unit_code;
```

Expected: 0 filas en ambas consultas inmediatamente después de la limpieza.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260907195000_noncentral_guideline_matrix_one_to_one.sql tests/supabase-noncentral-guideline-matrix.test.mjs
git commit -m "feat: enforce one matrix per unit guideline"
```

---

### Task 2: Selección de lineamiento y navegación exacta a su matriz

**Files:**
- Modify: `src/GuidelineCatalogV2.tsx`
- Modify: `src/PlanningGuidelines.tsx`
- Modify: `src/Dashboard.tsx`
- Modify: `src/MatrixWorkspace.tsx`
- Modify: `src/MatrixWorkspaceV11.tsx`
- Modify: `src/UnitExcelWorkspace.tsx`
- Modify: `tests/non-central-guideline-parity.test.mjs`
- Modify: `tests/unit-excel-workspace.test.mjs`

**Interfaces:**
- `GuidelineCatalogV2` produce `onSelectGuideline?: (guideline: { id: string; managementId: string; label: string }) => void` y `onOpenMatrix?: (...) => void`.
- `PlanningGuidelines` mantiene `selectedGuideline` y escribe `cg:matrix-target-management` con `guidelineId`.
- `UnitExcelWorkspace` consume target contextual y abre `matrices.guideline_id === guidelineId`.
- `onViewGuidelines` devuelve `{ managementId, guidelineId }`.

- [ ] **Step 1: Ampliar pruebas y confirmar RED**

Añadir regresiones que exijan:

```js
assert.match(catalog, /onSelectGuideline/)
assert.match(catalog, /onOpenMatrix/)
assert.match(catalog, /guidelineId:\s*item\.id/)
assert.match(planning, /selectedGuideline/)
assert.match(dashboard, /guidelineId/)
assert.match(unitWorkspace, /guideline_id/)
assert.doesNotMatch(unitWorkspace, /matrices\.find\(item => processIds\.has\(item\.process_id\)\)/)
```

Run:

```bash
node --test tests/non-central-guideline-parity.test.mjs tests/unit-excel-workspace.test.mjs
```

Expected: FAIL por navegación todavía basada en gerencia/proceso.

- [ ] **Step 2: Exponer eventos de fila en `GuidelineCatalogV2`**

Agregar props opcionales:

```ts
type GuidelineSelection = { id: string; managementId: string; label: string }
type Props = {
  units?: Unit[]
  canManage: boolean
  selectedGuidelineId?: string | null
  onSelectGuideline?: (guideline: GuidelineSelection) => void
  onOpenMatrix?: (guideline: GuidelineSelection) => void
}
```

La fila hace selección al click. La flecha usa `event.stopPropagation()` y llama `onOpenMatrix` con el lineamiento exacto. Editar/eliminar también detienen propagación para no cambiar accidentalmente la selección.

- [ ] **Step 3: Mantener selección en `PlanningGuidelines`**

Reemplazar la dependencia de `selectedArea` para no Central por:

```ts
type SelectedGuideline = { id: string; managementId: string; label: string } | null
```

Al volver desde matriz, si `cg:guideline-target.guidelineId` existe, usarlo como `selectedGuidelineId` inicial.

- [ ] **Step 4: Transportar `guidelineId` hasta matriz**

Cambiar el callback de Dashboard a:

```ts
function openMatrixFromGuidelines(managementId: string, guidelineId: string)
```

y almacenar:

```ts
{
  periodId,
  unitCode,
  managementId,
  guidelineId,
  createdAt: Date.now(),
}
```

- [ ] **Step 5: Resolver matriz no Central por `guideline_id`**

En `UnitExcelWorkspace` incluir `guideline_id` en `Matrix` y seleccionar:

```ts
function matrixForGuideline(guidelineId: string) {
  return matrices.find(item => item.guideline_id === guidelineId) || null
}
```

El target automático debe abrir esa matriz exacta; la selección por área queda solo como contexto visual/permisos, no como criterio de identidad.

- [ ] **Step 6: Mantener retorno exacto con `Ver lineamientos`**

Al cambiar `selectedMatrixId`, actualizar `guidelineContext` con el `guideline_id` de la matriz activa y la gerencia relacionada, para que `onViewGuidelines` transporte ambos.

- [ ] **Step 7: Ejecutar pruebas específicas**

Run:

```bash
node --test tests/non-central-guideline-parity.test.mjs tests/unit-excel-workspace.test.mjs tests/central-visual-polish.test.mjs
```

Expected: PASS, incluyendo regresiones Central.

- [ ] **Step 8: Commit**

```bash
git add src/GuidelineCatalogV2.tsx src/PlanningGuidelines.tsx src/Dashboard.tsx src/MatrixWorkspace.tsx src/MatrixWorkspaceV11.tsx src/UnitExcelWorkspace.tsx tests/non-central-guideline-parity.test.mjs tests/unit-excel-workspace.test.mjs
git commit -m "feat: open unit matrices by guideline"
```

---

### Task 3: Documentos de soporte exclusivos por lineamiento

**Files:**
- Modify: `src/GuidelinePptPanel.tsx`
- Modify: `src/PlanningGuidelines.tsx`
- Modify: `src/guideline-ppt-panel.css`
- Modify: `src/planning-guidelines.css`
- Modify: `tests/non-central-guideline-parity.test.mjs`

**Interfaces:**
- `GuidelinePptPanel` consume `guidelineId?: string | null` y `guidelineLabel?: string | null` para HU/DEP/VS/HOT.
- Produce callback opcional `onDeleteGuidelineSupport?:` no necesario; en su lugar exportar helper `deleteGuidelineSupportFiles(...)` o implementar borrado desde `PlanningGuidelines` con función compartida para evitar lógica duplicada.

- [ ] **Step 1: Escribir pruebas RED**

Exigir:

```js
assert.match(ppt, /guidelineId/)
assert.match(ppt, /`\$\{unit\.code\}\/\$\{periodId\}\/\$\{guidelineId\}`/)
assert.doesNotMatch(ppt, /Todos los documentos de soporte del periodo se muestran juntos/)
assert.match(ppt, /Selecciona un lineamiento/)
assert.match(planning, /selectedGuideline/)
```

Run: `node --test tests/non-central-guideline-parity.test.mjs`

Expected: FAIL.

- [ ] **Step 2: Cambiar Storage path por `guidelineId`**

Para no Central:

```ts
const guidelineFolder = guidelineId ? `${unit.code}/${periodId}/${guidelineId}` : ''
```

`loadFiles`, `upload`, `view` y `remove` deben trabajar únicamente en esa carpeta.

Central continúa usando `unit/period/managementId`.

- [ ] **Step 3: Estado vacío y etiqueta contextual**

Sin lineamiento seleccionado mostrar:

`Selecciona un lineamiento arriba para ver o guardar sus documentos de soporte.`

Con selección mostrar en el encabezado:

`Documentos de soporte · ${guidelineLabel}`

- [ ] **Step 4: Borrado seguro antes de eliminar lineamiento**

Crear helper compartido en `GuidelinePptPanel.tsx` o archivo pequeño `src/guideline-support-storage.ts`:

```ts
export async function deleteGuidelineSupportFiles(unitCode: string, periodId: string, guidelineId: string): Promise<{ error: string | null }>
```

Debe listar la carpeta exacta, eliminar todos sus objetos mediante `supabase.storage.from('planning-ppts').remove(paths)` y devolver error si cualquier operación falla.

`GuidelineCatalogV2.deleteGuideline` debe invocar este helper para HU/DEP/VS/HOT antes de borrar `planning_guidelines`. Central conserva su flujo existente.

- [ ] **Step 5: Ejecutar pruebas**

Run:

```bash
node --test tests/non-central-guideline-parity.test.mjs tests/app-integrity.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/GuidelinePptPanel.tsx src/PlanningGuidelines.tsx src/guideline-ppt-panel.css src/planning-guidelines.css src/guideline-support-storage.ts tests/non-central-guideline-parity.test.mjs
git commit -m "feat: scope planning support to guidelines"
```

---

### Task 4: Limpiar soportes de prueba actuales en Storage

**Files:**
- No source file unless an audit note is added to the migration/spec.

**Interfaces:**
- Consumes bucket `planning-ppts`.
- Removes only prefixes `HU/`, `DEP/`, `VS/`, `HOT/`.

- [ ] **Step 1: Listar objetos existentes**

Usar Storage API o herramienta Supabase disponible; no borrar objetos Central.

Expected: obtener lista exacta de objetos no Central. Si está vacía, registrar 0 eliminados.

- [ ] **Step 2: Eliminar objetos no Central**

Eliminar únicamente objetos cuyo primer segmento sea HU, DEP, VS o HOT.

- [ ] **Step 3: Verificar**

Volver a listar y confirmar 0 objetos bajo esos prefijos, mientras objetos Central (si existen) permanecen.

---

### Task 5: Verificación integral y estado final

**Files:**
- Modify tests only if an existing assertion is stale and contradicts el diseño aprobado; no debilitar pruebas funcionales.

**Interfaces:**
- End-to-end repository verification.

- [ ] **Step 1: Verificar invariantes directamente en Supabase**

Ejecutar consultas de solo lectura:

```sql
select count(*) from planning_guidelines where unit_code in ('HU','DEP','VS','HOT');
select count(*) from matrices where unit_code in ('HU','DEP','VS','HOT');
```

Antes de crear datos nuevos de prueba, ambos deben ser 0.

Revisar existencia de trigger e índice con `pg_trigger` y `pg_indexes`.

- [ ] **Step 2: Ejecutar toda la suite**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: 0 failures.

- [ ] **Step 3: TypeScript**

Run:

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 4: Build producción**

Run:

```bash
npm run build
```

Expected: exit 0. El warning actual de chunk >500 kB no bloquea.

- [ ] **Step 5: Comparar alcance**

Comparar contra el head inicial `d62e23e857366f08f5308fb854a9f2392b466c0b` y confirmar que no se tocó `main`, Central no recibió cambios funcionales y solo aparecen archivos esperados.

- [ ] **Step 6: Verificar CI de PR #13**

Esperar el workflow `Validate application`, leer job completo y confirmar tests, TypeScript y build exitosos antes de declarar finalización.
