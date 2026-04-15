# Autenticación y seguridad

## Objetivo

Garantizar que la sesión Supabase se **refresca** correctamente en cada request, que las decisiones de seguridad en servidor no dependan de APIs obsoletas, y que las operaciones privilegiadas usen **solo servidor** la clave `service_role`.

## Antes

- En el ecosistema Next.js evolucionó la convención de capa de request: la conversación de desarrollo migró de un archivo **`middleware.ts`** a **`proxy.ts`** (convención Next.js 16), manteniendo la lógica de actualización de sesión en un módulo reutilizable.

## Ahora

### 1. Punto de entrada: `proxy.ts`

Archivo: [`proxy.ts`](../../proxy.ts)

- Exporta una función `proxy(request)` que delega en `updateSession` de [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts).
- Define `config.matcher` para excluir estáticos e imágenes, alineado con la guía de Supabase SSR.

### 2. Actualización de sesión y JWT

Archivo: [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts)

- Crea `createServerClient` de `@supabase/ssr` con lectura/escritura de cookies en el objeto `NextResponse`.
- Tras crear el cliente, llama a **`supabase.auth.getClaims()`** para refrescar/validar el JWT — **no** usar `getSession()` en el servidor para decisiones de seguridad (recomendación oficial Supabase para Next.js).
- Si no hay usuario autenticado y la ruta **no** es pública (`/login`, `/auth/*`), redirige a **`/auth/login`**.

Comportamiento observable:

- Rutas bajo `/auth/login`, `/auth/register`, etc. pueden cargarse sin sesión.
- El resto de la app asume sesión o redirección.

### 3. Cliente servidor para Server Components / Actions

- [`lib/supabase/server.ts`](../../lib/supabase/server.ts) — cliente con cookies para RLS en el servidor.
- [`lib/supabase/client.ts`](../../lib/supabase/client.ts) — cliente navegador.

### 4. Perfil de sesión y roles (aplicación)

Archivo: [`lib/auth/session-profile.ts`](../../lib/auth/session-profile.ts)

- `getSessionProfile()`: obtiene usuario vía `supabase.auth.getUser()` y la fila `profiles` asociada.
- Helpers: `isAdmin`, `canManageLotes`, `canRecordCampoOperations` — alineados con las reglas de negocio documentadas en [`AGENTS.md`](../../AGENTS.md) (admin global; no-admin con una finca; campo operativo solo con finca y rol adecuado).

### 5. Cliente administrativo (service role)

Archivo: [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts)

- `createAdminClient()` usa `SUPABASE_SERVICE_ROLE_KEY` **solo en el servidor**.
- Configuración: sin persistencia de sesión de usuario final en el cliente admin (`persistSession: false`, etc.).
- Uso principal documentado en esta iteración: creación de usuarios y actualización de `profiles` desde una Server Action restringida a administradores.

### 6. Variables de entorno

Archivo: [`.env.example`](../../.env.example)

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Cloud |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave anon/public (cliente + SSR con RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; nunca prefijo `NEXT_PUBLIC_` |
| `DATABASE_URL` | Opcional; Drizzle / herramientas SQL directas |

## MCP (Cursor) y Supabase

En [`.cursor/mcp.json`](../../.cursor/mcp.json) puede configurarse el servidor MCP remoto de Supabase. El asistente requiere que el usuario complete la **autenticación** en Cursor si el servidor la pide; hasta entonces las herramientas MCP pueden no estar disponibles. Detalle en [`supabase/migrations/README.md`](../../supabase/migrations/README.md) (sección MCP).

## Resumen antes → ahora

| Tema | Antes | Ahora |
|------|--------|--------|
| Capa edge/request | `middleware.ts` como nombre convencional histórico | `proxy.ts` + misma lógica en `lib/supabase/middleware.ts` |
| Validación JWT en middleware | Riesgo de patrones antiguos | `getClaims()` tras `createServerClient` |
| Operaciones admin | No documentadas en código central | `createAdminClient()` + variable `SUPABASE_SERVICE_ROLE_KEY` documentada |

## Archivos citados

- [`proxy.ts`](../../proxy.ts)
- [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts)
- [`lib/supabase/server.ts`](../../lib/supabase/server.ts)
- [`lib/supabase/client.ts`](../../lib/supabase/client.ts)
- [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts)
- [`lib/auth/session-profile.ts`](../../lib/auth/session-profile.ts)
- [`.env.example`](../../.env.example)
