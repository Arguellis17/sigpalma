"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Calculator, Download, Eye, Plus, Trash2, Wallet } from "lucide-react";
import {
  anularLiquidacion,
  anularTarifa,
  calcularLiquidacion,
  cerrarLiquidacion,
  guardarTarifa,
  obtenerLiquidacion,
  type LiquidacionCompleta,
  type LiquidacionRow,
  type TarifaRow,
} from "@/app/actions/jornales";
import type { CatalogoLaborOption } from "@/app/actions/queries";
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
import { todayColombiaYmd } from "@/lib/date-colombia";
import {
  consolidarPorTrabajador,
  formatCantidadPago,
  formatoCop,
  idFila,
  labelTarifa,
  NOMBRE_TARIFA_COSECHA,
  UNIDADES_PAGO_COSECHA,
  UNIDADES_PAGO_LABOR,
  tarifasFaltantes,
  totalLiquidacion,
  type FilaLiquidacion,
} from "@/lib/jornales";
import { cn } from "@/lib/utils";

type Pestana = "liquidar" | "tarifas" | "historial";

const COSECHA = "__cosecha__";

type Props = {
  tarifas: TarifaRow[];
  liquidaciones: LiquidacionRow[];
  labores: CatalogoLaborOption[];
};

/** Detalle por trabajador: desplegable para revisar cada labor antes de pagar. */
function DetallePorTrabajador({ filas }: { filas: FilaLiquidacion[] }) {
  const trabajadores = useMemo(() => consolidarPorTrabajador(filas), [filas]);
  return (
    <ul className="flex flex-col gap-2">
      {trabajadores.map((t) => (
        <li key={t.trabajador_id} className="surface-panel rounded-xl" data-testid="trabajador-liquidacion">
          <details>
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.trabajador_nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {t.trabajador_documento ? `Doc. ${t.trabajador_documento} · ` : ""}
                  {t.labores} {t.labores === 1 ? "labor" : "labores"}
                  {t.sin_tarifa > 0 ? ` · ${t.sin_tarifa} sin tarifa` : ""}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatoCop(t.total)}</span>
            </summary>
            <div className="overflow-x-auto border-t px-4 py-3">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Fecha</th>
                    <th className="py-1 pr-3 font-medium">Labor</th>
                    <th className="py-1 pr-3 font-medium">Lote</th>
                    <th className="py-1 pr-3 text-right font-medium">Cantidad</th>
                    <th className="py-1 pr-3 text-right font-medium">Tarifa</th>
                    <th className="py-1 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {t.filas.map((f) => (
                    <tr key={idFila(f)} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{f.fecha}</td>
                      <td className="py-1.5 pr-3">{f.labor_nombre}</td>
                      <td className="py-1.5 pr-3">{f.lote_codigo}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatCantidadPago(f.cantidad, f.unidad_medida)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {f.valor_unitario == null ? <span className="text-amber-700 dark:text-amber-300">Sin tarifa</span> : formatoCop(f.valor_unitario)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{f.subtotal == null ? "—" : formatoCop(f.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function JornalesClient({ tarifas, liquidaciones, labores }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const hoy = todayColombiaYmd();
  const [pestana, setPestana] = useState<Pestana>("liquidar");
  const [pendiente, setPendiente] = useState(false);

  // Liquidar
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoy);
  const [calculo, setCalculo] = useState<FilaLiquidacion[] | null>(null);
  const [errorCalculo, setErrorCalculo] = useState<string | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const faltantes = useMemo(() => tarifasFaltantes(calculo ?? []), [calculo]);
  const totalCalculo = useMemo(() => totalLiquidacion(calculo ?? []), [calculo]);

  // Tarifas
  const [laborTarifa, setLaborTarifa] = useState(labores[0]?.id ?? "");
  const [unidadTarifa, setUnidadTarifa] = useState<string>(UNIDADES_PAGO_LABOR[0]);
  // La cosecha se paga por lo cosechado (kilo o racimo) y no depende de una labor del catálogo.
  const esCosecha = laborTarifa === COSECHA;
  const unidadesTarifa: readonly string[] = esCosecha ? UNIDADES_PAGO_COSECHA : UNIDADES_PAGO_LABOR;
  function elegirLaborTarifa(v: string) {
    setLaborTarifa(v);
    const unidades: readonly string[] = v === COSECHA ? UNIDADES_PAGO_COSECHA : UNIDADES_PAGO_LABOR;
    if (!unidades.includes(unidadTarifa)) setUnidadTarifa(unidades[0]);
  }
  const [valorTarifa, setValorTarifa] = useState("");
  const [vigenciaTarifa, setVigenciaTarifa] = useState(hoy);
  const [errorTarifa, setErrorTarifa] = useState<string | null>(null);

  // Historial
  const [verLiquidacion, setVerLiquidacion] = useState<LiquidacionCompleta | null>(null);
  const [porAnular, setPorAnular] = useState<LiquidacionRow | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorAnular, setErrorAnular] = useState<string | null>(null);

  function cambiarPeriodo(set: (v: string) => void, valor: string) {
    set(valor);
    setCalculo(null);
    setErrorCalculo(null);
  }

  async function calcular() {
    setPendiente(true);
    setErrorCalculo(null);
    const res = await calcularLiquidacion({ desde, hasta });
    setPendiente(false);
    if (!res.success) {
      setCalculo(null);
      setErrorCalculo(res.error);
      return;
    }
    setCalculo(res.data);
  }

  async function cerrar() {
    setPendiente(true);
    const res = await cerrarLiquidacion({ desde, hasta });
    setPendiente(false);
    setConfirmarCierre(false);
    if (!res.success) {
      setErrorCalculo(res.error);
      return;
    }
    setCalculo(null);
    toast("Liquidación cerrada.", "success");
    setPestana("historial");
    router.refresh();
  }

  async function agregarTarifa(e: React.FormEvent) {
    e.preventDefault();
    setErrorTarifa(null);
    setPendiente(true);
    const res = await guardarTarifa({
      catalogo_item_id: esCosecha ? null : laborTarifa,
      unidad_medida: unidadTarifa,
      valor_unitario: Number(valorTarifa),
      vigente_desde: vigenciaTarifa,
    });
    setPendiente(false);
    if (!res.success) {
      setErrorTarifa(res.error);
      return;
    }
    setValorTarifa("");
    setCalculo(null);
    toast("Tarifa guardada.", "success");
    router.refresh();
  }

  async function quitarTarifa(id: string) {
    setPendiente(true);
    const res = await anularTarifa({ id });
    setPendiente(false);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    setCalculo(null);
    toast("Tarifa anulada.", "success");
    router.refresh();
  }

  async function ver(id: string) {
    setPendiente(true);
    const res = await obtenerLiquidacion(id);
    setPendiente(false);
    if (!res.success) {
      toast(res.error, "error");
      return;
    }
    setVerLiquidacion(res.data);
  }

  async function confirmarAnulacion() {
    if (!porAnular) return;
    setPendiente(true);
    setErrorAnular(null);
    const res = await anularLiquidacion({ id: porAnular.id, motivo });
    setPendiente(false);
    if (!res.success) {
      setErrorAnular(res.error);
      return;
    }
    setPorAnular(null);
    setMotivo("");
    toast("Liquidación anulada. Sus labores se pueden volver a liquidar.", "success");
    router.refresh();
  }

  const PESTANAS: { id: Pestana; texto: string }[] = [
    { id: "liquidar", texto: "Liquidar" },
    { id: "tarifas", texto: `Tarifas (${tarifas.length})` },
    { id: "historial", texto: `Historial (${liquidaciones.length})` },
  ];

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Secciones de jornales" className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm font-semibold",
              pestana === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
            )}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {pestana === "liquidar" ? (
        <section className="space-y-4">
          <div className="surface-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-52">
              <Label htmlFor="liq-desde">Desde</Label>
              <DatePickerField id="liq-desde" value={desde} onChange={(v) => cambiarPeriodo(setDesde, v)} triggerClassName="min-h-12" />
            </div>
            <div className="space-y-2 sm:w-52">
              <Label htmlFor="liq-hasta">Hasta</Label>
              <DatePickerField id="liq-hasta" value={hasta} onChange={(v) => cambiarPeriodo(setHasta, v)} triggerClassName="min-h-12" />
            </div>
            <Button type="button" className="min-h-12 gap-1.5" disabled={pendiente} data-requiere-conexion onClick={() => void calcular()}>
              <Calculator className="size-4" />
              {pendiente ? "Calculando…" : "Calcular"}
            </Button>
          </div>

          {errorCalculo ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm" role="alert">
              {errorCalculo}
            </p>
          ) : null}

          {calculo === null ? (
            <p className="text-sm text-muted-foreground">
              Elija el periodo y calcule. Solo entran labores ejecutadas que aún no se han liquidado.
            </p>
          ) : calculo.length === 0 ? (
            <p className="surface-panel rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No hay labores ejecutadas sin liquidar en este periodo.
            </p>
          ) : (
            <>
              {faltantes.length > 0 ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100" data-testid="tarifas-faltantes">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    Faltan tarifas: no se puede cerrar todavía
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {faltantes.map((f) => (
                      <li key={`${f.labor_nombre}-${f.unidad_medida}`}>
                        {f.labor_nombre}: {labelTarifa(f.unidad_medida).toLowerCase()} ({f.labores}{" "}
                        {f.labores === 1 ? "labor" : "labores"}), vigente desde {f.desde} o antes
                      </li>
                    ))}
                  </ul>
                  <Button type="button" variant="outline" className="mt-3 min-h-10" onClick={() => setPestana("tarifas")}>
                    Registrar tarifas
                  </Button>
                </div>
              ) : null}

              <DetallePorTrabajador filas={calculo} />

              <div className="surface-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <span className="block text-sm text-muted-foreground">Total a pagar</span>
                  <span className="text-2xl font-bold tabular-nums" data-testid="total-liquidacion">
                    {formatoCop(totalCalculo)}
                  </span>
                </p>
                <Button type="button" className="min-h-12 gap-1.5" disabled={pendiente || faltantes.length > 0} onClick={() => setConfirmarCierre(true)}>
                  <Wallet className="size-4" />
                  Cerrar liquidación
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {pestana === "tarifas" ? (
        <section className="space-y-4">
          <form onSubmit={agregarTarifa} className="surface-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="tar-labor">Labor</Label>
              <Select value={laborTarifa} onValueChange={elegirLaborTarifa}>
                <SelectTrigger id="tar-labor" className="min-h-12 w-full">
                  <SelectValue placeholder="Labor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COSECHA}>{NOMBRE_TARIFA_COSECHA}</SelectItem>
                  {labores.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tar-unidad">Cómo se paga</Label>
              <Select value={unidadTarifa} onValueChange={setUnidadTarifa}>
                <SelectTrigger id="tar-unidad" className="min-h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unidadesTarifa.map((u) => (
                    <SelectItem key={u} value={u}>
                      {labelTarifa(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tar-valor">Valor (COP)</Label>
              <NumericInput id="tar-valor" className="min-h-12" value={valorTarifa} onValueChange={setValorTarifa} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tar-desde">Vigente desde</Label>
              <DatePickerField id="tar-desde" value={vigenciaTarifa} onChange={setVigenciaTarifa} triggerClassName="min-h-12" />
            </div>
            <Button type="submit" className="min-h-12 gap-1.5" disabled={pendiente || !laborTarifa}>
              <Plus className="size-4" />
              Agregar
            </Button>
            {errorTarifa ? (
              <p className="text-sm font-medium text-destructive sm:col-span-2 lg:col-span-5" role="alert">
                {errorTarifa}
              </p>
            ) : null}
          </form>

          <p className="text-sm text-muted-foreground">
            Para cambiar un precio, agregue otra tarifa con la nueva fecha: las labores anteriores conservan su valor. Por jornal se
            paga un día por trabajador aunque haga varias labores. Si hay tarifa de cosecha, la labor «Cosecha RFF» de ese día no se
            paga aparte.
          </p>

          {tarifas.length === 0 ? (
            <p className="surface-panel rounded-2xl p-6 text-center text-sm text-muted-foreground">Aún no hay tarifas registradas.</p>
          ) : (
            <div className="surface-panel overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Labor</th>
                    <th className="p-3 font-medium">Unidad</th>
                    <th className="p-3 text-right font-medium">Valor</th>
                    <th className="p-3 font-medium">Vigente desde</th>
                    <th className="w-[1%] p-3" />
                  </tr>
                </thead>
                <tbody>
                  {tarifas.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 last:border-0">
                      <td className="p-3 font-medium">{t.labor_nombre}</td>
                      <td className="p-3">{labelTarifa(t.unidad_medida)}</td>
                      <td className="p-3 text-right tabular-nums">{formatoCop(t.valor_unitario)}</td>
                      <td className="p-3 whitespace-nowrap">{t.vigente_desde}</td>
                      <td className="p-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 text-destructive hover:text-destructive"
                          aria-label={`Anular tarifa de ${t.labor_nombre}`}
                          disabled={pendiente}
                          data-requiere-conexion
                          onClick={() => void quitarTarifa(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {pestana === "historial" ? (
        <section className="space-y-4">
          {liquidaciones.length === 0 ? (
            <p className="surface-panel rounded-2xl p-6 text-center text-sm text-muted-foreground">Aún no hay liquidaciones cerradas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {liquidaciones.map((l) => (
                <li key={l.id} className="surface-panel flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between" data-testid="liquidacion">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      Liquidación N.º {l.consecutivo}
                      {l.is_voided ? (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-500/20 dark:text-red-100">Anulada</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {l.periodo_desde} a {l.periodo_hasta} · {l.trabajadores} {l.trabajadores === 1 ? "trabajador" : "trabajadores"} · {l.labores} {l.labores === 1 ? "labor" : "labores"}
                    </p>
                    {l.motivo_anulacion ? <p className="text-sm text-muted-foreground">Motivo: {l.motivo_anulacion}</p> : null}
                    <p className={cn("text-lg font-bold tabular-nums", l.is_voided && "text-muted-foreground line-through")}>{formatoCop(l.total)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-10 gap-1.5" disabled={pendiente} data-requiere-conexion onClick={() => void ver(l.id)}>
                      <Eye className="size-3.5" />
                      Ver detalle
                    </Button>
                    <Button variant="outline" className="min-h-10 gap-1.5" asChild>
                      <a href={`/api/v1/jornales/${l.id}/xlsx`}>
                        <Download className="size-3.5" />
                        Excel
                      </a>
                    </Button>
                    {!l.is_voided ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-10 gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => {
                          setPorAnular(l);
                          setMotivo("");
                          setErrorAnular(null);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Anular
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <Dialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar liquidación</DialogTitle>
            <DialogDescription>
              {desde} a {hasta}: {calculo?.length ?? 0} labores por {formatoCop(totalCalculo)}. Esas labores quedan pagadas y no se podrán
              cambiar ni volver a liquidar, salvo que anule esta liquidación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmarCierre(false)}>
              Volver
            </Button>
            <Button type="button" className="min-h-11" disabled={pendiente} data-requiere-conexion onClick={() => void cerrar()}>
              {pendiente ? "Cerrando…" : "Cerrar liquidación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(porAnular)} onOpenChange={(o) => !o && setPorAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular liquidación N.º {porAnular?.consecutivo}</DialogTitle>
            <DialogDescription>Sus labores quedarán libres para liquidarse de nuevo. El registro se conserva como anulado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="anular-motivo">Motivo</Label>
            <Textarea id="anular-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} />
          </div>
          {errorAnular ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {errorAnular}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setPorAnular(null)}>
              Volver
            </Button>
            <Button type="button" variant="destructive" className="min-h-11" disabled={pendiente} data-requiere-conexion onClick={() => void confirmarAnulacion()}>
              Anular liquidación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(verLiquidacion)} onOpenChange={(o) => !o && setVerLiquidacion(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Liquidación N.º {verLiquidacion?.consecutivo}</DialogTitle>
            <DialogDescription>
              {verLiquidacion?.periodo_desde} a {verLiquidacion?.periodo_hasta} · {formatoCop(verLiquidacion?.total ?? 0)}
            </DialogDescription>
          </DialogHeader>
          {verLiquidacion ? <DetallePorTrabajador filas={verLiquidacion.filas} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
