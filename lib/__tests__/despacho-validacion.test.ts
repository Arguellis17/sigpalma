import { describe, expect, it } from "vitest";
import {
  advertenciaSobrecarga,
  calcularTotalesRemision,
  generarNumeroRemision,
  normalizarPlaca,
  validarMismaFechaCosechas,
  validarPlacaVehiculo,
} from "@/lib/despacho-validacion";

const c = (id: string, fecha: string, peso_kg: number, conteo_racimos: number) => ({ id, fecha, peso_kg, conteo_racimos });

describe("despacho: placa del vehículo (RN84)", () => {
  it("normaliza espacios y guiones y pasa a mayúsculas", () => {
    expect(normalizarPlaca(" abc-123 ")).toBe("ABC123");
  });
  it("acepta los formatos colombianos habituales", () => {
    expect(validarPlacaVehiculo("ABC123")).toEqual({ ok: true, placa: "ABC123" });
    expect(validarPlacaVehiculo("abc 12d")).toEqual({ ok: true, placa: "ABC12D" });
  });
  it("rechaza placas demasiado cortas o largas", () => {
    expect(validarPlacaVehiculo("AB12").ok).toBe(false);
    expect(validarPlacaVehiculo("ABCDEFGHI").ok).toBe(false);
  });
  it("rechaza formatos que no son de placa", () => {
    const r = validarPlacaVehiculo("123ABC");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Formato de placa/);
  });
});

describe("despacho: cosechas de una remisión (RN83, CP-056)", () => {
  it("exige al menos una cosecha", () => {
    const r = validarMismaFechaCosechas([]);
    expect(r.ok).toBe(false);
  });
  it("acepta cosechas del mismo día", () => {
    expect(validarMismaFechaCosechas([c("1", "2026-11-05", 10, 1), c("2", "2026-11-05", 20, 2)])).toEqual({ ok: true, fecha: "2026-11-05" });
  });
  it("rechaza cosechas de días distintos", () => {
    const r = validarMismaFechaCosechas([c("1", "2026-11-05", 10, 1), c("2", "2026-11-06", 20, 2)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/mismo día/);
  });
});

describe("despacho: totales y sobrecarga", () => {
  it("suma peso y racimos de varios lotes", () => {
    expect(calcularTotalesRemision([c("1", "d", 3000, 100), c("2", "d", 4500.5, 150), c("3", "d", 2499.5, 50)])).toEqual({ peso_total_kg: 10000, total_racimos: 300 });
  });
  it("redondea el peso a gramos", () => {
    expect(calcularTotalesRemision([c("1", "d", 0.1, 1), c("2", "d", 0.2, 1)]).peso_total_kg).toBe(0.3);
  });
  it("avisa cuando el peso supera la capacidad del vehículo", () => {
    expect(advertenciaSobrecarga(10000, 8000)).toMatch(/supera la capacidad/);
  });
  it("no avisa si cabe o si no hay capacidad válida", () => {
    expect(advertenciaSobrecarga(8000, 8000)).toBeNull();
    expect(advertenciaSobrecarga(8000, null)).toBeNull();
    expect(advertenciaSobrecarga(8000, 0)).toBeNull();
    expect(advertenciaSobrecarga(8000, Number.NaN)).toBeNull();
  });
});

describe("despacho: número de remisión único", () => {
  it("combina finca, año y consecutivo", () => {
    expect(generarNumeroRemision("d4e96ae4-05af-40da-8868-2fb8509dc4ae", 2026, 2)).toBe("REM-D4E96A-2026-0003");
  });
  it("los consecutivos no se repiten", () => {
    const a = generarNumeroRemision("d4e96ae4-05af", 2026, 0);
    const b = generarNumeroRemision("d4e96ae4-05af", 2026, 1);
    expect(a).not.toBe(b);
  });
});
