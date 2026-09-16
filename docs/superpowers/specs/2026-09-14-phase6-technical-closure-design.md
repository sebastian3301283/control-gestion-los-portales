# Fase 6 — Cierre técnico conservador

## Objetivo

Cerrar técnicamente la rama `auditoria-codex-parcial` después de las Fases 1–5, dejando repositorio, configuración, documentación, CI y estado de Supabase auditados y coherentes, sin introducir rediseños, refactors amplios ni cambios de base de datos motivados únicamente por warnings.

## Baseline confirmado

- Rama de trabajo: `auditoria-codex-parcial`.
- HEAD previo a Fase 6: `85afba8c032ada459fc177cd9e0af150336e70e5` (`fix: preserve history restore contract`).
- PR: `#13`, abierto y en borrador, con base `main`.
- La rama estaba `402` commits por delante y `0` por detrás de `main` al iniciar el cierre.
- Último workflow `Validate application` sobre ese HEAD: `success`.
- El job de CI ejecutó correctamente instalación, regresiones, TypeScript y build.
- `main` no forma parte del área de trabajo de esta fase.

## Principio de diseño

Esta fase es un cierre, no una nueva iteración funcional. Cada posible cambio se clasifica primero como:

1. **Defecto reproducible:** exige prueba RED antes de un arreglo mínimo.
2. **Desfase documental/configurativo:** puede corregirse sin tocar comportamiento de runtime.
3. **Warning o deuda no demostrada:** se documenta y se conserva si no existe evidencia de fallo, riesgo inmediato o regresión.

No se realizan cambios “por si acaso”. La ausencia de una prueba de defecto es una razón válida para no modificar código o esquema.

## Auditoría del repositorio

### Alcanzabilidad y residuos

La cobertura existente de Fase 2 ya protege el cierre técnico:

- `tests/phase2-runtime-reachability.test.mjs` construye el grafo de imports desde `src/main.tsx` y exige que todos los módulos runtime sean alcanzables.
- `tests/audit-cleanliness.test.mjs` valida imports relativos, ausencia de `debugger`, `console.log` y marcadores de trabajo incompleto en código activo, además de impedir reintroducir generaciones retiradas.
- `CatalogConfigurationLegacy.tsx` no se considera código muerto: sigue importado por `CatalogConfiguration.tsx` y forma parte del runtime activo.
- Los adaptadores DOM conservados en fases anteriores no se eliminan durante el cierre porque todavía implementan comportamiento vigente y ya fueron clasificados como compatibilidad activa.

No se realizará una segunda limpieza destructiva de generaciones ya auditadas.

### Archivos sensibles y temporales

- `.gitignore` cubre `node_modules`, `dist`, `.env`, `.env.local`, logs, `.DS_Store` y artefactos `*.tsbuildinfo`.
- El árbol raíz auditado no contiene `.env`, `dist`, logs ni otros artefactos temporales equivalentes versionados.
- El cliente usa una **publishable key** de Supabase en frontend; no se encontró una `service_role`/secret key en el punto de inicialización del cliente.
- Supabase no tiene Edge Functions desplegadas en este proyecto al momento de la auditoría.
- La publishable key es pública por diseño y no debe confundirse con una secret key. Una secret key o `service_role` nunca debe incorporarse al frontend.

### Dependencias y toolchain

- React 18, TypeScript 5.7, Vite 6 y `@supabase/supabase-js` 2.x permanecen sin upgrades en Fase 6.
- `package-lock.json` está versionado y es usado por `npm ci` en CI.
- CI usa Node.js 22, consistente con el soporte actual del stack.
- `tsconfig.app.json` mantiene `strict: true`, `moduleResolution: Bundler` y `noEmit: true`.
- `vite.config.ts` contiene únicamente el plugin oficial de React; no existe configuración especial que requiera limpieza.
- No se agregan dependencias nuevas ni se realiza una actualización masiva de versiones durante este cierre.

## CI

El workflow `.github/workflows/validate.yml` mantiene un único gate para PRs hacia `main`:

1. `npm ci`.
2. Regresiones Node (`tests/*.test.mjs`).
3. `npm run check`.
4. `npm run build`.

La configuración es suficiente para el cierre conservador y no se modifica sin un defecto probado. La verificación final debe corresponder al HEAD exacto resultante de Fase 6.

