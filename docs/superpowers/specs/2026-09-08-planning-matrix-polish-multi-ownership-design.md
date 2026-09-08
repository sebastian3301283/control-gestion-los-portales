# Planificación: pulido visual, historial, Excel y propiedad múltiple

## Alcance

Aplicar mejoras a Planificación y Matrices sin alterar el comportamiento especial de Central salvo donde se indique expresamente para Historial/Excel. Las unidades no Central son HU, DEP, VS y HOT.

## Objetivos aprobados

1. Eliminar cualquier flash/cuadro negro durante la primera carga en frío de Planificación/Lineamientos/Matriz. Los estados de carga deben usar una superficie clara, consistente con la aplicación.
2. Hacer que Historial funcione en vista normal y pantalla completa y rediseñarlo como historial por guardado/persona, con resumen legible y detalle expandible de cambios.
3. Exportar Excel con formato profesional y encabezado completo en todas las matrices. Central conserva su estructura particular; HU/DEP/VS/HOT usan encabezado tipo Plan de Acción con color de unidad.
4. En HU/DEP/VS/HOT, el selector de Gerencia responsable de Lineamientos solo debe mostrar áreas activadas para esa unidad en `matrix_unit_area_catalog`.
5. En HU/DEP/VS/HOT, mejorar visualmente la tabla de Lineamientos y soportar varias gerencias y varios responsables por lineamiento. Central conserva su flujo actual.
6. En HU/DEP/VS/HOT, mostrar encima de la matriz un encabezado tipo hoja de cálculo con periodo, lineamiento, unidad, gerencias responsables y responsables.
7. En HU/DEP/VS/HOT, al añadir/editar una acción debe existir un selector de Objetivo general: si no hay objetivos, permitir escribir el primero; si ya existen, seleccionar uno o crear uno nuevo.
8. Mantener una sola matriz por lineamiento no Central.

## Diseño de datos para varias gerencias y responsables

Se mantienen `planning_guidelines.management_id` y `planning_guidelines.responsible_manager_id` por compatibilidad como valores primarios. Se añaden relaciones normalizadas:

- `planning_guideline_managements(guideline_id, management_id, sort_order, created_at)`
- `planning_guideline_responsibles(guideline_id, manager_id, sort_order, created_at)`

Ambas tablas usan clave primaria compuesta, claves foráneas con `ON DELETE CASCADE`, índices por relación y RLS.

La migración hará backfill de los valores actuales para no perder datos. Central también puede quedar backfilled, pero su UI continuará usando la semántica actual de una gerencia/responsable principal.

Para HU/DEP/VS/HOT:

- El primer `management_id` seleccionado se mantiene en `planning_guidelines.management_id` y determina el `process_id` primario usado por la matriz exclusiva ya existente.
- El primer `manager_id` seleccionado se mantiene en `planning_guidelines.responsible_manager_id`.
- Las relaciones múltiples se usan para visualización, encabezados, exportación y acceso.
- El acceso/edición de una matriz no Central asociada a un lineamiento debe aceptar cualquiera de las gerencias relacionadas con ese lineamiento, además de los permisos globales existentes. Central conserva sus políticas actuales.

La escritura de lineamientos múltiples se hará mediante una función transaccional `save_planning_guideline_multi(...)` para actualizar el padre y reemplazar sus relaciones de gerencia/responsable de forma atómica. La función solo puede ser ejecutada por Gestión Estratégica/global planning manager y valida que todas las gerencias seleccionadas estén activas para la unidad en `matrix_unit_area_catalog` y que los responsables existan/estén activos y vinculados a al menos una de esas gerencias.

## Lineamientos no Central

El formulario usará multiselección para Gerencia responsable y Gerente responsable / Bonistas. Las gerencias vienen exclusivamente de `matrix_unit_area_catalog` para la unidad elegida; los responsables se filtran por `manager_managements` contra las gerencias seleccionadas.

La tabla conserva las columnas:

`N° | Lineamientos Estratégicos | Gerencia Responsable | Gerente Responsable | Acciones`

Las múltiples gerencias/responsables se muestran como chips compactos, alineados y sin concatenaciones difíciles de leer. La flecha de matriz permanece asociada al lineamiento y abre su única matriz.

Central no cambia a multiselección en este trabajo.

## Matriz no Central

La cabecera web se muestra solo dentro de la matriz abierta y contiene:

- `PLAN DE ACCIÓN {año}`
- lineamiento/código seleccionado
- Unidad
- Gerencia(s) responsable(s)
- Responsable(s)

Los colores por unidad se conservan: HU verde, DEP naranja, VS celeste, HOT oscuro.

### Objetivo general

`matrix_rows.objective_group` continúa siendo el Objetivo general y `matrix_rows.objective` continúa siendo la Acción. No se crea otra tabla.

Al añadir acción:

- Si no existen objetivos: mostrar input para escribir el primer Objetivo general.
- Si existen: mostrar selector con objetivos existentes y opción `+ Crear nuevo objetivo`.
- Si se elige crear nuevo: mostrar input editable.
- Al editar una fila: preseleccionar el objetivo actual y permitir cambiarlo o crear otro.

Los objetivos se deduplican por texto normalizado y se obtienen de las filas de la matriz actual.

## Historial

El modal de Historial se renderiza en una capa global/portal para quedar por encima del fullscreen y no quedar recortado por wrappers/overflow.

La lista se agrupa por persona y por guardado/version, mostrando de forma compacta:

- persona
- fecha/hora
- acción resumida (`Agregó una acción`, `Actualizó una acción`, `Eliminó una acción`, etc.)
- cantidad de campos modificados cuando sea posible

Al expandir una versión, se calcula el diff entre snapshots adyacentes y se muestran cambios de negocio legibles (`Responsable`, `Prioridad`, `Fecha`, `Entregable`, etc.), con `Anterior → Nuevo`. No se muestra por defecto un log de cada celda.

La restauración de versión y su permiso actual se conservan.

## Exportar Excel

Se crea una utilidad compartida y lazy-loaded para no afectar la primera carga. Se usará un escritor compatible con estilos (`xlsx-js-style` vía módulo ESM remoto) únicamente al exportar.

HU/DEP/VS/HOT:

- título `PLAN DE ACCIÓN {año}`
- fila de lineamiento destacada con color de unidad
- Unidad, Gerencia(s) Responsable(s), Responsable(s)
- encabezado de columnas coloreado
- bordes, alineación, wrap text, alturas y anchos adecuados
- filtros/autofilter y panel congelado a partir de la tabla
- todas las filas de la matriz, incluyendo responsables múltiples

Central:

- conserva la información/estructura específica de Central y sus subpuntos
- recibe el mismo nivel de formato profesional, sin convertirla al encabezado no Central

## Primera carga / flash negro

Se revisan los fallbacks `Suspense`, CSS cargado de forma diferida y contenedores fullscreen. Todo fallback de módulo debe usar una superficie clara con loader/skeleton y ocupar el espacio esperado. No se modificará ningún elemento externo del navegador/Vercel si el control negro lateral no pertenece al DOM de la aplicación.

## Pruebas y seguridad

Antes de implementar cada bloque se agregan regresiones RED. Después se ejecutan:

- `node --test tests/*.test.mjs`
- `npm run check`
- `npm run build`

La migración se aplica solo después de validar su SQL y mantener compatibilidad hacia atrás. Después de aplicarla se ejecutan advisors de seguridad/performance de Supabase y se verifica RLS. No se toca `main`; todo queda en `auditoria-codex-parcial` hasta validación final.
