# Auditoría y reparación integral — diseño

## Objetivo

Dejar Control de Gestión estable en `main`, con Central visualmente contenido, subpuntos persistidos como filas reales, responsables accesibles, sincronización Realtime sin recarga manual, edición colaborativa protegida y verificaciones reproducibles antes de publicar.

## Restricciones de conservación

- Mantener los flujos de autenticación, periodos, unidades, lineamientos, matrices, importación/exportación, historial, pantalla completa, zoom y permisos existentes.
- No cambiar reglas de negocio sin evidencia en código, historial o esquema Supabase.
- No borrar generaciones antiguas mientras exista una referencia de producción o una regla CSS reutilizada por la implementación activa.
- Conservar los cambios locales previos del usuario y no usar `reset --hard`, force push ni escrituras destructivas de datos.

## Arquitectura propuesta

### Contexto de matriz y Realtime

La matriz activa se comunicará explícitamente desde `CentralExcelWorkspace` o `UnitExcelWorkspace` hacia `MatrixWorkspaceV11` y `MatrixRealtimeLayer`. Esto reemplaza la inferencia del ID mediante texto renderizado, sondeo cada 1.2/3 segundos y consultas repetidas a `managements_global`, `processes` y `matrices`.

`MatrixRealtimeLayer` mantendrá un único canal por ID de matriz, se suscribirá a los cambios relevantes, informará estados `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT` y `CLOSED`, y limpiará canal y temporizadores al navegar. Los eventos se reconciliarán con una recarga acotada de filas y relaciones, sin desmontar el editor ni perder el borrador local. Presence publicará solo cambios de ubicación deduplicados para evitar el rate limit observado.

### Central y subpuntos

Central conservará su cuadrícula tipo Excel, toolbar completa, resumen con Responsable principal, responsables múltiples, importación/exportación, historial, zoom y pantalla completa. Cada `matrix_row` seguirá representando la acción principal y cada registro de `matrix_row_subpoints` se mostrará como un `<tr>` independiente debajo de su acción, con S1/S2/S3 y columnas alineadas para Hitos, KPI, Inicio y Fin.

La edición de una acción cargará y guardará sus subpuntos reales. Las filas parciales válidas se conservarán. Las operaciones de fila, responsables y subpuntos se reconciliarán tras éxito o error para converger con Supabase. El esquema existente y sus políticas RLS son la fuente de verdad; no se inventarán tablas paralelas.

### Contención de layout

El ancho mínimo pertenecerá únicamente a la tabla. Todos sus ancestros activos (`dashboard-main`, `dashboard-content`, `planning-flow`, `planning-panel--wide`, host de matriz, capa Realtime, V11, plan shell y sheet card) podrán encogerse con `min-width: 0`/`minmax(0, 1fr)` y tendrán `max-width: 100%`. Solo `.matrix-v5-sheet-scroll` tendrá desplazamiento horizontal. Toolbar, resumen y Responsable principal permanecerán dentro del viewport.

### Conflictos

El bloqueo de fila existente seguirá siendo la primera defensa. Antes de abrir una fila se usará el estado confirmado más reciente; durante una edición, los refrescos remotos actualizarán la tabla pero no reemplazarán el borrador local. Al guardar, la interfaz recargará el registro confirmado y mostrará errores sin afirmar éxito parcial. La solución no añadirá CRDT ni polling como mecanismo principal.

### Pruebas y verificación

- Pruebas puras para filtrado y enrutamiento de eventos Realtime, deduplicación de Presence y reconciliación de relaciones.
- Pruebas de regresión estructural para filas reales de subpuntos, toolbar, Responsable principal y contención de overflow.
- Verificación del esquema/publicación/RLS y logs con el conector Supabase.
- Pruebas Node, TypeScript, build Vite y segunda pasada visual real en varios anchos.
- Revisión final del diff, fetch de `origin/main`, commits lógicos y push sin fuerza solo si todo lo crítico pasa.

## Estrategias descartadas

- Polling periódico de filas como solución principal: oculta fallos de suscripción y crea carga innecesaria.
- Remontar toda la matriz ante cada evento: rompe foco, scroll y borradores.
- Recuperar `MatrixWorkspaceV10` completo: reintroduciría una generación sustituida y perdería mejoras de la cuadrícula actual.
- CRDT/edición carácter a carácter: excede el alcance y no es necesario con filas bloqueadas y cambios confirmados.

## Criterios de aceptación

El trabajo se acepta solo si las verificaciones automatizadas, TypeScript y build pasan; Central mantiene controles completos; Responsable principal es visible; cada subpunto es una fila real; el scroll horizontal queda dentro de la tabla; las suscripciones usan el ID activo explícito; no hay canal/temporizador duplicado; los cambios confirmados de filas, subpuntos y responsables provocan actualización remota; y el diff final no contiene secretos, depuración ni archivos temporales.
