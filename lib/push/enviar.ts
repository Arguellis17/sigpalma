import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import {
  RUTA_VALIDACION,
  construirNotificacion,
  type AlertaInsertada,
} from "@/lib/notificaciones/alerta-fitosanitaria";
import {
  RUTA_MONITOREOS_OPERARIO,
  construirAvisoMonitoreo,
  type MonitoreoAsignadoPayload,
} from "@/lib/notificaciones/monitoreo-asignado";

/**
 * Web Push (solo servidor): llega aunque el navegador esté cerrado (Android / escritorio).
 * Requiere NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT; sin ellas no envía nada.
 */

/** Lo que recibe `public/sw.js` en el evento `push`. */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Misma etiqueta = la notificación reemplaza a la anterior (sin duplicados). */
  tag: string;
  requireInteraction?: boolean;
};

/** Las alertas pierden valor rápido: si el dispositivo no se conecta en 6 h, se descarta. */
const TTL_SEGUNDOS = 6 * 60 * 60;

let vapidListo: boolean | null = null;
function configurarVapid(): boolean {
  if (vapidListo !== null) return vapidListo;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const sujeto = process.env.VAPID_SUBJECT;
  vapidListo = Boolean(publica && privada && sujeto);
  if (vapidListo) webpush.setVapidDetails(sujeto!, publica!, privada!);
  else console.warn("[push] Faltan variables VAPID; no se envían notificaciones push.");
  return vapidListo;
}

/** Envía a todos los dispositivos suscritos de los usuarios; limpia suscripciones caducadas. */
export async function enviarPushAUsuarios(
  userIds: string[],
  payload: PushPayload
): Promise<{ enviados: number; eliminados: number }> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0 || !configurarVapid()) return { enviados: 0, eliminados: 0 };

  const admin = createAdminClient();
  const { data: suscripciones, error } = await admin
    .from("push_suscripciones")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", ids);
  if (error) {
    console.error("[push] leer suscripciones:", error.message);
    return { enviados: 0, eliminados: 0 };
  }

  let enviados = 0;
  const caducadas: string[] = [];
  await Promise.allSettled(
    (suscripciones ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: TTL_SEGUNDOS, urgency: payload.requireInteraction ? "high" : "normal" }
        );
        enviados += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: el navegador revocó la suscripción (permiso retirado, datos borrados…).
        if (status === 404 || status === 410) caducadas.push(s.id);
        else console.error("[push] envío fallido:", status, (e as Error).message);
      }
    })
  );

  if (caducadas.length > 0) {
    await admin.from("push_suscripciones").delete().in("id", caducadas);
  }
  return { enviados, eliminados: caducadas.length };
}

type NuevaNotificacion = Database["public"]["Tables"]["notificaciones"]["Insert"];

/** Guarda notificaciones en la bandeja de cada usuario; Realtime las entrega a las pestañas abiertas. */
export async function registrarNotificaciones(filas: NuevaNotificacion[]): Promise<number> {
  if (filas.length === 0) return 0;
  const { error } = await createAdminClient().from("notificaciones").insert(filas);
  if (error) {
    console.error("[notificaciones] registrar:", error.message);
    return 0;
  }
  return filas.length;
}

/**
 * Nueva alerta fitosanitaria: notificación en la bandeja de los técnicos activos de la finca
 * (excepto quien la creó) + Web Push. Nunca lanza.
 */
export async function notificarAlertaFitosanitaria(alertaId: string) {
  const admin = createAdminClient();
  const { data: alerta } = await admin
    .from("alertas_fitosanitarias")
    .select("id, finca_id, lote_id, severidad, descripcion, created_by, is_voided, lotes ( codigo ), catalogo_items ( nombre )")
    .eq("id", alertaId)
    .maybeSingle();
  if (!alerta || alerta.is_voided) return { registradas: 0, enviados: 0, eliminados: 0 };

  const { data: tecnicos } = await admin
    .from("profiles")
    .select("id")
    .eq("finca_id", alerta.finca_id)
    .eq("role", "agronomo")
    .eq("is_active", true)
    .neq("id", alerta.created_by);
  const destinatarios = (tecnicos ?? []).map((t) => t.id);

  const fila = alerta as unknown as AlertaInsertada & {
    lotes?: { codigo?: string } | null;
    catalogo_items?: { nombre?: string } | null;
  };
  const n = construirNotificacion(fila, {
    loteCodigo: fila.lotes?.codigo ?? null,
    plaga: fila.catalogo_items?.nombre ?? null,
  });

  const registradas = await registrarNotificaciones(
    destinatarios.map((userId) => ({
      user_id: userId,
      tipo: "alerta_fitosanitaria" as const,
      titulo: n.titulo,
      cuerpo: n.cuerpo,
      url: RUTA_VALIDACION,
      referencia_id: alerta.id,
      severidad: n.severidad,
    }))
  );
  const push = await enviarPushAUsuarios(destinatarios, {
    title: n.titulo,
    body: n.cuerpo,
    url: RUTA_VALIDACION,
    tag: n.id,
    requireInteraction: n.urgente,
  });
  return { registradas, ...push };
}

/** Monitoreo asignado (o reasignado): notificación en la bandeja del operario + Web Push. Nunca lanza. */
export async function notificarMonitoreoAsignado(operarioId: string, payload: MonitoreoAsignadoPayload) {
  const { titulo, cuerpo } = construirAvisoMonitoreo(payload);
  const registradas = await registrarNotificaciones([
    {
      user_id: operarioId,
      tipo: "monitoreo_asignado",
      titulo,
      cuerpo,
      url: RUTA_MONITOREOS_OPERARIO,
      referencia_id: payload.monitoreoId,
    },
  ]);
  const push = await enviarPushAUsuarios([operarioId], {
    title: titulo,
    body: cuerpo,
    url: RUTA_MONITOREOS_OPERARIO,
    tag: `monitoreo:${payload.monitoreoId}`,
  });
  return { registradas, ...push };
}
