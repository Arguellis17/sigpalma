/** Lógica pura de la notificación "te asignaron un monitoreo" (sin React ni Supabase). */

export const RUTA_MONITOREOS_OPERARIO = "/operario/sanidad/monitoreos-pendientes";

/** Datos del evento "monitoreo asignado" (notificación guardada + Web Push). */
export type MonitoreoAsignadoPayload = {
  monitoreoId: string;
  loteCodigo: string;
  /** yyyy-MM-dd */
  fechaInspeccion: string;
  notas: string | null;
  reasignado: boolean;
};

/**
 * ¿Hay que avisar? Al crear, siempre. Al editar, solo si cambió el operario asignado
 * (cambios de fecha o notas no son una nueva asignación).
 */
export function debeNotificarAsignacion(anterior: string | null, nuevo: string): boolean {
  return anterior !== nuevo;
}

function fechaLegible(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${d}/${m}/${y}` : ymd;
}

export function construirAvisoMonitoreo(p: MonitoreoAsignadoPayload): { titulo: string; cuerpo: string } {
  const notas = p.notas?.replace(/\s+/g, " ").trim();
  const notasCortas = notas && notas.length > 100 ? `${notas.slice(0, 99).trimEnd()}…` : notas;
  return {
    titulo: `${p.reasignado ? "Monitoreo reasignado a usted" : "Nuevo monitoreo asignado"} · Lote ${p.loteCodigo}`,
    cuerpo: [`Inspección fitosanitaria programada para el ${fechaLegible(p.fechaInspeccion)}`, notasCortas]
      .filter(Boolean)
      .join(". "),
  };
}
