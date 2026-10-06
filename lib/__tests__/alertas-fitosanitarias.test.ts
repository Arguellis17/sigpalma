import { describe, expect, it } from "vitest";
import {
  RUTA_VALIDACION,
  construirNotificacion,
  debeNotificar,
  type AlertaInsertada,
} from "@/lib/notificaciones/alerta-fitosanitaria";
import {
  alertaFitosanitariaSchema,
  reporteEnfermedadSchema,
  reportePlagaSchema,
} from "@/lib/validations/operativo";

const FINCA = "d4e96ae4-05af-40da-8868-2fb8509dc4ae";
const LOTE = "5de0fe48-860d-486d-9faa-c209adafb80a";
const OPERARIO = "f6701d42-446f-48af-9b5a-8b4dff53bb2f";
const TECNICO = "c9466f2a-3f9d-469b-a193-37383606f3df";
const PLAGA = "11111111-2222-4333-8444-555555555555";

const alerta = (over: Partial<AlertaInsertada> = {}): AlertaInsertada => ({
  id: "a1",
  finca_id: FINCA,
  lote_id: LOTE,
  severidad: "alta",
  descripcion: "Hojas con manchas amarillas en la corona",
  created_by: OPERARIO,
  is_voided: false,
  ...over,
});

describe("debeNotificar", () => {
  it("notifica al técnico cuando un operario de su finca reporta", () => {
    expect(debeNotificar(alerta(), TECNICO, FINCA)).toBe(true);
  });

  it("no notifica las alertas que crea el propio técnico", () => {
    expect(debeNotificar(alerta({ created_by: TECNICO }), TECNICO, FINCA)).toBe(false);
  });

  it("no notifica alertas anuladas ni de otra finca", () => {
    expect(debeNotificar(alerta({ is_voided: true }), TECNICO, FINCA)).toBe(false);
    expect(debeNotificar(alerta({ finca_id: "00000000-0000-4000-8000-000000000000" }), TECNICO, FINCA)).toBe(false);
  });
});

describe("construirNotificacion", () => {
  it("arma título con el lote y cuerpo con plaga, severidad y descripción", () => {
    const n = construirNotificacion(alerta(), { loteCodigo: "L-04", plaga: "Ácaros" });
    expect(n).toEqual({
      id: "a1",
      titulo: "Alerta fitosanitaria · Lote L-04",
      cuerpo: "Ácaros · severidad alta. Hojas con manchas amarillas en la corona",
      severidad: "alta",
      urgente: true,
    });
  });

  it("marca la severidad crítica en el título", () => {
    const n = construirNotificacion(alerta({ severidad: "critica" }), { loteCodigo: "L-04", plaga: null });
    expect(n.titulo).toBe("⚠ Alerta fitosanitaria · Lote L-04");
    expect(n.cuerpo).toContain("Problema fitosanitario · severidad crítica");
    expect(n.urgente).toBe(true);
  });

  it("baja y media no son urgentes; sin lote ni descripción usa textos genéricos", () => {
    const n = construirNotificacion(alerta({ severidad: "media", descripcion: null }), { loteCodigo: null, plaga: null });
    expect(n.titulo).toBe("Alerta fitosanitaria · Nuevo reporte");
    expect(n.cuerpo).toBe("Problema fitosanitario · severidad media");
    expect(n.urgente).toBe(false);
  });

  it("recorta descripciones largas para que quepan en la notificación del sistema", () => {
    const n = construirNotificacion(alerta({ descripcion: "x".repeat(400) }), { loteCodigo: "L-04", plaga: "Ácaros" });
    expect(n.cuerpo.length).toBeLessThan(170);
    expect(n.cuerpo.endsWith("…")).toBe(true);
  });

  it("lleva a la bandeja de validación del técnico", () => {
    expect(RUTA_VALIDACION).toBe("/tecnico/sanidad/validacion");
  });
});

// Regresión: el flujo de reporte fitosanitario sigue validando igual tras agregar las notificaciones.
describe("regresión: validación de reportes fitosanitarios", () => {
  const base = {
    finca_id: FINCA,
    lote_id: LOTE,
    severidad: "alta" as const,
    descripcion: "Mancha anular",
    evidencia_urls: [`fincas/${FINCA}/alertas-fitosanitarias/foto.webp`],
  };

  it("acepta un reporte válido con evidencia WebP y source web por defecto", () => {
    const r = alertaFitosanitariaSchema.parse(base);
    expect(r.source).toBe("web");
    expect(r.evidencia_urls).toHaveLength(1);
  });

  it("exige al menos una foto y como máximo 8", () => {
    expect(alertaFitosanitariaSchema.safeParse({ ...base, evidencia_urls: [] }).success).toBe(false);
    expect(alertaFitosanitariaSchema.safeParse({ ...base, evidencia_urls: Array(9).fill("a/b.webp") }).success).toBe(false);
  });

  it("rechaza severidades fuera del catálogo", () => {
    expect(alertaFitosanitariaSchema.safeParse({ ...base, severidad: "extrema" }).success).toBe(false);
  });

  it("plaga y enfermedad exigen ítem de catálogo", () => {
    expect(reportePlagaSchema.safeParse(base).success).toBe(false);
    expect(reporteEnfermedadSchema.safeParse(base).success).toBe(false);
    expect(reportePlagaSchema.safeParse({ ...base, catalogo_item_id: PLAGA }).success).toBe(true);
    expect(reporteEnfermedadSchema.safeParse({ ...base, catalogo_item_id: PLAGA }).success).toBe(true);
  });
});
