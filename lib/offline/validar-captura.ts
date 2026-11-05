/**
 * Validación al capturar: los mismos esquemas Zod del servidor corren en el dispositivo antes de guardar,
 * con o sin conexión, para corregir el dato mientras el trabajador sigue en el lote y no horas después.
 */
import type { ZodType } from "zod";
import { registrarCensoSanitarioSchema } from "@/lib/validations/censo-sanitario";
import { crearRemisionDespachoSchema } from "@/lib/validations/despacho";
import { crearEvaluacionViveroSchema } from "@/lib/validations/evaluacion-vivero";
import { registrarAplicacionFertilizacionSchema } from "@/lib/validations/fertilizacion";
import { crearRegistroGerminacionSchema } from "@/lib/validations/germinacion";
import { tomarHerramientaSchema } from "@/lib/validations/herramientas";
import { registrarLaborEjecutadaSchema } from "@/lib/validations/labor-ejecucion";
import { marcarMonitoreoCompletadoSchema } from "@/lib/validations/monitoreo-programado";
import {
  alertaFitosanitariaSchema,
  reporteEnfermedadSchema,
  reportePlagaSchema,
  reportarCosechaSchema,
} from "@/lib/validations/operativo";
import { registrarPreparacionTerrenoSchema } from "@/lib/validations/preparacion-terreno";
import { registrarAplicacionFitosanitariaSchema } from "@/lib/validations/sanidad";
import { registrarSiembraPlantulasSchema } from "@/lib/validations/siembra-plantulas";
import { registrarAnalisisSueloSchema } from "@/lib/validations/suelo";
import { TIPOS_CON_FOTOS, type TipoOperacion } from "./tipos";

const ESQUEMAS: Record<TipoOperacion, ZodType> = {
  alerta: alertaFitosanitariaSchema,
  reporte_plaga: reportePlagaSchema,
  reporte_enfermedad: reporteEnfermedadSchema,
  censo: registrarCensoSanitarioSchema,
  cosecha: reportarCosechaSchema,
  remision: crearRemisionDespachoSchema,
  fertilizacion: registrarAplicacionFertilizacionSchema,
  aplicacion_fitosanitaria: registrarAplicacionFitosanitariaSchema,
  germinacion: crearRegistroGerminacionSchema,
  preparacion_terreno: registrarPreparacionTerrenoSchema,
  siembra: registrarSiembraPlantulasSchema,
  labor_ejecutada: registrarLaborEjecutadaSchema,
  monitoreo_completado: marcarMonitoreoCompletadoSchema,
  tomar_herramienta: tomarHerramientaSchema,
  evaluacion_vivero: crearEvaluacionViveroSchema,
  analisis_suelo: registrarAnalisisSueloSchema,
};

/** El formulario de suelo envía texto (FormData); el servidor convierte estos campos a número. */
const NUMERICOS_SUELO = ["ph", "humedad_pct", "compactacion", "aluminio", "cic", "materia_organica_pct"];

/**
 * Devuelve el mensaje de error, o null si los datos son válidos.
 * `archivosSinSubir`: las fotos aún no tienen ruta; cuentan como evidencia para la validación.
 */
export function errorDeCaptura(
  tipo: TipoOperacion,
  payload: Record<string, unknown>,
  archivosSinSubir = 0
): string | null {
  let datos = payload;
  if (TIPOS_CON_FOTOS.includes(tipo)) {
    const rutas = Array.isArray(payload.evidencia_urls) ? (payload.evidencia_urls as string[]) : [];
    datos = { ...payload, evidencia_urls: [...rutas, ...Array.from({ length: archivosSinSubir }, (_, i) => `sin-subir-${i}`)] };
  }
  if (tipo === "analisis_suelo") {
    datos = { ...payload };
    for (const campo of NUMERICOS_SUELO) {
      const v = payload[campo];
      datos[campo] = v === "" || v == null ? null : Number(v);
    }
  }
  const r = ESQUEMAS[tipo].safeParse(datos);
  return r.success ? null : r.error.issues.map((i) => i.message).join("; ");
}
