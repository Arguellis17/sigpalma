"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import { anularLabor } from "@/app/actions/labores";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { LaborForm } from "@/components/campo/labor-form";
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

export type LaborListRow = {
  id: string;
  fecha_ejecucion: string;
  tipo: string;
  notas: string | null;
  lote_codigo: string;
  created_at: string;
};

type Finca = { id: string; nombre: string };

type Props = {
  initialRows: LaborListRow[];
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

export function LaboresOperarioClient({
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
  const [viewRow, setViewRow] = useState<LaborListRow | null>(null);
  const [confirmAnular, setConfirmAnular] = useState<LaborListRow | null>(null);
  const [pendingAnular, setPendingAnular] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = `${r.tipo} ${r.lote_codigo} ${r.notas ?? ""} ${r.fecha_ejecucion}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  function afterCreate() {
    setCreateOpen(false);
    toast("Labor registrada.", "success");
    router.refresh();
  }

  async function handleAnular() {
    if (!confirmAnular) return;
    setPendingAnular(true);
    const result = await anularLabor({ id: confirmAnular.id });
    setPendingAnular(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== confirmAnular.id));
    setConfirmAnular(null);
    toast("Labor anulada.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por tipo, lote, notas…"
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
          Nueva labor
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "No hay labores registradas. Use «Nueva labor» para el primero."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha ejecución</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Notas</th>
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
                      {formatDate(r.fecha_ejecucion)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="px-4 py-3">{r.tipo}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {r.notas ?? "—"}
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
            <DialogTitle>Nueva labor</DialogTitle>
            <DialogDescription>
              Registre la ejecución en campo. Puede cerrar sin guardar.
            </DialogDescription>
          </DialogHeader>
          <LaborForm
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
            <DialogTitle>Detalle de labor</DialogTitle>
            <DialogDescription>Información del registro seleccionado.</DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Lote</dt>
                <dd className="mt-0.5 font-medium">{viewRow.lote_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Tipo</dt>
                <dd className="mt-0.5">{viewRow.tipo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">
                  Fecha ejecución
                </dt>
                <dd className="mt-0.5">{formatDate(viewRow.fecha_ejecucion)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Notas</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                  {viewRow.notas ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Registro</dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {new Date(viewRow.created_at).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAnular} onOpenChange={(v) => !v && setConfirmAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular labor</DialogTitle>
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
