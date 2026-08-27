# Control de Gestión — Los Portales

Primera versión del módulo de acceso de la plataforma empresarial **Control de Gestión**.

## Incluido

- React + TypeScript + Vite.
- Login corporativo responsive.
- Acceso por correo corporativo mediante OTP preparado para Supabase Auth.
- Registro de cuenta personal preparado para Supabase Auth.
- Inicio de sesión con correo y contraseña preparado para Supabase Auth.
- Microsoft visible como **Próximamente**.
- Diseño corporativo adaptable a escritorio, tablet y móvil.

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Conectar Supabase

Copia `.env.example` como `.env` y completa:

```env
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

No subas el archivo `.env` al repositorio.

## Estado

La interfaz y la integración cliente están preparadas. El siguiente paso es crear/configurar el proyecto de Supabase y definir las reglas reales de autenticación y usuarios.
