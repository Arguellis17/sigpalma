"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Eye, HeartPulse, Plus, Search } from "lucide-react";
import type { CatalogoFitosanidadOption } from "@/app/actions/queries";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { AlertaForm } from "@/components/campo/alerta-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export type AlertaListRow = {
  id: string;
  created_at: string;
  severidad: string;
  descripcion: string | null;
  validacion_estado: string | null;
  validacion_diagnostico: string | null;
  lote_codigo: string;
  amenaza: string | null;
  amenaza_categoria: string | null;
  evidencia_signed_urls: string[];
};

type Finca = { id: string; nombre: string };

type Props = {
  initialRows: AlertaListRow[];
  fincas: Finca[];
  defaultFincaId: string | null;
  catalogo: CatalogoFitosanidadOption[];
  catalogoPlagas: CatalogoFitosanidadOption[];
  catalogoEnfermedades: CatalogoFitosanidadOption[];
};

type FiltroTipo = "todos" | "plaga" | "enfermedad";

export function AlertasOperarioClient({
  initialRows,
  fincas,
  defaultFincaId,
  catalogo,
  catalogoPlagas,
  catalogoEnfermedades,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows] = useServerPropsState(initialRows);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPlagaOpen, setCreatePlagaOpen] = useState(false);
  const [createEnfermedadOpen, setCreateEnfermedadOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [viewRow, setViewRow] = useState<AlertaListRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroTipo === "plaga" && r.amenaza_categoria !== "plaga") return false;
      if (filtroTipo === "enfermedad" && r.amenaza_categoria !== "enfermedad") return false;
      if (!q) return true;
      const blob = `${r.lote_codigo} ${r.amenaza ?? ""} ${r.descripcion ?? ""} ${r.severidad} ${r.validacion_estado ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, filtroTipo]);

  function afterCreateEnfermedad() {
    setCreateEnfermedadOpen(false);
    toast("Reporte de enfermedad registrado.", "success");
    router.refresh();
  }

  function afterCreatePlaga() {
    setCreatePlagaOpen(false);
    toast("Reporte de plaga registrado.", "success");
    router.refresh();
  }

  function afterCreate() {
    setCreateOpen(false);
    toast("Alerta registrada.", "success");
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por lote, amenaza, descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setCreateKey((k) => k + 1);
              setCreatePlagaOpen(true);
            }}
          >
            <Bug className="size-4" />
            Reportar plaga
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setCreateKey((k) => k + 1);
              setCreateEnfermedadOpen(true);
            }}
          >
            <HeartPulse className="size-4" />
            Reportar enfermedad
          </Button>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setCreateKey((k) => k + 1);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            Otra alerta
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["todos", "Todas"],
            ["plaga", "Plagas"],
            ["enfermedad", "Enfermedades"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filtroTipo === value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFiltroTipo(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-14 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {search
              ? "No hay resultados para esa búsqueda."
              : "Aún no hay alertas en su finca. Use «Nueva alerta» para registrar un hallazgo."}
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Amenaza</th>
                  <th className="px-4 py-3">Severidad</th>
                  <th className="px-4 py-3">Validación</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      idx % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.lote_codigo}</td>
                    <td className="max-w-[200px] truncate px-4 py-3">{r.amenaza ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{r.severidad}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {r.validacion_estado ?? "pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setViewRow(r)}
                          aria-label="Ver detalle"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={createEnfermedadOpen} onOpenChange={(v) => !v && setCreateEnfermedadOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reporte de enfermedad</DialogTitle>
            <DialogDescription>
              Seleccione la enfermedad del catálogo, adjunte foto del síntoma y describa el
              hallazgo. El técnico validará el caso (RF15).
            </DialogDescription>
          </DialogHeader>
          <AlertaForm
            key={`enfermedad-${createKey}`}
            fincas={fincas}
            defaultFincaId={defaultFincaId}
            catalogo={catalogoEnfermedades}
            variant="enfermedad"
            embedded
            onSuccess={afterCreateEnfermedad}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={createPlagaOpen} onOpenChange={(v) => !v && setCreatePlagaOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reporte de plaga</DialogTitle>
            <DialogDescription>
              Seleccione la plaga del catálogo, adjunte al menos una foto y describa el hallazgo. El
              técnico validará el caso (RF15).
            </DialogDescription>
          </DialogHeader>
          <AlertaForm
            key={`plaga-${createKey}`}
            fincas={fincas}
            defaultFincaId={defaultFincaId}
            catalogo={catalogoPlagas}
            variant="plaga"
            embedded
            onSuccess={afterCreatePlaga}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva alerta fitosanitaria</DialogTitle>
            <DialogDescription>
              Registre el hallazgo en campo; el técnico validará el caso y definirá el seguimiento.
            </DialogDescription>
          </DialogHeader>
          <AlertaForm
            key={createKey}
            fincas={fincas}
            defaultFincaId={defaultFincaId}
            catalogo={catalogo}
            embedded
            onSuccess={afterCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de alerta</DialogTitle>
            <DialogDescription>
              Estado de validación y diagnóstico del técnico (si aplica).
            </DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Lote</dt>
                <dd className="mt-0.5 font-medium">{viewRow.lote_codigo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Fecha</dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {new Date(viewRow.created_at).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Amenaza</dt>
                <dd className="mt-0.5">
                  {viewRow.amenaza ?? "—"}
                  {viewRow.amenaza_categoria ? (
                    <span className="ml-1 text-muted-foreground">
                      ({viewRow.amenaza_categoria})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Severidad</dt>
                <dd className="mt-0.5 capitalize">{viewRow.severidad}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Descripción</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                  {viewRow.descripcion ?? "—"}
                </dd>
              </div>
              {viewRow.evidencia_signed_urls.length > 0 ? (
                <div>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Fotos</dt>
                  <dd className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {viewRow.evidencia_signed_urls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border border-border/60"
                      >
                        <img
                          src={url}
                          alt="Evidencia"
                          className="aspect-square w-full object-cover"
                        />
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Validación</dt>
                <dd className="mt-0.5">{viewRow.validacion_estado ?? "pendiente"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted-foreground">Diagnóstico</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                  {viewRow.validacion_diagnostico ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
