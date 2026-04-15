# Interfaz: dashboard, autenticación y coherencia visual

## Objetivo

Sustituir pantallas aisladas o de aspecto "por defecto" por un **sistema visual unificado**: mobile-first, alto contraste táctil donde aplica, fondos atmosféricos, paneles tipo glass, animaciones sutiles y tipografía de producto.

## Antes

- Layout y páginas usaban un estilo más básico (menos jerarquía visual, menos componentes compartidos de "dashboard").
- Fuentes podían ser las por defecto del template inicial (p. ej. Geist) sin sistema de headings/editorial unificado.
- Formularios y mensajes de error con estilo genérico.

## Ahora

### Tokens y utilidades globales

Archivo principal: [`app/globals.css`](../../app/globals.css)

- Clases reutilizables:
  - **`app-shell-bg`**: capas de gradiente radial y rejilla suave para fondo de aplicación.
  - **`surface-panel`**: tarjeta/panel con borde, sombra y `backdrop-filter` para sensación "premium".
  - **`dashboard-glow`**: acento luminoso opcional en héroes.
- Animaciones: `fade-up-enter`, `float-gentle`, `pulse-soft`; reducidas o desactivadas con `prefers-reduced-motion`.

### Layout raíz

Archivo: [`app/layout.tsx`](../../app/layout.tsx)

- `html` con `h-full antialiased`.
- `body` con clases que activan el fondo global y variables de fuente (`--font-plus-jakarta`, etc.).

### Página de inicio / dashboard

Archivo: [`app/page.tsx`](../../app/page.tsx)

- **Antes:** página de bienvenida simple o métricas mínimas.
- **Ahora:** dashboard con:
  - Héroe con saludo contextual, pills de rol y estado.
  - Tarjetas de métricas (conteos reales: fincas, lotes, labores, alertas) según consultas del servidor.
  - Accesos rápidos a `/campo`, `/fincas`, y a `/auth/register` solo si el usuario es admin.
  - Paneles de "estado operativo" y sesión, usando `surface-panel` y animaciones de entrada.

Dependencias de datos: en la implementación actual, [`app/page.tsx`](../../app/page.tsx) usa el cliente Supabase servidor (`createClient` de [`lib/supabase/server.ts`](../../lib/supabase/server.ts)) con consultas `select(..., { count: "exact", head: true })` en paralelo para fincas, lotes, labores y alertas; el perfil llega de [`getSessionProfile`](../../lib/auth/session-profile.ts). Existe además [`app/actions/queries.ts`](../../app/actions/queries.ts) para otras agregaciones reutilizables si el proyecto las usa en más rutas.

### Autenticación: login

Archivos:

- [`app/auth/login/page.tsx`](../../app/auth/login/page.tsx) — composición editorial: mensaje de producto, indicadores de confianza, layout en dos columnas en desktop; acepta `?redirectTo=` para volver a una ruta tras login.
- [`components/auth/login-form.tsx`](../../components/auth/login-form.tsx) — formulario cliente con `surface-panel`, inputs `rounded-2xl`, botón con sombra brand, toggle de visibilidad de contraseña, manejo de errores estilizado.

### Autenticación: registro (solo admin)

Ver [03-registro-usuarios-admin.md](./03-registro-usuarios-admin.md). A nivel visual: misma línea de **paneles**, tipografía y botones que el resto del sistema.

### Componentes UI base

Directorio: [`components/ui/`](../../components/ui/)

- shadcn: `button`, `card`, `input`, `label`, `textarea`, etc., alineados al tema en `globals.css`.

## Resumen antes → ahora

| Área | Antes | Ahora |
|------|--------|--------|
| Home | Lista simple o hero mínimo | Dashboard con métricas, CTA y accesos rápidos |
| Login | Formulario básico | Layout editorial + formulario premium |
| Tema | Menos tokens compartidos | `surface-panel`, `app-shell-bg`, animaciones |
| Tipografía | Fuente genérica del template | Plus Jakarta / IBM Plex Mono / Lora |

## Archivos citados (principal)

- [`app/globals.css`](../../app/globals.css)
- [`app/layout.tsx`](../../app/layout.tsx)
- [`app/page.tsx`](../../app/page.tsx)
- [`app/auth/login/page.tsx`](../../app/auth/login/page.tsx)
- [`components/auth/login-form.tsx`](../../components/auth/login-form.tsx)
- [`components/ui/button.tsx`](../../components/ui/button.tsx) (y hermanos en `components/ui/`)
