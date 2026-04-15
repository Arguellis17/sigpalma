# Base de datos y migraciones

## Objetivo

Definir el **esquema canónico** en SQL versionado, aplicarlo al **proyecto Supabase Cloud** (entorno por defecto de la aplicación), y mantener un **espejo tipado** con Drizzle para herramientas y consultas documentadas.

## Antes

- Existía la necesidad de **localizar** dónde viven las migraciones y cómo alinearlas con Drizzle.
- Se validó el SQL también con **Supabase local** (`supabase start`) para comprobar que el script ejecuta sin errores **antes** de tocar producción; esto **no** reemplaza aplicar la migración en la nube.

## Ahora

- **Fuente de verdad:** archivos en [`supabase/migrations/`](../../supabase/migrations/), en particular [`supabase/migrations/20260415180000_init_sigpalma_core.sql`](../../supabase/migrations/20260415180000_init_sigpalma_core.sql).
- **Entorno objetivo:** **Supabase Cloud** — la aplicación usa `NEXT_PUBLIC_SUPABASE_URL` y claves del dashboard del proyecto remoto (ver [`.env.example`](../../.env.example)).
- **Documentación operativa:** [`supabase/migrations/README.md`](../../supabase/migrations/README.md) explica:
  - `supabase link --project-ref <REF> --password '...'` y `supabase db push`
  - alternativa del **SQL Editor** (una sola ejecución si la base está limpia)
  - relación con Drizzle y MCP de Cursor

### Contenido típico de la migración inicial (resumen)

- Enums de dominio (p. ej. roles).
- Tablas en `public` (fincas, lotes, labores, cosechas, alertas, perfiles, etc., según el archivo).
- **RLS** (Row Level Security) basada en `auth.uid()` y tabla `profiles`.
- Triggers (p. ej. creación de fila en `profiles` al registrarse un usuario en `auth.users`).
- Storage: bucket `evidencia-tecnica` y políticas asociadas.

## Drizzle

| Aspecto | Detalle |
|--------|---------|
| Espejo de esquema | [`db/schema.ts`](../../db/schema.ts) |
| Configuración | [`drizzle.config.ts`](../../drizzle.config.ts) |
| Uso | Studio (`npm run db:studio`), `drizzle-kit check`; la app en runtime usa **Supabase JS** + RLS, no Drizzle obligatorio para el CRUD web |

**Antes / ahora:** el SQL en `supabase/migrations/` sigue siendo la autoridad; Drizzle se **actualiza** para reflejar el esquema aplicado en la base (o introspección puntual tras migrar).

## Variables relacionadas

- **`DATABASE_URL`** (opcional): solo para Drizzle / herramientas que hablen Postgres directamente. Comentarios en [`.env.example`](../../.env.example) distinguen pooler (6543) vs conexión directa (5432).

## Archivos citados

- [`supabase/migrations/20260415180000_init_sigpalma_core.sql`](../../supabase/migrations/20260415180000_init_sigpalma_core.sql)
- [`supabase/migrations/README.md`](../../supabase/migrations/README.md)
- [`supabase/config.toml`](../../supabase/config.toml)
- [`db/schema.ts`](../../db/schema.ts)
- [`drizzle.config.ts`](../../drizzle.config.ts)
- [`lib/database.types.ts`](../../lib/database.types.ts) — tipos generados / alineados al esquema expuesto a la app

## Notas de gobernanza

- Orden de migraciones: por prefijo `YYYYMMDDHHMMSS_*.sql`.
- **No** documentar contraseñas en el repositorio ni en chats; rotar credenciales si se expusieron.
