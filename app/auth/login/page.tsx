import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Leaf, ShieldCheck, Sprout, Waves } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión | SIG-Palma",
  description: "Acceso a SIG-Palma",
};

type Props = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams;

  return (
    <div className="app-shell-bg min-h-dvh px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-7xl gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <section className="fade-up-enter order-2 flex flex-col gap-4 lg:order-1">
          <div className="surface-panel rounded-[2rem] p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                SIG-Palma
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                Acceso al sistema
              </span>
            </div>

            <div className="mt-6 max-w-2xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Ingreso de usuarios
              </h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                Use la cuenta asignada por administración para entrar al sistema y
                trabajar según su rol y la finca autorizada.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-background/80 p-4 ring-1 ring-border/70">
                <ShieldCheck className="size-5 text-primary" />
                <p className="mt-3 font-semibold text-foreground">Sesión protegida</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Autenticación con Supabase SSR y renovación de cookies en proxy.
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-background/80 p-4 ring-1 ring-border/70">
                <Leaf className="size-5 text-primary" />
                <p className="mt-3 font-semibold text-foreground">Acceso por rol</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Cada usuario ve solo los módulos y datos permitidos por su perfil.
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-background/80 p-4 ring-1 ring-border/70">
                <Sprout className="size-5 text-primary" />
                <p className="mt-3 font-semibold text-foreground">Registro trazable</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Fincas, lotes y operaciones quedan ligados al flujo técnico del cultivo.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="surface-panel rounded-[1.75rem] p-4">
              <div className="flex items-start gap-3">
                <div className="float-gentle rounded-2xl bg-primary/12 p-3 text-primary">
                  <Waves className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Acceso institucional</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Esta pantalla queda lista para incorporar identidad visual sin cambiar la
                    estructura de acceso.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="surface-panel inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.75rem] px-5 text-sm font-medium text-foreground transition-transform duration-200 hover:-translate-y-0.5"
            >
              Ir al inicio
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="order-1 flex flex-col gap-4 lg:order-2 lg:items-end">
          <LoginForm redirectTo={redirectTo} />
          <div className="surface-panel fade-up-enter w-full max-w-md rounded-[1.75rem] p-4 text-sm text-muted-foreground [animation-delay:120ms]">
            ¿Administrador?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-primary underline underline-offset-4"
            >
              Registrar usuario
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
