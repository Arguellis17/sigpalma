# Registro de usuarios por administrador

## Objetivo

Permitir que un usuario con rol **`admin`** cree cuentas **por correo electrónico**, asigne **`role`** (`admin`, `agronomo`, `operario`) y, cuando corresponda, **`finca_id`**, sin exponer la `service_role` al cliente.

## Antes

- El flujo de alta masiva o de equipos no estaba cubierto en la UI: típicamente solo existía login.
- No había una Server Action dedicada ni validación Zod centralizada para este caso.

## Ahora

### Flujo

1. La página [`app/auth/register/page.tsx`](../../app/auth/register/page.tsx) (Server Component) comprueba sesión y **solo admite administradores**; si no, redirige.
2. Carga la lista de fincas disponibles para rellenar el desplegable cuando el rol lo requiere.
3. El formulario cliente [`components/auth/register-form.tsx`](../../components/auth/register-form.tsx) envía los datos a la Server Action.
4. [`app/actions/usuarios.ts`](../../app/actions/usuarios.ts) — función `crearUsuarioConRol`:
   - Valida con Zod.
   - Verifica `isAdmin` vía [`getSessionProfile`](../../lib/auth/session-profile.ts).
   - Usa [`createAdminClient()`](../../lib/supabase/admin.ts) para:
     - `auth.admin.createUser` (email, password, confirmación de email según flags).
     - `update` en `profiles` con `role`, `full_name`, `finca_id` (nulo para admin).
   - Si falla la actualización de `profiles`, **revierte** eliminando el usuario en Auth (`deleteUser`).

### Validación (Zod)

Archivo: [`lib/validations/usuario.ts`](../../lib/validations/usuario.ts)

- `crearUsuarioAdminSchema`: email, password (mín. 8 caracteres), nombre, `role`, `finca_id` opcional.
- `superRefine`: los **admin** no pueden llevar `finca_id`; **agronomo** y **operario** **deben** tener `finca_id`.

### Exportación de actions

- [`app/actions/index.ts`](../../app/actions/index.ts) reexporta `crearUsuarioConRol`.

### UI

- La página de login [`app/auth/login/page.tsx`](../../app/auth/login/page.tsx) enlaza al registro **para admins** (según diseño actual del proyecto).
- Formularios con el sistema visual unificado (`surface-panel`, etc.) descrito en [05-interfaz-dashboard-y-modulos.md](./05-interfaz-dashboard-y-modulos.md).

## Requisitos de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) — sin esto, `createAdminClient()` falla con error explícito.

## Archivos citados

- [`app/auth/register/page.tsx`](../../app/auth/register/page.tsx)
- [`components/auth/register-form.tsx`](../../components/auth/register-form.tsx)
- [`app/actions/usuarios.ts`](../../app/actions/usuarios.ts)
- [`app/actions/index.ts`](../../app/actions/index.ts)
- [`lib/validations/usuario.ts`](../../lib/validations/usuario.ts)
- [`lib/supabase/admin.ts`](../../lib/supabase/admin.ts)
- [`lib/auth/session-profile.ts`](../../lib/auth/session-profile.ts)
