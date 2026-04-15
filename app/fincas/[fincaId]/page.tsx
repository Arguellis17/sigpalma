import Link from "next/link";
import { ArrowLeft, ArrowRight, Blocks, MapPinned, PencilLine, Plus, Sprout } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getSessionProfile,
  canManageLotes,
  isAdmin,
} from "@/lib/auth/session-profile";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ fincaId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { fincaId } = await params;
  return {
    title: `Finca | SIG-Palma`,
    description: `Detalle finca ${fincaId}`,
  };
}

export default async function FincaDetailPage({ params }: Props) {
  const { fincaId } = await params;
  const supabase = await createClient();
  const session = await getSessionProfile();

  const { data: finca, error: fincaErr } = await supabase
    .from("fincas")
    .select("*")
    .eq("id", fincaId)
    .maybeSingle();

  if (fincaErr || !finca) {
    notFound();
  }

  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, codigo, area_ha, anio_siembra, material_genetico")
    .eq("finca_id", fincaId)
    .order("codigo");

  const showNewLote =
    session?.profile &&
    canManageLotes(session.profile) &&
    (isAdmin(session.profile) || session.profile.finca_id === fincaId);

  const showEditFinca =
    session?.profile && isAdmin(session.profile);

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="min-h-11 rounded-2xl bg-background/80">
                <Link href="/fincas">
                  <ArrowLeft className="size-4" />
                  Fincas
                </Link>
              </Button>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                Detalle
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {finca.nombre}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                Revise los datos base de la finca y entre a los lotes disponibles para
                consultar historial o realizar cambios.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {showEditFinca ? (
                <Button asChild variant="secondary" className="min-h-12 rounded-2xl">
                  <Link href={`/fincas/${fincaId}/editar`}>
                    <PencilLine className="size-4" />
                    Editar finca
                  </Link>
                </Button>
              ) : null}
              {showNewLote ? (
                <Button asChild className="min-h-12 rounded-2xl shadow-lg shadow-primary/15">
                  <Link href={`/fincas/${fincaId}/lotes/nuevo`}>
                    <Plus className="size-4" />
                    Nuevo lote
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
              <MapPinned className="mx-auto size-4 text-primary" />
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Finca
              </p>
            </div>
            <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
              <Blocks className="mx-auto size-4 text-primary" />
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Lotes
              </p>
            </div>
            <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
              <Sprout className="mx-auto size-4 text-primary" />
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Historial
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen de finca</h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70">
              <dt className="text-muted-foreground">Área total</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {Number(finca.area_ha).toLocaleString("es-CO", {
                  maximumFractionDigits: 4,
                })}{" "}
                ha
              </dd>
            </div>
            {finca.ubicacion ? (
              <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70">
                <dt className="text-muted-foreground">Ubicación</dt>
                <dd className="mt-1 text-foreground">{finca.ubicacion}</dd>
              </div>
            ) : null}
            {finca.propietario ? (
              <div className="rounded-[1.5rem] bg-background/75 p-4 ring-1 ring-border/70">
                <dt className="text-muted-foreground">Propietario</dt>
                <dd className="mt-1 text-foreground">{finca.propietario}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Lotes</h2>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              {lotes?.length ?? 0} visibles
            </span>
          </div>
          {!lotes?.length ? (
            <p className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
              Aún no hay lotes registrados en esta finca.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {lotes.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/fincas/${fincaId}/lotes/${l.id}`}
                    className="group block rounded-[1.5rem] border border-border/70 bg-background/75 px-4 py-4 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background"
                  >
                    <span className="font-medium text-foreground">{l.codigo}</span>
                    <span className="mt-1 block leading-6 text-muted-foreground">
                      {Number(l.area_ha).toLocaleString("es-CO", {
                        maximumFractionDigits: 4,
                      })}{" "}
                      ha · Siembra {l.anio_siembra}
                      {l.material_genetico ? ` · ${l.material_genetico}` : ""}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary">
                      Ver detalle e historial
                      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}
