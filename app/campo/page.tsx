import Link from "next/link";
import { ArrowRight, ClipboardCheck, ShieldAlert, Tractor } from "lucide-react";
import { loadCampoContext } from "@/lib/campo/page-data";
import { CampoLocked } from "@/components/campo/campo-locked";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Campo | SIG-Palma",
};

export default async function CampoHomePage() {
  const ctx = await loadCampoContext();
  const profile = ctx.session?.profile ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Resumen operativo
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Entradas de captura
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Abra el formulario que corresponda a la labor realizada, la cosecha
              registrada o la novedad fitosanitaria detectada.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
              <Tractor className="mx-auto size-4 text-primary" />
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Labor
              </p>
            </div>
            <div className="rounded-2xl bg-background/80 px-3 py-3 text-center ring-1 ring-border/70">
              <ClipboardCheck className="mx-auto size-4 text-primary" />
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Cosecha
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

      {!ctx.canRecord ? <CampoLocked profile={profile} /> : null}

      <ul className="grid gap-3 md:grid-cols-3">
        <li>
          <Link
            href="/campo/labor"
            className="surface-panel group flex min-h-[170px] flex-col justify-between rounded-[1.75rem] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35"
          >
            <div className="rounded-2xl bg-primary/10 p-3 text-primary w-fit">
              <Tractor className="size-5" />
            </div>
            <div>
              <span className="font-medium text-foreground">Registrar labor</span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                Fertilización, poda, malezas y otras actividades agronómicas.
              </span>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              Abrir flujo
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/campo/cosecha"
            className="surface-panel group flex min-h-[170px] flex-col justify-between rounded-[1.75rem] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35"
          >
            <div className="rounded-2xl bg-primary/10 p-3 text-primary w-fit">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <span className="font-medium text-foreground">Cosecha RFF</span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                Registre racimos, peso y observaciones del lote.
              </span>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              Abrir flujo
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/campo/alerta"
            className="surface-panel group flex min-h-[170px] flex-col justify-between rounded-[1.75rem] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35"
          >
            <div className="rounded-2xl bg-primary/10 p-3 text-primary w-fit">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <span className="font-medium text-foreground">Alerta fitosanitaria</span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                Reporte incidencias MIP y deje el lote marcado para revisión.
              </span>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              Abrir flujo
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
      </ul>

      <Button asChild variant="outline" className="min-h-12 w-full rounded-2xl bg-background/80 sm:w-auto">
        <Link href="/fincas">Ver fincas y lotes</Link>
      </Button>
    </div>
  );
}
