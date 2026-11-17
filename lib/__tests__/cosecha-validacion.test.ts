import { describe, expect, it } from "vitest";
import {
  edadCultivoAnios,
  esNombreLaborCosecha,
  filasIncluyenLaborCosechaPendiente,
  loteAptoParaCosecha,
  mensajePesoInusual,
  pesoEsInusual,
} from "@/lib/cosecha-validacion";

const loteBase = { activo: true, estado_cultivo: "en_produccion", anio_siembra: 2023 };

describe("cosecha: lote apto (RN78, CP-054 y CP-055)", () => {
  it("acepta un lote activo, en producción y con 3 años o más", () => {
    expect(loteAptoParaCosecha(loteBase, "2026-11-05")).toEqual({ ok: true });
  });

  it("el límite exacto de 3 años se acepta", () => {
    expect(loteAptoParaCosecha({ ...loteBase, anio_siembra: 2023 }, "2026-01-10")).toEqual({ ok: true });
  });

  it("rechaza un lote sembrado hace 1 año (etapa de levante, CP-055)", () => {
    const r = loteAptoParaCosecha({ ...loteBase, anio_siembra: 2025 }, "2026-11-05");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/levante/i);
  });

  it("rechaza con 2 años cumplidos (menos de 3)", () => {
    expect(loteAptoParaCosecha({ ...loteBase, anio_siembra: 2024 }, "2026-11-05").ok).toBe(false);
  });

  it("rechaza un lote inactivo", () => {
    const r = loteAptoParaCosecha({ ...loteBase, activo: false }, "2026-11-05");
    expect(r).toEqual({ ok: false, error: "El lote no está activo." });
  });

  it("rechaza un lote que no está en producción", () => {
    const r = loteAptoParaCosecha({ ...loteBase, estado_cultivo: "listo_para_siembra" }, "2026-11-05");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/en producción/);
  });

  it("rechaza un lote sin año de siembra", () => {
    const r = loteAptoParaCosecha({ ...loteBase, anio_siembra: null }, "2026-11-05");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/año de siembra/);
  });
});

describe("cosecha: edad del cultivo", () => {
  it("calcula la diferencia de años", () => {
    expect(edadCultivoAnios(2020, "2026-03-01")).toBe(6);
  });
  it("devuelve null si falta el año o la fecha no es válida", () => {
    expect(edadCultivoAnios(null, "2026-03-01")).toBeNull();
    expect(edadCultivoAnios(Number.NaN, "2026-03-01")).toBeNull();
    expect(edadCultivoAnios(2020, "fecha-mala")).toBeNull();
  });
});

describe("cosecha: peso inusual", () => {
  it("avisa solo cuando supera 1,2 veces el máximo histórico", () => {
    expect(pesoEsInusual(120, 100)).toBe(false);
    expect(pesoEsInusual(120.1, 100)).toBe(true);
  });
  it("no avisa sin historial", () => {
    expect(pesoEsInusual(5000, null)).toBe(false);
    expect(pesoEsInusual(5000, 0)).toBe(false);
  });
  it("el mensaje pide verificar la báscula", () => {
    expect(mensajePesoInusual(500, 100)).toMatch(/báscula/);
  });
});

describe("cosecha: reconocer la labor de cosecha", () => {
  it("reconoce nombres de cosecha sin importar mayúsculas ni espacios", () => {
    expect(esNombreLaborCosecha("  Cosecha RFF ")).toBe(true);
    expect(esNombreLaborCosecha("COSECHA")).toBe(true);
    expect(esNombreLaborCosecha("Cosecha RFF (lo cosechado)")).toBe(true);
  });
  it("no confunde otras labores", () => {
    expect(esNombreLaborCosecha("Poda")).toBe(false);
    expect(esNombreLaborCosecha("Riego")).toBe(false);
  });
  it("detecta si hay una labor de cosecha pendiente", () => {
    expect(filasIncluyenLaborCosechaPendiente([{ catalogo_items: { nombre: "Poda" } }, { catalogo_items: { nombre: "Cosecha RFF" } }])).toBe(true);
    expect(filasIncluyenLaborCosechaPendiente([{ catalogo_items: { nombre: "Poda" } }, { catalogo_items: null }])).toBe(false);
  });
});
