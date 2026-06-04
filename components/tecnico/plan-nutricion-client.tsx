"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  actualizarPlanNutricion,
  anularPlanNutricion,
  crearPlanNutricion,
} from "@/app/actions/plan-nutricion";
import {
  getPlanNutricionDetalle,
  getUltimoAnalisisSueloPorLote,
  type InsumoNutricionOption,
  type LoteOption,
  type PlanNutricionDetalle,
  type PlanNutricionListRow,
  type UltimoAnalisisSueloResumen,
} from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { parseDecimalInput } from "@/lib/numeric-input";
import { Label } from "@/components/ui/label";
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
import type { PlanNutricionItemInput, PlanRiegoItemInput } from "@/lib/validations/plan-nutricion";

const FRECUENCIAS = [
  { v: "once", l: "Una vez" },
  { v: "semanal", l: "Semanal" },
  { v: "quincenal", l: "Quincenal" },
  { v: "mensual", l: "Mensual" },
  { v: "personalizado", l: "Personalizado" },
] as const;

type Props = {
  fincaId: string;
  insumosNutricion: InsumoNutricionOption[];
  lotesActivos: LoteOption[];
  planesIniciales: PlanNutricionListRow[];
};

function emptyNutLine(firstInsumoId: string): PlanNutricionItemInput {
  return {
    catalogo_insumo_id: firstInsumoId,
    dosis_cantidad: 1,
    dosis_unidad: "por_ha",
    frecuencia: "once",
    fecha_objetivo: todayColombiaYmd(),
    notas: null,
  };
}

function emptyRiegoLine(): PlanRiegoItemInput {
  return {
    descripcion: "Riego por goteo / aspersión",
    intervalo_dias: 7,
    proxima_fecha: todayColombiaYmd(),
    volumen_o_tiempo: null,
    notas: null,
  };
}

