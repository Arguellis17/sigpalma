import { describe, expect, it } from "vitest";
import {
  calcularIncidenciaPct,
  estimarTotalPalmasLote,
  labelIncidenciaPct,
  superaUmbralIncidencia,
} from "@/lib/censo-sanitario";
import { validarCantidadPalmasSiembra } from "@/lib/siembra-plantulas";

describe("censo sanitario: incidencia (RN, CP-048)", () => {
  it("100 palmas con 5 afectadas dan 5 %", () => {
    expect(calcularIncidenciaPct(100, 5)).toBe(5);
  });
  it("redondea a dos decimales", () => {
    expect(calcularIncidenciaPct(3, 1)).toBe(33.33);
  });
  it("sin palmas inspeccionadas devuelve 0", () => {
    expect(calcularIncidenciaPct(0, 5)).toBe(0);
  });
  it("el umbral del 10 % se alcanza con 10 % exacto", () => {
    expect(superaUmbralIncidencia(9.99)).toBe(false);
    expect(superaUmbralIncidencia(10)).toBe(true);
  });
  it("da formato legible al porcentaje", () => {
    expect(labelIncidenciaPct(5)).toBe("5%");
    expect(labelIncidenciaPct(12.5)).toBe("12.5%");
  });
});

describe("censo sanitario: total de palmas del lote (CP-049)", () => {
  it("estima área por densidad", () => {
    expect(estimarTotalPalmasLote(2, 143)).toBe(286);
    expect(estimarTotalPalmasLote("1.5", "143")).toBe(215);
  });
  it("devuelve null sin área o densidad válidas", () => {
    expect(estimarTotalPalmasLote(null, 143)).toBeNull();
    expect(estimarTotalPalmasLote(2, 0)).toBeNull();
    expect(estimarTotalPalmasLote(-1, 143)).toBeNull();
    expect(estimarTotalPalmasLote("x", 143)).toBeNull();
  });
});

describe("siembra: cantidad de palmas permitida", () => {
  const lote = { area_ha: 1, densidad_palmas_ha: 143 };
  it("acepta hasta la densidad del lote", () => {
    expect(validarCantidadPalmasSiembra(143, lote)).toBeNull();
  });
  it("rechaza lo que supera el máximo", () => {
    expect(validarCantidadPalmasSiembra(144, lote)).toMatch(/supera el máximo/);
  });
  it("rechaza cantidades no válidas", () => {
    expect(validarCantidadPalmasSiembra(0, lote)).toMatch(/mayor a cero/);
    expect(validarCantidadPalmasSiembra(Number.NaN, lote)).toMatch(/mayor a cero/);
  });
  it("pide área y densidad si faltan", () => {
    expect(validarCantidadPalmasSiembra(10, { area_ha: null, densidad_palmas_ha: 143 })).toMatch(/área y densidad/);
  });
});
