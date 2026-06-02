"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type {
  CatalogoMaterialGeneticoOption,
  LoteOption,
  RegistroGerminacionListRow,
} from "@/app/actions/queries";
import { GerminacionForm } from "@/components/campo/germinacion-form";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Props = {
  fincaId: string;
  defaultFecha: string;
  materiales: CatalogoMaterialGeneticoOption[];
  lotes: LoteOption[];
  initialRows: RegistroGerminacionListRow[];
};

export function OperarioGerminacionClient({
  fincaId,
  defaultFecha,
  materiales,
  lotes,
  initialRows,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows] = useServerPropsState(initialRows);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = `${r.fecha_tratamiento} ${r.material_nombre} ${r.lote_codigo ?? ""} ${r.temperatura_max_c} ${r.dias_tratamiento}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  function afterCreate() {
    setCreateOpen(false);
    toast("Germinación registrada.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por material, lote, fecha…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        <Button
          type="button"
          className="shrink-0 gap-1.5"
          disabled={materiales.length === 0}
          onClick={() => {
            setCreateKey((k) => k + 1);
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo registro
        </Button>
      </div>

      {materiales.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay material genético disponible en catálogo para esta finca.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "Aún no hay germinaciones registradas. Use «Nuevo registro» para el primero."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Temp. °C</th>
                  <th className="px-4 py-3">Días</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      i % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{r.fecha_tratamiento}</td>
                    <td className="px-4 py-3 font-medium">{r.material_nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.lote_codigo ?? "—"}
                    </td>
                    <td className="px-4 py-3">{r.temperatura_max_c}</td>
                    <td className="px-4 py-3">{r.dias_tratamiento}</td>
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
            <DialogTitle>Nuevo registro de germinación</DialogTitle>
            <DialogDescription>
              Tratamiento térmico vinculado al material genético. Temperatura máxima
              &gt; 42 °C requiere comentario.
            </DialogDescription>
          </DialogHeader>
          <GerminacionForm
            key={createKey}
            fincaId={fincaId}
            defaultFecha={defaultFecha}
            materiales={materiales}
            lotes={lotes}
            embedded
            onSuccess={afterCreate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
