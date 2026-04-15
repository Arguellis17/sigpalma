import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, UserPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Registrar usuario | SIG-Palma",
  description: "Alta de usuarios (solo administrador)",
};

export default async function RegisterPage() {
  const session = await getSessionProfile();
  if (!session?.profile) {
    redirect(
      `/auth/login?redirectTo=${encodeURIComponent("/auth/register")}`
    );
  }
  if (!isAdmin(session.profile)) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, nombre")
    .order("nombre");

  return (
    <div className="app-shell-bg min-h-dvh px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-7xl gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <section className="fade-up-enter order-2 flex flex-col gap-4 lg:order-1">
          <div className="surface-panel rounded-[2rem] p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Administración
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                Alta de usuarios
              </span>
            </div>

            <div className="mt-6 max-w-2xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Alta de usuarios
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                El administrador define el rol y, cuando aplica, la finca asociada
                al usuario para dejar su acceso operativo desde el primer ingreso.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-background/80 p-4 ring-1 ring-border/70">
                <ShieldCheck className="size-5 text-primary" />
                <p className="mt-3 font-semibold text-foreground">Provisionamiento seguro</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  La creación usa `service_role` solo en servidor; no se expone nada sensible al cliente.
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-background/80 p-4 ring-1 ring-border/70">
                <UserPlus className="size-5 text-primary" />
                <p className="mt-3 font-semibold text-foreground">Asignación precisa</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Los roles distintos de admin quedan vinculados a su finca para operar de inmediato.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="lg" className="min-h-12 rounded-2xl bg-background/80 px-4">
              <Link href="/">Volver al dashboard</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="min-h-12 rounded-2xl px-4">
              <Link href="/auth/login">
                Ir al login
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="order-1 flex justify-end lg:order-2">
          <RegisterForm fincas={fincas ?? []} />
        </section>
      </div>
    </div>
  );
}
