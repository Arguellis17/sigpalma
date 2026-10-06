import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks: web-push y cliente admin de Supabase ──────────────────────────────────────────────
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }));

const borrados: string[][] = [];
let suscripciones: { id: string; endpoint: string; p256dh: string; auth: string }[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => ({
      select: () => ({
        in: async () => ({ data: tabla === "push_suscripciones" ? suscripciones : [], error: null }),
      }),
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          borrados.push(ids);
          return { error: null };
        },
      }),
    }),
  }),
}));

async function cargar() {
  vi.resetModules();
  return import("@/lib/push/enviar");
}

const payload = { title: "Alerta", body: "Ácaros", url: "/tecnico/sanidad/validacion", tag: "a1", requireInteraction: true };

describe("enviarPushAUsuarios", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
    borrados.length = 0;
    suscripciones = [
      { id: "s1", endpoint: "https://fcm.googleapis.com/fcm/send/aaa", p256dh: "p1", auth: "k1" },
      { id: "s2", endpoint: "https://updates.push.services.mozilla.com/bbb", p256dh: "p2", auth: "k2" },
    ];
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  });

  it("envía a cada dispositivo con el payload JSON, TTL y urgencia alta para avisos urgentes", async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 });
    const { enviarPushAUsuarios } = await cargar();
    const r = await enviarPushAUsuarios(["u1", "u1", "u2"], payload);
    expect(r).toEqual({ enviados: 2, eliminados: 0 });
    expect(setVapidDetails).toHaveBeenCalledWith("mailto:test@example.com", "pub", "priv");
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://fcm.googleapis.com/fcm/send/aaa", keys: { p256dh: "p1", auth: "k1" } },
      JSON.stringify(payload),
      { TTL: 6 * 60 * 60, urgency: "high" }
    );
  });

  it("borra suscripciones revocadas (410/404) y conserva las demás", async () => {
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }))
      .mockResolvedValueOnce({ statusCode: 201 });
    const { enviarPushAUsuarios } = await cargar();
    const r = await enviarPushAUsuarios(["u1"], { ...payload, requireInteraction: false });
    expect(r).toEqual({ enviados: 1, eliminados: 1 });
    expect(borrados).toEqual([["s1"]]);
    expect(sendNotification.mock.calls[1][2]).toEqual({ TTL: 6 * 60 * 60, urgency: "normal" });
  });

  it("errores transitorios (500) no borran la suscripción", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { enviarPushAUsuarios } = await cargar();
    expect(await enviarPushAUsuarios(["u1"], payload)).toEqual({ enviados: 0, eliminados: 0 });
    expect(borrados).toEqual([]);
  });

  it("sin claves VAPID no envía nada (no rompe el guardado del reporte)", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { enviarPushAUsuarios } = await cargar();
    expect(await enviarPushAUsuarios(["u1"], payload)).toEqual({ enviados: 0, eliminados: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sin destinatarios no consulta ni envía", async () => {
    const { enviarPushAUsuarios } = await cargar();
    expect(await enviarPushAUsuarios([], payload)).toEqual({ enviados: 0, eliminados: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("base64UrlABytes", () => {
  it("decodifica la clave pública VAPID (65 bytes, punto P-256 sin comprimir)", async () => {
    vi.doMock("@/app/actions/push", () => ({ guardarSuscripcionPush: vi.fn(), eliminarSuscripcionPush: vi.fn() }));
    const { base64UrlABytes } = await import("@/lib/notificaciones/push-cliente");
    const bytes = base64UrlABytes("BJ8LawCa6g1fqIFuIgJaSvanEfxQ_1Bl52NxzcXzSUxy0XZ13IdfIM_zYJZnQp0VpOWcJ5434HawfZrQxr2bYWI");
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
    expect(Buffer.from(bytes).toString("base64url")).toBe(
      "BJ8LawCa6g1fqIFuIgJaSvanEfxQ_1Bl52NxzcXzSUxy0XZ13IdfIM_zYJZnQp0VpOWcJ5434HawfZrQxr2bYWI"
    );
  });
});
