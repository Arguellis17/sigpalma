"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { anularAnalisisSuelo } from "@/app/actions/suelo";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  AnalisisSueloForm,
  type AnalisisSueloFormRecord,
} from "./nuevo/analisis-suelo-form";

export type AnalisisSueloListRow = {
  id: string;
  finca_id: string;
  lote_id: string;
  fecha_analisis: string;
  ph: string | null;
  humedad_pct: string | null;
  compactacion: string | null;
  notas: string | null;
  created_at: string;
  fincas: { nombre?: string } | null;
  lotes: { codigo?: string } | null;
};

type Finca = { id: string; nombre: string };
type Lote = { id: string; codigo: string };

type Props = {
  initialRows: AnalisisSueloListRow[];
  fincas: Finca[];
  lotesPorFinca: Record<string, Lote[]>;
};

function parseFormNumber(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToFormRecord(row: AnalisisSueloListRow): AnalisisSueloFormRecord {
  return {
    id: row.id,
    finca_id: row.finca_id,
    lote_id: row.lote_id,
    fecha_analisis: row.fecha_analisis,
    ph: parseFormNumber(row.ph),
    humedad_pct: parseFormNumber(row.humedad_pct),
    compactacion: parseFormNumber(row.compactacion),
    notas: row.notas,
  };
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Sheet = { type: "create" } | { type: "edit"; row: AnalisisSueloListRow } | null;

export function TecnicoSueloClient({ initialRows, fincas, lotesPorFinca }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useServerPropsState(initialRows);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirmAnular, setConfirmAnular] = useState<AnalisisSueloListRow | null>(null);
  const [pendingAnular, setPendingAnular] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const finca = (a.fincas as { nombre?: string } | null)?.nombre ?? "";
      const lote = (a.lotes as { codigo?: string } | null)?.codigo ?? "";
      const blob = `${finca} ${lote} ${a.notas ?? ""} ${a.id}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  function closeSheet() {
    setSheet(null);
  }

  function afterSave() {
    closeSheet();
    toast("Análisis guardado.", "success");
    router.refresh();
  }

  async function handleAnular() {
    if (!confirmAnular) return;
    setPendingAnular(true);
    const result = await anularAnalisisSuelo({ id: confirmAnular.id });
    setPendingAnular(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== confirmAnular.id));
    setConfirmAnular(null);
    toast("Análisis anulado.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por finca, lote, notas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        <Button
          type="button"
          className="shrink-0 gap-1.5"
          onClick={() => {
            setCreateFormKey((k) => k + 1);
            setSheet({ type: "create" });
          }}
        >
          <Plus className="size-4" />
          Nuevo análisis
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-16 text-center">
          <Layers className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "No hay análisis registrados. Crea el primero."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((a) => (
              <div key={a.id} className="surface-panel rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {(a.fincas as { nombre?: string } | null)?.nombre ?? "Finca"}
                      {a.lotes
                        ? ` · Lote ${(a.lotes as { codigo?: string } | null)?.codigo ?? ""}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Análisis: {formatDate(a.fecha_analisis)} · Registro:{" "}
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.ph != null ? (
                    <Badge variant="secondary" className="text-xs">
                      pH {a.ph}
                    </Badge>
                  ) : null}
                  {a.humedad_pct != null ? (
                    <Badge variant="secondary" className="text-xs">
                      Hum. {a.humedad_pct}%
                    </Badge>
                  ) : null}
                  {a.compactacion != null ? (
                    <Badge variant="secondary" className="text-xs">
                      Comp. {a.compactacion}
                    </Badge>
                  ) : null}
                </div>
                {a.notas ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.notas}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setSheet({ type: "edit", row: a })}
                  >
                    <Pencil className="mr-1 size-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => setConfirmAnular(a)}
                  >
                    <Trash2 className="mr-1 size-3" /> Anular
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="surface-panel hidden overflow-hidden rounded-2xl md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Finca</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Fecha análisis</th>
                    <th className="px-4 py-3">pH</th>
                    <th className="px-4 py-3">Humedad</th>
                    <th className="px-4 py-3">Compact.</th>
                    <th className="px-4 py-3">Notas</th>
                    <th className="px-4 py-3">Registro</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, idx) => (
                    <tr
                      key={a.id}
                      className={`border-b border-border/40 last:border-0 ${
                        idx % 2 !== 0 ? "bg-muted/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {(a.fincas as { nombre?: string } | null)?.nombre ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(a.lotes as { codigo?: string } | null)?.codigo ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(a.fecha_analisis)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.ph ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.humedad_pct != null ? `${a.humedad_pct}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.compactacion ?? "—"}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                        {a.notas ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setSheet({ type: "edit", row: a })}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => setConfirmAnular(a)}
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
        </>
      )}

      <Dialog open={sheet?.type === "create"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo análisis de suelo</DialogTitle>
            <DialogDescription>
              Registre los datos del muestreo. Puede cerrar con Cancelar sin guardar.
            </DialogDescription>
          </DialogHeader>
          <AnalisisSueloForm
            key={createFormKey}
            fincas={fincas}
            lotesPorFinca={lotesPorFinca}
            layout="dialog"
            record={null}
            onSuccess={afterSave}
            onCancel={closeSheet}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={sheet?.type === "edit"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar análisis</DialogTitle>
            <DialogDescription>Modifique los campos y guarde los cambios.</DialogDescription>
          </DialogHeader>
          {sheet?.type === "edit" ? (
            <AnalisisSueloForm
              key={sheet.row.id}
              fincas={fincas}
              lotesPorFinca={lotesPorFinca}
              layout="dialog"
              record={rowToFormRecord(sheet.row)}
              onSuccess={afterSave}
              onCancel={closeSheet}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAnular} onOpenChange={(v) => !v && setConfirmAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular análisis</DialogTitle>
            <DialogDescription>
              El registro dejará de mostrarse en listados activos. Esta acción no borra el dato
              del historial.
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
