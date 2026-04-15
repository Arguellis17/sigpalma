import Link from "next/link";
import { ArrowRight, Blocks, MapPinned, Plus, Sprout } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Fincas | SIG-Palma",
};

export default async function FincasPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();

  const { data: fincas, error } = await supabase
    .from("fincas")
    .select("id, nombre, area_ha, ubicacion")
    .order("nombre");

  const admin = isAdmin(session?.profile ?? null);
  const roleLabel = session?.profile?.role ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Inventario visible
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                Rol: {roleLabel}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Fincas y lotes
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                Consulte la estructura productiva disponible para su perfil y entre al
                detalle de cada finca para revisar lotes e historial.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="min-h-12 rounded-2xl bg-background/80">
                <Link href="/">Ir al dashboard</Link>
              </Button>
              {admin ? (
                <Button asChild className="min-h-12 rounded-2xl shadow-lg shadow-primary/15">
                  <Link href="/fincas/nueva">
                    <Plus className="size-4" />
                    Nueva finca
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
              <MapPinned className="mx-auto size-4 text-primary" />
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Fincas
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

      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 p-4 text-sm text-red-800">
          {error.message}
        </p>
      ) : null}

      {!fincas?.length ? (
        <p className="surface-panel rounded-[1.75rem] p-6 text-sm leading-7 text-muted-foreground">
          No hay fincas visibles con su cuenta. Si es operario o agrónomo, un
          administrador debe asignarle una finca en el perfil.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {fincas.map((f) => (
            <li key={f.id}>
              <Link
                href={`/fincas/${f.id}`}
                className="surface-panel group block min-h-[180px] rounded-[1.75rem] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35"
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div>
                    <div className="w-fit rounded-2xl bg-primary/10 p-3 text-primary">
                      <MapPinned className="size-5" />
                    </div>
                    <span className="mt-4 block font-semibold text-foreground">{f.nombre}</span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      {Number(f.area_ha).toLocaleString("es-CO", {
                        maximumFractionDigits: 4,
                      })}{" "}
                      ha
                      {f.ubicacion ? ` · ${f.ubicacion}` : ""}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                    Abrir detalle
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
