# Índice de archivos clave (referencia rápida)

Tabla orientativa de rutas del repositorio mencionadas en la documentación del snapshot **15-04-2026**. Las rutas son relativas a la raíz del proyecto `sigpalma`.

## Configuración y entorno

| Archivo | Rol |
|---------|-----|
| [`.env.example`](../../.env.example) | Plantilla de variables (Supabase Cloud, service role, DATABASE_URL opcional) |
| [`package.json`](../../package.json) | Scripts `dev` (Webpack), `build`, dependencias |
| [`next.config.ts`](../../next.config.ts) | `turbopack.root` anclado al `package.json` del proyecto |
| [`.cursor/mcp.json`](../../.cursor/mcp.json) | Configuración MCP Supabase para Cursor (opcional) |

## Request / auth

| Archivo | Rol |
|---------|-----|
| [`proxy.ts`](../../proxy.ts) | Entrada Next 16: delega sesión Supabase |
| [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts) | `updateSession`, `getClaims`, redirección a login |
| [`lib/supabase/server.ts`](../../lib/supabase/server.ts) | Cliente servidor con cookies |
| [`lib/supabase/client.ts`](../../lib/supabase/client.ts) | Cliente navegador |
| [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts) | Cliente service role (solo servidor) |
| [`lib/auth/session-profile.ts`](../../lib/auth/session-profile.ts) | Usuario + `profiles`, helpers de rol |

## Base de datos

| Archivo | Rol |
|---------|-----|
| [`supabase/migrations/20260415180000_init_sigpalma_core.sql`](../../supabase/migrations/20260415180000_init_sigpalma_core.sql) | Migración inicial canónica |
| [`supabase/migrations/README.md`](../../supabase/migrations/README.md) | Cómo aplicar a Cloud, Drizzle, MCP |
| [`supabase/config.toml`](../../supabase/config.toml) | Config CLI Supabase |
| [`db/schema.ts`](../../db/schema.ts) | Espejo Drizzle |
| [`drizzle.config.ts`](../../drizzle.config.ts) | Config Drizzle Kit |
| [`lib/database.types.ts`](../../lib/database.types.ts) | Tipos TypeScript del esquema |

## App Router — páginas

| Ruta URL | Archivo |
|----------|---------|
| `/` | [`app/page.tsx`](../../app/page.tsx) |
| `/auth/login` | [`app/auth/login/page.tsx`](../../app/auth/login/page.tsx) |
| `/auth/register` | [`app/auth/register/page.tsx`](../../app/auth/register/page.tsx) |
| `/campo` | [`app/campo/page.tsx`](../../app/campo/page.tsx) |
| `/campo/labor` | [`app/campo/labor/page.tsx`](../../app/campo/labor/page.tsx) |
| `/campo/cosecha` | [`app/campo/cosecha/page.tsx`](../../app/campo/cosecha/page.tsx) |
| `/campo/alerta` | [`app/campo/alerta/page.tsx`](../../app/campo/alerta/page.tsx) |
| `/fincas` | [`app/fincas/page.tsx`](../../app/fincas/page.tsx) |
| `/fincas/nueva` | [`app/fincas/nueva/page.tsx`](../../app/fincas/nueva/page.tsx) |
| `/fincas/[fincaId]` | [`app/fincas/[fincaId]/page.tsx`](../../app/fincas/[fincaId]/page.tsx) |
| `/fincas/[fincaId]/editar` | [`app/fincas/[fincaId]/editar/page.tsx`](../../app/fincas/[fincaId]/editar/page.tsx) |
| `/fincas/[fincaId]/lotes/nuevo` | [`app/fincas/[fincaId]/lotes/nuevo/page.tsx`](../../app/fincas/[fincaId]/lotes/nuevo/page.tsx) |
| `/fincas/[fincaId]/lotes/[loteId]` | [`app/fincas/[fincaId]/lotes/[loteId]/page.tsx`](../../app/fincas/[fincaId]/lotes/[loteId]/page.tsx) |
| `/fincas/[fincaId]/lotes/[loteId]/editar` | [`app/fincas/[fincaId]/lotes/[loteId]/editar/page.tsx`](../../app/fincas/[fincaId]/lotes/[loteId]/editar/page.tsx) |

## Layout y estilos globales

| Archivo | Rol |
|---------|-----|
| [`app/layout.tsx`](../../app/layout.tsx) | Fuentes, shell del documento |
| [`app/globals.css`](../../app/globals.css) | Tailwind/shadcn imports, tema, utilidades visuales |

## Server Actions

| Archivo | Rol |
|---------|-----|
| [`app/actions/index.ts`](../../app/actions/index.ts) | Reexporta actions |
| [`app/actions/types.ts`](../../app/actions/types.ts) | Tipos de resultado (`actionOk` / `actionError`) |
| [`app/actions/usuarios.ts`](../../app/actions/usuarios.ts) | `crearUsuarioConRol` |
| [`app/actions/fincas.ts`](../../app/actions/fincas.ts) | Fincas |
| [`app/actions/lotes.ts`](../../app/actions/lotes.ts) | Lotes |
| [`app/actions/labores.ts`](../../app/actions/labores.ts) | Labores |
| [`app/actions/cosecha.ts`](../../app/actions/cosecha.ts) | Cosecha |
| [`app/actions/alertas.ts`](../../app/actions/alertas.ts) | Alertas |
| [`app/actions/queries.ts`](../../app/actions/queries.ts) | Consultas agregadas / listados |

## Validaciones Zod

| Archivo | Rol |
|---------|-----|
| [`lib/validations/usuario.ts`](../../lib/validations/usuario.ts) | Alta admin |
| [`lib/validations/finca-lote.ts`](../../lib/validations/finca-lote.ts) | Fincas/lotes |
| [`lib/validations/operativo.ts`](../../lib/validations/operativo.ts) | Campo operativo |

## Componentes destacados

| Archivo | Rol |
|---------|-----|
| [`components/auth/login-form.tsx`](../../components/auth/login-form.tsx) | Login |
| [`components/auth/register-form.tsx`](../../components/auth/register-form.tsx) | Registro admin |
| [`components/auth/sign-out-button.tsx`](../../components/auth/sign-out-button.tsx) | Cierre de sesión |
| [`components/campo/campo-locked.tsx`](../../components/campo/campo-locked.tsx) | Bloqueo de campo |
| [`components/campo/*-form.tsx`](../../components/campo/) | Formularios labor/cosecha/alerta |
| [`components/fincas/*-form.tsx`](../../components/fincas/) | Formularios finca/lote |

## Directrices permanentes del repo

| Archivo | Rol |
|---------|-----|
| [`AGENTS.md`](../../AGENTS.md) | Visión del producto, stack, convenciones |
| [`CLAUDE.md`](../../CLAUDE.md) | Puntero a agentes / CodeCortex |

</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace