<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 1. Visión General del Proyecto (Project Overview)
Este proyecto corresponde a la plataforma web SIG-Palma (Plataforma Web para la Gestión Técnica y Trazabilidad del Cultivo de Palma de Aceite).
El modelo del negocio se fundamenta en la gestión integral del cultivo de palma de aceite mediante la digitalización de los procesos productivos, técnicos y logísticos.
En muchas plantaciones, la información técnica y de producción se registra de manera manual o en herramientas dispersas.
Esto genera dificultades para mantener un control técnico adecuado, limita la trazabilidad de la producción y reduce la capacidad de análisis.
El sistema resolverá esto al facilitar la planificación agronómica, el seguimiento de la productividad y la toma de decisiones basada en datos.

## 2. Conceptos de Dominio y Procesos de Alto Nivel (Domain Knowledge)
Utiliza la siguiente terminología para el modelado de bases de datos y la nomenclatura de funciones:

* **Planificación del cultivo:** Incluye la organización de los lotes de siembra, la planificación de fertilización y el calendario de labores agronómicas.
* **Gestión de labores agronómicas:** Registra actividades críticas como fertilización, control de malezas, poda, riego y manejo fitosanitario (Manejo Integrado de Plagas - MIP).
* **Monitoreo técnico del cultivo:** Permite el seguimiento del estado general, el registro de plagas y enfermedades, y la evaluación de crecimiento y condiciones del suelo.
* **Cosecha:** Consiste en la selección de racimos (RFF) por madurez, medida por frutos caídos. Se registra la producción de racimos por lote y el rendimiento por hectárea.
* **Trazabilidad y Sostenibilidad:** Permite rastrear la producción desde el lote de cultivo hasta el transporte y la entrega al centro de acopio o planta extractora. La trazabilidad digital es fundamental para asegurar la sostenibilidad certificada (RSPO). Adicionalmente, el control en la planta de beneficio requiere registrar la procedencia de la fruta para asegurar que provenga de fuentes responsables y no deforestadas.
* **Etapas de Preparación (Vivero y Siembra):** La selección y germinación requiere tratamientos de calor para romper latencia. El vivero (semillero) es una etapa técnica crítica para asegurar la calidad de la plántula antes del trasplante. La preparación y siembra requieren una adecuación del terreno garantizando una pendiente menor al 12% y ubicación adecuada de plúmula/radícula.

## 3. Alcance y Restricciones (Scope & Constraints)
* **Funcionalidades Base:** El sistema permitirá registrar fincas y lotes de cultivo, gestionar labores agronómicas, registrar el uso de insumos, monitorear plagas/enfermedades, y registrar datos de cosecha.
* **Análisis:** Debe generar reportes e indicadores de producción y eficiencia de labores. También debe mantener trazabilidad del cultivo por lote.
* **Restricción Estricta (Out of Scope):** El proyecto no contempla el desarrollo de sistemas de automatización agrícola ni la integración con sensores IoT en esta fase inicial. Abstente de generar simulaciones de hardware o pipelines de ingesta de telemetría.

## 4. Arquitectura y Stack Tecnológico (Tech Stack)
* **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, **shadcn/ui** (interfaz **mobile-first**; el perfil operario prioriza controles táctiles grandes y alto contraste).
* **Capa de aplicación:** **Next.js** (Server Components por defecto, **Server Actions** para mutaciones con sesión Supabase). No hay backend Python en este repositorio.
* **Validación de entradas:** **Zod** en el servidor (Server Actions / route handlers), alineado al esquema expuesto a la UI.
* **Base de datos y auth:** **Supabase** (PostgreSQL, Auth, Storage). Entorno por defecto: **Supabase Cloud** (URL y anon key del dashboard en `.env` / `.env.local`). El CLI `supabase start` local es opcional para pruebas aisladas.
* **Sesión y proxy:** el archivo raíz [`proxy.ts`](proxy.ts) (Next.js 16) llama a `supabase.auth.getClaims()` para refrescar/validar el JWT en cookies; no usar `getSession()` en el servidor para decisiones de seguridad (ver [docs Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)). Operaciones solo de servidor con privilegios elevados (p. ej. `auth.admin.createUser`) usan `SUPABASE_SERVICE_ROLE_KEY` en [`lib/supabase/admin.ts`](lib/supabase/admin.ts), nunca en el cliente.
* **Migraciones (canónicas):** SQL en [`supabase/migrations/`](supabase/migrations/) — ver [`supabase/migrations/README.md`](supabase/migrations/README.md). Ahí están RLS, triggers, `auth.users` → `profiles`, Storage, etc.
* **Drizzle ORM:** espejo del esquema en [`db/schema.ts`](db/schema.ts) para consultas tipadas, `drizzle-kit studio` y documentación. Config: [`drizzle.config.ts`](drizzle.config.ts). Variable opcional `DATABASE_URL` (Postgres directo, p. ej. desde el dashboard de Supabase) en [`.env.example`](.env.example).
* **Flujo recomendado:** cambiar primero el SQL en `supabase/migrations/`, aplicar con Supabase CLI o SQL Editor, luego **actualizar** [`db/schema.ts`](db/schema.ts) para que coincida (o introspección puntual con `drizzle-kit introspect` contra una DB ya migrada). La app sigue usando **Supabase JS** + RLS; Drizzle es opcional para reporting y herramientas.

