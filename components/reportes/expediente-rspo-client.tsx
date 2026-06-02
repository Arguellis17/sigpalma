"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, ShieldCheck } from "lucide-react";
import { consultarExpedienteRspo } from "@/app/actions/reportes-rspo";
import type { ExpedienteRspoPayload } from "@/app/actions/reportes-rspo";
import { getLotesPorFinca } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FincaOption = { id: string; nombre: string };

type Props = {
  fincas: FincaOption[];
  defaultFincaId: string;
  showFincaSelector?: boolean;
};

export function ExpedienteRspoClient({
  fincas,
  defaultFincaId,
  showFincaSelector = false,
}: Props) {
  const router = useRouter();
  const [fincaId, setFincaId] = useState(defaultFincaId);
  const [loteId, setLoteId] = useState("");
  const [lotes, setLotes] = useState<{ id: string; codigo: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteRspoPayload | null>(null);

  useEffect(() => {
    setFincaId(defaultFincaId);
  }, [defaultFincaId]);

  useEffect(() => {
    if (!fincaId) return;
    let cancelled = false;
    void getLotesPorFinca(fincaId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setLotes(res.data);
        setLoteId(res.data[0]?.id ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fincaId]);

  function onFincaChange(nextId: string) {
    setFincaId(nextId);
    setExpediente(null);
    if (showFincaSelector) {
      router.replace(`/superadmin/reportes/rspo?finca=${nextId}`);
    }
  }

  async function generarVista() {
    setError(null);
    setPending(true);
    const res = await consultarExpedienteRspo({ lote_id: loteId });
    setPending(false);
    if (!res.success) {
      setError(res.error);
      setExpediente(null);
      return;
    }
    setExpediente(res.data);
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="surface-panel grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
        {showFincaSelector ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rspo-finca">Finca</Label>
            <Select value={fincaId} onValueChange={onFincaChange}>
              <SelectTrigger id="rspo-finca" className="min-h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fincas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="rspo-lote">Lote</Label>
          <Select value={loteId || "__none__"} onValueChange={(v) => v !== "__none__" && setLoteId(v)}>
            <SelectTrigger id="rspo-lote" className="min-h-11 rounded-xl">
              <SelectValue placeholder="Seleccione lote" />
            </SelectTrigger>
            <SelectContent>
              {lotes.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  Sin lotes
                </SelectItem>
              ) : (
                lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.codigo}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || !loteId}
            onClick={generarVista}
          >
            {pending ? "Generando vista…" : "Generar vista previa"}
          </Button>
          {expediente ? (
            <Button type="button" variant="outline" className="min-h-11 gap-2" asChild>
              <a href={expediente.pdf_download_url} target="_blank" rel="noreferrer">
                <FileDown className="size-4" />
                Descargar PDF
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {expediente ? (
        <div className="space-y-4">
          <div className="surface-panel rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h3 className="font-semibold">
                Expediente RSPO — {expediente.trazabilidad.lote.codigo}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {expediente.finca_nombre} · Lote {expediente.trazabilidad.lote.codigo} ·{" "}
              {expediente.trazabilidad.eventos.length} eventos en línea de vida
            </p>
            {expediente.advertencias.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-amber-800 dark:text-amber-200">
                {expediente.advertencias.map((a) => (
                  <li key={a.codigo} className="rounded-lg bg-amber-500/10 px-3 py-2">
                    {a.mensaje}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">
                Cadena de datos completa para exportación (RN23).
              </p>
            )}
          </div>
          <div className="surface-panel max-h-[420px] overflow-y-auto rounded-2xl p-4">
            <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Eventos (resumen)
            </p>
            <ul className="space-y-2 text-sm">
              {expediente.trazabilidad.eventos.slice(0, 25).map((ev) => (
                <li key={ev.id} className="border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">{ev.displayDate}</span> ·{" "}
                  <span className="font-medium">{ev.title}</span>
                  {ev.subtitle ? (
                    <span className="text-muted-foreground"> — {ev.subtitle}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {expediente.trazabilidad.eventos.length > 25 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                El PDF incluye hasta 80 eventos ordenados cronológicamente.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
