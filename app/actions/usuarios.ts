"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  crearUsuarioAdminSchema,
  actualizarUsuarioSchema,
  restablecerContrasenaSchema,
  rolesAsignablesPorAdmin,
  rolesAsignablesPorSuperadmin,
  type CrearUsuarioAdminInput,
} from "@/lib/validations/usuario";
import { actionError, actionOk, type ActionResult } from "./types";

// ─── HU01: Crear usuario ──────────────────────────────────────────────────────

export async function crearUsuarioConRol(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearUsuarioAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearUsuarioAdminInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Solo un administrador puede crear usuarios.");
  }

  // Enforce hierarchy: admin cannot create other admins
  if (!isSuperAdmin(session.profile)) {
    const allowed: readonly string[] = rolesAsignablesPorAdmin;
    if (!allowed.includes(input.role)) {
      return actionError(
        "Los administradores solo pueden crear agrónomo u operario. Contacta al Super Administrador para crear otro administrador."
      );
    }
  } else {
    const allowed: readonly string[] = rolesAsignablesPorSuperadmin;
    if (!allowed.includes(input.role)) {
      return actionError("Rol no permitido.");
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de configuración del servidor.";
    return actionError(msg);
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim() },
  });

  if (createErr || !created.user) {
    return actionError(createErr?.message ?? "No se pudo crear el usuario.");
  }

  const userId = created.user.id;
  const fincaId = input.role === "admin" ? null : (input.finca_id ?? null);

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      role: input.role,
      finca_id: fincaId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    return actionError(profileErr.message);
  }

  return actionOk({ id: userId });
}

// ─── HU02: Actualizar datos de usuario ───────────────────────────────────────

export async function actualizarUsuario(
  raw: unknown
): Promise<ActionResult<void>> {
  const parsed = actualizarUsuarioSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Acción no permitida.");
  }

  const supabase = await createClient();
  type ProfileUpdate = { full_name?: string; finca_id?: string | null };
  const updates: ProfileUpdate = {};
  if (parsed.data.full_name !== undefined) updates.full_name = parsed.data.full_name.trim();
  if (parsed.data.finca_id !== undefined) updates.finca_id = parsed.data.finca_id;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", parsed.data.id);

  if (error) return actionError(error.message);
  return actionOk(undefined);
}

// ─── HU02: Inactivar usuario (lógico, no borrado físico) ─────────────────────

export async function inactivarUsuario(
  userId: string
): Promise<ActionResult<void>> {
  if (!userId) return actionError("ID inválido.");

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Acción no permitida.");
  }

  // Prevent self-deactivation
  if (session.user.id === userId) {
    return actionError("No puedes inactivar tu propia cuenta.");
  }

  const supabase = await createClient();

  // Check role of target — admins cannot deactivate other admins or superadmins
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!target) return actionError("Usuario no encontrado.");

  if (!isSuperAdmin(session.profile)) {
    if (target.role === "admin" || target.role === "superadmin") {
      return actionError("No tienes permisos para inactivar este usuario.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return actionError(error.message);
  return actionOk(undefined);
}

// ─── HU02: Restablecer contraseña ────────────────────────────────────────────

export async function restablecerContrasena(
  raw: unknown
): Promise<ActionResult<void>> {
  const parsed = restablecerContrasenaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Acción no permitida.");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de configuración del servidor.";
    return actionError(msg);
  }

  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
  });

  if (error) return actionError(error.message);
  return actionOk(undefined);
}

// ─── Listar usuarios (para tabla en admin/usuarios) ──────────────────────────

export async function listarUsuarios(): Promise<
  ActionResult<
    {
      id: string;
      email: string | null;
      full_name: string | null;
      role: string | null;
      is_active: boolean;
      finca_id: string | null;
      finca_nombre: string | null;
      created_at: string | null;
    }[]
  >
> {
  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Acción no permitida.");
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data, error }, { data: authUsersData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, finca_id, created_at, fincas(nombre)")
      .order("created_at", { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (error) return actionError(error.message);

  const emailMap = new Map(
    (authUsersData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const rows = (data ?? []).map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? null,
    full_name: p.full_name,
    role: p.role,
    is_active: p.is_active ?? false,
    finca_id: p.finca_id,
    finca_nombre: (p.fincas as { nombre?: string } | null)?.nombre ?? null,
    created_at: p.created_at,
  }));

  return actionOk(rows);
}

