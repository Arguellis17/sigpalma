# Documentación SIG-Palma — snapshot 15-04-2026

Este directorio recopila la documentación **por funcionalidad** del trabajo realizado en el periodo asociado a la conversación de desarrollo (abril 2026). Describe el **estado anterior** frente al **estado actual**, las **rutas de archivos** implicadas y el **encaje** con Supabase Cloud, Next.js 16 y el rediseño de interfaz.

## Contenido

| Documento | Tema |
|-----------|------|
| [01-base-de-datos-y-migraciones.md](./01-base-de-datos-y-migraciones.md) | Migraciones SQL canónicas, Supabase Cloud vs local, Drizzle, RLS |
| [02-autenticacion-y-seguridad.md](./02-autenticacion-y-seguridad.md) | `proxy.ts`, sesión, `getClaims`, cliente admin, variables de entorno |
| [03-registro-usuarios-admin.md](./03-registro-usuarios-admin.md) | Alta de usuarios con rol por administrador (email) |
| [04-nextjs-infraestructura-y-css.md](./04-nextjs-infraestructura-y-css.md) | Webpack vs Turbopack, `next.config.ts`, `globals.css` |
| [05-interfaz-dashboard-y-modulos.md](./05-interfaz-dashboard-y-modulos.md) | Sistema visual, layout, auth, home dashboard |
| [06-fincas-lotes-y-campo.md](./06-fincas-lotes-y-campo.md) | Fincas, lotes, historial, módulo campo y formularios |
| [07-indice-de-archivos-clave.md](./07-indice-de-archivos-clave.md) | Tabla rápida de archivos por área |
| [08-cronologia-conversacion-y-pendientes.md](./08-cronologia-conversacion-y-pendientes.md) | Orden cronológico del trabajo y backlog sugerido |

## Alcance

- **Incluye:** decisiones técnicas acordadas en la conversación, archivos tocados o creados, y comportamiento esperado del sistema.
- **No sustituye:** [`AGENTS.md`](../../AGENTS.md) (directrices permanentes del repo), ni [`supabase/migrations/README.md`](../../supabase/migrations/README.md) (procedimiento operativo de migraciones).

## Contexto de producto

**SIG-Palma** es la plataforma web para gestión técnica y trazabilidad del cultivo de palma de aceite. Stack: **Next.js (App Router)**, **TypeScript**, **Tailwind CSS 4**, **shadcn/ui**, **Supabase** (PostgreSQL, Auth, Storage), validación con **Zod**, mutaciones con **Server Actions**.
