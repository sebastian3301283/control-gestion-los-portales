# Unificar matrices de unidades con la experiencia de Central

## Objetivo

Replicar en las matrices de las unidades no Central (HU, DEP, VS, HOT y cualquier otra unidad soportada por el mismo flujo) la experiencia funcional y visual ya validada en Central, sin modificar la experiencia de Lineamientos ni implementar cambios de plantillas de importación de lineamientos.

## Fuera de alcance

- No modificar `CentralGuidelineWorkspace` ni el comportamiento actual de Lineamientos de Central.
- No sustituir `GuidelineCatalogV2` en las demás unidades.
- No implementar ni modificar la nueva plantilla de importación `Categoría | Lineamiento | Áreas`.
- No crear ni repetir migraciones Supabase ya aplicadas.
- No modificar `main`; todo el trabajo continúa en `auditoria-codex-parcial` hasta completar la verificación.

## Estado actual

`MatrixWorkspaceV13` envía Central a `MatrixWorkspaceV12` y el resto de unidades directamente a `MatrixWorkspaceV11`. Por eso Central recibe Vista Matriz/Resumen e historial paginado, mientras las demás unidades conservan el historial anterior dentro de `UnitExcelWorkspace`.

`MatrixWorkspaceV11` ya comparte para todas las unidades la capa de edición colaborativa y bloqueo de filas, pero selecciona `CentralExcelWorkspace` para Central y `UnitExcelWorkspace` para HU/DEP/VS/HOT.

`UnitExcelWorkspace` ya dispone de edición tipo Excel, responsables múltiples, creación de filas al final, importación/exportación Excel y Realtime. Sin embargo, todavía usa el historial antiguo que trae `snapshot`, carece de Vista Resumen y mantiene una toolbar/flujo diferente de la experiencia final de Central.

## Diseño

### 1. Un único shell de experiencia para todas las matrices

`MatrixWorkspaceV13` debe envolver todas las unidades con `MatrixWorkspaceV12`, no solo Central. `MatrixWorkspaceV12` será la capa común para:

- Vista `Matriz | Resumen`.
- Historial paginado de 20 versiones.
- `Cargar más`.
- Restauración por `restore_matrix_version_by_context` cuando el usuario tenga permiso.
- Resolución de nombres de usuarios mediante `profiles`.
- No solicitar `snapshot` al listar el historial.
- Mantener una sola suscripción Realtime, la existente en `MatrixRealtimeLayer`.

Central seguirá renderizando internamente `CentralExcelWorkspace`; las demás unidades seguirán renderizando `UnitExcelWorkspace`. La unificación es del comportamiento y presentación común, no una sustitución indiscriminada de la lógica de datos de cada unidad.

### 2. Vista Resumen para unidades no Central

La Vista Resumen de HU/DEP/VS/HOT debe reutilizar los datos ya renderizados en la tabla, sin hacer consultas Supabase adicionales.

Debe mostrar las mismas cuatro columnas que Central:

`Acción | Responsable | Fecha | Entregable`

Para unidades no Central, el mapeo será:

- Acción: columna `Acción` de la matriz, no `Objetivo`.
- Responsable: columna `Responsable`.
- Fecha: el valor visible de `Hitos / Fechas`/`Fechas`.
- Entregable: columna `Entregable`.

La implementación debe identificar columnas por encabezado o mediante metadatos/clases estables, evitando depender de índices propios de Central.

### 3. Historial común

El historial común debe interceptar el botón `Historial` de todas las matrices y evitar que `UnitExcelWorkspace` ejecute su consulta antigua con `snapshot`.

Comportamiento obligatorio:

- 20 versiones iniciales.
- `Cargar más` para páginas siguientes.
- Consulta de metadatos: `id,version_no,action,changed_email,created_at`.
- Agrupación por usuario.
- Nombre completo cuando exista en `profiles`; fallback derivado del correo.
- Restauración solo para Gestión Estratégica/global planning manager.
- No restaurar si existe una fila en edición/bloqueada.
- Al restaurar, cerrar historial, volver a Vista Matriz y refrescar la matriz.
- La consolidación de escrituras por un mismo Guardar continúa dependiendo de la migración ya aplicada `20260907144427_coalesce_matrix_version_writes`.

