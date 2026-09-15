# Control de Gestión — Los Portales

Plataforma web para la planificación, seguimiento y control de gestión de Los Portales. La aplicación integra autenticación, acceso por roles y unidades de negocio, lineamientos estratégicos, matrices de planificación, documentos de soporte, configuración y capacidades de colaboración sobre Supabase.

## Estado actual

La aplicación ya no es únicamente un prototipo de acceso. En la rama de auditoría se encuentran integrados y validados los principales flujos operativos de Control de Gestión:

- autenticación corporativa mediante código OTP para correos autorizados;
- inicio de sesión con correo y contraseña para cuentas habilitadas;
- validación de permisos y unidades mediante el contexto de acceso de Supabase;
- acceso diferenciado para Gestión Estratégica, Gerencia General, gerentes y equipos de unidad;
- planificación por periodo y por unidad: CENTRAL, HU, DEP, VS y HOT;
- gestión de lineamientos estratégicos y responsables;
- navegación consistente `Lineamientos → Matriz → Soportes`;
- matrices de planificación de Central y unidades no-Central;
- relación exacta entre lineamiento y matriz mediante `guideline_id` donde corresponde;
- historial de versiones y restauración controlada de matrices;
- colaboración mediante Realtime y bloqueo temporal de filas;
- documentos de soporte asociados al contexto del lineamiento;
- importación y exportación de información de planificación;
- configuración de periodos, responsables, áreas y permisos.

## Arquitectura

- **Frontend:** React 18 + TypeScript.
- **Build y desarrollo:** Vite 6.
- **Backend administrado:** Supabase.
- **Base de datos:** PostgreSQL con Row Level Security (RLS).
- **Autenticación:** Supabase Auth.
- **Datos en tiempo real:** Supabase Realtime.
- **Archivos:** Supabase Storage.
- **Pruebas:** Node.js Test Runner.
- **CI:** GitHub Actions.

## Requisitos locales

Se recomienda usar **Node.js 22**, que es la versión empleada por el workflow de CI.

Instala las dependencias exactamente desde el lockfile:

```bash
npm ci
```

## Configuración de Supabase

Copia `.env.example` como `.env.local` o `.env` y configura, preferentemente, la URL y la publishable key del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

El cliente conserva compatibilidad con la variable legacy:

```env
VITE_SUPABASE_ANON_KEY=tu_anon_key_legacy
```

`VITE_SUPABASE_PUBLISHABLE_KEY` tiene prioridad sobre `VITE_SUPABASE_ANON_KEY`.

### Seguridad de claves

Las publishable keys y las legacy anon keys están diseñadas para clientes públicos y dependen de RLS y de las reglas de autorización de la aplicación para limitar el acceso.

**Nunca** incorpores en el frontend una secret key, `service_role` key ni otra credencial con privilegios administrativos.

Los archivos `.env` y `.env.local` están excluidos del repositorio mediante `.gitignore`.

## Comandos de desarrollo

Iniciar el entorno local:

```bash
npm run dev
```

Ejecutar toda la suite de regresiones:

```bash
npm test
```

Validar TypeScript sin emitir archivos:

```bash
npm run check
```

Generar el build de producción:

```bash
npm run build
```

Previsualizar el build generado:

```bash
npm run preview
```

## Calidad y regresiones

La suite protege, entre otros contratos:

- autenticación y autorización;
- integridad Lineamiento → Matriz → Soportes;
- aislamiento por periodo y unidad;
- matrices Central y no-Central;
- responsables y subpuntos;
- historial y restauración;
- Realtime y bloqueo colaborativo;
- rendimiento de cargas críticas;
- navegación y estados UX;
- limpieza del runtime y referencias muertas.

Los controles de limpieza también verifican que los imports relativos resuelvan correctamente y que el código activo no reintroduzca `debugger`, `console.log` ni marcadores TODO/FIXME pendientes.

## CI

`.github/workflows/validate.yml` se ejecuta para pull requests hacia `main` y valida:

1. instalación reproducible con `npm ci`;
2. regresiones con `tests/*.test.mjs`;
3. TypeScript con `npm run check`;
4. build de producción con `npm run build`.

Un cambio no debe considerarse cerrado mientras estas verificaciones no estén verdes en el HEAD exacto que se quiere revisar.

## Supabase y migraciones

Las migraciones versionadas viven en:

```text
supabase/migrations/
```

No deben reaplicarse manualmente solo porque ya existan en el repositorio. Antes de crear o ejecutar una migración nueva se debe comprobar el estado real del proyecto Supabase y demostrar la necesidad del cambio.

Los warnings de los advisors de Supabase se revisan como señales de auditoría; no se corrigen automáticamente sin evidenciar un defecto, un riesgo concreto o una necesidad de rendimiento demostrada.

## Documentación técnica

Las decisiones de diseño y planes de implementación se conservan en:

```text
docs/superpowers/specs/
docs/superpowers/plans/
```

El cierre técnico conservador de Fase 6 está documentado en:

```text
docs/superpowers/specs/2026-09-14-phase6-technical-closure-design.md
docs/superpowers/plans/2026-09-14-phase6-technical-closure.md
```
