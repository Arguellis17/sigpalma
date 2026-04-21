"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, MapPinned, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FincaEditForm } from "@/components/fincas/finca-edit-form";
import { LoteCreateForm } from "@/components/fincas/lote-create-form";
import { LoteEditForm } from "@/components/fincas/lote-edit-form";

type Finca = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  area_ha: string | number | null;
  propietario: string | null;
  created_at: string;
};

type Lote = {
  id: string;
  codigo: string;
  area_ha: string | number | null;
  anio_siembra: number | null;
  material_genetico: string | null;
  densidad_palmas_ha: string | number | null;
  pendiente_pct: string | number | null;
  created_at: string;
};

type Props = { finca: Finca; lotes: Lote[]; canEditFinca: boolean };

type ActiveModal =
  | { type: "editFinca" }
  | { type: "createLote" }
  | { type: "editLote"; lote: Lote }
  | null;

const SLOPE_THRESHOLD = 12;

export function FincaDetalleClient({ finca, lotes, canEditFinca }: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<ActiveModal>(null);

  const usedArea = lotes.reduce((sum, l) => sum + Number(l.area_ha ?? 0), 0);
  const totalArea = Number(finca.area_ha ?? 0);
  const usedPct = totalArea > 0 ? Math.min(100, (usedArea / totalArea) * 100) : 0;

  function handleDone() {
    setSheet(null);
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-5">
      {/* Finca header */}
      <div className="surface-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <MapPinned className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{finca.nombre}</h2>
              {finca.ubicacion ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{finca.ubicacion}</p>
              ) : null}
              {finca.propietario ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Propietario:{" "}
                  <span className="font-medium text-foreground">{finca.propietario}</span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {finca.area_ha ? (
              <Badge variant="secondary">{finca.area_ha} ha total</Badge>
            ) : null}
            {canEditFinca ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSheet({ type: "editFinca" })}
              >
                <Pencil className="mr-1.5 size-3.5" />
                Editar
              </Button>
            ) : null}
          </div>
        </div>

        {/* Area usage bar */}
        {totalArea > 0 ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Área asignada a lotes</span>
              <span>
                {usedArea.toFixed(2)} / {totalArea} ha ({usedPct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Lotes section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Lotes ({lotes.length})
          </h3>
          <Button size="sm" onClick={() => setSheet({ type: "createLote" })}>
            <Plus className="mr-1.5 size-3.5" />
            Nuevo lote
          </Button>
        </div>

        {lotes.length === 0 ? (
          <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
            No hay lotes registrados para esta finca.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lotes.map((lote) => {
              const hasSlope =
                lote.pendiente_pct != null && Number(lote.pendiente_pct) > SLOPE_THRESHOLD;
              return (
                <div
                  key={lote.id}
                  className="surface-panel flex flex-col rounded-2xl border border-border/60 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">Lote {lote.codigo}</p>
                    {hasSlope ? (
                      <span title="Pendiente > 12% — Riesgo de erosión">
                        <AlertTriangle className="size-4 text-amber-500" />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {lote.area_ha ? <p>{lote.area_ha} ha</p> : null}
                    {lote.anio_siembra ? <p>Siembra: {lote.anio_siembra}</p> : null}
                    {lote.material_genetico ? <p>{lote.material_genetico}</p> : null}
                    {lote.pendiente_pct != null ? (
                      <p className={hasSlope ? "text-amber-600 dark:text-amber-400" : ""}>
                        Pendiente: {lote.pendiente_pct}%
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 self-start text-xs"
                    onClick={() => setSheet({ type: "editLote", lote })}
                  >
                    <Pencil className="mr-1 size-3" />
                    Editar lote
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit finca dialog */}
      <Dialog
        open={canEditFinca && sheet?.type === "editFinca"}
        onOpenChange={(v) => !v && setSheet(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar finca</DialogTitle>
            <DialogDescription>Modifica los datos generales de la finca.</DialogDescription>
          </DialogHeader>
          <FincaEditForm
            fincaId={finca.id}
            initial={{
              nombre: finca.nombre,
              ubicacion: finca.ubicacion,
              area_ha: finca.area_ha ?? "",
              propietario: finca.propietario,
            }}
            onSuccess={handleDone}
            onCancel={() => setSheet(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Create lote dialog */}
      <Dialog
        open={sheet?.type === "createLote"}
        onOpenChange={(v) => !v && setSheet(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuevo lote</DialogTitle>
            <DialogDescription>
              Registra un lote de cultivo para esta finca.
            </DialogDescription>
          </DialogHeader>
          <LoteCreateForm
            fincaId={finca.id}
            onSuccess={() => handleDone()}
            onCancel={() => setSheet(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit lote dialog */}
      <Dialog
        open={sheet?.type === "editLote"}
        onOpenChange={(v) => !v && setSheet(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar lote</DialogTitle>
            <DialogDescription>
              Modifica los datos del lote de cultivo.
            </DialogDescription>
          </DialogHeader>
          {sheet?.type === "editLote" ? (
            <LoteEditForm
              fincaId={finca.id}
              loteId={sheet.lote.id}
              initial={{
                codigo: sheet.lote.codigo,
                area_ha: sheet.lote.area_ha ?? "",
                anio_siembra: sheet.lote.anio_siembra ?? new Date().getFullYear(),
                material_genetico: sheet.lote.material_genetico,
                densidad_palmas_ha: sheet.lote.densidad_palmas_ha,
                pendiente_pct: sheet.lote.pendiente_pct,
              }}
              onSuccess={handleDone}
              onCancel={() => setSheet(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
