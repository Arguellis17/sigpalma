"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { validarAlertaFitosanitaria } from "@/app/actions/fitosanidad";
import type { InsumoFitosanitarioOption } from "@/app/actions/queries";
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

export type AlertaPendienteRow = {
  id: string;
  created_at: string;
  severidad: string;
  descripcion: string | null;
  lote_codigo: string;
  amenaza: string | null;
};

type Props = {
  alertas: AlertaPendienteRow[];
  insumosFitosanitarios: InsumoFitosanitarioOption[];
};

const selectClassName =
  "flex min-h-12 w-full rounded-2xl border border-border/70 bg-background/80 px-4 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ValidacionFitosanidadClient({
  alertas,
  insumosFitosanitarios,
}: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<
    "validado" | "rechazado" | "invalidado"
  >("validado");
  const [diagnostico, setDiagnostico] = useState("");
  const [emitirOrden, setEmitirOrden] = useState(false);
  const [insumoId, setInsumoId] = useState(insumosFitosanitarios[0]?.id ?? "");
  const [dosis, setDosis] = useState("");
  const [obsTecnico, setObsTecnico] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = alertas.find((a) => a.id === openId);

  function close() {
    setOpenId(null);
    setErr(null);
    setDiagnostico("");
    setDosis("");
    setObsTecnico("");
    setEmitirOrden(false);
    setDecision("validado");
  }

  async function onConfirm() {
    if (!openId) return;
    setErr(null);
    if (!diagnostico.trim()) {
      setErr("El diagnóstico / concepto técnico es obligatorio (RF15).");
      return;
    }
    if (decision === "validado" && emitirOrden) {
      if (!insumoId) {
        setErr("Seleccione un producto fitosanitario.");
        return;
      }
      if (!dosis.trim()) {
        setErr("Indique la dosis recomendada.");
        return;
      }
    }

    setPending(true);
    const res = await validarAlertaFitosanitaria({
      alerta_id: openId,
      decision,
      validacion_diagnostico: diagnostico.trim(),
      orden:
        decision === "validado" && emitirOrden
          ? {
              insumo_catalogo_id: insumoId,
              dosis_recomendada: dosis.trim(),
              observaciones_tecnico: obsTecnico.trim() || null,
            }
          : undefined,
    });
    setPending(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    close();
    router.refresh();
  }

  if (alertas.length === 0) {
    return (
      <p className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">
        No hay alertas pendientes de validación en su finca.
      </p>
    );
  }

  return (
    <>
      <div className="surface-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Amenaza</th>
                <th className="px-4 py-3">Severidad</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr
                  key={a.id}
                  className={`border-b border-border/40 last:border-0 ${
                    i % 2 !== 0 ? "bg-muted/15" : ""
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium">{a.lote_codigo}</td>
                  <td className="px-4 py-3">{a.amenaza ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{a.severidad}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setOpenId(a.id)}
                    >
                      Validar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!openId} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validación fitosanitaria (RF15)</DialogTitle>
            <DialogDescription>
              Registre el diagnóstico técnico y, si corresponde, emita una orden de
              control con producto y dosis recomendada.
            </DialogDescription>
          </DialogHeader>
          {current ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Lote <strong>{current.lote_codigo}</strong>
                {current.descripcion ? (
                  <>
                    <br />
                    <span className="mt-1 block whitespace-pre-wrap">
                      {current.descripcion}
                    </span>
                  </>
                ) : null}
              </p>

              <div className="space-y-2">
                <Label>Decisión</Label>
                <select
                  className={selectClassName}
                  value={decision}
                  onChange={(e) =>
                    setDecision(
                      e.target.value as "validado" | "rechazado" | "invalidado"
                    )
                  }
                >
                  <option value="validado">Validado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="invalidado">Invalidado / datos erróneos</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diag">Diagnóstico / concepto técnico</Label>
                <Textarea
                  id="diag"
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  rows={4}
                  className="rounded-2xl border-border/70 bg-background/80"
                  placeholder="Justificación obligatoria (RN42)…"
                />
              </div>

              {decision === "validado" ? (
                <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/15 p-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={emitirOrden}
                      onChange={(e) => setEmitirOrden(e.target.checked)}
                      className="mt-1 size-4"
                    />
                    <span>
                      Emitir orden de control con producto fitosanitario (catálogo
                      RN65)
                    </span>
                  </label>
                  {emitirOrden ? (
                    <>
                      <div className="space-y-2">
                        <Label>Producto</Label>
                        <select
                          className={selectClassName}
                          value={insumoId}
                          onChange={(e) => setInsumoId(e.target.value)}
                        >
                          {insumosFitosanitarios.length === 0 ? (
                            <option value="">Sin productos fitosanitarios en catálogo</option>
                          ) : (
                            insumosFitosanitarios.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                                {p.subcategoria ? ` (${p.subcategoria})` : ""}
                              </option>
                            ))
                          )}
                        </select>
                        {insumosFitosanitarios.length === 0 ? (
                          <p className="text-xs text-amber-700">
                            Cree insumos con subcategoría Herbicida, Fungicida,
                            Fitosanitario, etc. en el catálogo administrador.
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dosis">Dosis recomendada</Label>
                        <Input
                          id="dosis"
                          value={dosis}
                          onChange={(e) => setDosis(e.target.value)}
                          placeholder="Ej. 1.5 L/ha"
                          className="min-h-12 rounded-2xl border-border/70 bg-background/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="obst">Observaciones técnicas (opcional)</Label>
                        <Input
                          id="obst"
                          value={obsTecnico}
                          onChange={(e) => setObsTecnico(e.target.value)}
                          className="min-h-12 rounded-2xl border-border/70 bg-background/80"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {err ? (
                <p className="text-sm text-destructive" role="alert">
                  {err}
                </p>
              ) : null}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={close}>
                  Cancelar
                </Button>
                <Button type="button" onClick={onConfirm} disabled={pending}>
                  {pending ? "Guardando…" : "Confirmar"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
