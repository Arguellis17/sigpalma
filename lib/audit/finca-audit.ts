import type { Json } from "@/lib/database.types";

export const FINCA_AUDIT_ACTION_KEYS = [
  "cosecha.registrar",
  "cosecha.anular",
  /** HU29: remisión de despacho de fruta. */
  "despacho.remision_crear",
  "plan_siembra.crear",
  "plan_siembra.actualizar",
  "plan_siembra.anular",
  "siembra.preparacion_terreno",
  "siembra.preparacion_validar",
  "siembra.registrar",
  "nutricion.plan_crear",
  "nutricion.plan_actualizar",
  "nutricion.plan_anular",
  "nutricion.aplicacion_fertilizacion",
  "mip.monitoreo_crear",
  "mip.monitoreo_actualizar",
  "mip.monitoreo_anular",
  "mip.monitoreo_completar",
  "vivero.germinacion_crear",
  "vivero.germinacion_actualizar",
  "vivero.evaluacion_crear",
  "vivero.evaluacion_anular",
  "labor.registrar",
  "labor.actualizar",
  "labor.anular",
  "labor.ejecutar",
  "alerta.crear",
  "sanidad.validar_alerta",
  "sanidad.cancelar_orden",
  "sanidad.aplicacion_fitosanitaria",
  "sanidad.censo_registrar",
  "suelo.registrar",
  "suelo.actualizar",
  "suelo.anular",
  "inventario.herramienta_crear",
  "inventario.herramienta_tomar",
  "inventario.herramienta_devolver",
  "inventario.herramienta_estado",
  /** HU17: consulta de trazabilidad técnica (solo lectura). */
  "trazabilidad.consulta",
  /** HU08: consulta de reporte de productividad RFF. */
  "reporte.productividad_consultar",
  /** HU09: exportación expediente RSPO. */
  "reporte.rspo_exportar",
  /** HU08: exportación reporte productividad (PDF/CSV). */
  "reporte.productividad_exportar",
  /** HU05/06/07: cambios en catálogo maestro. */
  "catalogo.crear",
  "catalogo.actualizar",
  "catalogo.inactivar",
] as const;

export type FincaAuditActionKey = (typeof FINCA_AUDIT_ACTION_KEYS)[number];

export type FincaAuditEventListRow = {
  id: string;
  created_at: string;
  action_key: string;
  titulo: string;
  detalle: Json;
  actor_id: string;
  actor_full_name: string | null;
};