### 4.1 Modelo de acceso (MVP)
* **Roles:** `admin`, `agronomo`, `operario` (enum en base de datos).
* **Tenencia por finca:** cada usuario con rol distinto de `admin` tiene exactamente **una** finca asignada (`profiles.finca_id`). Los `admin` pueden tener `finca_id` nulo y ver/gestionar el conjunto según políticas RLS.
* **Registros RSPO:** sin borrado físico en tablas transaccionales; usar anulación lógica (`is_voided` / estados) donde aplique.

### 4.2 Dónde va la lógica
* **Por defecto:** mutaciones desde la app web con **Server Actions** + cliente **`@supabase/ssr`** y políticas **RLS**.
* **API HTTP versionada (`/app/api/v1/...`):** reservada para clientes externos, webhooks o exportaciones que no encajen en actions.
* **Supabase Edge Functions:** solo si el trabajo debe vivir en el proyecto Supabase (webhooks entrantes aislados, tareas asíncronas fuera del deploy de Vercel). No usar Edge Functions para el CRUD habitual de la app.

## 5. Directrices de Codificación para el Agente (Coding Best Practices)

### 5.1. Next.js & Frontend Code Style
* **Type Safety:** Usa TypeScript estricto. Tipos generados o centralizados en `lib/database.types.ts` (actualizar al cambiar el esquema).
* **Estructura:** Server Components por defecto; Client Components solo para interactividad (formularios controlados, hooks de UI).
* **Clean Code:** Variables y nombres orientados al dominio agrícola; early returns en validación y manejo de errores.

### 5.2. Lógica de servidor y datos
* **Server Actions:** Validar con Zod; obtener usuario con `createClient()` de `lib/supabase/server.ts`; no exponer secretos al cliente.
* **Errores:** Devolver resultados tipados (`{ success, error }` o similar) en lugar de silenciar fallos de Supabase.

### 5.3. Supabase & Integración
* **RLS obligatorio** en tablas expuestas al cliente. Políticas basadas en `auth.uid()` y `profiles` (rol y `finca_id`).
* **Esquema relacional:** nombres en `snake_case`.
* **Storage:** bucket `evidencia-tecnica` (rutas por carpeta: `fitosanidad/`, `certificaciones/`); políticas alineadas a roles (técnicos/admin suben; operario según política acordada).

<!-- codecortex:start -->
## CodeCortex — Project Knowledge (auto-updated)

### Architecture
**sigpalma** — tsx, typescript, javascript — 86 files, 716 symbols
- **Modules (4):** validations (239loc), supabase (184loc), auth (99loc), campo (27loc)
- **Key deps:** react, @/app, @/lib, @/components, next, +15 more

### Risk Map
**High-risk files:**
- `components/auth/login-form.tsx` — 2 changes, stable
- `...ello-repositorio-y-esquema-de-base-de-datos.txt` — 2 changes, stable
- `...pauldi-despliegue-y-configuracion-en-vercel.txt` — 2 changes, stable
- `.../jhojan-postgres-drizzle-y-migraciones.txt` — 2 changes, stable
- `...cion-api-lotes-insumos-material-diccionario.txt` — 2 changes, stable

### Before Editing
Check `.codecortex/hotspots.md` for risk-ranked files before editing.
If CodeCortex MCP tools are available, call `get_edit_briefing` for coupling + risk details.
If not, read `.codecortex/modules/<module>.md` for the relevant module's dependencies and bug history.

### Project Knowledge
Read these files directly (always available, no tool call needed):
- `.codecortex/hotspots.md` — risk-ranked files with coupling + bug data
- `.codecortex/modules/*.md` — module docs, dependencies, temporal signals
- `.codecortex/constitution.md` — full architecture overview
- `.codecortex/patterns.md` — coding conventions
- `.codecortex/decisions/*.md` — architectural decisions

### MCP Tools (if available)
If a CodeCortex MCP server is connected, these tools provide live analysis:
- `get_edit_briefing` — risk + coupling + bugs for files you plan to edit.
- `get_change_coupling` — files that co-change (hidden dependencies).
- `get_project_overview` — architecture + dependency graph summary.
- `get_dependency_graph` — scoped import/call graph for file or module.
- `lookup_symbol` — precise symbol search (name, kind, file filters).
<!-- codecortex:end -->
