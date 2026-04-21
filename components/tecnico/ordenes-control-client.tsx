"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelarOrdenControl } from "@/app/actions/fitosanidad";
import { Button } from "@/components/ui/button";

export type OrdenListRow = {
  id: string;
  estado: string;
  created_at: string;
  dosis_recomendada: string;
  lote_codigo: string;
  insumo_nombre: string;
};

type Props = {
  ordenes: OrdenListRow[];
};

export function OrdenesControlClient({ ordenes }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function cancelar(id: string) {
    if (!confirm("¿Cancelar esta orden autorizada?")) return;
    setBusyId(id);
    const res = await cancelarOrdenControl({ orden_id: id });
    setBusyId(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  if (ordenes.length === 0) {
    return (
      <p className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">
        No hay órdenes de control registradas.
      </p>
    );
  }

  return (
    <div className="surface-panel overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Creada</th>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Dosis rec.</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o, i) => (
              <tr
                key={o.id}
                className={`border-b border-border/40 last:border-0 ${
                  i % 2 !== 0 ? "bg-muted/15" : ""
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 font-medium">{o.lote_codigo}</td>
                <td className="px-4 py-3">{o.insumo_nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {o.dosis_recomendada}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                    {o.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {o.estado === "autorizada" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === o.id}
                      onClick={() => cancelar(o.id)}
                    >
                      {busyId === o.id ? "…" : "Cancelar"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
