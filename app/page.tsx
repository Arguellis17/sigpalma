import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Blocks,
  ClipboardCheck,
  Leaf,
  MapPinned,
  ShieldCheck,
  Sprout,
  Tractor,
  TriangleAlert,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

const roleLabels = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  agronomo: "Agrónomo",
  operario: "Operario",
} as const;

function formatCount(value: number | null) {
  return new Intl.NumberFormat("es-CO").format(value ?? 0);
}

export default async function Home() {
  const session = await getSessionProfile();
  const user = session?.user ?? null;
  const profile = session?.profile ?? null;
  const showRegister = Boolean(profile && isAdmin(profile));
  const supabase = await createClient();

  const [fincasResult, lotesResult, laboresResult, alertasResult] =
    await Promise.all([
      supabase.from("fincas").select("id", { count: "exact", head: true }),
      supabase.from("lotes").select("id", { count: "exact", head: true }),
      supabase
        .from("labores_agronomicas")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("alertas_fitosanitarias")
        .select("id", { count: "exact", head: true })
        .eq("lote_estado_alerta", true)
        .eq("is_voided", false),
    ]);

  const firstName =
    profile?.full_name.trim().split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "equipo";

  const overviewCards = [
    {
      label: "Fincas visibles",
      value: formatCount(fincasResult.count),
      detail: "Inventario territorial activo",
      icon: MapPinned,
    },
    {
      label: "Lotes trazables",
      value: formatCount(lotesResult.count),
      detail: "Unidades productivas bajo seguimiento",
      icon: Blocks,
    },
    {
      label: "Labores registradas",
      value: formatCount(laboresResult.count),
      detail: "Operaciones técnicas acumuladas",
      icon: ClipboardCheck,
    },
    {
      label: "Alertas activas",
      value: formatCount(alertasResult.count),
      detail: "Focos que requieren revisión",
      icon: TriangleAlert,
    },
  ];

  const quickActions = [
    {
      href: "/campo",
      title: "Operación de campo",
      description: "Registrar labor, cosecha RFF y alertas desde una interfaz táctil.",
      icon: Tractor,
    },
    {
      href: "/fincas",
      title: "Fincas y lotes",
      description: "Explorar estructura productiva, editar y entrar al historial por lote.",
      icon: Leaf,
    },
    ...(showRegister
      ? [
          {
            href: "/auth/register",
            title: "Gestión de usuarios",
            description: "Crear accesos por correo y asignar rol o finca según operación.",
            icon: Users,
          },
        ]
      : []),
  ];

  const statusPills = [
    {
      label: roleLabels[profile?.role ?? "operario"],
      tone: "bg-primary/12 text-primary",
    },
    {
      label: profile?.is_active ? "Cuenta activa" : "Revisión pendiente",
      tone: profile?.is_active
        ? "bg-emerald-500/10 text-emerald-700"
        : "bg-amber-500/10 text-amber-700",
    },
    ...(profile?.finca_id
      ? [{ label: "Con finca asignada", tone: "bg-secondary text-secondary-foreground" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Resumen del día
              </span>
              {statusPills.map((pill) => (
                <span
                  key={pill.label}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${pill.tone}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Hola, {firstName}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Estado general de la operación
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                Revise indicadores, entre al módulo que necesite y mantenga la
                captura diaria dentro del flujo de trazabilidad.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-12 rounded-2xl px-4 shadow-lg shadow-primary/20">
                <Link href="/campo">
                  Ir a campo
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 rounded-2xl bg-background/80 px-4">
                <Link href="/fincas">Ver fincas</Link>
              </Button>
              {showRegister ? (
                <Button asChild size="lg" variant="secondary" className="min-h-12 rounded-2xl px-4">
                  <Link href="/auth/register">Gestionar usuarios</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </article>

        <aside className="grid gap-4">
          <article className="surface-panel fade-up-enter rounded-[2rem] p-5 [animation-delay:90ms]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Sesión actual
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {user?.email ?? "Sin sesión"}
                </p>
              </div>
              <div className="rounded-2xl bg-primary/12 p-3 text-primary">
                <ShieldCheck className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              El acceso y la actualización de cookies se gestionan con Supabase SSR
              sobre la sesión activa.
            </p>
          </article>

          <article className="surface-panel fade-up-enter rounded-[2rem] p-5 [animation-delay:150ms]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Siguiente revisión
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  Alertas y registros pendientes
                </p>
              </div>
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-700">
                <BellRing className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Verifique alertas activas y confirme la captura de labores o cosechas
              antes del cierre de jornada.
            </p>
          </article>
        </aside>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className="surface-panel fade-up-enter rounded-[1.75rem] p-4 [animation-delay:calc(110ms+var(--idx)*45ms)]"
                style={{ ["--idx" as string]: index } as CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {card.label}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                      {card.value}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="size-5" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{card.detail}</p>
              </article>
            );
          })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="surface-panel fade-up-enter rounded-[2rem] p-4 sm:p-6 [animation-delay:220ms]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Accesos rápidos
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Entradas del sistema
                </h2>
              </div>
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Operación diaria
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group rounded-[1.5rem] border border-border/70 bg-background/75 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary transition-transform duration-200 group-hover:scale-105">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-base font-semibold text-foreground">
                            {action.title}
                          </h3>
                          <ArrowRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
        </div>

        <div className="grid gap-4">
          <section className="surface-panel fade-up-enter rounded-[2rem] p-4 sm:p-5 [animation-delay:280ms]">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Estado operativo
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.5rem] bg-primary/8 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary/14 p-2.5 text-primary">
                      <Sprout className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Trazabilidad activa</p>
                      <p className="text-sm text-muted-foreground">
                        La operación visible por perfil está conectada a fincas, lotes y registros.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-background/80 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-secondary p-2.5 text-secondary-foreground">
                      <Leaf className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Acceso por módulos</p>
                      <p className="text-sm text-muted-foreground">
                        Use el menú lateral para navegar y los accesos directos para entrar a flujos frecuentes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
          </section>

          <section className="surface-panel fade-up-enter rounded-[2rem] p-4 sm:p-5 [animation-delay:340ms]">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Sesión y control
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Button asChild variant="outline" size="lg" className="min-h-12 rounded-2xl bg-background/80 justify-start px-4">
                  <Link href="/fincas">
                    <MapPinned className="size-4" />
                    Abrir mapa productivo
                  </Link>
                </Button>
                <SignOutButton />
              </div>
          </section>
        </div>
      </section>
    </div>
  );
}
