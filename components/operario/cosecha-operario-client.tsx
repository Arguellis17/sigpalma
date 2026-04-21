"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import { anularCosecha } from "@/app/actions/cosecha";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { CosechaForm } from "@/components/campo/cosecha-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export type CosechaListRow = {
  id: string;
  fecha: string;
  peso_kg: string;
  conteo_racimos: number;
  madurez_frutos_caidos_min: number | null;
  madurez_frutos_caidos_max: number | null;
  observaciones_calidad: string | null;
  lote_codigo: string;
  area_ha: number;
  rendimiento_ton_ha: number;
  created_at: string;
};

type Finca = { id: string; nombre: string };

type Props = {
  initialRows: CosechaListRow[];
  fincas: Finca[];
  defaultFincaId: string | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CosechaOperarioClient({
  initialRows,
  fincas,
  defaultFincaId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useServerPropsState(initialRows);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [viewRow, setViewRow] = useState<CosechaListRow | null>(null);
  const [confirmAnular, setConfirmAnular] = useState<CosechaListRow | null>(null);
  const [pendingAnular, setPendingAnular] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = `${r.lote_codigo} ${r.observaciones_calidad ?? ""} ${r.fecha} ${r.id}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  function afterCreate() {
    setCreateOpen(false);
    toast("Cosecha registrada.", "success");
    router.refresh();
  }

  async function handleAnular() {
    if (!confirmAnular) return;
    setPendingAnular(true);
    const result = await anularCosecha({ id: confirmAnular.id });
    setPendingAnular(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== confirmAnular.id));
    setConfirmAnular(null);
    toast("Registro de cosecha anulado.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por lote, observaciones…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        <Button
          type="button"
          className="shrink-0 gap-1.5"
          onClick={() => {
            setCreateKey((k) => k + 1);
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nueva cosecha
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "No hay cosechas RFF registradas. Use «Nueva cosecha» para el primero."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Peso (kg)</th>
                  <th className="px-4 py-3">Racimos</th>
                  <th className="px-4 py-3">Rend. (t/ha)</th>
                  <th className="px-4 py-3">Registro</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      idx % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.fecha)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {Number(r.peso_kg).toLocaleString("es-CO", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.conteo_racimos}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {r.rendimiento_ton_ha.toLocaleString("es-CO", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setViewRow(r)}
                          aria-label="Ver detalle"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => setConfirmAnular(r)}
                          aria-label="Anular"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva cosecha RFF</DialogTitle>
            <DialogDescription>
              Registre peso y conteo; el rendimiento t/ha se calcula con el área del lote.
            </DialogDescription>
          </DialogHeader>
          <CosechaForm
            key={createKey}
            fincas={fincas}
            defaultFincaId={defaultFincaId}
            embedded
            onSuccess={afterCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de cosecha</DialogTitle>
            <DialogDescription>Información del registro RFF seleccionado.</DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Lote</dt>
                <dd className="mt-0.5 font-medium">{viewRow.lote_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Fecha</dt>
                <dd className="mt-0.5">{formatDate(viewRow.fecha)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Peso total</dt>
                <dd className="mt-0.5 tabular-nums">
                  {Number(viewRow.peso_kg).toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Racimos</dt>
                <dd className="mt-0.5 tabular-nums">{viewRow.conteo_racimos}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  Rendimiento (aprox.)
                </dt>
                <dd className="mt-0.5 tabular-nums">
                  {viewRow.rendimiento_ton_ha.toLocaleString("es-CO", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  t/ha
                </dd>
              </div>
              {(viewRow.madurez_frutos_caidos_min != null ||
                viewRow.madurez_frutos_caidos_max != null) && (
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">
                    Frutos caídos (min–max)
                  </dt>
                  <dd className="mt-0.5">
                    {viewRow.madurez_frutos_caidos_min ?? "—"} —{" "}
                    {viewRow.madurez_frutos_caidos_max ?? "—"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  Observaciones
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                  {viewRow.observaciones_calidad ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAnular} onOpenChange={(v) => !v && setConfirmAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular registro de cosecha</DialogTitle>
            <DialogDescription>
              El registro dejará de mostrarse en listados activos. No se elimina el historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmAnular(null)} disabled={pendingAnular}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleAnular} disabled={pendingAnular}>
              {pendingAnular ? "Anulando…" : "Anular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
