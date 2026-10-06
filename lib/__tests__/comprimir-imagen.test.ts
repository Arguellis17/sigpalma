import { describe, expect, it } from "vitest";
import {
  OBJETIVO_REDUCCION,
  PASOS_COMPRESION,
  buscarMejorCompresion,
  dimensionesObjetivo,
  formatearBytes,
  resumenCompresion,
  type PasoCompresion,
} from "@/lib/imagenes/comprimir-imagen";

/** Codificador falso: devuelve tamaños predefinidos por paso y registra los pasos usados. */
function codificadorFalso(tamanos: number[]) {
  const usados: PasoCompresion[] = [];
  const codificar = async (paso: PasoCompresion) => {
    usados.push(paso);
    return new Blob([new Uint8Array(tamanos[usados.length - 1])]);
  };
  return { codificar, usados };
}

describe("dimensionesObjetivo", () => {
  it("reduce el lado mayor a maxLado conservando proporción", () => {
    expect(dimensionesObjetivo(4000, 3000, 1920)).toEqual({ ancho: 1920, alto: 1440 });
    expect(dimensionesObjetivo(3000, 4000, 1920)).toEqual({ ancho: 1440, alto: 1920 });
  });

  it("nunca agranda imágenes pequeñas", () => {
    expect(dimensionesObjetivo(800, 600, 1920)).toEqual({ ancho: 800, alto: 600 });
  });
});

describe("buscarMejorCompresion", () => {
  const MB = 1024 * 1024;

  it("se queda con el primer paso (máxima calidad) si ya logra ≥60 %", async () => {
    const { codificar, usados } = codificadorFalso([0.5 * MB]);
    const r = await buscarMejorCompresion(4 * MB, codificar);
    expect(usados).toEqual([PASOS_COMPRESION[0]]);
    expect(r?.blob.size).toBe(0.5 * MB);
    expect(1 - r!.blob.size / (4 * MB)).toBeGreaterThanOrEqual(OBJETIVO_REDUCCION);
  });

  it("baja calidad/tamaño escalonadamente hasta cumplir el objetivo", async () => {
    const { codificar, usados } = codificadorFalso([2 * MB, 1.8 * MB, 1.5 * MB]);
    const r = await buscarMejorCompresion(4 * MB, codificar);
    expect(usados).toHaveLength(3);
    expect(r?.paso).toEqual(PASOS_COMPRESION[2]);
    expect(r!.blob.size).toBeLessThanOrEqual(4 * MB * (1 - OBJETIVO_REDUCCION));
  });

  it("foto ya optimizada: usa el resultado más pequeño si al menos reduce algo", async () => {
    const { codificar } = codificadorFalso([90_000, 80_000, 70_000, 75_000]);
    const r = await buscarMejorCompresion(100_000, codificar);
    expect(r?.blob.size).toBe(70_000);
  });

  it("si comprimir haría el archivo más grande, conserva el original (null)", async () => {
    const { codificar } = codificadorFalso([120_000, 110_000, 105_000, 101_000]);
    expect(await buscarMejorCompresion(100_000, codificar)).toBeNull();
  });

  it("la escalera nunca baja de 1280 px ni de calidad 0.68 (evidencia legible)", () => {
    expect(Math.min(...PASOS_COMPRESION.map((p) => p.maxLado))).toBeGreaterThanOrEqual(1280);
    expect(Math.min(...PASOS_COMPRESION.map((p) => p.calidad))).toBeGreaterThanOrEqual(0.68);
  });
});

describe("formato", () => {
  it("formatea bytes en B / KB / MB", () => {
    expect(formatearBytes(500)).toBe("500 B");
    expect(formatearBytes(420 * 1024)).toBe("420 KB");
    expect(formatearBytes(3.2 * 1024 * 1024)).toBe("3,2 MB");
  });

  it("resume la compresión para el usuario", () => {
    const archivo = new File([new Uint8Array(10)], "x.webp");
    expect(
      resumenCompresion({ archivo, bytesOriginal: 4 * 1024 * 1024, bytesFinal: 512 * 1024, reduccion: 0.875, comprimido: true })
    ).toBe("4 MB → 512 KB (−88 %)");
    expect(
      resumenCompresion({ archivo, bytesOriginal: 2048, bytesFinal: 2048, reduccion: 0, comprimido: false })
    ).toBe("2 KB (sin cambios)");
  });
});
