# Fase 3 — Seguridad, Realtime e Historial

## Objetivo

Cerrar inconsistencias entre la arquitectura aprobada de Fase 1 y las capas de autorización, colaboración e historial, sin rediseñar el producto ni tocar `main`.

## Alcance aprobado: enfoque A — endurecimiento incremental

La implementación conserva la arquitectura actual y corrige solo fallas demostrables. No se migrará toda la colaboración a Broadcast, no se reescribirá el sistema de permisos y no se reaplicarán migraciones anteriores.

## Invariantes

- Trabajar únicamente en `auditoria-codex-parcial`.
- No tocar, fusionar ni hacer push directo a `main`.
- No modificar ni reaplicar migraciones ya registradas en Supabase.
- Toda modificación de base de datos nueva se realizará como una migración incremental nueva y se verificará contra el proyecto Supabase `GESTION`.
- Mantener el modelo no Central aprobado: `Periodo → Unidad → Lineamiento → una Matriz exclusiva → Soportes exclusivos`.
- Para HU/DEP/VS/HOT, `guideline_id` es parte de la identidad y autorización de la matriz; área/gerencia permanece como metadato y no redefine identidad.
- Central conserva su flujo separado.
- Regresiones primero, luego implementación mínima, TypeScript, build y CI exacto al HEAD final.

## Diseño

### 1. RLS de subpuntos no Central

`matrix_rows` y `matrix_row_responsibles` ya permiten acceso no Central mediante `can_access_guideline_multi()` / `can_edit_guideline_multi()` cuando la matriz tiene `guideline_id`. `matrix_row_subpoints` debe usar el mismo criterio.

Las políticas SELECT/INSERT/UPDATE/DELETE de `matrix_row_subpoints` se alinearán con:

- acceso de lectura: `can_access_unit(m.unit_code)` y (`can_access_management(...)` o, para no Central con `guideline_id`, `can_access_guideline_multi(...)`);
- edición: `is_global_planning_manager()` o `can_edit_management(...)` o, para no Central con `guideline_id`, `can_edit_guideline_multi(...)`.

No se amplía acceso de Central ni se elimina el control por gerencia.

### 2. Locks colaborativos

`try_lock_matrix_row()` debe autorizar con el mismo criterio que la edición real de `matrix_rows`.

- Central: mantiene `can_edit_management()`.
- No Central con `guideline_id`: permite `can_edit_guideline_multi()`.
- `heartbeat_matrix_row_lock()` y `release_matrix_row_lock()` continúan limitados al dueño autenticado del lock.
- La política SELECT de `matrix_row_edit_locks` debe reconocer también matrices no Central autorizadas por lineamiento.

### 3. Historial completo

El snapshot de `matrix_versions` debe representar el estado restaurable completo de una matriz:

- `matrix`
- `rows`
- `subpoints`
- `responsibles`

Los cambios en `matrix_row_responsibles` deben generar captura de versión y entrar en la misma ventana de coalescencia de una operación de UI que ya agrupa cambios `ROW_` y `SUBPOINT_`.

La restauración deberá:

1. restaurar filas;
2. restaurar subpuntos;
3. restaurar responsables;
4. restaurar metadatos de matriz;
5. capturar una versión `RESTORE` posterior.

No se cambia la semántica histórica existente fuera de incluir responsables.

### 4. Realtime de matriz

Se conserva Postgres Changes + Presence porque el volumen esperado es reducido y la implementación ya tiene un canal privado por matriz.

Se añadirá `matrices` a `supabase_realtime` y `MatrixRealtimeLayer` escuchará sus cambios filtrando por la matriz activa. Los cambios deben disparar el evento común `matrix-realtime-data-change` sin crear canales adicionales.

No se migra a Broadcast en esta fase.

### 5. RPC, Security Definer y Storage

No se revocarán indiscriminadamente RPC `SECURITY DEFINER`: varias funciones son endpoints deliberados con validación interna y otras son helpers necesarios por RLS.

- `is_email_authorized(text)` permanece ejecutable antes del login de forma intencional; `authorized_users` continúa sin acceso directo.
- Los RPC administrativos deben seguir verificando `is_global_planning_manager()` o autorización equivalente antes de mutar datos.
- Storage `planning-ppts` conserva su modelo actual; Fase 3 agregará regresiones estáticas sobre sus políticas para evitar ampliaciones accidentales.

## Verificación requerida

- Regresiones nuevas para RLS no Central de subpuntos, locks, historial con responsables, publicación Realtime de `matrices` y Storage/RPC.
- Verificación SQL directa de políticas, función de locks, triggers y publicación Realtime después de aplicar la migración.
- Supabase Security Advisor y Performance Advisor al final.
- Suite completa del repositorio.
- `npm run check`.
- `npm run build`.
- GitHub Actions `Validate application` verde sobre el SHA exacto final.
- Confirmación final de que `main` no cambió.
