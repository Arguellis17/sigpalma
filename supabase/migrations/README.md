# Migraciones Supabase (fuente de verdad)

## Ubicación

Los archivos SQL versionados están en **esta carpeta**:

- `20260415180000_init_sigpalma_core.sql` — esquema inicial: enums, tablas `public`, RLS, trigger `handle_new_user` en `auth.users`, bucket `evidencia-tecnica`.

## Por qué a veces se valida en local y no directamente en la nube

`supabase start` (Docker) permite aplicar el mismo SQL **sin** contraseña de producción ni `supabase link`. Sirve para comprobar que el archivo corre bien antes de tocar el proyecto Cloud. **No sustituye** aplicar la migración en el proyecto remoto: la app en producción y el equipo deben usar la base **Cloud** con estas migraciones aplicadas allí.

## Cómo aplicarlas al proyecto Supabase Cloud (recomendado)

1. Confirma que el **project ref** coincide con tu app (`NEXT_PUBLIC_SUPABASE_URL` → `https://<ref>.supabase.co`).
2. Inicia sesión en la CLI si hace falta: `npx supabase login`.
3. En la raíz del repo (donde está `supabase/config.toml`):

   ```bash
   npx supabase link --project-ref <TU_REF> --password '<contraseña de la base en Dashboard → Database>'
   npx supabase db push
   ```

   La contraseña es la del usuario `postgres` del proyecto (o la que muestre el panel al revelar la connection string). Con `--yes` puedes evitar confirmaciones interactivas en entornos scripteados.

4. **Alternativa sin CLI:** abre el **SQL Editor** en el dashboard del proyecto Cloud, pega el contenido de `20260415180000_init_sigpalma_core.sql` y ejecútalo **una sola vez** (solo si esa base aún no tiene el esquema; si ya existe parte del esquema, usa la CLI o revisa conflictos).

## Drizzle

- El esquema tipado para ORM/Studio vive en [`../../db/schema.ts`](../../db/schema.ts).  
- No sustituye este SQL: triggers, RLS y `auth` siguen definidos aquí.

## MCP (Cursor) y Supabase

En [`.cursor/mcp.json`](../../.cursor/mcp.json) está configurado el servidor MCP remoto de Supabase. Para que el asistente pueda usarlo:

1. **Cursor → Settings → MCP:** el servidor `supabase` debe estar activo.
2. Si pide autenticación, completa el flujo (navegador / token); hasta entonces las herramientas MCP no estarán disponibles para el agente.
3. El agente en esta sesión solo ve herramientas MCP registradas con el nombre interno del plugin; si falla, suele ser **falta de login** o servidor deshabilitado.

## Orden

Ejecutar las migraciones en orden cronológico por nombre de archivo (`YYYYMMDDHHMMSS_*.sql`).
