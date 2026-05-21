"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Search } from "lucide-react";
import type { CatalogoFitosanidadOption } from "@/app/actions/queries";
import type { CensoSanitarioListRow } from "@/app/actions/censo-sanitario";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { CensoSanitarioForm } from "@/components/campo/censo-sanitario-form";
import { labelIncidenciaPct } from "@/lib/censo-sanitario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Finca = { id: string; nombre: string };

type Props = {
  initialRows: CensoSanitarioListRow[];
  fincas: Finca[];
  defaultFincaId: string | null;
  catalogo: CatalogoFitosanidadOption[];
};

export function CensosSanitariosClient({
  initialRows,
  fincas,
  defaultFincaId,
  catalogo,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows] = useServerPropsState(initialRows);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [viewRow, setViewRow] = useState<CensoSanitarioListRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = `${r.lote_codigo} ${r.amenaza} ${r.notas ?? ""} ${r.incidencia_pct}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  function afterCreate() {
    setCreateOpen(false);
    toast("Censo sanitario registrado.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por lote, amenaza…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm"
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
          Nuevo censo
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center text-sm text-muted-foreground">
          {search
            ? "No hay resultados para esa búsqueda."
            : "Aún no hay censos registrados. Use «Nuevo censo» para cuantificar incidencia en un lote."}
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Amenaza</th>
                  <th className="px-4 py-3">Inspeccionadas</th>
                  <th className="px-4 py-3">Afectadas</th>
                  <th className="px-4 py-3">Incidencia</th>
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
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.fecha_censo}</td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="max-w-[180px] truncate px-4 py-3">{r.amenaza}</td>
                    <td className="px-4 py-3 tabular-nums">{r.palmas_inspeccionadas}</td>
                    <td className="px-4 py-3 tabular-nums">{r.palmas_afectadas}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                          r.supera_umbral
                            ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {labelIncidenciaPct(r.incidencia_pct)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
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
            <DialogTitle>Nuevo censo sanitario</DialogTitle>
            <DialogDescription>
              Registre palmas inspeccionadas y afectadas; la incidencia se calcula automáticamente
              (RN70).
            </DialogDescription>
          </DialogHeader>
          <CensoSanitarioForm
            key={createKey}
            fincas={fincas}
            defaultFincaId={defaultFincaId}
            catalogo={catalogo}
            embedded
            onSuccess={afterCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del censo</DialogTitle>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Lote</dt>
                <dd className="mt-0.5 font-medium">{viewRow.lote_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Amenaza</dt>
                <dd className="mt-0.5">
                  {viewRow.amenaza}{" "}
                  <span className="text-muted-foreground">({viewRow.amenaza_categoria})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Incidencia</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {labelIncidenciaPct(viewRow.incidencia_pct)}
                  {viewRow.supera_umbral ? " — supera umbral" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Palmas</dt>
                <dd className="mt-0.5 tabular-nums">
                  {viewRow.palmas_afectadas} afectadas / {viewRow.palmas_inspeccionadas} inspeccionadas
                </dd>
              </div>
              {viewRow.notas ? (
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Notas</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{viewRow.notas}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
