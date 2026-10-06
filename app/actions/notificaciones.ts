"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { actionError, actionOk, type ActionResult } from "./types";

export type NotificacionRow = Database["public"]["Tables"]["notificaciones"]["Row"];

/** Tamaño de la bandeja visible (las más recientes). */
const LIMITE = 50;

const idsSchema = z.array(z.string().uuid()).max(200);

/** Últimas notificaciones del usuario en sesión (RLS: solo las propias) y total sin leer. */
export async function listarNotificaciones(): Promise<
  ActionResult<{ items: NotificacionRow[]; noLeidas: number }>
> {
  const supabase = await createClient();
  const [lista, conteo] = await Promise.all([
    supabase.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(LIMITE),
    supabase.from("notificaciones").select("id", { count: "exact", head: true }).is("leida_at", null),
  ]);
  if (lista.error) return actionError(lista.error.message);
  return actionOk({ items: lista.data ?? [], noLeidas: conteo.count ?? 0 });
}

/** Marca como leídas las indicadas; sin ids, todas las pendientes del usuario. */
export async function marcarNotificacionesLeidas(ids?: string[]): Promise<ActionResult<{ ok: true }>> {
  const parsed = idsSchema.optional().safeParse(ids);
  if (!parsed.success) return actionError("Notificaciones no válidas.");
  const supabase = await createClient();
  let query = supabase.from("notificaciones").update({ leida_at: new Date().toISOString() }).is("leida_at", null);
  if (parsed.data?.length) query = query.in("id", parsed.data);
  const { error } = await query;
  if (error) return actionError(error.message);
  return actionOk({ ok: true });
}

/** Elimina las indicadas, o todas las ya leídas si `soloLeidas`. */
export async function eliminarNotificaciones(
  opciones: { ids?: string[]; soloLeidas?: boolean }
): Promise<ActionResult<{ ok: true }>> {
  const parsed = z.object({ ids: idsSchema.optional(), soloLeidas: z.boolean().optional() }).safeParse(opciones);
  if (!parsed.success) return actionError("Solicitud no válida.");
  const { ids, soloLeidas } = parsed.data;
  if (!ids?.length && !soloLeidas) return actionError("Nada que eliminar.");

  const supabase = await createClient();
  let query = supabase.from("notificaciones").delete();
  query = ids?.length ? query.in("id", ids) : query.not("leida_at", "is", null);
  const { error } = await query;
  if (error) return actionError(error.message);
  return actionOk({ ok: true });
}
