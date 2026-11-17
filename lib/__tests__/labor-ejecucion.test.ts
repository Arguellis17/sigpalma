import { describe, expect, it } from "vitest";
import { formatCantidadLabor, labelUnidadMedidaLabor } from "@/lib/labor-ejecucion";

/** Formato anterior (con expresión regular); el actual debe dar exactamente lo mismo. */
function formatoAnterior(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

describe("labores: formato de la cantidad ejecutada", () => {
  it("coincide con el formato anterior en una muestra amplia", () => {
    const muestras = [0, 1, 5, 10, 100, 1000, 0.5, 0.05, 0.001, 0.004, 0.005, 1.5, 2.25, 10.001, 10.1, 12.50, 100.5, 143.99, 999.999, 1234.5678, 50.0, 7.07];
    for (const n of muestras) {
      const unidad = "palmas";
      const esperado = `${formatoAnterior(n)} ${labelUnidadMedidaLabor(unidad).toLowerCase()}`;
      expect(formatCantidadLabor(n, unidad)).toBe(esperado);
    }
  });
  it("no deja ceros ni punto sobrantes", () => {
    expect(formatCantidadLabor(12.5, "palmas")).toMatch(/^12\.5 /);
    expect(formatCantidadLabor(10.001, "palmas")).toMatch(/^10 /);
    expect(formatCantidadLabor(3, "palmas")).toMatch(/^3 /);
  });
});
