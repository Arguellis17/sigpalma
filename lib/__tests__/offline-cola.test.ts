import { describe, expect, it } from "vitest";
import {
  clasificarErrorAccion,
  esOperacionRepetida,
  metaOffline,
  PREFIJO_CONFLICTO,
  textoError,
} from "@/lib/offline/meta";
import {
  aplicarRespuesta,
  contarPendientes,
  debeLimpiarse,
  esperaReintento,
  porEnviar,
  respuestaSinCuerpo,
  RETENCION_SINCRONIZADAS_MS,
  type Operacion,
} from "@/lib/offline/reglas";

import { errorDeCaptura } from "@/lib/offline/validar-captura";

const UUID = "3f2b8c1e-5a4d-4e6f-9b1a-7c8d9e0f1a2b";

function op(parcial: Partial<Operacion> = {}): Operacion {
  return {
    opId: UUID,
    userId: "u1",
    tipo: "cosecha",
    resumen: "",
    payload: {},
    archivos: [],
    capturadoEn: "2026-11-05T10:00:00.000Z",
    creadoEn: 1000,
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    ultimoError: null,
    sincronizadoEn: null,
    ...parcial,
  };
}

describe("cola offline: orden y filtro", () => {
  it("envía en orden de captura y solo las del usuario en sesión", () => {
    const ops = [
      op({ opId: "b", creadoEn: 2 }),
      op({ opId: "otro", userId: "u2", creadoEn: 0 }),
      op({ opId: "a", creadoEn: 1 }),
    ];
    expect(porEnviar(ops, "u1", 10).map((o) => o.opId)).toEqual(["a", "b"]);
  });

  it("no reenvía conflictos, rechazados ni sincronizados", () => {
    const ops = [op({ estado: "conflicto" }), op({ estado: "rechazado" }), op({ estado: "sincronizado" })];
    expect(porEnviar(ops, "u1", 10)).toEqual([]);
  });

  it("respeta la espera del reintento y reintenta la sesión expirada", () => {
    expect(porEnviar([op({ estado: "error", proximoIntento: 100 })], "u1", 99)).toHaveLength(0);
    expect(porEnviar([op({ estado: "error", proximoIntento: 100 })], "u1", 100)).toHaveLength(1);
    expect(porEnviar([op({ estado: "sesion" })], "u1", 0)).toHaveLength(1);
  });

  it("el contador incluye lo que falta revisar pero no lo sincronizado ni a otros usuarios", () => {
    const ops = [op(), op({ estado: "conflicto" }), op({ estado: "sincronizado" }), op({ userId: "u2" })];
    expect(contarPendientes(ops, "u1")).toBe(2);
  });
});

describe("cola offline: reintentos", () => {
  it("espera exponencial con tope de 5 minutos", () => {
    expect(esperaReintento(1, 0.5)).toBe(2000);
    expect(esperaReintento(2, 0.5)).toBe(4000);
    expect(esperaReintento(3, 0.5)).toBe(8000);
    expect(esperaReintento(50, 0.5)).toBe(300000);
  });

  it("la variación queda en ±20 %", () => {
    expect(esperaReintento(1, 0)).toBe(1600);
    expect(esperaReintento(1, 1)).toBe(2400);
  });
});

describe("cola offline: respuesta del servidor", () => {
  it("ok: sincronizada y libera las fotos del dispositivo", () => {
    const blob = new Blob(["x"]);
    const r = aplicarRespuesta(op({ archivos: [{ nombre: "a.webp", tipo: "image/webp", blob }] }), { estado: "ok", data: {} }, 50);
    expect(r.estado).toBe("sincronizado");
    expect(r.sincronizadoEn).toBe(50);
    expect(r.archivos).toEqual([]);
  });

  it("sin red o falla temporal: conserva la operación y programa reintento", () => {
    const sinRed = aplicarRespuesta(op(), null, 1000);
    expect(sinRed.estado).toBe("error");
    expect(sinRed.intentos).toBe(1);
    expect(sinRed.proximoIntento).toBeGreaterThan(1000);
    expect(aplicarRespuesta(op(), { estado: "reintentar", motivo: "x" }, 0).estado).toBe("error");
  });

  it("conflicto, rechazo y sesión guardan el motivo y conservan las fotos", () => {
    const blob = new Blob(["x"]);
    const base = op({ archivos: [{ nombre: "a.webp", tipo: "image/webp", blob }] });
    for (const estado of ["conflicto", "rechazado", "sesion"] as const) {
      const r = aplicarRespuesta(base, { estado, motivo: "m" }, 0);
      expect(r.estado).toBe(estado);
      expect(r.ultimoError).toBe("m");
      expect(r.archivos).toHaveLength(1);
    }
  });

  it("respuestas cortadas por un proxy: 413 no se reintenta, 5xx sí", () => {
    expect(respuestaSinCuerpo(413)?.estado).toBe("rechazado");
    expect(respuestaSinCuerpo(404)?.estado).toBe("rechazado");
    expect(respuestaSinCuerpo(502)?.estado).toBe("reintentar");
    expect(respuestaSinCuerpo(200)).toBeNull();
  });

  it("las sincronizadas se limpian pasado un día; lo pendiente nunca", () => {
    const hecha = op({ estado: "sincronizado", sincronizadoEn: 0 });
    expect(debeLimpiarse(hecha, RETENCION_SINCRONIZADAS_MS)).toBe(false);
    expect(debeLimpiarse(hecha, RETENCION_SINCRONIZADAS_MS + 1)).toBe(true);
    expect(debeLimpiarse(op(), RETENCION_SINCRONIZADAS_MS * 10)).toBe(false);
  });
});

