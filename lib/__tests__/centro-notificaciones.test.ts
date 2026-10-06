import { beforeEach, describe, expect, it, vi } from "vitest";
import { etiquetaContador, tiempoRelativo } from "@/lib/notificaciones/centro";

describe("tiempoRelativo", () => {
  const ahora = new Date("2026-10-06T15:00:00Z");
  const hace = (seg: number) => new Date(ahora.getTime() - seg * 1000).toISOString();

  it("formatea en español según la antigüedad", () => {
    expect(tiempoRelativo(hace(20), ahora)).toBe("ahora");
    expect(tiempoRelativo(hace(5 * 60), ahora)).toBe("hace 5 min");
    expect(tiempoRelativo(hace(3 * 3600), ahora)).toBe("hace 3 h");
    expect(tiempoRelativo(hace(30 * 3600), ahora)).toBe("ayer");
    expect(tiempoRelativo(hace(4 * 86400), ahora)).toBe("hace 4 días");
    expect(tiempoRelativo("2026-09-01T15:00:00Z", ahora)).toBe("01/09/2026");
  });

  it("fechas futuras (relojes desfasados) se muestran como 'ahora'", () => {
    expect(tiempoRelativo(hace(-120), ahora)).toBe("ahora");
  });
});

describe("etiquetaContador", () => {
  it("oculta el contador en cero y lo limita a 99+", () => {
    expect(etiquetaContador(0)).toBeNull();
    expect(etiquetaContador(7)).toBe("7");
    expect(etiquetaContador(150)).toBe("99+");
  });
});

// ── Registro de notificaciones en el servidor (cliente admin simulado) ───────────────────────
const insertados: { tabla: string; filas: unknown[] }[] = [];
let alerta: Record<string, unknown> | null = null;
let tecnicos: { id: string }[] = [];
const filtrosProfiles: [string, string, unknown][] = [];

function cadena(resultado: unknown, registrar?: (m: string, col: string, val: unknown) => void) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "in", "order", "limit", "is"]) {
    c[m] = (col: string, val: unknown) => {
      registrar?.(m, col, val);
      return c;
    };
  }
  c.maybeSingle = async () => resultado;
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(resultado).then(res, rej);
  return c;
}

vi.mock("web-push", () => ({ default: { sendNotification: vi.fn(), setVapidDetails: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabla: string) => ({
      insert: async (filas: unknown[]) => {
        insertados.push({ tabla, filas });
        return { error: null };
      },
      select: () => {
        if (tabla === "alertas_fitosanitarias") return cadena({ data: alerta, error: null });
        if (tabla === "profiles") return cadena({ data: tecnicos, error: null }, (m, col, val) => filtrosProfiles.push([m, col, val]));
        return cadena({ data: [], error: null });
      },
    }),
  }),
}));

const RONALD = "f6701d42-446f-48af-9b5a-8b4dff53bb2f";
const OMAR = "c9466f2a-3f9d-469b-a193-37383606f3df";
const OTRO_TECNICO = "b53338d1-4174-4e24-a5d8-aa53d95a00a4";

describe("notificaciones guardadas en la bandeja", () => {
  beforeEach(() => {
    vi.resetModules();
    insertados.length = 0;
    filtrosProfiles.length = 0;
    delete process.env.VAPID_PRIVATE_KEY; // sin VAPID: solo se prueba la bandeja
    vi.spyOn(console, "warn").mockImplementation(() => {});
    alerta = {
      id: "a1",
      finca_id: "f1",
      lote_id: "l1",
      severidad: "critica",
      descripcion: "Pudrición en la base",
      created_by: RONALD,
      is_voided: false,
      lotes: { codigo: "L-04" },
      catalogo_items: { nombre: "Marchitez letal" },
    };
    tecnicos = [{ id: OMAR }, { id: OTRO_TECNICO }];
  });

  it("monitoreo asignado: una notificación para el operario con enlace a sus monitoreos", async () => {
    const { notificarMonitoreoAsignado } = await import("@/lib/push/enviar");
    const r = await notificarMonitoreoAsignado(RONALD, {
      monitoreoId: "m1",
      loteCodigo: "L-TEST-A",
      fechaInspeccion: "2026-10-08",
      notas: null,
      reasignado: true,
    });
    expect(r.registradas).toBe(1);
    expect(insertados).toEqual([
      {
        tabla: "notificaciones",
        filas: [
          {
            user_id: RONALD,
            tipo: "monitoreo_asignado",
            titulo: "Monitoreo reasignado a usted · Lote L-TEST-A",
            cuerpo: "Inspección fitosanitaria programada para el 08/10/2026",
            url: "/operario/sanidad/monitoreos-pendientes",
            referencia_id: "m1",
          },
        ],
      },
    ]);
  });

  it("alerta fitosanitaria: una notificación por técnico activo de la finca, sin incluir al autor", async () => {
    const { notificarAlertaFitosanitaria } = await import("@/lib/push/enviar");
    const r = await notificarAlertaFitosanitaria("a1");
    expect(r.registradas).toBe(2);
    expect(filtrosProfiles).toEqual(
      expect.arrayContaining([
        ["eq", "finca_id", "f1"],
        ["eq", "role", "agronomo"],
        ["eq", "is_active", true],
        ["neq", "id", RONALD],
      ])
    );
    const filas = insertados[0].filas as Record<string, unknown>[];
    expect(filas.map((f) => f.user_id)).toEqual([OMAR, OTRO_TECNICO]);
    expect(filas[0]).toMatchObject({
      tipo: "alerta_fitosanitaria",
      titulo: "⚠ Alerta fitosanitaria · Lote L-04",
      url: "/tecnico/sanidad/validacion",
      referencia_id: "a1",
      severidad: "critica",
    });
  });

  it("alerta anulada: no notifica a nadie", async () => {
    alerta = { ...alerta!, is_voided: true };
    const { notificarAlertaFitosanitaria } = await import("@/lib/push/enviar");
    expect((await notificarAlertaFitosanitaria("a1")).registradas).toBe(0);
    expect(insertados).toEqual([]);
  });
});
