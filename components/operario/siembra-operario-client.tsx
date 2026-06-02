"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { registrarSiembraPlantulas } from "@/app/actions/siembra-plantulas";
import type { RegistroSiembraListRow } from "@/app/actions/siembra-plantulas";
import type { SiembraPendienteRow } from "@/app/actions/queries";
import { SiembraForm, type SiembraConfirmSnapshot } from "@/components/campo/siembra-form";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Props = {
  fincaId: string | null;
  pendientes: SiembraPendienteRow[];
  initialHistorial: RegistroSiembraListRow[];
};

export function SiembraOperarioClient({
  fincaId,
  pendientes,
  initialHistorial,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [historial] = useServerPropsState(initialHistorial);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSnapshot, setConfirmSnapshot] = useState<SiembraConfirmSnapshot | null>(null);
  const [pending, setPending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return historial;
    return historial.filter((r) => {
      const blob = `${r.fecha_siembra} ${r.lote_codigo} ${r.material_nombre} ${r.cantidad_palmas}`.toLowerCase();
      return blob.includes(q);
    });
  }, [historial, search]);

  function handleRequestConfirm(snapshot: SiembraConfirmSnapshot) {
    setConfirmSnapshot(snapshot);
    setConfirmOpen(true);
  }

  async function onConfirm() {
    if (!fincaId || !confirmSnapshot) return;

    const qty = Number(confirmSnapshot.cantidad.replace(",", "."));
    setPending(true);
    const res = await registrarSiembraPlantulas({
      finca_id: fincaId,
      lote_id: confirmSnapshot.selected.lote_id,
      plan_siembra_id: confirmSnapshot.selected.plan_siembra_id,
      preparacion_terreno_id: confirmSnapshot.selected.preparacion_terreno_id,
      fecha_siembra: confirmSnapshot.fecha,
      cantidad_palmas: qty,
      confirmacion_profundidad: true,
      confirmacion_orientacion: true,
      notas: confirmSnapshot.notas.trim() || null,
      source: "web",
    });
    setPending(false);
    setConfirmOpen(false);

    if (!res.success) {
      toast(res.error, "error");
      return;
    }

    setCreateOpen(false);
    setConfirmSnapshot(null);
    toast("Siembra registrada. Lote en producción.", "success");
    router.refresh();
  }

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
        No hay finca asignada a su cuenta.
      </p>
    );
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por lote, material, fecha…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        <Button
          type="button"
          className="shrink-0 gap-1.5"
          disabled={pendientes.length === 0}
          onClick={() => {
            setCreateKey((k) => k + 1);
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          Registrar siembra
        </Button>
      </div>

      {pendientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay lotes listos para siembra. Complete la preparación de terreno y verifique
          que el lote esté en estado «Listo para siembra».
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "Sin siembras registradas aún. Use «Registrar siembra» para la primera."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Palmas</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{r.fecha_siembra}</td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="px-4 py-3">{r.material_nombre}</td>
                    <td className="px-4 py-3">{r.cantidad_palmas}</td>
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
            <DialogTitle>Registrar siembra</DialogTitle>
            <DialogDescription>
              Confirme profundidad y orientación de plúmula/radícula antes de enviar.
            </DialogDescription>
          </DialogHeader>
          <SiembraForm
            key={createKey}
            pendientes={pendientes}
            embedded
            onRequestConfirm={handleRequestConfirm}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar siembra</DialogTitle>
            <DialogDescription>
              El material genético se tomará del plan de siembra. El lote pasará a
              producción.
            </DialogDescription>
          </DialogHeader>
          {confirmSnapshot ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Lote</dt>
                <dd className="font-medium">{confirmSnapshot.selected.lote_codigo}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Material</dt>
                <dd>{confirmSnapshot.selected.material_nombre}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Palmas</dt>
                <dd>{confirmSnapshot.cantidad}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={() => void onConfirm()} disabled={pending}>
              {pending ? "Guardando…" : "Confirmar siembra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
