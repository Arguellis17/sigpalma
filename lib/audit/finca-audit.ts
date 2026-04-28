import type { Json } from "@/lib/database.types";

export const FINCA_AUDIT_ACTION_KEYS = [
  "cosecha.registrar",
  "cosecha.anular",
  "plan_siembra.crear",
  "plan_siembra.actualizar",
  "plan_siembra.anular",
  "labor.registrar",
  "labor.actualizar",
  "labor.anular",
  "alerta.crear",
  "sanidad.validar_alerta",
  "sanidad.cancelar_orden",
  "sanidad.aplicacion_fitosanitaria",
  "suelo.registrar",
  "suelo.actualizar",
  "suelo.anular",
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
