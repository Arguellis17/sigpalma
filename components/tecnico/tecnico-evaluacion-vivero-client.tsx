"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  anularEvaluacionVivero,
  crearEvaluacionVivero,
  subirEvidenciaEvaluacionVivero,
} from "@/app/actions/evaluacion-vivero";
import type {
  EvaluacionViveroListRow,
  RegistroGerminacionListRow,
} from "@/app/actions/queries";
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

type Props = {
  fincaId: string;
  germinacionesDisponibles: RegistroGerminacionListRow[];
  historial: EvaluacionViveroListRow[];
};

export function TecnicoEvaluacionViveroClient({
  fincaId,
  germinacionesDisponibles,
  historial,
}: Props) {
  const router = useRouter();
  const [germinacionId, setGerminacionId] = useState(
    germinacionesDisponibles[0]?.id ?? ""
  );
  const [totalInicial, setTotalInicial] = useState("100");
  const [unidadesGerminadas, setUnidadesGerminadas] = useState("85");
  const [unidadesDescartadas, setUnidadesDescartadas] = useState("5");
  const [motivoDescarte, setMotivoDescarte] = useState("");
  const [obsFitosanitarias, setObsFitosanitarias] = useState("");
  const [concepto, setConcepto] = useState<"apto_trasplante" | "no_apto">(
    "apto_trasplante"
  );
  const [evidenciaPaths, setEvidenciaPaths] = useState<string[]>([]);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingVoid, setPendingVoid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const first = germinacionesDisponibles[0]?.id ?? "";
    setGerminacionId((prev) =>
      germinacionesDisponibles.some((g) => g.id === prev) ? prev : first
    );
  }, [germinacionesDisponibles]);

  async function onFilesChange(files: FileList | null) {
    setUploadMsg(null);
    if (!files?.length) return;
    const next: string[] = [...evidenciaPaths];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.set("finca_id", fincaId);
      fd.set("archivo", file);
      const up = await subirEvidenciaEvaluacionVivero(fd);
      if (!up.success) {
        setUploadMsg(up.error);
        return;
      }
      if (next.length >= 8) {
        setUploadMsg("Máximo 8 evidencias por evaluación.");
        break;
      }
      next.push(up.data.path);
    }
    setEvidenciaPaths(next);
    setUploadMsg(`${next.length} archivo(s) listos (bucket evidencia-tecnica).`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (
      !germinacionId ||
      !germinacionesDisponibles.some((g) => g.id === germinacionId)
    ) {
      setErr("Seleccione un registro de germinación sin evaluación activa.");
      return;
    }
    setPending(true);
    const res = await crearEvaluacionVivero({
      finca_id: fincaId,
      germinacion_id: germinacionId,
      total_inicial: Number(totalInicial),
      unidades_germinadas: Number(unidadesGerminadas),
      unidades_descartadas: Number(unidadesDescartadas),
      motivo_descarte: motivoDescarte.trim() || null,
      observaciones_fitosanitarias: obsFitosanitarias.trim() || null,
      concepto,
      evidencia_urls: evidenciaPaths,
    });
    setPending(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setMotivoDescarte("");
    setObsFitosanitarias("");
    setEvidenciaPaths([]);
    setUploadMsg(null);
    router.refresh();
  }

  async function onAnular(id: string) {
    if (!confirm("¿Anular esta evaluación? Quedará marcada como anulada.")) return;
    setPendingVoid(id);
    const res = await anularEvaluacionVivero({ id });
    setPendingVoid(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="surface-panel space-y-4 rounded-2xl p-5 sm:p-6"
      >
        <h3 className="text-lg font-semibold text-foreground">Nueva evaluación</h3>
        <p className="text-sm text-muted-foreground">
          Solo aparecen germinaciones sin evaluación activa. Las rutas de evidencia se guardan en el
          bucket evidencia-tecnica.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Germinación</Label>
            {germinacionesDisponibles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                No hay germinaciones sin evaluación activa. Registre primero la germinación (operario)
                o anule una evaluación existente para volver a evaluar.
              </p>
            ) : (
              <Select value={germinacionId} onValueChange={setGerminacionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione registro…" />
                </SelectTrigger>
                <SelectContent>
                  {germinacionesDisponibles.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.material_nombre} · {g.fecha_tratamiento}
                      {g.lote_codigo ? ` · lote ${g.lote_codigo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ti">Total inicial (unidades)</Label>
            <Input
              id="ti"
              type="number"
              min={1}
              value={totalInicial}
              onChange={(e) => setTotalInicial(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ug">Unidades germinadas</Label>
            <Input
              id="ug"
              type="number"
              min={0}
              value={unidadesGerminadas}
              onChange={(e) => setUnidadesGerminadas(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ud">Unidades descartadas</Label>
            <Input
              id="ud"
              type="number"
              min={0}
              value={unidadesDescartadas}
              onChange={(e) => setUnidadesDescartadas(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Concepto</Label>
            <Select
              value={concepto}
              onValueChange={(v) => setConcepto(v as "apto_trasplante" | "no_apto")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apto_trasplante">Apto para trasplante</SelectItem>
                <SelectItem value="no_apto">No apto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo descarte (si hay descartes)</Label>
          <Textarea
            id="motivo"
            value={motivoDescarte}
            onChange={(e) => setMotivoDescarte(e.target.value)}
            rows={2}
            maxLength={5000}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs">Observaciones fitosanitarias</Label>
          <Textarea
            id="obs"
            value={obsFitosanitarias}
            onChange={(e) => setObsFitosanitarias(e.target.value)}
            rows={2}
            maxLength={5000}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fotos">Evidencia fotográfica (opcional)</Label>
          <Input
            id="fotos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => onFilesChange(e.target.files)}
          />
          {uploadMsg ? (
            <p className="text-xs text-muted-foreground">{uploadMsg}</p>
          ) : null}
        </div>
        {err ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {err}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={
            pending ||
            germinacionesDisponibles.length === 0 ||
            !germinacionesDisponibles.some((g) => g.id === germinacionId)
          }
        >
          {pending ? "Guardando…" : "Registrar evaluación"}
        </Button>
      </form>

      <div className="surface-panel overflow-hidden rounded-2xl">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="font-semibold text-foreground">Historial</h3>
        </div>
        {historial.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No hay evaluaciones registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">% germ.</th>
                  <th className="px-4 py-3">Evid.</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      i % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.material_nombre}</td>
                    <td className="px-4 py-3">
                      {r.concepto === "apto_trasplante" ? "Apto" : "No apto"}
                    </td>
                    <td className="px-4 py-3">
                      {r.pct_germinacion !== null ? `${r.pct_germinacion.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">{r.evidencia_count}</td>
                    <td className="px-4 py-3">
                      {r.is_voided ? (
                        <span className="text-muted-foreground">Anulada</span>
                      ) : (
                        <span className="font-medium text-foreground">Activa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!r.is_voided ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pendingVoid === r.id}
                          onClick={() => onAnular(r.id)}
                        >
                          {pendingVoid === r.id ? "…" : "Anular"}
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
