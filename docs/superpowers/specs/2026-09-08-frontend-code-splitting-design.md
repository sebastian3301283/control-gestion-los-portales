# Frontend Code Splitting Design

## Objetivo
Reducir de forma significativa el JavaScript de la primera carga sin cambiar comportamiento funcional, permisos, Supabase, Storage, Realtime ni navegación.

## Estado base medido
- Bundle JS principal: 611.26 kB minificado / 167.81 kB gzip.
- Vite advierte que el chunk principal supera 500 kB.
- `App.tsx` importa estáticamente `DashboardRestricted`, que a su vez importa `Dashboard`.
- `Dashboard.tsx` importa estáticamente `CatalogConfiguration`, `PlanningGuidelines` y `MatrixWorkspace`.

## Diseño aprobado
1. Separar autenticación del dashboard mediante `React.lazy()` + `import()` dinámico en `App.tsx`.
2. Separar Configuración, Lineamientos y Matrices mediante `React.lazy()` + `import()` dinámico en `Dashboard.tsx`.
3. Mantener Inicio y Reportes ligeros en el chunk del dashboard.
4. Precargar el chunk del dashboard cuando ya existe una sesión válida y mientras se resuelve `current_access`, de modo que la transición post-login no espere innecesariamente.
5. Precargar los chunks de Configuración, Lineamientos y Matrices justo antes de su navegación esperada, sin bloquear la UI.
6. Mantener el prefetch de datos existente; el prefetch de código es complementario y no altera Supabase.
7. Usar un fallback visual liviano con `Suspense` para cualquier caso en que el chunk todavía no haya llegado.
8. No usar `manualChunks` agresivo en esta iteración; primero se medirá el code splitting natural de Vite.

## Criterios de éxito
- El bundle inicial queda claramente por debajo de los 611.26 kB actuales.
- Login no incluye estáticamente Dashboard.
- Dashboard no incluye estáticamente Configuración, Lineamientos ni Matrices.
- Los módulos lazy conservan navegación, permisos y comportamiento actual.
- Todas las regresiones, TypeScript y build quedan en verde.
- No hay cambios en `supabase/**` ni en `main`.
