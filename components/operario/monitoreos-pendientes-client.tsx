"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { marcarMonitoreoCompletado } from "@/app/actions/monitoreo-programado";
import type { MonitoreoPendienteOperarioRow } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Props = {
  rowsIniciales: MonitoreoPendienteOperarioRow[];
};

export function MonitoreosPendientesOperarioClient({ rowsIniciales }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function completar(row: MonitoreoPendienteOperarioRow) {
    setPendingId(row.id);
    try {
      const res = await marcarMonitoreoCompletado({ id: row.id });
      if (!res.success) {
        toast(res.error, "error");
        return;
      }
      toast("Inspección marcada como realizada.", "success");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="surface-panel overflow-x-auto rounded-[1.5rem]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 text-muted-foreground">
            <th className="p-3 font-medium">Fecha</th>
            <th className="p-3 font-medium">Lote</th>
            <th className="p-3 font-medium">Notas</th>
            <th className="p-3 font-medium w-[1%] whitespace-nowrap">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rowsIniciales.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-6 text-center text-muted-foreground">
                No tiene inspecciones pendientes asignadas.
              </td>
            </tr>
          ) : (
            rowsIniciales.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="p-3 whitespace-nowrap">{r.fecha_inspeccion}</td>
                <td className="p-3 font-medium">{r.lote_codigo}</td>
                <td className="p-3 text-muted-foreground">{r.notas ?? "—"}</td>
                <td className="p-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pendingId !== null}
                    onClick={() => void completar(r)}
                  >
                    {pendingId === r.id ? "Guardando…" : "Marcar realizada"}
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