### 4. Paridad visual y de interacción

Las matrices no Central deben adoptar los comportamientos de Central que no cambian su modelo de datos:

- Toolbar principal consistente: expandir/salir de pantalla completa, historial, exportar y acción de creación.
- La acción de crear debe expresarse como `Añadir acción` en lugar de `Nueva fila`.
- La nueva acción permanece al final de las filas existentes.
- Edición en línea tipo Excel.
- `Ctrl+Enter` guarda y `Escape` cancela/cierra el selector cuando corresponda.
- Responsables múltiples con chips.
- Cambio de fila durante edición conserva el diálogo `Guardar y cambiar | Descartar y cambiar | Seguir editando`.
- Indicador de edición colaborativa/bloqueos permanece activo.
- Scroll horizontal contenido dentro de la tabla, sin desbordar wrappers.

### 5. Estructura de datos específica de cada unidad

La paridad de experiencia no debe borrar diferencias legítimas del modelo no Central.

Para HU/DEP/VS/HOT se mantienen:

- Selección de área propia de la unidad.
- Catálogos y permisos de esa unidad.
- Campo `Objetivo` si actualmente forma parte de su matriz y datos existentes.
- Importación Excel actual de matrices, salvo los cambios mínimos necesarios para que conviva con la nueva toolbar.
- Reglas actuales de responsables de las unidades no Central, mientras no exista una indicación explícita para reemplazarlas por el filtrado de bonistas de Central.

Central mantiene sus lineamientos agrupados, subobjetivos y filtrado específico de responsables. Esas reglas no se copiarán automáticamente a las demás unidades en esta entrega.

## Archivos esperados

Principales:

- `src/MatrixWorkspaceV13.tsx`: enrutar todas las unidades por la capa V12.
- `src/MatrixWorkspaceV12.tsx`: generalizar Resumen e historial para Central y no Central.
- `src/UnitExcelWorkspace.tsx`: eliminar/neutralizar duplicación del historial antiguo y alinear toolbar/etiquetas/interacciones comunes.
- `src/matrix-workspace-v12.css`: estilos comunes para Vista Resumen/historial en todas las unidades.
- `src/unit-excel-workspace.css` y/o CSS existente: únicamente ajustes necesarios de paridad y layout.
- Tests existentes y nuevas regresiones específicas de paridad no Central.

## Pruebas de aceptación

1. En Central no cambia la experiencia ya validada.
2. En HU, DEP, VS y HOT aparece `Matriz | Resumen` al abrir una matriz.
3. Resumen no dispara consultas adicionales a Supabase y muestra `Acción | Responsable | Fecha | Entregable` con valores correctos.
4. El botón `Historial` en cualquier unidad carga solo 20 versiones inicialmente y no selecciona `snapshot`.
5. `Cargar más` obtiene la siguiente página.
6. Restaurar una versión usa `restore_matrix_version_by_context` y respeta permisos/bloqueos.
7. `Añadir acción` crea la fila de edición al final de las filas existentes en unidades no Central.
8. La edición colaborativa, locks, Realtime y cambio seguro de fila siguen funcionando.
9. Lineamientos de Central y Lineamientos de las demás unidades no sufren cambios visuales ni funcionales.
10. No se agrega ninguna migración nueva por este trabajo.
11. Toda la suite de pruebas, TypeScript y build de producción pasan antes de dar el trabajo por terminado.

## Estrategia de implementación

Aplicar TDD: primero añadir pruebas que fallen por la ausencia de paridad en unidades no Central; después generalizar V12 y ajustar UnitExcel con el cambio mínimo. Evitar duplicar la lógica del historial y Resumen en dos componentes. Mantener Central como regresión de referencia y verificar explícitamente que sus pruebas existentes continúan pasando.
