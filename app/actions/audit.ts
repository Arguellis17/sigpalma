"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import type { Json } from "@/lib/database.types";
import type {
  FincaAuditActionKey,
  FincaAuditEventListRow,
} from "@/lib/audit/finca-audit";
import { actionError, actionOk, type ActionResult } from "./types";

/**
 * Registra un evento de auditoría legible. No debe interrumpir el flujo principal.
 */
export async function registrarEventoFinca(params: {
  fincaId: string;
  actionKey: FincaAuditActionKey;
  titulo: string;
  detalle: Record<string, unknown>;
}): Promise<void> {
  try {
    const session = await getSessionProfile();
    if (!session?.user) return;
    const supabase = await createClient();
    const { error } = await supabase.from("finca_audit_events").insert({
      finca_id: params.fincaId,
      actor_id: session.user.id,
      action_key: params.actionKey,
      titulo: params.titulo,
      detalle: params.detalle as Json,
    });
    if (error) {
      console.error("[finca_audit_events]", error.message);
    }
  } catch (e) {
    console.error("[finca_audit_events]", e);
  }
}

export async function listarEventosAuditoriaFinca(
  fincaId: string
): Promise<ActionResult<FincaAuditEventListRow[]>> {
  if (!fincaId) {
    return actionError("Indique la finca.");
  }

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }

  const profile = session.profile;
  if (isSuperAdmin(profile)) {
    // superadmin puede consultar cualquier finca
  } else if (profile.role === "admin" && profile.finca_id === fincaId) {
    // admin de finca
  } else {
    return actionError("No tiene permiso para ver la auditoría de esta finca.");
  }

  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from("finca_audit_events")
    .select("id, created_at, action_key, titulo, detalle, actor_id")
    .eq("finca_id", fincaId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return actionError(error.message);
  }

  const rows = events ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const nameById = new Map<string, string | null>();

  if (actorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profs ?? []) {
      nameById.set(p.id, p.full_name ?? null);
    }
  }

  const enriched: FincaAuditEventListRow[] = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    action_key: r.action_key,
    titulo: r.titulo,
    detalle: r.detalle,
    actor_id: r.actor_id,
    actor_full_name: nameById.get(r.actor_id) ?? null,
  }));

  return actionOk(enriched);
}
