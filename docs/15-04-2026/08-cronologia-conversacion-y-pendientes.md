# Cronología de la conversación de desarrollo y trabajo sugerido

Este documento resume, en orden lógico, **qué se hizo** según el hilo de trabajo que motivó el snapshot **15-04-2026**, contrastando **antes** y **ahora** y enlazando a los documentos por feature.

## 1. Migraciones y entorno de base de datos

- **Problema / pregunta:** validar que la migración SQL es correcta y decidir si el entorno de referencia es local o **Supabase Cloud**.
- **Antes:** se podía probar con `supabase start` (Docker) para ejecutar el SQL sin tocar credenciales de producción.
- **Ahora:** el entorno **por defecto de la aplicación** es **Cloud**; el SQL canónico sigue en [`supabase/migrations/`](../../supabase/migrations/). La documentación en [`supabase/migrations/README.md`](../../supabase/migrations/README.md) deja explícito que la validación local **no sustituye** `db push` (o SQL Editor) contra el proyecto remoto.
- **Detalle:** [`01-base-de-datos-y-migraciones.md`](./01-base-de-datos-y-migraciones.md).

## 2. Convención Next.js 16: `proxy` frente a `middleware`

- **Contexto:** en la versión de Next.js usada en el repo, la capa de petición para refrescar cookies de sesión se alinea con el archivo [`proxy.ts`](../../proxy.ts) en la raíz del proyecto.
- **Antes:** patrón histórico con `middleware.ts` como nombre de archivo.
- **Ahora:** la lógica vive en [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts) (`updateSession`); la raíz exporta `proxy` + `matcher`. Las decisiones de seguridad usan **`getClaims()`** tras crear el cliente SSR, no `getSession()` en el servidor.
- **Detalle:** [`02-autenticacion-y-seguridad.md`](./02-autenticacion-y-seguridad.md).

## 3. Revisión de Auth, RLS y endpoints

- **Objetivo:** confirmar refresh de JWT, políticas RLS en Postgres y que no se filtre la **service role** al cliente.
- **Ahora:** cliente público/anon para la app; operaciones admin encapsuladas en [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts); variables documentadas en [`.env.example`](../../.env.example).

## 4. Registro de usuarios con rol (solo email, por admin)

- **Antes:** no había flujo en UI para crear cuentas con rol y finca.
- **Ahora:** `/auth/register` + [`crearUsuarioConRol`](../../app/actions/usuarios.ts) con validación Zod y rollback si falla `profiles`.
- **Detalle:** [`03-registro-usuarios-admin.md`](./03-registro-usuarios-admin.md).

## 5. Problemas de desarrollo: Turbopack, raíz del workspace y CSS

- **Síntoma:** error de resolución de `tailwindcss` desde un directorio padre del workspace, u otros fallos de `@import` en desarrollo.
- **Antes:** `next dev` por defecto con Turbopack; imports de paquete sin ruta relativa forzada.
- **Ahora:** script **`npm run dev`** con **`--webpack`**; imports en [`app/globals.css`](../../app/globals.css) vía rutas relativas a `node_modules`; [`next.config.ts`](../../next.config.ts) fija `turbopack.root` al directorio del `package.json` del proyecto.
- **Detalle:** [`04-nextjs-infraestructura-y-css.md`](./04-nextjs-infraestructura-y-css.md).

## 6. Rediseño UI “hasta terminar” (iteración actual)

- **Antes:** páginas funcionales con menos coherencia visual entre módulos.
- **Ahora:** sistema de superficies (`app-shell-bg`, `surface-panel`, animaciones), dashboard en `/`, auth enriquecida, layout de campo con cabecera sticky, fincas/lotes/historial con la misma línea gráfica y formularios táctiles.
- **Detalle:** [`05-interfaz-dashboard-y-modulos.md`](./05-interfaz-dashboard-y-modulos.md), [`06-fincas-lotes-y-campo.md`](./06-fincas-lotes-y-campo.md).

## 7. Funcionalidades de dominio ya enlazadas en la UI

- **Historial por lote:** página [`app/fincas/[fincaId]/lotes/[loteId]/page.tsx`](../../app/fincas/[fincaId]/lotes/[loteId]/page.tsx) con secciones de labores, cosechas y alertas (estilizadas en la misma iteración).
- **Edición finca/lote:** rutas `.../editar` y formularios en `components/fincas/`.

## 8. MCP Supabase en Cursor

- **Estado:** puede configurarse en [`.cursor/mcp.json`](../../.cursor/mcp.json).
- **Limitación:** si el servidor MCP exige autenticación interactiva, el usuario debe completarla en Cursor; el agente automatizado no puede finalizar ese paso por sí solo.
- **Referencia:** nota en [`supabase/migrations/README.md`](../../supabase/migrations/README.md).

## 9. Trabajo sugerido a continuación (no implementado como requisito cerrado)

Ideales mencionados en la misma línea de producto, útiles como backlog:

- Estados vacíos más ricos (ilustración / copy por módulo).
- Toasts o feedback global tras mutaciones.
- Transiciones entre rutas (p. ej. `template.tsx` o animaciones de vista).
- Navegación persistente: **sidebar** en escritorio y **bottom navigation** en móvil.
- Sustituir o añadir **logo** institucional cuando el equipo disponga del recurso.

## 10. Índice de archivos

- Tabla consolidada: [`07-indice-de-archivos-clave.md`](./07-indice-de-archivos-clave.md).

---

*Documento generado como memoria técnica del snapshot 15-04-2026; si el código diverge, prevalece el repositorio y [`AGENTS.md`](../../AGENTS.md).*
