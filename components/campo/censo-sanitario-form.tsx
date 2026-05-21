"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCapacidadPalmasLote,
  registrarCensoSanitario,
} from "@/app/actions/censo-sanitario";
import { useFincaLoteOptions } from "@/hooks/use-finca-lote-options";
import type { CatalogoFitosanidadOption } from "@/app/actions/queries";
import {
  calcularIncidenciaPct,
  labelIncidenciaPct,
  superaUmbralIncidencia,
  UMBRAL_INCIDENCIA_CENSO_PCT,
} from "@/lib/censo-sanitario";
import { labelCategoriaFitosanitaria } from "@/lib/validations/catalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FincaRow = { id: string; nombre: string };

type Props = {
  fincas: FincaRow[];
  defaultFincaId: string | null;
  catalogo: CatalogoFitosanidadOption[];
  embedded?: boolean;
  onSuccess?: () => void;
};

const LOTE_SELECT_IDLE = "__lote_idle__";

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CensoSanitarioForm({
  fincas,
  defaultFincaId,
  catalogo,
  embedded = false,
  onSuccess,
}: Props) {
  const { fincaId, setFincaId, loteId, setLoteId, lotes, loadingLotes } =
    useFincaLoteOptions(fincas, defaultFincaId);

  const [catalogoId, setCatalogoId] = useState("");
  const [fechaCenso, setFechaCenso] = useState(todayYmd());
  const [inspeccionadas, setInspeccionadas] = useState("");
  const [afectadas, setAfectadas] = useState("");
  const [notas, setNotas] = useState("");
  const [capacidadLote, setCapacidadLote] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loteId) {
      setCapacidadLote(null);
      return;
    }
    let cancelled = false;
    void getCapacidadPalmasLote(loteId).then((res) => {
      if (cancelled) return;
      setCapacidadLote(res.success ? res.data.total_estimado : null);
    });
    return () => {
      cancelled = true;
    };
  }, [loteId]);

  const inspeccionadasNum = Number(inspeccionadas);
  const afectadasNum = Number(afectadas);
  const incidenciaPreview = useMemo(() => {
    if (!Number.isFinite(inspeccionadasNum) || inspeccionadasNum <= 0) return null;
    if (!Number.isFinite(afectadasNum) || afectadasNum < 0) return null;
    if (afectadasNum > inspeccionadasNum) return null;
    return calcularIncidenciaPct(inspeccionadasNum, afectadasNum);
  }, [inspeccionadasNum, afectadasNum]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!fincaId || !loteId) {
      setError("Seleccione finca y lote.");
      return;
    }
    if (!catalogoId) {
      setError("Seleccione plaga o enfermedad del catálogo (RN68).");
      return;
    }
    setPending(true);
    const res = await registrarCensoSanitario({
      finca_id: fincaId,
      lote_id: loteId,
      catalogo_item_id: catalogoId,
      fecha_censo: fechaCenso,
      palmas_inspeccionadas: inspeccionadasNum,
      palmas_afectadas: afectadasNum,
      notas: notas.trim() || null,
      source: "web",
    });
    setPending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setCatalogoId("");
    setInspeccionadas("");
    setAfectadas("");
    setNotas("");
    if (onSuccess) {
      onSuccess();
      return;
    }
    setMessage(
      res.data.supera_umbral
        ? `Censo registrado. Incidencia ${labelIncidenciaPct(res.data.incidencia_pct)} — supera umbral (${UMBRAL_INCIDENCIA_CENSO_PCT}%).`
        : `Censo registrado. Incidencia ${labelIncidenciaPct(res.data.incidencia_pct)}.`
    );
  }

  if (fincas.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
        No hay fincas visibles para su cuenta.
      </p>
    );
  }

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  return (
    <form onSubmit={onSubmit} className={formClass}>
      <div className="space-y-2">
        <Label htmlFor="c-finca">Finca</Label>
        <Select value={fincaId} onValueChange={setFincaId}>
          <SelectTrigger id="c-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base">
            <SelectValue placeholder="Finca" />
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

      <div className="space-y-2">
        <Label htmlFor="c-lote">Lote</Label>
        <Select
          value={
            !loadingLotes && lotes.length > 0 && lotes.some((l) => l.id === loteId)
              ? loteId
              : LOTE_SELECT_IDLE
          }
          onValueChange={(v) => {
            if (v !== LOTE_SELECT_IDLE) setLoteId(v);
          }}
          disabled={loadingLotes || lotes.length === 0}
        >
          <SelectTrigger id="c-lote" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base">
            <SelectValue placeholder={loadingLotes ? "Cargando…" : "Lote"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={LOTE_SELECT_IDLE} disabled className="opacity-60">
              {loadingLotes ? "Cargando…" : lotes.length === 0 ? "Sin lotes" : "Seleccione…"}
            </SelectItem>
            {lotes.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {capacidadLote !== null ? (
          <p className="text-xs text-muted-foreground">
            Capacidad estimada del lote: ~{capacidadLote} palmas (área × densidad).
          </p>
        ) : loteId ? (
          <p className="text-xs text-muted-foreground">
            Sin densidad registrada en el lote; no se validará tope de palmas inspeccionadas.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="c-amenaza">Plaga / enfermedad (obligatorio)</Label>
        <Select value={catalogoId || ""} onValueChange={setCatalogoId} required>
          <SelectTrigger id="c-amenaza" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base">
            <SelectValue placeholder="Seleccione amenaza del catálogo…" />
          </SelectTrigger>
          <SelectContent>
            {catalogo.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                [{labelCategoriaFitosanitaria(c.categoria)}] {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="c-fecha">Fecha del censo</Label>
        <Input
          id="c-fecha"
          type="date"
          value={fechaCenso}
          onChange={(e) => setFechaCenso(e.target.value)}
          className="min-h-12 rounded-2xl"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-inspeccionadas">Palmas inspeccionadas</Label>
          <Input
            id="c-inspeccionadas"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={inspeccionadas}
            onChange={(e) => setInspeccionadas(e.target.value)}
            className="min-h-12 rounded-2xl text-lg tabular-nums"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-afectadas">Palmas afectadas</Label>
          <Input
            id="c-afectadas"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={afectadas}
            onChange={(e) => setAfectadas(e.target.value)}
            className="min-h-12 rounded-2xl text-lg tabular-nums"
            required
          />
        </div>
      </div>

      {incidenciaPreview !== null ? (
        <div
          className={`rounded-2xl border px-4 py-3 ${
            superaUmbralIncidencia(incidenciaPreview)
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-border/60 bg-muted/20"
          }`}
        >
          <p className="text-sm font-medium">
            Incidencia calculada: {labelIncidenciaPct(incidenciaPreview)}
          </p>
          {superaUmbralIncidencia(incidenciaPreview) ? (
            <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
              Supera el umbral de {UMBRAL_INCIDENCIA_CENSO_PCT}% — requiere revisión del técnico.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="c-notas">Notas (opcional)</Label>
        <Textarea
          id="c-notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="min-h-[80px] rounded-2xl"
          maxLength={2000}
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Registrar censo"}
      </Button>
    </form>
  );
}
