/**
 * Endpoint estable de sincronización de la cola offline (PU11).
 *
 * La cola del dispositivo NO reproduce server actions (sus IDs cambian entre despliegues); envía aquí
 * cada operación como multipart: campo `op` = JSON { opId, tipo, payload, capturadoEn } y los archivos
 * (fotos / PDF) en `archivos`. Se llaman las mismas acciones de `app/actions/*` con la sesión por cookies.
 *
 * Idempotencia: `opId` se guarda como `client_op_id` (índice único parcial). Un reintento de una
 * operación ya aplicada responde `ok` sin crear un segundo registro.
 */
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { ActionResult } from "@/app/actions/types";
import { crearAlertaFitosanitaria, crearReporteEnfermedad, crearReportePlaga, subirEvidenciaAlertaFitosanitaria } from "@/app/actions/alertas";
import { registrarCensoSanitario } from "@/app/actions/censo-sanitario";
import { reportarCosecha } from "@/app/actions/cosecha";
import { crearRemisionDespacho } from "@/app/actions/despacho";
import { registrarAplicacionFertilizacion } from "@/app/actions/fertilizacion";
import { registrarAplicacionFitosanitaria } from "@/app/actions/fitosanidad";
import { crearRegistroGerminacion } from "@/app/actions/germinacion";
import { registrarPreparacionTerreno } from "@/app/actions/preparacion-terreno";
import { registrarSiembraPlantulas } from "@/app/actions/siembra-plantulas";
import { registrarLaborEjecutada } from "@/app/actions/labores";
import { marcarMonitoreoCompletado } from "@/app/actions/monitoreo-programado";
import { tomarHerramienta } from "@/app/actions/herramientas";
import { crearEvaluacionVivero, subirEvidenciaEvaluacionVivero } from "@/app/actions/evaluacion-vivero";
import { registrarAnalisisSueloDesdeFormulario } from "@/app/actions/suelo";
import { clasificarErrorAccion, esOperacionRepetida } from "@/lib/offline/meta";
import { TIPOS_OPERACION, type RespuestaSync, type TipoOperacion } from "@/lib/offline/tipos";

type Payload = Record<string, unknown>;
type Tabla = keyof Database["public"]["Tables"];

type Operacion = {
  /** Tabla con `client_op_id`; las operaciones de cambio de estado son idempotentes en la propia acción. */
  tabla?: Tabla;
  ejecutar: (payload: Payload, archivos: File[]) => Promise<ActionResult<unknown>>;
};

/** Subida de una foto (fase `archivo`): las rutas quedan en `payload.evidencia_urls` de la operación. */
const SUBIR_FOTO: Partial<Record<TipoOperacion, (fd: FormData) => Promise<ActionResult<{ path: string }>>>> = {
  alerta: subirEvidenciaAlertaFitosanitaria,
  reporte_plaga: subirEvidenciaAlertaFitosanitaria,
  reporte_enfermedad: subirEvidenciaAlertaFitosanitaria,
  evaluacion_vivero: subirEvidenciaEvaluacionVivero,
};

