"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  actualizarCronograma,
  anularCronograma,
  cambiarEstadoCronograma,
  crearCronograma,
  type CronogramaRow,
} from "@/app/actions/cronogramas";
import type { CatalogoLaborOption, LoteOption, OperarioFincaOption } from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  DIAS_SEMANA,
  describirRegla,
  proximasFechas,
  type FrecuenciaCronograma,
} from "@/lib/cronogramas";
import { todayColombiaYmd } from "@/lib/date-colombia";
import { cn } from "@/lib/utils";

type Props = {
  fincaId: string;
  cronogramas: CronogramaRow[];
  lotes: LoteOption[];
  labores: CatalogoLaborOption[];
  operarios: OperarioFincaOption[];
};

const UNIDAD: Record<FrecuenciaCronograma, string> = { diaria: "días", semanal: "semanas", mensual: "meses" };

function formatoFecha(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function CronogramasLaboresClient({ fincaId, cronogramas, lotes, labores, operarios }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const hoy = todayColombiaYmd();

  const [abierto, setAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [porAnular, setPorAnular] = useState<CronogramaRow | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loteId, setLoteId] = useState("");
  const [laborId, setLaborId] = useState("");
  const [operarioId, setOperarioId] = useState("");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCronograma>("semanal");
  const [intervalo, setIntervalo] = useState("1");
  const [dias, setDias] = useState<number[]>([1]);
  const [inicio, setInicio] = useState(hoy);
  const [fin, setFin] = useState("");
  const [notas, setNotas] = useState("");

  const puedeCrear = lotes.length > 0 && labores.length > 0 && operarios.length > 0;
  const intervaloNum = Number(intervalo) || 1;

  const vistaPrevia = useMemo(
    () =>
      proximasFechas(
        { frecuencia, intervalo: intervaloNum, dias_semana: dias, fecha_inicio: inicio, fecha_fin: fin || null },
        hoy
      ),
    [frecuencia, intervaloNum, dias, inicio, fin, hoy]
  );

  function abrirNuevo() {
    setEditandoId(null);
    setLoteId(lotes[0]?.id ?? "");
    setLaborId(labores[0]?.id ?? "");
    setOperarioId(operarios[0]?.id ?? "");
    setFrecuencia("semanal");
    setIntervalo("1");
    setDias([1]);
    setInicio(hoy);
    setFin("");
    setNotas("");
    setError(null);
    setAbierto(true);
  }

  function abrirEdicion(c: CronogramaRow) {
    setEditandoId(c.id);
    setLoteId(c.lote_id);
    setLaborId(c.catalogo_item_id);
    setOperarioId(c.assigned_to);
    setFrecuencia(c.frecuencia);
    setIntervalo(String(c.intervalo));
    setDias(c.dias_semana.length ? c.dias_semana : [1]);
    setInicio(c.fecha_inicio);
    setFin(c.fecha_fin ?? "");
    setNotas(c.notas ?? "");
    setError(null);
    setAbierto(true);
  }

  function alternarDia(valor: number) {
    setDias((prev) => (prev.includes(valor) ? prev.filter((d) => d !== valor) : [...prev, valor].sort()));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendiente(true);
    const datos = {
      finca_id: fincaId,
      lote_id: loteId,
      catalogo_item_id: laborId,
      assigned_to: operarioId,
      frecuencia,
      intervalo: intervaloNum,
      dias_semana: dias,
      fecha_inicio: inicio,
      fecha_fin: fin || null,
      notas: notas.trim() || null,
    };
    const res = editandoId ? await actualizarCronograma({ ...datos, id: editandoId }) : await crearCronograma(datos);
    setPendiente(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setAbierto(false);
    toast(`Cronograma guardado. ${res.data.generadas} labores programadas en la agenda.`, "success");
    router.refresh();
  }

  async function cambiarEstado(c: CronogramaRow) {
    setPendiente(true);
    const res = await cambiarEstadoCronograma({ id: c.id, activo: !c.activo });
    setPendiente(false);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    toast(c.activo ? "Cronograma pausado. Sus labores futuras pendientes se anularon." : `Cronograma reanudado. ${res.data.generadas} labores programadas.`, "success");
    router.refresh();
  }

  async function anular() {
    if (!porAnular) return;
    setPendiente(true);
    const res = await anularCronograma({ id: porAnular.id });
    setPendiente(false);
    setPorAnular(null);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    toast("Cronograma anulado. Las labores ya ejecutadas se conservan.", "success");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {puedeCrear
            ? `Activos: ${cronogramas.filter((c) => c.activo).length}. Las labores se programan solas hasta 45 días adelante.`
            : "Para crear cronogramas se necesitan lotes activos, labores en el catálogo y operarios en la finca."}
        </p>
        <Button type="button" className="min-h-11 shrink-0 gap-1.5" onClick={abrirNuevo} disabled={!puedeCrear}>
          <Plus className="size-4" />
          Nuevo cronograma
        </Button>
      </div>

      {cronogramas.length === 0 ? (
        <p className="surface-panel rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Aún no hay cronogramas. Cree uno para que una labor repetitiva se programe sola en el lote.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {cronogramas.map((c) => {
            const proximas = c.activo && !c.detenido_por ? proximasFechas(c, hoy, 3) : [];
            return (
              <li key={c.id} className="surface-panel flex flex-col gap-3 rounded-2xl p-4" data-testid="cronograma">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {c.labor_nombre} · {c.lote_codigo}
                    </p>
                    <p className="text-sm text-muted-foreground">{describirRegla(c)}</p>
                    <p className="text-sm text-muted-foreground">Asignada a {c.operario_nombre}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                      !c.activo
                        ? "bg-muted text-muted-foreground"
                        : c.detenido_por
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
                          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100"
                    )}
                  >
                    {!c.activo ? "Pausado" : c.detenido_por ? "Detenido" : "Activo"}
                  </span>
                </div>

                {c.activo && c.detenido_por ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200">{c.detenido_por}: no se generan labores hasta corregirlo.</p>
                ) : null}

                <p className="text-sm">
                  <CalendarClock className="mr-1.5 inline size-4 text-muted-foreground" aria-hidden />
                  {proximas.length > 0
                    ? `Próximas: ${proximas.map(formatoFecha).join(", ")}`
                    : c.activo && !c.detenido_por
                      ? "Sin más fechas: la vigencia terminó."
                      : c.fecha_fin
                        ? `Vigencia hasta ${c.fecha_fin}`
                        : "Sin fecha final"}
                </p>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-10 gap-1.5" onClick={() => abrirEdicion(c)}>
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 gap-1.5"
                    disabled={pendiente}
                    data-requiere-conexion
                    onClick={() => void cambiarEstado(c)}
                  >
                    {c.activo ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    {c.activo ? "Pausar" : "Reanudar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setPorAnular(c)}
                  >
                    <Trash2 className="size-3.5" />
                    Anular
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar cronograma" : "Nuevo cronograma"}</DialogTitle>
            <DialogDescription>
              {editandoId
                ? "Las labores futuras pendientes se reemplazan por las de la nueva regla. Lo ya ejecutado no cambia."
                : "La labor se programará sola en la agenda del operario."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="cr-lote">Lote</Label>
              <Select value={loteId} onValueChange={setLoteId}>
                <SelectTrigger id="cr-lote" className="min-h-12 w-full">
                  <SelectValue placeholder="Lote" />
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
              <Label htmlFor="cr-labor">Labor</Label>
              <Select value={laborId} onValueChange={setLaborId}>
                <SelectTrigger id="cr-labor" className="min-h-12 w-full">
                  <SelectValue placeholder="Labor" />
                </SelectTrigger>
                <SelectContent>
                  {labores.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-operario">Operario asignado</Label>
              <Select value={operarioId} onValueChange={setOperarioId}>
                <SelectTrigger id="cr-operario" className="min-h-12 w-full">
                  <SelectValue placeholder="Operario" />
                </SelectTrigger>
                <SelectContent>
                  {operarios.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cr-frecuencia">Se repite</Label>
                <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as FrecuenciaCronograma)}>
                  <SelectTrigger id="cr-frecuencia" className="min-h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Por días</SelectItem>
                    <SelectItem value="semanal">Por semanas</SelectItem>
                    <SelectItem value="mensual">Por meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-intervalo">Cada ({UNIDAD[frecuencia]})</Label>
                <NumericInput
                  id="cr-intervalo"
                  integer
                  className="min-h-12"
                  value={intervalo}
                  onValueChange={setIntervalo}
                  required
                />
              </div>
            </div>

            {frecuencia === "semanal" ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Días de la semana</legend>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((d) => {
                    const activo = dias.includes(d.valor);
                    return (
                      <button
                        key={d.valor}
                        type="button"
                        aria-pressed={activo}
                        aria-label={d.nombre}
                        data-dia={d.valor}
                        onClick={() => alternarDia(d.valor)}
                        className={cn(
                          "size-11 rounded-full border text-sm font-semibold",
                          activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                        )}
                      >
                        {d.corto}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cr-inicio">Fecha de inicio</Label>
                <DatePickerField id="cr-inicio" value={inicio} onChange={setInicio} triggerClassName="min-h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-fin">Fecha final (opcional)</Label>
                <DatePickerField id="cr-fin" value={fin} onChange={setFin} placeholder="Sin fecha final" triggerClassName="min-h-12" />
                {fin ? (
                  <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setFin("")}>
                    Quitar fecha final
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-notas">Instrucciones para el operario (opcional)</Label>
              <Textarea id="cr-notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={5000} />
            </div>

            <div className="rounded-xl border bg-muted/20 p-3 text-sm" data-testid="vista-previa-cronograma">
              <p className="font-medium">Próximas fechas</p>
              <p className="text-muted-foreground">
                {vistaPrevia.length > 0 ? vistaPrevia.map(formatoFecha).join(", ") : "Esta regla no genera fechas."}
              </p>
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAbierto(false)} disabled={pendiente}>
                Cancelar
              </Button>
              <Button type="submit" className="min-h-11" disabled={pendiente || vistaPrevia.length === 0}>
                {pendiente ? "Guardando…" : "Guardar cronograma"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(porAnular)} onOpenChange={(o) => !o && setPorAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular cronograma</DialogTitle>
            <DialogDescription>
              {porAnular ? `${porAnular.labor_nombre} · ${porAnular.lote_codigo}. ` : ""}
              Se anulan las labores futuras pendientes. Las ya ejecutadas se conservan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setPorAnular(null)}>
              Volver
            </Button>
            <Button type="button" variant="destructive" className="min-h-11" disabled={pendiente} data-requiere-conexion onClick={() => void anular()}>
              Anular cronograma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
