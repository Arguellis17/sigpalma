"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import type { Json } from "@/lib/database.types";
import type {
  FincaAuditActionKey,
  FincaAuditEventListRow,
} from "@/lib/audit/finca-audit";
import {
  offsetFromPage,
  sanitizeIlikeFragment,
} from "@/lib/list-query";
import {
  type AuditoriaListQuery,
  withClampedPage,
} from "@/lib/audit/audit-list-query";
import { actionError, actionOk, type ActionResult } from "./types";

export type FincaAuditListPayload = {
  rows: FincaAuditEventListRow[];
  total: number;
  /** Query efectiva (p. ej. página ajustada si estaba fuera de rango). */
  query: AuditoriaListQuery;
};

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

async function assertCanReadAuditoriaFinca(
  fincaId: string
): Promise<ActionResult<{ supabase: Awaited<ReturnType<typeof createClient>> }>> {
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
  return actionOk({ supabase });
}

/**
 * Lista paginada y ordenada por columnas permitidas (`finca_audit_events`).
 * Filtro `q`: búsqueda parcial insensible a mayúsculas en `titulo`.
 */
export async function listarEventosAuditoriaFinca(
  fincaId: string,
  query: AuditoriaListQuery
): Promise<ActionResult<FincaAuditListPayload>> {
  const auth = await assertCanReadAuditoriaFinca(fincaId);
  if (!auth.success) return auth;

  const supabase = auth.data.supabase;
  const safeQ = sanitizeIlikeFragment(query.q);

  let countQ = supabase
    .from("finca_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("finca_id", fincaId);

  if (safeQ.length > 0) {
    countQ = countQ.ilike("titulo", `%${safeQ}%`);
  }

  const { count: rawCount, error: countError } = await countQ;
  if (countError) {
    return actionError(countError.message);
  }

  const total = rawCount ?? 0;
  const qResolved = withClampedPage(query, total);
  const ascending = qResolved.dir === "asc";
  const from = offsetFromPage(qResolved.page, qResolved.pageSize);
  const to = from + qResolved.pageSize - 1;

  let dataQ = supabase
    .from("finca_audit_events")
    .select("id, created_at, action_key, titulo, detalle, actor_id")
    .eq("finca_id", fincaId);

  if (safeQ.length > 0) {
    dataQ = dataQ.ilike("titulo", `%${safeQ}%`);
  }

  const { data: events, error } = await dataQ
    .order(qResolved.sort, { ascending })
    .range(from, to);

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

  return actionOk({ rows: enriched, total, query: qResolved });
}