const OPERACIONES: Record<TipoOperacion, Operacion> = {
  alerta: { tabla: "alertas_fitosanitarias", ejecutar: (p) => crearAlertaFitosanitaria(p) },
  reporte_plaga: { tabla: "alertas_fitosanitarias", ejecutar: (p) => crearReportePlaga(p) },
  reporte_enfermedad: { tabla: "alertas_fitosanitarias", ejecutar: (p) => crearReporteEnfermedad(p) },
  censo: { tabla: "censos_sanitarios", ejecutar: (p) => registrarCensoSanitario(p) },
  cosecha: { tabla: "cosechas_rff", ejecutar: (p) => reportarCosecha(p) },
  remision: { tabla: "remisiones_despacho", ejecutar: (p) => crearRemisionDespacho(p) },
  fertilizacion: { tabla: "aplicaciones_fertilizacion", ejecutar: (p) => registrarAplicacionFertilizacion(p) },
  aplicacion_fitosanitaria: { tabla: "aplicaciones_fitosanitarias", ejecutar: (p) => registrarAplicacionFitosanitaria(p) },
  germinacion: { tabla: "registros_germinacion", ejecutar: (p) => crearRegistroGerminacion(p) },
  preparacion_terreno: { tabla: "preparaciones_terreno", ejecutar: (p) => registrarPreparacionTerreno(p) },
  siembra: { tabla: "registros_siembra", ejecutar: (p) => registrarSiembraPlantulas(p) },
  labor_ejecutada: { tabla: "labores_agronomicas", ejecutar: (p) => registrarLaborEjecutada(p) },
  monitoreo_completado: { ejecutar: (p) => marcarMonitoreoCompletado(p) },
  tomar_herramienta: { ejecutar: (p) => tomarHerramienta(p) },
  evaluacion_vivero: { tabla: "evaluaciones_vivero", ejecutar: (p) => crearEvaluacionVivero(p) },
  analisis_suelo: {
    tabla: "analisis_suelo",
    ejecutar: (p, archivos) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(p)) if (v != null) fd.append(k, String(v));
      if (archivos[0]) fd.append("archivo", archivos[0]);
      return registrarAnalisisSueloDesdeFormulario(fd);
    },
  },
};

const opSchema = z.object({
  opId: z.uuid(),
  tipo: z.enum(TIPOS_OPERACION),
  payload: z.record(z.string(), z.unknown()),
  capturadoEn: z.iso.datetime({ offset: true }),
});

const HTTP: Record<RespuestaSync["estado"], number> = {
  ok: 200,
  conflicto: 409,
  rechazado: 422,
  sesion: 401,
  reintentar: 503,
};

function responder(r: RespuestaSync) {
  return Response.json(r, { status: HTTP[r.estado], headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return responder({ estado: "sesion", motivo: "Inicie sesión para sincronizar." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return responder({ estado: "rechazado", motivo: "Solicitud de sincronización mal formada." });
  }
  let crudo: unknown;
  try {
    crudo = JSON.parse(String(form.get("op") ?? ""));
  } catch {
    crudo = null;
  }
  const parsed = opSchema.safeParse(crudo);
  if (!parsed.success) {
    return responder({ estado: "rechazado", motivo: "Operación de sincronización no válida." });
  }
  const { opId, tipo, payload, capturadoEn } = parsed.data;
  const operacion = OPERACIONES[tipo];

  const yaAplicada = async () => {
    if (!operacion.tabla) return null;
    const { data } = await supabase
      .from(operacion.tabla)
      .select("id")
      .eq("client_op_id" as never, opId)
      .maybeSingle();
    return (data as { id: string } | null) ?? null;
  };

  const previa = await yaAplicada();
  if (previa) return responder({ estado: "ok", data: { id: previa.id, repetida: true } });

  const archivos = form.getAll("archivos").filter((a): a is File => a instanceof File && a.size > 0);

  let res: ActionResult<unknown>;
  try {
    if (form.get("fase") === "archivo") {
      const subir = SUBIR_FOTO[tipo];
      if (!subir || !archivos[0]) {
        return responder({ estado: "rechazado", motivo: "Esta operación no admite fotos." });
      }
      const fd = new FormData();
      fd.append("finca_id", String(payload.finca_id ?? ""));
      fd.append("archivo", archivos[0]);
      const up = await subir(fd);
      if (!up.success) return responder(clasificarErrorAccion(up.error));
      return responder({ estado: "ok", data: { ruta: up.data.path } });
    }
    res = await operacion.ejecutar({ ...payload, client_op_id: opId, capturado_en: capturadoEn }, archivos);
  } catch (e) {
    console.error("[sync]", tipo, e);
    return responder({ estado: "reintentar", motivo: "Error temporal del servidor." });
  }

  if (res.success) return responder({ estado: "ok", data: res.data });
  // Carrera entre dos reintentos simultáneos: el índice único rechazó el segundo → ya está aplicada.
  if (esOperacionRepetida(res.error)) {
    const fila = await yaAplicada();
    return responder({ estado: "ok", data: { id: fila?.id ?? null, repetida: true } });
  }
  return responder(clasificarErrorAccion(res.error));
}
