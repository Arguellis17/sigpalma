"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validarPreparacionTerreno } from "@/app/actions/preparacion-terreno";
import {
  labelActividadPreparacion,
} from "@/lib/preparacion-terreno";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export type PreparacionPendienteValidacionRow = {
  id: string;
  lote_codigo: string;
  pendiente_final_pct: number;
  actividades: string[];
  created_at: string;
  notas: string | null;
};

type Props = {
  pendientes: PreparacionPendienteValidacionRow[];
};

export function PreparacionTerrenoValidacionClient({ pendientes }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(pendientes[0]?.id ?? "");
  const [observacion, setObservacion] = useState("");
  const [pending, setPending] = useState(false);

  const selected = pendientes.find((p) => p.id === selectedId);

  async function onValidar() {
    if (!selectedId) return;
    if (observacion.trim().length < 10) {
      toast("Indique una observación técnica (mín. 10 caracteres).", "error");
      return;
    }
    setPending(true);
    const res = await validarPreparacionTerreno({
      id: selectedId,
      observacion_validacion: observacion.trim(),
    });
    setPending(false);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    toast("Preparación validada. Lote listo para siembra.", "success");
    setObservacion("");
    router.refresh();
  }

  if (pendientes.length === 0) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No hay preparaciones de terreno pendientes de validación por pendiente ≥ 12%.
      </p>
    );
  }

  return (
    <div className="surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="prep">Registro pendiente</Label>
        <select
          id="prep"
          className="min-h-12 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-base"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {pendientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lote_codigo} · pendiente {p.pendiente_final_pct}%
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium">Lote {selected.lote_codigo}</p>
          <p className="text-muted-foreground">
            Actividades:{" "}
            {selected.actividades
              .map((a) => labelActividadPreparacion(a))
              .join(", ")}
          </p>
          {selected.notas ? (
            <p className="mt-1 text-muted-foreground">Notas: {selected.notas}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="obs">Observación técnica de validación</Label>
        <Textarea
          id="obs"
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={4}
          placeholder="Justifique la aprobación pese a pendiente ≥ 12%…"
          className="rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base"
        />
      </div>

      <Button
        type="button"
        size="lg"
        className="min-h-12 rounded-2xl"
        disabled={pending}
        onClick={() => void onValidar()}
      >
        {pending ? "Validando…" : "Aprobar y habilitar siembra"}
      </Button>
    </div>
  );
}
