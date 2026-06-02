"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { consultarReporteProductividad } from "@/app/actions/reportes-productividad";
import type { ReporteProductividadPayload } from "@/app/actions/reportes-productividad";
import { getLotesPorFinca } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FincaOption = { id: string; nombre: string };

type Props = {
  fincas: FincaOption[];
  defaultFincaId: string;
  showFincaSelector?: boolean;
};

function monthStartYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function ReporteProductividadClient({
  fincas,
  defaultFincaId,
  showFincaSelector = false,
}: Props) {
  const router = useRouter();
  const [fincaId, setFincaId] = useState(defaultFincaId);
  const [fechaDesde, setFechaDesde] = useState(monthStartYmd);
  const [fechaHasta, setFechaHasta] = useState(() => todayLocalYmd());
  const [loteFilter, setLoteFilter] = useState<string>("__all__");
  const [lotes, setLotes] = useState<{ id: string; codigo: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporte, setReporte] = useState<ReporteProductividadPayload | null>(null);

  useEffect(() => {
    setFincaId(defaultFincaId);
  }, [defaultFincaId]);

  useEffect(() => {
    if (!fincaId) return;
    setReporte(null);
    let cancelled = false;
    void getLotesPorFinca(fincaId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setLotes(res.data);
        setLoteFilter("__all__");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fincaId]);

  function onFincaChange(nextId: string) {
    setFincaId(nextId);
    if (showFincaSelector) {
      router.replace(`/superadmin/reportes/productividad?finca=${nextId}`);
    }
  }

  const maxTonHa = useMemo(() => {
    if (!reporte?.filas.length) return 0;
    return Math.max(...reporte.filas.map((f) => f.ton_ha), 0);
  }, [reporte]);

  async function generarReporte() {
    setError(null);
    setPending(true);
    const res = await consultarReporteProductividad({
      finca_id: fincaId,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      lote_ids:
        loteFilter !== "__all__" ? [loteFilter] : undefined,
    });
    setPending(false);
    if (!res.success) {
      setError(res.error);
      setReporte(null);
      return;
    }
    setReporte(res.data);
  }

  function descargarCsv() {
    if (!reporte) return;
    const header = [
      "Lote",
      "Área (ha)",
      "Total (t)",
      "Racimos",
      "Registros",
      "Rendimiento (t/ha)",
    ];
    const lines = [
      header.join(";"),
      ...reporte.filas.map((f) =>
        [
          f.lote_codigo,
          f.area_ha,
          f.total_ton,
          f.total_racimos,
          f.registros,
          f.ton_ha,
        ].join(";")
      ),
      [
        "TOTAL",
        "",
        reporte.resumen.total_ton,
        reporte.resumen.total_racimos,
        reporte.resumen.total_registros,
        reporte.resumen.ton_ha_ponderado,
      ].join(";"),
    ];
    const csv = `\uFEFF${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productividad-${reporte.fecha_desde}_${reporte.fecha_hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function descargarPdf() {
    if (!reporte) return;
    const params = new URLSearchParams({
      finca_id: reporte.finca_id,
      fecha_desde: reporte.fecha_desde,
      fecha_hasta: reporte.fecha_hasta,
    });
    if (loteFilter !== "__all__") {
      params.set("lote_ids", loteFilter);
    }
    window.open(`/api/v1/reportes/productividad/pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="surface-panel grid gap-4 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        {showFincaSelector ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rp-finca">Finca</Label>
            <Select value={fincaId} onValueChange={onFincaChange}>
              <SelectTrigger id="rp-finca" className="min-h-11 rounded-xl">
                <SelectValue placeholder="Finca" />
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
        <div className="space-y-2">
          <Label htmlFor="rp-desde">Desde</Label>
          <DatePickerField
            id="rp-desde"
            value={fechaDesde}
            onChange={setFechaDesde}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rp-hasta">Hasta</Label>
          <DatePickerField
            id="rp-hasta"
            value={fechaHasta}
            onChange={setFechaHasta}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="rp-lote">Lote (opcional)</Label>
          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger id="rp-lote" className="min-h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los lotes</SelectItem>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={generarReporte}
            disabled={pending || !fincaId}
          >
            {pending ? "Generando…" : "Generar reporte"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {reporte ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-panel rounded-2xl p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Finca</p>
              <p className="mt-1 font-semibold">{reporte.finca_nombre}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reporte.fecha_desde} — {reporte.fecha_hasta}
              </p>
            </div>
            <div className="surface-panel rounded-2xl p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Total RFF</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {reporte.resumen.total_ton.toLocaleString("es-CO", { maximumFractionDigits: 2 })} t
              </p>
            </div>
            <div className="surface-panel rounded-2xl p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Promedio finca</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {reporte.resumen.ton_ha_ponderado.toLocaleString("es-CO", {
                  maximumFractionDigits: 3,
                })}{" "}
                t/ha
              </p>
            </div>
            <div className="surface-panel rounded-2xl p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Registros</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {reporte.resumen.total_registros}
              </p>
              <p className="text-xs text-muted-foreground">
                {reporte.resumen.total_racimos.toLocaleString("es-CO")} racimos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={descargarCsv}
            >
              Descargar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={descargarPdf}
            >
              Descargar PDF
            </Button>
          </div>

          {reporte.filas.length === 0 ? (
            <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
              No hay cosechas registradas en el periodo seleccionado.
            </div>
          ) : (
            <>
              <div className="surface-panel overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Lote</th>
                        <th className="px-4 py-3">Área (ha)</th>
                        <th className="px-4 py-3">Total (t)</th>
                        <th className="px-4 py-3">Racimos</th>
                        <th className="px-4 py-3">Registros</th>
                        <th className="px-4 py-3">Rendimiento (t/ha)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.filas.map((f, idx) => (
                        <tr
                          key={f.lote_id}
                          className={`border-b border-border/40 last:border-0 ${
                            idx % 2 !== 0 ? "bg-muted/15" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-medium">{f.lote_codigo}</td>
                          <td className="px-4 py-3 tabular-nums">{f.area_ha}</td>
                          <td className="px-4 py-3 tabular-nums">{f.total_ton}</td>
                          <td className="px-4 py-3 tabular-nums">{f.total_racimos}</td>
                          <td className="px-4 py-3 tabular-nums">{f.registros}</td>
                          <td className="px-4 py-3 font-medium tabular-nums text-primary">
                            {f.ton_ha.toLocaleString("es-CO", { maximumFractionDigits: 3 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="surface-panel rounded-2xl p-5">
                <h3 className="text-sm font-semibold">Rendimiento por lote (t/ha)</h3>
                <div className="mt-4 space-y-3">
                  {reporte.filas.map((f) => {
                    const pct = maxTonHa > 0 ? (f.ton_ha / maxTonHa) * 100 : 0;
                    return (
                      <div key={f.lote_id}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium">{f.lote_codigo}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {f.ton_ha.toLocaleString("es-CO", { maximumFractionDigits: 3 })} t/ha
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
