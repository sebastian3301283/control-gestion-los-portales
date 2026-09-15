# Permisos de matriz por lineamiento — Diseño aprobado

## Objetivo

Separar el modelo de autorización de CENTRAL del de HU, VS, DEP y HOT. CENTRAL conserva permisos por área; las demás unidades pasan a permisos explícitos por `guideline_id` para acceso y edición de su matriz exacta.

## Reglas de negocio

- CENTRAL mantiene `area_user_permissions`, con Acceso y Edición independientes por área.
- HU, VS, DEP y HOT usan permisos por lineamiento.
- Cada lineamiento no-Central expone `Acceso a matriz` y `Edición de matriz`.
- Edición implica Acceso; no puede existir `can_edit=true` con `can_view=false`.
- Desactivar Acceso elimina también Edición.
- Gestión Estratégica conserva su autorización global actual.
- Gerente General conserva su alcance de lectura global actual; no se amplían privilegios de edición.
- Los permisos no-Central se validan en RLS y funciones de backend, no solo en UI.

## Persistencia

Crear `public.guideline_user_permissions` con FK a `authorized_users` y `planning_guidelines`, `can_view`, `can_edit`, timestamps, unicidad `(authorized_user_id, guideline_id)` y constraint `not can_edit or can_view`.

La tabla solo es administrable por Gestión Estratégica. Una validación de base impide usarla con lineamientos CENTRAL. Los permisos existentes por área de HU/VS/DEP/HOT se migran una sola vez a los lineamientos relacionados para evitar una pérdida abrupta de accesos al activar el nuevo modelo.

## Autorización

Reutilizar `can_access_guideline_multi(uuid)` y `can_edit_guideline_multi(uuid)` como punto único para lineamientos no-Central:

- CENTRAL sigue delegando a `can_access_management` / `can_edit_management`.
- No-Central consulta `guideline_user_permissions` por el `guideline_id` exacto.
- `can_access_unit` reconoce una unidad no-Central cuando el usuario tiene al menos un lineamiento visible, para que la navegación de unidad siga siendo alcanzable.

Las políticas de `planning_guidelines`, `matrices`, `matrix_rows`, subpuntos, responsables, locks e historial deben separar explícitamente la rama CENTRAL de la rama no-Central. En no-Central no debe quedar un fallback por proceso/gerencia que permita saltarse el permiso del lineamiento.

## UI

`PermissionCatalogV4` conserva el editor existente de CENTRAL por área. Para HU/VS/DEP/HOT, el modal `Editar permisos` lista lineamientos activos de la unidad como acordeones `<details>` cerrados por defecto. Dentro de cada acordeón se muestran dos controles compactos y alineados: `Acceso a matriz` y `Edición de matriz`.

La vista rápida/bulk por área queda disponible solo para CENTRAL. En unidades no-Central la asignación se realiza desde `Editar permisos`, evitando mezclar dos modelos visuales.

## Fuera de alcance

- No modificar `main`.
- No modificar ni reaplicar migraciones anteriores.
- No rediseñar `PlanningGuidelines` ni revertir sus últimos ajustes visuales.
- No cambiar el flujo funcional de creación/edición de lineamientos salvo lo necesario para autorización.
