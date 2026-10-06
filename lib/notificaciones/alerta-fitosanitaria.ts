/** Lógica pura de las notificaciones en tiempo real de alertas fitosanitarias (sin React ni Supabase). */

export type Severidad = "baja" | "media" | "alta" | "critica";

/** Fila que entrega Realtime en el INSERT de `alertas_fitosanitarias`. */
export type AlertaInsertada = {
  id: string;
  finca_id: string;
  lote_id: string;
  severidad: Severidad;
  descripcion: string | null;
  created_by: string;
  is_voided: boolean;
};

export type DetalleAlerta = {
  loteCodigo: string | null;
  plaga: string | null;
};

export type NotificacionAlerta = {
  id: string;
  titulo: string;
  cuerpo: string;
  severidad: Severidad;
  /** Alta y crítica piden interacción (no se ocultan solas en el sistema operativo). */
  urgente: boolean;
};

export const RUTA_VALIDACION = "/tecnico/sanidad/validacion";

const SEVERIDAD_LABEL: Record<Severidad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

/** No notifica alertas anuladas, de otra finca ni las que creó el propio técnico. */
export function debeNotificar(alerta: AlertaInsertada, usuarioId: string, fincaId: string): boolean {
  return !alerta.is_voided && alerta.finca_id === fincaId && alerta.created_by !== usuarioId;
}

function recortar(texto: string, max: number): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function construirNotificacion(alerta: AlertaInsertada, detalle: DetalleAlerta): NotificacionAlerta {
  const lote = detalle.loteCodigo ? `Lote ${detalle.loteCodigo}` : "Nuevo reporte";
  const problema = detalle.plaga ?? "Problema fitosanitario";
  const partes = [`${problema} · severidad ${SEVERIDAD_LABEL[alerta.severidad].toLowerCase()}`];
  if (alerta.descripcion?.trim()) partes.push(recortar(alerta.descripcion, 120));
  return {
    id: alerta.id,
    titulo: `${alerta.severidad === "critica" ? "⚠ " : ""}Alerta fitosanitaria · ${lote}`,
    cuerpo: partes.join(". "),
    severidad: alerta.severidad,
    urgente: alerta.severidad === "alta" || alerta.severidad === "critica",
  };
}

export function etiquetaSeveridad(s: Severidad): string {
  return SEVERIDAD_LABEL[s];
}
