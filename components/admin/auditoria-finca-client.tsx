"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FincaAuditEventListRow } from "@/lib/audit/finca-audit";
import {
  AUDIT_PAGE_SIZES,
  type AuditPageSize,
  type AuditSortKey,
  type AuditoriaListQuery,
  auditoriaListToQueryString,
  nextSortToggle,
} from "@/lib/audit/audit-list-query";
import { sanitizeIlikeFragment } from "@/lib/list-query";
import { SortableTableHead } from "@/components/data/sortable-table-head";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  fechaAplicacion: "Fecha de la aplicación",
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
    label:
      DETALLE_LABELS[key] ??
      key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    value: formatValue(value),
  }));
}

type FincaOption = { id: string; nombre: string };

type Props = {
  rows: FincaAuditEventListRow[];
  total: number;
  query: AuditoriaListQuery;
  fincaId: string;
  fincas?: FincaOption[];
};

export function AuditoriaFincaClient({
  rows,
  total,
  query,
  fincaId,
  fincas,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<FincaAuditEventListRow | null>(null);
  const [draftQ, setDraftQ] = useState(query.q);

  useEffect(() => {
    setDraftQ(query.q);
  }, [query.q]);

  function pushQueryString(qs: string) {
    startTransition(() => {
      router.push(`${pathname}?${qs}`);
    });
  }

  function patchListQuery(
    patch: Partial<AuditoriaListQuery> & { fincaId?: string }
  ) {
    const next: AuditoriaListQuery = {
      page: patch.page ?? query.page,
      pageSize: (patch.pageSize ?? query.pageSize) as AuditPageSize,
      sort: patch.sort ?? query.sort,
      dir: patch.dir ?? query.dir,
      q: patch.q !== undefined ? sanitizeIlikeFragment(patch.q) : query.q,
    };
    const fincaForUrl =
      patch.fincaId !== undefined
        ? patch.fincaId
        : fincas && fincas.length > 0
          ? fincaId
          : undefined;
    pushQueryString(
      auditoriaListToQueryString(
        next,
        fincaForUrl ? { fincaId: fincaForUrl } : undefined
      )
    );
  }

  function onSortToggle(columnId: AuditSortKey) {
    const { sort, dir } = nextSortToggle(query.sort, query.dir, columnId);
    patchListQuery({ sort, dir, page: 1 });
  }

  function loadFinca(nextId: string) {
    const next: AuditoriaListQuery = {
      ...query,
      page: 1,
    };
    pushQueryString(
      auditoriaListToQueryString(next, { fincaId: nextId })
    );
  }

  function applySearch() {
    const safe = sanitizeIlikeFragment(draftQ);
    patchListQuery({ q: safe, page: 1 });
  }

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize) || 1);
  const from =
    total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);

  const emptyMessage =
    query.q.length > 0
      ? "No hay eventos que coincidan con la búsqueda."
      : "No hay actividad registrada para esta finca todavía.";

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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
          <Label htmlFor="audit-q" className="text-xs font-medium text-muted-foreground">
            Buscar en título
          </Label>
          <div className="flex gap-2">
            <Input
              id="audit-q"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Texto del evento…"
              className="rounded-xl"
              disabled={pending}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 rounded-xl"
              disabled={pending}
              onClick={applySearch}
            >
              Buscar
            </Button>
          </div>
        </div>
        <div className="w-full max-w-[11rem] space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Por página
          </span>
          <Select
            value={String(query.pageSize)}
            onValueChange={(v) =>
              patchListQuery({ pageSize: Number(v) as AuditPageSize, page: 1 })
            }
            disabled={pending}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIT_PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} filas
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pending ? (
        <p className="text-sm text-muted-foreground">Cargando eventos…</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <SortableTableHead
                  columnId="created_at"
                  label="Fecha y hora"
                  activeSort={query.sort}
                  dir={query.dir}
                  onToggle={onSortToggle}
                />
                <SortableTableHead
                  columnId="actor_id"
                  label="Quién"
                  activeSort={query.sort}
                  dir={query.dir}
                  onToggle={onSortToggle}
                />
                <SortableTableHead
                  columnId="titulo"
                  label="Acción"
                  activeSort={query.sort}
                  dir={query.dir}
                  onToggle={onSortToggle}
                />
                <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Detalle
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-border/40">
                  <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums text-foreground">
                    {new Date(r.created_at).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-foreground">
                    {r.actor_full_name?.trim() || "Usuario del sistema"}
                  </TableCell>
                  <TableCell className="max-w-[min(24rem,55vw)] truncate px-4 py-3 text-foreground">
                    {r.titulo}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => setDetail(r)}
                    >
                      Ver todo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando{" "}
              <span className="font-medium tabular-nums text-foreground">
                {from}–{to}
              </span>{" "}
              de <span className="font-medium tabular-nums text-foreground">{total}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pending || query.page <= 1}
                onClick={() => patchListQuery({ page: query.page - 1 })}
              >
                Anterior
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Página {query.page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={pending || query.page >= totalPages}
                onClick={() => patchListQuery({ page: query.page + 1 })}
              >
                Siguiente
              </Button>
            </div>
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
