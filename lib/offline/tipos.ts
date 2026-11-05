/**
 * Operaciones de campo que se pueden capturar sin conexión. La lista es compartida entre la cola del
 * dispositivo (lib/offline/cola.ts) y el endpoint estable de sincronización (app/api/v1/sync).
 */
export const OPERACIONES_OFFLINE = {
  alerta: "Alerta fitosanitaria",
  reporte_plaga: "Reporte de plaga",
  reporte_enfermedad: "Reporte de enfermedad",
  censo: "Censo sanitario",
  cosecha: "Registro de cosecha",
  remision: "Remisión de despacho",
  fertilizacion: "Aplicación de fertilizante",
  aplicacion_fitosanitaria: "Aplicación fitosanitaria",
  germinacion: "Registro de germinación",
  preparacion_terreno: "Preparación de terreno",
  siembra: "Siembra de plántulas",
  labor_ejecutada: "Labor ejecutada",
  monitoreo_completado: "Monitoreo completado",
  tomar_herramienta: "Toma de herramienta",
  evaluacion_vivero: "Evaluación de vivero",
  analisis_suelo: "Análisis de suelo",
} as const;

export type TipoOperacion = keyof typeof OPERACIONES_OFFLINE;

export const TIPOS_OPERACION = Object.keys(OPERACIONES_OFFLINE) as [TipoOperacion, ...TipoOperacion[]];

/**
 * Operaciones con fotos: cada foto se sube en su propia petición (los proveedores limitan el tamaño
 * de cada solicitud) y su ruta se guarda en la operación, así un reintento no la vuelve a subir.
 */
export const TIPOS_CON_FOTOS: readonly TipoOperacion[] = ["alerta", "reporte_plaga", "reporte_enfermedad", "evaluacion_vivero"];

/** Respuesta del endpoint de sincronización. */
export type RespuestaSync =
  | { estado: "ok"; data: unknown }
  /** Otro usuario llegó primero (herramienta tomada, cosechas ya despachadas…): no se reintenta. */
  | { estado: "conflicto"; motivo: string }
  /** Datos inválidos o regla de negocio: no se reintenta; el usuario revisa o descarta. */
  | { estado: "rechazado"; motivo: string }
  /** Sin sesión: se conserva hasta que el usuario vuelva a iniciar sesión. */
  | { estado: "sesion"; motivo: string }
  /** Falla temporal (red, base de datos): se reintenta con espera creciente. */
  | { estado: "reintentar"; motivo: string };
