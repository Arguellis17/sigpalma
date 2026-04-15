import Link from "next/link";
import { ClipboardCheck, ShieldAlert, Tractor } from "lucide-react";

export default function CampoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const linkClass =
    "inline-flex min-h-11 min-w-[min(100%,10rem)] items-center justify-center rounded-2xl border border-border/70 bg-background/80 px-4 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-background";

  return (
    <div className="flex flex-col gap-4">
      <header className="surface-panel sticky top-20 z-20 rounded-[1.75rem] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Campo
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  Registro diario
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Seleccione el flujo de captura que necesita para la jornada.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 self-start sm:self-auto">
              <div className="rounded-2xl bg-background/85 px-3 py-3 text-center ring-1 ring-border/70">
                <Tractor className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Labor
                </p>
              </div>
              <div className="rounded-2xl bg-background/85 px-3 py-3 text-center ring-1 ring-border/70">
                <ClipboardCheck className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cosecha
                </p>
              </div>
              <div className="rounded-2xl bg-background/85 px-3 py-3 text-center ring-1 ring-border/70">
                <ShieldAlert className="mx-auto size-4 text-primary" />
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Alerta
                </p>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" aria-label="Operaciones de campo">
            <Link href="/campo" className={linkClass}>
              Resumen
            </Link>
            <Link href="/campo/labor" className={linkClass}>
              Labor
            </Link>
            <Link href="/campo/cosecha" className={linkClass}>
              Cosecha RFF
            </Link>
            <Link href="/campo/alerta" className={linkClass}>
              Alerta MIP
            </Link>
          </nav>
        </div>
      </header>

      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}