export function PlanNutricionClient({
  fincaId,
  insumosNutricion,
  lotesActivos,
  planesIniciales: planes,
}: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [loteId, setLoteId] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<PlanNutricionItemInput[]>([]);
  const [riego, setRiego] = useState<PlanRiegoItemInput[]>([]);

  const [analisis, setAnalisis] = useState<UltimoAnalisisSueloResumen | null | undefined>(
    undefined
  );

  const [anularOpen, setAnularOpen] = useState(false);
  const [anularId, setAnularId] = useState<string | null>(null);

  const firstInsumo = insumosNutricion[0]?.id ?? "";

  const loadAnalisis = useCallback(async (lid: string) => {
    if (!lid) {
      setAnalisis(undefined);
      return;
    }
    const res = await getUltimoAnalisisSueloPorLote(lid);
    if (!res.success) {
      setAnalisis(undefined);
      return;
    }
    setAnalisis(res.data);
  }, []);

  useEffect(() => {
    if (dialogOpen && loteId) {
      void loadAnalisis(loteId);
    }
  }, [dialogOpen, loteId, loadAnalisis]);

  function resetFormForCreate() {
    setEditingId(null);
    const l0 = lotesActivos[0]?.id ?? "";
    setLoteId(l0);
    setNombre("");
    setFechaInicio("");
    setFechaFin("");
    setNotas("");
    if (firstInsumo) {
      setItems([emptyNutLine(firstInsumo)]);
    } else {
      setItems([]);
    }
    setRiego([]);
  }

  function openCreate() {
    resetFormForCreate();
    setDialogOpen(true);
  }

  async function openEdit(row: PlanNutricionListRow) {
    setLoadingDetalle(true);
    setDialogOpen(true);
    setEditingId(row.id);
    const det = await getPlanNutricionDetalle(row.id);
    setLoadingDetalle(false);
    if (!det.success) {
      toast(det.error, "error");
      setDialogOpen(false);
      setEditingId(null);
      return;
    }
    const d: PlanNutricionDetalle = det.data;
    setLoteId(d.lote_id);
    setNombre(d.nombre ?? "");
    setFechaInicio(d.fecha_inicio ?? "");
    setFechaFin(d.fecha_fin ?? "");
    setNotas(d.notas ?? "");
    setItems(
      d.items.length > 0
        ? d.items.map((it) => ({
            catalogo_insumo_id: it.catalogo_insumo_id,
            dosis_cantidad: Number(it.dosis_cantidad),
            dosis_unidad: it.dosis_unidad,
            frecuencia: it.frecuencia as PlanNutricionItemInput["frecuencia"],
            fecha_objetivo: it.fecha_objetivo,
            notas: it.notas,
          }))
        : []
    );
    setRiego(
      d.riego.length > 0
        ? d.riego.map((r) => ({
            descripcion: r.descripcion,
            intervalo_dias: r.intervalo_dias,
            proxima_fecha: r.proxima_fecha,
            volumen_o_tiempo: r.volumen_o_tiempo,
            notas: r.notas,
          }))
        : []
    );
  }

  const hayInsumos = insumosNutricion.length > 0;
  const hayLotes = lotesActivos.length > 0;

  const bloqueadoEdicion = useMemo(() => {
    if (!editingId) return false;
    const p = planes.find((x) => x.id === editingId);
    return Boolean(p?.locked_at);
  }, [editingId, planes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueadoEdicion) {
      toast("Este plan está bloqueado y no se puede editar.", "error");
      return;
    }
    if (!loteId) {
      toast("Seleccione un lote.", "error");
      return;
    }
    if (items.length === 0 && riego.length === 0) {
      toast("Agregue al menos una línea de fertilización o un evento de riego.", "error");
      return;
    }
    if (items.length > 0) {
      for (const it of items) {
        if (!it.catalogo_insumo_id) {
          toast("Complete el insumo en cada línea de fertilización.", "error");
          return;
        }
      }
    }

    setPending(true);
    const payload = {
      finca_id: fincaId,
      lote_id: loteId,
      nombre: nombre.trim() || null,
      fecha_inicio: fechaInicio.trim() || null,
      fecha_fin: fechaFin.trim() || null,
      notas: notas.trim() || null,
      items: items.map((it) => ({
        ...it,
        fecha_objetivo: it.fecha_objetivo?.trim() ? it.fecha_objetivo.trim() : null,
      })),
      riego,
    };

    if (!editingId) {
      const result = await crearPlanNutricion(payload);
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Plan de nutrición y riego registrado.");
    } else {
      const result = await actualizarPlanNutricion({ ...payload, id: editingId });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Plan actualizado.");
    }
    setDialogOpen(false);
    window.location.reload();
  }

  async function confirmarAnular() {
    if (!anularId) return;
    setPending(true);
    const result = await anularPlanNutricion({ id: anularId });
    setPending(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("Plan anulado.");
    setAnularOpen(false);
    setAnularId(null);
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={openCreate} disabled={!hayLotes}>
          Nuevo plan nutrición / riego
        </Button>
        {!hayLotes ? (
          <p className="text-sm text-muted-foreground">
            No hay lotes activos en su finca. Cree lotes desde administración.
          </p>
        ) : null}
      </div>

      {planes.length === 0 ? (
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          No hay planes vigentes. Use «Nuevo plan» para programar fertilización y riego por lote.
        </p>
      ) : (
        <div className="surface-panel overflow-hidden rounded-[1.5rem]">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 w-[1%]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{p.lote_codigo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.fecha_inicio ?? "—"} → {p.fecha_fin ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.locked_at ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Editable
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mr-1"
                      onClick={() => void openEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(p.locked_at)}
                      onClick={() => {
                        setAnularId(p.id);
                        setAnularOpen(true);
                      }}
                    >
                      Anular
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar plan nutrición / riego" : "Nuevo plan nutrición / riego"}
            </DialogTitle>
          </DialogHeader>
          {loadingDetalle ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Lote</Label>
                  <Select
                    value={loteId}
                    onValueChange={setLoteId}
                    disabled={Boolean(editingId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione lote" />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesActivos.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Análisis de suelo
                  </p>
                  {analisis === undefined ? (
                    <p className="text-sm text-muted-foreground">Cargando datos de suelo…</p>
                  ) : analisis === null ? (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      No hay análisis de suelo registrado para este lote. Se recomienda registrar uno
                      en{" "}
                      <Link
                        href={loteId ? `/tecnico/suelo?lote=${loteId}` : "/tecnico/suelo"}
                        className="underline font-medium"
                      >
                        Análisis de suelo
                      </Link>{" "}
                      antes de definir el plan de nutrición.
                    </p>
                  ) : (
                    <div className="text-sm text-foreground">
                      <p>
                        <span className="text-muted-foreground">Último análisis:</span>{" "}
                        {analisis.fecha_analisis}
                        {analisis.ph != null && String(analisis.ph).trim() !== "" ? (
                          <>
                            {" "}
                            · pH {analisis.ph}
                          </>
                        ) : null}
                        {analisis.humedad_pct != null &&
                        String(analisis.humedad_pct).trim() !== "" ? (
                          <>
                            {" "}
                            · Humedad {analisis.humedad_pct}%
                          </>
                        ) : null}
                        {analisis.compactacion != null &&
                        String(analisis.compactacion).trim() !== "" ? (
                          <>
                            {" "}
                            · Compact. {analisis.compactacion} MPa
                          </>
                        ) : null}
                        {analisis.cic != null && String(analisis.cic).trim() !== "" ? (
                          <>
                            {" "}
                            · CIC {analisis.cic}
                          </>
                        ) : null}
                        {analisis.materia_organica_pct != null &&
                        String(analisis.materia_organica_pct).trim() !== "" ? (
                          <>
                            {" "}
                            · MO {analisis.materia_organica_pct}%
                          </>
                        ) : null}
                        {analisis.textura?.trim() ? (
                          <>
                            {" "}
                            · {analisis.textura}
                          </>
                        ) : null}
                        {analisis.aluminio != null && String(analisis.aluminio).trim() !== "" ? (
                          <>
                            {" "}
                            · Al {analisis.aluminio}
                          </>
                        ) : null}
                        {analisis.drenaje_campo?.trim() ? (
                          <>
                            {" "}
                            · Drenaje: {analisis.drenaje_campo}
                          </>
                        ) : null}
                      </p>
                      {analisis.fertilidad_completa?.trim() ? (
                        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Fertilidad: </span>
                          {analisis.fertilidad_completa}
                        </p>
                      ) : null}
                      {analisis.nutrientes && Object.keys(analisis.nutrientes).length > 0 ? (
                        <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-background/80 p-2 text-xs">
                          {JSON.stringify(analisis.nutrientes, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pn-nombre">Nombre del plan (opcional)</Label>
                  <Input
                    id="pn-nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Campaña N 2026"
                    disabled={bloqueadoEdicion}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha inicio (opcional)</Label>
                  <DatePickerField
                    value={fechaInicio}
                    onChange={setFechaInicio}
                    disabled={bloqueadoEdicion}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin (opcional)</Label>
                  <DatePickerField
                    value={fechaFin}
                    onChange={setFechaFin}
                    disabled={bloqueadoEdicion}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pn-notas">Notas del plan</Label>
                  <Textarea
                    id="pn-notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={2}
                    disabled={bloqueadoEdicion}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Fertilización programada</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={bloqueadoEdicion || !hayInsumos}
                    onClick={() => {
                      if (!firstInsumo) return;
                      setItems((prev) => [...prev, emptyNutLine(firstInsumo)]);
                    }}
                  >
                    Añadir línea
                  </Button>
                </div>
                {!hayInsumos ? (
                  <p className="text-sm text-muted-foreground">
                    No hay insumos de nutrición en catálogo. Marque subcategorías con «nutrición» o
                    «fertilizante» en Insumos.
                  </p>
                ) : null}
                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Insumo (nutrición)</Label>
                        <Select
                          value={it.catalogo_insumo_id}
                          onValueChange={(v) => {
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, catalogo_insumo_id: v } : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {insumosNutricion.map((ins) => (
                              <SelectItem key={ins.id} value={ins.id}>
                                {ins.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Dosis (cantidad)</Label>
                        <NumericInput
                          value={String(it.dosis_cantidad)}
                          onValueChange={(raw) => {
                            const v = raw === "" ? 0 : (parseDecimalInput(raw) ?? 0);
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, dosis_cantidad: v } : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unidad</Label>
                        <Select
                          value={it.dosis_unidad}
                          onValueChange={(v) => {
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? { ...row, dosis_unidad: v as PlanNutricionItemInput["dosis_unidad"] }
                                  : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="por_ha">Por hectárea</SelectItem>
                            <SelectItem value="por_palma">Por palma</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Frecuencia</Label>
                        <Select
                          value={it.frecuencia}
                          onValueChange={(v) => {
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      frecuencia: v as PlanNutricionItemInput["frecuencia"],
                                    }
                                  : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FRECUENCIAS.map((f) => (
                              <SelectItem key={f.v} value={f.v}>
                                {f.l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha objetivo (opcional)</Label>
                        <DatePickerField
                          value={it.fecha_objetivo ?? ""}
                          onChange={(ymd) => {
                            setItems((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      fecha_objetivo: ymd.trim() ? ymd.trim() : null,
                                    }
                                  : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        />
                      </div>
                      <div className="flex items-end sm:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={bloqueadoEdicion || (items.length <= 1 && riego.length === 0)}
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Quitar línea
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Riego programado</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={bloqueadoEdicion}
                    onClick={() => setRiego((prev) => [...prev, emptyRiegoLine()])}
                  >
                    Añadir riego
                  </Button>
                </div>
                <div className="space-y-3">
                  {riego.map((r, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Descripción</Label>
                        <Input
                          value={r.descripcion}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRiego((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, descripcion: v } : row))
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Próxima fecha</Label>
                        <DatePickerField
                          value={r.proxima_fecha}
                          onChange={(ymd) => {
                            setRiego((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, proxima_fecha: ymd } : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Intervalo (días, opcional)</Label>
                        <NumericInput
                          integer
                          value={
                            r.intervalo_dias != null ? String(r.intervalo_dias) : ""
                          }
                          onValueChange={(raw) => {
                            setRiego((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      intervalo_dias:
                                        raw === ""
                                          ? null
                                          : (parseDecimalInput(raw) ?? null),
                                    }
                                  : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Volumen o tiempo (opcional)</Label>
                        <Input
                          value={r.volumen_o_tiempo ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim() || null;
                            setRiego((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, volumen_o_tiempo: v } : row
                              )
                            );
                          }}
                          disabled={bloqueadoEdicion}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={bloqueadoEdicion}
                          onClick={() => setRiego((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Quitar riego
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || bloqueadoEdicion}>
                  {pending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear plan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular plan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Confirma anular este plan? Las líneas asociadas se eliminarán del plan vigente.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAnularOpen(false)}>
              No
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmarAnular()}>
              Sí, anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
