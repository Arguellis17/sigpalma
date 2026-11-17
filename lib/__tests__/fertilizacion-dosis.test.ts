import { describe, expect, it } from "vitest";
import {
  calcularDesviacionPct,
  labelDosisUnidadPlan,
  mensajeDesviacionFertilizacion,
  requiereJustificacionDesviacion,
} from "@/lib/fertilizacion-dosis";

describe("fertilización: desviación de la dosis (RN63, CP-045)", () => {
  it("calcula el porcentaje respecto a la dosis programada", () => {
    expect(calcularDesviacionPct(3, 2)).toBe(50);
    expect(calcularDesviacionPct(1.8, 2)).toBe(10);
  });
  it("devuelve 0 con datos no válidos", () => {
    expect(calcularDesviacionPct(3, 0)).toBe(0);
    expect(calcularDesviacionPct(Number.NaN, 2)).toBe(0);
  });
  it("el límite exacto del 10 % no exige justificación; por encima, sí", () => {
    expect(requiereJustificacionDesviacion(2.2, 2)).toBe(false);
    expect(requiereJustificacionDesviacion(2.3, 2)).toBe(true);
  });
  it("3 kg sobre una dosis de 2 kg exige justificación (CP-045)", () => {
    expect(requiereJustificacionDesviacion(3, 2)).toBe(true);
  });
  it("exige justificación también cuando se aplica de menos", () => {
    expect(requiereJustificacionDesviacion(1, 2)).toBe(true);
  });
  it("el mensaje indica si fue superior o inferior", () => {
    expect(mensajeDesviacionFertilizacion(3, 2)).toMatch(/superior/);
    expect(mensajeDesviacionFertilizacion(1, 2)).toMatch(/inferior/);
    expect(mensajeDesviacionFertilizacion(2, 2)).toBeNull();
  });
  it("traduce la unidad del plan", () => {
    expect(labelDosisUnidadPlan("por_ha")).toBe("por hectárea");
    expect(labelDosisUnidadPlan("por_palma")).toBe("por palma");
    expect(labelDosisUnidadPlan("otra")).toBe("otra");
  });
});
