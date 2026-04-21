"use client";

import { useMemo, useState, useTransition } from "react";
import { listarEventosAuditoriaFinca } from "@/app/actions/audit";
import type { FincaAuditEventListRow } from "@/lib/audit/finca-audit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Json } from "@/lib/database.types";

const DETALLE_LABELS: Record<string, string> = {
  registroId: "Identificador del registro",
  analisisId: "Identificador del análisis",
  alertaId: "Identificador de la alerta",
  ordenId: "Identificador de la orden",
  ordenCreadaId: "Orden de control creada",
  aplicacionId: "Identificador de la aplicación",
  loteCodigo: "Código de lote",
  fecha: "Fecha",
  fechaAnalisis: "Fecha del análisis",
  fechaEjecucion: "Fecha de ejecución",
  fechaAplicacion: "Fecha de aplicación",
  pesoKg: "Peso (kg)",
  racimos: "Cantidad de racimos",
  rendimientoTonHa: "Rendimiento (t/ha)",
  observacionesCalidad: "Observaciones de calidad",
  tipoLabor: "Tipo de labor",
  notas: "Notas",
  severidad: "Severidad reportada",
  amenaza: "Amenaza / catálogo",
  descripcion: "Descripción",
  loteEnEstadoAlerta: "Lote marcado en alerta crítica",
  decision: "Decisión técnica",
  diagnostico: "Diagnóstico del técnico",
  insumoNombre: "Producto / insumo",
  cantidad: "Cantidad aplicada",
  unidad: "Unidad",
  eppConfirmado: "Uso de EPP confirmado",
  coordenadas: "Coordenadas GPS",
  ph: "pH",
  humedadPct: "Humedad (%)",
  compactacion: "Compactación",
  tieneAdjuntoLaboratorio: "Adjunto PDF de laboratorio",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length ? v : "—";
  return JSON.stringify(v);
}

function detalleEntries(detalle: Json): { key: string; label: string; value: string }[] {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) {
    return [];
  }
  const o = detalle as Record<string, unknown>;
  return Object.entries(o).map(([key, value]) => ({
    key,
    label: DETALLE_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    value: formatValue(value),
  }));
}

type FincaOption = { id: string; nombre: string };

type Props = {
  initialEvents: FincaAuditEventListRow[];
  initialFincaId: string;
  /** Si se pasa, muestra selector de finca (superadmin). */
  fincas?: FincaOption[];
};

export function AuditoriaFincaClient({
  initialEvents,
  initialFincaId,
  fincas,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [fincaId, setFincaId] = useState(initialFincaId);
  const [detail, setDetail] = useState<FincaAuditEventListRow | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => events, [events]);

  function loadFinca(nextId: string) {
    setFincaId(nextId);
    startTransition(async () => {
      const res = await listarEventosAuditoriaFinca(nextId);
      if (res.success) {
        setEvents(res.data);
      } else {
        setEvents([]);
      }
    });
  }

  return (
    <div className="fade-up-enter space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Actividad en campo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro claro de lo que hacen agrónomos y operarios en su finca: fechas, lotes y
            detalles de cada acción.
          </p>
        </div>
        {fincas && fincas.length > 0 ? (
          <div className="w-full max-w-xs space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Finca</label>
            <Select
              value={fincaId}
              onValueChange={loadFinca}
              disabled={pending}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Elegir finca…" />
              </SelectTrigger>
              <SelectContent>
                {fincas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {pending ? (
        <p className="text-sm text-muted-foreground">Cargando eventos…</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
          No hay actividad registrada para esta finca todavía.
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Quién</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">
                      {new Date(r.created_at).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {r.actor_full_name?.trim() || "Usuario del sistema"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.titulo}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                        onClick={() => setDetail(r)}
                      >
                        Ver todo
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.titulo}</DialogTitle>
            <DialogDescription className="text-left text-xs sm:text-sm">
              {detail
                ? new Date(detail.created_at).toLocaleString("es-CO", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })
                : null}
              {detail ? (
                <>
                  <br />
                  <span className="text-muted-foreground">Realizado por: </span>
                  {detail.actor_full_name?.trim() || "Usuario del sistema"}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tipo interno
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-foreground/80">{detail.action_key}</dd>
              </div>
              {detalleEntries(detail.detalle).map(({ key, label, value }) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 break-words text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
