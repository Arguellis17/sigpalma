"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Droplets,
  Sprout,
  ShieldAlert,
  Tractor,
  Wheat,
  Info,
  ExternalLink,
  Layers,
  FileDown,
  Thermometer,
} from "lucide-react";
import Link from "next/link";

import { getTrazabilidadTecnicaLote } from "@/app/actions/trazabilidad-lote";
import { obtenerUrlDescargaAnalisisSuelo } from "@/app/actions/suelo";
import type {
  TimelineEvent,
  TimelineEventCategory,
  TrazabilidadTecnicaLotePayload,
} from "@/lib/trazabilidad/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const IDLE = "__idle__";

const CATEGORY_LABEL: Record<TimelineEventCategory, string> = {
  material_plan: "Genética / plan siembra",
  vivero: "Vivero",
  labor: "Labores",
  nutricion: "Nutrición y riego",
  sanidad: "Sanidad",
  suelo: "Suelo",
  cosecha: "Cosecha",
};

function categoryIcon(cat: TimelineEventCategory) {
  switch (cat) {
    case "material_plan":
      return Sprout;
    case "vivero":
      return Thermometer;
    case "labor":
      return Tractor;
    case "nutricion":
      return Droplets;
    case "sanidad":
      return ShieldAlert;
    case "suelo":
      return Layers;
    case "cosecha":
      return Wheat;
    default:
      return Sprout;
  }
}

function formatDisplayDate(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const d = new Date(`${ymd}T12:00:00`);
  return format(d, "d MMM yyyy", { locale: es });
}

type Props = {
  lotes: { id: string; codigo: string }[];
  initialLoteId: string | null;
  initialData: TrazabilidadTecnicaLotePayload | null;
  initialError: string | null;
};