## Documentación y configuración local

### README

El `README.md` previo a Fase 6 está objetivamente desfasado: describe una primera versión centrada en login y afirma que Supabase aún debe crearse/configurarse. El estado real ya incluye autenticación integrada, planificación, lineamientos, matrices, permisos, historial, Realtime y Storage.

Se reemplaza por documentación que refleje:

- arquitectura real React + TypeScript + Vite + Supabase;
- autenticación OTP corporativa y acceso por roles/unidades;
- módulos operativos actuales;
- flujo `Lineamientos → Matriz → Soportes`;
- configuración local y variables de entorno;
- comandos `dev`, `test`, `check` y `build`;
- reglas de seguridad para claves frontend;
- alcance del CI y de las migraciones.

### `.env.example`

El cliente ya prioriza `VITE_SUPABASE_PUBLISHABLE_KEY` y conserva `VITE_SUPABASE_ANON_KEY` como fallback legado. El ejemplo anterior solo exponía la variable legacy. Se alinea el ejemplo con el código sin cambiar runtime:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- comentario opcional para `VITE_SUPABASE_ANON_KEY` como fallback legado.

## Supabase — política de cierre

La revisión de Supabase se realiza en modo lectura. No se crean ni aplican migraciones durante Fase 6 salvo aparición de un defecto real y reproducible.

### Comprobaciones realizadas

- Proyecto `GESTION` activo y saludable.
- Todas las tablas ordinarias del esquema `public` auditadas tienen RLS habilitado.
- `authorized_users` no concede acceso directo de tabla a `anon` ni a `authenticated`.
- `is_email_authorized(email_input text)` se limita a devolver un booleano de autorización pre-auth y conserva su exposición a `anon` de forma intencional.
- Las funciones `SECURITY DEFINER` inspeccionadas fijan `search_path`; las funciones internas/triggers no están expuestas directamente a `anon`/`authenticated`.
- Los wrappers de guardado de lineamientos delegan en contratos que aplican autorización o incluyen su propia validación de Gestión Estratégica.
- La secuencia remota de migraciones llega hasta `20260914220435_phase3_security_realtime_history`, también presente en la rama.
- No hay Edge Functions desplegadas.

### Warnings aceptados sin cambio automático

Se conservan, sin crear migraciones por el mero hecho de aparecer en advisors:

- `citext` instalado en `public`.
- `is_email_authorized` como `SECURITY DEFINER` ejecutable por `anon` para pre-auth.
- 27 funciones `SECURITY DEFINER` ejecutables por `authenticated`.
- Leaked password protection desactivado.
- 11 foreign keys sin índice de cobertura.
- 9 índices reportados como no usados.

Estos hallazgos quedan como señales para revisión específica futura. Un advisor no sustituye una prueba de defecto ni justifica por sí solo modificar producción.

## Cambios permitidos en Fase 6

- Actualizar `README.md`.
- Alinear `.env.example` con la variable publishable que ya consume el cliente.
- Crear esta especificación.
- Crear el plan de implementación de Fase 6.
- Actualizar la descripción del PR #13 con el cierre real.
- Aplicar un fix mínimo únicamente si aparece un bug reproducible después de una prueba RED.

## Fuera de alcance

- Modificar, fusionar o hacer push directo a `main`.
- Reaplicar migraciones existentes.
- Crear migraciones para silenciar advisors.
- Rediseñar UI o cambiar reglas de negocio.
- Refactorizar componentes activos por preferencia estética.
- Cambiar roles, RLS, Realtime, Storage o identidad Lineamiento → Matriz sin defecto probado.
- Hacer upgrades masivos de dependencias.

## Criterios de aceptación

- `README.md` representa el estado real de la aplicación.
- `.env.example` representa la configuración que realmente usa `src/lib/supabase.ts`.
- La especificación y el plan de Fase 6 quedan versionados.
- No quedan defectos reproducibles conocidos sin tratar dentro del alcance.
- No se crean migraciones Supabase por warnings no probados.
- Suite completa, TypeScript y build quedan verdes en el HEAD final.
- El CI del PR queda verde en el HEAD final.
- La descripción de PR #13 queda actualizada al resultado de Fase 6.
- PR #13 permanece en borrador.
- `main` permanece intacto.
