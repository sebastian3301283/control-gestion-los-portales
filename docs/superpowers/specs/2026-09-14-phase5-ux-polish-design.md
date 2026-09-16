# Fase 5 — UX polish design

## Objetivo

Mejorar la experiencia de uso de Control de Gestión sin rediseñar visualmente la plataforma ni alterar reglas de negocio, persistencia, permisos, Supabase o el modelo Central/no-Central.

## Alcance aprobado

1. **Navegación de Planificación coherente**
   - Representar el flujo real como `Unidad → Lineamientos → Matriz`.
   - Desde Matriz, `Volver` debe regresar a Lineamientos y conservar el contexto exacto de gerencia/lineamiento cuando esté disponible.
   - Desde Lineamientos, `Volver` debe regresar a la selección previa sin perder periodo ni unidad.
   - Los breadcrumbs deben reflejar el paso activo y permitir volver solo a pasos válidos.

2. **Feedback consistente de acciones**
   - Mantener los mensajes actuales de éxito/error, pero exponerlos como estados accesibles (`status`/`alert`) y con copy consistente.
   - Acciones largas deben conservar estados busy ya existentes y evitar dobles envíos.
   - No introducir un sistema global de toasts ni nuevas dependencias.

3. **Confirmaciones y modales consistentes**
   - Reemplazar la confirmación nativa de restauración de historial por un diálogo propio.
   - Los diálogos incluidos en esta fase deben cerrar con Escape cuando no estén ocupados y tener título accesible mediante `aria-labelledby`.
   - La acción destructiva debe explicar el efecto antes de ejecutarse.

4. **Estados de carga/vacíos claros**
   - Conservar los loaders existentes y evitar nuevas consultas.
   - Mensajes vacíos deben explicar qué falta o cuál es el siguiente paso cuando sea posible.
   - No rediseñar tablas, tarjetas, colores, tipografías, sidebar ni layout general.

## Fuera de alcance

- Rediseño visual fuerte.
- Nuevos módulos o reportes.
- Cambios en base de datos, RLS, Realtime o Storage.
- Cambios en permisos/roles.
- Cambios en identidad de matrices o lineamientos.
- Reestructuración global de CSS.

## Estrategia técnica

Aplicar cambios incrementales sobre `Dashboard.tsx`, `PlanningGuidelines.tsx` y `MatrixWorkspaceV12.tsx`, reutilizando los patrones visuales existentes. Las regresiones se escriben primero y comprueban navegación, confirmaciones, accesibilidad básica y feedback sin acoplarse a detalles de estilo.

## Criterios de aceptación

- `main` permanece intacto.
- No hay migraciones nuevas.
- El flujo visible es `Unidad → Lineamientos → Matriz`.
- Matriz vuelve a Lineamientos preservando el contexto cuando exista.
- Restaurar versión usa diálogo propio, no `window.confirm`.
- Mensajes de error y éxito tienen semántica accesible.
- Escape cierra los diálogos no ocupados incluidos en este alcance.
- Todas las regresiones, TypeScript y build quedan verdes.
