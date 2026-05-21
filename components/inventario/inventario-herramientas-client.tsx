"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Hand, RotateCcw, Search, Plus } from "lucide-react";
import {
  cambiarEstadoInventarioHerramienta,
  crearInventarioHerramienta,
  devolverHerramienta,
  tomarHerramienta,
  type InventarioHerramientaListRow,
} from "@/app/actions/herramientas";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import {
  ESTADO_HERRAMIENTA_LABELS,
  estadosInventarioHerramienta,
  labelEstadoHerramienta,
} from "@/lib/herramientas-estado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

type CatalogoHerramienta = { id: string; nombre: string; unidad_medida: string | null };

type Props = {
  initialRows: InventarioHerramientaListRow[];
  fincaId: string;
  currentUserId: string;
  mode: "operario" | "admin";
  catalogoHerramientas?: CatalogoHerramienta[];
};

function estadoBadgeClass(estado: string): string {
  switch (estado) {
    case "disponible":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
    case "en_uso":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
    case "danada":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
    case "perdida":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function InventarioHerramientasClient({
  initialRows,
  fincaId,
  currentUserId,
  mode,
  catalogoHerramientas = [],
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows] = useServerPropsState(initialRows);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [catalogoId, setCatalogoId] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [pendingCreate, setPendingCreate] = useState(false);

  const [reportRow, setReportRow] = useState<InventarioHerramientaListRow | null>(null);
  const [reportEstado, setReportEstado] = useState<"danada" | "perdida">("danada");
  const [reportNotas, setReportNotas] = useState("");
  const [pendingReport, setPendingReport] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;
      if (!q) return true;
      const blob = `${r.codigo} ${r.catalogo_nombre} ${r.assigned_nombre ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, filtroEstado]);

  async function runAction(
    id: string,
    fn: () => Promise<{ success: boolean; error?: string }>,
    okMessage: string
  ) {
    setPendingId(id);
    const result = await fn();
    setPendingId(null);
    if (!result.success) {
      toast(result.error ?? "Error.", "error");
      return;
    }
    toast(okMessage, "success");
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogoId || !codigoNuevo.trim()) {
      toast("Complete catálogo y código.", "error");
      return;
    }
    setPendingCreate(true);
    const result = await crearInventarioHerramienta({
      finca_id: fincaId,
      catalogo_item_id: catalogoId,
      codigo: codigoNuevo.trim(),
    });
    setPendingCreate(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    setCreateOpen(false);
    setCatalogoId("");
    setCodigoNuevo("");
    toast("Herramienta registrada en inventario.", "success");
    router.refresh();
  }

  async function handleReport() {
    if (!reportRow) return;
    setPendingReport(true);
    const result = await cambiarEstadoInventarioHerramienta({
      id: reportRow.id,
      estado: reportEstado,
      notas_dano: reportNotas,
    });
    setPendingReport(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    setReportRow(null);
    setReportNotas("");
    toast("Estado actualizado.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por código o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 rounded-xl border-border/70 bg-background/80 pl-9"
            />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="min-h-11 w-full rounded-xl sm:w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {estadosInventarioHerramienta.map((e) => (
                <SelectItem key={e} value={e}>
                  {ESTADO_HERRAMIENTA_LABELS[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mode === "admin" && (
          <Button
            type="button"
            className="min-h-11 shrink-0 gap-1.5"
            onClick={() => setCreateOpen(true)}
            disabled={catalogoHerramientas.length === 0}
          >
            <Plus className="size-4" />
            Alta en inventario
          </Button>
        )}
      </div>

      {mode === "admin" && catalogoHerramientas.length === 0 && (
        <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
          No hay insumos tipo herramienta activos en el catálogo. Créelos primero en Catálogos →
          Insumos.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center text-sm text-muted-foreground">
          No hay herramientas que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Herramienta</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Asignado a</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const busy = pendingId === r.id;
                  const puedeDevolver =
                    r.estado === "en_uso" &&
                    (r.assigned_to === currentUserId || mode === "admin");
                  const puedeTomar = r.estado === "disponible";
                  const puedeReportar =
                    r.estado === "disponible" || r.estado === "en_uso";

                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-border/40 last:border-0 ${
                        idx % 2 !== 0 ? "bg-muted/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">{r.codigo}</td>
                      <td className="px-4 py-3">{r.catalogo_nombre}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoBadgeClass(r.estado)}`}
                        >
                          {labelEstadoHerramienta(r.estado)}
                        </span>
                        {r.notas_dano && (r.estado === "danada" || r.estado === "perdida") && (
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground line-clamp-2">
                            {r.notas_dano}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.assigned_nombre ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {puedeTomar && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="min-h-9 gap-1"
                              disabled={busy}
                              onClick={() =>
                                runAction(r.id, () => tomarHerramienta({ id: r.id }), "Herramienta tomada.")
                              }
                            >
                              <Hand className="size-3.5" />
                              Tomar
                            </Button>
                          )}
                          {puedeDevolver && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-9 gap-1"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  r.id,
                                  () => devolverHerramienta({ id: r.id }),
                                  "Herramienta devuelta."
                                )
                              }
                            >
                              <RotateCcw className="size-3.5" />
                              Devolver
                            </Button>
                          )}
                          {puedeReportar && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="min-h-9 gap-1 text-amber-800 dark:text-amber-200"
                              disabled={busy}
                              onClick={() => {
                                setReportRow(r);
                                setReportEstado("danada");
                                setReportNotas("");
                              }}
                            >
                              <AlertTriangle className="size-3.5" />
                              Daño / pérdida
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alta en inventario</DialogTitle>
            <DialogDescription>
              Vincule un ítem del catálogo (tipo herramienta) con un código único en la finca.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalogo-herramienta">Catálogo</Label>
              <Select value={catalogoId} onValueChange={setCatalogoId} required>
                <SelectTrigger id="catalogo-herramienta" className="min-h-11 rounded-xl">
                  <SelectValue placeholder="Seleccione herramienta…" />
                </SelectTrigger>
                <SelectContent>
                  {catalogoHerramientas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                      {c.unidad_medida ? ` (${c.unidad_medida})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo-herramienta">Código / ID físico</Label>
              <Input
                id="codigo-herramienta"
                value={codigoNuevo}
                onChange={(e) => setCodigoNuevo(e.target.value)}
                placeholder="Ej. HERR-042"
                className="min-h-11 rounded-xl"
                maxLength={50}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pendingCreate}>
                {pendingCreate ? "Guardando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reportRow)} onOpenChange={(o) => !o && setReportRow(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar daño o pérdida</DialogTitle>
            <DialogDescription>
              {reportRow
                ? `${reportRow.codigo} — ${reportRow.catalogo_nombre}. Describa los hechos (RN82).`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nuevo estado</Label>
              <Select
                value={reportEstado}
                onValueChange={(v) => setReportEstado(v as "danada" | "perdida")}
              >
                <SelectTrigger className="min-h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="danada">Dañada</SelectItem>
                  <SelectItem value="perdida">Perdida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas-dano">Descripción</Label>
              <Textarea
                id="notas-dano"
                value={reportNotas}
                onChange={(e) => setReportNotas(e.target.value)}
                placeholder="Describa qué ocurrió, cuándo y dónde…"
                className="min-h-[100px] rounded-xl"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">Mínimo 10 caracteres.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportRow(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingReport || reportNotas.trim().length < 10}
              onClick={handleReport}
            >
              {pendingReport ? "Guardando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
