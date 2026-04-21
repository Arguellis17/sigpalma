"use client";

import { useState } from "react";
import { registrarLabor } from "@/app/actions/labores";
import { useFincaLoteOptions } from "@/hooks/use-finca-lote-options";
import { Button } from "@/components/ui/button";
import { DatePickerField, todayLocalYmd } from "@/components/ui/date-picker-field";
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

const TIPOS_SUGERIDOS = [
  "Fertilización",
  "Control de malezas",
  "Poda",
  "Plateo",
  "Riego",
  "Otro",
];

type FincaRow = { id: string; nombre: string };

type Props = {
  fincas: FincaRow[];
  defaultFincaId: string | null;
  /** Sin panel exterior (p. ej. dentro de un modal). */
  embedded?: boolean;
  /** Tras guardar con éxito (p. ej. cerrar modal y refrescar). */
  onSuccess?: () => void;
};

export function LaborForm({
  fincas,
  defaultFincaId,
  embedded = false,
  onSuccess,
}: Props) {
  const { fincaId, setFincaId, loteId, setLoteId, lotes, loadingLotes } =
    useFincaLoteOptions(fincas, defaultFincaId);

  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState(() => todayLocalYmd());
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!fincaId || !loteId) {
      setError("Seleccione finca y lote.");
      return;
    }
    setPending(true);
    const result = await registrarLabor({
      finca_id: fincaId,
      lote_id: loteId,
      tipo: tipo.trim() || "Labor",
      fecha_ejecucion: fecha,
      notas: notas.trim() || null,
      source: "web",
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNotas("");
    if (onSuccess) {
      onSuccess();
      return;
    }
    setMessage(`Labor registrada (id ${result.data.id.slice(0, 8)}…).`);
  }

  if (fincas.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        No hay fincas visibles para su cuenta. Verifique su asignación con un
        administrador.
      </p>
    );
  }

  const formClass = embedded
    ? "flex max-w-none flex-col gap-5"
    : "surface-panel flex max-w-2xl flex-col gap-5 rounded-[2rem] p-5 sm:p-6";

  return (
    <form onSubmit={onSubmit} className={formClass}>
      <div className="space-y-2">
        <Label htmlFor="finca">Finca</Label>
        <Select value={fincaId} onValueChange={setFincaId}>
          <SelectTrigger id="finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
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
        <Label htmlFor="lote">Lote</Label>
        <Select
          value={loadingLotes || lotes.length === 0 || !loteId ? undefined : loteId}
          onValueChange={setLoteId}
          disabled={loadingLotes || lotes.length === 0}
        >
          <SelectTrigger id="lote" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue
              placeholder={
                loadingLotes
                  ? "Cargando…"
                  : lotes.length === 0
                    ? "Sin lotes en esta finca"
                    : "Lote"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {lotes.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.codigo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tipo">Tipo de labor</Label>
        <Input
          id="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          list="tipos-labor"
          placeholder="Ej. Fertilización"
          className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
          required
        />
        <datalist id="tipos-labor">
          {TIPOS_SUGERIDOS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fecha">Fecha de ejecución</Label>
        <DatePickerField
          id="fecha"
          value={fecha}
          onChange={setFecha}
          placeholder="Elegir fecha de ejecución…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="min-h-[110px] rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none"
        />
      </div>
      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="min-h-12 w-full rounded-2xl shadow-lg shadow-primary/15 sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Registrar labor"}
      </Button>
    </form>
  );
}
