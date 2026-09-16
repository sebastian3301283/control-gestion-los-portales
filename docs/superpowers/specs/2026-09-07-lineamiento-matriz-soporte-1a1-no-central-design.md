# Lineamiento → Matriz → Soportes 1:1 para HU/DEP/VS/HOT

## Objetivo

Cambiar el flujo operativo de las unidades no Central para que cada lineamiento tenga exactamente una matriz exclusiva y un espacio exclusivo de documentos de soporte.

Regla funcional principal:

`1 lineamiento = 1 matriz = 1 espacio de soportes`

Si existen 5 lineamientos en HU, DEP, VS o HOT, deben existir 5 matrices independientes, con filas, historial, bloqueos, responsables y documentos separados.

## Alcance

Aplica únicamente a HU, DEP, VS y HOT.

Central conserva su comportamiento actual y no forma parte de esta reestructuración.

## Limpieza inicial aprobada

Los datos operativos actuales de HU/DEP/VS/HOT se consideran datos de prueba y pueden eliminarse completamente.

Se eliminarán:

- `planning_guidelines` de HU/DEP/VS/HOT.
- `matrices` de HU/DEP/VS/HOT.
- Filas y relaciones dependientes de esas matrices (`matrix_rows`, `matrix_row_responsibles`, `matrix_row_subpoints`, bloqueos e historial/versiones) mediante las relaciones existentes o borrado explícito cuando sea necesario.
- Objetos de Storage del bucket `planning-ppts` bajo prefijos HU/DEP/VS/HOT.

Se conservan:

- Central y sus datos.
- Periodos.
- Unidades.
- Gerencias/áreas.
- Procesos.
- Bonistas/managers.
- Usuarios y perfiles.
- Permisos y RLS.
- Realtime.
- Catálogos y configuración estructural.

## Modelo de datos

### Matriz exclusiva por lineamiento

`matrices.guideline_id` será la referencia funcional para las matrices de HU/DEP/VS/HOT.

Para cada `planning_guidelines.id` no Central existirá exactamente una fila en `matrices` con ese `guideline_id`.

La matriz conservará también:

- `period_id` del lineamiento.
- `unit_code` del lineamiento.
- `process_id` correspondiente a la Gerencia Responsable (`management_id`) del lineamiento.

La existencia de `process_id` permite conservar permisos y el modelo actual de procesos, pero la navegación y selección de matriz se resolverán por `guideline_id`, no por "primera matriz de la gerencia".

### Unicidad

Supabase debe impedir dos matrices no Central con el mismo `guideline_id` mediante una restricción o índice único parcial aplicable a HU/DEP/VS/HOT.

### Creación automática

Al insertar un lineamiento de HU/DEP/VS/HOT:

1. Se identifica el proceso activo que coincide con `unit_code` y `management_id`.
2. Debe existir exactamente un proceso activo para esa combinación; si no existe o hay más de uno, la operación falla.
3. Se crea automáticamente una matriz vacía asociada al nuevo `guideline_id`.
4. La operación debe ser transaccional: si la matriz no puede crearse, el lineamiento tampoco queda guardado.

Esta misma regla aplica a lineamientos creados por formulario o por importación masiva.

### Edición de lineamiento

Editar texto, código o responsable no crea una matriz nueva.

Si cambia `management_id`, `period_id` o `unit_code` dentro de HU/DEP/VS/HOT, la matriz existente se conserva y se actualiza para apuntar al proceso activo correcto y al contexto actualizado. No se pierden filas ni historial.

### Eliminación

Eliminar un lineamiento no Central debe eliminar su matriz asociada y todos sus datos dependientes.

Como `planning-ppts` vive en Storage, los documentos del lineamiento deben eliminarse mediante Storage API antes de borrar el lineamiento desde la UI. Si el borrado de archivos falla, la UI detiene la eliminación del lineamiento para evitar archivos huérfanos.

En base de datos debe existir protección para eliminar la matriz no Central asociada al lineamiento cuando este se elimina, sin cambiar el comportamiento de Central.

## Navegación de Lineamientos a Matriz

Cada fila de `GuidelineCatalogV2` en HU/DEP/VS/HOT tendrá una flecha visible al lado del texto del lineamiento.

La flecha transportará como contexto mínimo:

- `periodId`
- `unitCode`
- `managementId`
- `guidelineId`

La matriz se abrirá buscando `matrices.guideline_id = guidelineId` dentro del periodo/unidad actual. No se elegirá por gerencia ni por posición.

