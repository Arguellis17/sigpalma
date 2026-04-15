import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Leaf, PencilLine, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getSessionProfile,
  canManageLotes,
  isAdmin,
} from "@/lib/auth/session-profile";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ fincaId: string; loteId: string }>;
};

function shortId(uuid: string) {
  return uuid.slice(0, 8);
}

export default async function LoteDetallePage({ params }: Props) {
  const { fincaId, loteId } = await params;
  const supabase = await createClient();
  const session = await getSessionProfile();

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("*")
    .eq("id", loteId)
    .eq("finca_id", fincaId)
    .maybeSingle();

  if (loteErr || !lote) {
    notFound();
  }

  const { data: finca } = await supabase
    .from("fincas")
    .select("nombre")
    .eq("id", fincaId)
    .single();

  const { data: labores } = await supabase
    .from("labores_agronomicas")
    .select("id, tipo, fecha_ejecucion, notas, is_voided, created_at")
    .eq("lote_id", loteId)
    .order("fecha_ejecucion", { ascending: false })
    .limit(25);

  const { data: cosechas } = await supabase
    .from("cosechas_rff")
    .select(
      "id, fecha, peso_kg, conteo_racimos, is_voided, observaciones_calidad, created_at"
    )
    .eq("lote_id", loteId)
    .order("fecha", { ascending: false })
    .limit(25);

  const { data: alertas } = await supabase
    .from("alertas_fitosanitarias")
    .select(
      "id, severidad, descripcion, lote_estado_alerta, is_voided, created_at"
    )
    .eq("lote_id", loteId)
    .order("created_at", { ascending: false })
    .limit(25);

  const showEdit =
    session?.profile &&
    canManageLotes(session.profile) &&
    (isAdmin(session.profile) || session.profile.finca_id === fincaId);

  return (
    <div className="flex flex-col gap-4">
        <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" className="min-h-11 rounded-2xl bg-background/80">
                  <Link href={`/fincas/${fincaId}`}>
                    <ArrowLeft className="size-4" />
                    {finca?.nombre ?? "Finca"}
                  </Link>
                </Button>
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  Historial por lote
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Lote {lote.codigo}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Revise la ficha técnica y el historial reciente del lote.
                </p>
              </div>
              {showEdit ? (
                <Button asChild className="min-h-12 rounded-2xl shadow-lg shadow-primary/15">
                  <Link href={`/fincas/${fincaId}/lotes/${loteId}/editar`}>
                    <PencilLine className="size-4" />
                    Editar lote
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
                <Leaf className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Lote
                </p>
              </div>
              <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
                <ClipboardCheck className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Registros
                </p>
              </div>
              <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
                <ShieldAlert className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  MIP
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Ficha del lote</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70">
              <dt className="text-muted-foreground">Área</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {Number(lote.area_ha).toLocaleString("es-CO", {
                  maximumFractionDigits: 4,
                })}{" "}
                ha
              </dd>
            </div>
            <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70">
              <dt className="text-muted-foreground">Año de siembra</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{lote.anio_siembra}</dd>
            </div>
            {lote.material_genetico ? (
              <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70 sm:col-span-2">
                <dt className="text-muted-foreground">Material genético</dt>
                <dd className="mt-1 text-foreground">{lote.material_genetico}</dd>
              </div>
            ) : null}
            {lote.densidad_palmas_ha != null ? (
              <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70">
                <dt className="text-muted-foreground">Densidad (palmas/ha)</dt>
                <dd className="mt-1 text-foreground">
                  {Number(lote.densidad_palmas_ha).toLocaleString("es-CO")}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <HistorialSection
          title="Labores agronómicas"
          empty="Sin labores registradas en este lote."
          rows={labores ?? []}
          render={(row) => (
            <li
              key={row.id}
              className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{row.tipo}</span>
                <time className="text-sm text-muted-foreground" dateTime={row.fecha_ejecucion}>
                  {row.fecha_ejecucion}
                </time>
              </div>
              {row.notas ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.notas}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Ref. {shortId(row.id)}
                {row.is_voided ? " · Anulado" : ""}
              </p>
            </li>
          )}
        />

        <HistorialSection
          title="Cosecha RFF"
          empty="Sin registros de cosecha."
          rows={cosechas ?? []}
          render={(row) => (
            <li
              key={row.id}
              className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">
                  {Number(row.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  kg · {row.conteo_racimos} racimos
                </span>
                <time className="text-sm text-muted-foreground" dateTime={row.fecha}>
                  {row.fecha}
                </time>
              </div>
              {row.observaciones_calidad ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {row.observaciones_calidad}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Ref. {shortId(row.id)}
                {row.is_voided ? " · Anulado" : ""}
              </p>
            </li>
          )}
        />

        <HistorialSection
          title="Alertas fitosanitarias (MIP)"
          empty="Sin alertas registradas."
          rows={alertas ?? []}
          render={(row) => (
            <li
              key={row.id}
              className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium capitalize text-foreground">
                  {row.severidad}
                  {row.lote_estado_alerta ? " · Alerta activa" : ""}
                </span>
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={row.created_at}
                >
                  {new Date(row.created_at).toLocaleString("es-CO")}
                </time>
              </div>
              {row.descripcion ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.descripcion}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Ref. {shortId(row.id)}
                {row.is_voided ? " · Anulado" : ""}
              </p>
            </li>
          )}
        />
    </div>
  );
}

function HistorialSection<T extends { id: string }>({
  title,
  empty,
  rows,
  render,
}: {
  title: string;
  empty: string;
  rows: T[];
  render: (row: T) => ReactNode;
}) {
  return (
    <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {!rows.length ? (
        <p className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">{rows.map((row) => render(row))}</ul>
      )}
    </section>
  );
}
