import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EVENTO_MONITOREO_ASIGNADO,
  RUTA_MONITOREOS_OPERARIO,
  canalMonitoreosOperario,
  construirAvisoMonitoreo,
  debeNotificarAsignacion,
} from "@/lib/notificaciones/monitoreo-asignado";
import {
  actualizarMonitoreoProgramadoSchema,
  crearMonitoreoProgramadoSchema,
} from "@/lib/validations/monitoreo-programado";

const RONALD = "f6701d42-446f-48af-9b5a-8b4dff53bb2f";
const OTRO = "64c5908e-55ae-4d83-b139-8bf4128e45ea";
const FINCA = "d4e96ae4-05af-40da-8868-2fb8509dc4ae";
const LOTE = "5de0fe48-860d-486d-9faa-c209adafb80a";

const evento = {
  monitoreoId: "m1",
  loteCodigo: "L-04",
  fechaInspeccion: "2026-10-08",
  notas: "Revisar flechas nuevas en el sector norte",
  reasignado: false,
};

describe("canal y evento", () => {
  it("cada operario tiene su canal privado (coincide con la política RLS de realtime.messages)", () => {
    expect(canalMonitoreosOperario(RONALD)).toBe(`monitoreos:${RONALD}`);
    expect(EVENTO_MONITOREO_ASIGNADO).toBe("monitoreo_asignado");
  });
});

describe("debeNotificarAsignacion", () => {
  it("al crear (sin operario anterior) siempre avisa", () => {
    expect(debeNotificarAsignacion(null, RONALD)).toBe(true);
  });

  it("al reasignar a otro operario avisa al nuevo", () => {
    expect(debeNotificarAsignacion(OTRO, RONALD)).toBe(true);
  });

  it("editar fecha o notas con el mismo operario no es una nueva asignación", () => {
    expect(debeNotificarAsignacion(RONALD, RONALD)).toBe(false);
  });
});

describe("construirAvisoMonitoreo", () => {
  it("nueva asignación: lote en el título, fecha legible y notas", () => {
    expect(construirAvisoMonitoreo(evento)).toEqual({
      titulo: "Nuevo monitoreo asignado · Lote L-04",
      cuerpo: "Inspección fitosanitaria programada para el 08/10/2026. Revisar flechas nuevas en el sector norte",
    });
  });

  it("reasignación y sin notas", () => {
    expect(construirAvisoMonitoreo({ ...evento, reasignado: true, notas: null })).toEqual({
      titulo: "Monitoreo reasignado a usted · Lote L-04",
      cuerpo: "Inspección fitosanitaria programada para el 08/10/2026",
    });
  });

  it("recorta notas largas", () => {
    const { cuerpo } = construirAvisoMonitoreo({ ...evento, notas: "n".repeat(300) });
    expect(cuerpo.endsWith("…")).toBe(true);
    expect(cuerpo.length).toBeLessThan(170);
  });
});

// ── Emisión del evento (Broadcast privado + Web Push) con fetch y web-push simulados ─────────
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn(), setVapidDetails: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

describe("notificarMonitoreoAsignado", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.VAPID_PRIVATE_KEY; // sin VAPID: solo se prueba el broadcast
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("emite el evento en el canal privado del operario vía REST con service role", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const { notificarMonitoreoAsignado } = await import("@/lib/push/enviar");
    const r = await notificarMonitoreoAsignado(RONALD, evento);
    expect(r.broadcast).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://proyecto.supabase.co/realtime/v1/api/broadcast");
    expect(init.headers).toMatchObject({ apikey: "service-role", Authorization: "Bearer service-role" });
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ topic: `monitoreos:${RONALD}`, event: "monitoreo_asignado", payload: evento, private: true }],
    });
    vi.unstubAllGlobals();
  });

  it("si Realtime falla no lanza (la asignación ya quedó guardada)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin red")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { notificarMonitoreoAsignado } = await import("@/lib/push/enviar");
    await expect(notificarMonitoreoAsignado(RONALD, evento)).resolves.toMatchObject({ broadcast: false });
    vi.unstubAllGlobals();
  });

  it("el push enlaza a los monitoreos del operario", () => {
    expect(RUTA_MONITOREOS_OPERARIO).toBe("/operario/sanidad/monitoreos-pendientes");
  });
});

// Regresión: la asignación de monitoreos sigue validando igual tras agregar la notificación.
describe("regresión: validación de asignación de monitoreos", () => {
  const base = { finca_id: FINCA, lote_id: LOTE, fecha_inspeccion: "2026-10-08", assigned_to: RONALD, notas: "x" };

  it("acepta una programación válida y exige operario asignado", () => {
    expect(crearMonitoreoProgramadoSchema.safeParse(base).success).toBe(true);
    expect(crearMonitoreoProgramadoSchema.safeParse({ ...base, assigned_to: undefined }).success).toBe(false);
    expect(crearMonitoreoProgramadoSchema.safeParse({ ...base, assigned_to: "no-uuid" }).success).toBe(false);
  });

  it("rechaza fechas con formato inválido", () => {
    expect(crearMonitoreoProgramadoSchema.safeParse({ ...base, fecha_inspeccion: "08/10/2026" }).success).toBe(false);
  });

  it("la reasignación (actualizar) exige id y operario", () => {
    expect(
      actualizarMonitoreoProgramadoSchema.safeParse({ ...base, id: "2bd6e51c-6532-4ee4-9041-57178e23a445", assigned_to: OTRO }).success
    ).toBe(true);
    expect(actualizarMonitoreoProgramadoSchema.safeParse(base).success).toBe(false);
  });
});
