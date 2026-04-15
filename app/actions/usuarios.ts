"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import {
  crearUsuarioAdminSchema,
  type CrearUsuarioAdminInput,
} from "@/lib/validations/usuario";
import { actionError, actionOk, type ActionResult } from "./types";

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
  const fincaId = input.role === "admin" ? null : input.finca_id ?? null;

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