`Ver lineamientos` devolverá al usuario al mismo lineamiento y lo dejará seleccionado.

## Selección de lineamiento y soportes

En HU/DEP/VS/HOT, hacer clic en una fila de lineamiento selecciona ese lineamiento sin abrir la matriz.

La sección inferior mostrará el contexto del seleccionado, por ejemplo:

`Documentos de soporte · L4: TARJETA NUEVA`

Si no hay lineamiento seleccionado:

- Se muestra un mensaje indicando que debe seleccionar un lineamiento.
- `Guardar soporte` no está disponible.

## Storage por lineamiento

Los documentos de HU/DEP/VS/HOT se guardarán bajo el esquema:

`<unitCode>/<periodId>/<guidelineId>/<archivo>`

Ejemplo:

`HU/<periodId>/<guidelineId>/1720000000000-presentacion.pdf`

La lista de documentos mostrará únicamente archivos del `guidelineId` seleccionado.

Cambiar de lineamiento cambia inmediatamente la lista de documentos.

La eliminación de un lineamiento elimina todos los objetos bajo su prefijo antes de borrar el registro operativo.

Central mantiene sus rutas actuales de documentos por área y no se modifica.

## UI de lineamientos

Se conserva la tabla actual de HU/DEP/VS/HOT:

`N° | Lineamientos Estratégicos | Gerencia Responsable | Gerente Responsable | Acciones`

Se conserva el color de cada unidad.

Se mantiene `+ Nuevo lineamiento`, importación, editar y eliminar.

La flecha de acceso a matriz aparece al lado del texto del lineamiento y usa el color/acento de la unidad.

La selección de fila para documentos debe ser visualmente perceptible y no interferir con editar, eliminar ni con la flecha.

## Matriz no Central

La matriz visible continúa usando la experiencia ya acordada:

`Acción | Responsable | Prioridad | Hitos / Fechas | Entregable | Riesgos de no ejecutar | Restricciones | Soporte | Comité`

No se cambia el modelo de filas ni responsables por este trabajo.

Lo que cambia es únicamente cómo se resuelve la matriz activa: por `guideline_id`.

Realtime, bloqueos, historial, Vista Resumen, exportación y edición inline deben seguir funcionando sobre el `matrix.id` resultante.

## Importación

`GuidelineMultiImport` sigue insertando lineamientos en `planning_guidelines`.

No debe implementar una segunda creación manual de matriz. La creación automática en Supabase cubre cada fila importada dentro de la misma regla transaccional.

Si una fila no puede obtener exactamente un proceso activo para su gerencia/unidad, esa inserción debe fallar de forma visible y no debe dejar un lineamiento sin matriz.

## Seguridad y compatibilidad

- No modificar `main` durante la implementación.
- Todo el trabajo permanece en `auditoria-codex-parcial`.
- No cambiar el flujo de Central.
- No eliminar catálogos estructurales.
- Mantener RLS y Realtime existentes.
- Las nuevas funciones/trigger helpers de seguridad definida deben fijar `search_path` y no quedar ejecutables directamente por roles de navegador salvo necesidad explícita.

## Pruebas de aceptación

1. Después de la limpieza, HU/DEP/VS/HOT no tienen lineamientos, matrices operativas ni soportes de prueba.
2. Crear un lineamiento no Central crea exactamente una matriz con el mismo `guideline_id`.
3. Crear cinco lineamientos crea cinco matrices distintas.
4. Dos lineamientos de la misma gerencia reciben matrices distintas.
5. La flecha de cada fila abre la matriz cuyo `guideline_id` coincide exactamente con esa fila.
6. Editar un lineamiento conserva la misma matriz.
7. Cambiar la gerencia de un lineamiento conserva la matriz y actualiza su `process_id`.
8. Importar lineamientos crea una matriz por cada lineamiento importado.
9. Seleccionar un lineamiento cambia la sección inferior a sus documentos exclusivos.
10. Los soportes se guardan en `<unit>/<period>/<guidelineId>/...` y no aparecen en otros lineamientos.
11. Eliminar un lineamiento borra primero sus soportes y luego su matriz/datos dependientes.
12. `Ver lineamientos` regresa al mismo lineamiento seleccionado.
13. Central conserva su flujo actual.
14. Toda la suite de pruebas pasa.
15. `npm run check` pasa.
16. `npm run build` pasa.
