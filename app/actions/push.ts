"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { actionError, actionOk, type ActionResult } from "./types";

const suscripcionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(2000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
  userAgent: z.string().max(400).optional().nullable(),
});

/**
 * Guarda la suscripción Web Push del navegador para el usuario en sesión.
 * Upsert por endpoint: si el dispositivo estaba asociado a otra cuenta (equipo compartido),
 * pasa al usuario actual para que no reciba avisos ajenos.
 */
export async function guardarSuscripcionPush(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  const parsed = suscripcionSchema.safeParse(raw);
  if (!parsed.success) return actionError("Suscripción de notificaciones no válida.");

  const session = await getSessionProfile();
  if (!session?.user || !session.profile?.is_active) return actionError("Sesión no válida.");

  const { endpoint, keys, userAgent } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("push_suscripciones").upsert(
    {
      user_id: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return actionError(error.message);
  return actionOk({ ok: true });
}

/** Elimina la suscripción de este navegador (al cerrar sesión o desactivar avisos). */
export async function eliminarSuscripcionPush(endpoint: string): Promise<ActionResult<{ ok: true }>> {
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return actionError("Suscripción no válida.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("push_suscripciones").delete().eq("endpoint", endpoint);
  if (error) return actionError(error.message);
  return actionOk({ ok: true });
}
