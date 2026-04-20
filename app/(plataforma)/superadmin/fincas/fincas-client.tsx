"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { Archive, ArchiveRestore, MapPinned, Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FincaCreateForm } from "@/components/fincas/finca-create-form";
import { FincaEditForm } from "@/components/fincas/finca-edit-form";
import { inactivarFinca, reactivarFinca } from "@/app/actions/fincas";
import { useToast } from "@/components/ui/toast";

type Finca = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  area_ha: string | number | null;
  propietario: string | null;
  is_active: boolean;
  created_at: string;
};

type ActiveDialog =
  | { type: "create" }
  | { type: "edit"; finca: Finca }
  | { type: "archive"; finca: Finca }
  | null;

type Props = { fincas: Finca[] };

export function SuperadminFincasClient({ fincas: initialFincas }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [fincas, setFincas] = useServerPropsState(initialFincas);
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    let list = showInactive ? fincas : fincas.filter((f) => f.is_active);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (f) =>
        f.nombre.toLowerCase().includes(q) ||
        f.ubicacion?.toLowerCase().includes(q) ||
        f.propietario?.toLowerCase().includes(q)
    );
  }, [fincas, search, showInactive]);

  function handleCreated(id: string) {
    setDialog(null);
    router.refresh();
  }

  function handleEdited() {
    setDialog(null);
    router.refresh();
  }

  async function handleArchive() {
    if (dialog?.type !== "archive") return;
    setPending(true);
    const result = await inactivarFinca(dialog.finca.id);
    setPending(false);
    if (!result.success) {
      toast(result.error, "error");
    } else {
      setFincas((prev) =>
        prev.map((f) => (f.id === dialog.finca.id ? { ...f, is_active: false } : f))
      );
      toast("Finca archivada.", "success");
      setDialog(null);
    }
  }

  async function handleReactivar(finca: Finca) {
    const result = await reactivarFinca(finca.id);
    if (!result.success) {
      toast(result.error, "error");
    } else {
      setFincas((prev) =>
        prev.map((f) => (f.id === finca.id ? { ...f, is_active: true } : f))
      );
      toast("Finca reactivada.", "success");
    }
  }

  return (
    <div className="fade-up-enter space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar finca…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={`inline-flex min-h-10 items-center rounded-xl border px-3 text-sm transition-colors ${
              showInactive
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            {showInactive ? "Ocultar archivadas" : "Ver archivadas"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: "create" })}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Nueva finca
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-16 text-center">
          <MapPinned className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No se encontraron fincas con ese criterio."
              : showInactive
              ? "No hay fincas archivadas."
              : "No hay fincas activas. Crea la primera."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              className={`surface-panel group relative flex flex-col gap-2 rounded-2xl border p-4 transition-shadow hover:shadow-md ${
                f.is_active ? "border-border/60" : "border-border/30 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <MapPinned className="mt-0.5 size-4 shrink-0 text-primary/70" />
                  <p className="truncate text-sm font-semibold text-foreground">{f.nombre}</p>
                </div>
                <Badge
                  variant={f.is_active ? "outline" : "secondary"}
                  className="shrink-0 text-xs"
                >
                  {f.is_active ? "Activa" : "Archivada"}
                </Badge>
              </div>
              {(f.ubicacion || f.propietario || f.area_ha) && (
                <div className="space-y-0.5 pl-6 text-xs text-muted-foreground">
                  {f.ubicacion && <p>{f.ubicacion}</p>}
                  {f.propietario && <p>Propietario: {f.propietario}</p>}
                  {f.area_ha && <p>{Number(f.area_ha).toFixed(2)} ha</p>}
                </div>
              )}
              <div className="mt-1 flex gap-1.5 pl-6">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDialog({ type: "edit", finca: f })}
                >
                  <Pencil className="mr-1 size-3" />
                  Editar
                </Button>
                {f.is_active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setDialog({ type: "archive", finca: f })}
                  >
                    <Archive className="mr-1 size-3" />
                    Archivar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-primary hover:text-primary"
                    onClick={() => handleReactivar(f)}
                  >
                    <ArchiveRestore className="mr-1 size-3" />
                    Reactivar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialog?.type === "create"} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="surface-panel max-w-md rounded-2xl border-border/60">
          <DialogHeader>
            <DialogTitle>Nueva finca</DialogTitle>
            <DialogDescription>Registra una nueva finca en el sistema.</DialogDescription>
          </DialogHeader>
          <FincaCreateForm onSuccess={handleCreated} onCancel={() => setDialog(null)} />
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ───────────────────────────────────────────────────── */}
      {dialog?.type === "edit" && (
        <Dialog open onOpenChange={(v) => !v && setDialog(null)}>
          <DialogContent className="surface-panel max-w-md rounded-2xl border-border/60">
            <DialogHeader>
              <DialogTitle>Editar finca</DialogTitle>
              <DialogDescription>Modifica los datos de la finca.</DialogDescription>
            </DialogHeader>
            <FincaEditForm
              finca={dialog.finca}
              onSuccess={handleEdited}
              onCancel={() => setDialog(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Archive Confirm Dialog ────────────────────────────────────────── */}
      {dialog?.type === "archive" && (
        <Dialog open onOpenChange={(v) => !v && setDialog(null)}>
          <DialogContent className="surface-panel max-w-sm rounded-2xl border-border/60">
            <DialogHeader>
              <DialogTitle>Archivar finca</DialogTitle>
              <DialogDescription>
                ¿Confirmas que deseas archivar{" "}
                <strong className="text-foreground">{dialog.finca.nombre}</strong>? La finca
                quedará inactiva y no podrá recibir nuevas labores mientras esté archivada.
                Esta acción es reversible.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleArchive}
                disabled={pending}
                className="min-h-10"
              >
                {pending ? "Archivando…" : "Archivar finca"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