describe("metadatos offline", () => {
  it("lee id y hora de captura de un objeto o FormData", () => {
    const iso = "2026-11-05T10:00:00.000Z";
    expect(metaOffline({ client_op_id: UUID, capturado_en: iso, otro: 1 })).toEqual({ client_op_id: UUID, capturado_en: iso });
    const fd = new FormData();
    fd.set("client_op_id", UUID);
    fd.set("capturado_en", iso);
    expect(metaOffline(fd)).toEqual({ client_op_id: UUID, capturado_en: iso });
  });

  it("los guardados normales (sin metadatos) quedan en null", () => {
    expect(metaOffline({ peso_kg: 10 })).toEqual({ client_op_id: null, capturado_en: null });
    expect(metaOffline(new FormData())).toEqual({ client_op_id: null, capturado_en: null });
  });

  it("descarta un id mal formado", () => {
    expect(metaOffline({ client_op_id: "no-uuid" }).client_op_id).toBeNull();
  });
});

describe("validación al capturar (mismos esquemas del servidor)", () => {
  const censo = { finca_id: UUID, lote_id: UUID, catalogo_item_id: UUID, fecha_censo: "2026-11-05", palmas_inspeccionadas: 10, palmas_afectadas: 1 };
  const plaga = { finca_id: UUID, lote_id: UUID, catalogo_item_id: UUID, severidad: "media", evidencia_urls: [] };

  it("acepta datos válidos y rechaza los inválidos con el mensaje del esquema", () => {
    expect(errorDeCaptura("censo", censo)).toBeNull();
    expect(errorDeCaptura("censo", { ...censo, palmas_afectadas: 50 })).toMatch(/no pueden superar/);
  });

  it("exige GPS en cosecha", () => {
    const c = { finca_id: UUID, lote_id: UUID, fecha: "2026-11-05", peso_kg: 10, conteo_racimos: 1 };
    expect(errorDeCaptura("cosecha", c)).not.toBeNull();
    expect(errorDeCaptura("cosecha", { ...c, latitud: 7, longitud: -72 })).toBeNull();
  });

  it("las fotos aún sin subir cuentan como evidencia", () => {
    expect(errorDeCaptura("reporte_plaga", plaga, 0)).toMatch(/foto/i);
    expect(errorDeCaptura("reporte_plaga", plaga, 2)).toBeNull();
    expect(errorDeCaptura("reporte_plaga", { ...plaga, evidencia_urls: ["fincas/a/b.png"] }, 0)).toBeNull();
    expect(errorDeCaptura("reporte_plaga", plaga, 9)).not.toBeNull();
  });

  it("análisis de suelo: convierte el texto del formulario como el servidor", () => {
    const s = { finca_id: UUID, lote_id: UUID, fecha_analisis: "2026-11-05", ph: "5.5" };
    expect(errorDeCaptura("analisis_suelo", s)).toBeNull();
    expect(errorDeCaptura("analisis_suelo", { ...s, ph: "20" })).toMatch(/pH/);
    expect(errorDeCaptura("analisis_suelo", { ...s, ph: "" })).toMatch(/al menos un valor/);
  });
});

describe("clasificación de errores de las acciones", () => {
  it("conflicto: no se reintenta y el motivo se muestra sin el prefijo", () => {
    expect(clasificarErrorAccion(`${PREFIJO_CONFLICTO}Ya la tomó otro.`)).toEqual({ estado: "conflicto", motivo: "Ya la tomó otro." });
    expect(textoError(`${PREFIJO_CONFLICTO}x`)).toBe("x");
  });

  it("sesión vencida conserva la operación", () => {
    expect(clasificarErrorAccion("Sesión no válida. Inicie sesión nuevamente.").estado).toBe("sesion");
    expect(clasificarErrorAccion("Sesión no encontrada.").estado).toBe("sesion");
  });

  it("fallas de red hacia Supabase se reintentan", () => {
    for (const m of ["TypeError: fetch failed", "connect ECONNREFUSED", "upstream connect error", "Request timed out", "Error 503"]) {
      expect(clasificarErrorAccion(m).estado).toBe("reintentar");
    }
  });

  it("reglas de negocio y validación se rechazan", () => {
    expect(clasificarErrorAccion("La finca no coincide con su asignación.").estado).toBe("rechazado");
    expect(clasificarErrorAccion("El peso debe ser mayor que cero.").estado).toBe("rechazado");
  });

  it("reconoce el índice único de idempotencia", () => {
    expect(esOperacionRepetida('duplicate key value violates unique constraint "cosechas_rff_client_op_id_uq"')).toBe(true);
    expect(esOperacionRepetida('duplicate key value violates unique constraint "otra_uq"')).toBe(false);
  });
});
