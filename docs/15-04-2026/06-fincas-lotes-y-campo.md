# Fincas, lotes, historial y módulo Campo

## Objetivo

Documentar las rutas y piezas de UI/Server Actions que cubren **gestión de fincas y lotes**, **historial por lote**, y **operaciones de campo** (labor, cosecha, alerta), con el rediseño aplicado de forma homogénea.

## Modelo de acceso (recordatorio)

Según [`AGENTS.md`](../../AGENTS.md) y [`lib/auth/session-profile.ts`](../../lib/auth/session-profile.ts):

- Roles: `admin`, `agronomo`, `operario`.
- Usuarios no admin tienen **una** finca en `profiles.finca_id`.
- Registros sensibles: evitar borrado físico donde aplique; usar anulación lógica / estados cuando el esquema lo defina.

## Antes

- Páginas funcionales con menos jerarquía visual y menos enlaces explícitos entre listados y detalle/historial.
- Layout de `/campo` menos estructurado (sin cabecera sticky unificada ni subnavegación clara).

## Ahora

### Listado y creación de fincas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/fincas` | [`app/fincas/page.tsx`](../../app/fincas/page.tsx) | Listado con tarjetas `surface-panel`, héroe con rol y CTA "Nueva finca" / volver al dashboard |
| `/fincas/nueva` | [`app/fincas/nueva/page.tsx`](../../app/fincas/nueva/page.tsx) | Alta de finca — cabecera con panel y botón volver |
| Componente | [`components/fincas/finca-create-form.tsx`](../../components/fincas/finca-create-form.tsx) | Formulario con inputs redondeados y mensajes de estado |

**Server Actions:** [`app/actions/fincas.ts`](../../app/actions/fincas.ts)

### Detalle de finca y lotes

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/fincas/[fincaId]` | [`app/fincas/[fincaId]/page.tsx`](../../app/fincas/[fincaId]/page.tsx) | Héroe con nombre de finca, acciones (editar si admin, nuevo lote), lista de lotes con enlace a historial/detalle |

**Antes:** menos énfasis en navegación hacia historial por lote.  
**Ahora:** cada lote enlaza a `/fincas/[fincaId]/lotes/[loteId]` con CTA clara.

### Edición de finca

| Ruta | Archivo |
|------|---------|
| `/fincas/[fincaId]/editar` | [`app/fincas/[fincaId]/editar/page.tsx`](../../app/fincas/[fincaId]/editar/page.tsx) |
| Formulario | [`components/fincas/finca-edit-form.tsx`](../../components/fincas/finca-edit-form.tsx) |

### Lotes: crear, editar, historial

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/fincas/[fincaId]/lotes/nuevo` | [`app/fincas/[fincaId]/lotes/nuevo/page.tsx`](../../app/fincas/[fincaId]/lotes/nuevo/page.tsx) | Crear lote |
| `/fincas/[fincaId]/lotes/[loteId]` | [`app/fincas/[fincaId]/lotes/[loteId]/page.tsx`](../../app/fincas/[fincaId]/lotes/[loteId]/page.tsx) | Detalle + **historial** (labores, cosechas, alertas) con secciones estilizadas |
| `/fincas/[fincaId]/lotes/[loteId]/editar` | [`app/fincas/[fincaId]/lotes/[loteId]/editar/page.tsx`](../../app/fincas/[fincaId]/lotes/[loteId]/editar/page.tsx) | Edición de lote |

Componentes de formulario:

- [`components/fincas/lote-create-form.tsx`](../../components/fincas/lote-create-form.tsx)
- [`components/fincas/lote-edit-form.tsx`](../../components/fincas/lote-edit-form.tsx)

**Server Actions:** [`app/actions/lotes.ts`](../../app/actions/lotes.ts)

**Historial:** la página de lote agrupa registros por tipo; estilos con `surface-panel`, bordes `rounded-[1.5rem]`, tipografía acorde al dashboard.

### Módulo Campo (operaciones)

Layout: [`app/campo/layout.tsx`](../../app/campo/layout.tsx)

- Cabecera sticky con título del módulo, descripción, migas y enlaces a subpáginas (labor, cosecha, alerta).

Páginas:

| Ruta | Archivo |
|------|---------|
| `/campo` | [`app/campo/page.tsx`](../../app/campo/page.tsx) |
| `/campo/labor` | [`app/campo/labor/page.tsx`](../../app/campo/labor/page.tsx) |
| `/campo/cosecha` | [`app/campo/cosecha/page.tsx`](../../app/campo/cosecha/page.tsx) |
| `/campo/alerta` | [`app/campo/alerta/page.tsx`](../../app/campo/alerta/page.tsx) |

Formularios (cliente):

- [`components/campo/labor-form.tsx`](../../components/campo/labor-form.tsx)
- [`components/campo/cosecha-form.tsx`](../../components/campo/cosecha-form.tsx)
- [`components/campo/alerta-form.tsx`](../../components/campo/alerta-form.tsx)

Bloqueo cuando el perfil no puede registrar en campo:

- [`components/campo/campo-locked.tsx`](../../components/campo/campo-locked.tsx)

**Server Actions:** [`app/actions/labores.ts`](../../app/actions/labores.ts), [`app/actions/cosecha.ts`](../../app/actions/cosecha.ts), [`app/actions/alertas.ts`](../../app/actions/alertas.ts)

Datos auxiliares (selectores finca/lote): [`hooks/use-finca-lote-options.ts`](../../hooks/use-finca-lote-options.ts), validaciones en [`lib/validations/operativo.ts`](../../lib/validations/operativo.ts), [`lib/validations/finca-lote.ts`](../../lib/validations/finca-lote.ts).

## Resumen antes → ahora

| Área | Antes | Ahora |
|------|--------|--------|
| `/fincas` | Lista simple | Héroe + tarjetas ricas + CTAs claros |
| Detalle finca | Menos “dashboard” | Héroe, acciones, lista de lotes con enlace a historial |
| Historial lote | Funcional | Misma información con UI alineada al sistema visual |
| `/campo` | Layout plano | Layout sticky, subnavegación, héroes por subpágina |
| Formularios | Estilo básico | `surface-panel`, inputs táctiles, feedback visual unificado |

## Archivos citados (agrupados)

- Rutas app: `app/fincas/**`, `app/campo/**`
- Componentes: `components/fincas/*`, `components/campo/*`
- Acciones: `app/actions/fincas.ts`, `lotes.ts`, `labores.ts`, `cosecha.ts`, `alertas.ts`, `queries.ts`