export function TrazabilidadLoteClient({
  lotes,
  initialLoteId,
  initialData,
  initialError,
}: Props) {
  const [loteId, setLoteId] = useState(initialLoteId ?? "");
  const [data, setData] = useState<TrazabilidadTecnicaLotePayload | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [filter, setFilter] = useState<TimelineEventCategory | "todas">("todas");
  const [detail, setDetail] = useState<TimelineEvent | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const ev = data?.eventos ?? [];
    if (filter === "todas") return ev;
    return ev.filter((e) => e.category === filter);
  }, [data?.eventos, filter]);

  function loadLote(id: string) {
    if (!id) return;
    startTransition(async () => {
      setError(null);
      const res = await getTrazabilidadTecnicaLote(id);
      if (!res.success) {
        setData(null);
        setError(res.error);
        return;
      }
      setData(res.data);
    });
  }

  function onLoteChange(value: string) {
    if (value === IDLE) return;
    setLoteId(value);
    loadLote(value);
  }

  return (
    <div className="space-y-8">
      <div className="surface-panel rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Label htmlFor="traz-lote">Lote</Label>
            <Select
              value={loteId || IDLE}
              onValueChange={onLoteChange}
              disabled={lotes.length === 0 || pending}
            >
              <SelectTrigger id="traz-lote" className="w-full min-w-[14rem] rounded-2xl lg:max-w-md">
                <SelectValue placeholder="Seleccione un lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={IDLE} disabled>
                  Seleccione…
                </SelectItem>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vista solo lectura (RN03). Las líneas de nutrición reflejan{" "}
              <strong>programación</strong> del plan; la ejecución en campo puede registrarse como
              labor o módulos operativos.
            </p>
          </div>
          <Button variant="outline" asChild className="rounded-2xl shrink-0">
            <Link href="/tecnico/agenda">
              Agenda de labores
              <ExternalLink className="ml-2 size-4 opacity-70" />
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <ResumenPanel data={data} />

          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "todas"} onClick={() => setFilter("todas")}>
              Todas ({data.eventos.length})
            </FilterChip>
            {(Object.keys(CATEGORY_LABEL) as TimelineEventCategory[]).map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {CATEGORY_LABEL[c]} ({data.resumen.conteoPorCategoria[c]})
              </FilterChip>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="surface-panel rounded-[1.5rem] p-6 text-sm text-muted-foreground">
              No se registran actividades operativas para este lote en las fuentes integradas, o el
              filtro actual no devuelve eventos.
            </p>
          ) : (
            <ol className="relative space-y-0 border-s border-border/80 ps-6 ms-3">
              {filtered.map((ev) => {
                const Icon = categoryIcon(ev.category);
                return (
                  <li key={ev.id} className="pb-8 last:pb-0">
                    <span className="absolute -start-[0.6rem] mt-1 flex size-5 items-center justify-center rounded-full border border-border bg-background text-primary">
                      <Icon className="size-3" />
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetail(ev)}
                      className="w-full rounded-2xl border border-transparent px-3 py-2 text-left transition hover:border-border hover:bg-muted/40"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-foreground">{ev.title}</span>
                        <time
                          className="text-xs font-medium text-muted-foreground tabular-nums"
                          dateTime={ev.displayDate}
                        >
                          {formatDisplayDate(ev.displayDate)}
                        </time>
                      </div>
                      {ev.subtitle ? (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {ev.subtitle}
                        </p>
                      ) : null}
                      <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABEL[ev.category]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : !error && lotes.length === 0 ? (
        <p className="surface-panel rounded-[1.5rem] p-6 text-sm text-muted-foreground">
          No hay lotes registrados en su finca.
        </p>
      ) : null}

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail ? (
            detail.category === "suelo" ? (
              <SueloEventDetail event={detail} />
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Fecha: <strong>{formatDisplayDate(detail.displayDate)}</strong>
                </p>
                <dl className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                  {Object.entries(detail.metadata).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="mt-0.5 break-words text-foreground">
                        {typeof v === "object" && v !== null
                          ? JSON.stringify(v, null, 2)
                          : String(v ?? "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SueloEventDetail({ event }: { event: TimelineEvent }) {
  const m = event.metadata;
  const analisisId = typeof m.analisisId === "string" ? m.analisisId : null;
  const tieneArchivo = m.tieneArchivo === true;
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function openPdf() {
    if (!analisisId) return;
    setPdfPending(true);
    setPdfError(null);
    const res = await obtenerUrlDescargaAnalisisSuelo(analisisId);
    setPdfPending(false);
    if (!res.success) {
      setPdfError(res.error);
      return;
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  const rows: { label: string; value: string | null }[] = [
    { label: "pH", value: m.ph != null ? String(m.ph) : null },
    { label: "Humedad (%)", value: m.humedadPct != null ? String(m.humedadPct) : null },
    { label: "Compactación", value: (m.compactacion as string) ?? null },
    { label: "Fertilidad", value: (m.fertilidadCompleta as string) ?? null },
    { label: "Textura", value: (m.textura as string) ?? null },
    { label: "Aluminio", value: m.aluminio != null ? String(m.aluminio) : null },
    { label: "CIC", value: m.cic != null ? String(m.cic) : null },
    {
      label: "Materia orgánica (%)",
      value: m.materiaOrganicaPct != null ? String(m.materiaOrganicaPct) : null,
    },
    { label: "Drenaje en campo", value: (m.drenajeCampo as string) ?? null },
    { label: "Notas", value: (m.notas as string) ?? null },
  ].filter((r) => r.value != null && r.value !== "");

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Fecha análisis: <strong>{formatDisplayDate(event.displayDate)}</strong>
      </p>
      <dl className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {r.label}
            </dt>
            <dd className="mt-0.5 text-foreground">{r.value}</dd>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Sin parámetros registrados en el análisis.</p>
        ) : null}
      </dl>
      {tieneArchivo && analisisId ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            disabled={pdfPending}
            onClick={() => void openPdf()}
          >
            <FileDown className="mr-2 size-4" />
            {pdfPending ? "Generando enlace…" : "Ver informe PDF"}
          </Button>
          {pdfError ? <p className="text-xs text-destructive">{pdfError}</p> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sin archivo PDF adjunto.</p>
      )}
      <Button variant="ghost" size="sm" className="rounded-xl" asChild>
        <Link href="/tecnico/suelo">Ir a análisis de suelo</Link>
      </Button>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/80 bg-background text-muted-foreground hover:border-border"
      )}
    >
      {children}
    </button>
  );
}

function ResumenPanel({ data }: { data: TrazabilidadTecnicaLotePayload }) {
  const { lote, resumen } = data;
  const vsFinca =
    resumen.ultimaCosecha &&
    resumen.rendimientoPromedioFinca !== null &&
    resumen.rendimientoPromedioFinca > 0
      ? resumen.ultimaCosecha.rendimientoTonHa - resumen.rendimientoPromedioFinca
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="surface-panel rounded-[1.5rem] p-5 lg:col-span-1">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Lote {lote.codigo}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Estado cultivo: <strong>{lote.estado_cultivo}</strong>
              {lote.activo ? "" : " · Inactivo (gestión)"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Material en ficha:{" "}
              <strong className="text-foreground">
                {resumen.materialDeclarado ?? "—"}
              </strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Área: {lote.area_ha} ha · Siembra (año): {lote.anio_siembra}
            </p>
          </div>
        </div>
      </div>

      <div className="surface-panel rounded-[1.5rem] p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-foreground">Diagnóstico productivo (resumen)</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            Registros de cosecha en el lote:{" "}
            <strong className="text-foreground">{resumen.cosechasEnLote}</strong>
          </li>
          {resumen.ultimaCosecha ? (
            <li>
              Última cosecha ({resumen.ultimaCosecha.fecha}):{" "}
              <strong className="text-foreground">
                {resumen.ultimaCosecha.rendimientoTonHa} t/ha
              </strong>
              {resumen.rendimientoPromedioFinca !== null ? (
                <>
                  {" "}
                  · Promedio finca (últimos registros consultados):{" "}
                  <strong className="text-foreground">
                    {resumen.rendimientoPromedioFinca} t/ha
                  </strong>
                  {vsFinca !== null && Math.abs(vsFinca) >= 0.01 ? (
                    <span className="block mt-1 text-xs">
                      Diferencia vs promedio finca:{" "}
                      <strong
                        className={
                          vsFinca < 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700"
                        }
                      >
                        {vsFinca > 0 ? "+" : ""}
                        {vsFinca.toFixed(2)} t/ha
                      </strong>
                    </span>
                  ) : null}
                </>
              ) : null}
            </li>
          ) : (
            <li>Sin registros de cosecha para este lote.</li>
          )}
          {resumen.tendenciaTexto ? (
            <li className="text-foreground/90">{resumen.tendenciaTexto}</li>
          ) : null}
          {resumen.ultimaAlertaFuerte ? (
            <li>
              Alerta reciente ({resumen.ultimaAlertaFuerte.severidad}):{" "}
              <strong className="text-foreground">{resumen.ultimaAlertaFuerte.title}</strong>
            </li>
          ) : (
            <li>Sin alertas fitosanitarias registradas para este lote.</li>
          )}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Use el filtro <strong>Labores</strong> en la línea de tiempo para revisar la densidad de
          registros y posibles omisiones relativas a periodos sin eventos.
        </p>
      </div>
    </div>
  );
}
